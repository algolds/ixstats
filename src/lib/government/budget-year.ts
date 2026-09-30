/**
 * The one basis for `BudgetAllocation.budgetYear`: the IxTime game year.
 *
 * Every writer (builder, government CRUD, seeds) and every reader (brokers, recon, policies,
 * intent, politics drift, the Economy budget dashboard) must use this helper, never
 * `new Date().getFullYear()` (real calendar) or a literal year. Client-safe.
 */
import { IxTime } from "~/lib/ixtime";

/** The budget year for `ixTime` (defaults to now), as the IxTime game year. */
export function currentBudgetYear(ixTime?: number): number {
  return IxTime.getCurrentGameYear(ixTime);
}

/**
 * The budget in effect: the latest budget year at or before `current`. A budget stays in effect
 * after the IxTime year rolls over until the country sets one for the new year. Null when
 * there is no budget yet.
 */
export function latestBudgetYearUpTo(
  years: Iterable<number>,
  current: number = currentBudgetYear()
): number | null {
  let latest: number | null = null;
  for (const year of years) {
    if (year <= current && (latest === null || year > latest)) latest = year;
  }
  return latest;
}
