"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import type { RevenueSummary } from "~/types/government";

interface BudgetRevenueAnalysisProps {
  revenueSummary: RevenueSummary;
  formatNumber: (num: number) => string;
}

export function BudgetRevenueAnalysis({
  revenueSummary,
  formatNumber,
}: BudgetRevenueAnalysisProps) {
  const taxPercent =
    revenueSummary.totalRevenue > 0
      ? ((revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1)
      : "0";

  const nonTaxPercent =
    revenueSummary.totalRevenue > 0
      ? ((revenueSummary.totalNonTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1)
      : "0";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FacetCard
        depth={1}
        className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 border-b pb-2">
          <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
            Tax vs Non-Tax Revenue
          </h4>
        </div>
        <div className="space-y-3">
          <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-foreground text-xs font-semibold">Tax Revenue</p>
              <p className="text-muted-foreground text-[11px]">Direct & Indirect Taxes</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                {formatNumber(revenueSummary.totalTaxRevenue)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                {taxPercent}%
              </p>
            </div>
          </div>

          <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-foreground text-xs font-semibold">Non-Tax Revenue</p>
              <p className="text-muted-foreground text-[11px]">Fees, Fines & Other Sources</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-bold text-cyan-400 tabular-nums">
                {formatNumber(revenueSummary.totalNonTaxRevenue)}
              </p>
              <p className="text-muted-foreground font-mono text-xs tabular-nums">
                {nonTaxPercent}%
              </p>
            </div>
          </div>
        </div>
      </FacetCard>

      <FacetCard
        depth={1}
        className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 border-b pb-2">
          <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
            Top Revenue Sources
          </h4>
        </div>
        <div className="space-y-2.5 text-xs">
          {revenueSummary.topRevenueSources.map((source, index) => (
            <div
              key={source.id}
              className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-[10px] font-semibold text-emerald-400 tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <p className="text-foreground text-xs font-semibold">{source.name}</p>
                  <p className="text-muted-foreground text-[10px]">{source.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
                  {formatNumber(source.revenueAmount ?? 0)}
                </p>
                <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
                  {(source.revenuePercent ?? 0).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </FacetCard>
    </div>
  );
}
