/**
 * Steps 3–5 (research §7.5): the seeded roll, Dupuy-style daily losses, breakpoints from morale, and duration.
 *
 *   m      from the seed's first uniform (odds.ts)
 *   L_A,d  = base × era × size_A × env × fatigue_d × CEV_D/CEV_A × e^(−0.35 m)
 *   L_D,d  = base × era × size_D × env × fatigue_d × CEV_A/CEV_D × e^(+0.35 m) × fort_reduction
 *   B_D ~ N(0.35 morale_D, 0.10),  B_A ~ N(0.5 × 0.35 morale_A, 0.05)
 *
 * An engagement lasts until the objective day of its band, a breakpoint, or the planned days. Losses are shares of the
 * personnel each side engages; ground equipment goes at 6× (armor) … 0.1× (artillery) the personnel rate, aircraft by
 * per-sortie attrition, ships at the personnel rate. Pure: the same setup and seed always give the same result.
 */
import {
  AIRCREW_LOSS_SHARE,
  AIR_ATTRITION_BASE,
  AIR_ATTRITION_CAP,
  BREAKPOINT_ATTACKER_SD,
  BREAKPOINT_ATTACKER_SHARE,
  BREAKPOINT_DEFENDER_MEAN,
  BREAKPOINT_DEFENDER_SD,
  CAUSE_ATTACKING,
  CAUSE_DEFENDING,
  DEFENDER_ENGAGED_RATIO,
  ERA_LIMITED,
  ERA_MAJOR,
  FATIGUE,
  FORT_LOSS_REDUCTION,
  GENERIC_GROUND_EQUIPMENT_RATIO,
  GROUND_DOMAINS,
  KILLED_SHARE,
  LOSS_BASE_DAILY,
  MARGIN_LOSS_SLOPE,
  MAX_CAPITAL_LOSS,
  MAX_DAILY_LOSS,
  MAX_ENGAGEMENT_DAYS,
  MIN_BREAKPOINT,
  MORALE_MAX,
  MORALE_MIN,
  NAVAL_LOSS_RATIO,
  OBJECTIVE_DAY_SHARE,
  SIZE_BANDS,
  SORTIES_PER_DAY,
  TERRAIN_LOSS_DAMPING,
  type OutcomeBand,
} from "./constants";
import { bandOf, boundedRatio, marginFromUniform } from "./odds";
import { effectivePower, theatreSum, type CombatSide, type EffectivePower, type EngagementSetup } from "./power";
import { seedStream, type SeedStream } from "./rng";
import { campaignWeights } from "./theatre";
import type { BranchDomain } from "~/lib/military/model/constants";

export interface BranchLoss {
  id: string;
  domain: BranchDomain;
  /** Personnel lost (casualties). */
  personnel: number;
  /** Share of the branch engaged. */
  engagedShare: number;
  /** Cumulative casualty rate of the engaged force (the personnel rate equipment ratios scale). */
  lossRate: number;
  /** Share of the branch's uncatalogued capital destroyed. */
  capitalShare: number;
}

export interface SideLosses {
  engaged: number;
  casualties: number;
  /** Killed ≈ 25% of casualties. */
  deaths: number;
  branches: BranchLoss[];
}

export type EngagementEnd = "objective" | "defenderBroke" | "attackerHalted" | "duration";

export interface EngagementResult {
  u: number;
  margin: number;
  band: OutcomeBand;
  effectiveRatio: number;
  days: number;
  endedBy: EngagementEnd;
  /** The attacker took ground (margin ≥ 0). */
  objectiveReached: boolean;
  breakpoints: { attacker: number; defender: number };
  attacker: SideLosses;
  defender: SideLosses;
}

const clamp = (min: number, max: number, value: number) => Math.min(max, Math.max(min, value));

/** morale = clamp(0.6, 1.3, 0.5 R + 0.3 CEV + 0.2 cause). */
export const morale = (side: Pick<CombatSide, "readiness" | "cev">, cause: number) =>
  clamp(MORALE_MIN, MORALE_MAX, 0.5 * side.readiness + 0.3 * side.cev + 0.2 * cause);

export const sizeFactor = (personnel: number) =>
  SIZE_BANDS.find((band) => personnel < band.maxPersonnel)?.factor ?? SIZE_BANDS.at(-1)!.factor;

/** Each branch's engaged share: the attacker commits `commitment` of its theatre weight; the defender meets it. */
function engagedShares(setup: EngagementSetup) {
  const weights = campaignWeights(setup.theatre.campaign);
  const share = (d: BranchDomain) => Math.min(1, weights[d]);
  const attackerShares = setup.attacker.branches.map((b) => setup.commitment * share(b.domain));
  const attackerEngaged = setup.attacker.branches.reduce((t, b, i) => t + attackerShares[i]! * b.personnel, 0);
  const defenderTheatre = theatreSum(setup.defender.branches, capWeights(weights), (b) => b.personnel);
  const defenderEngaged = Math.min(defenderTheatre, DEFENDER_ENGAGED_RATIO * attackerEngaged);
  const scale = defenderTheatre > 0 ? defenderEngaged / defenderTheatre : 0;
  const defenderShares = setup.defender.branches.map((b) => scale * share(b.domain));
  return { attackerShares, attackerEngaged, defenderShares, defenderEngaged };
}

const capWeights = (weights: Record<BranchDomain, number>) =>
  Object.fromEntries(Object.entries(weights).map(([d, w]) => [d, Math.min(1, w)])) as Record<BranchDomain, number>;

interface DayLoop {
  attackerRate: number;
  defenderRate: number;
  days: number;
  endedBy: EngagementEnd;
}

/** Day-by-day losses until the objective day, a breakpoint, or the planned days. */
function runDays(input: {
  setup: EngagementSetup;
  power: EffectivePower;
  margin: number;
  band: OutcomeBand;
  engaged: { attacker: number; defender: number };
  breakpoints: { attacker: number; defender: number };
}): DayLoop {
  const { setup, margin } = input;
  const planned = clamp(1, MAX_ENGAGEMENT_DAYS, Math.round(setup.days));
  const share = OBJECTIVE_DAY_SHARE[input.band];
  const objectiveDay = share === undefined ? Number.POSITIVE_INFINITY : Math.max(1, Math.ceil(planned * share));
  const era = setup.mode === "pvp" ? ERA_MAJOR : ERA_LIMITED;
  const env = 1 / (1 + TERRAIN_LOSS_DAMPING * (setup.theatre.terrain - 1));
  const cevRatio = setup.defender.cev > 0 && setup.attacker.cev > 0 ? setup.defender.cev / setup.attacker.cev : 1;
  const base = LOSS_BASE_DAILY * era * env;
  const rateA = base * sizeFactor(input.engaged.attacker) * cevRatio * Math.exp(-MARGIN_LOSS_SLOPE * margin);
  const rateD =
    base *
    sizeFactor(input.engaged.defender) *
    (1 / cevRatio) *
    Math.exp(MARGIN_LOSS_SLOPE * margin) *
    (FORT_LOSS_REDUCTION[input.power.posture] ?? 1);
  let attackerRate = 0;
  let defenderRate = 0;
  for (let day = 1; day <= planned; day++) {
    const fatigue = FATIGUE[Math.min(day - 1, FATIGUE.length - 1)]!;
    attackerRate += Math.min(MAX_DAILY_LOSS, rateA * fatigue);
    defenderRate += Math.min(MAX_DAILY_LOSS, rateD * fatigue);
    const end = dayEnd(day, objectiveDay, attackerRate, defenderRate, input.breakpoints);
    if (end) return { attackerRate, defenderRate, days: day, endedBy: end };
  }
  return { attackerRate, defenderRate, days: planned, endedBy: "duration" };
}

function dayEnd(
  day: number,
  objectiveDay: number,
  attackerRate: number,
  defenderRate: number,
  breakpoints: { attacker: number; defender: number }
): EngagementEnd | null {
  if (day >= objectiveDay) return "objective";
  if (defenderRate >= breakpoints.defender) return "defenderBroke";
  if (attackerRate >= breakpoints.attacker) return "attackerHalted";
  return null;
}

/** Aircraft attrition per sortie: 0.01 × (enemy air defense / own air power)^0.5, capped at 0.05. */
function airAttrition(own: CombatSide, enemy: CombatSide): number {
  const power = (side: CombatSide, domain: BranchDomain) =>
    side.branches.filter((b) => b.domain === domain).reduce((t, b) => t + b.combatPower, 0);
  const ownAir = power(own, "air");
  if (!(ownAir > 0)) return 0;
  const threat = power(enemy, "air") + 0.25 * power(enemy, "land");
  return Math.min(AIR_ATTRITION_CAP, AIR_ATTRITION_BASE * Math.sqrt(boundedRatio(threat, ownAir)));
}

function sideLosses(input: {
  side: CombatSide;
  enemy: CombatSide;
  shares: number[];
  engaged: number;
  lossRate: number;
  days: number;
}): SideLosses {
  const attrition = airAttrition(input.side, input.enemy);
  const lossRate = Math.min(0.95, input.lossRate);
  const branches = input.side.branches.map((b, i): BranchLoss => {
    const engagedShare = input.shares[i] ?? 0;
    const engagedPersonnel = engagedShare * Math.max(0, b.personnel);
    if (b.domain === "air") {
      const lost = engagedShare * (1 - Math.pow(1 - attrition, input.days * SORTIES_PER_DAY));
      return {
        id: b.id,
        domain: b.domain,
        personnel: Math.max(0, b.personnel) * lost * AIRCREW_LOSS_SHARE,
        engagedShare,
        lossRate: lost,
        capitalShare: Math.min(MAX_CAPITAL_LOSS, lost),
      };
    }
    return {
      id: b.id,
      domain: b.domain,
      personnel: engagedPersonnel * lossRate,
      engagedShare,
      lossRate,
      capitalShare: Math.min(MAX_CAPITAL_LOSS, engagedShare * lossRate * capitalRatio(b.domain)),
    };
  });
  const casualties = branches.reduce((t, b) => t + b.personnel, 0);
  return { engaged: input.engaged, casualties, deaths: KILLED_SHARE * casualties, branches };
}

/** Uncatalogued capital lost per unit of personnel loss rate, by domain. */
function capitalRatio(domain: BranchDomain): number {
  if (GROUND_DOMAINS.includes(domain)) return GENERIC_GROUND_EQUIPMENT_RATIO;
  return domain === "sea" ? NAVAL_LOSS_RATIO : 0;
}

/** Resolve an engagement from a seed stream (the stream's first draws are the roll and the breakpoints). */
export function resolveWithStream(
  setup: EngagementSetup,
  power: EffectivePower,
  stream: SeedStream
): EngagementResult {
  const u = stream.next();
  const margin = marginFromUniform(power.effectiveRatio, u);
  const band = bandOf(margin);
  const breakpoints = {
    defender: Math.max(
      MIN_BREAKPOINT,
      BREAKPOINT_DEFENDER_MEAN * morale(setup.defender, CAUSE_DEFENDING) + BREAKPOINT_DEFENDER_SD * stream.normal()
    ),
    attacker: Math.max(
      MIN_BREAKPOINT,
      BREAKPOINT_ATTACKER_SHARE * BREAKPOINT_DEFENDER_MEAN * morale(setup.attacker, CAUSE_ATTACKING) +
        BREAKPOINT_ATTACKER_SD * stream.normal()
    ),
  };
  const shares = engagedShares(setup);
  const loop = runDays({
    setup,
    power,
    margin,
    band,
    engaged: { attacker: shares.attackerEngaged, defender: shares.defenderEngaged },
    breakpoints,
  });
  return {
    u,
    margin,
    band,
    effectiveRatio: power.effectiveRatio,
    days: loop.days,
    endedBy: loop.endedBy,
    objectiveReached: margin >= 0,
    breakpoints,
    attacker: sideLosses({
      side: setup.attacker,
      enemy: setup.defender,
      shares: shares.attackerShares,
      engaged: shares.attackerEngaged,
      lossRate: loop.attackerRate,
      days: loop.days,
    }),
    defender: sideLosses({
      side: setup.defender,
      enemy: setup.attacker,
      shares: shares.defenderShares,
      engaged: shares.defenderEngaged,
      lossRate: loop.defenderRate,
      days: loop.days,
    }),
  };
}

/** The binding resolution: the setup with its stored seed. A replay with the same inputs recomputes it exactly. */
export function resolveEngagement(setup: EngagementSetup, seedHex: string): EngagementResult {
  return resolveWithStream(setup, effectivePower(setup), seedStream(seedHex));
}
