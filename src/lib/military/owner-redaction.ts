/**
 * Defense figures only a nation's owner (or a privileged role) may read. Branches, operations and conflicts stay
 * public; their internals do not: a branch's exact headcounts, capital, readiness sub-scores, mobilisation,
 * allocation, units and equipment (others see its name, domain and a strength band, and D3's intelligence
 * estimates), an operation's personnel, daily cost, cost so far and GDP drain, and a conflict's casualties and
 * economic damage (shown to its parties).
 *
 * Strength bands: a headcount is shown as the 1-2-5 band it falls in (1,000 to 2,000; 2,000 to 5,000; 5,000 to
 * 10,000; …), a fixed grid, so no exact figure can be read back from it. A band spans ×2 to ×2.5, about the width
 * of the odds screen's default intel range (×1.4 either side of the estimate).
 */

type OperationCostField = "personnelDeployed" | "dailyCost" | "totalCostSoFar" | "gdpDrain";
type ConflictCostField = "initiatorCasualties" | "defenderCasualties" | "economicDamage";
/** A headcount as the band an outsider sees. */
export interface StrengthBand {
  low: number;
  high: number;
}

/** The 1-2-5 band `n` falls in ({0, 0} under one person). */
export function strengthBand(n: number): StrengthBand {
  if (!(n >= 1)) return { low: 0, high: 0 };
  let decade = 10 ** Math.floor(Math.log10(n));
  if (10 * decade <= n) decade *= 10; // log10 can land just under a power of ten
  if (n < 2 * decade) return { low: decade, high: 2 * decade };
  if (n < 5 * decade) return { low: 2 * decade, high: 5 * decade };
  return { low: 5 * decade, high: 10 * decade };
}

/** "10,000 to 20,000", or "None". */
export function formatStrengthBand(band: StrengthBand): string {
  if (band.high === 0) return "None";
  return `${band.low.toLocaleString("en-US")} to ${band.high.toLocaleString("en-US")}`;
}

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

/** A branch row's exact figures, hidden from outsiders as well as its internals. */
type BranchExactField = BranchInternalField | "activeDuty" | "reserves" | "civilianStaff";

/**
 * A branch as the public order of battle: its identity and strength bands; no exact headcounts, no model internals,
 * and no units or equipment (the lists come back empty, typed as the owner's).
 */
export function redactBranchInternals<
  T extends BranchInternals & {
    activeDuty: number;
    reserves: number;
    civilianStaff: number;
    units: readonly unknown[];
    assets: readonly unknown[];
  },
>(
  branch: T
): Redacted<T, BranchExactField> & { strength: StrengthBand; reserveStrength: StrengthBand } {
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
    activeDuty: _activeDuty,
    reserves: _reserves,
    civilianStaff: _civilianStaff,
    ...rest
  } = branch;
  return {
    ...rest,
    units: [],
    assets: [],
    strength: strengthBand(branch.activeDuty),
    reserveStrength: strengthBand(branch.reserves),
  } as Redacted<T, BranchExactField> & { strength: StrengthBand; reserveStrength: StrengthBand };
}
