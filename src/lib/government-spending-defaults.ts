/**
 * Government Spending Data Default Values
 *
 * Helper utility to create properly-formed GovernmentSpendingData objects
 * with all 57+ required boolean policy flags initialized to false by default.
 */

import type { GovernmentSpendingData } from '../types/economics';

export function createDefaultGovernmentSpendingData(
  partial?: Partial<GovernmentSpendingData>
): GovernmentSpendingData {
  return {
    // Core spending metrics
    education: partial?.education ?? 0,
    healthcare: partial?.healthcare ?? 0,
    socialSafety: partial?.socialSafety ?? 0,
    totalSpending: partial?.totalSpending ?? 0,
    spendingGDPPercent: partial?.spendingGDPPercent ?? 0,
    spendingPerCapita: partial?.spendingPerCapita ?? 0,
    deficitSurplus: partial?.deficitSurplus ?? 0,
    spendingCategories: partial?.spendingCategories ?? [],

    // Policy flags - all default to false
    performanceBasedBudgeting: partial?.performanceBasedBudgeting ?? false,
    universalBasicServices: partial?.universalBasicServices ?? false,
    greenInvestmentPriority: partial?.greenInvestmentPriority ?? false,
    digitalGovernmentInitiative: partial?.digitalGovernmentInitiative ?? false,
    zeroBasedBudgeting: partial?.zeroBasedBudgeting ?? false,
    publicPrivatePartnerships: partial?.publicPrivatePartnerships ?? false,
    participatoryBudgeting: partial?.participatoryBudgeting ?? false,
    emergencyReserveFund: partial?.emergencyReserveFund ?? false,
    socialImpactBonds: partial?.socialImpactBonds ?? false,
    childWelfareFirstPolicy: partial?.childWelfareFirstPolicy ?? false,
    preventiveCareEmphasis: partial?.preventiveCareEmphasis ?? false,
    infrastructureBankFund: partial?.infrastructureBankFund ?? false,
    universalBasicIncome: partial?.universalBasicIncome ?? false,
    progressiveTaxation: partial?.progressiveTaxation ?? false,
    carbonTax: partial?.carbonTax ?? false,
    wealthTax: partial?.wealthTax ?? false,
    financialTransactionTax: partial?.financialTransactionTax ?? false,
    universalHealthcare: partial?.universalHealthcare ?? false,
    freeEducation: partial?.freeEducation ?? false,
    affordableHousing: partial?.affordableHousing ?? false,
    elderlyCare: partial?.elderlyCare ?? false,
    disabilitySupport: partial?.disabilitySupport ?? false,
    mentalHealthServices: partial?.mentalHealthServices ?? false,
    stemEducationFocus: partial?.stemEducationFocus ?? false,
    vocationalTraining: partial?.vocationalTraining ?? false,
    adultEducation: partial?.adultEducation ?? false,
    earlyChildhoodEducation: partial?.earlyChildhoodEducation ?? false,
    smartCityInitiative: partial?.smartCityInitiative ?? false,
    publicTransportExpansion: partial?.publicTransportExpansion ?? false,
    renewableEnergyTransition: partial?.renewableEnergyTransition ?? false,
    highSpeedInternet: partial?.highSpeedInternet ?? false,
    waterInfrastructure: partial?.waterInfrastructure ?? false,
    researchDevelopmentFund: partial?.researchDevelopmentFund ?? false,
    startupIncubators: partial?.startupIncubators ?? false,
    patentReform: partial?.patentReform ?? false,
    openDataInitiative: partial?.openDataInitiative ?? false,
    cybersecurityInitiative: partial?.cybersecurityInitiative ?? false,
    borderSecurity: partial?.borderSecurity ?? false,
    disasterPreparedness: partial?.disasterPreparedness ?? false,
    crimePrevention: partial?.crimePrevention ?? false,
    carbonNeutrality: partial?.carbonNeutrality ?? false,
    biodiversityProtection: partial?.biodiversityProtection ?? false,
    wasteReduction: partial?.wasteReduction ?? false,
    greenBuildingStandards: partial?.greenBuildingStandards ?? false,
    sustainableAgriculture: partial?.sustainableAgriculture ?? false,
    criminalJusticeReform: partial?.criminalJusticeReform ?? false,
    legalAidExpansion: partial?.legalAidExpansion ?? false,
    restorativeJustice: partial?.restorativeJustice ?? false,
    courtSystemModernization: partial?.courtSystemModernization ?? false,
    artsCultureFunding: partial?.artsCultureFunding ?? false,
    heritagePreservation: partial?.heritagePreservation ?? false,
    multiculturalPrograms: partial?.multiculturalPrograms ?? false,
    languagePreservation: partial?.languagePreservation ?? false,
    ruralDevelopment: partial?.ruralDevelopment ?? false,
    ruralHealthcare: partial?.ruralHealthcare ?? false,
    ruralBroadband: partial?.ruralBroadband ?? false,
    agriculturalSupport: partial?.agriculturalSupport ?? false,
    foreignAidProgram: partial?.foreignAidProgram ?? false,
    refugeeSupport: partial?.refugeeSupport ?? false,
    diplomaticEngagement: partial?.diplomaticEngagement ?? false,
    tradePromotion: partial?.tradePromotion ?? false,
    transparencyInitiative: partial?.transparencyInitiative ?? false,
    citizenEngagement: partial?.citizenEngagement ?? false,
    antiCorruption: partial?.antiCorruption ?? false,
    publicServiceReform: partial?.publicServiceReform ?? false,
  };
}
