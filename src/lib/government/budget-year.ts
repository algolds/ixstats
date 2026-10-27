/**
 * The one basis for `BudgetAllocation.budgetYear`: the game year of the nation's realm clock on the shared timeline
 * (realm time design §2). Ixnay's nations read IxTime, so their years are unchanged; every realm's clock starts on
 * the same timeline, so stored budget years stay valid when a realm runs faster, pauses or jumps.
 *
 * Every writer (builder, government CRUD, seeds) and every reader (brokers, recon, policies, intent, politics drift,
 * the Economy budget dashboard) must use this helper, never `new Date().getFullYear()` (real calendar) or a literal
 * year. Server code passes the nation's clock time (`(await clockForCountry(db, country)).now()`); the no-argument
 * form reads Ixnay's clock and is left only for client displays not yet on `useCountryClock`. Client-safe.
 */
import { IxTime } from "~/lib/ixtime";

/** The budget year at `ixTime` (a nation's clock time; Ixnay's now when omitted), as the game year. */
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
