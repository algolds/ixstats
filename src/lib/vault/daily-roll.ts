/**
 * The daily reward's streak and boost rules, shared by the server roll (`vault-daily-bonus.ts`)
 * and the daily reward dialog so the boost it shows is the one the roll applies. Client-safe.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The streak at which the streak boost stops growing (1 + 30 × 0.05 = ×2.5). */
export const STREAK_BOOST_FULL_DAYS = 30;

function utcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY
  );
}

/**
 * Streak after a claim at `now`: +1 on the next UTC calendar day, reset to 1 after
 * a missed day, unchanged on the same day. No previous login starts at 1.
 */
export function computeNextStreak(
  lastLoginDate: Date | null,
  currentStreak: number,
  now: Date
): number {
  if (!lastLoginDate) return 1;
  const daysDiff = utcDayNumber(now) - utcDayNumber(new Date(lastLoginDate));
  if (daysDiff === 1) return currentStreak + 1;
  if (daysDiff > 1) return 1;
  return currentStreak;
}

/** +5% per streak day, up to ×2.5 at 30 days. */
export function streakMultiplier(streak: number): number {
  return 1 + Math.min(streak * 0.05, 1.5);
}

/** +2% per vault level, up to ×2. */
export function levelMultiplier(vaultLevel: number): number {
  return 1 + Math.min(vaultLevel * 0.02, 1.0);
}
