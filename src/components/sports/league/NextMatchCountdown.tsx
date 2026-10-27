"use client";

import { useEffect, useState } from "react";
import { Clock } from "iconoir-react";

/** A fixture's real date and time in the viewer's locale. */
export function formatMatchDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

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
 * Live countdown to the next scheduled fixture, a real-time instant (sports run on
 * real time). Ticks once per second.
 */
export function NextMatchCountdown({
  targetMs,
  label = "Next matchday",
}: {
  targetMs: number;
  label?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const remainingMs = Math.max(0, targetMs - now);
  const due = targetMs <= now;

  return (
    <span className="text-label-secondary text-footnote flex items-center gap-2">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {label}: {formatMatchDate(targetMs)}
        {due ? " · resolving…" : ` · in ${formatRemaining(remainingMs)}`}
      </span>
    </span>
  );
}
