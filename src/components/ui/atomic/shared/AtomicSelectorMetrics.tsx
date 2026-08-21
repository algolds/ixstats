/**
 * Atomic Selector Metrics Bar (Plan 166)
 *
 * Domain-agnostic metrics display and clickable trigger cards.
 * Accepts normalized metric items with labels, values, tones, and optional onClick handlers.
 */

"use client";

import React from "react";
import { cn } from "~/lib/utils";

export type MetricTone = "primary" | "success" | "danger" | "warning" | "neutral" | "cyan" | "amber";

export interface MetricItem {
  id: string;
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  tone?: MetricTone;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  clickable?: boolean;
}

export interface AtomicSelectorMetricsProps {
  metrics: MetricItem[];
  primaryToneClass?: string;
  className?: string;
}

const toneColorMap: Record<MetricTone, string> = {
  primary: "text-foreground",
  success: "text-green-600 dark:text-green-400",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "text-foreground",
  cyan: "text-cyan-600 dark:text-cyan-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export function AtomicSelectorMetrics({
  metrics,
  primaryToneClass,
  className,
}: AtomicSelectorMetricsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
        className
      )}
    >
      {metrics.map((m) => {
        const Icon = m.icon;
        const colorClass =
          m.tone === "primary" && primaryToneClass
            ? primaryToneClass
            : toneColorMap[m.tone || "neutral"];

        return (
          <div
            key={m.id}
            onClick={m.onClick}
            role={m.onClick ? "button" : undefined}
            tabIndex={m.onClick ? 0 : undefined}
            className={cn(
              "glass-card-subtle flex flex-col justify-between rounded-lg p-3 transition-colors",
              m.onClick && "cursor-pointer hover:bg-white/10 dark:hover:bg-white/5 active:scale-[0.99]"
            )}
          >
            <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
              <span>{m.label}</span>
              {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("text-lg font-bold tracking-tight", colorClass)}>
                {m.value}
              </span>
              {m.subValue && (
                <span className="text-xs text-muted-foreground">{m.subValue}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
