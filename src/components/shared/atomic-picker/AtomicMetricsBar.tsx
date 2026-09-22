"use client";

/**
 * Atomic Metrics Bar
 *
 * Glass-pill indicators displaying live component metrics: total components,
 * average effectiveness, implementation and maintenance costs, synergies, and conflicts.
 * Supports interactive dialog triggers.
 */

import React from "react";
import {
  StatUp as TrendingUp,
  Dollar as DollarSign,
  Flash as Zap,
  WarningTriangle as AlertTriangle,
  Package,
  Archery as Target,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { AtomicMetrics } from "./types";

export interface AtomicMetricsBarProps {
  metrics: AtomicMetrics;
  currencyFormatter?: (amount: number) => string;
  onComponentsClick?: () => void;
  onEffectivenessClick?: () => void;
  onImplementationClick?: () => void;
  onMaintenanceClick?: () => void;
  onSynergiesClick?: () => void;
  onConflictsClick?: () => void;
}

function defaultCurrency(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount}`;
}

export const AtomicMetricsBar = React.memo(function AtomicMetricsBar({
  metrics,
  currencyFormatter = defaultCurrency,
  onComponentsClick,
  onEffectivenessClick,
  onImplementationClick,
  onMaintenanceClick,
  onSynergiesClick,
  onConflictsClick,
}: AtomicMetricsBarProps) {
  const metricItems = [
    {
      label: "Components",
      value: metrics.totalComponents,
      icon: Package,
      color: "text-blue-500 dark:text-blue-400 border-blue-500/20 bg-blue-500/5 hover:border-blue-400/40",
      iconColor: "text-blue-500 dark:text-blue-400",
      onClick: onComponentsClick,
    },
    {
      label: "Avg Effectiveness",
      value: `${metrics.totalEffectiveness}%`,
      icon: Target,
      color: "text-emerald-500 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40",
      iconColor: "text-emerald-500 dark:text-emerald-400",
      onClick: onEffectivenessClick,
    },
    {
      label: "Implementation",
      value: currencyFormatter(metrics.implementationCost),
      icon: DollarSign,
      color: "text-amber-500 dark:text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-400/40",
      iconColor: "text-amber-500 dark:text-amber-400",
      onClick: onImplementationClick,
    },
    {
      label: "Annual Maint.",
      value: `${currencyFormatter(metrics.maintenanceCost)}/yr`,
      icon: TrendingUp,
      color: "text-indigo-500 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-400/40",
      iconColor: "text-indigo-500 dark:text-indigo-400",
      onClick: onMaintenanceClick,
    },
    {
      label: "Synergies",
      value: metrics.synergyCount,
      icon: Zap,
      color: "text-cyan-500 dark:text-cyan-400 border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-400/40",
      iconColor: "text-cyan-500 dark:text-cyan-400",
      onClick: onSynergiesClick,
    },
    {
      label: "Conflicts",
      value: metrics.conflictCount,
      icon: AlertTriangle,
      color:
        metrics.conflictCount > 0
          ? "text-red-500 dark:text-red-400 border-red-500/30 bg-red-500/10 hover:border-red-400/50"
          : "text-muted-foreground border-border/40 bg-muted/20 hover:border-border",
      iconColor: metrics.conflictCount > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground",
      onClick: onConflictsClick,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {metricItems.map((item, index) => {
        const Icon = item.icon;
        const isClickable = Boolean(item.onClick);

        return (
          <div
            key={index}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={item.onClick}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                item.onClick?.();
              }
            }}
            title={isClickable ? `Click to view details for ${item.label}` : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-2.5 shadow-xs backdrop-blur-md transition-all duration-150 select-none",
              item.color,
              isClickable && "cursor-pointer active:scale-[0.98] hover:shadow-xs"
            )}
          >
            <div className="rounded-lg p-1.5 shrink-0 bg-current/10">
              <Icon className={cn("h-4 w-4", item.iconColor)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[10px] font-medium tracking-wide uppercase text-muted-foreground">
                {item.label}
              </div>
              <div className="truncate text-xs font-bold leading-tight tracking-tight text-foreground">
                {item.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
