"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Users, TrendingUp, TrendingDown, DollarSign, Shield, Briefcase, Zap } from "lucide-react";
import { MetricCard } from "../../../primitives/enhanced";
import type { EconomyBuilderState, LaborConfiguration } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/economy/atoms/AtomicEconomicComponents";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/atomic-economic-data";
import {
  calculateDerivedLabor,
  getEmploymentTypeColor,
  getSectorColor,
  getProtectionColor,
} from "./utils/laborCalculations";
import { WorkforceSection } from "./labor/WorkforceSection";
import { EmploymentSection } from "./labor/EmploymentSection";
import { IncomeSection } from "./labor/IncomeSection";
import { ProtectionsSection } from "./labor/ProtectionsSection";
import { LaborVisualizations } from "./labor/LaborVisualizations";

/**
 * Props for the LaborEmploymentTab component
 *
 * @interface LaborEmploymentTabProps
 * @property {EconomyBuilderState} economyBuilder - Current economy builder state containing labor market configuration
 * @property {function} onEconomyBuilderChange - Callback to update economy builder state when labor values change
 * @property {EconomicComponentType[]} selectedComponents - Array of atomic economic components affecting labor market
 * @property {boolean} [showAdvanced=false] - Optional flag to display advanced labor configuration options
 */
interface LaborEmploymentTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

/**
 * LaborEmploymentTab - Comprehensive labor market and employment configuration interface
 *
 * This component provides a multi-section interface for configuring all aspects of a nation's labor market,
 * including workforce composition, employment rates, wage structures, and worker protections. It displays
 * real-time impact assessments from selected atomic economic components and validates labor market configurations.
 *
 * The tab organizes labor configuration into four main sections:
 * - Workforce: Labor force participation, total workforce size, and demographic workforce breakdowns
 * - Employment: Employment/unemployment rates, sector distribution, and employment type breakdowns
 * - Income & Wages: Minimum wage, living wage, average workweek hours, and income structures
 * - Worker Rights: Unionization rates, worker protections, collective bargaining, and labor rights indices
 *
 * @component
 * @param {LaborEmploymentTabProps} props - Component props
 * @param {EconomyBuilderState} props.economyBuilder - The economy builder state with labor market data
 * @param {function} props.onEconomyBuilderChange - Callback to update economy builder state with labor changes
 * @param {EconomicComponentType[]} props.selectedComponents - Atomic components that may modify labor market metrics
 * @param {boolean} [props.showAdvanced=false] - Whether to show advanced labor configuration options
 *
 * @returns {JSX.Element} Rendered labor and employment configuration tab with metrics and visualizations
 *
 * @example
 * ```tsx
 * <LaborEmploymentTab
 *   economyBuilder={economyBuilderState}
 *   onEconomyBuilderChange={handleEconomyChange}
 *   selectedComponents={['STRONG_LABOR_UNIONS', 'MINIMUM_WAGE_LAWS']}
 *   showAdvanced={false}
 * />
 * ```
 */
export function LaborEmploymentTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false,
}: LaborEmploymentTabProps) {
  const [activeSection, setActiveSection] = useState<
    "workforce" | "employment" | "income" | "protections"
  >("workforce");

  const employmentImpacts = useMemo(() => {
    return selectedComponents.reduce(
      (acc, compType) => {
        const component = ATOMIC_ECONOMIC_COMPONENTS[compType];
        if (!component?.employmentImpact) return acc;

        return {
          unemployment: acc.unemployment + (component.employmentImpact.unemploymentModifier || 0),
          participation:
            acc.participation * (component.employmentImpact.participationModifier || 1),
          wageGrowth: acc.wageGrowth * (component.employmentImpact.wageGrowthModifier || 1),
        };
      },
      { unemployment: 0, participation: 1, wageGrowth: 1 }
    );
  }, [selectedComponents]);

  const handleLaborChange = (field: keyof LaborConfiguration, value: any) => {
    onEconomyBuilderChange({
      ...economyBuilder,
      laborMarket: { ...economyBuilder.laborMarket, [field]: value },
    });
  };

  const handleNestedLaborChange = (
    parentField: keyof LaborConfiguration,
    field: string,
    value: any
  ) => {
    onEconomyBuilderChange({
      ...economyBuilder,
      laborMarket: {
        ...economyBuilder.laborMarket,
        [parentField]: { ...(economyBuilder.laborMarket[parentField] as any), [field]: value },
      },
    });
  };

  const derivedMetrics = useMemo(
    () => calculateDerivedLabor(economyBuilder.laborMarket),
    [economyBuilder.laborMarket]
  );

  const chartData = useMemo(
    () => ({
      employmentType: Object.entries(economyBuilder.laborMarket.employmentType).map(
        ([type, value]) => ({
          name: type.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          value,
          color: getEmploymentTypeColor(type),
        })
      ),
      sectorDistribution: Object.entries(economyBuilder.laborMarket.sectorDistribution).map(
        ([sector, value]) => ({
          name: sector.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          value,
          color: getSectorColor(sector),
        })
      ),
      workerProtections: Object.entries(economyBuilder.laborMarket.workerProtections).map(
        ([protection, value]) => ({
          name: protection.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          value,
          color: getProtectionColor(protection),
        })
      ),
    }),
    [economyBuilder.laborMarket]
  );

  const hasComponentImpact =
    employmentImpacts.unemployment !== 0 ||
    employmentImpacts.participation !== 1 ||
    employmentImpacts.wageGrowth !== 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Labor & Employment Configuration</h2>
          <p className="text-muted-foreground">
            Configure workforce dynamics, employment rates, and worker protections
          </p>
        </div>
      </div>

      {hasComponentImpact && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center space-x-4">
              <span>Atomic Component Impact:</span>
              {employmentImpacts.unemployment !== 0 && (
                <Badge variant={employmentImpacts.unemployment < 0 ? "default" : "secondary"}>
                  Unemployment: {employmentImpacts.unemployment > 0 ? "+" : ""}
                  {employmentImpacts.unemployment.toFixed(1)}%
                </Badge>
              )}
              {employmentImpacts.participation !== 1 && (
                <Badge variant={employmentImpacts.participation > 1 ? "default" : "secondary"}>
                  Participation: {((employmentImpacts.participation - 1) * 100).toFixed(1)}%
                </Badge>
              )}
              {employmentImpacts.wageGrowth !== 1 && (
                <Badge variant={employmentImpacts.wageGrowth > 1 ? "default" : "secondary"}>
                  Wage Growth: {((employmentImpacts.wageGrowth - 1) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Total Workforce"
          value={derivedMetrics.laborForceSize.toLocaleString()}
          icon={Users}
          sectionId="labor"
          trend="neutral"
        />
        <MetricCard
          label="Unemployment Rate"
          value={`${economyBuilder.laborMarket.unemploymentRate.toFixed(1)}%`}
          icon={economyBuilder.laborMarket.unemploymentRate < 5 ? TrendingUp : TrendingDown}
          sectionId="labor"
          trend={economyBuilder.laborMarket.unemploymentRate < 5 ? "up" : "down"}
        />
        <MetricCard
          label="Participation Rate"
          value={`${economyBuilder.laborMarket.laborForceParticipationRate.toFixed(1)}%`}
          icon={Users}
          sectionId="labor"
          trend={economyBuilder.laborMarket.laborForceParticipationRate > 65 ? "up" : "neutral"}
        />
        <MetricCard
          label="Avg Workweek"
          value={`${economyBuilder.laborMarket.averageWorkweekHours.toFixed(1)} hrs`}
          icon={TrendingDown}
          sectionId="labor"
          trend="neutral"
        />
      </div>

      <div className="flex space-x-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {[
          { id: "workforce", label: "Workforce", icon: Users },
          { id: "employment", label: "Employment", icon: Briefcase },
          { id: "income", label: "Income & Wages", icon: DollarSign },
          { id: "protections", label: "Worker Rights", icon: Shield },
        ].map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSection(section.id as any)}
              className="flex-1"
            >
              <Icon className="mr-2 h-4 w-4" />
              {section.label}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {activeSection === "workforce" && "Workforce Structure"}
              {activeSection === "employment" && "Employment Configuration"}
              {activeSection === "income" && "Income & Wage Settings"}
              {activeSection === "protections" && "Worker Protections"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeSection === "workforce" && (
              <WorkforceSection
                laborMarket={economyBuilder.laborMarket}
                onChange={handleLaborChange}
                showAdvanced={showAdvanced}
              />
            )}
            {activeSection === "employment" && (
              <EmploymentSection
                laborMarket={economyBuilder.laborMarket}
                onChange={handleLaborChange}
                onNestedChange={handleNestedLaborChange}
                showAdvanced={showAdvanced}
              />
            )}
            {activeSection === "income" && (
              <IncomeSection
                laborMarket={economyBuilder.laborMarket}
                onChange={handleLaborChange}
                showAdvanced={showAdvanced}
              />
            )}
            {activeSection === "protections" && (
              <ProtectionsSection
                laborMarket={economyBuilder.laborMarket}
                onChange={handleLaborChange}
                onNestedChange={handleNestedLaborChange}
                showAdvanced={showAdvanced}
              />
            )}
          </CardContent>
        </Card>

        <LaborVisualizations
          laborMarket={economyBuilder.laborMarket}
          employmentTypeData={chartData.employmentType}
          sectorDistributionData={chartData.sectorDistribution}
          workerProtectionsData={chartData.workerProtections}
        />
      </div>
    </div>
  );
}
