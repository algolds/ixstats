"use client";

import React, { useEffect, useState } from "react";
import { ClockRotateRight as FileClock } from "iconoir-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";

/** `cooldownUntil` and `now` are IxTime ms (the server's clock for directive slots), not wall time. */
export function formatCooldownTime(
  cooldownUntil: number | null | undefined,
  now = IxTime.getCurrentIxTime()
): string {
  if (!cooldownUntil) return "Resets next weekly cycle";
  const diffMs = Math.max(0, cooldownUntil - now);
  if (diffMs <= 0) return "Cooldown expiring soon";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

/** Leaf countdown: ticks every second without re-rendering its parent. */
export const CooldownTimer = React.memo(function CooldownTimer({
  cooldownUntil,
}: {
  cooldownUntil: number | null | undefined;
}) {
  const [now, setNow] = useState(() => IxTime.getCurrentIxTime());
  useEffect(() => {
    const id = setInterval(() => setNow(IxTime.getCurrentIxTime()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatCooldownTime(cooldownUntil, now)}</>;
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
            <>
              Next directive in <CooldownTimer cooldownUntil={cooldownUntil} />
            </>
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
