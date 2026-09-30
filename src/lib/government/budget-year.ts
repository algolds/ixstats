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
