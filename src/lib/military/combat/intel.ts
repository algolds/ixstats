/**
 * Intelligence estimates (owner decision: the enemy's power, and so the odds, is a range whose width shrinks with
 * intelligence investment, relations and reconnaissance). The estimate's error is drawn once per in-game week from a
 * server seed and is at most 0.8σ, so the shown range [est·e^−σ, est·e^+σ] always holds the true value while its
 * centre does not reveal it. Hidden true values never leave the server: the client view is built from the scaled
 * estimate, the public facts (personnel, alert, doctrine, terrain) and the viewer's own side.
 */
import {
  INTEL_BASE_SIGMA,
  INTEL_MIN_SIGMA,
  INTEL_NOISE_SHARE,
  INTEL_RANGE_STEPS,
  INTEL_RD_WEIGHT,
  INTEL_RECON_FACTOR,
  INTEL_RELATION_WEIGHT,
  OUTCOME_BANDS,
  type OutcomeBand,
  type Posture,
  type SurpriseLevel,
} from "./constants";
import { bandProbabilities, successProbability } from "./odds";
import {
  INFRASTRUCTURE_REFERENCE_GDP_SHARE,
  effectivePower,
  type CombatSide,
  type EffectivePower,
  type EngagementSetup,
  type Factor,
} from "./power";
import { RD_REFERENCE_GDP_SHARE } from "~/lib/military/model/constants";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** σ = 0.6 × (1 − 0.4 × R&D) × (1 − 0.3 × relations) × (½ with recon), at least 0.05. */
export function intelSigma(input: {
  rdStock: number;
  gdp: number;
  /** Relation strength 0–100 with the target (null: no relations). */
  relationStrength: number | null;
  recon: boolean;
}): number {
  const reference = RD_REFERENCE_GDP_SHARE * Math.max(0, input.gdp);
  const rd = reference > 0 ? clamp01(input.rdStock / reference) : 0;
  const relations = clamp01((input.relationStrength ?? 0) / 100);
  const sigma =
    INTEL_BASE_SIGMA *
    (1 - INTEL_RD_WEIGHT * rd) *
    (1 - INTEL_RELATION_WEIGHT * relations) *
    (input.recon ? INTEL_RECON_FACTOR : 1);
  return Math.max(INTEL_MIN_SIGMA, sigma);
}

/** The estimate's log error for a draw u ∈ [0, 1): at most 0.8σ either way. */
export const intelError = (sigma: number, u: number) => INTEL_NOISE_SHARE * sigma * (2 * clamp01(u) - 1);

export interface Range {
  low: number;
  estimate: number;
  high: number;
}

/** The estimated strength range of a true value. */
export function strengthRange(trueValue: number, sigma: number, u: number): Range {
  const error = intelError(sigma, u);
  return {
    low: trueValue * Math.exp(error - sigma),
    estimate: trueValue * Math.exp(error),
    high: trueValue * Math.exp(error + sigma),
  };
}

/**
 * The defender as the attacker's intelligence sees it at point t ∈ [0, 1] of the range: combat power scaled by
 * e^(ε + σ(2t − 1)), fortification at t of the full mark (unknown, so it spans the range), supply assumed full.
 */
export function estimatedDefender(defender: CombatSide, sigma: number, u: number, t: number): CombatSide {
  const scale = Math.exp(intelError(sigma, u) + sigma * (2 * t - 1));
  return {
    ...defender,
    branches: defender.branches.map((b) => ({ ...b, combatPower: b.combatPower * scale })),
    maintenanceFunding: 1,
    infrastructureStock: t * INFRASTRUCTURE_REFERENCE_GDP_SHARE * Math.max(0, defender.gdp),
  };
}

export interface EstimatedFactor extends Factor {
  /** Read from the estimate rather than known. */
  estimated: boolean;
}

/** What the attacker is shown: ranges for everything that depends on the enemy's hidden strength. */
export interface OddsView {
  sigma: number;
  attackerStrength: number;
  defenderStrength: Range;
  rawRatio: Range;
  effectiveRatio: Range;
  success: Range;
  bands: Record<OutcomeBand, Range>;
  attackerFactors: Factor[];
  attackerCapped: boolean;
  defenderFactors: EstimatedFactor[];
  posture: Posture;
  surprise: SurpriseLevel;
  density: number;
}

const ESTIMATED_KEYS: ReadonlySet<string> = new Set(["air", "supply", "fortification"]);

function rangeOf(values: readonly number[], estimate: number): Range {
  return { low: Math.min(...values), estimate, high: Math.max(...values) };
}

/** The attacker's view of an engagement: odds and band probabilities bounded over the estimate's range. */
export function oddsView(setup: EngagementSetup, sigma: number, u: number): OddsView {
  const at = (t: number): EffectivePower =>
    effectivePower({ ...setup, defender: estimatedDefender(setup.defender, sigma, u, t) });
  const grid = Array.from({ length: INTEL_RANGE_STEPS }, (_, i) => at(i / (INTEL_RANGE_STEPS - 1)));
  const middle = at(0.5);
  const bands = Object.fromEntries(
    OUTCOME_BANDS.map((band) => {
      const values = grid.map((p) => bandProbabilities(p.effectiveRatio)[band]);
      return [band, rangeOf(values, bandProbabilities(middle.effectiveRatio)[band])];
    })
  ) as Record<OutcomeBand, Range>;
  return {
    sigma,
    attackerStrength: middle.attacker.raw,
    defenderStrength: rangeOf(
      grid.map((p) => p.defender.raw),
      middle.defender.raw
    ),
    rawRatio: rangeOf(
      grid.map((p) => p.rawRatio),
      middle.rawRatio
    ),
    effectiveRatio: rangeOf(
      grid.map((p) => p.effectiveRatio),
      middle.effectiveRatio
    ),
    success: rangeOf(
      grid.map((p) => successProbability(p.effectiveRatio)),
      successProbability(middle.effectiveRatio)
    ),
    bands,
    attackerFactors: middle.attacker.factors,
    attackerCapped: middle.attacker.capped,
    defenderFactors: middle.defender.factors.map((f) => ({ ...f, estimated: ESTIMATED_KEYS.has(f.key) })),
    posture: middle.posture,
    surprise: setup.surprise,
    density: middle.density,
  };
}
