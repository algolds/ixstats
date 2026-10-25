/**
 * Committing and resolving engagements (research §7.5 steps 3–5; exploit checklist 7). The seed is fixed at commit
 * from the battle id, the commit time on the attacker's realm clock and the orders hash, and stored with the inputs
 * snapshot; nothing rerolls it, and `replayEngagement` recomputes a stored result exactly. A resolution applies the
 * losses to both forces, writes the war damage and casualties as level effects, and makes a struck NPC stand to.
 */
import { randomUUID } from "crypto";
import type { MilitaryConflict, PrismaClient } from "@prisma/client";
import { createStorytellerEffects } from "~/lib/economy/storyteller-effects";
import {
  STRIKE_DAYS,
  resolveEngagement,
  type EngagementResult,
  type EngagementSetup,
} from "~/lib/military/combat";
import { engagementEffectDrafts, pvpDurationDays } from "~/lib/military/conflict-outcome";
import { warDamageLevels, warIntensity } from "~/lib/military/economy/feedback";
import { ALERT_LEVELS } from "~/lib/military/model";
import { resolveNeighbors } from "~/lib/national-issues/neighbors";
import { setAlertLevel } from "~/server/modules/defense";
import {
  buildEngagement,
  normaliseOrders,
  type Engagement,
  type EngagementOrders,
} from "./combat.engagement";
import { applyForceLosses } from "./combat.losses";
import { combatSeed, ordersHash } from "./combat.seed";

/** What a battle stores to replay: the setup it resolved and its seed (server only; never sent to a client). */
export interface StoredEngagement {
  version: 1;
  setup: EngagementSetup;
  seed: string;
}

/** Recompute a stored engagement exactly. */
export function replayEngagement(snapshot: string): EngagementResult {
  const stored: StoredEngagement = JSON.parse(snapshot);
  return resolveEngagement(stored.setup, stored.seed);
}

/** The seal of a commit: orders, their hash, the commit time and the seed. */
export function sealOrders(battleId: string, orders: EngagementOrders, committedClockMs: number) {
  const hash = ordersHash(orders);
  return {
    orders: JSON.stringify(orders),
    ordersHash: hash,
    committedClockMs,
    seed: combatSeed(battleId, committedClockMs, hash),
  };
}

/** The result columns a battle row stores. */
export function resultData(engagement: Engagement, result: EngagementResult, seed: string) {
  const intensity = warIntensity(result.attacker.engaged + result.defender.engaged, engagement.defender.econ.population);
  return {
    initiatorCasualties: Math.round(result.attacker.casualties),
    defenderCasualties: Math.round(result.defender.casualties),
    economicDamage: -warDamageLevels(intensity, result.days).home,
    outcomeBand: result.band,
    margin: result.margin,
    engagementDays: result.days,
    inputSnapshot: JSON.stringify({ version: 1, setup: engagement.setup, seed } satisfies StoredEngagement),
  };
}

/** A struck NPC raises its alert to High (it bites after 14 days), so it cannot be surprised again soon. */
async function npcStandsTo(db: PrismaClient, engagement: Engagement) {
  const defender = engagement.defender;
  if (defender.country.ownerUserId !== null) return;
  const ordered = defender.state.policy.alertLevel;
  if (ALERT_LEVELS.indexOf(ordered) >= ALERT_LEVELS.indexOf("high")) return;
  await setAlertLevel(db, { countryId: defender.country.id, alertLevel: "high" });
}

/** Losses on both forces, war damage and casualties on the economies, and the NPC's response. */
export async function applyConsequences(
  db: PrismaClient,
  input: { battleKey: string; engagement: Engagement; result: EngagementResult }
) {
  const { engagement, result } = input;
  const attacker = engagement.attacker.country;
  const defender = engagement.defender.country;
  await applyForceLosses(db, attacker.id, result.attacker);
  await applyForceLosses(db, defender.id, result.defender);
  const neighbours = await resolveNeighbors(defender.id, db);
  await createStorytellerEffects(
    db,
    engagementEffectDrafts({
      battleKey: input.battleKey,
      attacker: { id: attacker.id, name: attacker.name, population: engagement.attacker.econ.population },
      defender: { id: defender.id, name: defender.name, population: engagement.defender.econ.population },
      neighbourIds: neighbours.flatMap((n) => (n.countryId ? [n.countryId] : [])),
      result,
    })
  );
  await npcStandsTo(db, engagement);
}

/** A PvNPC strike: committed, resolved and applied at once. */
export async function commitStrike(
  db: PrismaClient,
  input: { attackerId: string; defenderId: string; commitment?: number; reason?: string }
) {
  const orders = normaliseOrders({ mode: "strike", ...input, days: STRIKE_DAYS });
  const engagement = await buildEngagement(db, orders);
  const battleId = randomUUID();
  const seal = sealOrders(battleId, orders, engagement.attacker.nowClockMs);
  const result = resolveEngagement(engagement.setup, seal.seed);
  const now = new Date();
  const conflict = await db.militaryConflict.create({
    data: {
      id: battleId,
      type: "pvnpc",
      initiatorId: input.attackerId,
      defenderId: input.defenderId,
      status: "resolved",
      initiatorApproved: true,
      defenderApproved: true,
      reason: input.reason,
      startDate: now,
      startClockMs: seal.committedClockMs,
      endDate: now,
      winner: result.objectiveReached ? input.attackerId : input.defenderId,
      ...seal,
      ...resultData(engagement, result, seal.seed),
    },
    include: {
      initiator: { select: { id: true, name: true } },
      defender: { select: { id: true, name: true } },
    },
  });
  await applyConsequences(db, { battleKey: `conflict:${battleId}`, engagement, result });
  return { conflict, result };
}

type PvPConflict = Pick<
  MilitaryConflict,
  "id" | "initiatorId" | "defenderId" | "orders" | "pvpRules" | "seed" | "startClockMs"
>;

/** The orders a PvP challenge carries (set at the proposal), or the defaults for one proposed before D3. */
export function pvpOrders(conflict: PvPConflict): EngagementOrders {
  const parsed: Partial<EngagementOrders> = conflict.orders ? JSON.parse(conflict.orders) : {};
  return normaliseOrders({
    mode: "pvp",
    attackerId: conflict.initiatorId,
    defenderId: conflict.defenderId,
    commitment: typeof parsed.commitment === "number" ? parsed.commitment : null,
    days: pvpDurationDays(conflict.pvpRules),
  });
}

/** The seal written when the defender accepts: the seed is fixed from then on (hidden until resolved). */
export const sealPvP = (conflict: PvPConflict, committedClockMs: number) =>
  sealOrders(conflict.id, pvpOrders(conflict), committedClockMs);

/**
 * Resolve a due PvP conflict on the seed fixed at acceptance (a conflict accepted before D3 seals now from its start).
 * The row is claimed atomically: a second call finds it resolved and applies nothing. Returns null when lost.
 */
export async function concludePvP(db: PrismaClient, conflict: PvPConflict) {
  const orders = pvpOrders(conflict);
  const seal = conflict.seed
    ? { seed: conflict.seed }
    : sealOrders(conflict.id, orders, conflict.startClockMs ?? 0);
  const engagement = await buildEngagement(db, orders);
  const result = resolveEngagement(engagement.setup, seal.seed);
  const winner = result.objectiveReached ? conflict.initiatorId : conflict.defenderId;
  const claimed = await db.militaryConflict.updateMany({
    where: { id: conflict.id, status: "active" },
    data: { status: "resolved", endDate: new Date(), winner, ...seal, ...resultData(engagement, result, seal.seed) },
  });
  if (claimed.count === 0) return null;
  await applyConsequences(db, { battleKey: `conflict:${conflict.id}`, engagement, result });
  return { winner, result };
}

export const newBattleId = () => randomUUID();
