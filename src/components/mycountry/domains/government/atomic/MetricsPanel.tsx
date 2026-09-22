"use client";

/**
 * Metrics Panel (Government Domain)
 *
 * Backed by shared AtomicMetricsBar primitive.
 */

import React from "react";
import { AtomicMetricsBar, type AtomicMetrics } from "~/components/shared/atomic-picker";

export interface MetricsPanelProps {
  metrics: AtomicMetrics;
  onComponentsClick?: () => void;
  onEffectivenessClick?: () => void;
  onImplementationClick?: () => void;
  onMaintenanceClick?: () => void;
  onSynergiesClick?: () => void;
  onConflictsClick?: () => void;
}

export const MetricsPanel = React.memo<MetricsPanelProps>(function MetricsPanel(props) {
  return <AtomicMetricsBar {...props} />;
});
