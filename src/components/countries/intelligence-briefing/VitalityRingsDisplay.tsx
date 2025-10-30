/**
 * Vitality Rings Display Component
 *
 * Displays health ring visualizations for vitality metrics.
 */

import React from "react";
import { HealthRing } from "~/components/ui/health-ring";
import type { VitalityMetric, ClassificationLevel } from "~/types/intelligence-briefing";
import { hasAccess } from "~/lib/clearance-utils";

interface VitalityRingsDisplayProps {
  metrics: VitalityMetric[];
  viewerClearanceLevel: ClassificationLevel;
}

export const VitalityRingsDisplay = React.memo<VitalityRingsDisplayProps>(
  ({ metrics, viewerClearanceLevel }) => {
    const accessibleMetrics = metrics.filter((metric) =>
      hasAccess(viewerClearanceLevel, metric.classification)
    );

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {accessibleMetrics.map((metric) => {
          const MetricIcon = metric.icon;
          return (
            <div key={metric.id} className="flex flex-col items-center">
              <HealthRing value={metric.value} size={120} color={metric.color} />
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <MetricIcon className="h-4 w-4" style={{ color: metric.color }} />
                  <span className="font-medium">{metric.label}</span>
                </div>
                <div className="mt-1 text-2xl font-bold">{metric.value.toFixed(1)}%</div>
                <div className="text-muted-foreground text-sm capitalize">{metric.status}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

VitalityRingsDisplay.displayName = "VitalityRingsDisplay";
