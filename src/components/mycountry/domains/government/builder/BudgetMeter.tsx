"use client";
/**
 * Budget Meter Component
 *
 * Visual meter showing budget allocation progress with premium glassmorphic styling
 */

import React from "react";
import type { BudgetSummary } from "~/lib/government/builder-validation";
import { cn } from "~/lib/utils";
import { WarningTriangle as AlertTriangle, CheckCircle, StatUp as TrendingUp } from "iconoir-react";
import { motion } from "motion/react";

export interface BudgetMeterProps {
  budgetSummary: BudgetSummary;
}

export const BudgetMeter = React.memo(function BudgetMeter({ budgetSummary }: BudgetMeterProps) {
  const { totalAllocatedPercent, remainingPercent, isOverBudget } = budgetSummary;

  // Determine current status configuration
  // Stable: < 90% (Cyan gradient, cyan glow)
  // Warning: 90% - 100% (Amber gradient, amber glow)
  // Danger: > 100% (Red/Crimson gradient, red glow)
  const isWarning = totalAllocatedPercent >= 90 && totalAllocatedPercent <= 100;

  const statusColor = isOverBudget
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-emerald-500";

  const glowColor = isOverBudget
    ? "bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-300"
    : isWarning
      ? "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300"
      : "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300";

  const textColor = isOverBudget
    ? "text-red-600 dark:text-red-400 font-bold"
    : isWarning
      ? "text-amber-600 dark:text-amber-400 font-semibold"
      : "text-emerald-600 dark:text-emerald-400 font-semibold";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 shadow-xl backdrop-blur-md transition-all duration-300",
        glowColor
      )}
    >
      {/* Decorative background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent" />
      <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 rounded-full bg-cyan-500/[0.02] blur-3xl" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            {isOverBudget ? (
              <AlertTriangle className="h-5 w-5 animate-pulse text-red-500" />
            ) : isWarning ? (
              <TrendingUp className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            )}
            <span className="text-sm font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
              Fiscal Allocation Status
            </span>
          </div>
          <div className="text-xs font-medium sm:text-sm">
            <span className={cn("mr-1 text-base font-extrabold", textColor)}>
              {totalAllocatedPercent.toFixed(1)}%
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">allocated</span>
            <span className="mx-2 text-zinc-400 dark:text-zinc-600">•</span>
            <span
              className={cn(
                "mr-1 font-bold",
                remainingPercent < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-700 dark:text-zinc-300"
              )}
            >
              {remainingPercent.toFixed(1)}%
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">remaining</span>
          </div>
        </div>

        {/* Dynamic dual-track track bar */}
        <div className="relative h-3 w-full overflow-hidden rounded-full border border-zinc-200 bg-zinc-200 dark:border-white/5 dark:bg-zinc-950/60">
          <motion.div
            className={cn(
              "h-full rounded-full shadow-sm",
              statusColor
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, totalAllocatedPercent))}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
          />
        </div>

        {/* Warning / status messages */}
        {isOverBudget ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Budget Alert: Total allocated spending exceeds 100%. Please scale back department
              funding to restore structural balance.
            </span>
          </div>
        ) : isWarning ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            <span>
              Fiscal Precaution: Approaching maximum target budget. Maintain tight control over
              operational margins.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Fiscal Health: Allocation structure is optimal and conforms to stability directives.
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
