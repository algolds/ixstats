"use client";

import React from "react";
import type { GovernmentDepartment, BudgetAllocation } from "~/types/government";
import { Card } from "~/components/ui/card";
import type { BudgetEditing } from "~/hooks/useBudgetEditing";
import {
  AddDepartmentForm,
  AllocationEditor,
  RemoveDepartmentButton,
} from "./BudgetDepartmentEditor";

interface BudgetDepartmentItem {
  department: GovernmentDepartment;
  allocation: BudgetAllocation | null;
}

interface BudgetDepartmentListProps {
  departments: BudgetDepartmentItem[];
  year: number;
  formatNumber: (num: number) => string;
  /** The owner's edits; read-only without it. */
  editing?: BudgetEditing;
}

function DepartmentHeader({ department }: { department: GovernmentDepartment }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* The department's own colour (user data) identifies it across the charts. */}
      <span
        aria-hidden="true"
        className="border-separator h-3 w-3 shrink-0 rounded-full border"
        style={{ backgroundColor: department.color ?? "var(--color-label-secondary)" }}
      />
      <div className="min-w-0">
        <h3 className="text-label text-headline truncate">{department.name}</h3>
        <p className="text-label-secondary text-footnote truncate">
          {department.category} • {department.ministerTitle}: {department.minister || "Vacant"}
        </p>
      </div>
    </div>
  );
}

/**
 * Every department with its share of the year's budget. Spending is not recorded yet, so there is
 * no utilization or remaining figure.
 */
export function BudgetDepartmentList({
  departments,
  year,
  formatNumber,
  editing,
}: BudgetDepartmentListProps) {
  if (departments.length === 0) {
    return (
      <div className="text-label-secondary border-separator rounded-row text-footnote flex flex-col items-center gap-3 border border-dashed py-8 text-center">
        <p>No departments yet.</p>
        {editing && <AddDepartmentForm editing={editing} />}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {departments.map(({ department, allocation }) => (
        <Card key={department.id} className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <DepartmentHeader department={department} />
            <div className="flex shrink-0 items-center gap-2">
              {allocation && (
                <div className="text-right">
                  <p className="text-label text-title-3 tabular-nums">
                    {formatNumber(allocation.allocatedAmount ?? 0)}
                  </p>
                  <p className="text-label-secondary text-footnote tabular-nums">
                    {(allocation.allocatedPercent ?? 0).toFixed(1)}% of budget
                  </p>
                </div>
              )}
              {editing && (
                <RemoveDepartmentButton
                  departmentId={department.id}
                  departmentName={department.name}
                  editing={editing}
                />
              )}
            </div>
          </div>

          {editing ? (
            <AllocationEditor
              key={`${department.id}-${allocation?.allocatedPercent ?? 0}`}
              departmentId={department.id}
              departmentName={department.name}
              percent={allocation?.allocatedPercent ?? 0}
              editing={editing}
              formatNumber={formatNumber}
            />
          ) : (
            !allocation && (
              <p className="text-label-secondary text-footnote">No allocation for {year}.</p>
            )
          )}
        </Card>
      ))}
      {editing && <AddDepartmentForm editing={editing} />}
    </div>
  );
}
