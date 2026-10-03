"use client";

import { cn } from "~/lib/utils";

/** Small count pill for the diplomacy nav / tab; renders nothing when there is nothing to answer. */
export function InboxCountPill({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "bg-primary-fill text-on-primary text-caption inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 leading-none font-semibold tabular-nums",
        className
      )}
      aria-label={`${count} diplomatic item${count === 1 ? "" : "s"} awaiting your answer`}
    >
      {count}
    </span>
  );
}
