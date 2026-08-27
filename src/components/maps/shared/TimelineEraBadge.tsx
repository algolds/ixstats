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
  battle: "bg-red-500/10 text-red-500 border-red-500/20",
  founding: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  treaty: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cultural: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  religious: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  natural: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  trade: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  exploration: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  disaster: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

export const TimelineEraBadge = memo(function TimelineEraBadge({
  eraLabel,
  ixTimeYear,
  category = "cultural",
  className = "",
}: TimelineEraBadgeProps) {
  const colorClass =
    CATEGORY_COLORS[category] || "bg-muted/40 text-muted-foreground border-border/40";

  if (!eraLabel && ixTimeYear === undefined) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-tight ${colorClass} ${className}`}
    >
      <Clock className="h-3 w-3 shrink-0 opacity-70" />
      {eraLabel && <span className="font-semibold">{eraLabel}</span>}
      {ixTimeYear !== undefined && (
        <span className="font-mono opacity-90">
          {ixTimeYear >= 0 ? `${ixTimeYear} AT` : `${Math.abs(ixTimeYear)} BT`}
        </span>
      )}
    </div>
  );
});
