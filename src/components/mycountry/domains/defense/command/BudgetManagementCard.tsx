"use client";
// src/components/defense/command/BudgetManagementCard.tsx

import React from "react";
import {
  Dollar as DollarSign,
  Group as Users,
  Wrench,
  Package,
  Microscope,
  Building,
  EditPencil as Edit,
  FloppyDisk as Save,
  HelpCircle,
  InfoCircle as Info,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { type BudgetData, BUDGET_CATEGORIES } from "~/hooks/useDefenseBudget";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import {
  formatAmountInput,
  parseAmountInput,
  type DefenseBudgetCategoryKey,
} from "~/lib/military/defense-budget";

/** Map icon name strings to iconoir components */
const ICON_MAP = {
  Users,
  Wrench,
  Package,
  Microscope,
  Building,
} as const;

interface BudgetManagementCardProps {
  budgetData: BudgetData;
  /** True when no budget is saved yet and the figures are the 2% of GDP estimate. */
  isEstimate: boolean;
  isSaving: boolean;
  editingBudget: boolean;
  setEditingBudget: (editing: boolean) => void;
  handleSaveBudget: () => void;
  handleTotalBudgetChange: (value: number) => void;
  handleCategoryChange: (key: DefenseBudgetCategoryKey, value: number) => void;
  allocationPercent: number;
}

/** A whole-currency amount, shown with separators ("5,668,857,676") while it is edited. */
function AmountInput({
  value,
  onChange,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={formatAmountInput(value)}
      onChange={(e) => onChange(parseAmountInput(e.target.value))}
      className={cn("tabular-nums", className)}
    />
  );
}

export const BudgetManagementCard = React.memo(function BudgetManagementCard({
  budgetData,
  isEstimate,
  isSaving,
  editingBudget,
  setEditingBudget,
  handleSaveBudget,
  handleTotalBudgetChange,
  handleCategoryChange,
  allocationPercent,
}: BudgetManagementCardProps) {
  // The free Defense preview shows the budget read-only.
  const { canEdit } = useCanEdit();
  return (
    <Card>
      <CardHeader className="p-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DollarSign aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
              <h3 className="text-label text-title-3">Defense budget</h3>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="About the defense budget"
                  >
                    <HelpCircle className="text-label-secondary h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent size="wide" className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Info aria-hidden="true" className="text-label-secondary h-5 w-5" />
                      Defense budget guide
                    </SheetTitle>
                  </SheetHeader>
                  <div className="text-body space-y-4">
                    <div>
                      <h4 className="mb-2 font-semibold">Budget allocation</h4>
                      <p className="text-label-secondary">
                        Your defense budget should total 100% allocated across all categories. The
                        system will warn you if you're over or under budget.
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Budget categories explained</h4>
                      <ul className="text-label-secondary list-inside list-disc space-y-1">
                        <li>
                          <strong>Personnel (typically 35-45%):</strong> Salaries, benefits,
                          pensions for military and civilian staff
                        </li>
                        <li>
                          <strong>Operations & Maintenance (25-35%):</strong> Day-to-day operations,
                          training exercises, facility upkeep
                        </li>
                        <li>
                          <strong>Procurement (10-20%):</strong> Purchase of new equipment,
                          vehicles, ships, aircraft, and weapons
                        </li>
                        <li>
                          <strong>R&D (5-15%):</strong> Research and development of next-generation
                          military technology
                        </li>
                        <li>
                          <strong>Military Construction (3-8%):</strong> Building and upgrading
                          bases, installations, and infrastructure
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">GDP percentage</h4>
                      <p className="text-label-secondary">
                        Typical defense spending ranges from 1-4% of GDP. Higher percentages
                        indicate a strong military focus, while lower percentages suggest
                        prioritizing other sectors.
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Tips</h4>
                      <ul className="text-label-secondary list-inside list-disc space-y-1">
                        <li>
                          Balance current needs (personnel, operations) with future capabilities
                          (procurement, R&D)
                        </li>
                        <li>
                          Changing total budget maintains proportional allocations automatically
                        </li>
                        <li>
                          Monitor branch budgets to ensure they sum to your total defense budget
                        </li>
                      </ul>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <p className="text-label-secondary text-body mt-1">
              {isEstimate
                ? "Estimate: 2% of GDP split by typical shares. Save a budget to set your own."
                : "Allocate resources across defense categories"}
            </p>
          </div>
          {canEdit &&
            (editingBudget ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingBudget(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveBudget} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving…" : "Save budget"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingBudget(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit budget
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-5 pb-5">
        <div className="border-separator rounded-control border p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Eyebrow className="block">
                {isEstimate ? "Estimated defense budget" : "Total defense budget"}
              </Eyebrow>
              {editingBudget && canEdit ? (
                <AmountInput
                  label="Total defense budget"
                  value={budgetData.totalBudget}
                  onChange={handleTotalBudgetChange}
                  className="mt-1"
                />
              ) : (
                <div className="text-title-1 mt-1 tabular-nums">
                  $
                  <NumberFlowDisplay value={budgetData.totalBudget} format="compact" />
                </div>
              )}
            </div>
            <div>
              <span className="text-caption text-label-secondary block">% of GDP</span>
              <div className="text-title-1 mt-1 tabular-nums">
                <NumberFlowDisplay
                  value={budgetData.gdpPercent}
                  format="percentage"
                  decimalPlaces={2}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-body">Budget allocation</Label>
            <span
              className={cn(
                "text-body font-medium",
                allocationPercent > 100
                  ? "text-destructive"
                  : allocationPercent < 95
                    ? "text-yellow"
                    : "text-green"
              )}
            >
              <NumberFlowDisplay value={allocationPercent} format="percentage" decimalPlaces={1} />{" "}
              Allocated
            </span>
          </div>
          <Progress value={Math.min(allocationPercent, 100)} className="h-2" />
          {allocationPercent > 100 && (
            <p className="text-destructive text-footnote mt-1">Over budget! Reduce allocations.</p>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          {BUDGET_CATEGORIES.map((category) => {
            const Icon = ICON_MAP[category.iconName];
            const value = budgetData[category.key];
            const percent = budgetData.totalBudget > 0 ? (value / budgetData.totalBudget) * 100 : 0;

            return (
              <div key={category.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="text-label-secondary h-4 w-4" />
                    <Label className="text-body">{category.label}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-label-secondary text-footnote w-12 text-right">
                      <NumberFlowDisplay value={percent} format="percentage" decimalPlaces={1} />
                    </span>
                    {editingBudget && canEdit ? (
                      <AmountInput
                        label={category.label}
                        value={value}
                        onChange={(v) => handleCategoryChange(category.key, v)}
                        className="text-body h-8 w-36"
                      />
                    ) : (
                      <span className="text-body w-32 text-right font-medium">
                        $<NumberFlowDisplay value={value} format="compact" />
                      </span>
                    )}
                  </div>
                </div>
                <Progress value={percent} className="h-1" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
