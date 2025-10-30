"use client";

// Vitality Metrics Panel - Displays vitality rings and health metrics
// Refactored from EnhancedIntelligenceBriefing.tsx

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { HealthRing } from "~/components/ui/health-ring";
import { cn } from "~/lib/utils";
import { CLASSIFICATION_STYLES, STATUS_STYLES } from "./constants";
import { getTrendIcon, getTrendColor } from "./utils";
import type { VitalityMetric, ClearanceLevel } from "./types";

export interface VitalityMetricsPanelProps {
  metrics: VitalityMetric[];
  viewerClearanceLevel: ClearanceLevel;
  showClassified?: boolean;
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  className?: string;
}

export const VitalityMetricsPanel: React.FC<VitalityMetricsPanelProps> = ({
  metrics,
  viewerClearanceLevel,
  showClassified = false,
  flagColors = { primary: "#3b82f6", secondary: "#6366f1", accent: "#8b5cf6" },
  className,
}) => {
  // Filter metrics based on clearance level
  const filteredMetrics = React.useMemo(() => {
    if (showClassified) return metrics;

    const levels = { PUBLIC: 1, RESTRICTED: 2, CONFIDENTIAL: 3 };
    return metrics.filter(
      (metric) => levels[viewerClearanceLevel] >= levels[metric.classification]
    );
  }, [metrics, viewerClearanceLevel, showClassified]);

  return (
    <Card className={cn("glass-hierarchy-child", className)}>
      <CardHeader>
        <CardTitle>Vitality Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {filteredMetrics.map((metric) => {
            const TrendIcon = getTrendIcon(metric.trend);
            const trendColor = getTrendColor(metric.trend);
            const Icon = metric.icon as React.ComponentType<{
              className?: string;
              style?: React.CSSProperties;
            }>;

            return (
              <motion.div
                key={metric.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-4"
              >
                {/* Vitality Ring */}
                <div className="relative">
                  <HealthRing value={metric.value} size={120} color={metric.color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="h-8 w-8" style={{ color: metric.color }} />
                  </div>
                </div>

                {/* Metric Details */}
                <div className="w-full space-y-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-lg font-semibold">{metric.label}</h3>
                    <TrendIcon className={cn("h-4 w-4", trendColor)} />
                  </div>

                  <div className="text-3xl font-bold" style={{ color: metric.color }}>
                    {metric.value.toFixed(1)}%
                  </div>

                  {/* Status Badge */}
                  <Badge
                    className={cn(
                      "text-xs",
                      STATUS_STYLES[metric.status].bg,
                      STATUS_STYLES[metric.status].color
                    )}
                  >
                    {metric.status.toUpperCase()}
                  </Badge>

                  {/* Classification Badge */}
                  {metric.classification !== "PUBLIC" && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        CLASSIFICATION_STYLES[metric.classification].color,
                        CLASSIFICATION_STYLES[metric.classification].border
                      )}
                    >
                      {metric.classification}
                    </Badge>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
