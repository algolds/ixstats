"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { IxTime } from "~/lib/ixtime";

function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Live countdown to the next scheduled fixture. The fixture is anchored to an
 * IxTime instant; the real-world wait is the IxTime gap divided by the clock
 * multiplier. Ticks once per second.
 */
export function NextMatchCountdown({
  targetIxTime,
  label = "Next matchday",
}: {
  targetIxTime: number;
  label?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = IxTime.getCurrentIxTime();
  const mult = IxTime.getDefaultMultiplier() || 2;
  const realRemainingMs = Math.max(0, (targetIxTime - now) / mult);
  const due = targetIxTime <= now;

  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {label}: {IxTime.formatIxTime(targetIxTime)}
        {due ? " · resolving…" : ` · in ${formatRemaining(realRemainingMs)}`}
      </span>
    </span>
  );
}
