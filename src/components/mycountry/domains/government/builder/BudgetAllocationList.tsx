"use client";
/**
 * Budget Allocation List Component (Refactored)
 *
 * List of budget allocations with soft warnings for underfunded vital services.
 */

import React, { useMemo } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  WarningTriangle as AlertTriangle,
  CheckCircle,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import { BudgetAllocationForm } from "~/components/mycountry/domains/government/atoms/BudgetAllocationForm";
import { BudgetMeter } from "./BudgetMeter";
import type { DepartmentInput, BudgetAllocationInput } from "~/types/government";
import type { BudgetSummary } from "~/lib/government/builder-validation";
import { currentBudgetYear } from "~/lib/government/budget-year";

interface BudgetAllocationListProps {
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
          <h3 className="text-label text-title-2">Budget allocation</h3>
        </div>
        <Alert>
          <AlertTriangle className="text-yellow h-4 w-4" />
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
          <h3 className="text-label text-title-2">Budget allocation</h3>
          <p className="text-label-secondary text-footnote mt-1">
            Distribute funding across active ministries and manage fiscal limits
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="outline" size="sm" onClick={onExpandAll}>
            <ChevronDown className="h-3.5 w-3.5" />
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={onCollapseAll}>
            <ChevronRight className="h-3.5 w-3.5" />
            Collapse all
          </Button>
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={onFixAllocations}>
              <CheckCircle className="text-yellow h-3.5 w-3.5" />
              Fix allocations
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
              role="status"
              className="text-label rounded-control border-yellow/40 text-footnote flex items-start gap-2 border p-3"
            >
              <AlertTriangle aria-hidden="true" className="text-yellow mt-0.5 h-4 w-4 shrink-0" />
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
            budgetYear: currentBudgetYear(),
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
