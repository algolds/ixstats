"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import type { GovernmentDepartment, BudgetAllocation } from "~/types/government";

interface BudgetDepartmentItem {
  department: GovernmentDepartment;
  allocation: BudgetAllocation;
}

interface BudgetDepartmentListProps {
  departments: BudgetDepartmentItem[];
  formatNumber: (num: number) => string;
}

export function BudgetDepartmentList({
  departments,
  formatNumber,
}: BudgetDepartmentListProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {departments.map(({ department, allocation }) => {
        const allocatedAmount = allocation.allocatedAmount ?? 0;
        const spentAmount = allocation.spentAmount ?? 0;
        const availableAmount = allocation.availableAmount ?? 0;
        const allocatedPercent = allocation.allocatedPercent ?? 0;
        const utilizationRate =
          allocatedAmount > 0 ? (spentAmount / allocatedAmount) * 100 : 0;

        return (
          <FacetCard
            key={department.id}
            depth={1}
            className="bg-card/40 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-3.5 w-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: department.color ?? "#6b7280" }}
                />
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    {department.name}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {department.category} • {department.ministerTitle}:{" "}
                    {department.minister || "Vacant"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                  {formatNumber(allocatedAmount)}
                </p>
                <p className="text-muted-foreground font-mono text-xs tabular-nums">
                  {allocatedPercent.toFixed(1)}% of budget
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Budget Utilization
                </span>
                <span className="text-foreground font-mono font-semibold tabular-nums">
                  {utilizationRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={utilizationRate} className="h-1.5" />
              <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                <div className="bg-muted/15 border-border/20 rounded-lg border p-2">
                  <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                    Allocated
                  </p>
                  <p className="text-foreground mt-0.5 font-mono font-semibold tabular-nums">
                    {formatNumber(allocatedAmount)}
                  </p>
                </div>
                <div className="bg-muted/15 border-border/20 rounded-lg border p-2">
                  <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                    Spent
                  </p>
                  <p className="mt-0.5 font-mono font-semibold text-amber-400 tabular-nums">
                    {formatNumber(spentAmount)}
                  </p>
                </div>
                <div className="bg-muted/15 border-border/20 rounded-lg border p-2">
                  <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                    Remaining
                  </p>
                  <p className="mt-0.5 font-mono font-semibold text-cyan-400 tabular-nums">
                    {formatNumber(availableAmount)}
                  </p>
                </div>
              </div>
            </div>
          </FacetCard>
        );
      })}
    </div>
  );
}
