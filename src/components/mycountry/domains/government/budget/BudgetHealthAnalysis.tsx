"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";
import type { BudgetSummary, RevenueSummary } from "~/types/government";
import type { BudgetHealthStatus } from "./budgetTypes";

interface BudgetHealthAnalysisProps {
  budgetSummary: BudgetSummary;
  revenueSummary: RevenueSummary;
  budgetHealth: BudgetHealthStatus;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </div>
  );
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
  const revenueAdequate = revenueSummary.totalRevenue > budgetSummary.totalAllocated;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FacetCard depth={1} surface="solid" className="space-y-1 p-4">
        <h4 className="text-foreground border-border/60 border-b pb-3 text-sm font-semibold">
          Budget health indicators
        </h4>
        <div className="divide-border/60 divide-y text-xs">
          <Row label="Fiscal Balance">
            <Badge variant="outline" className={budgetHealth.color}>
              {budgetHealth.label}
            </Badge>
          </Row>
          <Row label="Budget Utilization">
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                budgetSummary.utilizationRate > 90
                  ? "text-emerald-600"
                  : budgetSummary.utilizationRate > 70
                    ? "text-amber-600"
                    : "text-destructive"
              )}
            >
              {budgetSummary.utilizationRate.toFixed(1)}%
            </span>
          </Row>
          <Row label="Revenue Adequacy">
            <span
              className={cn(
                "font-semibold",
                revenueAdequate ? "text-emerald-600" : "text-destructive"
              )}
            >
              {revenueAdequate ? "Adequate" : "Insufficient"}
            </span>
          </Row>
          <Row label="Departments">
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {budgetSummary.departmentCount} Active
            </span>
          </Row>
        </div>
      </FacetCard>

      <FacetCard depth={1} surface="solid" className="space-y-3 p-4">
        <h4 className="text-foreground border-border/60 border-b pb-3 text-sm font-semibold">
          Budget efficiency score
        </h4>
        <div className="py-2 text-center">
          <div className="text-foreground font-mono text-4xl font-semibold tracking-tight tabular-nums">
            {efficiencyScore}
          </div>
          <Eyebrow className="mt-1 block">Overall administrative efficiency</Eyebrow>
        </div>
        <div className="divide-border/60 divide-y text-xs">
          <Row label="Utilization Rate">
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {budgetSummary.utilizationRate.toFixed(1)}%
            </span>
          </Row>
          <Row label="Fiscal Health">
            <span className="text-foreground font-semibold">{budgetHealth.label}</span>
          </Row>
          <Row label="Department Coverage">
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {budgetSummary.departmentCount} depts
            </span>
          </Row>
        </div>
      </FacetCard>
    </div>
  );
}
