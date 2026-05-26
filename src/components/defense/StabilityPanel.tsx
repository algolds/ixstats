// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/defense/StabilityPanel.tsx
"use client";

import React from "react";
import { useInternalStability } from "~/hooks/useInternalStability";
import { StabilityMetricsCard, SecurityEventsCard } from "~/components/defense/stability";

interface StabilityPanelProps {
  countryId: string;
}

export function StabilityPanel({ countryId }: StabilityPanelProps) {
  const {
    metrics,
    activeEvents,
    resolveEvent,
    getStabilityColor,
    getStabilityBg,
    getTrendIcon,
    getSeverityColor,
  } = useInternalStability({ countryId });

  return (
    <div className="space-y-4">
      <StabilityMetricsCard
        metrics={metrics}
        getStabilityColor={getStabilityColor}
        getStabilityBg={getStabilityBg}
        getTrendIcon={getTrendIcon}
      />
      <SecurityEventsCard
        activeEvents={activeEvents}
        resolveEvent={resolveEvent}
        getSeverityColor={getSeverityColor}
      />
    </div>
  );
}
