"use client";

import { levelWord } from "~/lib/qualitative-rating";
import React from "react";
import { Card } from "~/components/ui/card";

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
    { label: "Cultural impact", value: levelWord(metrics.avgCulturalImpact) },
  ];
  return (
    <Card content="data" className="rounded-card p-4">
      <dl className="md:divide-separator/60 grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-0 md:divide-x">
        {items.map((item) => (
          <div key={item.label} className="space-y-1 md:px-4 first:md:pl-0 last:md:pr-0">
            <dt>
              <span className="text-caption text-label-secondary">{item.label}</span>
            </dt>
            <dd className="text-label text-title-3 tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
});

ExchangeMetrics.displayName = "ExchangeMetrics";
