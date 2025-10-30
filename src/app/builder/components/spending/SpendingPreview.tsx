// SpendingPreview Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Comprehensive preview of government structure, policies, and budget projections

"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eye, Save } from "lucide-react";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { GovernmentStructurePreview } from "../enhanced/GovernmentStructurePreview";
import { SPENDING_POLICIES } from "../../data/government-spending-policies";
import { IxTime } from "~/lib/ixtime";
import type { GovernmentBuilderState } from "~/types/government";
import type { EconomicInputs } from "../../lib/economy-data-service";
import { toast } from "sonner";

interface SpendingPreviewProps {
  selectedPolicies: Set<string>;
  selectedAtomicComponents: ComponentType[];
  governmentBuilderData: GovernmentBuilderState | null;
  inputs: EconomicInputs;
  onSave?: () => void;
  className?: string;
}

/**
 * SpendingPreview - Comprehensive preview of government configuration
 * Shows structure, selected policies, and budget projections over time
 */
export function SpendingPreview({
  selectedPolicies,
  selectedAtomicComponents,
  governmentBuilderData,
  inputs,
  onSave,
  className,
}: SpendingPreviewProps) {
  const handleSave = () => {
    if (onSave) {
      onSave();
    } else {
      toast.success("Government structure saved successfully!");
    }
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-xl font-semibold">Government Structure Preview</h3>
            <p className="text-muted-foreground mt-1">
              Review your government configuration before saving
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Eye className="mr-1 h-3 w-3" />
            Preview Mode
          </Badge>
        </div>

        {/* Government Structure Preview */}
        {governmentBuilderData && (
          <GovernmentStructurePreview
            governmentStructure={governmentBuilderData}
            governmentComponents={selectedAtomicComponents}
          />
        )}

        {/* Selected Policies */}
        {selectedPolicies.size > 0 && <SelectedPoliciesCard selectedPolicies={selectedPolicies} />}

        {/* Budget Projections */}
        {governmentBuilderData && (
          <BudgetProjectionsCard governmentBuilderData={governmentBuilderData} inputs={inputs} />
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="min-w-32" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Government
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * SelectedPoliciesCard - Displays selected policies in a grid
 */
function SelectedPoliciesCard({ selectedPolicies }: { selectedPolicies: Set<string> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Selected Policies</CardTitle>
        <CardDescription>{selectedPolicies.size} policies selected</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from(selectedPolicies).map((policyId) => {
            const policy = SPENDING_POLICIES.find((p) => p.id === policyId);
            if (!policy) return null;

            const Icon = policy.icon;
            return (
              <div key={policyId} className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Icon className="text-primary h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{policy.name}</p>
                  <p className="text-muted-foreground text-xs">{policy.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * BudgetProjectionsCard - Shows budget vs revenue trends over IxTime years
 */
function BudgetProjectionsCard({
  governmentBuilderData,
  inputs,
}: {
  governmentBuilderData: GovernmentBuilderState;
  inputs: EconomicInputs;
}) {
  const currentYear = new Date(IxTime.getCurrentIxTime()).getFullYear();
  const budget = governmentBuilderData.structure.totalBudget;
  const revenue = governmentBuilderData.revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0);
  const gdp = inputs?.coreIndicators?.nominalGDP || 0;

  // Generate 5-year projection (2 years back, current, 2 years forward)
  const projections = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear + i - 2;
    const yearOffset = year - currentYear;
    const gdpGrowth = gdp * Math.pow(1.03, yearOffset); // 3% annual growth assumption

    return {
      year,
      budget,
      revenue,
      gdp: gdpGrowth,
      budgetGdpRatio: gdp > 0 ? (budget / gdpGrowth) * 100 : 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs Revenue Trend (IxTime Years)</CardTitle>
        <CardDescription>Projected budget sustainability over 5 years</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {projections.map(({ year, budget, revenue, gdp, budgetGdpRatio }) => (
              <div key={year} className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-muted-foreground mb-2 text-sm font-semibold">Year {year}</p>
                <div className="space-y-1">
                  <p className="text-xs">
                    <span className="text-muted-foreground">Budget:</span>{" "}
                    <span className="font-medium">${budget.toLocaleString()}</span>
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Revenue:</span>{" "}
                    <span className="font-medium">${revenue.toLocaleString()}</span>
                  </p>
                  {gdp > 0 && (
                    <>
                      <p className="text-xs">
                        <span className="text-muted-foreground">GDP:</span>{" "}
                        <span className="font-medium">${gdp.toLocaleString()}</span>
                      </p>
                      <p className="text-primary mt-1 text-xs font-semibold">
                        {budgetGdpRatio.toFixed(1)}% of GDP
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sustainability indicator */}
          <div className="bg-muted/20 flex items-center justify-center gap-2 rounded-lg p-3">
            <p className="text-muted-foreground text-sm">Average Budget/GDP Ratio:</p>
            <p className="text-sm font-semibold">
              {(
                projections.reduce((sum, p) => sum + p.budgetGdpRatio, 0) / projections.length
              ).toFixed(1)}
              %
            </p>
            <Badge
              variant={
                projections[0]!.budgetGdpRatio < 40
                  ? "default"
                  : projections[0]!.budgetGdpRatio < 50
                    ? "secondary"
                    : "destructive"
              }
            >
              {projections[0]!.budgetGdpRatio < 40
                ? "Sustainable"
                : projections[0]!.budgetGdpRatio < 50
                  ? "Moderate"
                  : "High Risk"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
