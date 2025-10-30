"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Users, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";
import type { GovernmentDepartment } from "~/types/government";
import { formatCurrency, formatNumber } from "~/lib/format-utils";

interface DepartmentsListProps {
  departments: GovernmentDepartment[];
  budgetAllocations: Array<{ departmentId: string; allocatedAmount: number }>;
  totalBudget: number;
  currency: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openDepartments: Record<string, boolean>;
  onToggleDepartment: (id: string) => void;
  getDepartmentIcon: (category: string) => React.ReactNode;
}

const getBudgetStatus = (allocated: number, total: number) => {
  const percentage = total > 0 ? (allocated / total) * 100 : 0;
  if (percentage >= 95) return { status: "critical", color: "text-red-600", icon: AlertTriangle };
  if (percentage >= 85) return { status: "warning", color: "text-orange-600", icon: AlertTriangle };
  if (percentage >= 70) return { status: "good", color: "text-green-600", icon: CheckCircle };
  return { status: "low", color: "text-blue-600", icon: Info };
};

export function DepartmentsList({
  departments,
  budgetAllocations,
  totalBudget,
  currency,
  isOpen,
  onOpenChange,
  openDepartments,
  onToggleDepartment,
  getDepartmentIcon,
}: DepartmentsListProps) {
  if (departments.length === 0) return null;

  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currency);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Government Departments
                <Badge variant="secondary" className="ml-2">
                  {departments.length}
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
            <div className="space-y-3">
              {departments.map((department, index) => {
                const departmentBudget = budgetAllocations.find(
                  (a) => a.departmentId === department.id
                );
                const budgetAmount = departmentBudget?.allocatedAmount || 0;
                const budgetStatus = getBudgetStatus(budgetAmount, totalBudget);
                const isDeptOpen = openDepartments[department.id] || false;

                return (
                  <Collapsible
                    key={department.id}
                    open={isDeptOpen}
                    onOpenChange={() => onToggleDepartment(department.id)}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="overflow-hidden rounded-lg border"
                    >
                      <CollapsibleTrigger asChild>
                        <div className="hover:bg-muted/50 flex cursor-pointer items-center justify-between p-4 transition-colors">
                          <div className="flex items-center gap-3">
                            <div
                              className="rounded-lg p-2"
                              style={{ backgroundColor: department.color + "20" }}
                            >
                              {getDepartmentIcon(department.category)}
                            </div>
                            <div>
                              <h4 className="flex items-center gap-2 font-semibold">
                                {department.name}
                                {isDeptOpen ? (
                                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                                ) : (
                                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                                )}
                              </h4>
                              <p className="text-muted-foreground text-sm">{department.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrencyLocal(budgetAmount)}</p>
                            <div className="flex items-center justify-end gap-1">
                              <budgetStatus.icon className={`h-3 w-3 ${budgetStatus.color}`} />
                              <span className={`text-xs ${budgetStatus.color}`}>
                                {budgetAmount > 0 ? "Allocated" : "No Budget"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="bg-muted/20 space-y-3 border-t px-4 pb-4">
                          {department.description && (
                            <p className="text-muted-foreground pt-3 text-sm">
                              {department.description}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                            {department.minister && (
                              <div>
                                <span className="text-muted-foreground">Minister:</span>
                                <p className="font-medium">{department.minister}</p>
                              </div>
                            )}
                            {department.headquarters && (
                              <div>
                                <span className="text-muted-foreground">Headquarters:</span>
                                <p className="font-medium">{department.headquarters}</p>
                              </div>
                            )}
                            {department.employeeCount && (
                              <div>
                                <span className="text-muted-foreground">Employees:</span>
                                <p className="font-medium">
                                  {formatNumber(department.employeeCount)}
                                </p>
                              </div>
                            )}
                            {department.established && (
                              <div>
                                <span className="text-muted-foreground">Established:</span>
                                <p className="font-medium">{department.established}</p>
                              </div>
                            )}
                          </div>

                          {budgetAmount > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Budget Allocation</span>
                                <span>
                                  {((budgetAmount / totalBudget) * 100).toFixed(1)}% of total budget
                                </span>
                              </div>
                              <Progress
                                value={(budgetAmount / totalBudget) * 100}
                                className="h-2"
                              />
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </motion.div>
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
