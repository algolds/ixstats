"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import type { GovernmentDepartment, BudgetAllocation } from "~/types/government";
import { Eyebrow } from "~/components/ui/eyebrow";

interface BudgetDepartmentItem {
  department: GovernmentDepartment;
  allocation: BudgetAllocation;
}

interface BudgetDepartmentListProps {
  departments: BudgetDepartmentItem[];
  formatNumber: (num: number) => string;
}

export function BudgetDepartmentList({ departments, formatNumber }: BudgetDepartmentListProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {departments.map(({ department, allocation }) => {
        const allocatedAmount = allocation.allocatedAmount ?? 0;
        const spentAmount = allocation.spentAmount ?? 0;
        const availableAmount = allocation.availableAmount ?? 0;
        const allocatedPercent = allocation.allocatedPercent ?? 0;
        const utilizationRate = allocatedAmount > 0 ? (spentAmount / allocatedAmount) * 100 : 0;

        return (
          <FacetCard key={department.id} depth={1} surface="solid" className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {/* The department's own colour (user data) identifies it across the charts. */}
                <span
                  aria-hidden="true"
                  className="border-border h-3 w-3 shrink-0 rounded-full border"
                  style={{
                    backgroundColor: department.color ?? "var(--color-muted-foreground)",
                  }}
                />
                <div className="min-w-0">
                  <h3 className="text-foreground truncate text-sm font-semibold">
                    {department.name}
                  </h3>
                  <p className="text-muted-foreground truncate text-xs">
                    {department.category} • {department.ministerTitle}:{" "}
                    {department.minister || "Vacant"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-foreground font-mono text-base font-semibold tabular-nums">
                  {formatNumber(allocatedAmount)}
                </p>
                <p className="text-muted-foreground font-mono text-xs tabular-nums">
                  {allocatedPercent.toFixed(1)}% of budget
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Budget Utilization</span>
                <span className="text-foreground font-mono font-semibold tabular-nums">
                  {utilizationRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={utilizationRate} className="h-1.5" />
              <dl className="grid grid-cols-3 gap-3 pt-1 text-xs">
                {[
                  { label: "Allocated", value: allocatedAmount },
                  { label: "Spent", value: spentAmount },
                  { label: "Remaining", value: availableAmount },
                ].map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt>
                      <Eyebrow>{item.label}</Eyebrow>
                    </dt>
                    <dd className="text-foreground mt-0.5 truncate font-mono font-semibold tabular-nums">
                      {formatNumber(item.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </FacetCard>
        );
      })}
    </div>
  );
}
