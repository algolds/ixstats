"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import {
  Building2,
  Crown,
  Users,
  DollarSign,
  Scale,
  Gavel,
  Landmark,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  MapPin,
  User,
  Briefcase,
  Receipt,
  PieChart,
  BarChart3,
  Eye,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { GovernmentStructure, GovernmentDepartment, BudgetAllocation, RevenueSource, GovernmentBuilderState } from '~/types/government';
import { ComponentType, ATOMIC_COMPONENTS } from '~/components/government/atoms/AtomicGovernmentComponents';
import { cn } from '~/lib/utils';
import { formatCurrency, formatNumber, formatPercent } from '~/lib/format-utils';

interface GovernmentStructurePreviewProps {
  governmentStructure: GovernmentStructure | GovernmentBuilderState | null;
  governmentComponents: ComponentType[];
  className?: string;
}

export function GovernmentStructurePreview({
  governmentStructure,
  governmentComponents,
  className
}: GovernmentStructurePreviewProps) {
  // Collapsible state management for main sections (all collapsed by default)
  const [isComponentsOpen, setIsComponentsOpen] = useState(false);
  const [isDepartmentsOpen, setIsDepartmentsOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isRevenueOpen, setIsRevenueOpen] = useState(false);

  // Collapsible state for individual items (using Record<id, boolean>)
  const [openDepartments, setOpenDepartments] = useState<Record<string, boolean>>({});
  const [openAllocations, setOpenAllocations] = useState<Record<string, boolean>>({});
  const [openRevenues, setOpenRevenues] = useState<Record<string, boolean>>({});

  // Expand/collapse all functionality
  const expandAll = () => {
    setIsComponentsOpen(true);
    setIsDepartmentsOpen(true);
    setIsBudgetOpen(true);
    setIsRevenueOpen(true);
  };

  const collapseAll = () => {
    setIsComponentsOpen(false);
    setIsDepartmentsOpen(false);
    setIsBudgetOpen(false);
    setIsRevenueOpen(false);
    // Also collapse all individual items
    setOpenDepartments({});
    setOpenAllocations({});
    setOpenRevenues({});
  };

  const allExpanded = isComponentsOpen && isDepartmentsOpen && isBudgetOpen && isRevenueOpen;

  // Toggle functions for individual items
  const toggleDepartment = (id: string) => {
    setOpenDepartments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllocation = (id: string) => {
    setOpenAllocations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRevenue = (id: string) => {
    setOpenRevenues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper function to normalize government structure data
  const normalizeGovernmentStructure = (data: GovernmentStructure | GovernmentBuilderState | null): GovernmentStructure | null => {
    if (!data) return null;
    
    // If it's already a GovernmentStructure, return as is
    if ('id' in data && 'countryId' in data && 'governmentName' in data) {
      return data as GovernmentStructure;
    }
    
    // If it's a GovernmentBuilderState, convert it
    const builderState = data as GovernmentBuilderState;
    return {
      id: 'preview',
      countryId: 'preview',
      governmentName: builderState.structure.governmentName || 'Government',
      governmentType: builderState.structure.governmentType || 'Democracy',
      headOfState: builderState.structure.headOfState,
      headOfGovernment: builderState.structure.headOfGovernment,
      legislatureName: builderState.structure.legislatureName,
      executiveName: builderState.structure.executiveName,
      judicialName: builderState.structure.judicialName,
      totalBudget: builderState.structure.totalBudget || 0,
      fiscalYear: builderState.structure.fiscalYear || new Date().getFullYear().toString(),
      budgetCurrency: builderState.structure.budgetCurrency || 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
      departments: builderState.departments.map((dept, index) => ({
        id: index.toString(),
        governmentStructureId: 'preview',
        name: dept.name,
        shortName: dept.shortName,
        category: dept.category,
        description: dept.description,
        minister: dept.minister,
        ministerTitle: dept.ministerTitle,
        headquarters: dept.headquarters,
        established: dept.established,
        employeeCount: dept.employeeCount,
        icon: dept.icon,
        color: dept.color,
        priority: dept.priority,
        isActive: true,
        parentDepartmentId: dept.parentDepartmentId,
        organizationalLevel: dept.organizationalLevel,
        functions: dept.functions,
        kpis: dept.kpis || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        parentDepartment: undefined,
        subDepartments: [],
        budgetAllocations: [],
        subBudgets: []
      })),
      budgetAllocations: builderState.budgetAllocations.map((alloc, index) => ({
        id: index.toString(),
        governmentStructureId: 'preview',
        departmentId: alloc.departmentId,
        allocatedAmount: alloc.allocatedAmount,
        spentAmount: 0,
        encumberedAmount: 0,
        availableAmount: alloc.allocatedAmount,
        budgetStatus: 'In Use' as const,
        budgetYear: alloc.budgetYear,
        allocatedPercent: alloc.allocatedPercent,
        lastReviewed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        department: undefined as any
      })),
      revenueSources: builderState.revenueSources.map((source, index) => ({
        id: index.toString(),
        governmentStructureId: 'preview',
        name: source.name,
        category: source.category,
        description: source.description,
        revenueAmount: source.revenueAmount,
        revenuePercent: source.revenuePercent || 0,
        isActive: true,
        rate: source.rate,
        collectionMethod: source.collectionMethod,
        administeredBy: source.administeredBy,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    };
  };

  const normalizedStructure = normalizeGovernmentStructure(governmentStructure);
  
  if (!normalizedStructure) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="text-lg font-medium text-gray-900">No Government Structure</h3>
            <p className="text-gray-600">Configure your government structure to see the preview</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = {
    totalDepartments: normalizedStructure.departments.length,
    totalBudget: normalizedStructure.totalBudget,
    totalAllocated: normalizedStructure.budgetAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0),
    totalRevenue: normalizedStructure.revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0),
    budgetUtilization: normalizedStructure.totalBudget > 0 
      ? (normalizedStructure.budgetAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0) / normalizedStructure.totalBudget) * 100 
      : 0
  };

  // Use global formatting utilities with specific currency
  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, normalizedStructure.budgetCurrency);

  const getGovernmentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'democracy': return <Users className="h-5 w-5" />;
      case 'republic': return <Landmark className="h-5 w-5" />;
      case 'monarchy': return <Crown className="h-5 w-5" />;
      case 'federation': return <Building2 className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
    }
  };

  const getDepartmentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'executive': return <Crown className="h-4 w-4" />;
      case 'legislative': return <Landmark className="h-4 w-4" />;
      case 'judicial': return <Scale className="h-4 w-4" />;
      case 'defense': return <Target className="h-4 w-4" />;
      case 'finance': return <DollarSign className="h-4 w-4" />;
      case 'health': return <Users className="h-4 w-4" />;
      case 'education': return <Briefcase className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  const getBudgetStatus = (allocated: number, total: number) => {
    const percentage = total > 0 ? (allocated / total) * 100 : 0;
    if (percentage >= 95) return { status: 'critical', color: 'text-red-600', icon: AlertTriangle };
    if (percentage >= 85) return { status: 'warning', color: 'text-orange-600', icon: AlertTriangle };
    if (percentage >= 70) return { status: 'good', color: 'text-green-600', icon: CheckCircle };
    return { status: 'low', color: 'text-blue-600', icon: Info };
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Government Structure Preview
          </h3>
          <p className="text-muted-foreground mt-1">
            Complete overview of your government configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
            className="gap-2"
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-4 w-4" />
                Collapse All
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-4 w-4" />
                Expand All
              </>
            )}
          </Button>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Eye className="h-3 w-3 mr-1" />
            Preview Mode
          </Badge>
        </div>
      </div>

      {/* Government Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Government Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getGovernmentTypeIcon(normalizedStructure.governmentType)}
                  <span className="text-sm font-medium text-muted-foreground">Government Details</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Name:</span>
                    <p className="font-semibold">{normalizedStructure.governmentName}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Type:</span>
                    <p className="font-semibold">{normalizedStructure.governmentType}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Fiscal Year:</span>
                    <p className="font-semibold">{normalizedStructure.fiscalYear}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Leadership */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium text-muted-foreground">Leadership</span>
                </div>
                <div className="space-y-2">
                  {normalizedStructure.headOfState && (
                    <div>
                      <span className="text-sm text-muted-foreground">Head of State:</span>
                      <p className="font-semibold">{normalizedStructure.headOfState}</p>
                    </div>
                  )}
                  {normalizedStructure.headOfGovernment && (
                    <div>
                      <span className="text-sm text-muted-foreground">Head of Government:</span>
                      <p className="font-semibold">{normalizedStructure.headOfGovernment}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Branches of Government */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-medium text-muted-foreground">Branches</span>
                </div>
                <div className="space-y-2">
                  {normalizedStructure.legislatureName && (
                    <div>
                      <span className="text-sm text-muted-foreground">Legislature:</span>
                      <p className="font-semibold">{normalizedStructure.legislatureName}</p>
                    </div>
                  )}
                  {normalizedStructure.executiveName && (
                    <div>
                      <span className="text-sm text-muted-foreground">Executive:</span>
                      <p className="font-semibold">{normalizedStructure.executiveName}</p>
                    </div>
                  )}
                  {normalizedStructure.judicialName && (
                    <div>
                      <span className="text-sm text-muted-foreground">Judiciary:</span>
                      <p className="font-semibold">{normalizedStructure.judicialName}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrencyLocal(stats.totalBudget)}
              </div>
              <div className="text-sm text-muted-foreground">Total Budget</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrencyLocal(stats.totalAllocated)}
              </div>
              <div className="text-sm text-muted-foreground">Allocated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrencyLocal(stats.totalRevenue)}
              </div>
              <div className="text-sm text-muted-foreground">Projected Revenue</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getBudgetStatus(stats.totalAllocated, stats.totalBudget).color}`}>
                {stats.budgetUtilization.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Utilization</div>
            </div>
          </div>

          <Progress value={stats.budgetUtilization} className="mb-4" />

          <div className="flex items-center justify-between text-sm">
            <span>Budget Allocation Progress</span>
            <span>{formatCurrencyLocal(stats.totalAllocated)} of {formatCurrencyLocal(stats.totalBudget)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Selected Atomic Components */}
      {governmentComponents.length > 0 && (
        <Collapsible open={isComponentsOpen} onOpenChange={setIsComponentsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Selected Atomic Components
                    <Badge variant="secondary" className="ml-2">
                      {governmentComponents.length}
                    </Badge>
                  </div>
                  {isComponentsOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {governmentComponents.map(componentType => {
                    const metadata = ATOMIC_COMPONENTS[componentType];
                    if (!metadata) return null;

                    return (
                      <motion.div
                        key={componentType}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-muted hover:border-primary/30 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                          <Crown className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm">{metadata.name}</p>
                            <Badge variant="outline" className="text-xs">
                              <Target className="h-3 w-3 mr-1" />
                              Component
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {metadata.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Departments */}
      {normalizedStructure.departments.length > 0 && (
        <Collapsible open={isDepartmentsOpen} onOpenChange={setIsDepartmentsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Government Departments
                    <Badge variant="secondary" className="ml-2">
                      {stats.totalDepartments}
                    </Badge>
                  </div>
                  {isDepartmentsOpen ? (
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
              {normalizedStructure.departments.map((department, index) => {
                const departmentBudget = normalizedStructure.budgetAllocations
                  .find(a => a.departmentId === department.id);
                const budgetAmount = departmentBudget?.allocatedAmount || 0;
                const budgetStatus = getBudgetStatus(budgetAmount, stats.totalBudget);
                const isDeptOpen = openDepartments[department.id] || false;

                return (
                  <Collapsible
                    key={department.id}
                    open={isDeptOpen}
                    onOpenChange={() => toggleDepartment(department.id)}
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
                                <span>{((budgetAmount / stats.totalBudget) * 100).toFixed(1)}% of total budget</span>
                              </div>
                              <Progress
                                value={(budgetAmount / stats.totalBudget) * 100}
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
      )}

      {/* Budget Allocations Breakdown */}
      {normalizedStructure.budgetAllocations.length > 0 && (
        <Collapsible open={isBudgetOpen} onOpenChange={setIsBudgetOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Budget Allocations Breakdown
                    <Badge variant="secondary" className="ml-2">
                      {normalizedStructure.budgetAllocations.length}
                    </Badge>
                  </div>
                  {isBudgetOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-2">
              {normalizedStructure.budgetAllocations
                .sort((a, b) => b.allocatedAmount - a.allocatedAmount)
                .map((allocation, index) => {
                  const department = normalizedStructure.departments.find(d => d.id === allocation.departmentId);
                  if (!department) return null;

                  const percentage = (allocation.allocatedAmount / stats.totalBudget) * 100;
                  const isAllocOpen = openAllocations[allocation.id] || false;

                  return (
                    <Collapsible
                      key={allocation.id}
                      open={isAllocOpen}
                      onOpenChange={() => toggleAllocation(allocation.id)}
                    >
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: department.color }}
                              />
                              <span className="font-medium">{department.name}</span>
                              {isAllocOpen ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground ml-1" />
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">{formatCurrencyLocal(allocation.allocatedAmount)}</span>
                              <span className="text-sm text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 border-t bg-muted/20">
                            <div className="pt-3 space-y-2">
                              <Progress value={percentage} className="h-2" />
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Department ID:</span>
                                  <p className="font-medium">{allocation.departmentId}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Allocation ID:</span>
                                  <p className="font-medium text-xs truncate">{allocation.id}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Percentage:</span>
                                  <p className="font-medium">{allocation.allocatedPercent?.toFixed(2)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Amount:</span>
                                  <p className="font-medium">{formatCurrencyLocal(allocation.allocatedAmount)}</p>
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
      )}

      {/* Revenue Sources */}
      {normalizedStructure.revenueSources.length > 0 && (
        <Collapsible open={isRevenueOpen} onOpenChange={setIsRevenueOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Revenue Sources
                    <Badge variant="secondary" className="ml-2">
                      {normalizedStructure.revenueSources.length}
                    </Badge>
                  </div>
                  {isRevenueOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-2">
              {normalizedStructure.revenueSources
                .sort((a, b) => b.revenueAmount - a.revenueAmount)
                .map((source, index) => {
                  const percentage = (source.revenueAmount / stats.totalRevenue) * 100;
                  const isRevOpen = openRevenues[source.id] || false;

                  return (
                    <Collapsible
                      key={source.id}
                      open={isRevOpen}
                      onOpenChange={() => toggleRevenue(source.id)}
                    >
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{source.name}</span>
                              {isRevOpen ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">{formatCurrencyLocal(source.revenueAmount)}</span>
                              <span className="text-sm text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 border-t bg-muted/20">
                            <div className="pt-3 space-y-2">
                              {source.description && (
                                <p className="text-sm text-muted-foreground">{source.description}</p>
                              )}
                              <Progress value={percentage} className="h-2" />
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Source ID:</span>
                                  <p className="font-medium text-xs truncate">{source.id}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Percentage:</span>
                                  <p className="font-medium">{percentage.toFixed(2)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Revenue Amount:</span>
                                  <p className="font-medium">{formatCurrencyLocal(source.revenueAmount)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Source Type:</span>
                                  <p className="font-medium capitalize">{source.name.split(' ')[0]}</p>
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
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Summary Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalDepartments}</div>
              <div className="text-sm text-muted-foreground">Departments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{governmentComponents.length}</div>
              <div className="text-sm text-muted-foreground">Atomic Components</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{normalizedStructure.budgetAllocations.length}</div>
              <div className="text-sm text-muted-foreground">Budget Allocations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{normalizedStructure.revenueSources.length}</div>
              <div className="text-sm text-muted-foreground">Revenue Sources</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
