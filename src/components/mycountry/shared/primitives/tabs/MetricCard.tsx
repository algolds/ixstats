"use client";

import React from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { TrendIndicator as TrendIndicatorUI } from "~/components/ui/trend-indicator";
import { InlineHelpIcon } from "~/components/ui/help-icon";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  tooltip?: string;
}

/** Status is semantic, so it keeps a status-coloured edge; no background wash. */
const statusColors = {
  success: "border-green/40",
  warning: "border-yellow/40",
  error: "border-destructive/40",
  info: "border-separator",
  neutral: "border-separator",
};

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = "neutral",
  badge,
  className,
  onClick,
  loading = false,
  actions,
  footer,
  tooltip,
}: MetricCardProps) {
  // Neutral surface; only the status edge carries colour.
  return (
    <Card
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
      className={cn("rounded-row", statusColors[status], className)}
      interactive
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon className="text-label-secondary h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <h3 className="text-label-secondary text-caption flex items-center leading-none">
              {title}
              {tooltip && <InlineHelpIcon content={tooltip} />}
            </h3>
            {description && (
              <p className="text-label-secondary text-footnote mt-1">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && <Badge variant={badge.variant || "secondary"}>{badge.label}</Badge>}
          {actions}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2" role="status" aria-label={`Loading ${title}`}>
            <Skeleton className="h-8" />
            {trend && <Skeleton className="h-4 w-1/2" />}
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="text-label text-title-3 tabular-nums">{value}</div>
              {trend && <TrendIndicatorUI trend={trend.direction} value={trend.value} />}
            </div>
            {footer && <div className="border-separator mt-2 border-t pt-2">{footer}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
