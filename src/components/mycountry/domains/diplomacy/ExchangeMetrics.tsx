"use client";

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
    { label: "Cultural impact", value: `${metrics.avgCulturalImpact}%` },
  ];
  return (
    <Card className="rounded-card p-4">
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <dt>
              <span className="text-stat-label text-label-secondary">{item.label}</span>
            </dt>
            <dd className="text-label text-title-1 tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
});

ExchangeMetrics.displayName = "ExchangeMetrics";
