/**
 * Defense ↔ economy feedback on the realm clock (realm time D3; research §7.6–7.7). Runs after a defense sync that
 * applied whole months, so at most once per in-game month per nation, and is idempotent (keyed levels via
 * `syncLevelEffects`, stamped at the nation's clock):
 *
 * - crowd-out, R&D spillover and the mobilisation/conscription labour hit as keyed GDP levels;
 * - the burden collapse hazard (50–75% of GDP), rolled per month from a hash of the nation and month, so a re-run
 *   rolls the same and a hit is written once under its month's key;
 * - an NPC's damped Richardson step on its threats, stored as its burden adjustment.
 *
 * Syncs of rivals made while computing an NPC's threats run with the feedback suppressed, so one nation's month never
 * cascades through the realm (their own feedback runs on their next month).
 */
import { AsyncLocalStorage } from "async_hooks";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { COOPERATIVE_FP_TYPES } from "~/lib/diplomacy/proposal-lifecycle";
import { syncLevelEffects } from "~/lib/economy/storyteller-effects";
import { StorytellerEffectType } from "~/lib/economy/calculations";
import { CAMPAIGN_WEIGHTS, DEFAULT_DISTANCE_KM, reachFactor, theatreSum } from "~/lib/military/combat";
import {
  COLLAPSE_GDP_LOSS,
  COLLAPSE_PHASE_YEARS,
  FEEDBACK_KEYS,
  collapseHazard,
  collapseKey,
  defenseFeedbackTargets,
} from "~/lib/military/economy/feedback";
import {
  GRIEVANCE_PER_STRIKE,
  intentOf,
  richardsonAfter,
  threatOf,
} from "~/lib/military/economy/richardson";
import { DAY_MS, MONTH_MS, type NationView } from "~/lib/military/model";
import { resolveNeighbors } from "~/lib/national-issues/neighbors";
import type { DefenseDb, DefenseSnapshot } from "./defense.sync";

const suppressed = new AsyncLocalStorage<boolean>();

/** Run `fn` with the feedback of any nested defense sync suppressed. */
export const withoutFeedback = <T>(fn: () => Promise<T>) => suppressed.run(true, fn);
export const feedbackSuppressed = () => suppressed.getStore() === true;

/** A uniform in [0, 1) from the nation and month (deterministic, so a re-run rolls the same). */
export function monthRoll(countryId: string, monthIndex: number): number {
  const hex = createHash("sha256").update(`collapse|${countryId}|${monthIndex}`).digest("hex");
  return Number.parseInt(hex.slice(0, 13), 16) / 2 ** 52;
}

/** The months a tick from `fromMs` to `toMs` applied, as indices on the shared timeline. */
export function appliedMonths(fromMs: number, toMs: number): number[] {
  const months = Math.max(0, Math.floor((toMs - fromMs) / MONTH_MS));
  const first = Math.floor(fromMs / MONTH_MS) + 1;
  return Array.from({ length: months }, (_, i) => first + i);
}

const landPower = (view: NationView) =>
  theatreSum(view.branches, CAMPAIGN_WEIGHTS.land, (b) => b.combatPower);

/** The NPC's rivals: neighbours, conflict opponents, and nations acting against it. */
async function rivalsOf(db: DefenseDb, countryId: string) {
  const [neighbours, conflicts, actions, relations] = await Promise.all([
    resolveNeighbors(countryId, db as never),
    db.militaryConflict.findMany({
      where: { status: { in: ["proposed", "active"] }, OR: [{ initiatorId: countryId }, { defenderId: countryId }] },
      select: { initiatorId: true, defenderId: true },
    }),
    db.foreignPolicyAction.findMany({
      where: { targetId: countryId, status: "active", actionType: { notIn: [...COOPERATIVE_FP_TYPES] } },
      select: { initiatorId: true },
    }),
    db.diplomaticRelation.findMany({
      where: { OR: [{ country1: countryId }, { country2: countryId }] },
      select: { country1: true, country2: true, strength: true },
    }),
  ]);
  const neighbourIds = new Set(neighbours.flatMap((n) => (n.countryId && n.countryId !== countryId ? [n.countryId] : [])));
  const opponents = new Set(conflicts.map((c) => (c.initiatorId === countryId ? c.defenderId : c.initiatorId)));
  const acts = new Map<string, number>();
  for (const a of actions) acts.set(a.initiatorId, (acts.get(a.initiatorId) ?? 0) + 1);
  const relation = new Map(relations.map((r) => [r.country1 === countryId ? r.country2 : r.country1, r.strength]));
  const ids = [...new Set([...neighbourIds, ...opponents, ...acts.keys()])].slice(0, 12);
  return { ids, neighbourIds, opponents, acts, relation };
}

/** One damped Richardson step for an NPC over the months just applied. */
async function stepNpcBurden(db: DefenseDb, snapshot: DefenseSnapshot, months: number, sync: SyncFn) {
  const id = snapshot.country.id;
  const rivals = await rivalsOf(db, id);
  const own = landPower(snapshot.view);
  let threatSum = 0;
  for (const rivalId of rivals.ids) {
    const rival = await withoutFeedback(() => sync(db, rivalId)).catch(() => null);
    if (!rival) continue;
    const neighbour = rivals.neighbourIds.has(rivalId);
    const projected =
      landPower(rival.view) * (neighbour ? 1 : reachFactor(DEFAULT_DISTANCE_KM, rival.state.policy.doctrine));
    const intent = intentOf({
      relationStrength: rivals.relation.get(rivalId) ?? null,
      inConflict: rivals.opponents.has(rivalId),
      hostileActs: rivals.acts.get(rivalId) ?? 0,
      alert: rival.view.alert,
      mobilising: rival.state.branches.some((b) => b.mobilisationOrder > 0),
    });
    threatSum += threatOf({ projected, own, intent });
  }
  const strikes = await db.militaryConflict.count({
    where: { type: "pvnpc", defenderId: id, startClockMs: { gte: snapshot.nowClockMs - 365.25 * DAY_MS } },
  });
  const policy = await db.defensePolicy.findUnique({ where: { countryId: id }, select: { npcBurdenAdjustment: true } });
  const current = policy?.npcBurdenAdjustment ?? 0;
  const gdp = snapshot.econ.gdp;
  const next = richardsonAfter({
    current,
    baseBurden: gdp > 0 ? snapshot.econ.defenseBudget / gdp - current : 0,
    threatSum,
    grievance: GRIEVANCE_PER_STRIKE * strikes,
    years: months / 12,
  });
  await db.defensePolicy.update({ where: { countryId: id }, data: { npcBurdenAdjustment: next } });
  return next;
}

/** Collapse rolls for the months applied; a hit writes its month's keyed level once. */
async function rollCollapse(db: DefenseDb, snapshot: DefenseSnapshot, previousTickMs: number) {
  const hazard = collapseHazard(snapshot.view.burden);
  if (hazard <= 0) return 0;
  const id = snapshot.country.id;
  let hits = 0;
  for (const month of appliedMonths(previousTickMs, snapshot.state.lastTickClockMs)) {
    if (monthRoll(id, month) >= hazard) continue;
    hits += 1;
    const key = collapseKey(month);
    await syncLevelEffects(
      db,
      { countryId: id, createdBy: key },
      [
        {
          countryId: id,
          inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
          value: COLLAPSE_GDP_LOSS,
          duration: COLLAPSE_PHASE_YEARS,
          description: "The economy buckles under defense spending",
          createdBy: key,
        },
      ],
      snapshot.nowClockMs
    );
  }
  return hits;
}

type SyncFn = (db: DefenseDb, countryId: string) => Promise<DefenseSnapshot>;

/** The feedback after a sync that applied months (`previousTickMs` → the snapshot's tick). */
export async function syncDefenseFeedback(
  db: DefenseDb,
  snapshot: DefenseSnapshot,
  previousTickMs: number,
  sync: SyncFn
) {
  const { country, view, state, econ } = snapshot;
  const conscripts = state.branches.reduce((sum, b) => sum + b.active, 0) * (1 - state.policy.volunteerShare);
  const targets = defenseFeedbackTargets({
    countryId: country.id,
    burden: view.burden,
    rdStock: state.policy.rdStock,
    gdp: econ.gdp,
    mobilised: view.branches.reduce((sum, b) => sum + b.mobilised, 0),
    conscripts,
    population: econ.population,
  });
  const where: Prisma.StorytellerEffectWhereInput = {
    countryId: country.id,
    createdBy: { in: Object.values(FEEDBACK_KEYS) },
  };
  const written = await syncLevelEffects(db, where, targets, snapshot.nowClockMs);
  const collapses = await rollCollapse(db, snapshot, previousTickMs);
  const npcAdjustment =
    country.ownerUserId === null ? await stepNpcBurden(db, snapshot, snapshot.monthsApplied, sync) : null;
  return { written, collapses, npcAdjustment };
}
