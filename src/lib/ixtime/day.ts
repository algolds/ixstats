/** One IxTime day in IxTime milliseconds. */
const IX_DAY_MS = 86_400_000;

/**
 * An IxTime (epoch ms) rounded down to the start of its IxTime day. Cached reads keyed by an IxTime use it, so
 * every request within a day shares one entry instead of each scrub position filling its own.
 */
export function roundToIxDay(ixTime: number): number {
  return Math.floor(ixTime / IX_DAY_MS) * IX_DAY_MS;
}

/** The start of the IxTime day after the one `ixTime` falls in: when an effect or a new baseline takes hold. */
export function nextIxDayStart(ixTime: number): number {
  return roundToIxDay(ixTime) + IX_DAY_MS;
}
