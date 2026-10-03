// src/types/economics.ts
// SINGLE SOURCE OF TRUTH — All economy schemas and types.
// ❌ No duplicate interface definitions.
// ✅ Zod schemas + z.infer derived types.

import { z } from "zod";

// Discriminated unions (core enums)

const RegionTypeSchema = z.enum([
  "Developed",
  "Emerging",
  "Developing",
  "Fragile",
  "ResourceRich",
  "PostIndustrial",
]);
const EconomicClassSchema = z.enum([
  "LowerClass",
  "WorkingClass",
  "LowerMiddleClass",
  "MiddleClass",
  "UpperMiddleClass",
  "UpperClass",
]);
const TaxBracketSchema = z.enum(["Low", "Middle", "High", "Top"]);
const CorporateSizeSchema = z.enum(["Small", "Medium", "Large", "Multinational"]);
// Core indicators

const CoreEconomicIndicatorsSchema = z.object({
  totalPopulation: z.number(),
  nominalGDP: z.number(),
  gdpPerCapita: z.number(),
  realGDPGrowthRate: z.number(),
  inflationRate: z.number(),
  currencyExchangeRate: z.number(),
  giniCoefficient: z.number().optional(),
});

// Extended core with nullable DB-sourced fields (UI-consumed)
const CoreEconomicIndicatorsDataSchema = CoreEconomicIndicatorsSchema.extend({
  // Trade data (from EconomicProfile relation)
  sectorBreakdown: z.record(z.string(), z.unknown()).nullable().optional(),
  tradeBalance: z.number().nullable().optional(),
  exportsGDPPercent: z.number().nullable().optional(),
  importsGDPPercent: z.number().nullable().optional(),
  // Indices (from EconomicProfile relation)
  gdpVolatility: z.number().nullable().optional(),
  economicComplexity: z.number().nullable().optional(),
  innovationIndex: z.number().nullable().optional(),
  competitivenessRank: z.number().nullable().optional(),
  easeOfDoingBusiness: z.number().nullable().optional(),
  corruptionIndex: z.number().nullable().optional(),
});

// Labor — sub-schemas for nested objects

const EmploymentBySectorSchema = z.object({
  agriculture: z.number(),
  industry: z.number(),
  services: z.number(),
});

const EmploymentByTypeSchema = z.object({
  fullTime: z.number(),
  partTime: z.number(),
  temporary: z.number(),
  selfEmployed: z.number(),
  informal: z.number(),
});

const SkillsAndProductivitySchema = z.object({
  averageEducationYears: z.number(),
  tertiaryEducationRate: z.number(),
  vocationalTrainingRate: z.number(),
  skillsGapIndex: z.number(),
  laborProductivityIndex: z.number(),
  productivityGrowthRate: z.number(),
});

const DemographicsAndConditionsSchema = z.object({
  youthUnemploymentRate: z.number(),
  femaleParticipationRate: z.number(),
  genderPayGap: z.number(),
  unionizationRate: z.number(),
  workplaceSafetyIndex: z.number(),
  averageCommutingTime: z.number(),
});

const RegionalEmploymentSchema = z.object({
  urban: z.object({
    participationRate: z.number(),
    unemploymentRate: z.number(),
    averageIncome: z.number(),
  }),
  rural: z.object({
    participationRate: z.number(),
    unemploymentRate: z.number(),
    averageIncome: z.number(),
  }),
});

const SocialProtectionSchema = z.object({
  unemploymentBenefitCoverage: z.number(),
  pensionCoverage: z.number(),
  healthInsuranceCoverage: z.number(),
  paidSickLeaveDays: z.number(),
  paidVacationDays: z.number(),
  parentalLeaveWeeks: z.number(),
});

// Strict labor schema (for template validation)
const LaborEmploymentSchema = z.object({
  laborForceParticipationRate: z.number(),
  employmentRate: z.number(),
  unemploymentRate: z.number(),
  totalWorkforce: z.number(),
  averageWorkweekHours: z.number(),
  minimumWage: z.number(),
  averageAnnualIncome: z.number(),
  laborProtections: z.boolean().optional(),

  youthUnemploymentRate: z.number().optional(),
  informalEmploymentRate: z.number().optional(),
  femaleParticipationRate: z.number().optional(),
  medianWage: z.number().optional(),
  wageGrowthRate: z.number().optional(),

  pensionCoverage: z.number().optional(),
  healthInsuranceCoverage: z.number().optional(),
  paidSickLeaveDays: z.number().optional(),
  paidVacationDays: z.number().optional(),
  parentalLeaveWeeks: z.number().optional(),
});

// Extended labor with nested sub-objects for UI consumption
const LaborEmploymentDataSchema = LaborEmploymentSchema.extend({
  employmentBySector: EmploymentBySectorSchema.optional(),
  employmentByType: EmploymentByTypeSchema.optional(),
  skillsAndProductivity: SkillsAndProductivitySchema.optional(),
  demographicsAndConditions: DemographicsAndConditionsSchema.optional(),
  regionalEmployment: RegionalEmploymentSchema.optional(),
  socialProtection: SocialProtectionSchema.optional(),
  // DB-sourced JSON fields
  wageBySector: z.record(z.string(), z.number()).nullable().optional(),
});

// Fiscal system

const FiscalSystemSchema = z.object({
  taxRevenueGDPPercent: z.number(),
  governmentRevenueTotal: z.number(),
  taxRevenuePerCapita: z.number(),
  governmentBudgetGDPPercent: z.number(),
  budgetDeficitSurplus: z.number(),
  internalDebtGDPPercent: z.number(),
  externalDebtGDPPercent: z.number(),
  totalDebtGDPRatio: z.number(),
  debtPerCapita: z.number(),
  interestRates: z.number(),
  debtServiceCosts: z.number(),

  taxRates: z.object({
    personalIncomeTaxRates: z.array(
      z.object({
        bracket: z.union([TaxBracketSchema, z.number()]),
        rate: z.number(),
      })
    ),

    corporateTaxRates: z.array(
      z.object({
        size: z.union([CorporateSizeSchema, z.string()]),
        rate: z.number(),
      })
    ),

    salesTaxRate: z.number(),
    propertyTaxRate: z.number(),
    payrollTaxRate: z.number(),
    wealthTaxRate: z.number(),

    exciseTaxRates: z.array(
      z.object({
        type: z.string(),
        rate: z.number(),
      })
    ),
  }),

  governmentSpendingByCategory: z.array(
    z.object({
      category: z.string(),
      amount: z.number(),
      percent: z.number(),
      gdpPercent: z.number().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      description: z.string().optional(),
    })
  ),
});

// Extended fiscal with nullable DB-sourced fields
const FiscalSystemDataSchema = FiscalSystemSchema.extend({
  taxEfficiency: z.number().nullable().optional(),
  fiscalBalanceGDPPercent: z.number().nullable().optional(),
});

// Income / wealth

const IncomeWealthSchema = z.object({
  economicClasses: z.array(
    z.object({
      name: z.union([EconomicClassSchema, z.string()]),
      populationPercent: z.number(),
      wealthPercent: z.number(),
      averageIncome: z.number(),
      color: z.string(),
    })
  ),

  povertyRate: z.number(),
  incomeInequalityGini: z.number(),
  socialMobilityIndex: z.number(),
});

// Extended income with nullable DB-sourced fields
const IncomeWealthDataSchema = IncomeWealthSchema.extend({
  top10PercentWealth: z.number().nullable().optional(),
  bottom50PercentWealth: z.number().nullable().optional(),
  middleClassPercent: z.number().nullable().optional(),
  intergenerationalMobility: z.number().nullable().optional(),
});

// Government spending

const GovernmentSpendingSchema = z.object({
  education: z.number(),
  healthcare: z.number(),
  socialSafety: z.number(),
  totalSpending: z.number(),
  spendingGDPPercent: z.number(),
  spendingPerCapita: z.number(),
  deficitSurplus: z.number(),

  spendingCategories: z.array(
    z.object({
      category: z.string(),
      amount: z.number(),
      percent: z.number(),
      gdpPercent: z.number().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      description: z.string().optional(),
    })
  ),

  // policy flags
  performanceBasedBudgeting: z.boolean(),
  universalBasicServices: z.boolean(),
  greenInvestmentPriority: z.boolean(),
  digitalGovernmentInitiative: z.boolean(),
  zeroBasedBudgeting: z.boolean(),
  publicPrivatePartnerships: z.boolean(),
  participatoryBudgeting: z.boolean(),
  emergencyReserveFund: z.boolean(),
  socialImpactBonds: z.boolean(),
  childWelfareFirstPolicy: z.boolean(),
  preventiveCareEmphasis: z.boolean(),
  infrastructureBankFund: z.boolean(),
  universalBasicIncome: z.boolean(),
  progressiveTaxation: z.boolean(),
  carbonTax: z.boolean(),
  wealthTax: z.boolean(),
  financialTransactionTax: z.boolean(),
  universalHealthcare: z.boolean(),
  freeEducation: z.boolean(),
  affordableHousing: z.boolean(),
  elderlyCare: z.boolean(),
  disabilitySupport: z.boolean(),
  mentalHealthServices: z.boolean(),
  stemEducationFocus: z.boolean(),
  vocationalTraining: z.boolean(),
  adultEducation: z.boolean(),
  earlyChildhoodEducation: z.boolean(),
  smartCityInitiative: z.boolean(),
  publicTransportExpansion: z.boolean(),
  renewableEnergyTransition: z.boolean(),
  highSpeedInternet: z.boolean(),
  waterInfrastructure: z.boolean(),
  researchDevelopmentFund: z.boolean(),
  startupIncubators: z.boolean(),
  patentReform: z.boolean(),
  openDataInitiative: z.boolean(),
  cybersecurityInitiative: z.boolean(),
  borderSecurity: z.boolean(),
  disasterPreparedness: z.boolean(),
  crimePrevention: z.boolean(),
  carbonNeutrality: z.boolean(),
  biodiversityProtection: z.boolean(),
  wasteReduction: z.boolean(),
  greenBuildingStandards: z.boolean(),
  sustainableAgriculture: z.boolean(),
  criminalJusticeReform: z.boolean(),
  legalAidExpansion: z.boolean(),
  restorativeJustice: z.boolean(),
  courtSystemModernization: z.boolean(),
  artsCultureFunding: z.boolean(),
  heritagePreservation: z.boolean(),
  multiculturalPrograms: z.boolean(),
  languagePreservation: z.boolean(),
  ruralDevelopment: z.boolean(),
  ruralHealthcare: z.boolean(),
  ruralBroadband: z.boolean(),
  agriculturalSupport: z.boolean(),
  foreignAidProgram: z.boolean(),
  refugeeSupport: z.boolean(),
  diplomaticEngagement: z.boolean(),
  tradePromotion: z.boolean(),
  transparencyInitiative: z.boolean(),
  citizenEngagement: z.boolean(),
  antiCorruption: z.boolean(),
  publicServiceReform: z.boolean(),
});

// Extended spending with nullable DB-sourced fields
const GovernmentSpendingDataSchema = GovernmentSpendingSchema.extend({
  spendingEfficiency: z.number().nullable().optional(),
  socialSpendingPercent: z.number().nullable().optional(),
});

// Demographics

const DemographicsSchema = z.object({
  lifeExpectancy: z.number(),

  urbanRuralSplit: z.object({
    urban: z.number(),
    rural: z.number(),
  }),

  ageDistribution: z.array(
    z.object({
      group: z.string(),
      percent: z.number(),
      percentage: z.number().optional(),
      color: z.string().optional(),
    })
  ),

  regions: z.array(
    z.object({
      name: z.string(),
      region: z.string().optional(),
      population: z.number(),
      urbanPercent: z.number().optional(),
      percentage: z.number().optional(),
      type: RegionTypeSchema.optional(),
      color: z.string().optional(),
    })
  ),

  educationLevels: z.array(
    z.object({
      level: z.string(),
      percent: z.number(),
      percentage: z.number().optional(),
      color: z.string().optional(),
    })
  ),

  literacyRate: z.number(),

  citizenshipStatuses: z.array(
    z.object({
      status: z.string(),
      percent: z.number(),
      color: z.string().optional(),
    })
  ),
});

// Extended demographics with nullable DB-sourced fields
const DemographicsDataSchema = DemographicsSchema.extend({
  medianAge: z.number().nullable().optional(),
  dependencyRatio: z.number().nullable().optional(),
  birthRate: z.number().nullable().optional(),
  deathRate: z.number().nullable().optional(),
  migrationRate: z.number().nullable().optional(),
  regionalDistribution: z
    .array(
      z.object({
        name: z.string(),
        region: z.string().optional(),
        population: z.number(),
        urbanPercent: z.number().optional(),
        percentage: z.number().optional(),
        color: z.string().optional(),
      })
    )
    .optional(),
});

// ROOT SCHEMAS

// STRICT schema — for template validation
// FULL DATA schema — for UI consumption (includes all extended nullable fields)
export const EconomyDataSchema = z.object({
  core: CoreEconomicIndicatorsDataSchema,
  labor: LaborEmploymentDataSchema,
  fiscal: FiscalSystemDataSchema,
  income: IncomeWealthDataSchema,
  spending: GovernmentSpendingDataSchema,
  demographics: DemographicsDataSchema,
});

// TYPES (inferred - NO MANUAL TYPES)

// Strict types (for templates / factory presets)
// Extended types (for UI / mapper — imported by consumers)
export type EconomyData = z.infer<typeof EconomyDataSchema>;
export type FiscalSystemData = z.infer<typeof FiscalSystemDataSchema>;
export type GovernmentSpendingData = z.infer<typeof GovernmentSpendingDataSchema>;
export type DemographicsData = z.infer<typeof DemographicsDataSchema>;

// Sub-object types (for component props)
// PARSERS

export function safeParseEconomyData(data: unknown) {
  return EconomyDataSchema.safeParse(data);
}

// ECONOMIC MODELING & PROJECTIONS

export type CountryEconomicSummary = {
  id: string;
  name: string;
  population?: number;
  economicData?: {
    gdp?: number;
  };
};

export type EconomicYearData = {
  year: number;
  gdp?: number;
  inflation?: number;
  unemployment?: number;
};

export type StorytellerEffect = {
  id: string;
  countryId: string;
};

type SectoralOutput = {
  year: number;
  agriculture: number;
  industry: number;
  services: number;
  government: number;
  totalGDP: number;
};

type PolicyEffect = {
  id: string;
  name: string;
  description: string;
  gdpEffectPercentage: number;
  inflationEffectPercentage: number;
  employmentEffectPercentage: number;
  yearImplemented: number;
  durationYears: number;
  economicModelId: string;
};

export type EconomicModel = {
  id: string;
  countryId: string;
  baseYear: number;
  projectionYears: number;
  gdpGrowthRate: number;
  inflationRate: number;
  unemploymentRate: number;
  interestRate: number;
  exchangeRate: number;
  populationGrowthRate: number;
  investmentRate: number;
  fiscalBalance: number;
  tradeBalance: number;
  sectoralOutputs: SectoralOutput[];
  policyEffects: PolicyEffect[];
};
