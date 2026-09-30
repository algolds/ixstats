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

  const split = [
    {
      label: "Tax Revenue",
      sub: "Direct & Indirect Taxes",
      value: revenueSummary.totalTaxRevenue,
      percent: taxPercent,
    },
    {
      label: "Non-Tax Revenue",
      sub: "Fees, Fines & Other Sources",
      value: revenueSummary.totalNonTaxRevenue,
      percent: nonTaxPercent,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FacetCard depth={1} surface="solid" className="space-y-3 p-4">
        <h4 className="text-foreground border-border/60 border-b pb-3 text-sm font-semibold">
          Tax vs non-tax revenue
        </h4>
        <div className="divide-border/60 divide-y">
          {split.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-foreground text-sm font-medium">{row.label}</p>
                <p className="text-muted-foreground text-xs">{row.sub}</p>
              </div>
              <div className="text-right">
                <p className="text-foreground font-mono text-base font-semibold tabular-nums">
                  {formatNumber(row.value)}
                </p>
                <p className="text-muted-foreground font-mono text-xs tabular-nums">
                  {row.percent}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </FacetCard>

      <FacetCard depth={1} surface="solid" className="space-y-3 p-4">
        <h4 className="text-foreground border-border/60 border-b pb-3 text-sm font-semibold">
          Top revenue sources
        </h4>
        <ol className="divide-border/60 divide-y text-xs">
          {revenueSummary.topRevenueSources.map((source, index) => (
            <li key={source.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-muted-foreground w-4 shrink-0 text-right font-mono tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-semibold">{source.name}</p>
                  <p className="text-muted-foreground truncate text-xs">{source.category}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
                  {formatNumber(source.revenueAmount ?? 0)}
                </p>
                <p className="text-muted-foreground font-mono text-xs tabular-nums">
                  {(source.revenuePercent ?? 0).toFixed(1)}%
                </p>
              </div>
            </li>
          ))}
        </ol>
      </FacetCard>
    </div>
  );
}
