"use client";

import React from "react";
import { ClockRotateRight as FileClock } from "iconoir-react";
import { api } from "~/trpc/react";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { formatRealmCountdown } from "~/lib/realms/nation-time";

/**
 * Leaf countdown to the next directive slot. `cooldownUntil` is on the nation's realm clock (the server's clock for
 * directive slots); the wait reads in real time at the realm's speed, or "Paused". Ticks without re-rendering its
 * parent.
 */
export const NextDirectiveIn = React.memo(function NextDirectiveIn({
  cooldownUntil,
}: {
  cooldownUntil: number;
}) {
  const clock = useNationClock();
  const now = useClockNow(clock, 1000);
  const countdown = formatRealmCountdown(cooldownUntil, now ?? cooldownUntil, clock);
  return <>{countdown === "Paused" ? "Paused" : `Next directive in ${countdown}`}</>;
});

/** How many directives are left this week, or when the next one opens. */
export function DirectiveStatusLine({ countryId }: { countryId?: string }) {
  const status = api.intent.getStatus.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId }
  );
  if (!status.data) return null;
  const { canCommit, usedThisWeek, cap, cooldownUntil } = status.data;
  if (!canCommit) {
    return (
      <p className="text-label-secondary text-footnote flex items-center gap-1 tabular-nums">
        <FileClock aria-hidden="true" className="h-3.5 w-3.5" />
        <span>
          {cooldownUntil ? (
            <NextDirectiveIn cooldownUntil={cooldownUntil} />
          ) : (
            `All ${cap} directives used · slots reset next week`
          )}
        </span>
      </p>
    );
  }
  const left = Math.max(0, cap - usedThisWeek);
  return (
    <p className="text-label-secondary text-footnote tabular-nums">
      {left} of {cap} directives left this week
    </p>
  );
}
