"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { Users, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GovernmentDepartment } from '~/types/government';
import { formatCurrency, formatNumber } from '~/lib/format-utils';

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
  if (percentage >= 95) return { status: 'critical', color: 'text-red-600', icon: AlertTriangle };
  if (percentage >= 85) return { status: 'warning', color: 'text-orange-600', icon: AlertTriangle };
  if (percentage >= 70) return { status: 'good', color: 'text-green-600', icon: CheckCircle };
  return { status: 'low', color: 'text-blue-600', icon: Info };
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
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Government Departments
                <Badge variant="secondary" className="ml-2">
                  {departments.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-3">
              {departments.map((department, index) => {
                const departmentBudget = budgetAllocations.find(a => a.departmentId === department.id);
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
                      className="border rounded-lg overflow-hidden"
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: department.color + '20' }}>
                              {getDepartmentIcon(department.category)}
                            </div>
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                {department.name}
                                {isDeptOpen ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground">{department.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrencyLocal(budgetAmount)}</p>
                            <div className="flex items-center gap-1 justify-end">
                              <budgetStatus.icon className={`h-3 w-3 ${budgetStatus.color}`} />
                              <span className={`text-xs ${budgetStatus.color}`}>
                                {budgetAmount > 0 ? 'Allocated' : 'No Budget'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
                          {department.description && (
                            <p className="text-sm text-muted-foreground pt-3">{department.description}</p>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                                <p className="font-medium">{formatNumber(department.employeeCount)}</p>
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
                                <span>{((budgetAmount / totalBudget) * 100).toFixed(1)}% of total budget</span>
                              </div>
                              <Progress value={(budgetAmount / totalBudget) * 100} className="h-2" />
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
