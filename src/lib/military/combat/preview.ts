/**
 * Step 6 (research §7.5): the campaign preview. 1,000 seeded simulations of the engagement give distributions of
 * P(objective), losses (10th/50th/90th percentile) and days. The preview runs on the attacker's intelligence
 * estimate: each run draws the defender from the estimate's range, so uncertainty widens the distributions and the
 * preview never reveals the true odds. Its seed is not the commit seed, so it cannot be used to shop for one; the
 * binding result uses the commit seed only.
 */
import { OUTCOME_BANDS, PREVIEW_RUNS, type OutcomeBand } from "./constants";
import { estimatedDefender } from "./intel";
import { effectivePower, type EngagementSetup } from "./power";
import { resolveWithStream } from "./resolve";
import { seedStream } from "./rng";

export interface Percentiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface CampaignPreview {
  runs: number;
  /** Share of runs where the attacker took ground. */
  objective: number;
  bands: Record<OutcomeBand, number>;
  attackerCasualties: Percentiles;
  defenderCasualties: Percentiles;
  days: Percentiles;
}

/** Nearest-rank percentiles of a sample. */
export function percentiles(values: readonly number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] ?? 0;
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9) };
}

export function previewCampaign(input: {
  setup: EngagementSetup;
  sigma: number;
  /** The viewer's estimate draw (the same one the odds view uses). */
  u: number;
  seedHex: string;
  runs?: number;
}): CampaignPreview {
  const runs = Math.max(1, Math.round(input.runs ?? PREVIEW_RUNS));
  const stream = seedStream(input.seedHex);
  const bands = Object.fromEntries(OUTCOME_BANDS.map((b) => [b, 0])) as Record<OutcomeBand, number>;
  const attacker: number[] = [];
  const defender: number[] = [];
  const days: number[] = [];
  let objective = 0;
  for (let i = 0; i < runs; i++) {
    const setup = {
      ...input.setup,
      defender: estimatedDefender(input.setup.defender, input.sigma, input.u, stream.next()),
    };
    const result = resolveWithStream(setup, effectivePower(setup), stream);
    bands[result.band] += 1 / runs;
    if (result.objectiveReached) objective += 1;
    attacker.push(result.attacker.casualties);
    defender.push(result.defender.casualties);
    days.push(result.days);
  }
  return {
    runs,
    objective: objective / runs,
    bands,
    attackerCasualties: percentiles(attacker),
    defenderCasualties: percentiles(defender),
    days: percentiles(days),
  };
}
