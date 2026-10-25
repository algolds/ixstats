/**
 * Operations on the combat model: what they cost per day (paid from the Defense budget's O&M line, research §7.3:
 * "the O&M line first pays operations and supply for active deployments"), what their resolution means for the
 * success rating, and how much of the force an intervention commits.
 */
import type { OutcomeBand } from "./constants";
import { MIN_COMMITMENT } from "./constants";

export const OPERATION_TYPES = [
  "peacekeeping",
  "defense_pact",
  "blockade",
  "intervention",
  "training",
  "reconnaissance",
] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

/**
 * Incremental cost of a deployed person per year as a multiple of GDP per capita (allowances, transport, supply):
 * peacekeeping ≈ UN contributor reimbursement scale, combat operations several times that (designer).
 */
export const OPERATION_COST_GDPPC: Record<OperationType, number> = {
  training: 0.25,
  peacekeeping: 1,
  defense_pact: 0.75,
  blockade: 1.5,
  intervention: 3,
  reconnaissance: 1,
};
/** Deployed equipment's upkeep runs at 1.5× its annual maintenance (designer, deployment wear). */
export const OPERATION_ASSET_UPKEEP = 1.5;
/** Operations that fight their target on the combat model. */
export const COMBAT_OPERATIONS: ReadonlySet<OperationType> = new Set(["intervention"]);

/** An operation's daily cost: personnel at the type's rate of GDP per capita, plus deployed upkeep. */
export function operationDailyCost(input: {
  type: OperationType;
  personnel: number;
  gdpPerCapita: number;
  /** Σ annual maintenance × quantity of the deployed assets. */
  assetMaintenanceAnnual: number;
}): number {
  const perPerson = (OPERATION_COST_GDPPC[input.type] * Math.max(0, input.gdpPerCapita)) / 365;
  return Math.max(0, input.personnel) * perPerson + (OPERATION_ASSET_UPKEEP * Math.max(0, input.assetMaintenanceAnnual)) / 365;
}

export type OperationRating = "success" | "partial" | "failure";

const BAND_RATING: Record<OutcomeBand, OperationRating> = {
  repulsedHeavy: "failure",
  repulsed: "failure",
  marginal: "partial",
  success: "success",
  breakthrough: "success",
};
const RANK: Record<OperationRating, number> = { failure: 0, partial: 1, success: 2 };

/** An intervention is rated by its battle and by how long it ran, whichever is worse. */
export function combinedRating(duration: OperationRating, band: OutcomeBand | null): OperationRating {
  if (!band) return duration;
  const battle = BAND_RATING[band];
  return RANK[battle] < RANK[duration] ? battle : duration;
}

/** Share of the theatre's ground forces an intervention commits: its personnel over the nation's ground personnel. */
export function interventionCommitment(personnel: number, groundPersonnel: number): number {
  if (!(groundPersonnel > 0)) return 1;
  return Math.min(1, Math.max(MIN_COMMITMENT, personnel / groundPersonnel));
}
