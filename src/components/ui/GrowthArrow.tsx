"use client";

import { cn } from "~/lib/utils/cn";
import { StatUp as TrendingUp, StatDown as TrendingDown } from "iconoir-react";

interface GrowthArrowProps {
  /** Signed percentage change, e.g. 2.4 or -1.1. */
  value: number | null | undefined;
  /** Icon size in px. */
  size?: number;
  className?: string;
  /** Hide the numeric label, show the arrow only. */
  iconOnly?: boolean;
  /** Inherit surrounding text color instead of emerald/red (for themed badges). */
  inheritColor?: boolean;
}

/**
 * Animated growth/change indicator (hover-animated arrow + signed %), shared
 * across MyCountry, the Halo, country profiles, the dashboard and lists.
 */
export function GrowthArrow({
  value,
  size = 12,
  className,
  iconOnly,
  inheritColor,
}: GrowthArrowProps) {
  if (value == null || !isFinite(value) || value === 0) return null;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold",
        !inheritColor && (up ? "text-emerald-500" : "text-red-500"),
        className
      )}
    >
      <Icon width={size} height={size} />
      {!iconOnly && (
        <span>
          {up ? "+" : ""}
          {value.toFixed(1)}%
        </span>
      )}
    </span>
  );
}
