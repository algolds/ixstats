/**
 * The defense budget: one `DefenseBudget` row per nation, written by its owner through
 * `security.upsertDefenseBudget`. Until a row exists the Defense tab shows an estimate (2% of GDP,
 * split by the typical category shares), labelled as an estimate.
 */

/** The five spending categories, with the share each gets in the estimate. */
export const DEFENSE_BUDGET_CATEGORIES = [
  { key: "personnelCosts", estimateShare: 0.4 },
  { key: "operationsMaintenance", estimateShare: 0.3 },
  { key: "procurement", estimateShare: 0.15 },
  { key: "rdteCosts", estimateShare: 0.1 },
  { key: "militaryConstruction", estimateShare: 0.05 },
] as const;

export type DefenseBudgetCategoryKey = (typeof DEFENSE_BUDGET_CATEGORIES)[number]["key"];

export type DefenseBudgetAmounts = { totalBudget: number } & Record<
  DefenseBudgetCategoryKey,
  number
>;

/** Share of GDP the estimate assumes. */
export const ESTIMATE_GDP_SHARE = 0.02;

/** The estimate shown before a nation saves a budget. */
export function estimateDefenseBudget(gdp: number): DefenseBudgetAmounts {
  const totalBudget = Math.max(0, gdp) * ESTIMATE_GDP_SHARE;
  const amounts = { totalBudget } as DefenseBudgetAmounts;
  for (const c of DEFENSE_BUDGET_CATEGORIES) amounts[c.key] = totalBudget * c.estimateShare;
  return amounts;
}

/** Sum of the category amounts. */
export function allocatedDefenseBudget(amounts: DefenseBudgetAmounts): number {
  return DEFENSE_BUDGET_CATEGORIES.reduce((sum, c) => sum + amounts[c.key], 0);
}

/** True when the categories add up to more than the total (a cent of float slack allowed). */
export function isOverAllocated(amounts: DefenseBudgetAmounts): boolean {
  return allocatedDefenseBudget(amounts) > amounts.totalBudget + 0.01;
}

/**
 * The categories' share of the total, in percent. Float drift in saved amounts (450000000.0000001)
 * never reads as over 100%: past 100 only when `isOverAllocated`.
 */
export function defenseAllocationPercent(amounts: DefenseBudgetAmounts): number {
  if (amounts.totalBudget <= 0) return 0;
  const percent = (allocatedDefenseBudget(amounts) / amounts.totalBudget) * 100;
  return isOverAllocated(amounts) ? percent : Math.min(percent, 100);
}

/** Share of GDP and per-capita figures stored with a saved budget. */
export function defenseBudgetRatios(
  totalBudget: number,
  gdp: number | null | undefined,
  population: number | null | undefined
): { gdpPercent: number; perCapita: number } {
  return {
    gdpPercent: gdp && gdp > 0 ? (totalBudget / gdp) * 100 : 0,
    perCapita: population && population > 0 ? totalBudget / population : 0,
  };
}

/** A whole-currency amount as the edit field shows it: "5,668,857,676". */
export function formatAmountInput(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "0";
}

/** The amount typed in an edit field; separators and other non-digits are ignored. */
export function parseAmountInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? 0 : Number(digits);
}
