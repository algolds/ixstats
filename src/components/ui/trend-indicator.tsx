import React from "react";
import { ArrowDown, ArrowUp, Minus } from "iconoir-react";

interface TrendIndicatorProps {
  trend: "up" | "down" | "stable";
  value?: number;
}

export function TrendIndicator({ trend, value }: TrendIndicatorProps) {
  const icons = {
    up: ArrowUp,
    down: ArrowDown,
    stable: Minus,
  };
  const colors = {
    up: "text-[var(--color-success)]",
    down: "text-[var(--color-error)]",
    stable: "text-[var(--color-text-muted)]",
  };
  const Icon = icons[trend];
  return (
    <div className={`flex items-center gap-1 ${colors[trend]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {typeof value === "number" && (
        <span className="text-caption font-medium tabular-nums">
          {trend === "up" ? "+" : trend === "down" ? "-" : ""}
          {Math.abs(value)}%
        </span>
      )}
    </div>
  );
}
