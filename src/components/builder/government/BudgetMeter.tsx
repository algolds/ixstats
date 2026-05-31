/**
 * Budget Meter Component
 *
 * Visual meter showing budget allocation progress with premium glassmorphic styling
 */

"use client";

import React from "react";
import type { BudgetSummary } from "~/lib/government-builder-validation";
import { cn } from "~/lib/utils";
import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
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
    ? "from-red-500 to-rose-600 shadow-red-500/20"
    : isWarning
      ? "from-amber-500 to-orange-600 shadow-amber-500/20"
      : "from-cyan-500 to-blue-600 shadow-cyan-500/20";

  const glowColor = isOverBudget
    ? "bg-red-500/5 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-200"
    : isWarning
      ? "bg-amber-500/5 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200"
      : "bg-cyan-500/5 border-cyan-200 dark:border-cyan-500/20 text-cyan-800 dark:text-cyan-200";

  const textColor = isOverBudget
    ? "text-red-600 dark:text-red-400 font-bold"
    : isWarning
      ? "text-amber-600 dark:text-amber-400 font-semibold"
      : "text-cyan-600 dark:text-cyan-400 font-semibold";

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
              <TrendingUp className="h-5 w-5 text-amber-400" />
            ) : (
              <CheckCircle className="h-5 w-5 text-cyan-400" />
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
                  : "text-zinc-750 dark:text-zinc-300"
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
              "h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(0,0,0,0.5)]",
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
