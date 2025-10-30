/**
 * Budget Meter Component
 *
 * Visual meter showing budget allocation progress
 */

import React from "react";
import type { BudgetSummary } from "~/lib/government-builder-validation";

export interface BudgetMeterProps {
  budgetSummary: BudgetSummary;
}

export const BudgetMeter = React.memo(function BudgetMeter({ budgetSummary }: BudgetMeterProps) {
  const { totalAllocatedPercent, remainingPercent, isOverBudget } = budgetSummary;

  return (
    <div className="bg-muted/40 rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Allocation</span>
        <span className={isOverBudget ? "text-red-600" : "text-muted-foreground"}>
          {totalAllocatedPercent.toFixed(1)}% allocated • {remainingPercent.toFixed(1)}% remaining
        </span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded">
        <div
          className={`h-2 ${isOverBudget ? "bg-red-500" : "bg-green-500"}`}
          style={{
            width: `${Math.min(100, Math.max(0, totalAllocatedPercent))}%`,
          }}
        />
      </div>
      {isOverBudget && (
        <div className="mt-2 text-xs text-red-600">
          Total exceeds 100%. Reduce allocations to proceed.
        </div>
      )}
    </div>
  );
});
