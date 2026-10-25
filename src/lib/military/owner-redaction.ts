/**
 * Defense figures only a nation's owner (or a privileged role) may read. Branches, operations and
 * conflicts stay public; what they cost does not: an operation's personnel, daily cost, cost so
 * far and GDP drain, and a conflict's casualties and economic damage (shown to its parties).
 */

const OPERATION_COST_FIELDS = [
  "personnelDeployed",
  "dailyCost",
  "totalCostSoFar",
  "gdpDrain",
] as const;
type OperationCostField = (typeof OPERATION_COST_FIELDS)[number];

const CONFLICT_COST_FIELDS = [
  "initiatorCasualties",
  "defenderCasualties",
  "economicDamage",
] as const;
type ConflictCostField = (typeof CONFLICT_COST_FIELDS)[number];

type Redacted<T, K extends keyof T> = Omit<T, K> & { [P in K]?: undefined };

function omit<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Redacted<T, K> {
  const out = { ...row };
  for (const key of keys) delete out[key];
  return out;
}

/** An operation without its personnel and costs. */
export function redactOperationCosts<T extends Record<OperationCostField, number>>(
  operation: T
): Redacted<T, OperationCostField> {
  return omit(operation, OPERATION_COST_FIELDS);
}

/** A conflict without its casualties and economic damage. */
export function redactConflictCosts<T extends Record<ConflictCostField, number>>(
  conflict: T
): Redacted<T, ConflictCostField> {
  return omit(conflict, CONFLICT_COST_FIELDS);
}
