"use client";

import React, { useState, useMemo } from "react";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Group as Users, StatUp as TrendingUp, StatDown as TrendingDown, Dollar as DollarSign, Shield, Suitcase as Briefcase } from "iconoir-react";
import { MetricCard } from "../../../primitives/enhanced";
import type { EconomyBuilderState, LaborConfiguration } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";
import {
  calculateDerivedLabor,
  getEmploymentTypeColor,
  getSectorColor,
  getProtectionColor,
  getLaborBounds,
} from "./utils/laborCalculations";
import { FieldIndicator } from "~/app/builder/primitives/FieldIndicator";
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
    const updatedLaborMarket = { ...economyBuilder.laborMarket, [field]: value };
    if (field === "laborForceParticipationRate") {
      const population = economyBuilder.demographics.totalPopulation || 0;
      const rate = typeof value === "number" ? value : parseFloat(String(value ?? 0));
      updatedLaborMarket.totalWorkforce = Math.round(population * (rate / 100));
    }
    onEconomyBuilderChange({
      ...economyBuilder,
      laborMarket: updatedLaborMarket,
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

  const laborBounds = useMemo(() => getLaborBounds(selectedComponents), [selectedComponents]);

  // oxlint-disable-next-line eslint/no-unused-vars
  const hasComponentImpact =
    employmentImpacts.unemployment !== 0 ||
    employmentImpacts.participation !== 1 ||
    employmentImpacts.wageGrowth !== 1;

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Labor & Employment Configuration</h2>
      <p className="sr-only">
        Configure workforce dynamics, employment sectors, income, and worker rights.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Workforce"
          value={derivedMetrics.laborForceSize}
          icon={Users}
          sectionId="labor"
          trend="neutral"
          texture="dots"
          textureOpacity={0.04}
        />
        <MetricCard
          label="Unemployment Rate"
          value={economyBuilder.laborMarket.unemploymentRate}
          unit="%"
          precision={1}
          icon={economyBuilder.laborMarket.unemploymentRate < 5 ? TrendingUp : TrendingDown}
          sectionId="labor"
          trend={economyBuilder.laborMarket.unemploymentRate < 5 ? "up" : "down"}
          texture="dots"
          textureOpacity={0.04}
        />
        <MetricCard
          label="Participation Rate"
          value={economyBuilder.laborMarket.laborForceParticipationRate}
          unit="%"
          precision={1}
          icon={Users}
          sectionId="labor"
          trend={economyBuilder.laborMarket.laborForceParticipationRate > 65 ? "up" : "neutral"}
          texture="dots"
          textureOpacity={0.04}
        />
        <MetricCard
          label="Avg Workweek"
          value={economyBuilder.laborMarket.averageWorkweekHours}
          unit=" hrs"
          precision={1}
          icon={TrendingDown}
          sectionId="labor"
          trend="neutral"
          texture="dots"
          textureOpacity={0.04}
        />
      </div>

      <div className="border-border bg-muted/30 flex space-x-1 rounded-xl border p-1 shadow-inner backdrop-blur-md">
        {[
          { id: "workforce", label: "Workforce", icon: Users },
          { id: "employment", label: "Employment", icon: Briefcase },
          { id: "income", label: "Income & Wages", icon: DollarSign },
          { id: "protections", label: "Worker Rights & Protections", icon: Shield },
        ].map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSection(section.id as any)}
              className={cn(
                "flex-1 rounded-lg transition-all duration-205",
                activeSection === section.id
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="mr-2 h-4 w-4" />
              {section.label}
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <GlassCard
          depth="base"
          theme="emerald"
          className="border-emerald-500/20"
          texture="chevron"
          textureOpacity={0.04}
        >
          <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              {activeSection === "workforce" && "Workforce Structure"}
              {activeSection === "employment" && "Employment Configuration"}
              {activeSection === "income" && "Income & Wage Settings"}
              {activeSection === "protections" && "Worker Protections"}
            </h3>
          </div>
          <GlassCardContent className="space-y-6 p-6">
            {activeSection === "workforce" && (
              <FieldIndicator fieldKey="participationRate" severity="none">
                <WorkforceSection
                  laborMarket={economyBuilder.laborMarket}
                  onChange={handleLaborChange}
                  showAdvanced={showAdvanced}
                  componentBounds={laborBounds}
                />
              </FieldIndicator>
            )}
            {activeSection === "employment" && (
              <FieldIndicator fieldKey="unemploymentRate" severity="none">
                <EmploymentSection
                  laborMarket={economyBuilder.laborMarket}
                  onChange={handleLaborChange}
                  onNestedChange={handleNestedLaborChange}
                  showAdvanced={showAdvanced}
                  componentBounds={laborBounds}
                />
              </FieldIndicator>
            )}
            {activeSection === "income" && (
              <FieldIndicator fieldKey="incomeSection" severity="none">
                <IncomeSection
                  laborMarket={economyBuilder.laborMarket}
                  onChange={handleLaborChange}
                  showAdvanced={showAdvanced}
                  componentBounds={laborBounds}
                />
              </FieldIndicator>
            )}
            {activeSection === "protections" && (
              <FieldIndicator fieldKey="protectionsSection" severity="none">
                <ProtectionsSection
                  laborMarket={economyBuilder.laborMarket}
                  onChange={handleLaborChange}
                  onNestedChange={handleNestedLaborChange}
                  showAdvanced={showAdvanced}
                  componentBounds={laborBounds}
                />
              </FieldIndicator>
            )}
          </GlassCardContent>
        </GlassCard>

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
