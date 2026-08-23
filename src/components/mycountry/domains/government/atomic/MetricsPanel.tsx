"use client";

/**
 * Metrics Panel
 *
 * Displays key metrics: total components, effectiveness, implementation/maintenance costs, synergies, and conflicts.
 * Refactored to render as a clean grid of glass-pill indicators directly inside the parent panel,
 * eliminating double card nested borders.
 *
 * @module MetricsPanel
 */

import React from "react";
import { StatUp as TrendingUp, Dollar as DollarSign, Flash as Zap, WarningTriangle as AlertTriangle, Package, Archery as Target } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface MetricsPanelProps {
  metrics: {
    totalComponents: number;
    totalEffectiveness: number;
    implementationCost: number;
    maintenanceCost: number;
    synergyCount: number;
    conflictCount: number;
  };
  onComponentsClick?: () => void;
  onEffectivenessClick?: () => void;
  onImplementationClick?: () => void;
  onMaintenanceClick?: () => void;
  onSynergiesClick?: () => void;
  onConflictsClick?: () => void;
}

/**
 * Display government metrics in glass pill layouts
 */
export const MetricsPanel = React.memo<MetricsPanelProps>(
  ({
    metrics,
    onComponentsClick,
    onEffectivenessClick,
    onImplementationClick,
    onMaintenanceClick,
    onSynergiesClick,
    onConflictsClick,
  }) => {
    const metricItems = [
      {
        label: "Components",
        value: metrics.totalComponents,
        icon: Package,
        color: "text-blue-400 border-blue-500/20 bg-blue-500/5",
        iconColor: "text-blue-400",
        onClick: onComponentsClick,
      },
      {
        label: "Effectiveness",
        value: `${metrics.totalEffectiveness.toFixed(1)}%`,
        icon: Target,
        color: "text-purple-400 border-purple-500/20 bg-purple-500/5",
        iconColor: "text-purple-400",
        onClick: onEffectivenessClick,
      },
      {
        label: "Implementation",
        value: `$${(metrics.implementationCost / 1000).toFixed(0)}k`,
        icon: DollarSign,
        color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
        iconColor: "text-emerald-400",
        onClick: onImplementationClick,
      },
      {
        label: "Maintenance",
        value: `$${(metrics.maintenanceCost / 1000).toFixed(0)}k/yr`,
        icon: TrendingUp,
        color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
        iconColor: "text-amber-400",
        onClick: onMaintenanceClick,
      },
      {
        label: "Synergies",
        value: metrics.synergyCount,
        icon: Zap,
        color: "text-green-400 border-green-500/20 bg-green-500/5",
        iconColor: "text-green-400",
        onClick: onSynergiesClick,
      },
      {
        label: "Conflicts",
        value: metrics.conflictCount,
        icon: AlertTriangle,
        color: cn(
          metrics.conflictCount > 0
            ? "text-red-400 border-red-500/30 bg-red-500/10 shadow-[0_0_8px_rgba(239,68,68,0.1)] animate-pulse"
            : "text-zinc-500 border-zinc-800 bg-zinc-900/10"
        ),
        iconColor: metrics.conflictCount > 0 ? "text-red-400" : "text-zinc-500",
        onClick: onConflictsClick,
      },
    ];

    return (
      <div className="grid w-full grid-cols-2 gap-2.5 select-none sm:grid-cols-3 lg:grid-cols-6">
        {metricItems.map((item) => {
          const Icon = item.icon || Package;
          const isClickable = !!item.onClick;
          const Component = isClickable ? "button" : "div";
          return (
            <Component
              key={item.label}
              onClick={item.onClick}
              type={isClickable ? "button" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left backdrop-blur-md transition-all duration-200",
                isClickable
                  ? "cursor-pointer hover:scale-[1.03] hover:border-current/30 hover:shadow-md"
                  : "hover:scale-[1.02]",
                item.color
              )}
            >
              <div className="shrink-0 rounded-lg bg-black/10 p-1.5">
                <Icon className={cn("h-4 w-4", item.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  {item.label}
                </p>
                <p className="text-foreground truncate text-sm font-bold tabular-nums">
                  {item.value}
                </p>
              </div>
            </Component>
          );
        })}
      </div>
    );
  }
);

MetricsPanel.displayName = "MetricsPanel";
