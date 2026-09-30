"use client";

import React from "react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { TrendIndicator as TrendIndicatorUI } from "~/components/ui/trend-indicator";
import { InlineHelpIcon } from "~/components/ui/help-icon";

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend?: {
    direction: "up" | "down" | "stable";
    value?: number;
    label?: string;
  };
  status?: "success" | "warning" | "error" | "info" | "neutral";
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
  };
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  tooltip?: string;
}

/** Status is semantic, so it keeps a status-coloured edge; no background wash. */
const statusColors = {
  success: "border-emerald-500/40",
  warning: "border-amber-500/40",
  error: "border-destructive/40",
  info: "border-border",
  neutral: "border-border",
};

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = "neutral",
  badge,
  theme: _theme,
  className,
  onClick,
  loading = false,
  actions,
  footer,
  tooltip,
}: MetricCardProps) {
  // `theme` is kept for API compatibility; metric cards render as neutral Facet surfaces and
  // only the status edge carries colour.
  return (
    <FacetCard
      surface="solid"
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn("rounded-xl", statusColors[status], className)}
    >
      <FacetCardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon className="text-muted-foreground h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <h3 className="text-muted-foreground flex items-center text-xs leading-none font-medium">
              {title}
              {tooltip && <InlineHelpIcon content={tooltip} />}
            </h3>
            {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && <Badge variant={badge.variant || "default"}>{badge.label}</Badge>}
          {actions}
        </div>
      </FacetCardHeader>
      <FacetCardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2" role="status" aria-label={`Loading ${title}`}>
            <Skeleton className="h-8" />
            {trend && <Skeleton className="h-4 w-1/2" />}
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="text-foreground text-lg font-semibold tracking-tight tabular-nums">
                {value}
              </div>
              {trend && <TrendIndicatorUI trend={trend.direction} value={trend.value} />}
            </div>
            {footer && <div className="border-border mt-2 border-t pt-2">{footer}</div>}
          </>
        )}
      </FacetCardContent>
    </FacetCard>
  );
}

// Specialized metric card variants
export function EconomicMetricCard(props: Omit<MetricCardProps, "theme">) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: "from-emerald-500 to-emerald-600",
        secondary: "from-emerald-500/10 to-emerald-600/10",
        accent: "rgb(16, 185, 129)",
        bg: "rgba(16, 185, 129, 0.05)",
      }}
    />
  );
}

export function PopulationMetricCard(props: Omit<MetricCardProps, "theme">) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: "from-blue-500 to-blue-600",
        secondary: "from-blue-500/10 to-blue-600/10",
        accent: "rgb(59, 130, 246)",
        bg: "rgba(59, 130, 246, 0.05)",
      }}
    />
  );
}

export function GovernmentMetricCard(props: Omit<MetricCardProps, "theme">) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: "from-indigo-500 to-indigo-600",
        secondary: "from-indigo-500/10 to-indigo-600/10",
        accent: "rgb(99, 102, 241)",
        bg: "rgba(99, 102, 241, 0.05)",
      }}
    />
  );
}

export function DiplomaticMetricCard(props: Omit<MetricCardProps, "theme">) {
  return (
    <MetricCard
      {...props}
      theme={{
        primary: "from-cyan-500 to-cyan-600",
        secondary: "from-cyan-500/10 to-cyan-600/10",
        accent: "rgb(6, 182, 212)",
        bg: "rgba(6, 182, 212, 0.05)",
      }}
    />
  );
}
