/**
 * Government Spending Data Default Values & Derived Directives
 *
 * Helper utility to create properly-formed GovernmentSpendingData objects
 * and derive active spending policies/directives from selected Atomic Government Components.
 */

import type { GovernmentSpendingData } from "~/types/economics";
import { ComponentType } from "@prisma/client";

export interface DerivedDirectiveInfo {
  id: string;
  name: string;
  category: string;
}

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

/**
 * Derive active spending policies and directives from chosen atomic components
 */
export function deriveSpendingPoliciesFromComponents(
  components: ComponentType[],
  base?: Partial<GovernmentSpendingData>
): GovernmentSpendingData {
  const data = createDefaultGovernmentSpendingData(base);
  const set = new Set(components);

  if (set.has(ComponentType.DEMOCRATIC_PROCESS) || set.has(ComponentType.ELECTORAL_LEGITIMACY)) {
    data.participatoryBudgeting = true;
    data.citizenEngagement = true;
    data.transparencyInitiative = true;
  }

  if (set.has(ComponentType.TECHNOCRATIC_PROCESS) || set.has(ComponentType.PERFORMANCE_LEGITIMACY)) {
    data.performanceBasedBudgeting = true;
    data.zeroBasedBudgeting = true;
  }

  if (set.has(ComponentType.WELFARE_STATE)) {
    data.universalBasicServices = true;
    data.affordableHousing = true;
    data.socialImpactBonds = true;
    data.childWelfareFirstPolicy = true;
  }

  if (set.has(ComponentType.UNIVERSAL_HEALTHCARE)) {
    data.universalHealthcare = true;
    data.preventiveCareEmphasis = true;
    data.mentalHealthServices = true;
  }

  if (set.has(ComponentType.PUBLIC_EDUCATION)) {
    data.freeEducation = true;
    data.stemEducationFocus = true;
    data.earlyChildhoodEducation = true;
  }

  if (set.has(ComponentType.ENVIRONMENTAL_PROTECTION)) {
    data.greenInvestmentPriority = true;
    data.carbonNeutrality = true;
    data.biodiversityProtection = true;
    data.renewableEnergyTransition = true;
  }

  if (set.has(ComponentType.DIGITAL_GOVERNMENT) || set.has(ComponentType.DIGITAL_INFRASTRUCTURE)) {
    data.digitalGovernmentInitiative = true;
    data.highSpeedInternet = true;
    data.openDataInitiative = true;
  }

  if (set.has(ComponentType.CYBERSECURITY)) {
    data.cybersecurityInitiative = true;
  }

  if (set.has(ComponentType.RESEARCH_AND_DEVELOPMENT)) {
    data.researchDevelopmentFund = true;
    data.startupIncubators = true;
  }

  if (set.has(ComponentType.FREE_MARKET_SYSTEM) || set.has(ComponentType.ECONOMIC_INCENTIVES)) {
    data.publicPrivatePartnerships = true;
  }

  if (set.has(ComponentType.RULE_OF_LAW) || set.has(ComponentType.INSTITUTIONAL_LEGITIMACY)) {
    data.antiCorruption = true;
    data.courtSystemModernization = true;
    data.publicServiceReform = true;
  }

  if (set.has(ComponentType.CULTURAL_PRESERVATION)) {
    data.artsCultureFunding = true;
    data.heritagePreservation = true;
  }

  if (set.has(ComponentType.MULTILATERAL_DIPLOMACY) || set.has(ComponentType.DEVELOPMENT_AID)) {
    data.diplomaticEngagement = true;
    data.foreignAidProgram = true;
    data.tradePromotion = true;
  }

  return data;
}

/**
 * Get human-readable directives enacted by selected components
 */
export function getDirectivesForComponents(components: ComponentType[]): DerivedDirectiveInfo[] {
  const directives: DerivedDirectiveInfo[] = [];
  const set = new Set(components);

  if (set.has(ComponentType.DEMOCRATIC_PROCESS) || set.has(ComponentType.ELECTORAL_LEGITIMACY)) {
    directives.push(
      { id: "participatoryBudgeting", name: "Participatory Budgeting", category: "Governance" },
      { id: "citizenEngagement", name: "Citizen Engagement Program", category: "Governance" },
      { id: "transparencyInitiative", name: "Public Transparency Directive", category: "Governance" }
    );
  }

  if (set.has(ComponentType.TECHNOCRATIC_PROCESS) || set.has(ComponentType.PERFORMANCE_LEGITIMACY)) {
    directives.push(
      { id: "performanceBasedBudgeting", name: "Performance-Based Budgeting", category: "Fiscal" },
      { id: "zeroBasedBudgeting", name: "Zero-Based Fiscal Auditing", category: "Fiscal" }
    );
  }

  if (set.has(ComponentType.WELFARE_STATE)) {
    directives.push(
      { id: "universalBasicServices", name: "Universal Basic Services", category: "Social" },
      { id: "affordableHousing", name: "Public Housing Access", category: "Social" },
      { id: "childWelfareFirstPolicy", name: "Child Welfare Priority", category: "Social" }
    );
  }

  if (set.has(ComponentType.UNIVERSAL_HEALTHCARE)) {
    directives.push(
      { id: "universalHealthcare", name: "Universal Healthcare Mandate", category: "Health" },
      { id: "preventiveCareEmphasis", name: "Preventive Care Priority", category: "Health" }
    );
  }

  if (set.has(ComponentType.PUBLIC_EDUCATION)) {
    directives.push(
      { id: "freeEducation", name: "Tuition-Free Public Education", category: "Education" },
      { id: "stemEducationFocus", name: "STEM Research Curriculum", category: "Education" }
    );
  }

  if (set.has(ComponentType.ENVIRONMENTAL_PROTECTION)) {
    directives.push(
      { id: "greenInvestmentPriority", name: "Green Energy Transition", category: "Environment" },
      { id: "biodiversityProtection", name: "Ecological Conservation", category: "Environment" }
    );
  }

  if (set.has(ComponentType.DIGITAL_GOVERNMENT) || set.has(ComponentType.DIGITAL_INFRASTRUCTURE)) {
    directives.push(
      { id: "digitalGovernmentInitiative", name: "Digital Services Overhaul", category: "Digital" },
      { id: "openDataInitiative", name: "Open Data Access Mandate", category: "Digital" }
    );
  }

  if (set.has(ComponentType.CYBERSECURITY)) {
    directives.push(
      { id: "cybersecurityInitiative", name: "National Cyber Defense Directive", category: "Defense" }
    );
  }

  if (set.has(ComponentType.RESEARCH_AND_DEVELOPMENT)) {
    directives.push(
      { id: "researchDevelopmentFund", name: "R&D Sovereign Capital Fund", category: "Innovation" }
    );
  }

  if (set.has(ComponentType.RULE_OF_LAW) || set.has(ComponentType.INSTITUTIONAL_LEGITIMACY)) {
    directives.push(
      { id: "antiCorruption", name: "Independent Integrity & Anti-Corruption", category: "Legal" },
      { id: "courtSystemModernization", name: "Judicial Modernization Directive", category: "Legal" }
    );
  }

  if (set.has(ComponentType.MULTILATERAL_DIPLOMACY)) {
    directives.push(
      { id: "diplomaticEngagement", name: "Multilateral Accords Directive", category: "Diplomacy" }
    );
  }

  return directives;
}
