"use client";

/**
 * Metrics Panel
 *
 * Displays key economic metrics: total components, effectiveness, implementation/maintenance costs, synergies, and conflicts.
 * Interactive layout matching the government builder.
 *
 * @module MetricsPanel
 */

import React from "react";
import { TrendingUp, DollarSign, Zap, AlertTriangle, Package, Target } from "lucide-react";
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
 * Display economic metrics in glass pill layouts
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
        color: "text-blue-400 border-blue-500/20 bg-blue-500/5 hover:border-blue-400/30",
        iconColor: "text-blue-400",
        onClick: onComponentsClick,
      },
      {
        label: "Effectiveness",
        value: `${metrics.totalEffectiveness.toFixed(1)}%`,
        icon: Target,
        color: "text-purple-400 border-purple-500/20 bg-purple-500/5 hover:border-purple-400/30",
        iconColor: "text-purple-400",
        onClick: onEffectivenessClick,
      },
      {
        label: "Implementation",
        value: `$${(metrics.implementationCost / 1000).toFixed(0)}k`,
        icon: DollarSign,
        color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/30",
        iconColor: "text-emerald-400",
        onClick: onImplementationClick,
      },
      {
        label: "Maintenance",
        value: `$${(metrics.maintenanceCost / 1000).toFixed(0)}k/yr`,
        icon: TrendingUp,
        color: "text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-400/30",
        iconColor: "text-amber-400",
        onClick: onMaintenanceClick,
      },
      {
        label: "Synergies",
        value: metrics.synergyCount,
        icon: Zap,
        color: "text-green-400 border-green-500/20 bg-green-500/5 hover:border-green-400/30",
        iconColor: "text-green-400",
        onClick: onSynergiesClick,
      },
      {
        label: "Conflicts",
        value: metrics.conflictCount,
        icon: AlertTriangle,
        color: cn(
          metrics.conflictCount > 0
            ? "text-red-400 border-red-500/30 bg-red-500/10 shadow-[0_0_8px_rgba(239,68,68,0.1)] animate-pulse hover:border-red-400/30"
            : "text-zinc-500 border-zinc-800 bg-zinc-900/10 hover:border-zinc-700/30"
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
                  ? "cursor-pointer hover:scale-[1.03] hover:shadow-md"
                  : "hover:scale-[1.02]",
                item.color
              )}
            >
              <div className="shrink-0 rounded-lg bg-black/10 p-1.5">
                <Icon className={cn("h-4 w-4", item.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                  {item.label}
                </p>
                <p className="text-foreground truncate text-sm font-black">{item.value}</p>
              </div>
            </Component>
          );
        })}
      </div>
    );
  }
);

MetricsPanel.displayName = "MetricsPanel";
