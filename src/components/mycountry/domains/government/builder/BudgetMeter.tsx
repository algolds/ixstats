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
import { Progress } from "~/components/ui/progress";
import { Card } from "~/components/ui/card";

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
          text: "text-yellow",
          bar: "bg-yellow",
          border: "border-yellow/40",
          message:
            "Fiscal Precaution: Approaching maximum target budget. Maintain tight control over operational margins.",
        }
      : {
          icon: CheckCircle,
          text: "text-green",
          bar: "bg-green",
          border: "",
          message:
            "Fiscal Health: Allocation structure is optimal and conforms to stability directives.",
        };
  const StatusIcon = status.icon;

  return (
    <Card className={cn("p-5", status.border)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <StatusIcon aria-hidden="true" className={cn("h-5 w-5", status.text)} />
            <h4 className="text-label text-headline">Fiscal allocation status</h4>
          </div>
          <div className="text-caption sm:text-body tabular-nums">
            <span className={cn("text-title-3 mr-1 tabular-nums", status.text)}>
              {totalAllocatedPercent.toFixed(1)}%
            </span>
            <span className="text-label-secondary">allocated</span>
            <span aria-hidden="true" className="text-label-secondary mx-2">
              •
            </span>
            <span
              className={cn(
                "mr-1 font-semibold tabular-nums",
                remainingPercent < 0 ? "text-destructive" : "text-label"
              )}
            >
              {remainingPercent.toFixed(1)}%
            </span>
            <span className="text-label-secondary">remaining</span>
          </div>
        </div>

        <Progress
          value={Math.min(100, Math.max(0, totalAllocatedPercent))}
          className="bg-fill-3 h-3"
          indicatorClassName={status.bar}
          aria-label="Budget allocated"
        />

        <div role="status" className={cn("text-caption flex items-center gap-2", status.text)}>
          <StatusIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>{status.message}</span>
        </div>
      </div>
    </Card>
  );
});
