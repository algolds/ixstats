/**
 * Step 1 (research §7.5): each side's effective combat power in the theatre.
 *
 *   CP_A,eff = CP_A,theatre × reach × [surprise × air × supply × doctrine]                 (bracket capped at ×4)
 *   CP_D,eff = CP_D,theatre × [posture_eff × terrain × air × supply × doctrine × fort]      (bracket capped at ×4)
 *
 * Theatre power weights branches by the campaign (a land campaign is army + 0.5 air + 0.2 navy); reach is power
 * projection over distance and sits outside the cap. Posture scales with front density (force-to-space).
 */
import {
  AIR_INFERIORITY_FACTOR,
  AIR_SUPERIORITY_FACTOR,
  AIR_SUPERIORITY_RATIO,
  DOCTRINE_FACTOR,
  FORCE_DENSITY_PER_KM,
  FORT_MAX_BONUS,
  GROUND_DOMAINS,
  MULTIPLIER_CAP,
  POSTURE_BY_ALERT,
  POSTURE_FACTOR,
  SUPPLY_BASE_DAYS,
  SUPPLY_FLOOR,
  SUPPLY_REFERENCE_DAYS,
  SURPRISE_DECAY_DAYS,
  SURPRISE_FACTOR,
  type EngagementMode,
  type Posture,
  type SurpriseLevel,
} from "./constants";
import { boundedRatio } from "./odds";
import { campaignWeights, reachFactor, type Theatre } from "./theatre";
import {
  DEFAULT_SHARES,
  FALLBACK_GDP_SHARE,
  INFRASTRUCTURE_DELTA,
  monthlyRate,
  type AlertLevel,
  type BranchDomain,
  type Doctrine,
} from "~/lib/military/model/constants";

/** One branch as combat reads it (from the defense model's derived view). */
export interface CombatBranch {
  id: string;
  domain: BranchDomain;
  combatPower: number;
  personnel: number;
  capital: number;
}

/** One side of an engagement. */
export interface CombatSide {
  countryId: string;
  branches: CombatBranch[];
  cev: number;
  /** Personnel-weighted readiness R. */
  readiness: number;
  doctrine: Doctrine;
  /** The alert level in effect. */
  alert: AlertLevel;
  /** Maintenance O&M funding ratio f_m (supply). */
  maintenanceFunding: number;
  infrastructureStock: number;
  gdp: number;
}

export interface EngagementSetup {
  mode: EngagementMode;
  attacker: CombatSide;
  defender: CombatSide;
  theatre: Theatre;
  /** Share of the attacker's theatre forces committed, in [0.1, 1]. */
  commitment: number;
  /** Planned engagement days. */
  days: number;
  surprise: SurpriseLevel;
}

export type FactorKey =
  | "reach"
  | "surprise"
  | "air"
  | "supply"
  | "doctrine"
  | "posture"
  | "terrain"
  | "fortification";

export interface Factor {
  key: FactorKey;
  value: number;
}

export interface SidePower {
  /** Theatre combat power before multipliers (the attacker's scaled by commitment). */
  raw: number;
  factors: Factor[];
  /** Product of the situational multipliers after the ×4 cap (reach excluded). */
  product: number;
  capped: boolean;
  effective: number;
}

export interface EffectivePower {
  attacker: SidePower;
  defender: SidePower;
  rawRatio: number;
  effectiveRatio: number;
  posture: Posture;
  /** Defender ground personnel against what the front needs (1 = full density). */
  density: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Infrastructure stock (share of GDP) of a nation at the default 2% budget and 7% share: the full-fortification mark. */
export const INFRASTRUCTURE_REFERENCE_GDP_SHARE =
  (FALLBACK_GDP_SHARE * DEFAULT_SHARES.infrastructure) / 12 / monthlyRate(INFRASTRUCTURE_DELTA);

/** Σ weight × value over a side's branches. */
export function theatreSum(
  branches: readonly CombatBranch[],
  weights: Record<BranchDomain, number>,
  pick: (b: CombatBranch) => number
): number {
  return branches.reduce((total, b) => total + weights[b.domain] * Math.max(0, pick(b)), 0);
}

const groundPersonnel = (side: CombatSide) =>
  side.branches
    .filter((b) => GROUND_DOMAINS.includes(b.domain))
    .reduce((total, b) => total + Math.max(0, b.personnel), 0);

/** The surprise factor averaged over the engagement's days: it decays by a third a day over three days. */
export function surpriseOverDays(level: SurpriseLevel, days: number): number {
  const extra = SURPRISE_FACTOR[level] - 1;
  const span = Math.max(1, Math.round(days));
  let total = 0;
  for (let d = 0; d < Math.min(span, SURPRISE_DECAY_DAYS); d++) total += 1 - d / SURPRISE_DECAY_DAYS;
  return 1 + (extra * total) / span;
}

/** Air superiority from the ratio of air power: holder ×1.3, the other side ×0.85, parity 1 (smooth in log ratio). */
export function airFactors(attackerAir: number, defenderAir: number): { attacker: number; defender: number } {
  if (!(attackerAir > 0) && !(defenderAir > 0)) return { attacker: 1, defender: 1 };
  const t = Math.max(
    -1,
    Math.min(1, Math.log(boundedRatio(attackerAir, defenderAir)) / Math.log(AIR_SUPERIORITY_RATIO))
  );
  const up = AIR_SUPERIORITY_FACTOR - 1;
  const down = 1 - AIR_INFERIORITY_FACTOR;
  return t >= 0
    ? { attacker: 1 + up * t, defender: 1 - down * t }
    : { attacker: 1 + down * t, defender: 1 - up * t };
}

/** supply = max(0.5, min(1, DoS / 7)^0.5), DoS = 14 days × funding × reach. */
export function supplyFactor(maintenanceFunding: number, reach: number): number {
  const days = SUPPLY_BASE_DAYS * clamp01(maintenanceFunding) * clamp01(reach);
  return Math.max(SUPPLY_FLOOR, Math.sqrt(Math.min(1, days / SUPPLY_REFERENCE_DAYS)));
}

/** Infrastructure stock against the full-fortification mark, in [0, 1]. */
export const fortificationRatio = (side: Pick<CombatSide, "infrastructureStock" | "gdp">) =>
  side.gdp > 0 ? clamp01(side.infrastructureStock / (INFRASTRUCTURE_REFERENCE_GDP_SHARE * side.gdp)) : 0;

/** The defender's posture: from its alert in effect; War is fortified only with half the infrastructure mark. */
export function defenderPosture(defender: CombatSide): Posture {
  const posture = POSTURE_BY_ALERT[defender.alert];
  return posture === "fortified" && fortificationRatio(defender) < 0.5 ? "prepared" : posture;
}

const fortificationFactor = (defender: CombatSide, posture: Posture) =>
  posture === "prepared" || posture === "fortified" ? 1 + FORT_MAX_BONUS * fortificationRatio(defender) : 1;

function capped(raw: number, factors: Factor[], outside: number): SidePower {
  const product = factors.filter((f) => f.key !== "reach").reduce((p, f) => p * f.value, 1);
  const bounded = Math.min(MULTIPLIER_CAP, product);
  return { raw, factors, product: bounded, capped: product > MULTIPLIER_CAP, effective: raw * outside * bounded };
}

/** Both sides' effective combat power and the ratios (step 1). */
export function effectivePower(setup: EngagementSetup): EffectivePower {
  const { attacker, defender, theatre } = setup;
  const weights = campaignWeights(theatre.campaign);
  const reach = reachFactor(theatre.distanceKm, attacker.doctrine);
  const commitment = clamp01(setup.commitment);
  const rawA = commitment * theatreSum(attacker.branches, weights, (b) => b.combatPower);
  const rawD = theatreSum(defender.branches, weights, (b) => b.combatPower);
  const airOnly = (b: CombatBranch) => (b.domain === "air" ? b.combatPower : 0);
  const air = airFactors(
    commitment * reach * theatreSum(attacker.branches, weights, airOnly),
    theatreSum(defender.branches, weights, airOnly)
  );
  const posture = defenderPosture(defender);
  const density = groundPersonnel(defender) / (theatre.frontKm * FORCE_DENSITY_PER_KM);
  const postureEff = 1 + (POSTURE_FACTOR[posture] - 1) * Math.min(1, density);
  const attackerSide = capped(
    rawA,
    [
      { key: "reach", value: reach },
      { key: "surprise", value: surpriseOverDays(setup.surprise, setup.days) },
      { key: "air", value: air.attacker },
      { key: "supply", value: supplyFactor(attacker.maintenanceFunding, reach) },
      { key: "doctrine", value: DOCTRINE_FACTOR[attacker.doctrine].attack },
    ],
    reach
  );
  const defenderSide = capped(
    rawD,
    [
      { key: "posture", value: postureEff },
      { key: "terrain", value: theatre.terrain },
      { key: "air", value: air.defender },
      { key: "supply", value: supplyFactor(defender.maintenanceFunding, 1) },
      { key: "doctrine", value: DOCTRINE_FACTOR[defender.doctrine].defend },
      { key: "fortification", value: fortificationFactor(defender, posture) },
    ],
    1
  );
  return {
    attacker: attackerSide,
    defender: defenderSide,
    rawRatio: boundedRatio(rawA, rawD),
    effectiveRatio: boundedRatio(attackerSide.effective, defenderSide.effective),
    posture,
    density,
  };
}
