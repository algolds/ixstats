/**
 * Defense figures only a nation's owner (or a privileged role) may read. Branches, operations and
 * conflicts stay public; what they cost does not: an operation's personnel, daily cost, cost so
 * far and GDP drain, and a conflict's casualties and economic damage (shown to its parties).
 */

type OperationCostField = "personnelDeployed" | "dailyCost" | "totalCostSoFar" | "gdpDrain";
type ConflictCostField = "initiatorCasualties" | "defenderCasualties" | "economicDamage";

/** `T` without `K`, typed so callers can still read the fields (as undefined). */
type Redacted<T, K extends keyof T> = Omit<T, K> & { [P in K]?: undefined };

/** An operation without its personnel and costs. */
export function redactOperationCosts<T extends Record<OperationCostField, number>>(
  operation: T
): Redacted<T, OperationCostField> {
  const {
    personnelDeployed: _personnelDeployed,
    dailyCost: _dailyCost,
    totalCostSoFar: _totalCostSoFar,
    gdpDrain: _gdpDrain,
    ...rest
  } = operation;
  return rest as Redacted<T, OperationCostField>;
}

/** A conflict without its casualties and economic damage. */
export function redactConflictCosts<T extends Record<ConflictCostField, number>>(
  conflict: T
): Redacted<T, ConflictCostField> {
  const {
    initiatorCasualties: _initiatorCasualties,
    defenderCasualties: _defenderCasualties,
    economicDamage: _economicDamage,
    ...rest
  } = conflict;
  return rest as Redacted<T, ConflictCostField>;
}
