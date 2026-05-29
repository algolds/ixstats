// SpendingValidationPanel Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Displays budget validation status and financial health indicators

"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { cn } from "~/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Settings,
  Zap,
  Info,
} from "lucide-react";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { EnhancedPieChart } from "~/app/builder/primitives/enhanced";

interface SpendingValidationPanelProps {
  totalBudget: number;
  totalAllocated: number;
  totalRevenue: number;
  budgetUtilization: number;
  isValidBudget: boolean;
  isSurplus: boolean;
  selectedPoliciesCount: number;
  isUpdating?: boolean;
  className?: string;
  spendingData?: Array<{ id: string; name: string; value: number; color: string }>;
}

/**
 * SpendingValidationPanel - Shows budget status, validation, and key metrics
 * Provides visual feedback on budget health and policy configuration
 */
export function SpendingValidationPanel({
  totalBudget,
  totalAllocated,
  totalRevenue,
  budgetUtilization,
  isValidBudget,
  isSurplus,
  selectedPoliciesCount,
  isUpdating = false,
  className,
  spendingData = [],
}: SpendingValidationPanelProps) {
  const hasAllocations = totalAllocated > 0 && spendingData && spendingData.length > 0;

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "cursor-default border-white/10 bg-black/20 backdrop-blur-md dark:border-white/5",
        className
      )}
    >
      <CutoutCardContent className="p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={cn("space-y-4", hasAllocations ? "lg:col-span-2" : "lg:col-span-3")}>
            {/* Integration Status Indicator */}
            {isUpdating && (
              <Alert className="border-blue-500/20 bg-blue-500/10 dark:border-blue-950/20 dark:bg-blue-950/20">
                <Zap className="h-4 w-4 animate-pulse text-blue-500 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  Updating government structure from atomic components...
                </AlertDescription>
              </Alert>
            )}

            {/* Budget Status Badges */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Budget Utilization Badge */}
              {totalBudget > 0 && (
                <Badge variant={isValidBudget ? "default" : "secondary"} className="px-3 py-1">
                  {isValidBudget ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Budget: {budgetUtilization.toFixed(1)}%
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Budget: {budgetUtilization.toFixed(1)}%
                    </>
                  )}
                </Badge>
              )}

              {/* Surplus/Deficit Badge */}
              {totalRevenue > 0 && (
                <Badge variant={isSurplus ? "default" : "destructive"} className="px-3 py-1">
                  {isSurplus ? (
                    <>
                      <TrendingUp className="mr-1 h-3 w-3" />
                      Surplus
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Deficit
                    </>
                  )}
                </Badge>
              )}

              {/* Policy Count Badge */}
              <Badge variant="outline" className="px-3 py-1">
                <Settings className="mr-1 h-3 w-3" />
                {selectedPoliciesCount} Policies
              </Badge>
            </div>

            {/* Budget Health Details */}
            {totalBudget > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <BudgetMetric
                  label="Total Budget"
                  value={totalBudget.toLocaleString()}
                  currency={true}
                  status={isValidBudget ? "success" : "warning"}
                />
                <BudgetMetric
                  label="Allocated"
                  value={totalAllocated.toLocaleString()}
                  currency={true}
                  status={
                    budgetUtilization > 105
                      ? "error"
                      : budgetUtilization < 95
                        ? "warning"
                        : "success"
                  }
                />
                <BudgetMetric
                  label="Revenue"
                  value={totalRevenue.toLocaleString()}
                  currency={true}
                  status={isSurplus ? "success" : "warning"}
                />
              </div>
            )}

            {/* Validation Messages */}
            {!isValidBudget && totalBudget > 0 && (
              <Alert
                className={cn(
                  budgetUtilization > 105
                    ? "border-red-500/20 bg-red-500/10 dark:border-red-950/20 dark:bg-red-950/20"
                    : "border-yellow-500/20 bg-yellow-500/10 dark:border-yellow-950/20 dark:bg-yellow-950/20"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    budgetUtilization > 105
                      ? "text-red-500 dark:text-red-400"
                      : "text-yellow-500 dark:text-yellow-400"
                  )}
                />
                <AlertDescription
                  className={cn(
                    budgetUtilization > 105
                      ? "text-red-700 dark:text-red-300"
                      : "text-yellow-700 dark:text-yellow-300"
                  )}
                >
                  {budgetUtilization > 105 ? (
                    <>
                      Budget is over-allocated by {(budgetUtilization - 100).toFixed(1)}%. Reduce
                      spending to balance the budget.
                    </>
                  ) : (
                    <>
                      Budget utilization is {budgetUtilization.toFixed(1)}%. Consider allocating
                      remaining {(100 - budgetUtilization).toFixed(1)}% to priority areas.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!isSurplus && totalRevenue > 0 && totalBudget > 0 && (
              <Alert className="border-yellow-500/20 bg-yellow-500/10 dark:border-yellow-950/20 dark:bg-yellow-950/20">
                <Info className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  Budget deficit of {Math.abs(totalRevenue - totalAllocated).toLocaleString()}.
                  Consider increasing revenue sources or reducing spending.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Pie Chart Visualization */}
          {hasAllocations && (
            <div className="flex flex-col items-center justify-center border-t border-white/10 pt-6 lg:border-t-0 lg:border-l lg:border-white/10 lg:pt-0 lg:pl-6">
              <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                Allocation Breakdown
              </h4>
              <div className="w-full max-w-[240px]">
                <EnhancedPieChart
                  data={spendingData}
                  dataKey="value"
                  nameKey="name"
                  sectionId="government"
                  innerRadius={70}
                  showLegend={false}
                  showLabels={false}
                  height={160}
                  className="animate-fadeIn mx-auto"
                />
              </div>
              <div className="mt-2 text-center">
                <span className="text-muted-foreground font-mono text-xs">
                  {spendingData.length} Areas Allocated
                </span>
              </div>
            </div>
          )}
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}

/**
 * BudgetMetric - Individual budget metric display
 */
function BudgetMetric({
  label,
  value,
  currency = false,
  status = "default",
}: {
  label: string;
  value: string;
  currency?: boolean;
  status?: "default" | "success" | "warning" | "error";
}) {
  const statusColors = {
    default: "bg-white/5 border-white/10 dark:bg-white/5 dark:border-white/5 text-foreground",
    success:
      "bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-950/20 dark:border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20 dark:bg-amber-950/20 dark:border-amber-500/20",
    error: "bg-red-500/10 border-red-500/20 dark:bg-red-950/20 dark:border-red-500/20",
  };

  const statusTextColors = {
    default: "text-foreground",
    success: "text-emerald-500 dark:text-emerald-400",
    warning: "text-amber-500 dark:text-amber-400",
    error: "text-red-500 dark:text-red-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 backdrop-blur-xs transition-colors",
        statusColors[status]
      )}
    >
      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className={cn("font-mono text-xl font-bold tracking-tight", statusTextColors[status])}>
        {currency && "$"}
        {value}
      </p>
    </div>
  );
}
