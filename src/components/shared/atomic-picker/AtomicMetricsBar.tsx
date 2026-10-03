"use client";

/**
 * Atomic Metrics Bar
 *
 * A row of solid Facet tiles showing live component metrics: total components, average
 * effectiveness, implementation and maintenance costs, synergies, and conflicts. A tile with a
 * click handler becomes a pressable Facet (opens that metric's detail dialog).
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
import { cn, formatCurrency } from "~/lib/utils";
import type { AtomicMetrics } from "./types";
import { Card } from "~/components/ui/card";

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

interface MetricItem {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  /** Semantic tone: only conflicts carry colour, and only when there are any. */
  tone?: "destructive";
  onClick?: () => void;
}

export const AtomicMetricsBar = React.memo(function AtomicMetricsBar({
  metrics,
  currencyFormatter = formatCurrency,
  onComponentsClick,
  onEffectivenessClick,
  onImplementationClick,
  onMaintenanceClick,
  onSynergiesClick,
  onConflictsClick,
}: AtomicMetricsBarProps) {
  const metricItems: MetricItem[] = [
    {
      label: "Components",
      value: metrics.totalComponents,
      icon: Package,
      onClick: onComponentsClick,
    },
    {
      label: "Avg effectiveness",
      value: `${metrics.totalEffectiveness}%`,
      icon: Target,
      onClick: onEffectivenessClick,
    },
    {
      label: "Implementation",
      value: currencyFormatter(metrics.implementationCost),
      icon: DollarSign,
      onClick: onImplementationClick,
    },
    {
      label: "Annual Maint.",
      value: `${currencyFormatter(metrics.maintenanceCost)}/yr`,
      icon: TrendingUp,
      onClick: onMaintenanceClick,
    },
    {
      label: "Synergies",
      value: metrics.synergyCount,
      icon: Zap,
      onClick: onSynergiesClick,
    },
    {
      label: "Conflicts",
      value: metrics.conflictCount,
      icon: AlertTriangle,
      tone: metrics.conflictCount > 0 ? "destructive" : undefined,
      onClick: onConflictsClick,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {metricItems.map((item) => {
        const Icon = item.icon;
        const onClick = item.onClick;
        const isDestructive = item.tone === "destructive";

        return (
          <Card
            key={item.label}
            onClick={onClick}
            onKeyDown={
              onClick
                ? (e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClick();
                    }
                  }
                : undefined
            }
            aria-label={onClick ? `${item.label}: view details` : undefined}
            className={cn(
              "rounded-row flex items-center gap-2 p-3 select-none",
              onClick &&
                "hover:border-separator-opaque focus-visible:ring-tint focus-visible:ring-1 focus-visible:outline-none"
            )}
            interactive
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0",
                isDestructive ? "text-destructive" : "text-label-secondary"
              )}
            />
            <div className="min-w-0 flex-1">
              <span className="text-stat-label text-label-secondary block truncate">
                {item.label}
              </span>
              <div
                className={cn(
                  "text-headline truncate leading-tight tabular-nums",
                  isDestructive ? "text-destructive" : "text-label"
                )}
              >
                {item.value}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
});
