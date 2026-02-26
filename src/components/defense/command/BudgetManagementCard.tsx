// src/components/defense/command/BudgetManagementCard.tsx
"use client";

import React from "react";
import {
  DollarSign,
  Users,
  Wrench,
  Package,
  Microscope,
  Building,
  Edit,
  Save,
  HelpCircle,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { type BudgetData, BUDGET_CATEGORIES } from "~/hooks/useDefenseBudget";

/** Map icon name strings to actual Lucide components */
const ICON_MAP = {
  Users,
  Wrench,
  Package,
  Microscope,
  Building,
} as const;

interface BudgetManagementCardProps {
  budgetData: BudgetData;
  editingBudget: boolean;
  setEditingBudget: (editing: boolean) => void;
  handleSaveBudget: () => void;
  handleTotalBudgetChange: (value: number) => void;
  handleCategoryChange: (key: string, value: number) => void;
  totalAllocated: number;
  allocationPercent: number;
  currentYear: number;
}

export const BudgetManagementCard = React.memo(function BudgetManagementCard({
  budgetData,
  editingBudget,
  setEditingBudget,
  handleSaveBudget,
  handleTotalBudgetChange,
  handleCategoryChange,
  allocationPercent,
  currentYear,
}: BudgetManagementCardProps) {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Defense Budget - FY {currentYear}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-green-600" />
                      Defense Budget Guide
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="mb-2 font-semibold">Budget Allocation</h4>
                      <p className="text-muted-foreground">
                        Your defense budget should total 100% allocated across
                        all categories. The system will warn you if you're over
                        or under budget.
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">
                        Budget Categories Explained
                      </h4>
                      <ul className="text-muted-foreground list-inside list-disc space-y-1">
                        <li>
                          <strong>Personnel (typically 35-45%):</strong>{" "}
                          Salaries, benefits, pensions for military and civilian
                          staff
                        </li>
                        <li>
                          <strong>Operations & Maintenance (25-35%):</strong>{" "}
                          Day-to-day operations, training exercises, facility
                          upkeep
                        </li>
                        <li>
                          <strong>Procurement (10-20%):</strong> Purchase of new
                          equipment, vehicles, ships, aircraft, and weapons
                        </li>
                        <li>
                          <strong>R&D (5-15%):</strong> Research and development
                          of next-generation military technology
                        </li>
                        <li>
                          <strong>Military Construction (3-8%):</strong> Building
                          and upgrading bases, installations, and infrastructure
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">GDP Percentage</h4>
                      <p className="text-muted-foreground">
                        Typical defense spending ranges from 1-4% of GDP. Higher
                        percentages indicate a strong military focus, while lower
                        percentages suggest prioritizing other sectors.
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold">Tips</h4>
                      <ul className="text-muted-foreground list-inside list-disc space-y-1">
                        <li>
                          Balance current needs (personnel, operations) with
                          future capabilities (procurement, R&D)
                        </li>
                        <li>
                          Changing total budget maintains proportional
                          allocations automatically
                        </li>
                        <li>
                          Monitor branch budgets to ensure they sum to your total
                          defense budget
                        </li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription>
              Allocate resources across defense categories
            </CardDescription>
          </div>
          {editingBudget ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingBudget(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveBudget}>
                <Save className="mr-2 h-4 w-4" />
                Save Budget
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setEditingBudget(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Budget
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Budget */}
        <div className="bg-muted/50 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm">
                Total Defense Budget
              </Label>
              {editingBudget ? (
                <Input
                  type="number"
                  value={budgetData.totalBudget}
                  onChange={(e) =>
                    handleTotalBudgetChange(parseFloat(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              ) : (
                <div className="mt-1 text-2xl font-bold">
                  $
                  <NumberFlowDisplay
                    value={budgetData.totalBudget}
                    format="compact"
                  />
                </div>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">% of GDP</Label>
              <div className="mt-1 text-2xl font-bold">
                <NumberFlowDisplay
                  value={budgetData.gdpPercent}
                  format="percentage"
                  decimalPlaces={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Budget Allocation Progress */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm">Budget Allocation</Label>
            <span
              className={cn(
                "text-sm font-medium",
                allocationPercent > 100
                  ? "text-red-600"
                  : allocationPercent < 95
                    ? "text-orange-600"
                    : "text-green-600",
              )}
            >
              <NumberFlowDisplay
                value={allocationPercent}
                format="percentage"
                decimalPlaces={1}
              />{" "}
              Allocated
            </span>
          </div>
          <Progress value={Math.min(allocationPercent, 100)} className="h-2" />
          {allocationPercent > 100 && (
            <p className="mt-1 text-xs text-red-600">
              Over budget! Reduce allocations.
            </p>
          )}
        </div>

        <Separator />

        {/* Category Allocations */}
        <div className="space-y-4">
          {BUDGET_CATEGORIES.map((category) => {
            const Icon = ICON_MAP[category.iconName];
            const value = budgetData[
              category.key as keyof BudgetData
            ] as number;
            const percent =
              budgetData.totalBudget > 0
                ? (value / budgetData.totalBudget) * 100
                : 0;

            return (
              <div key={category.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", category.color)} />
                    <Label className="text-sm">{category.label}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-12 text-right text-xs">
                      <NumberFlowDisplay
                        value={percent}
                        format="percentage"
                        decimalPlaces={1}
                      />
                    </span>
                    {editingBudget ? (
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          handleCategoryChange(
                            category.key,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="h-8 w-32 text-sm"
                      />
                    ) : (
                      <span className="w-32 text-right text-sm font-medium">
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
