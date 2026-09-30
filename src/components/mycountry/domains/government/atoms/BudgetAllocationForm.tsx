"use client";

import React, { useRef, useCallback } from "react";
import { formatExactCurrency, formatNumber } from "~/lib/utils";
import { usePendingLocks } from "~/hooks/usePendingLocks";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { Textarea } from "~/components/ui/textarea";
import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  Clock,
  Calculator,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { BUDGET_YEAR_MAX, BUDGET_YEAR_MIN } from "~/types/government";
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

/** Budget status → semantic outline-badge colour. */
const budgetStatusConfig = {
  Allocated: { color: "text-muted-foreground", icon: Clock, label: "Allocated" },
  "In Use": { color: "border-emerald-500/30 text-emerald-600", icon: TrendingUp, label: "In Use" },
  Overspent: {
    color: "border-destructive/30 text-destructive",
    icon: AlertTriangle,
    label: "Overspent",
  },
  Underutilized: {
    color: "border-amber-500/30 text-amber-600",
    icon: TrendingDown,
    label: "Underutilized",
  },
  Completed: { color: "text-muted-foreground", icon: CheckCircle, label: "Completed" },
};

/** Compact inline number field used in the allocation header row. */
const INLINE_NUMBER =
  "facet-refraction-none border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-md border py-1 text-xs font-semibold tabular-nums outline-none focus-visible:ring-2 disabled:opacity-50";

export function BudgetAllocationForm({
  data,
  onChange,
  departmentName,
  departmentColor,
  parentName,
  parentColor: _parentColor,
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
    <K extends keyof BudgetAllocationInput>(field: K, value: BudgetAllocationInput[K]) => {
      const updatedData: BudgetAllocationInput = { ...dataRef.current };
      updatedData[field] = value;

      // Auto-calculate percentage when amount changes
      if (field === "allocatedAmount" && totalBudgetRef.current > 0) {
        updatedData.allocatedPercent =
          Math.round((updatedData.allocatedAmount / totalBudgetRef.current) * 100 * 1000) / 1000; // Round to 3 decimal places
      }

      // Auto-calculate amount when percentage changes
      if (field === "allocatedPercent") {
        updatedData.allocatedAmount = Math.round(
          (totalBudgetRef.current * updatedData.allocatedPercent) / 100
        ); // Round to nearest dollar
      }

      onChange(updatedData);
    },
    [onChange]
  );

  const formatCurrency = (amount: number) => {
    return formatExactCurrency(amount, currency);
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
    <FacetCard depth={1} className={cn("overflow-hidden", !isCollapsed && "border-foreground/20")}>
      {/* Header row: always visible */}
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${departmentName}`}
              className="text-muted-foreground h-8 w-8"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}

          <div className="flex items-center gap-2.5">
            {/* The department's own colour (user data) identifies it across the budget views. */}
            <span
              aria-hidden="true"
              className="border-border h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: departmentColor }}
            />
            <div className="flex flex-col">
              <span className="text-foreground flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                {departmentName}
                {parentName && <Badge variant="outline">Sub of {parentName}</Badge>}
              </span>
              <span className="text-muted-foreground text-xs">
                {utilizationRate > 0 ? `Utilization: ${utilizationRate.toFixed(0)}%` : "Unfunded"}
              </span>
            </div>
          </div>
        </div>

        {/* Inline amount / share controls */}
        <div className="flex flex-wrap items-center gap-4 lg:mr-4 lg:ml-auto">
          <label className="flex items-center gap-2">
            <Eyebrow>Amount</Eyebrow>
            <span className="relative w-36 sm:w-40">
              <span className="text-muted-foreground absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-semibold">
                $
              </span>
              <input
                type="number"
                value={data.allocatedAmount || ""}
                onChange={(e) => handleChange("allocatedAmount", parseFloat(e.target.value) || 0)}
                disabled={isReadOnly || isLocked("budgetAllocations")}
                min="0"
                step="1000000"
                className={cn(INLINE_NUMBER, "pr-2 pl-6")}
              />
            </span>
          </label>

          <div className="flex items-center gap-2">
            <Eyebrow id={`share-${data.departmentId}`}>Share</Eyebrow>
            <div className="flex items-center gap-2">
              <div className="hidden w-20 sm:block sm:w-28">
                <Slider
                  value={[data.allocatedPercent]}
                  onValueChange={(value) => handleChange("allocatedPercent", value[0])}
                  min={0}
                  max={50}
                  step={0.1}
                  disabled={isReadOnly || isLocked("budgetAllocations")}
                  aria-labelledby={`share-${data.departmentId}`}
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
                  aria-labelledby={`share-${data.departmentId}`}
                  className={cn(INLINE_NUMBER, "pr-4 pl-1.5 text-right")}
                />
                <span className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2 text-xs font-semibold">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status badge + outflow */}
        <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-3 sm:justify-end lg:border-t-0 lg:pt-0">
          <Badge variant="outline" className={statusConfig.color}>
            <StatusIcon aria-hidden="true" />
            {statusConfig.label}
          </Badge>
          <div className="text-right">
            <div className="text-foreground font-mono text-xs font-semibold tabular-nums">
              {formatCurrency(data.allocatedAmount)}
            </div>
            <Eyebrow>Calculated outflow</Eyebrow>
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {!isCollapsed && (
        <div className="border-border/60 space-y-4 border-t px-4 pt-4 pb-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor={`budgetYear-${data.departmentId}`}
                  className="text-foreground text-xs font-semibold"
                >
                  Budget Cycle Year
                </Label>
                <Input
                  id={`budgetYear-${data.departmentId}`}
                  type="number"
                  value={data.budgetYear}
                  onChange={(e) =>
                    handleChange("budgetYear", parseInt(e.target.value) || currentBudgetYear())
                  }
                  disabled={isReadOnly}
                  min={BUDGET_YEAR_MIN}
                  max={BUDGET_YEAR_MAX}
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={`notes-${data.departmentId}`}
                  className="text-foreground text-xs font-semibold"
                >
                  Allocation Directives & Guidelines
                </Label>
                <Textarea
                  id={`notes-${data.departmentId}`}
                  value={data.notes || ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Input additional directives, spending limitations, or policy goals..."
                  disabled={isReadOnly}
                  rows={3}
                  className="resize-none text-xs"
                />
              </div>

              {!isReadOnly && (
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15].map((pct) => (
                    <Button
                      key={pct}
                      variant="outline"
                      size="xs"
                      onClick={() => handleChange("allocatedPercent", pct)}
                    >
                      Reset to {pct}%
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Utilization & context */}
            <div className="space-y-4">
              <div className="border-border/60 space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-foreground text-sm font-semibold">Budget utilization</h4>
                  <span className="text-foreground font-mono text-sm font-semibold tabular-nums">
                    {utilizationRate.toFixed(1)}%
                  </span>
                </div>

                <Progress value={utilizationRate} className="bg-muted h-2" />

                <dl className="border-border/60 grid grid-cols-3 gap-2 border-t pt-2 text-center">
                  {[
                    { label: "Allocated", value: data.allocatedAmount },
                    { label: "Utilized", value: data.allocatedAmount * 0.9 },
                    { label: "Remaining", value: data.allocatedAmount * 0.1 },
                  ].map((item) => (
                    <div key={item.label}>
                      <dd className="text-foreground font-mono text-xs font-semibold tabular-nums">
                        {formatNumber(item.value)}
                      </dd>
                      <dt>
                        <Eyebrow>{item.label}</Eyebrow>
                      </dt>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="space-y-2">
                <h4 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
                  <Calculator aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
                  Context analytics
                </h4>
                <dl className="border-border/60 divide-border/60 grid grid-cols-2 divide-x rounded-lg border">
                  <div className="flex flex-col justify-between p-3">
                    <dt>
                      <Eyebrow>Share of budget</Eyebrow>
                    </dt>
                    <dd className="text-foreground mt-2 font-mono text-base font-semibold tabular-nums">
                      {data.allocatedPercent.toFixed(1)}%
                    </dd>
                    <dd className="text-muted-foreground mt-1 text-xs leading-normal">
                      of {formatNumber(totalBudget)} total outflow
                    </dd>
                  </div>
                  <div className="flex flex-col justify-between p-3">
                    <dt>
                      <Eyebrow>Per capita cost</Eyebrow>
                    </dt>
                    <dd className="text-foreground mt-2 font-mono text-base font-semibold tabular-nums">
                      {formatNumber(data.allocatedAmount / 100000)}
                    </dd>
                    <dd className="text-muted-foreground mt-1 text-xs leading-normal">
                      estimated per citizen
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </FacetCard>
  );

  // Sub-departments are indented under their parent with a connector line.
  if (parentName) {
    return (
      <div className="border-border relative ml-2 border-l pl-6 md:ml-4 md:pl-8">
        <div
          aria-hidden="true"
          className="border-border absolute top-10 left-0 h-4 w-4 rounded-bl-lg border-b border-l"
        />
        {cardElement}
      </div>
    );
  }

  return cardElement;
}
