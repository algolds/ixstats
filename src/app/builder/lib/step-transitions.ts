import { findArchetype } from "~/lib/economy/archetypes/registry";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import { mapLegacyGovernmentComponents } from "~/hooks/useArchetypes";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { GovernmentBuilderState, GovernmentType } from "~/types/government";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { BuilderState } from "../hooks/builderStateTypes";
import { sanitizeEconomicInputs } from "../hooks/builderStateTypes";
import { STARTING_EMPLOYMENT_TYPE, STARTING_SECTOR_DISTRIBUTION } from "./default-labor-market";
import { createDefaultEconomicInputs } from "./economy-data-service";
import type { EconomicInputs, RealCountryData } from "./economy-data-service";

export const emptyGovernmentErrors = () => ({
  structure: [],
  departments: {},
  budget: [],
  revenue: [],
});

const PLACEHOLDER_GOVERNMENT_NAME = "Government of the Nation";

/** Tax categories seeded from an archetype's tax profile, keyed to the rate each one reads. */
const ARCHETYPE_TAX_CATEGORIES = [
  {
    categoryName: "Personal Income Tax",
    categoryType: "Direct Tax",
    description: "Tax on personal earnings",
    rate: "incomeRate",
    deductionAllowed: true,
    color: "#3b82f6",
  },
  {
    categoryName: "Corporate Income Tax",
    categoryType: "Direct Tax",
    description: "Tax on corporate profits",
    rate: "corporateRate",
    deductionAllowed: true,
    color: "#10b981",
  },
  {
    categoryName: "Consumption/Sales Tax",
    categoryType: "Indirect Tax",
    description: "Tax on goods and services",
    rate: "consumptionRate",
    deductionAllowed: false,
    color: "#f59e0b",
  },
] as const;

function archetypeTaxSystem(archetype: EconomicArchetype, countryName: string): TaxBuilderState {
  return {
    taxSystem: {
      taxSystemName: `${countryName} Tax System`,
      fiscalYear: "Calendar Year",
      progressiveTax: true,
      alternativeMinTax: false,
    },
    categories: ARCHETYPE_TAX_CATEGORIES.map(({ rate, ...category }, index) => ({
      ...category,
      isActive: true,
      calculationMethod: "percentage" as const,
      baseRate: archetype.taxProfile[rate],
      priority: (index + 1) * 10,
    })),
    brackets: {},
    exemptions: [],
    deductions: {},
    isValid: true,
    errors: {},
  };
}

function archetypeEconomyState(
  archetype: EconomicArchetype,
  country: RealCountryData
): EconomyBuilderState {
  const participation = archetype.employmentProfile?.laborParticipation ?? 65.0;
  const population = country.population || 10000000;
  return {
    selectedAtomicComponents: archetype.economicComponents,
    structure: {
      economicModel: "Mixed Economy",
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: country.gdp || 1000000000,
      gdpCurrency: "USD",
      economicTier: "Developing",
      growthStrategy: "Balanced",
    },
    sectors: [],
    laborMarket: {
      totalWorkforce: Math.round(population * (participation / 100)),
      laborForceParticipationRate: participation,
      employmentRate: 95.0,
      unemploymentRate: archetype.employmentProfile?.unemploymentRate ?? 5.0,
      underemploymentRate: 5.0,
      youthUnemploymentRate: 10.0,
      seniorEmploymentRate: 20.0,
      femaleParticipationRate: 60.0,
      maleParticipationRate: 70.0,
      sectorDistribution: { ...STARTING_SECTOR_DISTRIBUTION },
      employmentType: { ...STARTING_EMPLOYMENT_TYPE },
      averageWorkweekHours: 40,
      averageOvertimeHours: 2,
      averageAnnualIncome: 30000,
      paidVacationDays: 20,
      paidSickLeaveDays: 10,
      parentalLeaveWeeks: 12,
      unionizationRate: 15,
      collectiveBargainingCoverage: 20,
      minimumWageHourly: 15,
      livingWageHourly: 20,
      workplaceSafetyIndex: 75,
      laborRightsScore: 70,
      workerProtections: {
        jobSecurity: 70,
        wageProtection: 75,
        healthSafety: 80,
        discriminationProtection: 75,
        collectiveRights: 70,
      },
    },
    demographics: {
      totalPopulation: population,
      populationGrowthRate: 1.0,
      ageDistribution: { under15: 20, age15to64: 65, over65: 15 },
      urbanRuralSplit: { urban: 65, rural: 35 },
      regions: [],
      lifeExpectancy: 75,
      literacyRate: 95,
      educationLevels: { noEducation: 2, primary: 18, secondary: 55, tertiary: 25 },
      netMigrationRate: 0,
      immigrationRate: 2,
      emigrationRate: 2,
      infantMortalityRate: 5,
      maternalMortalityRate: 10,
      healthExpenditureGDP: 8,
      youthDependencyRatio: 30,
      elderlyDependencyRatio: 23,
      totalDependencyRatio: 53,
    },
    isValid: true,
    errors: {},
    lastUpdated: new Date(),
    version: "1.0.0",
  };
}

function overlayArchetypeMetrics(inputs: EconomicInputs, archetype: EconomicArchetype) {
  if (archetype.growthMetrics?.gdpGrowth !== undefined) {
    inputs.coreIndicators = {
      ...inputs.coreIndicators,
      realGDPGrowthRate: archetype.growthMetrics.gdpGrowth,
    };
  }
  if (archetype.employmentProfile) {
    inputs.laborEmployment = {
      ...inputs.laborEmployment,
      unemploymentRate: archetype.employmentProfile.unemploymentRate,
      laborForceParticipationRate: archetype.employmentProfile.laborParticipation,
    };
  }
}

function archetypeGovernment(
  existing: GovernmentBuilderState | null,
  country: RealCountryData,
  name: string
): GovernmentBuilderState {
  return {
    structure: {
      governmentName: `Government of ${name}`,
      governmentType: "Republic" as GovernmentType,
      headOfState: "President",
      headOfGovernment: "Prime Minister",
      legislatureName: "National Assembly",
      executiveName: "Council of Ministers",
      judicialName: "Supreme Court",
      totalBudget: Math.round((country.gdp || 100000000000) * 0.35),
      fiscalYear: "Calendar Year",
      budgetCurrency: "USD",
    },
    departments: existing?.departments || [],
    budgetAllocations: existing?.budgetAllocations || [],
    revenueSources: existing?.revenueSources || [],
    isValid: true,
    errors: emptyGovernmentErrors(),
  };
}

/** Seeds government, economy, tax and identity defaults from the chosen archetype. */
function seedFromArchetype(
  state: BuilderState,
  archetype: EconomicArchetype,
  country: RealCountryData
) {
  const name = country.name || archetype.name;
  const inputs = state.economicInputs;

  if (archetype.governmentComponents) {
    state.governmentComponents = mapLegacyGovernmentComponents(
      archetype.governmentComponents as string[]
    );
  }

  const identity = inputs?.nationalIdentity;
  if (identity && (!identity.countryName || identity.countryName === "Custom Nation")) {
    identity.countryName = name;
    identity.officialName = `The Commonwealth of ${name}`;
  }
  if (inputs) overlayArchetypeMetrics(inputs, archetype);

  if (!state.governmentStructure?.structure?.governmentType) {
    state.governmentStructure = archetypeGovernment(state.governmentStructure, country, name);
  }
  if (archetype.economicComponents) {
    state.economyBuilderState = archetypeEconomyState(archetype, country);
  }
  if (archetype.taxProfile) {
    state.taxSystemData = archetypeTaxSystem(archetype, country.name);
  }
}

function blankGovernment(
  name: string,
  governmentType: string,
  totalBudget: number
): GovernmentBuilderState {
  return {
    structure: {
      governmentName: `Government of ${name}`,
      governmentType: governmentType as GovernmentType,
      headOfState: "",
      headOfGovernment: "",
      legislatureName: "",
      executiveName: "",
      judicialName: "",
      totalBudget,
      fiscalYear: "Calendar Year",
      budgetCurrency: "USD",
    },
    departments: [],
    budgetAllocations: [],
    revenueSources: [],
    isValid: true,
    errors: emptyGovernmentErrors(),
  };
}

/** Choosing a foundation country (or nothing, for a custom nation) restarts the economy. */
export function applyFoundationStep(
  state: BuilderState,
  data: Partial<BuilderState> | RealCountryData | null | undefined
) {
  const country = data as RealCountryData | null;
  state.selectedCountry = country;
  state.economyBuilderState = null;

  const origin = (data as Partial<BuilderState> | null | undefined)?.creationOrigin;
  if (origin) {
    state.creationOrigin = origin;
  } else if (country?.countryCode === "custom" || country?.name === "Custom Nation") {
    state.creationOrigin = "scratch";
  } else if (country) {
    state.creationOrigin = "template";
  }
  if (!country) return;

  state.economicInputs = sanitizeEconomicInputs(createDefaultEconomicInputs(country));
  const archetype = state.selectedArchetypeId ? findArchetype(state.selectedArchetypeId) : null;
  if (archetype) seedFromArchetype(state, archetype, country);

  const structure = state.governmentStructure?.structure;
  if (!structure || structure.governmentName === PLACEHOLDER_GOVERNMENT_NAME) {
    state.governmentStructure = blankGovernment(
      country.name,
      archetype?.name || country.governmentType || "Other",
      (country.gdp || 1000000000) * 0.35
    );
  }
}

const ROLE_FIELDS = [
  "headOfState",
  "headOfGovernment",
  "legislatureName",
  "executiveName",
  "judicialName",
] as const;

/** A government the user named: neither a placeholder nor the one a foundation pick generated. */
function hasCustomizedGovernment(state: BuilderState): boolean {
  const name = state.governmentStructure?.structure?.governmentName;
  return (
    name !== undefined &&
    name !== PLACEHOLDER_GOVERNMENT_NAME &&
    !name.startsWith("Government of Custom Nation") &&
    name !== (state.selectedCountry && `Government of ${state.selectedCountry.name}`)
  );
}

function refreshedGovernment(
  existing: GovernmentBuilderState | null,
  inputs: EconomicInputs,
  countryName: string
): GovernmentBuilderState {
  const keptRoles = Object.fromEntries(
    ROLE_FIELDS.map((field) => [field, existing?.structure?.[field] || ""])
  );
  return {
    ...existing,
    structure: {
      ...keptRoles,
      governmentName: `Government of ${countryName}`,
      governmentType: (inputs.nationalIdentity?.governmentType || "Other") as GovernmentType,
      totalBudget: (inputs.coreIndicators?.nominalGDP || 1000000000) * 0.35,
      fiscalYear: existing?.structure?.fiscalYear || "Calendar Year",
      budgetCurrency: inputs.nationalIdentity?.currency || "USD",
    },
    departments: existing?.departments || [],
    budgetAllocations: existing?.budgetAllocations || [],
    revenueSources: existing?.revenueSources || [],
    isValid: true,
    errors: existing?.errors || emptyGovernmentErrors(),
  } as GovernmentBuilderState;
}

/** Entering the core step keeps a customized government and refreshes any placeholder one. */
export function applyCoreStep(state: BuilderState, inputs: EconomicInputs) {
  state.economicInputs = sanitizeEconomicInputs(inputs);
  if (!inputs || hasCustomizedGovernment(state)) return;
  const countryName = inputs.countryName || state.selectedCountry?.name || "the Nation";
  state.governmentStructure = refreshedGovernment(state.governmentStructure, inputs, countryName);
}
