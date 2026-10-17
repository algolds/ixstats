const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** What is left of a listing, in its two largest units: "2d 4h", "3h 12m", "8m", "under 1m", "Ended". */
export function formatTimeLeft(endTime: Date, now: Date = new Date()): string {
  const left = endTime.getTime() - now.getTime();
  if (left < 0) return "Ended";
  if (left >= DAY) return `${Math.floor(left / DAY)}d ${Math.floor((left % DAY) / HOUR)}h`;
  if (left >= HOUR) return `${Math.floor(left / HOUR)}h ${Math.floor((left % HOUR) / MINUTE)}m`;
  if (left >= MINUTE) return `${Math.floor(left / MINUTE)}m`;
  return "under 1m";
}

/** The same in running text: "3h 12m left", and just "Ended" once it is over. */
export function timeLeftPhrase(endTime: Date, now: Date = new Date()): string {
  const left = formatTimeLeft(endTime, now);
  return left === "Ended" ? left : `${left} left`;
}
