"use client";

import React from "react";
import { Dollar as DollarSign, StatUp as TrendingUp, StatsReport as BarChart3, Archery as Target } from "iconoir-react";
import type { BudgetSummary, RevenueSummary } from "~/types/government";
import { formatBudgetMetricNumber } from "./budgetTypes";

interface BudgetKeyMetricsProps {
  budgetSummary: BudgetSummary;
  revenueSummary: RevenueSummary;
  formatCurrency: (amount: number) => string;
}

export function BudgetKeyMetrics({
  budgetSummary,
  revenueSummary,
  formatCurrency,
}: BudgetKeyMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Total Budget
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400 tabular-nums">
              {formatBudgetMetricNumber(budgetSummary.totalBudget)}
            </p>
          </div>
          <DollarSign className="h-6 w-6 shrink-0 text-emerald-400" />
        </div>
        <div className="mt-2">
          <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {formatCurrency(budgetSummary.totalBudget)}
          </p>
        </div>
      </div>

      <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Allocated
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-cyan-400 tabular-nums">
              {formatBudgetMetricNumber(budgetSummary.totalAllocated)}
            </p>
          </div>
          <Target className="h-6 w-6 shrink-0 text-cyan-400" />
        </div>
        <div className="mt-2">
          <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {budgetSummary.totalBudget > 0
              ? ((budgetSummary.totalAllocated / budgetSummary.totalBudget) * 100).toFixed(1)
              : 0}
            % of total
          </p>
        </div>
      </div>

      <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Utilized
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-amber-400 tabular-nums">
              {formatBudgetMetricNumber(budgetSummary.totalSpent)}
            </p>
          </div>
          <TrendingUp className="h-6 w-6 shrink-0 text-amber-400" />
        </div>
        <div className="mt-2">
          <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {budgetSummary.utilizationRate.toFixed(1)}% utilization
          </p>
        </div>
      </div>

      <div className="bg-card/40 rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl transition-transform duration-200 active:scale-[0.98]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Revenue
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-indigo-400 tabular-nums">
              {formatBudgetMetricNumber(revenueSummary.totalRevenue)}
            </p>
          </div>
          <BarChart3 className="h-6 w-6 shrink-0 text-indigo-400" />
        </div>
        <div className="mt-2">
          <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {revenueSummary.totalTaxRevenue > 0
              ? ((revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1)
              : 0}
            % tax
          </p>
        </div>
      </div>
    </div>
  );
}
