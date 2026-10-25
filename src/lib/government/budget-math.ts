/**
 * Budget arithmetic shared by every budget writer (owner edits, directives, the budget-year roll,
 * stat progression and policy maintenance). Pure, so the rules are tested once.
 *
 * - `totalBudget` is a yearly flow. It follows GDP: when the projected GDP moves, the budget and
 *   the allocations of the budget in effect move by the same ratio.
 * - An allocation's amount is always `totalBudget × allocatedPercent / 100`.
 * - Policy maintenance is spending within a budget year. It never debits `totalBudget`, and what
 *   a year spends on maintenance never exceeds that year's budget.
 */

/** Largest share one department may hold, in percent. */
export const ALLOCATION_PERCENT_MAX = 100;

/** Spending share of GDP for a new government structure when the nation records no spending. */
export const DEFAULT_BUDGET_SHARE_OF_GDP = 0.2;

const finitePositive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const clampPercent = (percent: number, max: number = ALLOCATION_PERCENT_MAX) =>
  Math.max(0, Math.min(max, percent));

/** The amount a share of the budget is worth. */
export function allocationAmount(totalBudget: number, allocatedPercent: number): number {
  return finitePositive(totalBudget) ? (totalBudget * allocatedPercent) / 100 : 0;
}

export interface AllocationFigures {
  allocatedPercent: number;
  allocatedAmount: number;
}

/** An allocation set to `percent` (clamped to 0 to `max`), with its amount. */
export function allocationAt(
  totalBudget: number,
  percent: number,
  max: number = ALLOCATION_PERCENT_MAX
): AllocationFigures {
  const allocatedPercent = clampPercent(percent, max);
  return { allocatedPercent, allocatedAmount: allocationAmount(totalBudget, allocatedPercent) };
}

/**
 * The ratio a yearly budget moves by when GDP goes from `previousGdp` to `nextGdp`. 1 when either
 * figure is missing or not positive, so a bad projection never zeroes a budget.
 */
export function gdpScaleRatio(
  previousGdp: number | null | undefined,
  nextGdp: number | null | undefined
): number {
  return finitePositive(previousGdp) && finitePositive(nextGdp) ? nextGdp / previousGdp : 1;
}

/** The yearly budget a new government structure starts with: recorded spending, else a share of GDP. */
export function initialTotalBudget(country: {
  totalGovernmentSpending: number | null;
  currentTotalGdp: number | null;
}): number {
  if (finitePositive(country.totalGovernmentSpending)) return country.totalGovernmentSpending;
  return finitePositive(country.currentTotalGdp)
    ? country.currentTotalGdp * DEFAULT_BUDGET_SHARE_OF_GDP
    : 0;
}

/**
 * What each due policy is charged for a budget year's maintenance, in order: its cost, until the
 * year's budget is spent; past that, nothing. `alreadySpent` is what the year spent before.
 */
export function chargeMaintenance(
  totalBudget: number,
  alreadySpent: number,
  costs: readonly number[]
): number[] {
  let remaining = Math.max(0, (finitePositive(totalBudget) ? totalBudget : 0) - alreadySpent);
  return costs.map((cost) => {
    const charge = Math.min(Math.max(0, cost), remaining);
    remaining -= charge;
    return charge;
  });
}

/** The PolicyEffectLog `actualEffect` of a maintenance charge. */
export function maintenanceEffect(charge: number): string {
  return JSON.stringify({ maintenanceSpent: charge });
}

/** The charge a maintenance `actualEffect` records; 0 for anything else. */
export function maintenanceCharge(actualEffect: string | null): number {
  if (!actualEffect) return 0;
  try {
    const parsed = JSON.parse(actualEffect) as { maintenanceSpent?: number };
    const charge = parsed?.maintenanceSpent;
    return typeof charge === "number" && Number.isFinite(charge) ? charge : 0;
  } catch {
    return 0;
  }
}

/** The budget year a maintenance marker (`FY<year>`) is for, or null. */
export function maintenanceYear(notes: string | null): number | null {
  const match = /^FY(\d{4})$/.exec(notes ?? "");
  return match ? Number(match[1]) : null;
}

/** Maintenance spent per budget year, from a country's maintenance log rows. */
export function maintenanceByYear(
  rows: readonly { notes: string | null; actualEffect: string | null }[]
): Record<number, number> {
  const byYear: Record<number, number> = {};
  for (const row of rows) {
    const year = maintenanceYear(row.notes);
    if (year === null) continue;
    byYear[year] = (byYear[year] ?? 0) + maintenanceCharge(row.actualEffect);
  }
  return byYear;
}
