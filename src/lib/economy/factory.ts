// src/lib/economy-factory.ts
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY — Creates schema-valid EconomyData objects.
// ❌ Never construct EconomyData from scratch outside this file.
// ✅ Always start from createEmptyEconomyData() and apply patches.
// ═══════════════════════════════════════════════════════════════════════════

import {
  EconomyDataSchema,
  type EconomyData,
  type GovernmentSpendingData,
} from "~/schemas/economics.schema";

// ===============================
// Policy flags default (all false)
// ===============================

const DEFAULT_POLICY_FLAGS: Pick<
  GovernmentSpendingData,
  | "performanceBasedBudgeting"
  | "universalBasicServices"
  | "greenInvestmentPriority"
  | "digitalGovernmentInitiative"
  | "zeroBasedBudgeting"
  | "publicPrivatePartnerships"
  | "participatoryBudgeting"
  | "emergencyReserveFund"
  | "socialImpactBonds"
  | "childWelfareFirstPolicy"
  | "preventiveCareEmphasis"
  | "infrastructureBankFund"
  | "universalBasicIncome"
  | "progressiveTaxation"
  | "carbonTax"
  | "wealthTax"
  | "financialTransactionTax"
  | "universalHealthcare"
  | "freeEducation"
  | "affordableHousing"
  | "elderlyCare"
  | "disabilitySupport"
  | "mentalHealthServices"
  | "stemEducationFocus"
  | "vocationalTraining"
  | "adultEducation"
  | "earlyChildhoodEducation"
  | "smartCityInitiative"
  | "publicTransportExpansion"
  | "renewableEnergyTransition"
  | "highSpeedInternet"
  | "waterInfrastructure"
  | "researchDevelopmentFund"
  | "startupIncubators"
  | "patentReform"
  | "openDataInitiative"
  | "cybersecurityInitiative"
  | "borderSecurity"
  | "disasterPreparedness"
  | "crimePrevention"
  | "carbonNeutrality"
  | "biodiversityProtection"
  | "wasteReduction"
  | "greenBuildingStandards"
  | "sustainableAgriculture"
  | "criminalJusticeReform"
  | "legalAidExpansion"
  | "restorativeJustice"
  | "courtSystemModernization"
  | "artsCultureFunding"
  | "heritagePreservation"
  | "multiculturalPrograms"
  | "languagePreservation"
  | "ruralDevelopment"
  | "ruralHealthcare"
  | "ruralBroadband"
  | "agriculturalSupport"
  | "foreignAidProgram"
  | "refugeeSupport"
  | "diplomaticEngagement"
  | "tradePromotion"
  | "transparencyInitiative"
  | "citizenEngagement"
  | "antiCorruption"
  | "publicServiceReform"
> = {
  performanceBasedBudgeting: false,
  universalBasicServices: false,
  greenInvestmentPriority: false,
  digitalGovernmentInitiative: false,
  zeroBasedBudgeting: false,
  publicPrivatePartnerships: false,
  participatoryBudgeting: false,
  emergencyReserveFund: false,
  socialImpactBonds: false,
  childWelfareFirstPolicy: false,
  preventiveCareEmphasis: false,
  infrastructureBankFund: false,
  universalBasicIncome: false,
  progressiveTaxation: false,
  carbonTax: false,
  wealthTax: false,
  financialTransactionTax: false,
  universalHealthcare: false,
  freeEducation: false,
  affordableHousing: false,
  elderlyCare: false,
  disabilitySupport: false,
  mentalHealthServices: false,
  stemEducationFocus: false,
  vocationalTraining: false,
  adultEducation: false,
  earlyChildhoodEducation: false,
  smartCityInitiative: false,
  publicTransportExpansion: false,
  renewableEnergyTransition: false,
  highSpeedInternet: false,
  waterInfrastructure: false,
  researchDevelopmentFund: false,
  startupIncubators: false,
  patentReform: false,
  openDataInitiative: false,
  cybersecurityInitiative: false,
  borderSecurity: false,
  disasterPreparedness: false,
  crimePrevention: false,
  carbonNeutrality: false,
  biodiversityProtection: false,
  wasteReduction: false,
  greenBuildingStandards: false,
  sustainableAgriculture: false,
  criminalJusticeReform: false,
  legalAidExpansion: false,
  restorativeJustice: false,
  courtSystemModernization: false,
  artsCultureFunding: false,
  heritagePreservation: false,
  multiculturalPrograms: false,
  languagePreservation: false,
  ruralDevelopment: false,
  ruralHealthcare: false,
  ruralBroadband: false,
  agriculturalSupport: false,
  foreignAidProgram: false,
  refugeeSupport: false,
  diplomaticEngagement: false,
  tradePromotion: false,
  transparencyInitiative: false,
  citizenEngagement: false,
  antiCorruption: false,
  publicServiceReform: false,
};

// ===============================
// FACTORY: Empty (all zeroed defaults)
// ===============================

/**
 * Creates a schema-valid EconomyData object with all required fields zeroed out
 * and all nullable fields set to null. Use this as the base for the patch system.
 *
 * @returns A fully schema-valid EconomyData with safe defaults
 */
export function createEmptyEconomyData(): EconomyData {
  return EconomyDataSchema.parse({
    core: {
      totalPopulation: 0,
      nominalGDP: 0,
      gdpPerCapita: 0,
      realGDPGrowthRate: 0,
      inflationRate: 0,
      currencyExchangeRate: 1,
    },
    labor: {
      laborForceParticipationRate: 0,
      employmentRate: 0,
      unemploymentRate: 0,
      totalWorkforce: 0,
      averageWorkweekHours: 0,
      minimumWage: 0,
      averageAnnualIncome: 0,
    },
    fiscal: {
      taxRevenueGDPPercent: 0,
      governmentRevenueTotal: 0,
      taxRevenuePerCapita: 0,
      governmentBudgetGDPPercent: 0,
      budgetDeficitSurplus: 0,
      internalDebtGDPPercent: 0,
      externalDebtGDPPercent: 0,
      totalDebtGDPRatio: 0,
      debtPerCapita: 0,
      interestRates: 0,
      debtServiceCosts: 0,
      taxRates: {
        personalIncomeTaxRates: [],
        corporateTaxRates: [],
        salesTaxRate: 0,
        propertyTaxRate: 0,
        payrollTaxRate: 0,
        wealthTaxRate: 0,
        exciseTaxRates: [],
      },
      governmentSpendingByCategory: [],
    },
    income: {
      economicClasses: [],
      povertyRate: 0,
      incomeInequalityGini: 0,
      socialMobilityIndex: 0,
    },
    spending: {
      education: 0,
      healthcare: 0,
      socialSafety: 0,
      totalSpending: 0,
      spendingGDPPercent: 0,
      spendingPerCapita: 0,
      deficitSurplus: 0,
      spendingCategories: [],
      ...DEFAULT_POLICY_FLAGS,
    },
    demographics: {
      lifeExpectancy: 0,
      urbanRuralSplit: { urban: 0, rural: 0 },
      ageDistribution: [],
      regions: [],
      educationLevels: [],
      literacyRate: 0,
      citizenshipStatuses: [],
    },
  } satisfies EconomyData);
}

// ===============================
// Shared helpers for presets
// ===============================

function spendingCategory(category: string, amount: number, percent: number) {
  return { category, amount, percent };
}

// ===============================
// PRESETS: Controlled, schema-validated economy presets
// ===============================

export type EconomyPresetTier = "developed" | "emerging" | "developing";

/**
 * Creates a schema-validated economy preset for a given economic tier.
 * Unlike templates, these are ALWAYS validated through EconomyDataSchema.parse()
 * so invalid shapes fail immediately.
 *
 * @param tier - The economic tier to create a preset for
 * @returns A fully schema-valid EconomyData preset
 */
export function createEconomyPreset(tier: EconomyPresetTier): EconomyData {
  switch (tier) {
    case "developed":
      return createDevelopedPreset();
    case "emerging":
      return createEmergingPreset();
    case "developing":
      return createDevelopingPreset();
  }
}

function createDevelopedPreset(): EconomyData {
  return EconomyDataSchema.parse({
    core: {
      totalPopulation: 50_000_000,
      nominalGDP: 2_100_000_000_000,
      gdpPerCapita: 42_000,
      realGDPGrowthRate: 0.018,
      inflationRate: 0.025,
      currencyExchangeRate: 1,
      giniCoefficient: 32,
    },
    labor: {
      laborForceParticipationRate: 68,
      employmentRate: 94,
      unemploymentRate: 6,
      totalWorkforce: 32_000_000,
      averageWorkweekHours: 38,
      minimumWage: 12,
      averageAnnualIncome: 52_000,
      laborProtections: true,
      pensionCoverage: 78,
      healthInsuranceCoverage: 91,
      paidSickLeaveDays: 10,
      paidVacationDays: 20,
      parentalLeaveWeeks: 12,
      employmentBySector: { agriculture: 5, industry: 25, services: 70 },
      employmentByType: { fullTime: 80, partTime: 12, temporary: 3, selfEmployed: 10, informal: 2 },
      skillsAndProductivity: {
        averageEducationYears: 14,
        tertiaryEducationRate: 52,
        vocationalTrainingRate: 30,
        skillsGapIndex: 25,
        laborProductivityIndex: 120,
        productivityGrowthRate: 1.8,
      },
      demographicsAndConditions: {
        youthUnemploymentRate: 10,
        femaleParticipationRate: 62,
        genderPayGap: 12,
        unionizationRate: 25,
        workplaceSafetyIndex: 85,
        averageCommutingTime: 28,
      },
      regionalEmployment: {
        urban: { participationRate: 72, unemploymentRate: 4.5, averageIncome: 58_000 },
        rural: { participationRate: 60, unemploymentRate: 7.5, averageIncome: 38_000 },
      },
      socialProtection: {
        unemploymentBenefitCoverage: 75,
        pensionCoverage: 78,
        healthInsuranceCoverage: 91,
        paidSickLeaveDays: 10,
        paidVacationDays: 20,
        parentalLeaveWeeks: 12,
      },
    },
    fiscal: {
      taxRevenueGDPPercent: 27,
      governmentRevenueTotal: 567_000_000_000,
      taxRevenuePerCapita: 11_340,
      governmentBudgetGDPPercent: 30,
      budgetDeficitSurplus: -63_000_000_000,
      internalDebtGDPPercent: 55,
      externalDebtGDPPercent: 20,
      totalDebtGDPRatio: 75,
      debtPerCapita: 15_000,
      interestRates: 0.045,
      debtServiceCosts: 120_000_000_000,
      taxRates: {
        personalIncomeTaxRates: [
          { bracket: "Low", rate: 10 },
          { bracket: "Middle", rate: 22 },
          { bracket: "High", rate: 32 },
          { bracket: "Top", rate: 40 },
        ],
        corporateTaxRates: [
          { size: "Small", rate: 18 },
          { size: "Medium", rate: 22 },
          { size: "Large", rate: 26 },
          { size: "Multinational", rate: 28 },
        ],
        salesTaxRate: 7,
        propertyTaxRate: 1.2,
        payrollTaxRate: 6.2,
        wealthTaxRate: 1,
        exciseTaxRates: [
          { type: "Fuel", rate: 15 },
          { type: "Tobacco", rate: 35 },
        ],
      },
      governmentSpendingByCategory: [
        spendingCategory("Healthcare", 180_000_000_000, 32),
        spendingCategory("Education", 140_000_000_000, 25),
        spendingCategory("Infrastructure", 90_000_000_000, 16),
        spendingCategory("Defense", 60_000_000_000, 11),
        spendingCategory("Welfare", 50_000_000_000, 9),
        spendingCategory("DebtServicing", 30_000_000_000, 5),
        spendingCategory("Research", 17_000_000_000, 3),
      ],
    },
    income: {
      economicClasses: [
        {
          name: "LowerClass",
          populationPercent: 20,
          wealthPercent: 5,
          averageIncome: 18_000,
          color: "#d32f2f",
        },
        {
          name: "WorkingClass",
          populationPercent: 35,
          wealthPercent: 15,
          averageIncome: 32_000,
          color: "#f57c00",
        },
        {
          name: "MiddleClass",
          populationPercent: 30,
          wealthPercent: 35,
          averageIncome: 52_000,
          color: "#1976d2",
        },
        {
          name: "UpperMiddleClass",
          populationPercent: 12,
          wealthPercent: 25,
          averageIncome: 90_000,
          color: "#512da8",
        },
        {
          name: "UpperClass",
          populationPercent: 3,
          wealthPercent: 20,
          averageIncome: 250_000,
          color: "#2e7d32",
        },
      ],
      povertyRate: 11,
      incomeInequalityGini: 0.32,
      socialMobilityIndex: 70,
    },
    spending: {
      education: 140_000_000_000,
      healthcare: 180_000_000_000,
      socialSafety: 90_000_000_000,
      totalSpending: 567_000_000_000,
      spendingGDPPercent: 30,
      spendingPerCapita: 11_340,
      deficitSurplus: -63_000_000_000,
      spendingCategories: [
        spendingCategory("Healthcare", 180_000_000_000, 32),
        spendingCategory("Education", 140_000_000_000, 25),
        spendingCategory("Infrastructure", 90_000_000_000, 16),
        spendingCategory("Defense", 60_000_000_000, 11),
        spendingCategory("Welfare", 50_000_000_000, 9),
      ],
      ...DEFAULT_POLICY_FLAGS,
      performanceBasedBudgeting: true,
      universalBasicServices: true,
      greenInvestmentPriority: true,
      digitalGovernmentInitiative: true,
      publicPrivatePartnerships: true,
      emergencyReserveFund: true,
      childWelfareFirstPolicy: true,
      preventiveCareEmphasis: true,
      infrastructureBankFund: true,
      progressiveTaxation: true,
      carbonTax: true,
      wealthTax: true,
      universalHealthcare: true,
      freeEducation: true,
      affordableHousing: true,
      elderlyCare: true,
      disabilitySupport: true,
      mentalHealthServices: true,
      stemEducationFocus: true,
      vocationalTraining: true,
      adultEducation: true,
      earlyChildhoodEducation: true,
      smartCityInitiative: true,
      publicTransportExpansion: true,
      renewableEnergyTransition: true,
      highSpeedInternet: true,
      waterInfrastructure: true,
      researchDevelopmentFund: true,
      startupIncubators: true,
      openDataInitiative: true,
      cybersecurityInitiative: true,
      borderSecurity: true,
      disasterPreparedness: true,
      crimePrevention: true,
      biodiversityProtection: true,
      wasteReduction: true,
      greenBuildingStandards: true,
      sustainableAgriculture: true,
      criminalJusticeReform: true,
      legalAidExpansion: true,
      courtSystemModernization: true,
      artsCultureFunding: true,
      heritagePreservation: true,
      multiculturalPrograms: true,
      ruralDevelopment: true,
      ruralHealthcare: true,
      ruralBroadband: true,
      agriculturalSupport: true,
      foreignAidProgram: true,
      refugeeSupport: true,
      diplomaticEngagement: true,
      tradePromotion: true,
      transparencyInitiative: true,
      citizenEngagement: true,
      antiCorruption: true,
      publicServiceReform: true,
    },
    demographics: {
      lifeExpectancy: 81,
      urbanRuralSplit: { urban: 82, rural: 18 },
      ageDistribution: [
        { group: "0-14", percent: 18, color: "#3b82f6" },
        { group: "15-64", percent: 66, color: "#10b981" },
        { group: "65+", percent: 16, color: "#f59e0b" },
      ],
      regions: [
        { name: "Metro Core", population: 20_000_000, urbanPercent: 95, type: "Developed" },
        { name: "Suburban Belt", population: 15_000_000, urbanPercent: 80, type: "Developed" },
        { name: "Regional Centers", population: 10_000_000, urbanPercent: 65, type: "Emerging" },
        { name: "Rural Areas", population: 5_000_000, urbanPercent: 30, type: "Developing" },
      ],
      educationLevels: [
        { level: "Primary", percent: 98, color: "#ef4444" },
        { level: "Secondary", percent: 89, color: "#f59e0b" },
        { level: "Tertiary", percent: 52, color: "#10b981" },
      ],
      literacyRate: 99,
      citizenshipStatuses: [
        { status: "Citizen", percent: 92, color: "#22c55e" },
        { status: "Permanent Resident", percent: 5, color: "#3b82f6" },
        { status: "Other", percent: 3, color: "#f59e0b" },
      ],
    },
  } satisfies EconomyData);
}

function createEmergingPreset(): EconomyData {
  return EconomyDataSchema.parse({
    core: {
      totalPopulation: 80_000_000,
      nominalGDP: 640_000_000_000,
      gdpPerCapita: 8_000,
      realGDPGrowthRate: 0.055,
      inflationRate: 0.06,
      currencyExchangeRate: 15,
      giniCoefficient: 42,
    },
    labor: {
      laborForceParticipationRate: 60,
      employmentRate: 88,
      unemploymentRate: 12,
      totalWorkforce: 38_000_000,
      averageWorkweekHours: 44,
      minimumWage: 3.5,
      averageAnnualIncome: 9_500,
      laborProtections: true,
      employmentBySector: { agriculture: 25, industry: 30, services: 45 },
      employmentByType: {
        fullTime: 55,
        partTime: 10,
        temporary: 8,
        selfEmployed: 15,
        informal: 20,
      },
      skillsAndProductivity: {
        averageEducationYears: 10,
        tertiaryEducationRate: 25,
        vocationalTrainingRate: 18,
        skillsGapIndex: 55,
        laborProductivityIndex: 80,
        productivityGrowthRate: 3.5,
      },
      demographicsAndConditions: {
        youthUnemploymentRate: 22,
        femaleParticipationRate: 48,
        genderPayGap: 22,
        unionizationRate: 15,
        workplaceSafetyIndex: 60,
        averageCommutingTime: 40,
      },
      regionalEmployment: {
        urban: { participationRate: 65, unemploymentRate: 10, averageIncome: 12_000 },
        rural: { participationRate: 55, unemploymentRate: 15, averageIncome: 5_000 },
      },
      socialProtection: {
        unemploymentBenefitCoverage: 30,
        pensionCoverage: 40,
        healthInsuranceCoverage: 55,
        paidSickLeaveDays: 5,
        paidVacationDays: 12,
        parentalLeaveWeeks: 6,
      },
    },
    fiscal: {
      taxRevenueGDPPercent: 18,
      governmentRevenueTotal: 115_200_000_000,
      taxRevenuePerCapita: 1_440,
      governmentBudgetGDPPercent: 22,
      budgetDeficitSurplus: -25_600_000_000,
      internalDebtGDPPercent: 35,
      externalDebtGDPPercent: 25,
      totalDebtGDPRatio: 60,
      debtPerCapita: 4_800,
      interestRates: 0.08,
      debtServiceCosts: 38_400_000_000,
      taxRates: {
        personalIncomeTaxRates: [
          { bracket: "Low", rate: 5 },
          { bracket: "Middle", rate: 15 },
          { bracket: "High", rate: 25 },
          { bracket: "Top", rate: 30 },
        ],
        corporateTaxRates: [
          { size: "Small", rate: 15 },
          { size: "Medium", rate: 20 },
          { size: "Large", rate: 25 },
          { size: "Multinational", rate: 25 },
        ],
        salesTaxRate: 12,
        propertyTaxRate: 0.5,
        payrollTaxRate: 4,
        wealthTaxRate: 0,
        exciseTaxRates: [
          { type: "Fuel", rate: 20 },
          { type: "Tobacco", rate: 40 },
        ],
      },
      governmentSpendingByCategory: [
        spendingCategory("Healthcare", 28_000_000_000, 20),
        spendingCategory("Education", 21_000_000_000, 15),
        spendingCategory("Infrastructure", 28_000_000_000, 20),
        spendingCategory("Defense", 21_000_000_000, 15),
        spendingCategory("Welfare", 14_000_000_000, 10),
        spendingCategory("DebtServicing", 21_000_000_000, 15),
        spendingCategory("Other", 7_000_000_000, 5),
      ],
    },
    income: {
      economicClasses: [
        {
          name: "LowerClass",
          populationPercent: 35,
          wealthPercent: 8,
          averageIncome: 2_500,
          color: "#d32f2f",
        },
        {
          name: "WorkingClass",
          populationPercent: 30,
          wealthPercent: 15,
          averageIncome: 6_000,
          color: "#f57c00",
        },
        {
          name: "MiddleClass",
          populationPercent: 22,
          wealthPercent: 25,
          averageIncome: 12_000,
          color: "#1976d2",
        },
        {
          name: "UpperMiddleClass",
          populationPercent: 10,
          wealthPercent: 27,
          averageIncome: 25_000,
          color: "#512da8",
        },
        {
          name: "UpperClass",
          populationPercent: 3,
          wealthPercent: 25,
          averageIncome: 80_000,
          color: "#2e7d32",
        },
      ],
      povertyRate: 22,
      incomeInequalityGini: 0.42,
      socialMobilityIndex: 45,
    },
    spending: {
      education: 21_000_000_000,
      healthcare: 28_000_000_000,
      socialSafety: 14_000_000_000,
      totalSpending: 140_800_000_000,
      spendingGDPPercent: 22,
      spendingPerCapita: 1_760,
      deficitSurplus: -25_600_000_000,
      spendingCategories: [
        spendingCategory("Healthcare", 28_000_000_000, 20),
        spendingCategory("Education", 21_000_000_000, 15),
        spendingCategory("Infrastructure", 28_000_000_000, 20),
        spendingCategory("Defense", 21_000_000_000, 15),
        spendingCategory("Welfare", 14_000_000_000, 10),
      ],
      ...DEFAULT_POLICY_FLAGS,
      progressiveTaxation: true,
      publicTransportExpansion: true,
      vocationalTraining: true,
      waterInfrastructure: true,
      borderSecurity: true,
      crimePrevention: true,
      agriculturalSupport: true,
    },
    demographics: {
      lifeExpectancy: 72,
      urbanRuralSplit: { urban: 55, rural: 45 },
      ageDistribution: [
        { group: "0-14", percent: 28, color: "#3b82f6" },
        { group: "15-64", percent: 64, color: "#10b981" },
        { group: "65+", percent: 8, color: "#f59e0b" },
      ],
      regions: [
        { name: "Capital Region", population: 16_000_000, urbanPercent: 90, type: "Developed" },
        { name: "Industrial Corridor", population: 24_000_000, urbanPercent: 65, type: "Emerging" },
        {
          name: "Agricultural Heartland",
          population: 24_000_000,
          urbanPercent: 35,
          type: "Developing",
        },
        { name: "Border Regions", population: 16_000_000, urbanPercent: 40, type: "Developing" },
      ],
      educationLevels: [
        { level: "Primary", percent: 92, color: "#ef4444" },
        { level: "Secondary", percent: 68, color: "#f59e0b" },
        { level: "Tertiary", percent: 25, color: "#10b981" },
      ],
      literacyRate: 90,
      citizenshipStatuses: [
        { status: "Citizen", percent: 96, color: "#22c55e" },
        { status: "Permanent Resident", percent: 3, color: "#3b82f6" },
        { status: "Other", percent: 1, color: "#f59e0b" },
      ],
    },
  } satisfies EconomyData);
}

function createDevelopingPreset(): EconomyData {
  return EconomyDataSchema.parse({
    core: {
      totalPopulation: 120_000_000,
      nominalGDP: 180_000_000_000,
      gdpPerCapita: 1_500,
      realGDPGrowthRate: 0.035,
      inflationRate: 0.12,
      currencyExchangeRate: 450,
      giniCoefficient: 48,
    },
    labor: {
      laborForceParticipationRate: 55,
      employmentRate: 80,
      unemploymentRate: 20,
      totalWorkforce: 42_000_000,
      averageWorkweekHours: 48,
      minimumWage: 0.8,
      averageAnnualIncome: 1_800,
      laborProtections: false,
      employmentBySector: { agriculture: 55, industry: 15, services: 30 },
      employmentByType: { fullTime: 30, partTime: 5, temporary: 5, selfEmployed: 20, informal: 45 },
      skillsAndProductivity: {
        averageEducationYears: 6,
        tertiaryEducationRate: 8,
        vocationalTrainingRate: 5,
        skillsGapIndex: 75,
        laborProductivityIndex: 45,
        productivityGrowthRate: 2.0,
      },
      demographicsAndConditions: {
        youthUnemploymentRate: 35,
        femaleParticipationRate: 38,
        genderPayGap: 35,
        unionizationRate: 5,
        workplaceSafetyIndex: 35,
        averageCommutingTime: 55,
      },
      regionalEmployment: {
        urban: { participationRate: 58, unemploymentRate: 18, averageIncome: 3_000 },
        rural: { participationRate: 52, unemploymentRate: 25, averageIncome: 800 },
      },
      socialProtection: {
        unemploymentBenefitCoverage: 10,
        pensionCoverage: 15,
        healthInsuranceCoverage: 20,
        paidSickLeaveDays: 0,
        paidVacationDays: 5,
        parentalLeaveWeeks: 0,
      },
    },
    fiscal: {
      taxRevenueGDPPercent: 12,
      governmentRevenueTotal: 21_600_000_000,
      taxRevenuePerCapita: 180,
      governmentBudgetGDPPercent: 16,
      budgetDeficitSurplus: -7_200_000_000,
      internalDebtGDPPercent: 20,
      externalDebtGDPPercent: 40,
      totalDebtGDPRatio: 60,
      debtPerCapita: 900,
      interestRates: 0.15,
      debtServiceCosts: 16_200_000_000,
      taxRates: {
        personalIncomeTaxRates: [
          { bracket: "Low", rate: 0 },
          { bracket: "Middle", rate: 10 },
          { bracket: "High", rate: 20 },
          { bracket: "Top", rate: 25 },
        ],
        corporateTaxRates: [
          { size: "Small", rate: 10 },
          { size: "Medium", rate: 15 },
          { size: "Large", rate: 20 },
          { size: "Multinational", rate: 20 },
        ],
        salesTaxRate: 15,
        propertyTaxRate: 0.2,
        payrollTaxRate: 2,
        wealthTaxRate: 0,
        exciseTaxRates: [
          { type: "Fuel", rate: 25 },
          { type: "Tobacco", rate: 30 },
        ],
      },
      governmentSpendingByCategory: [
        spendingCategory("Healthcare", 3_200_000_000, 11),
        spendingCategory("Education", 2_900_000_000, 10),
        spendingCategory("Infrastructure", 5_800_000_000, 20),
        spendingCategory("Defense", 5_800_000_000, 20),
        spendingCategory("DebtServicing", 5_800_000_000, 20),
        spendingCategory("Welfare", 2_900_000_000, 10),
        spendingCategory("Other", 2_600_000_000, 9),
      ],
    },
    income: {
      economicClasses: [
        {
          name: "LowerClass",
          populationPercent: 50,
          wealthPercent: 10,
          averageIncome: 500,
          color: "#d32f2f",
        },
        {
          name: "WorkingClass",
          populationPercent: 25,
          wealthPercent: 15,
          averageIncome: 1_500,
          color: "#f57c00",
        },
        {
          name: "MiddleClass",
          populationPercent: 15,
          wealthPercent: 20,
          averageIncome: 4_000,
          color: "#1976d2",
        },
        {
          name: "UpperMiddleClass",
          populationPercent: 7,
          wealthPercent: 25,
          averageIncome: 12_000,
          color: "#512da8",
        },
        {
          name: "UpperClass",
          populationPercent: 3,
          wealthPercent: 30,
          averageIncome: 50_000,
          color: "#2e7d32",
        },
      ],
      povertyRate: 40,
      incomeInequalityGini: 0.48,
      socialMobilityIndex: 25,
    },
    spending: {
      education: 2_900_000_000,
      healthcare: 3_200_000_000,
      socialSafety: 2_900_000_000,
      totalSpending: 28_800_000_000,
      spendingGDPPercent: 16,
      spendingPerCapita: 240,
      deficitSurplus: -7_200_000_000,
      spendingCategories: [
        spendingCategory("Healthcare", 3_200_000_000, 11),
        spendingCategory("Education", 2_900_000_000, 10),
        spendingCategory("Infrastructure", 5_800_000_000, 20),
        spendingCategory("Defense", 5_800_000_000, 20),
        spendingCategory("Welfare", 2_900_000_000, 10),
      ],
      ...DEFAULT_POLICY_FLAGS,
      waterInfrastructure: true,
      borderSecurity: true,
      agriculturalSupport: true,
    },
    demographics: {
      lifeExpectancy: 62,
      urbanRuralSplit: { urban: 35, rural: 65 },
      ageDistribution: [
        { group: "0-14", percent: 40, color: "#3b82f6" },
        { group: "15-64", percent: 55, color: "#10b981" },
        { group: "65+", percent: 5, color: "#f59e0b" },
      ],
      regions: [
        { name: "Capital", population: 12_000_000, urbanPercent: 85, type: "Emerging" },
        { name: "Coastal Cities", population: 18_000_000, urbanPercent: 60, type: "Developing" },
        { name: "Interior", population: 48_000_000, urbanPercent: 20, type: "Fragile" },
        { name: "Remote Areas", population: 42_000_000, urbanPercent: 10, type: "Fragile" },
      ],
      educationLevels: [
        { level: "Primary", percent: 70, color: "#ef4444" },
        { level: "Secondary", percent: 35, color: "#f59e0b" },
        { level: "Tertiary", percent: 8, color: "#10b981" },
      ],
      literacyRate: 65,
      citizenshipStatuses: [
        { status: "Citizen", percent: 98, color: "#22c55e" },
        { status: "Other", percent: 2, color: "#f59e0b" },
      ],
    },
  } satisfies EconomyData);
}
