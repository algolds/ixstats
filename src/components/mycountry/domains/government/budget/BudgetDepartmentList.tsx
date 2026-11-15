"use client";

import React from "react";
import type { GovernmentDepartment, BudgetAllocation } from "~/types/government";
import { Card } from "~/components/ui/card";
import { FACET_CHART_COLORS } from "~/components/ui/chart";
import { EmptyState } from "~/components/ui/empty-state";
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

function DepartmentHeader({
  department,
  index,
}: {
  department: GovernmentDepartment;
  index: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: FACET_CHART_COLORS[index % FACET_CHART_COLORS.length] }}
      />
      <div className="min-w-0">
        <h3 className="text-label text-headline truncate">{department.name}</h3>
        <p className="text-label-secondary text-footnote truncate">
          {department.category} · {department.ministerTitle}: {department.minister || "Vacant"}
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
      <Card>
        <EmptyState
          compact
          title="No departments yet."
          action={editing ? <AddDepartmentForm editing={editing} /> : undefined}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card content="data" padding="none">
        <div className="divide-separator/60 divide-y">
          {departments.map(({ department, allocation }, index) => (
            <div key={department.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <DepartmentHeader department={department} index={index} />
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
            </div>
          ))}
        </div>
      </Card>
      {editing && <AddDepartmentForm editing={editing} />}
    </div>
  );
}
