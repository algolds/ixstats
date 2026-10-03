"use client";

import { formatExactCurrency, formatNumber } from "~/lib/utils";
import { usePendingLocks } from "~/hooks/usePendingLocks";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { cn } from "~/lib/utils";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Textarea } from "~/components/ui/textarea";
import {
  Calculator,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { BUDGET_YEAR_MAX, BUDGET_YEAR_MIN } from "~/types/government";
import type { BudgetAllocationInput } from "~/types/government";
import { Card } from "~/components/ui/card";

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

/** Compact inline number field used in the allocation header row. */
const INLINE_NUMBER =
  "border-separator bg-surface text-label focus-visible:ring-tint w-full rounded-control-sm border py-1 text-caption font-semibold tabular-nums outline-none focus-visible:ring-2 disabled:opacity-50";

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

  const handleChange = <K extends keyof BudgetAllocationInput>(
    field: K,
    value: BudgetAllocationInput[K]
  ) => {
    const updatedData: BudgetAllocationInput = { ...data };
    updatedData[field] = value;

    // Keep amount and percentage in step with each other.
    if (field === "allocatedAmount" && totalBudget > 0) {
      updatedData.allocatedPercent =
        Math.round((updatedData.allocatedAmount / totalBudget) * 100 * 1000) / 1000;
    }
    if (field === "allocatedPercent") {
      updatedData.allocatedAmount = Math.round((totalBudget * updatedData.allocatedPercent) / 100);
    }

    onChange(updatedData);
  };

  const formatCurrency = (amount: number) => formatExactCurrency(amount, currency);

  const cardElement = (
    <Card className={cn("overflow-hidden", !isCollapsed && "border-separator-opaque")}>
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${departmentName}`}
              className="text-label-secondary h-8 w-8"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}

          <div className="flex items-center gap-2">
            {/* The department's own colour (user data) identifies it across the budget views. */}
            <span
              aria-hidden="true"
              className="border-separator h-3 w-3 shrink-0 rounded-full border"
              style={{ backgroundColor: departmentColor }}
            />
            <div className="flex flex-col">
              <span className="text-label text-headline flex flex-wrap items-center gap-2">
                {departmentName}
                {parentName && <Badge variant="outline">Sub of {parentName}</Badge>}
              </span>
              <span className="text-label-secondary text-footnote">
                {data.allocatedAmount > 0 ? "Funded" : "Unfunded"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:mr-4 lg:ml-auto">
          <label className="flex items-center gap-2">
            <Eyebrow>Amount</Eyebrow>
            <span className="relative w-36 sm:w-40">
              <span className="text-label-secondary text-caption absolute top-1/2 left-3 -translate-y-1/2 font-semibold">
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
                  className={cn(INLINE_NUMBER, "pr-4 pl-2 text-right")}
                />
                <span className="text-label-secondary text-caption absolute top-1/2 right-1 -translate-y-1/2 font-semibold">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-separator flex items-center justify-between gap-3 border-t pt-3 sm:justify-end lg:border-t-0 lg:pt-0">
          <div className="text-right">
            <div className="text-label text-caption font-semibold tabular-nums">
              {formatCurrency(data.allocatedAmount)}
            </div>
            <span className="text-stat-label text-label-secondary">Calculated outflow</span>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-separator space-y-4 border-t px-4 pt-4 pb-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor={`budgetYear-${data.departmentId}`}
                  className="text-label text-caption font-semibold"
                >
                  Budget cycle year
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

              <div className="space-y-2">
                <Label
                  htmlFor={`notes-${data.departmentId}`}
                  className="text-label text-caption font-semibold"
                >
                  Allocation Directives & guidelines
                </Label>
                <Textarea
                  id={`notes-${data.departmentId}`}
                  value={data.notes || ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Input additional directives, spending limitations, or policy goals..."
                  disabled={isReadOnly}
                  rows={3}
                  className="text-footnote resize-none"
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

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-label text-headline flex items-center gap-2">
                  <Calculator aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
                  Context analytics
                </h4>
                <dl className="border-separator divide-separator rounded-control grid grid-cols-1 border">
                  <div className="flex flex-col justify-between p-3">
                    <dt>
                      <span className="text-stat-label text-label-secondary">Share of budget</span>
                    </dt>
                    <dd className="text-label text-title-3 mt-2 tabular-nums">
                      {data.allocatedPercent.toFixed(1)}%
                    </dd>
                    <dd className="text-label-secondary text-footnote mt-1 leading-normal">
                      of {formatNumber(totalBudget)} total outflow
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );

  // Sub-departments are indented under their parent with a connector line.
  if (parentName) {
    return (
      <div className="border-separator relative ml-2 border-l pl-6 md:ml-4 md:pl-8">
        <div
          aria-hidden="true"
          className="border-separator rounded-bl-control absolute top-10 left-0 h-4 w-4 border-b border-l"
        />
        {cardElement}
      </div>
    );
  }

  return cardElement;
}
