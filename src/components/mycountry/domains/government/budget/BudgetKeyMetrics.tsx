"use client";

import React from "react";
import type { BudgetSummary, RevenueSummary } from "~/types/government";
import { formatNumber } from "~/lib/utils/format-utils";
import { Card } from "~/components/ui/card";
import { REVENUE_BASIS_NOTE } from "~/components/mycountry/shell/fiscal/nationalRevenue";

interface BudgetKeyMetricsProps {
  budgetSummary: BudgetSummary;
  revenueSummary: RevenueSummary;
  /** Policy maintenance spent in the year shown: spending within the year, not a debit. */
  maintenanceSpent: number;
  formatCurrency: (amount: number) => string;
}

const shareOf = (part: number, whole: number) =>
  whole > 0 ? ((part / whole) * 100).toFixed(1) : "0";

/** Four headline budget figures in one card, separated by hairlines rather than tinted tiles. */
export function BudgetKeyMetrics({
  budgetSummary,
  revenueSummary,
  maintenanceSpent,
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
      sub: `${shareOf(budgetSummary.totalAllocated, budgetSummary.totalBudget)}% of total`,
    },
    {
      label: "Policy maintenance",
      value: formatNumber(maintenanceSpent),
      sub: `${shareOf(maintenanceSpent, budgetSummary.totalBudget)}% of the year's budget`,
    },
    {
      label: "Revenue",
      value: formatNumber(revenueSummary.totalRevenue),
      sub: revenueSummary.basis ? REVENUE_BASIS_NOTE[revenueSummary.basis] : "No tax rates set yet",
    },
  ];

  return (
    <Card>
      <dl className="divide-separator grid grid-cols-2 divide-y lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0 p-4">
            <dt className="text-label-secondary text-footnote">{m.label}</dt>
            <dd className="text-label text-title-2 mt-1 truncate tabular-nums">{m.value}</dd>
            <dd className="text-label-secondary text-footnote mt-1 tabular-nums">{m.sub}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
