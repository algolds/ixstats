const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Daily claims reset at 00:00 UTC, so the next one opens at the coming UTC midnight. */
export function msUntilNextDailyReward(now: Date): number {
  return DAY_MS - (now.getTime() % DAY_MS);
}

/** The wait as "6h" (rounded up), or "12m" in the last hour. */
export function formatDailyRewardWait(now: Date): string {
  const ms = msUntilNextDailyReward(now);
  return ms <= HOUR_MS
    ? `${Math.max(1, Math.ceil(ms / MINUTE_MS))}m`
    : `${Math.ceil(ms / HOUR_MS)}h`;
}
