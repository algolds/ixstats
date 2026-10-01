"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";

interface ExchangeMetricsProps {
  metrics: {
    totalExchanges: number;
    activeExchanges: number;
    completedExchanges: number;
    totalParticipants: number;
    avgCulturalImpact: number;
  };
}

export const ExchangeMetrics = React.memo<ExchangeMetricsProps>(({ metrics }) => {
  const items = [
    { label: "Total programs", value: String(metrics.totalExchanges) },
    { label: "Currently active", value: String(metrics.activeExchanges) },
    { label: "Completed", value: String(metrics.completedExchanges) },
    { label: "Participants", value: String(metrics.totalParticipants) },
    { label: "Cultural impact", value: `${metrics.avgCulturalImpact}%` },
  ];
  return (
    <FacetCard className="rounded-card p-4">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <dt>
              <Eyebrow>{item.label}</Eyebrow>
            </dt>
            <dd className="text-label text-title-1 tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </FacetCard>
  );
});

ExchangeMetrics.displayName = "ExchangeMetrics";
