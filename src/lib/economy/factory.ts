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
} from "~/types/economics";

// ===============================
// Policy flags default (all false)
// ===============================

export const DEFAULT_POLICY_FLAGS: Pick<
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
