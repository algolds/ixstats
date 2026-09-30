/**
 * Pure planning for scripts/migrations/remap-budget-years.ts (MC-1).
 *
 * Before MC-1, `BudgetAllocation.budgetYear` held real-calendar years (the builder's literal 2026,
 * `new Date().getFullYear()` writers, and the old zod bound `max(2035)`), while the Economy
 * dashboard used the IxTime year. The basis is now the IxTime game year (`currentBudgetYear()`).
 *
 * A row is legacy (real-calendar) when its year is at most LEGACY_MAX_BUDGET_YEAR: the old input
 * schema rejected anything later, and IxTime has been past 2035 since before budget allocations
 * existed. Legacy rows are shifted by one constant offset, `ixYear - realYear` taken when the
 * script runs, so the rows readers matched before the change ("this real year") are the rows they
 * match after it ("this IxTime year"), and relative order within a department is kept.
 */

/** The old `BudgetAllocationInputSchema.budgetYear` maximum. */
export const LEGACY_MAX_BUDGET_YEAR = 2035;

export interface BudgetYearRow {
  id: string;
  departmentId: string;
  budgetYear: number;
}

export interface BudgetYearRemapPlan {
  offset: number;
  updates: Array<{ id: string; departmentId: string; from: number; to: number }>;
  /** Legacy rows whose target year the department already holds on the IxTime basis; left as-is. */
  conflicts: Array<{
    id: string;
    departmentId: string;
    from: number;
    to: number;
    existingId: string;
  }>;
  /** Rows already on the IxTime basis. */
  unchanged: number;
}

export function planBudgetYearRemap(
  rows: readonly BudgetYearRow[],
  realYear: number,
  ixYear: number
): BudgetYearRemapPlan {
  const offset = ixYear - realYear;
  const plan: BudgetYearRemapPlan = { offset, updates: [], conflicts: [], unchanged: 0 };
  if (offset <= 0) throw new Error(`IxTime year ${ixYear} is not after real year ${realYear}`);

  const held = new Map<string, string>();
  for (const row of rows) {
    if (row.budgetYear > LEGACY_MAX_BUDGET_YEAR)
      held.set(`${row.departmentId}:${row.budgetYear}`, row.id);
  }

  for (const row of rows) {
    if (row.budgetYear > LEGACY_MAX_BUDGET_YEAR) {
      plan.unchanged++;
      continue;
    }
    const to = row.budgetYear + offset;
    const existingId = held.get(`${row.departmentId}:${to}`);
    const move = { id: row.id, departmentId: row.departmentId, from: row.budgetYear, to };
    if (existingId) plan.conflicts.push({ ...move, existingId });
    else plan.updates.push(move);
  }
  return plan;
}

/** `from → to: count` lines, oldest year first. */
export function summarizeRemap(plan: BudgetYearRemapPlan): string[] {
  const counts = new Map<string, number>();
  for (const u of plan.updates) {
    const key = `${u.from} → ${u.to}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}: ${n}`);
}
