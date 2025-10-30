"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Building2, Crown, Users, DollarSign, Info } from "lucide-react";
import { GovernmentBuilder } from "~/components/government";
import type { SectionContentProps } from "../types/builder";
import type { EconomicInputs } from "../lib/economy-data-service";
import type { GovernmentBuilderState } from "~/types/government";

interface GovernmentStructureSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
}

export function GovernmentStructureSection({
  inputs,
  onInputsChange,
}: GovernmentStructureSectionProps) {
  const [governmentData, setGovernmentData] = useState<GovernmentBuilderState>({
    structure: {
      governmentName: `Government of ${inputs.countryName}`,
      governmentType: "Constitutional Monarchy",
      totalBudget: inputs.coreIndicators.nominalGDP * 0.35, // 35% of GDP as default
      fiscalYear: "Calendar Year",
      budgetCurrency: inputs.nationalIdentity?.currency || "USD",
      headOfState: "",
      headOfGovernment: "",
    },
    departments: [],
    budgetAllocations: [],
    revenueSources: [],
    isValid: false,
    errors: {},
  });

  const [isBuilderMode, setIsBuilderMode] = useState(false);

  const handleSave = async (data: GovernmentBuilderState) => {
    console.log("Saving government structure:", data);

    // Update the economic inputs with government data
    const updatedInputs = {
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        totalSpending: data.structure.totalBudget,
        spendingGDPPercent:
          inputs.coreIndicators.nominalGDP > 0
            ? (data.structure.totalBudget / inputs.coreIndicators.nominalGDP) * 100
            : 35,
        // Map departments to spending categories
        spendingCategories: data.departments.map((dept, index) => {
          const allocation = data.budgetAllocations.find(
            (a) => a.departmentId === index.toString()
          );
          return {
            category: dept.name,
            amount: allocation?.allocatedAmount || 0,
            percent: allocation?.allocatedPercent || 0,
            icon: dept.icon,
            color: dept.color,
            description: dept.description,
          };
        }),
        // Update government spending properties based on departments
        performanceBasedBudgeting: data.departments.some((d) =>
          d.functions?.includes("Performance Management")
        ),
        universalBasicServices: data.departments.some((d) => d.category === "Social Services"),
        greenInvestmentPriority: data.departments.some((d) => d.category === "Environment"),
        digitalGovernmentInitiative: data.departments.some((d) =>
          d.functions?.includes("Digital Services")
        ),
      },
    };

    // Store government structure data for later use
    setGovernmentData(data);
    onInputsChange(updatedInputs);
    setIsBuilderMode(false);
  };

  const handlePreview = (data: GovernmentBuilderState) => {
    console.log("Previewing government structure:", data);
    setGovernmentData(data);
  };

  const getDepartmentStats = () => {
    const totalDepartments = governmentData.departments.length;
    const totalBudgetAllocated = governmentData.budgetAllocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    );
    const totalRevenueProjected = governmentData.revenueSources.reduce(
      (sum, r) => sum + r.revenueAmount,
      0
    );

    return {
      totalDepartments,
      totalBudgetAllocated,
      totalRevenueProjected,
      budgetUtilization:
        governmentData.structure.totalBudget > 0
          ? (totalBudgetAllocated / governmentData.structure.totalBudget) * 100
          : 0,
    };
  };

  const stats = getDepartmentStats();
  const hasGovernment = governmentData.departments.length > 0;

  if (isBuilderMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-2xl font-bold">Government Structure Builder</h2>
            <p className="text-muted-foreground mt-1">
              Design your nation's government structure and budget allocation
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsBuilderMode(false)}>
            Back to Overview
          </Button>
        </div>

        <GovernmentBuilder
          initialData={governmentData}
          onSave={handleSave}
          onPreview={handlePreview}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="text-primary h-8 w-8" />
          <div>
            <h2 className="text-foreground text-2xl font-bold">Government Structure</h2>
            <p className="text-muted-foreground">
              Configure your nation's government departments and budget allocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasGovernment && (
            <Badge
              variant="default"
              className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            >
              {stats.totalDepartments} Departments Configured
            </Badge>
          )}
          <Button onClick={() => setIsBuilderMode(true)} className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {hasGovernment ? "Edit Government" : "Build Government"}
          </Button>
        </div>
      </div>

      {/* Current Government Overview */}
      {hasGovernment ? (
        <div className="space-y-6">
          {/* Government Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                {governmentData.structure.governmentName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">Government Type</div>
                  <div className="text-foreground font-bold">
                    {governmentData.structure.governmentType}
                  </div>
                  {governmentData.structure.headOfState && (
                    <div className="text-muted-foreground text-sm">
                      Head of State: {governmentData.structure.headOfState}
                    </div>
                  )}
                  {governmentData.structure.headOfGovernment && (
                    <div className="text-muted-foreground text-sm">
                      Head of Government: {governmentData.structure.headOfGovernment}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">Budget Information</div>
                  <div className="text-foreground font-bold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: governmentData.structure.budgetCurrency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(governmentData.structure.totalBudget)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {(
                      (governmentData.structure.totalBudget / inputs.coreIndicators.nominalGDP) *
                      100
                    ).toFixed(1)}
                    % of GDP
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {governmentData.structure.fiscalYear} •{" "}
                    {governmentData.structure.budgetCurrency}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-muted-foreground text-sm">Allocation Status</div>
                  <div className="text-foreground font-bold">
                    {stats.budgetUtilization.toFixed(1)}% Allocated
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {stats.totalDepartments} Active Departments
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Departments</p>
                    <p className="text-foreground text-2xl font-bold">{stats.totalDepartments}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Budget Allocated</p>
                    <p className="text-foreground text-2xl font-bold">
                      {(stats.totalBudgetAllocated / 1e9).toFixed(1)}B
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Revenue Sources</p>
                    <p className="text-foreground text-2xl font-bold">
                      {governmentData.revenueSources.length}
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Fiscal Health</p>
                    <p
                      className={`text-2xl font-bold ${
                        stats.totalRevenueProjected >= stats.totalBudgetAllocated
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {stats.totalRevenueProjected >= stats.totalBudgetAllocated
                        ? "Surplus"
                        : "Deficit"}
                    </p>
                  </div>
                  <div
                    className={`h-8 w-8 rounded ${
                      stats.totalRevenueProjected >= stats.totalBudgetAllocated
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    } flex items-center justify-center`}
                  >
                    {stats.totalRevenueProjected >= stats.totalBudgetAllocated ? "↑" : "↓"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Department Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {governmentData.departments.slice(0, 5).map((dept, index) => {
                  const allocation = governmentData.budgetAllocations.find(
                    (a) => a.departmentId === index.toString()
                  );

                  return (
                    <div
                      key={index}
                      className="bg-secondary flex items-center justify-between rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 rounded" style={{ backgroundColor: dept.color }} />
                        <div>
                          <div className="text-foreground font-medium">{dept.name}</div>
                          <div className="text-muted-foreground text-sm">
                            {dept.category} • {dept.ministerTitle}: {dept.minister || "Vacant"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-foreground font-bold">
                          {allocation ? `${allocation.allocatedPercent.toFixed(1)}%` : "0%"}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {allocation
                            ? new Intl.NumberFormat("en-US", {
                                notation: "compact",
                                maximumFractionDigits: 1,
                              }).format(allocation.allocatedAmount)
                            : "0"}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {governmentData.departments.length > 5 && (
                  <div className="text-muted-foreground py-2 text-center">
                    +{governmentData.departments.length - 5} more departments
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Integration Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your government structure will be integrated with your country's economic simulation.
              Budget allocations affect economic growth, and department efficiency influences
              national performance metrics.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        /* No Government Setup */
        <Card className="border-border border-2 border-dashed">
          <CardContent className="p-12 text-center">
            <Building2 className="text-muted-foreground mx-auto mb-6 h-16 w-16" />
            <h3 className="text-foreground mb-3 text-xl font-bold">
              No Government Structure Configured
            </h3>
            <p className="text-muted-foreground mx-auto mb-6 max-w-md">
              Set up your nation's government structure including departments, budget allocation,
              and revenue sources to create a comprehensive economic simulation.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => setIsBuilderMode(true)}
                size="lg"
                className="flex items-center gap-2"
              >
                <Building2 className="h-5 w-5" />
                Build Government Structure
              </Button>
              <p className="text-muted-foreground text-sm">
                Create departments • Set budgets • Configure revenue sources
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
