"use client";

import { SectionTabs } from "./SectionTabs";
import React, { useState, useMemo } from "react";
import {
  Group as Users,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Dollar as DollarSign,
  Shield,
  Suitcase as Briefcase,
} from "iconoir-react";
import { MetricCard } from "../../../primitives/enhanced";
import type { EconomyBuilderState, LaborConfiguration } from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
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
import { Card, CardContent } from "~/components/ui/card";

interface LaborEmploymentTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

const SECTIONS = [
  { id: "workforce", label: "Workforce", icon: Users },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "income", label: "Income & wages", icon: DollarSign },
  { id: "protections", label: "Worker rights & protections", icon: Shield },
] as const;

const SECTION_TITLES = {
  workforce: "Workforce structure",
  employment: "Employment",
  income: "Income and wages",
  protections: "Worker protections",
} as const satisfies Record<(typeof SECTIONS)[number]["id"], string>;

/** Labor market settings: workforce, employment, income and wages, and worker protections. */
export function LaborEmploymentTab({
  economyBuilder,
  onEconomyBuilderChange,
  selectedComponents,
  showAdvanced = false,
}: LaborEmploymentTabProps) {
  const [activeSection, setActiveSection] = useState<
    "workforce" | "employment" | "income" | "protections"
  >("workforce");

  const handleLaborChange = <K extends keyof LaborConfiguration>(
    field: K,
    value: LaborConfiguration[K]
  ) => {
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
    value: number | string | boolean
  ) => {
    const parentObj = (economyBuilder.laborMarket[parentField] || {}) as Record<
      string,
      number | string | boolean
    >;
    onEconomyBuilderChange({
      ...economyBuilder,
      laborMarket: {
        ...economyBuilder.laborMarket,
        [parentField]: { ...parentObj, [field]: value },
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

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Labor & employment configuration</h2>
      <p className="sr-only">
        Configure workforce dynamics, employment sectors, income, and worker rights.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total workforce"
          value={derivedMetrics.laborForceSize}
          icon={Users}
          sectionId="labor"
          trend="neutral"
        />
        <MetricCard
          label="Unemployment rate"
          value={economyBuilder.laborMarket.unemploymentRate}
          unit="%"
          precision={1}
          icon={economyBuilder.laborMarket.unemploymentRate < 5 ? TrendingUp : TrendingDown}
          sectionId="labor"
          trend={economyBuilder.laborMarket.unemploymentRate < 5 ? "up" : "down"}
        />
        <MetricCard
          label="Participation rate"
          value={economyBuilder.laborMarket.laborForceParticipationRate}
          unit="%"
          precision={1}
          icon={Users}
          sectionId="labor"
          trend={economyBuilder.laborMarket.laborForceParticipationRate > 65 ? "up" : "neutral"}
        />
        <MetricCard
          label="Avg workweek"
          value={economyBuilder.laborMarket.averageWorkweekHours}
          unit=" hrs"
          precision={1}
          icon={TrendingDown}
          sectionId="labor"
          trend="neutral"
        />
      </div>

      <SectionTabs sections={SECTIONS} active={activeSection} onChange={setActiveSection} />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-separator border-b px-6 py-4">
            <h3 className="text-label text-headline flex items-center gap-2">
              {SECTION_TITLES[activeSection]}
            </h3>
          </div>
          <CardContent className="space-y-6 p-6">
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
