"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { PieChart, ChevronDown, ChevronRight } from "lucide-react";
import type { BudgetAllocation, GovernmentDepartment } from "~/types/government";
import { formatCurrency } from "~/lib/format-utils";

interface BudgetAllocationListProps {
  allocations: BudgetAllocation[];
  departments: GovernmentDepartment[];
  totalBudget: number;
  currency: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openAllocations: Record<string, boolean>;
  onToggleAllocation: (id: string) => void;
}

export function BudgetAllocationList({
  allocations,
  departments,
  totalBudget,
  currency,
  isOpen,
  onOpenChange,
  openAllocations,
  onToggleAllocation,
}: BudgetAllocationListProps) {
  if (allocations.length === 0) return null;

  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currency);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Budget Allocations Breakdown
                <Badge variant="secondary" className="ml-2">
                  {allocations.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="text-muted-foreground h-5 w-5 transition-transform" />
              ) : (
                <ChevronRight className="text-muted-foreground h-5 w-5 transition-transform" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-2">
              {allocations
                .sort((a, b) => b.allocatedAmount - a.allocatedAmount)
                .map((allocation) => {
                  const department = departments.find((d) => d.id === allocation.departmentId);
                  if (!department) return null;

                  const percentage = (allocation.allocatedAmount / totalBudget) * 100;
                  const isAllocOpen = openAllocations[allocation.id] || false;

                  return (
                    <Collapsible
                      key={allocation.id}
                      open={isAllocOpen}
                      onOpenChange={() => onToggleAllocation(allocation.id)}
                    >
                      <div className="overflow-hidden rounded-lg border">
                        <CollapsibleTrigger asChild>
                          <div className="hover:bg-muted/50 flex cursor-pointer items-center justify-between p-3 transition-colors">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: department.color }}
                              />
                              <span className="font-medium">{department.name}</span>
                              {isAllocOpen ? (
                                <ChevronDown className="text-muted-foreground ml-1 h-3 w-3" />
                              ) : (
                                <ChevronRight className="text-muted-foreground ml-1 h-3 w-3" />
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">
                                {formatCurrencyLocal(allocation.allocatedAmount)}
                              </span>
                              <span className="text-muted-foreground ml-2 text-sm">
                                ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="bg-muted/20 border-t px-3 pb-3">
                            <div className="space-y-2 pt-3">
                              <Progress value={percentage} className="h-2" />
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Department ID:</span>
                                  <p className="font-medium">{allocation.departmentId}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Allocation ID:</span>
                                  <p className="truncate text-xs font-medium">{allocation.id}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Percentage:</span>
                                  <p className="font-medium">
                                    {allocation.allocatedPercent?.toFixed(2)}%
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Amount:</span>
                                  <p className="font-medium">
                                    {formatCurrencyLocal(allocation.allocatedAmount)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
