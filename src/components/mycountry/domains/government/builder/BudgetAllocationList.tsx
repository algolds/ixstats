/**
 * Budget Allocation List Component (Refactored)
 *
 * List of budget allocations with soft warnings for underfunded vital services.
 */

"use client";

import React, { useMemo } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
// eslint-disable-next-line unused-imports/no-unused-imports
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { BudgetAllocationForm } from "~/components/mycountry/domains/government/atoms/BudgetAllocationForm";
import { BudgetMeter } from "./BudgetMeter";
import type { DepartmentInput, BudgetAllocationInput } from "~/types/government";
import type { BudgetSummary } from "~/lib/government/builder-validation";
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
  // Compute soft warnings for vital departments allocated <5%
  const vitalWarnings = useMemo(() => {
    const list: string[] = [];
    departments.forEach((dept, index) => {
      if (["Defense", "Health", "Education"].includes(dept.category)) {
        const alloc = budgetAllocations.find((a) => a.departmentId === index.toString());
        const pct = alloc ? alloc.allocatedPercent : 0;
        if (pct < 5) {
          list.push(
            `Low funding alert for "${dept.name}" (${pct.toFixed(1)}%). Setting a budget below 5% for core ${dept.category.toLowerCase()} services will depress legitimacy and administrative efficiency.`
          );
        }
      }
    });
    return list;
  }, [departments, budgetAllocations]);

  if (departments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Budget Allocation
          </h2>
        </div>
        <Alert className="border-zinc-200 bg-zinc-100/40 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-300">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription>
            Add departments first in the Administration tab before setting up budget allocations.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Budget Allocation
          </h2>
          <p className="text-zinc-550 mt-1 text-xs dark:text-zinc-400">
            Distribute funding across active ministries and manage fiscal limits
          </p>
        </div>
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onExpandAll}
            className="h-8 border-zinc-200 bg-white text-xs text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/5"
          >
            <ChevronDown className="mr-1 h-3 w-3" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCollapseAll}
            className="h-8 border-zinc-200 bg-white text-xs text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/5"
          >
            <ChevronRight className="mr-1 h-3.5 w-3.5" />
            Collapse All
          </Button>
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFixAllocations}
              className="h-8 border-amber-500/30 text-xs text-amber-400 hover:bg-amber-500/10"
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              Fix Allocations
            </Button>
          )}
        </div>
      </div>

      <BudgetMeter budgetSummary={budgetSummary} />

      {/* Vital service warnings list */}
      {vitalWarnings.length > 0 && (
        <div className="space-y-2">
          {vitalWarnings.map((warning, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="leading-relaxed">{warning}</div>
            </div>
          ))}
        </div>
      )}

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

          const parentDept = department.parentDepartmentId
            ? departments[parseInt(department.parentDepartmentId)]
            : null;

          return (
            <BudgetAllocationForm
              key={index}
              data={allocation}
              onChange={(updated) => onUpdateAllocation(index, updated)}
              departmentName={department.name}
              departmentColor={department.color}
              parentName={parentDept ? parentDept.name : undefined}
              parentColor={parentDept ? parentDept.color : undefined}
              totalBudget={totalBudget}
              currency={currency}
              isReadOnly={isReadOnly}
              isCollapsed={budgetAllocationsCollapsed[index] !== false}
              onToggleCollapse={() => onToggleCollapse(index)}
            />
          );
        })}
      </div>
    </div>
  );
});
