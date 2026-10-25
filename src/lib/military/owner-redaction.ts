/**
 * Defense figures only a nation's owner (or a privileged role) may read. Branches, operations and conflicts stay
 * public; their internals do not: a branch's capital, readiness sub-scores, mobilisation and allocation (others see
 * the public order of battle, and D3's intelligence estimates), an operation's personnel, daily cost, cost so far
 * and GDP drain, and a conflict's casualties and economic damage (shown to its parties).
 */

type OperationCostField = "personnelDeployed" | "dailyCost" | "totalCostSoFar" | "gdpDrain";
type ConflictCostField = "initiatorCasualties" | "defenderCasualties" | "economicDamage";
/** A branch row's model internals. */
interface BranchInternals {
  capital: number;
  readinessPersonnel: number;
  readinessEquipment: number;
  readinessCondition: number;
  readinessTraining: number;
  reserveTraining: number;
  mobilisationOrder: number;
  mobilisationOrderedClockMs: number | null;
  mobilised: number;
  effortShare: number;
  targetActive: number | null;
  lastTickClockMs: number;
}
type BranchInternalField = keyof BranchInternals;

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

/** A branch as the public order of battle: identity and rounded headcounts, no model internals. */
export function redactBranchInternals<
  T extends BranchInternals & { activeDuty: number; reserves: number },
>(branch: T): Redacted<T, BranchInternalField> {
  const {
    capital: _capital,
    readinessPersonnel: _readinessPersonnel,
    readinessEquipment: _readinessEquipment,
    readinessCondition: _readinessCondition,
    readinessTraining: _readinessTraining,
    reserveTraining: _reserveTraining,
    mobilisationOrder: _mobilisationOrder,
    mobilisationOrderedClockMs: _mobilisationOrderedClockMs,
    mobilised: _mobilised,
    effortShare: _effortShare,
    targetActive: _targetActive,
    lastTickClockMs: _lastTickClockMs,
    ...rest
  } = branch;
  return {
    ...rest,
    activeDuty: Math.round(branch.activeDuty),
    reserves: Math.round(branch.reserves),
  } as Redacted<T, BranchInternalField>;
}
