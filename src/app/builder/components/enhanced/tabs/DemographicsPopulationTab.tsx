"use client";

import { SectionTabs } from "./SectionTabs";
import React, { useState, useMemo } from "react";
import {
  Group as Users,
  Heart,
  GraduationCap,
  City as Building2,
  UserBadgeCheck as UserCheck,
  Lullaby as Baby,
  MapPin,
} from "iconoir-react";
import { MetricCard } from "../../../primitives/enhanced";
import type {
  EconomyBuilderState,
  DemographicsConfiguration,
  RegionDistribution,
} from "~/types/economy-builder";
import type { EconomicComponentType } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";
import {
  calculateDerivedDemographics,
  getRegionColor,
  balanceAgeDistribution,
} from "./utils/demographicsCalculations";
import { PopulationSection } from "./demographics/PopulationSection";
import { AgeDistributionSection } from "./demographics/AgeDistributionSection";
import { GeographicSection } from "./demographics/GeographicSection";
import { SocialIndicatorsSection } from "./demographics/SocialIndicatorsSection";
import { DemographicsVisualizations } from "./demographics/DemographicsVisualizations";
import { Card, CardContent } from "~/components/ui/card";

const determineRegionDevelopmentLevel = (
  region: RegionDistribution
): RegionDistribution["developmentLevel"] => {
  const activity = region.economicActivity ?? 0;
  const urban = region.urbanPercent ?? 0;

  if (activity >= 35 || urban >= 80) {
    return "Advanced";
  }
  if (activity >= 25 || urban >= 70) {
    return "Developed";
  }
  if (activity >= 15 || urban >= 55) {
    return "Developing";
  }
  return "Underdeveloped";
};

const clampToRange = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

interface DemographicsPopulationTabProps {
  economyBuilder: EconomyBuilderState;
  onEconomyBuilderChange: (builder: EconomyBuilderState) => void;
  selectedComponents: EconomicComponentType[];
  showAdvanced?: boolean;
}

const SECTIONS = [
  { id: "population", label: "Population", icon: Users },
  { id: "age", label: "Age structure", icon: Baby },
  { id: "geographic", label: "Geographic", icon: MapPin },
  { id: "social", label: "Social indicators", icon: GraduationCap },
] as const;

const SECTION_TITLES = {
  population: "Population Structure",
  age: "Age Distribution",
  geographic: "Geographic Distribution",
  social: "Social Indicators",
} as const satisfies Record<(typeof SECTIONS)[number]["id"], string>;

/** Demographic and population settings: population, age structure, geography and social indicators. */
export function DemographicsPopulationTab({
  economyBuilder,
  onEconomyBuilderChange,
  showAdvanced = false,
}: DemographicsPopulationTabProps) {
  const [activeSection, setActiveSection] = useState<
    "population" | "age" | "geographic" | "social"
  >("population");

  const handleDemographicsChange = <K extends keyof DemographicsConfiguration>(
    field: K,
    value: DemographicsConfiguration[K]
  ) => {
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, [field]: value },
    });
  };

  const handleNestedDemographicsChange = (
    parentField: keyof DemographicsConfiguration,
    field: string,
    value: number | string | boolean
  ) => {
    const parentObj = economyBuilder.demographics[parentField];
    let nextParentValue: Record<string, number | string | boolean> =
      typeof parentObj === "object" && parentObj !== null
        ? { ...(parentObj as Record<string, number | string | boolean>), [field]: value }
        : { [field]: value };

    // Auto-balance urban/rural split to sum to 100
    if (parentField === "urbanRuralSplit") {
      const val = typeof value === "number" ? value : parseFloat(String(value ?? 0));
      const safeVal = Number.isNaN(val) ? 0 : val;
      if (field === "urban") {
        nextParentValue = {
          urban: safeVal,
          rural: Math.round((100 - safeVal) * 10) / 10,
        };
      } else if (field === "rural") {
        nextParentValue = {
          rural: safeVal,
          urban: Math.round((100 - safeVal) * 10) / 10,
        };
      }
    }

    // Auto-balance age distribution fields to sum to 100
    if (parentField === "ageDistribution") {
      const val = typeof value === "number" ? value : parseFloat(String(value ?? 0));
      const safeVal = Number.isNaN(val) ? 0 : val;
      const currentDist = economyBuilder.demographics.ageDistribution;
      nextParentValue = balanceAgeDistribution(
        currentDist,
        field as "under15" | "age15to64" | "over65",
        safeVal
      );
    }

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: {
        ...economyBuilder.demographics,
        [parentField]: nextParentValue,
      },
    });
  };

  const handleRegionChange = <K extends keyof RegionDistribution>(
    regionIndex: number,
    field: K,
    value: RegionDistribution[K]
  ) => {
    const regionsCopy = economyBuilder.demographics.regions.map((region) => ({ ...region }));
    const targetRegion = regionsCopy[regionIndex];

    if (!targetRegion) {
      return;
    }

    let nextRegion = { ...targetRegion };

    switch (field) {
      case "populationPercent": {
        const numericValue = typeof value === "number" ? value : parseFloat(String(value ?? 0));
        const rounded =
          Math.round(clampToRange(Number.isNaN(numericValue) ? 0 : numericValue, 0, 100) * 10) / 10;

        const otherTotal = regionsCopy.reduce(
          (sum, region, index) =>
            index === regionIndex ? sum : sum + (region.populationPercent ?? 0),
          0
        );

        let adjusted = rounded;
        if (otherTotal + adjusted > 100) {
          adjusted = Math.max(0, 100 - otherTotal);
        }

        if (Math.abs(otherTotal + adjusted - 100) <= 0.5) {
          adjusted = Math.max(0, 100 - otherTotal);
        }

        adjusted = Math.round(adjusted * 10) / 10;
        if (otherTotal + adjusted > 100) {
          adjusted = Math.max(0, Math.round((100 - otherTotal) * 10) / 10);
        }

        nextRegion.populationPercent = adjusted;
        nextRegion.population = Math.round(
          (economyBuilder.demographics.totalPopulation || 0) * (adjusted / 100)
        );
        break;
      }
      case "urbanPercent": {
        const numericValue = typeof value === "number" ? value : parseFloat(String(value ?? 0));
        nextRegion.urbanPercent = Math.round(
          clampToRange(Number.isNaN(numericValue) ? 0 : numericValue, 0, 100)
        );
        break;
      }
      case "economicActivity": {
        const numericValue = typeof value === "number" ? value : parseFloat(String(value ?? 0));
        nextRegion.economicActivity = Math.round(
          clampToRange(Number.isNaN(numericValue) ? 0 : numericValue, 0, 50)
        );
        break;
      }
      default: {
        nextRegion = { ...nextRegion, [field]: value };
      }
    }

    regionsCopy[regionIndex] = {
      ...nextRegion,
      developmentLevel: determineRegionDevelopmentLevel(nextRegion),
    };

    const normalizedRegions = regionsCopy.map((region) => ({
      ...region,
      developmentLevel: determineRegionDevelopmentLevel(region),
    }));

    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, regions: normalizedRegions },
    });
  };

  const addRegion = () => {
    const regionNumber = economyBuilder.demographics.regions.length + 1;
    const existingTotalPercent = economyBuilder.demographics.regions.reduce(
      (sum, region) => sum + (region.populationPercent ?? 0),
      0
    );
    const remainingPercent = Math.max(0, 100 - existingTotalPercent);
    const allocatedPercent = remainingPercent > 0 ? Math.min(remainingPercent, 15) : 5;
    const populationPercent = Number(allocatedPercent.toFixed(1));
    const population = Math.round(
      (economyBuilder.demographics.totalPopulation || 0) * (populationPercent / 100)
    );

    const newRegion: RegionDistribution = {
      name: `New Region ${regionNumber}`,
      population,
      populationPercent,
      urbanPercent: 60,
      economicActivity: 18,
      developmentLevel: "Developing",
    };
    newRegion.developmentLevel = determineRegionDevelopmentLevel(newRegion);
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: {
        ...economyBuilder.demographics,
        regions: [...economyBuilder.demographics.regions, newRegion],
      },
    });
  };

  const removeRegion = (index: number) => {
    const updatedRegions = economyBuilder.demographics.regions.filter((_, i) => i !== index);
    onEconomyBuilderChange({
      ...economyBuilder,
      demographics: { ...economyBuilder.demographics, regions: updatedRegions },
    });
  };

  const derivedMetrics = useMemo(
    () => calculateDerivedDemographics(economyBuilder.demographics),
    [economyBuilder.demographics]
  );

  const chartData = useMemo(
    () => ({
      ageDistributionData: [
        {
          name: "Under 15",
          value: economyBuilder.demographics.ageDistribution.under15,
          color: "blue",
        },
        {
          name: "15-64",
          value: economyBuilder.demographics.ageDistribution.age15to64,
          color: "green",
        },
        { name: "65+", value: economyBuilder.demographics.ageDistribution.over65, color: "orange" },
      ],
      urbanRuralData: [
        { name: "Urban", value: economyBuilder.demographics.urbanRuralSplit.urban, color: "blue" },
        { name: "Rural", value: economyBuilder.demographics.urbanRuralSplit.rural, color: "green" },
      ],
      educationLevelData: Object.entries(economyBuilder.demographics.educationLevels).map(
        ([key, value]) => ({
          name: key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
          value,
          color: ["red", "orange", "yellow", "green"][
            ["noEducation", "primary", "secondary", "tertiary"].indexOf(key)
          ],
        })
      ),
      regionData: economyBuilder.demographics.regions.map((region, index) => ({
        name: region.name,
        value: region.populationPercent,
        color: getRegionColor(index),
      })),
    }),
    [economyBuilder.demographics]
  );

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Demographics & population configuration</h2>
      <p className="sr-only">
        Configure population structure, regional population shares, urban-rural distribution, and
        education/health indicators.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total population"
          value={derivedMetrics.workingAge + derivedMetrics.youthPop + derivedMetrics.elderlyPop}
          icon={Users}
          sectionId="demographics"
          trend="neutral"
        />
        <MetricCard
          label="Working age (15-64)"
          value={`${derivedMetrics.workingAgeShare.toFixed(1)}%`}
          icon={UserCheck}
          sectionId="demographics"
          trend={derivedMetrics.workingAgeShare > 65 ? "up" : "neutral"}
        />
        <MetricCard
          label="Life expectancy"
          value={`${economyBuilder.demographics.lifeExpectancy.toFixed(1)} years`}
          icon={Heart}
          sectionId="demographics"
          trend={economyBuilder.demographics.lifeExpectancy > 75 ? "up" : "neutral"}
        />
        <MetricCard
          label="Urban population"
          value={`${derivedMetrics.urbanShare.toFixed(1)}%`}
          icon={Building2}
          sectionId="demographics"
          trend={derivedMetrics.urbanShare > 70 ? "up" : "neutral"}
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
            {activeSection === "population" && (
              <PopulationSection
                demographics={economyBuilder.demographics}
                onChange={handleDemographicsChange}
                showAdvanced={showAdvanced}
              />
            )}
            {activeSection === "age" && (
              <AgeDistributionSection
                demographics={economyBuilder.demographics}
                onChange={handleNestedDemographicsChange}
                showAdvanced={showAdvanced}
              />
            )}
            {activeSection === "geographic" && (
              <GeographicSection
                demographics={economyBuilder.demographics}
                onChange={handleNestedDemographicsChange}
                onRegionChange={handleRegionChange}
                onAddRegion={addRegion}
                onRemoveRegion={removeRegion}
              />
            )}
            {activeSection === "social" && (
              <SocialIndicatorsSection
                demographics={economyBuilder.demographics}
                onChange={handleDemographicsChange}
                onNestedChange={handleNestedDemographicsChange}
                showAdvanced={showAdvanced}
              />
            )}
          </CardContent>
        </Card>

        <DemographicsVisualizations demographics={economyBuilder.demographics} {...chartData} />
      </div>
    </div>
  );
}
