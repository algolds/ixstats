"use client";

import React, { memo } from "react";
import { Clock } from "iconoir-react";

interface TimelineEraBadgeProps {
  eraLabel?: string;
  ixTimeYear?: number;
  category?: string;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  battle: "bg-red/10 text-red-ink border-red/20",
  founding: "bg-yellow/10 text-yellow-ink border-yellow/20",
  treaty: "bg-blue/10 text-blue-ink border-blue/20",
  cultural: "bg-indigo/10 text-indigo-ink border-indigo/20",
  religious: "bg-green/10 text-green-ink border-green/20",
  natural: "bg-green/10 text-green-ink border-green/20",
  trade: "bg-orange/10 text-orange-ink border-orange/20",
  exploration: "bg-cyan/10 text-cyan-ink border-cyan/20",
  disaster: "bg-red/10 text-red-ink border-red/20",
};

export const TimelineEraBadge = memo(function TimelineEraBadge({
  eraLabel,
  ixTimeYear,
  category = "cultural",
  className = "",
}: TimelineEraBadgeProps) {
  const colorClass = CATEGORY_COLORS[category] || "bg-fill-3 text-label-secondary border-separator";

  if (!eraLabel && ixTimeYear === undefined) return null;

  return (
    <div
      className={`text-caption inline-flex items-center gap-2 rounded-full border px-2 py-0.5 ${colorClass} ${className}`}
    >
      <Clock className="h-3 w-3 shrink-0 opacity-70" />
      {eraLabel && <span className="font-semibold">{eraLabel}</span>}
      {ixTimeYear !== undefined && (
        <span className="tabular-nums opacity-90">
          {ixTimeYear >= 0 ? `${ixTimeYear} AT` : `${Math.abs(ixTimeYear)} BT`}
        </span>
      )}
    </div>
  );
});
