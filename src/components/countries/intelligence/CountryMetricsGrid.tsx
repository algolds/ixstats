"use client";

// Country Metrics Grid - Grid display of country statistics
// Refactored from EnhancedIntelligenceBriefing.tsx

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { MetricCard } from "~/components/shared/data-display/MetricCard";
import { ClassificationBadge, TrendIndicator } from "./StatusIndicators";
import { IMPORTANCE_STYLES } from "./constants";
import type { CountryMetric, ClearanceLevel } from "./types";

export interface CountryMetricsGridProps {
  metrics: CountryMetric[];
  viewerClearanceLevel: ClearanceLevel;
  showClassified?: boolean;
  expandedMetrics?: Set<string>;
  onMetricToggle?: (metricId: string) => void;
  className?: string;
}

export const CountryMetricsGrid: React.FC<CountryMetricsGridProps> = ({
  metrics,
  viewerClearanceLevel,
  showClassified = false,
  expandedMetrics = new Set(),
  onMetricToggle,
  className,
}) => {
  // Filter and group metrics by category
  const filteredMetrics = React.useMemo(() => {
    if (showClassified) return metrics;

    const levels = { PUBLIC: 1, RESTRICTED: 2, CONFIDENTIAL: 3 };
    return metrics.filter(
      (metric) => levels[viewerClearanceLevel] >= levels[metric.classification]
    );
  }, [metrics, viewerClearanceLevel, showClassified]);

  // Group metrics by category (derived from ID prefix)
  const groupedMetrics = React.useMemo(() => {
    const groups: Record<string, CountryMetric[]> = {
      economy: [],
      demographics: [],
      labor: [],
      government: [],
      geography: [],
    };

    filteredMetrics.forEach((metric) => {
      if (metric.id.includes("gdp") || metric.id.includes("economic")) {
        groups.economy.push(metric);
      } else if (
        metric.id.includes("population") ||
        metric.id.includes("life") ||
        metric.id.includes("literacy")
      ) {
        groups.demographics.push(metric);
      } else if (metric.id.includes("labor") || metric.id.includes("unemployment")) {
        groups.labor.push(metric);
      } else if (metric.id.includes("government") || metric.id.includes("capital")) {
        groups.government.push(metric);
      } else if (
        metric.id.includes("density") ||
        metric.id.includes("land") ||
        metric.id.includes("continent") ||
        metric.id.includes("region")
      ) {
        groups.geography.push(metric);
      }
    });

    return groups;
  }, [filteredMetrics]);

  const renderMetricCard = (metric: CountryMetric) => {
    const Icon = metric.icon as React.ComponentType<{ className?: string }>;
    const isExpanded = expandedMetrics.has(metric.id);
    const importance = IMPORTANCE_STYLES[metric.importance];

    return (
      <motion.div
        key={metric.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={cn("group relative", importance.glow)}
      >
        <Card
          className={cn(
            "glass-hierarchy-interactive transition-all duration-200",
            isExpanded && "ring-primary/20 ring-2",
            onMetricToggle && "cursor-pointer hover:scale-[1.02]"
          )}
          onClick={() => onMetricToggle?.(metric.id)}
        >
          <CardContent className="space-y-3 p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-1 items-center gap-2">
                <Icon className="text-primary h-5 w-5" />
                <div className="flex-1">
                  <h4 className="text-sm leading-tight font-medium">{metric.label}</h4>
                </div>
              </div>
              {metric.classification !== "PUBLIC" && (
                <ClassificationBadge classification={metric.classification} className="text-xs" />
              )}
            </div>

            {/* Value */}
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {metric.value}
                {metric.unit && (
                  <span className="text-muted-foreground ml-1 text-sm">{metric.unit}</span>
                )}
              </div>

              {/* Trend Indicator */}
              {metric.trend && (
                <TrendIndicator
                  trend={metric.trend.direction}
                  value={metric.trend.value}
                  period={metric.trend.period}
                />
              )}
            </div>

            {/* Importance Badge */}
            {metric.importance === "critical" && (
              <Badge variant="destructive" className="text-xs">
                CRITICAL
              </Badge>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Economy Section */}
      {groupedMetrics.economy.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Economic Metrics</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedMetrics.economy.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* Demographics Section */}
      {groupedMetrics.demographics.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Demographic Metrics</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedMetrics.demographics.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* Labor Section */}
      {groupedMetrics.labor.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Labor & Employment</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedMetrics.labor.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* Government Section */}
      {groupedMetrics.government.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Government & Leadership</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedMetrics.government.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* Geography Section */}
      {groupedMetrics.geography.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Geographic Information</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedMetrics.geography.map(renderMetricCard)}
          </div>
        </div>
      )}
    </div>
  );
};
