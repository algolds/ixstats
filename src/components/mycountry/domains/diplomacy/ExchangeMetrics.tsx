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
      <div className="glass-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-[--intel-gold]">{metrics.totalExchanges}</div>
        <div className="text-sm text-[--intel-silver]">Total Programs</div>
      </div>
      <div className="glass-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-green-400">{metrics.activeExchanges}</div>
        <div className="text-sm text-[--intel-silver]">Currently Active</div>
      </div>
      <div className="glass-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-blue-400">{metrics.completedExchanges}</div>
        <div className="text-sm text-[--intel-silver]">Completed</div>
      </div>
      <div className="glass-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-purple-400">{metrics.totalParticipants}</div>
        <div className="text-sm text-[--intel-silver]">Total Participants</div>
      </div>
      <div className="glass-hierarchy-child rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-[--intel-amber]">{metrics.avgCulturalImpact}%</div>
        <div className="text-sm text-[--intel-silver]">Cultural Impact</div>
      </div>
    </div>
  );
});

ExchangeMetrics.displayName = "ExchangeMetrics";
