"use client";

import React, { useRef, useCallback } from "react";
import { formatExactCurrency } from "~/lib/utils";
import { usePendingLocks } from "~/app/mycountry/editor/hooks/usePendingLocks";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import { GlassCard } from "~/app/builder/components/glass/GlassCard";
import { motion, AnimatePresence } from "motion/react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calculator,
  ChevronDown,
  ChevronRight,
  // eslint-disable-next-line unused-imports/no-unused-imports
  HelpCircle,
} from "lucide-react";
import type { BudgetAllocationInput, BudgetStatus } from "~/types/government";

interface BudgetAllocationFormProps {
  data: BudgetAllocationInput;
  onChange: (data: BudgetAllocationInput) => void;
  departmentName: string;
  departmentColor: string;
  parentName?: string;
  parentColor?: string;
  totalBudget: number;
  currency: string;
  isReadOnly?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const budgetStatusConfig = {
  Allocated: {
    color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    icon: Clock,
    label: "Allocated",
  },
  "In Use": {
    color: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
    icon: TrendingUp,
    label: "In Use",
  },
  Overspent: {
    color: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
    icon: AlertTriangle,
    label: "Overspent",
  },
  Underutilized: {
    color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    icon: TrendingDown,
    label: "Underutilized",
  },
  Completed: {
    color: "bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-400",
    icon: CheckCircle,
    label: "Completed",
  },
};

export function BudgetAllocationForm({
  data,
  onChange,
  departmentName,
  departmentColor,
  parentName,
  parentColor,
  totalBudget,
  currency = "USD",
  isReadOnly = false,
  isCollapsed = false,
  onToggleCollapse,
}: BudgetAllocationFormProps) {
  const { isLocked } = usePendingLocks();

  // Use a ref to access latest data without causing re-renders
  const dataRef = useRef(data);
  dataRef.current = data;
  const totalBudgetRef = useRef(totalBudget);
  totalBudgetRef.current = totalBudget;

  const handleChange = useCallback(
    (field: keyof BudgetAllocationInput, value: any) => {
      const updatedData = {
        ...dataRef.current,
        [field]: value,
      };

      // Auto-calculate percentage when amount changes
      if (field === "allocatedAmount" && totalBudgetRef.current > 0) {
        updatedData.allocatedPercent =
          Math.round((value / totalBudgetRef.current) * 100 * 1000) / 1000; // Round to 3 decimal places
      }

      // Auto-calculate amount when percentage changes
      if (field === "allocatedPercent") {
        updatedData.allocatedAmount = Math.round((totalBudgetRef.current * value) / 100); // Round to nearest dollar
      }

      onChange(updatedData);
    },
    [onChange]
  );

  const formatCurrency = (amount: number) => {
    return formatExactCurrency(amount, currency);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const utilizationRate =
    data.allocatedAmount > 0
      ? ((data.allocatedAmount - data.allocatedAmount * 0.1) / data.allocatedAmount) * 100 // Mock utilization
      : 0;

  const getBudgetStatus = (): BudgetStatus => {
    if (utilizationRate > 100) return "Overspent";
    if (utilizationRate < 50) return "Underutilized";
    if (utilizationRate > 0) return "In Use";
    return "Allocated";
  };

  const currentStatus = getBudgetStatus();
  const statusConfig = budgetStatusConfig[currentStatus];
  const StatusIcon = statusConfig.icon;

  const cardElement = (
    <GlassCard
      depth="base"
      theme="teal"
      className={cn(
        "relative overflow-hidden border-zinc-200/50 transition-all duration-200 dark:border-white/5",
        isCollapsed
          ? "hover:border-cyan-500/20 hover:bg-zinc-50/50 dark:hover:bg-white/[0.01]"
          : "border-cyan-500/20 shadow-lg dark:border-cyan-500/10"
      )}
      texture="chevron"
      textureOpacity={0.03}
    >
      {/* Header Row: Always visible */}
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section: Chevron + Title + Context */}
        <div className="flex items-center gap-3">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-6 w-6 p-1 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}

          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 shadow-inner dark:border-white/5 dark:bg-zinc-950/40"
              style={{ boxShadow: `inset 0 0 10px ${departmentColor}22` }}
            >
              <DollarSign className="h-4.5 w-4.5" style={{ color: departmentColor }} />
            </div>
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white">
                {departmentName}
                {parentName && (
                  <span
                    className="rounded border px-1.5 py-0.5 text-[9px] font-medium"
                    style={{
                      backgroundColor: `${parentColor}11`,
                      borderColor: `${parentColor}22`,
                      color: parentColor,
                    }}
                  >
                    Sub of {parentName}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                {utilizationRate > 0 ? `Utilization: ${utilizationRate.toFixed(0)}%` : "Unfunded"}
              </span>
            </div>
          </div>
        </div>

        {/* Center Section: Inline amount/percentage controls */}
        <div className="flex flex-wrap items-center gap-4 lg:mr-4 lg:ml-auto">
          {/* Allocated Amount */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Amount
            </span>
            <div className="relative w-36 sm:w-40">
              <span className="absolute top-1.5 left-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                $
              </span>
              <input
                type="number"
                value={data.allocatedAmount || ""}
                onChange={(e) => handleChange("allocatedAmount", parseFloat(e.target.value) || 0)}
                disabled={isReadOnly || isLocked("budgetAllocations")}
                min="0"
                step="1000000"
                className="w-full rounded border border-zinc-200 bg-white py-1 pr-2 pl-6 text-xs font-semibold text-zinc-900 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-white"
              />
            </div>
          </div>

          {/* Allocation Share (Percentage) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Share
            </span>
            <div className="flex items-center gap-2">
              <div className="hidden w-20 sm:block sm:w-28">
                <Slider
                  value={[data.allocatedPercent]}
                  onValueChange={(value) => handleChange("allocatedPercent", value[0])}
                  min={0}
                  max={50}
                  step={0.1}
                  disabled={isReadOnly || isLocked("budgetAllocations")}
                  className="w-full cursor-pointer py-1"
                />
              </div>
              <div className="relative w-16">
                <input
                  type="number"
                  value={parseFloat(data.allocatedPercent.toFixed(3))}
                  onChange={(e) =>
                    handleChange("allocatedPercent", parseFloat(e.target.value) || 0)
                  }
                  disabled={isReadOnly || isLocked("budgetAllocations")}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full rounded border border-zinc-200 bg-white py-1 pr-4 pl-1.5 text-right text-xs font-semibold text-zinc-900 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-zinc-950/60 dark:text-white"
                />
                <span className="absolute top-1.5 right-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Status badge + current value text */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200/50 pt-3 sm:justify-end lg:border-t-0 lg:pt-0 dark:border-white/5">
          <Badge className={cn("border bg-transparent shadow-none", statusConfig.color)}>
            <StatusIcon className="mr-1 h-3 w-3 shrink-0" />
            {statusConfig.label}
          </Badge>
          <div className="text-right">
            <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-300">
              {formatCurrency(data.allocatedAmount)}
            </div>
            <div className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Calculated Outflow
            </div>
          </div>
        </div>
      </div>

      {/* Expanded section containing advanced tools */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4">
              <div className="h-px bg-zinc-200 dark:bg-white/5" />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Left side: Inputs */}
                <div className="space-y-4">
                  {/* Budget Year */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`budgetYear-${data.departmentId}`}
                      className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      Budget Cycle Year
                    </Label>
                    <Input
                      id={`budgetYear-${data.departmentId}`}
                      type="number"
                      value={data.budgetYear}
                      onChange={(e) =>
                        handleChange(
                          "budgetYear",
                          parseInt(e.target.value) ||
                            new Date(IxTime.getCurrentIxTime()).getFullYear()
                        )
                      }
                      disabled={isReadOnly}
                      min="2020"
                      max="2035"
                      className="h-8 border-zinc-200 bg-white text-zinc-900 focus:border-cyan-500/30 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`notes-${data.departmentId}`}
                      className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      Allocation Directives & Guidelines
                    </Label>
                    <textarea
                      id={`notes-${data.departmentId}`}
                      value={data.notes || ""}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      placeholder="Input additional directives, spending limitations, or policy goals..."
                      disabled={isReadOnly}
                      rows={3}
                      className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none dark:border-white/10 dark:bg-zinc-950/40 dark:text-white dark:placeholder:text-zinc-600"
                    />
                  </div>

                  {/* Auto-Balance Helper */}
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChange("allocatedPercent", 5)}
                        className="h-7 border-zinc-200 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-transparent dark:hover:text-white"
                      >
                        Reset to 5%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChange("allocatedPercent", 10)}
                        className="h-7 border-zinc-200 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-transparent dark:hover:text-white"
                      >
                        Reset to 10%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChange("allocatedPercent", 15)}
                        className="h-7 border-zinc-200 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-transparent dark:hover:text-white"
                      >
                        Reset to 15%
                      </Button>
                    </div>
                  )}
                </div>

                {/* Right side: Progress meter & contextual analysis */}
                <div className="space-y-4">
                  {/* Budget Utilization Visualizer */}
                  <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-100/50 p-4 shadow-inner dark:border-white/5 dark:bg-black/15">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                        Budget Utilization
                      </h4>
                      <span className="text-sm font-extrabold" style={{ color: departmentColor }}>
                        {utilizationRate.toFixed(1)}%
                      </span>
                    </div>

                    <div className="relative h-2 w-full overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-200 dark:border-white/5 dark:bg-zinc-950">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${utilizationRate}%`,
                          backgroundColor: departmentColor,
                          boxShadow: `0 0 8px ${departmentColor}33`,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-zinc-200 pt-2 text-center dark:border-white/5">
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-white">
                          {formatNumber(data.allocatedAmount)}
                        </div>
                        <div className="text-[8px] font-bold text-zinc-500 uppercase dark:text-zinc-400">
                          Allocated
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {formatNumber(data.allocatedAmount * 0.9)}
                        </div>
                        <div className="text-[8px] font-bold text-zinc-500 uppercase dark:text-zinc-400">
                          Utilized
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {formatNumber(data.allocatedAmount * 0.1)}
                        </div>
                        <div className="text-[8px] font-bold text-zinc-500 uppercase dark:text-zinc-400">
                          Remaining
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Context stats */}
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1 text-xs font-bold tracking-wider text-zinc-700 uppercase dark:text-zinc-400">
                      <Calculator className="h-3.5 w-3.5" />
                      Context Analytics
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-100/50 p-3 dark:border-white/5 dark:bg-zinc-950/20">
                        <div className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          Share of Budget
                        </div>
                        <div className="mt-2 text-base font-extrabold text-zinc-800 dark:text-white">
                          {data.allocatedPercent.toFixed(1)}%
                        </div>
                        <div className="mt-1 text-[9px] leading-normal text-zinc-500 dark:text-zinc-400">
                          of {formatNumber(totalBudget)} total outflow
                        </div>
                      </div>

                      <div className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-100/50 p-3 dark:border-white/5 dark:bg-zinc-950/20">
                        <div className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                          Per Capita Cost
                        </div>
                        <div className="mt-2 text-base font-extrabold text-zinc-800 dark:text-white">
                          {formatNumber(data.allocatedAmount / 100000)}
                        </div>
                        <div className="mt-1 text-[9px] leading-normal text-zinc-500 dark:text-zinc-400">
                          estimated per citizen
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );

  // Render parent nesting curve line if sub-department
  if (parentName) {
    return (
      <div className="relative ml-2 border-l border-zinc-200 pl-6 md:ml-4 md:pl-8 dark:border-white/10">
        {/* visual curved line connecting to parent */}
        <div
          className="absolute top-10 left-0 h-4 w-4 rounded-bl-lg border-b border-l border-zinc-200 dark:border-white/20"
          style={{ borderColor: parentColor ? `${parentColor}33` : undefined }}
        />
        {cardElement}
      </div>
    );
  }

  return cardElement;
}
