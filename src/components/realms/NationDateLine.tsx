"use client";

import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { formatNationDateLine } from "~/lib/realms/nation-time";

/**
 * The nation's date in its realm's calendar, with the speed when it is not the usual ×2 ("Paused" when stopped), on
 * the clock of the nation in view (`useNationClock`). Re-read once a minute.
 */
export function NationDateLine({ className }: { className?: string }) {
  const reader = useNationClock();
  const now = useClockNow(reader);
  return (
    <p className={className}>
      <span className="sr-only">Date: </span>
      {formatNationDateLine(now, reader)}
    </p>
  );
}
