import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { formatClockDate, formatRealmCountdown } from "~/lib/realms/nation-time";

/**
 * A future time on the nation's clock as its calendar date and the real time left: "21 Frostfall 812 (in 3d 4h)",
 * "(Paused)" while the realm's clock is stopped.
 */
export function formatWhen(targetMs: number, nowMs: number, reader: RealmClockReader | null): string {
  const countdown = formatRealmCountdown(targetMs, nowMs, reader);
  const left = countdown === "Paused" || countdown === "now" ? countdown : `in ${countdown}`;
  return `${formatClockDate(targetMs, reader)} (${left})`;
}
