import type { EconomyBuilderState, SectorConfiguration } from "~/types/economy-builder";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";
import { getRegionColor } from "../tabs/utils/demographicsCalculations";

export const DEFAULT_SECTORS: SectorConfiguration[] = [
  {
    id: "services_default",
    name: "Commercial & Consumer Services",
    category: "Tertiary",
    gdpContribution: 55,
    employmentShare: 55,
    productivity: 75,
    growthRate: 2.5,
    exports: 15,
    imports: 10,
    technologyLevel: "Modern",
    automation: 25,
    regulation: "Moderate",
    subsidy: 5,
    innovation: 55,
    sustainability: 75,
    competitiveness: 65,
  },
  {
    id: "manufacturing_default",
    name: "Industrial Manufacturing",
    category: "Secondary",
    gdpContribution: 20,
    employmentShare: 20,
    productivity: 80,
    growthRate: 2.2,
    exports: 30,
    imports: 15,
    technologyLevel: "Modern",
    automation: 35,
    regulation: "Moderate",
    subsidy: 10,
    innovation: 60,
    sustainability: 65,
    competitiveness: 70,
  },
  {
    id: "technology_default",
    name: "High Technology & Software",
    category: "Tertiary",
    gdpContribution: 8,
    employmentShare: 8,
    productivity: 95,
    growthRate: 4.5,
    exports: 35,
    imports: 20,
    technologyLevel: "Advanced",
    automation: 45,
    regulation: "Light",
    subsidy: 15,
    innovation: 85,
    sustainability: 80,
    competitiveness: 80,
  },
  {
    id: "agriculture_default",
    name: "Agriculture & Food Systems",
    category: "Primary",
    gdpContribution: 5,
    employmentShare: 5,
    productivity: 65,
    growthRate: 1.5,
    exports: 20,
    imports: 10,
    technologyLevel: "Modern",
    automation: 20,
    regulation: "Moderate",
    subsidy: 20,
    innovation: 45,
    sustainability: 70,
    competitiveness: 55,
  },
  {
    id: "mining_default",
    name: "Mining & Resource Extraction",
    category: "Primary",
    gdpContribution: 5,
    employmentShare: 5,
    productivity: 70,
    growthRate: 1.8,
    exports: 40,
    imports: 5,
    technologyLevel: "Modern",
    automation: 30,
    regulation: "Heavy",
    subsidy: 5,
    innovation: 40,
    sustainability: 50,
    competitiveness: 60,
  },
  {
    id: "finance_default",
    name: "Banking & Financial Services",
    category: "Tertiary",
    gdpContribution: 5,
    employmentShare: 5,
    productivity: 90,
    growthRate: 3.0,
    exports: 25,
    imports: 10,
    technologyLevel: "Advanced",
    automation: 40,
    regulation: "Heavy",
    subsidy: 5,
    innovation: 70,
    sustainability: 75,
    competitiveness: 75,
  },
  {
    id: "government_default",
    name: "Public Administration",
    category: "Tertiary",
    gdpContribution: 2,
    employmentShare: 2,
    productivity: 70,
    growthRate: 1.0,
    exports: 0,
    imports: 0,
    technologyLevel: "Modern",
    automation: 20,
    regulation: "Comprehensive",
    subsidy: 0,
    innovation: 40,
    sustainability: 80,
    competitiveness: 50,
  },
];

export const DEFAULT_DEMOGRAPHICS: EconomyBuilderState["demographics"] = {
  totalPopulation: 0,
  populationGrowthRate: 0,
  ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
  urbanRuralSplit: { urban: 50, rural: 50 },
  regions: [],
  lifeExpectancy: 75,
  literacyRate: 90,
  educationLevels: { noEducation: 5, primary: 25, secondary: 45, tertiary: 25 },
  netMigrationRate: 0,
  immigrationRate: 0,
  emigrationRate: 0,
  infantMortalityRate: 10,
  maternalMortalityRate: 50,
  healthExpenditureGDP: 5,
  youthDependencyRatio: 30,
  elderlyDependencyRatio: 23,
  totalDependencyRatio: 53,
};

export function mergeDemographics(
  d: Partial<EconomyBuilderState["demographics"]> | undefined
): EconomyBuilderState["demographics"] {
  return {
    ...DEFAULT_DEMOGRAPHICS,
    ...d,
    ageDistribution: { ...DEFAULT_DEMOGRAPHICS.ageDistribution, ...d?.ageDistribution },
    urbanRuralSplit: { ...DEFAULT_DEMOGRAPHICS.urbanRuralSplit, ...d?.urbanRuralSplit },
    educationLevels: { ...DEFAULT_DEMOGRAPHICS.educationLevels, ...d?.educationLevels },
    regions: d?.regions ?? [],
  };
}

export function mergeEconomyBuilderIntoInputs(
  baseInputs: EconomicInputs,
  builder: EconomyBuilderState
): EconomicInputs {
  const safeBase: EconomicInputs = {
    ...baseInputs,
    coreIndicators: { ...baseInputs.coreIndicators },
    laborEmployment: { ...baseInputs.laborEmployment },
    demographics: {
      ...baseInputs.demographics,
      ageDistribution: baseInputs.demographics?.ageDistribution
        ? baseInputs.demographics.ageDistribution.map((group) => ({ ...group }))
        : [],
      regions: baseInputs.demographics?.regions
        ? baseInputs.demographics.regions.map((region) => ({ ...region }))
        : [],
      educationLevels: baseInputs.demographics?.educationLevels
        ? baseInputs.demographics.educationLevels.map((level) => ({ ...level }))
        : [],
      citizenshipStatuses: baseInputs.demographics?.citizenshipStatuses
        ? baseInputs.demographics.citizenshipStatuses.map((status) => ({ ...status }))
        : [],
    },
  };

  const totalPopulation =
    builder.demographics.totalPopulation || safeBase.coreIndicators.totalPopulation;
  const totalGDP = builder.structure.totalGDP || safeBase.coreIndicators.nominalGDP;
  const inferredGdpPerCapita =
    totalPopulation > 0 && totalGDP > 0
      ? totalGDP / totalPopulation
      : safeBase.coreIndicators.gdpPerCapita;

  safeBase.coreIndicators = {
    ...safeBase.coreIndicators,
    totalPopulation,
    nominalGDP: totalGDP,
    gdpPerCapita: inferredGdpPerCapita,
  };

  const workerProtectionValues = builder.laborMarket.workerProtections
    ? Object.values(builder.laborMarket.workerProtections)
    : [];
  const averageProtectionScore =
    workerProtectionValues.length > 0
      ? workerProtectionValues.reduce((sum, value) => sum + value, 0) /
        workerProtectionValues.length
      : undefined;

  safeBase.laborEmployment = {
    ...safeBase.laborEmployment,
    laborForceParticipationRate: builder.laborMarket.laborForceParticipationRate,
    employmentRate: builder.laborMarket.employmentRate,
    unemploymentRate: builder.laborMarket.unemploymentRate,
    totalWorkforce: builder.laborMarket.totalWorkforce,
    averageWorkweekHours: builder.laborMarket.averageWorkweekHours,
    minimumWage: builder.laborMarket.minimumWageHourly,
    averageAnnualIncome:
      typeof builder.laborMarket.averageAnnualIncome === "number"
        ? builder.laborMarket.averageAnnualIncome
        : safeBase.laborEmployment.averageAnnualIncome,
    laborProtections:
      averageProtectionScore !== undefined
        ? averageProtectionScore >= 60
        : safeBase.laborEmployment.laborProtections,
  };

  const ageDistribution = [
    {
      group: "0-14",
      percent: builder.demographics.ageDistribution.under15,
      color: safeBase.demographics.ageDistribution?.[0]?.color || "var(--color-chart-2)",
    },
    {
      group: "15-64",
      percent: builder.demographics.ageDistribution.age15to64,
      color: safeBase.demographics.ageDistribution?.[1]?.color || "var(--color-chart-3)",
    },
    {
      group: "65+",
      percent: builder.demographics.ageDistribution.over65,
      color: safeBase.demographics.ageDistribution?.[2]?.color || "var(--color-chart-4)",
    },
  ];

  const educationLevels = builder.demographics.educationLevels
    ? [
        {
          level: "No Formal Education",
          percent: builder.demographics.educationLevels.noEducation,
          color: safeBase.demographics.educationLevels?.[0]?.color || "var(--color-chart-5)",
        },
        {
          level: "Primary Education",
          percent: builder.demographics.educationLevels.primary,
          color: safeBase.demographics.educationLevels?.[1]?.color || "var(--color-chart-4)",
        },
        {
          level: "Secondary Education",
          percent: builder.demographics.educationLevels.secondary,
          color: safeBase.demographics.educationLevels?.[2]?.color || "var(--color-chart-3)",
        },
        {
          level: "Tertiary Education",
          percent: builder.demographics.educationLevels.tertiary,
          color: safeBase.demographics.educationLevels?.[3]?.color || "var(--color-chart-2)",
        },
      ]
    : safeBase.demographics.educationLevels;

  const regions = builder.demographics.regions?.length
    ? builder.demographics.regions.map((region, index) => ({
        name: region.name,
        population:
          region.population ||
          Math.round((totalPopulation * (region.populationPercent ?? 0)) / 100),
        urbanPercent: region.urbanPercent,
        color: safeBase.demographics.regions?.[index]?.color || getRegionColor(index),
      }))
    : safeBase.demographics.regions;

  safeBase.demographics = {
    ...safeBase.demographics,
    ageDistribution,
    regions,
    educationLevels,
    lifeExpectancy: builder.demographics.lifeExpectancy,
    literacyRate: builder.demographics.literacyRate,
    urbanRuralSplit: {
      urban: builder.demographics.urbanRuralSplit.urban,
      rural: builder.demographics.urbanRuralSplit.rural,
    },
    populationGrowthRate: builder.demographics.populationGrowthRate,
  };

  return safeBase;
}

export interface RevenueAdjustmentContext {
  taxBurdenRatio: number;
  revenueToGDPRatio: number;
  gdp: number;
}

export function applyGovernmentRevenueAdjustments(
  builder: EconomyBuilderState,
  { taxBurdenRatio, revenueToGDPRatio, gdp }: RevenueAdjustmentContext
): EconomyBuilderState {
  let laborMarket = builder.laborMarket;
  let structure = builder.structure;
  let changed = false;

  if (laborMarket?.sectorDistribution) {
    const currentGovernmentShare = laborMarket.sectorDistribution.government ?? 8;

    if (taxBurdenRatio > 35) {
      const desiredShare = Math.min(currentGovernmentShare + 2, 15);
      if (desiredShare !== currentGovernmentShare) {
        laborMarket = {
          ...laborMarket,
          sectorDistribution: {
            ...laborMarket.sectorDistribution,
            government: desiredShare,
          },
        };
        changed = true;
      }
    } else if (taxBurdenRatio < 20) {
      const desiredShare = Math.max(currentGovernmentShare - 1, 5);
      if (desiredShare !== currentGovernmentShare) {
        laborMarket = {
          ...laborMarket,
          sectorDistribution: {
            ...laborMarket.sectorDistribution,
            government: desiredShare,
          },
        };
        changed = true;
      }
    }
  }

  if (revenueToGDPRatio > 35 && gdp > 1_000_000_000_000 && structure.economicTier !== "Advanced") {
    structure = {
      ...structure,
      economicTier: "Advanced",
    };
    changed = true;
  }

  if (!changed) {
    return builder;
  }

  return {
    ...builder,
    laborMarket,
    structure,
    lastUpdated: new Date(),
  };
}

export function createDefaultEconomyBuilderState(
  economicInputs: EconomicInputs,
  persistedEconomyBuilder?: EconomyBuilderState | null
): EconomyBuilderState {
  const defaults: EconomyBuilderState = {
    structure: {
      economicModel: "Mixed Economy",
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: economicInputs.coreIndicators?.nominalGDP || 0,
      gdpCurrency: economicInputs.nationalIdentity?.currency || "USD",
      economicTier: "Developing" as const,
      growthStrategy: "Balanced",
    },
    sectors: DEFAULT_SECTORS,
    laborMarket: {
      totalWorkforce: Math.round((economicInputs.coreIndicators?.totalPopulation || 0) * 0.65),
      laborForceParticipationRate: 65,
      employmentRate: 95,
      unemploymentRate: 5,
      underemploymentRate: 3,
      youthUnemploymentRate: 10,
      seniorEmploymentRate: 30,
      femaleParticipationRate: 60,
      maleParticipationRate: 70,
      sectorDistribution: {
        agriculture: 5,
        mining: 2,
        manufacturing: 15,
        construction: 8,
        utilities: 2,
        wholesale: 5,
        retail: 12,
        transportation: 6,
        information: 5,
        finance: 8,
        professional: 10,
        education: 8,
        healthcare: 10,
        hospitality: 6,
        government: 8,
        other: 5,
      },
      employmentType: {
        fullTime: 70,
        partTime: 15,
        temporary: 5,
        seasonal: 3,
        selfEmployed: 10,
        gig: 3,
        informal: 4,
      },
      averageAnnualIncome:
        economicInputs.laborEmployment?.averageAnnualIncome ??
        Math.round((economicInputs.coreIndicators?.gdpPerCapita || 0) * 0.8),
      averageWorkweekHours: 40,
      averageOvertimeHours: 3,
      paidVacationDays: 15,
      paidSickLeaveDays: 10,
      parentalLeaveWeeks: 12,
      unionizationRate: 20,
      collectiveBargainingCoverage: 25,
      minimumWageHourly: 12,
      livingWageHourly: 18,
      workplaceSafetyIndex: 70,
      laborRightsScore: 65,
      workerProtections: {
        jobSecurity: 60,
        wageProtection: 65,
        healthSafety: 70,
        discriminationProtection: 75,
        collectiveRights: 55,
      },
    },
    demographics: {
      totalPopulation: economicInputs.coreIndicators?.totalPopulation || 0,
      populationGrowthRate: 0,
      ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
      urbanRuralSplit: { urban: 50, rural: 50 },
      regions: [],
      lifeExpectancy: 75,
      literacyRate: 90,
      educationLevels: { noEducation: 5, primary: 25, secondary: 45, tertiary: 25 },
      netMigrationRate: 0,
      immigrationRate: 0,
      emigrationRate: 0,
      infantMortalityRate: 10,
      maternalMortalityRate: 50,
      healthExpenditureGDP: 5,
      youthDependencyRatio: 30,
      elderlyDependencyRatio: 23,
      totalDependencyRatio: 53,
    },
    selectedAtomicComponents: [],
    isValid: true,
    errors: {
      structure: [],
      sectors: {},
      labor: [],
      demographics: [],
      atomicComponents: [],
      validation: [],
    },
    lastUpdated: new Date(),
    version: "1.0.0",
  };

  if (!persistedEconomyBuilder) return defaults;

  const p = persistedEconomyBuilder;
  return {
    ...defaults,
    ...p,
    structure: { ...defaults.structure, ...p.structure },
    laborMarket: {
      ...defaults.laborMarket,
      ...p.laborMarket,
      sectorDistribution: {
        ...defaults.laborMarket.sectorDistribution,
        ...p.laborMarket?.sectorDistribution,
      },
      employmentType: {
        ...defaults.laborMarket.employmentType,
        ...p.laborMarket?.employmentType,
      },
      workerProtections: {
        ...defaults.laborMarket.workerProtections,
        ...p.laborMarket?.workerProtections,
      },
      averageAnnualIncome:
        typeof p.laborMarket?.averageAnnualIncome === "number"
          ? p.laborMarket.averageAnnualIncome
          : defaults.laborMarket.averageAnnualIncome,
    },
    demographics: mergeDemographics(p.demographics),
  };
}
