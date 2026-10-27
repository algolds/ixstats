/**
 * The exchange API takes its dates as `YYYY-MM-DD` of the shared clock timeline (the nation's realm clock; realm
 * calendar offsets are whole days, so a calendar day starts at a timeline midnight).
 */

/** A day's start (clock time) as the API's `YYYY-MM-DD`. */
export const toWireDate = (clockMs: number) => new Date(clockMs).toISOString().slice(0, 10);

/** The API's `YYYY-MM-DD` as the clock time the day starts at, or null when empty. */
export const fromWireDate = (date: string): number | null =>
  date ? Date.parse(`${date}T00:00:00Z`) : null;
