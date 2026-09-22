"use client";

import React from "react";

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
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <div className="facet-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{metrics.totalExchanges}</div>
        <div className="text-sm text-muted-foreground">Total Programs</div>
      </div>
      <div className="facet-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{metrics.activeExchanges}</div>
        <div className="text-sm text-muted-foreground">Currently Active</div>
      </div>
      <div className="facet-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">{metrics.completedExchanges}</div>
        <div className="text-sm text-muted-foreground">Completed</div>
      </div>
      <div className="facet-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-cyan-500 dark:text-cyan-400">{metrics.totalParticipants}</div>
        <div className="text-sm text-muted-foreground">Total Participants</div>
      </div>
      <div className="facet-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{metrics.avgCulturalImpact}%</div>
        <div className="text-sm text-muted-foreground">Cultural Impact</div>
      </div>
    </div>
  );
});

ExchangeMetrics.displayName = "ExchangeMetrics";
