"use client";

import React from "react";
import { useInternalStability } from "~/hooks/useInternalStability";
import {
  StabilityMetricsCard,
  SecurityEventsCard,
} from "~/components/mycountry/domains/defense/stability";

export interface StabilityPanelProps {
  countryId: string;
}

export function StabilityPanel({ countryId }: StabilityPanelProps) {
  const { metrics, activeEvents, resolveEvent } = useInternalStability({ countryId });

  return (
    <div className="space-y-4">
      <StabilityMetricsCard metrics={metrics} />
      <SecurityEventsCard activeEvents={activeEvents} resolveEvent={resolveEvent} />
    </div>
  );
}
