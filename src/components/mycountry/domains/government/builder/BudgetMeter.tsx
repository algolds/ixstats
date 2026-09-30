"use client";
/**
 * Budget Meter Component
 *
 * Meter showing budget allocation progress; colour is used only for the fiscal status.
 */

import React from "react";
import type { BudgetSummary } from "~/lib/government/builder-validation";
import { cn } from "~/lib/utils";
import { WarningTriangle as AlertTriangle, CheckCircle, StatUp as TrendingUp } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";

export interface BudgetMeterProps {
  budgetSummary: BudgetSummary;
}

export const BudgetMeter = React.memo(function BudgetMeter({ budgetSummary }: BudgetMeterProps) {
  const { totalAllocatedPercent, remainingPercent, isOverBudget } = budgetSummary;

  // Stable: < 90%; warning: 90–100%; over budget: > 100%.
  const isWarning = totalAllocatedPercent >= 90 && totalAllocatedPercent <= 100;

  const status = isOverBudget
    ? {
        icon: AlertTriangle,
        text: "text-destructive",
        bar: "bg-destructive",
        border: "border-destructive/40",
        message:
          "Budget Alert: Total allocated spending exceeds 100%. Please scale back department funding to restore structural balance.",
      }
    : isWarning
      ? {
          icon: TrendingUp,
          text: "text-amber-600",
          bar: "bg-amber-500",
          border: "border-amber-500/40",
          message:
            "Fiscal Precaution: Approaching maximum target budget. Maintain tight control over operational margins.",
        }
      : {
          icon: CheckCircle,
          text: "text-emerald-600",
          bar: "bg-emerald-500",
          border: "",
          message:
            "Fiscal Health: Allocation structure is optimal and conforms to stability directives.",
        };
  const StatusIcon = status.icon;

  return (
    <FacetCard depth={1} className={cn("p-5", status.border)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <StatusIcon aria-hidden="true" className={cn("h-5 w-5", status.text)} />
            <h3 className="text-foreground text-sm font-semibold">Fiscal allocation status</h3>
          </div>
          <div className="text-xs font-medium tabular-nums sm:text-sm">
            <span className={cn("mr-1 font-mono text-base font-semibold", status.text)}>
              {totalAllocatedPercent.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">allocated</span>
            <span aria-hidden="true" className="text-muted-foreground mx-2">
              •
            </span>
            <span
              className={cn(
                "mr-1 font-mono font-semibold",
                remainingPercent < 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {remainingPercent.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">remaining</span>
          </div>
        </div>

        <Progress
          value={Math.min(100, Math.max(0, totalAllocatedPercent))}
          className="bg-muted h-3"
          indicatorClassName={status.bar}
          aria-label="Budget allocated"
        />

        <div
          role="status"
          className={cn("flex items-center gap-1.5 text-xs font-medium", status.text)}
        >
          <StatusIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>{status.message}</span>
        </div>
      </div>
    </FacetCard>
  );
});
