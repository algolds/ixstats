"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import type { BudgetSummary, RevenueSummary } from "~/types/government";
import type { BudgetHealthStatus } from "./budgetTypes";

interface BudgetHealthAnalysisProps {
  budgetSummary: BudgetSummary;
  revenueSummary: RevenueSummary;
  budgetHealth: BudgetHealthStatus;
}

export function BudgetHealthAnalysis({
  budgetSummary,
  revenueSummary,
  budgetHealth,
}: BudgetHealthAnalysisProps) {
  const efficiencyScore = Math.min(
    100,
    Math.round(
      (budgetSummary.utilizationRate +
        (revenueSummary.totalRevenue > budgetSummary.totalSpent ? 20 : -20) +
        (budgetSummary.departmentCount > 5 ? 10 : 0)) *
        0.8
    )
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FacetCard
        depth={1}
        className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 border-b pb-2">
          <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
            Budget Health Indicators
          </h4>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
            <span className="text-muted-foreground font-semibold">Fiscal Balance</span>
            <Badge
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${budgetHealth.color}`}
            >
              {budgetHealth.label}
            </Badge>
          </div>

          <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
            <span className="text-muted-foreground font-semibold">Budget Utilization</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                budgetSummary.utilizationRate > 90
                  ? "text-emerald-400"
                  : budgetSummary.utilizationRate > 70
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {budgetSummary.utilizationRate.toFixed(1)}%
            </span>
          </div>

          <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
            <span className="text-muted-foreground font-semibold">Revenue Adequacy</span>
            <span
              className={`font-semibold ${
                revenueSummary.totalRevenue > budgetSummary.totalAllocated
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {revenueSummary.totalRevenue > budgetSummary.totalAllocated
                ? "Adequate"
                : "Insufficient"}
            </span>
          </div>

          <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-xl border p-2.5">
            <span className="text-muted-foreground font-semibold">Departments</span>
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {budgetSummary.departmentCount} Active
            </span>
          </div>
        </div>
      </FacetCard>

      <FacetCard
        depth={1}
        className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 border-b pb-2">
          <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
            Budget Efficiency Score
          </h4>
        </div>
        <div className="space-y-4 text-center">
          <div className="font-mono text-4xl font-bold tracking-tight text-emerald-400 tabular-nums">
            {efficiencyScore}
          </div>
          <p className="text-muted-foreground text-xs font-semibold">
            Overall Administrative Efficiency Score
          </p>
          <div className="space-y-2 text-left text-xs">
            <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2">
              <span className="text-muted-foreground font-medium">Utilization Rate</span>
              <span className="text-foreground font-mono font-bold">
                {budgetSummary.utilizationRate.toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2">
              <span className="text-muted-foreground font-medium">Fiscal Health</span>
              <span className="font-bold text-emerald-400">{budgetHealth.label}</span>
            </div>
            <div className="bg-muted/15 border-border/20 flex items-center justify-between rounded-lg border p-2">
              <span className="text-muted-foreground font-medium">Department Coverage</span>
              <span className="font-mono font-bold text-cyan-400">
                {budgetSummary.departmentCount} depts
              </span>
            </div>
          </div>
        </div>
      </FacetCard>
    </div>
  );
}
