/**
 * Budget Allocation List Component
 *
 * List of budget allocations for each department
 */

import React from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { BudgetAllocationForm } from "~/components/government/atoms/BudgetAllocationForm";
import { BudgetMeter } from "./BudgetMeter";
import type { DepartmentInput, BudgetAllocationInput } from "~/types/government";
import type { BudgetSummary } from "~/lib/government-builder-validation";
import { IxTime } from "~/lib/ixtime";

export interface BudgetAllocationListProps {
  departments: DepartmentInput[];
  budgetAllocations: BudgetAllocationInput[];
  budgetSummary: BudgetSummary;
  totalBudget: number;
  currency: string;
  onUpdateAllocation: (index: number, allocation: BudgetAllocationInput) => void;
  onFixAllocations: () => void;
  isReadOnly?: boolean;
  budgetAllocationsCollapsed: Record<number, boolean>;
  onToggleCollapse: (index: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const BudgetAllocationList = React.memo(function BudgetAllocationList({
  departments,
  budgetAllocations,
  budgetSummary,
  totalBudget,
  currency,
  onUpdateAllocation,
  onFixAllocations,
  isReadOnly = false,
  budgetAllocationsCollapsed,
  onToggleCollapse,
  onExpandAll,
  onCollapseAll,
}: BudgetAllocationListProps) {
  if (departments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-2xl font-semibold">Budget Allocation</h2>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Add departments first before setting up budget allocations.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-2xl font-semibold">Budget Allocation</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExpandAll} className="text-xs">
            <ChevronDown className="mr-1 h-3 w-3" />
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={onCollapseAll} className="text-xs">
            <ChevronRight className="mr-1 h-3 w-3" />
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onFixAllocations}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            Fix Allocations
          </Button>
        </div>
      </div>

      <BudgetMeter budgetSummary={budgetSummary} />

      <div className="space-y-4">
        {departments.map((department, index) => {
          const existingAllocation = budgetAllocations.find(
            (a) => a.departmentId === index.toString()
          );
          const allocation: BudgetAllocationInput = existingAllocation || {
            departmentId: index.toString(),
            budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
            allocatedAmount: 0,
            allocatedPercent: 0,
            notes: "",
          };

          return (
            <BudgetAllocationForm
              key={index}
              data={allocation}
              onChange={(updated) => onUpdateAllocation(index, updated)}
              departmentName={department.name}
              departmentColor={department.color}
              totalBudget={totalBudget}
              currency={currency}
              isReadOnly={isReadOnly}
              isCollapsed={budgetAllocationsCollapsed[index] || false}
              onToggleCollapse={() => onToggleCollapse(index)}
            />
          );
        })}
      </div>
    </div>
  );
});
