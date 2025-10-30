"use client";

// Status Indicators - Classification badges, status displays, and trend indicators
// Refactored from EnhancedIntelligenceBriefing.tsx

import React from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { CLASSIFICATION_STYLES, STATUS_STYLES } from "./constants";
import { getTrendIcon, getTrendColor } from "./utils";
import type { ClearanceLevel, StatusLevel, TrendDirection } from "./types";

export interface ClassificationBadgeProps {
  classification: ClearanceLevel;
  className?: string;
}

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({
  classification,
  className,
}) => {
  const style = CLASSIFICATION_STYLES[classification];

  return (
    <Badge variant="outline" className={cn("border-2", style.color, style.border, className)}>
      {style.label}
    </Badge>
  );
};

export interface StatusBadgeProps {
  status: StatusLevel;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const style = STATUS_STYLES[status];

  return (
    <Badge className={cn("text-xs", style.bg, style.color, className)}>
      {label || status.toUpperCase()}
    </Badge>
  );
};

export interface TrendIndicatorProps {
  trend: TrendDirection;
  value?: number;
  period?: string;
  className?: string;
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  trend,
  value,
  period,
  className,
}) => {
  const TrendIcon = getTrendIcon(trend);
  const trendColor = getTrendColor(trend);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TrendIcon className={cn("h-4 w-4", trendColor)} />
      {value !== undefined && (
        <span className={cn("text-sm font-medium", trendColor)}>{value.toFixed(2)}%</span>
      )}
      {period && <span className="text-muted-foreground text-xs">{period}</span>}
    </div>
  );
};

export interface StabilityIndicatorProps {
  stable?: boolean;
  label?: string;
  icon?: React.ElementType;
  className?: string;
}

export const StabilityIndicator: React.FC<StabilityIndicatorProps> = ({
  stable = true,
  label = "STABLE",
  icon: Icon,
  className,
}) => {
  const IconComponent = Icon as React.ComponentType<{ className?: string }> | undefined;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-green-500/30 bg-green-500/10 text-green-400",
        !stable && "border-red-500/30 bg-red-500/10 text-red-400",
        className
      )}
    >
      {IconComponent && <IconComponent className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
};
