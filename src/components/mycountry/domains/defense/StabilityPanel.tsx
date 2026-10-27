"use client";

import React from "react";
import { useInternalStability } from "~/hooks/useInternalStability";
import { StabilityMetricsCard } from "~/components/mycountry/domains/defense/stability";

interface StabilityPanelProps {
  countryId: string;
}

export function StabilityPanel({ countryId }: StabilityPanelProps) {
  const { metrics } = useInternalStability({ countryId });

  return (
    <div className="space-y-4">
      <StabilityMetricsCard metrics={metrics} />
    </div>
  );
}
