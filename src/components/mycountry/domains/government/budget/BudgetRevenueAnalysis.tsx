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
      <FacetCard className="space-y-3 p-4">
        <h4 className="text-label border-separator text-headline border-b pb-3">
          Tax vs non-tax revenue
        </h4>
        <div className="divide-separator divide-y">
          {split.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-label text-body font-medium">{row.label}</p>
                <p className="text-label-secondary text-footnote">{row.sub}</p>
              </div>
              <div className="text-right">
                <p className="text-label text-title-3 tabular-nums">{formatNumber(row.value)}</p>
                <p className="text-label-secondary text-footnote tabular-nums">{row.percent}%</p>
              </div>
            </div>
          ))}
        </div>
      </FacetCard>

      <FacetCard className="space-y-3 p-4">
        <h4 className="text-label border-separator text-headline border-b pb-3">
          Top revenue sources
        </h4>
        <ol className="divide-separator text-footnote divide-y">
          {revenueSummary.topRevenueSources.map((source, index) => (
            <li key={source.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-label-secondary w-4 shrink-0 text-right tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-label text-caption truncate font-semibold">{source.name}</p>
                  <p className="text-label-secondary text-footnote truncate">{source.category}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-label text-caption font-semibold tabular-nums">
                  {formatNumber(source.revenueAmount ?? 0)}
                </p>
                <p className="text-label-secondary text-footnote tabular-nums">
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
