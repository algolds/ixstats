"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Button } from "~/components/ui/button";
import {
  Building2,
  Crown,
  Users,
  DollarSign,
  Scale,
  Landmark,
  Target,
  Briefcase,
  BarChart3,
  Eye,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import type { GovernmentStructure, GovernmentBuilderState } from "~/types/government";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { formatCurrency } from "~/lib/format-utils";
import { StructureOverview } from "./government-preview/StructureOverview";
import { ComponentsList } from "./government-preview/ComponentsList";
import { DepartmentsList } from "./government-preview/DepartmentsList";
import { BudgetAllocationList } from "./government-preview/BudgetAllocationList";
import { RevenueSourcesList } from "./government-preview/RevenueSourcesList";

const getBudgetStatus = (allocated: number, total: number) => {
  const percentage = total > 0 ? (allocated / total) * 100 : 0;
  if (percentage >= 95) return { status: "critical", color: "text-red-600" };
  if (percentage >= 85) return { status: "warning", color: "text-orange-600" };
  if (percentage >= 70) return { status: "good", color: "text-green-600" };
  return { status: "low", color: "text-blue-600" };
};

/**
 * Props for the GovernmentStructurePreview component
 *
 * @interface GovernmentStructurePreviewProps
 * @property {GovernmentStructure | GovernmentBuilderState | null} governmentStructure - Government configuration to preview
 * @property {ComponentType[]} governmentComponents - Array of selected atomic government components
 * @property {string} [className] - Optional CSS classes for styling
 */
interface GovernmentStructurePreviewProps {
  governmentStructure: GovernmentStructure | GovernmentBuilderState | null;
  governmentComponents: ComponentType[];
  className?: string;
}

/**
 * GovernmentStructurePreview - Comprehensive read-only preview of government configuration
 *
 * This component provides a complete, collapsible preview of a nation's government structure including
 * the organizational hierarchy, budget allocations, revenue sources, and atomic components. It normalizes
 * both saved GovernmentStructure entities and in-progress GovernmentBuilderState for consistent display.
 *
 * The preview organizes government data into collapsible sections:
 * - Structure Overview: Government name, type, heads of state/government, legislature/executive/judicial names
 * - Budget Overview: Total budget, allocated amounts, projected revenue, utilization percentage with progress bar
 * - Atomic Components: Selected government components with descriptions and effectiveness indicators
 * - Departments: All government departments with hierarchy, employees, functions, KPIs, and budget links
 * - Budget Allocations: Department-by-department budget breakdown with spending status and percentages
 * - Revenue Sources: Tax and non-tax revenue sources with collection methods and administered-by departments
 * - Summary Statistics: Aggregate counts and totals for departments, components, allocations, and revenue
 *
 * Key features:
 * - Expand/collapse all functionality for quick navigation
 * - Individual collapsible sections for focused review
 * - Currency formatting using global utilities with dynamic currency codes
 * - Budget utilization visualization with progress bars and color-coded status
 * - Department hierarchy display with parent/child relationships
 * - Icon mapping for government types and department categories
 * - Empty state handling when no government structure is configured
 *
 * @component
 * @param {GovernmentStructurePreviewProps} props - Component props
 * @param {GovernmentStructure | GovernmentBuilderState | null} props.governmentStructure - Government data to preview
 * @param {ComponentType[]} props.governmentComponents - Atomic components selected for this government
 * @param {string} [props.className] - Additional CSS classes for custom styling
 *
 * @returns {JSX.Element} Rendered government preview with collapsible sections and summary statistics
 *
 * @example
 * ```tsx
 * <GovernmentStructurePreview
 *   governmentStructure={governmentBuilderState}
 *   governmentComponents={['DEMOCRACY', 'FEDERAL_SYSTEM', 'BICAMERAL_LEGISLATURE']}
 *   className="mt-6"
 * />
 * ```
 */
export function GovernmentStructurePreview({
  governmentStructure,
  governmentComponents,
  className,
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
    setOpenDepartments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllocation = (id: string) => {
    setOpenAllocations((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRevenue = (id: string) => {
    setOpenRevenues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper function to normalize government structure data
  const normalizeGovernmentStructure = (
    data: GovernmentStructure | GovernmentBuilderState | null
  ): GovernmentStructure | null => {
    if (!data) return null;

    // If it's already a GovernmentStructure, return as is
    if ("id" in data && "countryId" in data && "governmentName" in data) {
      return data as GovernmentStructure;
    }

    // If it's a GovernmentBuilderState, convert it
    const builderState = data as GovernmentBuilderState;
    return {
      id: "preview",
      countryId: "preview",
      governmentName: builderState.structure.governmentName || "Government",
      governmentType: builderState.structure.governmentType || "Democracy",
      headOfState: builderState.structure.headOfState,
      headOfGovernment: builderState.structure.headOfGovernment,
      legislatureName: builderState.structure.legislatureName,
      executiveName: builderState.structure.executiveName,
      judicialName: builderState.structure.judicialName,
      totalBudget: builderState.structure.totalBudget || 0,
      fiscalYear: builderState.structure.fiscalYear || new Date().getFullYear().toString(),
      budgetCurrency: builderState.structure.budgetCurrency || "USD",
      createdAt: new Date(),
      updatedAt: new Date(),
      departments: builderState.departments.map((dept, index) => ({
        id: index.toString(),
        governmentStructureId: "preview",
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
        subBudgets: [],
      })),
      budgetAllocations: builderState.budgetAllocations.map((alloc, index) => ({
        id: index.toString(),
        governmentStructureId: "preview",
        departmentId: alloc.departmentId,
        allocatedAmount: alloc.allocatedAmount,
        spentAmount: 0,
        encumberedAmount: 0,
        availableAmount: alloc.allocatedAmount,
        budgetStatus: "In Use" as const,
        budgetYear: alloc.budgetYear,
        allocatedPercent: alloc.allocatedPercent,
        lastReviewed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        department: undefined as any,
      })),
      revenueSources: builderState.revenueSources.map((source, index) => ({
        id: index.toString(),
        governmentStructureId: "preview",
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
        updatedAt: new Date(),
      })),
    };
  };

  const normalizedStructure = normalizeGovernmentStructure(governmentStructure);

  if (!normalizedStructure) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="space-y-2 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
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
    totalAllocated: normalizedStructure.budgetAllocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    ),
    totalRevenue: normalizedStructure.revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0),
    budgetUtilization:
      normalizedStructure.totalBudget > 0
        ? (normalizedStructure.budgetAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0) /
            normalizedStructure.totalBudget) *
          100
        : 0,
  };

  // Use global formatting utilities with specific currency
  const formatCurrencyLocal = (amount: number) =>
    formatCurrency(amount, normalizedStructure.budgetCurrency);

  const getGovernmentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "democracy":
        return <Users className="h-5 w-5" />;
      case "republic":
        return <Landmark className="h-5 w-5" />;
      case "monarchy":
        return <Crown className="h-5 w-5" />;
      case "federation":
        return <Building2 className="h-5 w-5" />;
      default:
        return <Building2 className="h-5 w-5" />;
    }
  };

  const getDepartmentIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "executive":
        return <Crown className="h-4 w-4" />;
      case "legislative":
        return <Landmark className="h-4 w-4" />;
      case "judicial":
        return <Scale className="h-4 w-4" />;
      case "defense":
        return <Target className="h-4 w-4" />;
      case "finance":
        return <DollarSign className="h-4 w-4" />;
      case "health":
        return <Users className="h-4 w-4" />;
      case "education":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
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
            <Eye className="mr-1 h-3 w-3" />
            Preview Mode
          </Badge>
        </div>
      </div>

      {/* Government Overview */}
      <StructureOverview
        structure={normalizedStructure}
        getGovernmentTypeIcon={getGovernmentTypeIcon}
      />

      {/* Budget Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrencyLocal(stats.totalBudget)}
              </div>
              <div className="text-muted-foreground text-sm">Total Budget</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrencyLocal(stats.totalAllocated)}
              </div>
              <div className="text-muted-foreground text-sm">Allocated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrencyLocal(stats.totalRevenue)}
              </div>
              <div className="text-muted-foreground text-sm">Projected Revenue</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${getBudgetStatus(stats.totalAllocated, stats.totalBudget).color}`}
              >
                {stats.budgetUtilization.toFixed(1)}%
              </div>
              <div className="text-muted-foreground text-sm">Utilization</div>
            </div>
          </div>

          <Progress value={stats.budgetUtilization} className="mb-4" />

          <div className="flex items-center justify-between text-sm">
            <span>Budget Allocation Progress</span>
            <span>
              {formatCurrencyLocal(stats.totalAllocated)} of{" "}
              {formatCurrencyLocal(stats.totalBudget)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Selected Atomic Components */}
      <ComponentsList
        components={governmentComponents}
        isOpen={isComponentsOpen}
        onOpenChange={setIsComponentsOpen}
      />

      {/* Departments */}
      <DepartmentsList
        departments={normalizedStructure.departments}
        budgetAllocations={normalizedStructure.budgetAllocations}
        totalBudget={stats.totalBudget}
        currency={normalizedStructure.budgetCurrency}
        isOpen={isDepartmentsOpen}
        onOpenChange={setIsDepartmentsOpen}
        openDepartments={openDepartments}
        onToggleDepartment={toggleDepartment}
        getDepartmentIcon={getDepartmentIcon}
      />

      {/* Budget Allocations Breakdown */}
      <BudgetAllocationList
        allocations={normalizedStructure.budgetAllocations}
        departments={normalizedStructure.departments}
        totalBudget={stats.totalBudget}
        currency={normalizedStructure.budgetCurrency}
        isOpen={isBudgetOpen}
        onOpenChange={setIsBudgetOpen}
        openAllocations={openAllocations}
        onToggleAllocation={toggleAllocation}
      />

      {/* Revenue Sources */}
      <RevenueSourcesList
        sources={normalizedStructure.revenueSources}
        totalRevenue={stats.totalRevenue}
        currency={normalizedStructure.budgetCurrency}
        isOpen={isRevenueOpen}
        onOpenChange={setIsRevenueOpen}
        openRevenues={openRevenues}
        onToggleRevenue={toggleRevenue}
      />

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Summary Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalDepartments}</div>
              <div className="text-muted-foreground text-sm">Departments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{governmentComponents.length}</div>
              <div className="text-muted-foreground text-sm">Atomic Components</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {normalizedStructure.budgetAllocations.length}
              </div>
              <div className="text-muted-foreground text-sm">Budget Allocations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {normalizedStructure.revenueSources.length}
              </div>
              <div className="text-muted-foreground text-sm">Revenue Sources</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
