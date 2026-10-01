"use client";

import React from "react";
import type { BudgetSummary, RevenueSummary } from "~/types/government";
import { formatNumber } from "~/lib/utils/format-utils";
import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";

interface BudgetKeyMetricsProps {
  budgetSummary: BudgetSummary;
  revenueSummary: RevenueSummary;
  formatCurrency: (amount: number) => string;
}

/** Four headline budget figures in one card, separated by hairlines rather than tinted tiles. */
export function BudgetKeyMetrics({
  budgetSummary,
  revenueSummary,
  formatCurrency,
}: BudgetKeyMetricsProps) {
  const metrics = [
    {
      label: "Total budget",
      value: formatNumber(budgetSummary.totalBudget),
      sub: formatCurrency(budgetSummary.totalBudget),
    },
    {
      label: "Allocated",
      value: formatNumber(budgetSummary.totalAllocated),
      sub: `${
        budgetSummary.totalBudget > 0
          ? ((budgetSummary.totalAllocated / budgetSummary.totalBudget) * 100).toFixed(1)
          : 0
      }% of total`,
    },
    {
      label: "Utilized",
      value: formatNumber(budgetSummary.totalSpent),
      sub: `${budgetSummary.utilizationRate.toFixed(1)}% utilization`,
    },
    {
      label: "Revenue",
      value: formatNumber(revenueSummary.totalRevenue),
      sub: `${
        revenueSummary.totalTaxRevenue > 0
          ? ((revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1)
          : 0
      }% tax`,
    },
  ];

  return (
    <FacetCard>
      <dl className="divide-separator grid grid-cols-2 divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0 p-4">
            <dt>
              <Eyebrow>{m.label}</Eyebrow>
            </dt>
            <dd className="text-label text-title-2 mt-1 truncate tabular-nums">{m.value}</dd>
            <dd className="text-label-secondary text-footnote mt-1 truncate tabular-nums">
              {m.sub}
            </dd>
          </div>
        ))}
      </dl>
    </FacetCard>
  );
}
