/**
 * Step 2 and the roll of step 3 (research §7.5): logistic odds on the effective force ratio with 5% catastrophe
 * tails, outcome bands in closed form, and the margin a uniform draw sets.
 *
 *   x = ln FR;  P(m > c) = 0.05 × [t > c] + 0.90 × σ(k (x − c));  P(success) = P(m > 0)
 *
 * t is the margin the defender's catastrophe sets: +1.5 (a breakthrough), or +0.2 (a marginal gain) when the attack
 * is hopeless (FR below 0.1). The attacker's catastrophe (−1.5) lies below every band edge.
 */
import {
  BAND_EDGES,
  CATASTROPHE_MARGIN,
  CATASTROPHE_TAIL,
  HOPELESS_CATASTROPHE_MARGIN,
  HOPELESS_RATIO,
  MAX_FORCE_RATIO,
  MIN_FORCE_RATIO,
  ODDS_SLOPE,
  OUTCOME_BANDS,
  type OutcomeBand,
} from "./constants";

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const CORE = 1 - 2 * CATASTROPHE_TAIL;

/** A force ratio inside [0.01, 100]; an empty defender is 100, an empty attacker 0.01. */
export function boundedRatio(attacker: number, defender: number): number {
  if (!(attacker > 0)) return MIN_FORCE_RATIO;
  if (!(defender > 0)) return MAX_FORCE_RATIO;
  return Math.min(MAX_FORCE_RATIO, Math.max(MIN_FORCE_RATIO, attacker / defender));
}

/** The margin the defender's catastrophe sets: a breakthrough, capped at a marginal gain in a hopeless attack. */
export function defenderCatastropheMargin(ratio: number): number {
  return ratio < HOPELESS_RATIO ? HOPELESS_CATASTROPHE_MARGIN : CATASTROPHE_MARGIN;
}

/** P(m > c) at force ratio `ratio`. */
export function marginExceeds(ratio: number, c: number): number {
  const tail = defenderCatastropheMargin(ratio) > c ? CATASTROPHE_TAIL : 0;
  return tail + CORE * sigmoid(ODDS_SLOPE * (Math.log(ratio) - c));
}

/** P(success) = 0.05 + 0.90 σ(2.5 ln FR) (a hopeless attack's tail is a marginal gain, still ground taken). */
export const successProbability = (ratio: number) => marginExceeds(ratio, 0);

export type BandProbabilities = Record<OutcomeBand, number>;

/** Each band's probability: differences of P(m > edge). They sum to 1. */
export function bandProbabilities(ratio: number): BandProbabilities {
  const above = BAND_EDGES.map((edge) => marginExceeds(ratio, edge));
  const result = {} as BandProbabilities;
  OUTCOME_BANDS.forEach((band, i) => {
    const lower = i === 0 ? 1 : above[i - 1]!;
    const upper = i < above.length ? above[i]! : 0;
    result[band] = lower - upper;
  });
  return result;
}

/** The band a margin falls in. */
export function bandOf(margin: number): OutcomeBand {
  const index = BAND_EDGES.findIndex((edge) => margin < edge);
  return OUTCOME_BANDS[index === -1 ? OUTCOME_BANDS.length - 1 : index]!;
}

/**
 * The margin a uniform draw u ∈ [0, 1) sets: the defender's catastrophe margin below its tail (+1.5, or +0.2 in a
 * hopeless attack), −1.5 above the attacker's, otherwise x + (1/k) logit((u − 0.05) / 0.90).
 */
export function marginFromUniform(ratio: number, u: number): number {
  if (u < CATASTROPHE_TAIL) return defenderCatastropheMargin(ratio);
  if (u > 1 - CATASTROPHE_TAIL) return -CATASTROPHE_MARGIN;
  const v = Math.min(1 - 1e-12, Math.max(1e-12, (u - CATASTROPHE_TAIL) / CORE));
  return Math.log(ratio) + Math.log(v / (1 - v)) / ODDS_SLOPE;
}
