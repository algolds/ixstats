/**
 * Metrics Grid Display Component
 *
 * Displays country metrics in a filterable grid layout with trend indicators.
 */

import React from "react";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getTrendIcon, getTrendColor, hasAccess } from "~/lib/clearance-utils";
import type { CountryMetric, ClassificationLevel } from "~/types/intelligence-briefing";

interface MetricsGridDisplayProps {
  metrics: CountryMetric[];
  viewerClearanceLevel: ClassificationLevel;
  flagColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  filterCategories?: string[];
  title?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export const MetricsGridDisplay = React.memo<MetricsGridDisplayProps>(({
  metrics,
  viewerClearanceLevel,
  flagColors,
  filterCategories,
  title = "Key Metrics",
  icon: Icon,
}) => {
  const filteredMetrics = metrics.filter(metric => {
    // Filter by clearance level
    if (!hasAccess(viewerClearanceLevel, metric.classification)) {
      return false;
    }

    // Filter by category if specified
    if (filterCategories && filterCategories.length > 0) {
      return filterCategories.some(cat => metric.id.includes(cat));
    }

    return true;
  });

  if (filteredMetrics.length === 0) {
    return null;
  }

  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" style={{ color: flagColors.primary }} />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMetrics.map((metric) => {
            const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
            const TrendIcon = metric.trend ? getTrendIcon(metric.trend.direction) : null;

            return (
              <div
                key={metric.id}
                className="p-4 rounded-lg border bg-card/50 hover:bg-card/70 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MetricIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{metric.label}</span>
                </div>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-xl font-semibold">{metric.value}</span>
                  {metric.unit && (
                    <span className="text-sm text-muted-foreground">{metric.unit}</span>
                  )}
                </div>

                {metric.trend && (
                  <div className="flex items-center gap-1">
                    {TrendIcon && (
                      <TrendIcon className={cn("h-3 w-3", getTrendColor(metric.trend.direction))} />
                    )}
                    <span className={cn("text-xs", getTrendColor(metric.trend.direction))}>
                      {metric.trend.value.toFixed(2)}% {metric.trend.period}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

MetricsGridDisplay.displayName = "MetricsGridDisplay";
