"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { BudgetSummary, RevenueSummary } from "~/types/government";
import type { BudgetHealthStatus } from "./budgetTypes";
import { Card } from "~/components/ui/card";

interface BudgetHealthAnalysisProps {
  budgetSummary: BudgetSummary;
  revenueSummary: RevenueSummary;
  budgetHealth: BudgetHealthStatus;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-label-secondary text-caption">{label}</span>
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
      <Card className="space-y-1 p-4">
        <h4 className="text-label border-separator text-headline border-b pb-3">
          Budget health indicators
        </h4>
        <div className="divide-separator text-footnote divide-y">
          <Row label="Fiscal balance">
            <Badge variant="outline" className={budgetHealth.color}>
              {budgetHealth.label}
            </Badge>
          </Row>
          <Row label="Budget utilization">
            <span
              className={cn(
                "font-semibold tabular-nums",
                budgetSummary.utilizationRate > 90
                  ? "text-green"
                  : budgetSummary.utilizationRate > 70
                    ? "text-yellow"
                    : "text-destructive"
              )}
            >
              {budgetSummary.utilizationRate.toFixed(1)}%
            </span>
          </Row>
          <Row label="Revenue adequacy">
            <span
              className={cn("font-semibold", revenueAdequate ? "text-green" : "text-destructive")}
            >
              {revenueAdequate ? "Adequate" : "Insufficient"}
            </span>
          </Row>
          <Row label="Departments">
            <span className="text-label font-semibold tabular-nums">
              {budgetSummary.departmentCount} Active
            </span>
          </Row>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h4 className="text-label border-separator text-headline border-b pb-3">
          Budget efficiency score
        </h4>
        <div className="py-2 text-center">
          <div className="text-label text-large-title tabular-nums">{efficiencyScore}</div>
          <span className="text-stat-label text-label-secondary mt-1 block">
            Overall administrative efficiency
          </span>
        </div>
        <div className="divide-separator text-footnote divide-y">
          <Row label="Utilization rate">
            <span className="text-label font-semibold tabular-nums">
              {budgetSummary.utilizationRate.toFixed(1)}%
            </span>
          </Row>
          <Row label="Fiscal health">
            <span className="text-label font-semibold">{budgetHealth.label}</span>
          </Row>
          <Row label="Department coverage">
            <span className="text-label font-semibold tabular-nums">
              {budgetSummary.departmentCount} depts
            </span>
          </Row>
        </div>
      </Card>
    </div>
  );
}
