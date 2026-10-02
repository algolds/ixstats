"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "~/lib/utils/cn";

/** Indicator colour: the app tint by default, or a status role. */
export type ProgressTone =
  "tint" | "success" | "warning" | "caution" | "destructive" | "info" | "neutral";

const TONE: Record<ProgressTone, string> = {
  tint: "bg-tint",
  success: "bg-success",
  warning: "bg-warning",
  caution: "bg-caution",
  destructive: "bg-destructive",
  info: "bg-info",
  neutral: "bg-label-secondary",
};

/** Linear meter: `fill-2` track, tint (or status) indicator. */
function Progress({
  className,
  value,
  max = 100,
  tone = "tint",
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  tone?: ProgressTone;
  indicatorClassName?: string;
}) {
  const safeMax = max && max > 0 ? max : 100;
  // Clamped: Radix treats an out-of-range or non-finite value as indeterminate (and warns).
  const clamped =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(safeMax, value))
      : null;
  const pct = ((clamped ?? 0) / safeMax) * 100;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      max={safeMax}
      className={cn("bg-fill-2 relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "duration-fast ease-out-facet h-full w-full flex-1 rounded-full transition-transform motion-reduce:transition-none",
          TONE[tone],
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
