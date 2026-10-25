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

/**
 * The year's allocations against revenue. Utilization and an efficiency score need a record of
 * spending, which nothing keeps yet, so they are not shown.
 */
export function BudgetHealthAnalysis({
  budgetSummary,
  revenueSummary,
  budgetHealth,
}: BudgetHealthAnalysisProps) {
  const hasRevenue = revenueSummary.totalRevenue > 0;
  const revenueAdequate = revenueSummary.totalRevenue >= budgetSummary.totalAllocated;

  return (
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
        <Row label="Revenue covers allocations">
          {hasRevenue ? (
            <span
              className={cn("font-semibold", revenueAdequate ? "text-green" : "text-destructive")}
            >
              {revenueAdequate ? "Yes" : "No"}
            </span>
          ) : (
            <span className="text-label-secondary">No revenue recorded</span>
          )}
        </Row>
        <Row label="Departments">
          <span className="text-label font-semibold tabular-nums">
            {budgetSummary.departmentCount}
          </span>
        </Row>
      </div>
      <p className="text-label-secondary text-footnote pt-2">
        Spending is not recorded yet, so the allocations stand for it. Utilization appears once
        spending is tracked.
      </p>
    </Card>
  );
}
