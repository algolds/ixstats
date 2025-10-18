/**
 * Unified Atomic Tax Integration
 * Complete production-ready implementation for Tax × Government × Economy cross-builder synergies
 *
 * This module provides:
 * 1. Tax-Government synergy mappings with collection & compliance bonuses
 * 2. Tax-Economy impact calculations (GDP, inequality, investment, consumption)
 * 3. Three-way Tax × Government × Economy compound effectiveness
 * 4. Comprehensive calculation functions for unified tax system effectiveness
 * 5. Issue detection for conflicts, missing synergies, and inefficiencies
 */

import { ComponentType } from '@prisma/client';
import type { TaxCategory, TaxSystem } from '~/types/tax-system';
import type { CoreEconomicIndicatorsData, LaborEmploymentData } from '~/types/economics';

// ============================================
// TAX-GOVERNMENT SYNERGIES
// ============================================

export interface TaxGovernmentSynergy {
  taxComponent: string; // Tax category type (e.g., "INCOME", "CORPORATE")
  governmentComponent: ComponentType;
  collectionBonus: number; // Collection efficiency multiplier (e.g., 1.15 = +15%)
  complianceBonus: number; // Compliance rate multiplier
  effectivenessMultiplier: number; // Overall effectiveness boost
  description: string;
}

export const TAX_GOVERNMENT_SYNERGIES: TaxGovernmentSynergy[] = [
  // Digital Government Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.DIGITAL_GOVERNMENT,
    collectionBonus: 1.25,
    complianceBonus: 1.20,
    effectivenessMultiplier: 1.30,
    description: 'Digital tax filing and automated income verification dramatically improve collection'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.DIGITAL_GOVERNMENT,
    collectionBonus: 1.30,
    complianceBonus: 1.25,
    effectivenessMultiplier: 1.35,
    description: 'Automated corporate tax reporting and real-time auditing maximize compliance'
  },
  {
    taxComponent: 'SALES',
    governmentComponent: ComponentType.DIGITAL_GOVERNMENT,
    collectionBonus: 1.35,
    complianceBonus: 1.30,
    effectivenessMultiplier: 1.40,
    description: 'Point-of-sale integration and automated VAT collection eliminate evasion'
  },

  // Professional Bureaucracy Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.PROFESSIONAL_BUREAUCRACY,
    collectionBonus: 1.20,
    complianceBonus: 1.15,
    effectivenessMultiplier: 1.25,
    description: 'Expert tax administrators optimize progressive income tax collection'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.PROFESSIONAL_BUREAUCRACY,
    collectionBonus: 1.25,
    complianceBonus: 1.20,
    effectivenessMultiplier: 1.30,
    description: 'Specialized corporate tax experts handle complex business taxation'
  },
  {
    taxComponent: 'PROPERTY',
    governmentComponent: ComponentType.PROFESSIONAL_BUREAUCRACY,
    collectionBonus: 1.18,
    complianceBonus: 1.12,
    effectivenessMultiplier: 1.20,
    description: 'Professional assessors ensure accurate property valuations'
  },
  {
    taxComponent: 'CAPITAL_GAINS',
    governmentComponent: ComponentType.PROFESSIONAL_BUREAUCRACY,
    collectionBonus: 1.22,
    complianceBonus: 1.18,
    effectivenessMultiplier: 1.25,
    description: 'Financial experts effectively track and tax capital gains'
  },

  // Technocratic Process/Agencies Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.TECHNOCRATIC_PROCESS,
    collectionBonus: 1.18,
    complianceBonus: 1.22,
    effectivenessMultiplier: 1.25,
    description: 'Data-driven tax policy optimization increases compliance and revenue'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.TECHNOCRATIC_AGENCIES,
    collectionBonus: 1.28,
    complianceBonus: 1.25,
    effectivenessMultiplier: 1.32,
    description: 'Technical expertise in corporate tax law and international taxation'
  },
  {
    taxComponent: 'EXCISE',
    governmentComponent: ComponentType.TECHNOCRATIC_AGENCIES,
    collectionBonus: 1.20,
    complianceBonus: 1.15,
    effectivenessMultiplier: 1.22,
    description: 'Scientific approach to sin tax implementation and health externalities'
  },

  // Rule of Law Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.RULE_OF_LAW,
    collectionBonus: 1.15,
    complianceBonus: 1.30,
    effectivenessMultiplier: 1.25,
    description: 'Legal certainty and fair enforcement increase voluntary tax compliance'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.RULE_OF_LAW,
    collectionBonus: 1.18,
    complianceBonus: 1.35,
    effectivenessMultiplier: 1.30,
    description: 'Consistent legal framework reduces corporate tax avoidance'
  },
  {
    taxComponent: 'ESTATE',
    governmentComponent: ComponentType.RULE_OF_LAW,
    collectionBonus: 1.25,
    complianceBonus: 1.40,
    effectivenessMultiplier: 1.35,
    description: 'Strong legal framework essential for estate tax enforcement'
  },

  // Independent Judiciary Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.INDEPENDENT_JUDICIARY,
    collectionBonus: 1.12,
    complianceBonus: 1.25,
    effectivenessMultiplier: 1.20,
    description: 'Fair tax courts increase public trust in tax system'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.INDEPENDENT_JUDICIARY,
    collectionBonus: 1.15,
    complianceBonus: 1.30,
    effectivenessMultiplier: 1.25,
    description: 'Independent review of corporate tax disputes ensures fairness'
  },

  // Centralized Power Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.CENTRALIZED_POWER,
    collectionBonus: 1.22,
    complianceBonus: 1.10,
    effectivenessMultiplier: 1.18,
    description: 'Centralized tax authority enables uniform nationwide collection'
  },
  {
    taxComponent: 'SALES',
    governmentComponent: ComponentType.CENTRALIZED_POWER,
    collectionBonus: 1.25,
    complianceBonus: 1.12,
    effectivenessMultiplier: 1.20,
    description: 'Centralized VAT/sales tax administration prevents regional evasion'
  },
  {
    taxComponent: 'CUSTOMS',
    governmentComponent: ComponentType.CENTRALIZED_POWER,
    collectionBonus: 1.30,
    complianceBonus: 1.15,
    effectivenessMultiplier: 1.25,
    description: 'Unified customs authority maximizes tariff collection'
  },

  // Federal System Synergies (with challenges)
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.FEDERAL_SYSTEM,
    collectionBonus: 0.92,
    complianceBonus: 1.08,
    effectivenessMultiplier: 0.98,
    description: 'Federal tax coordination requires inter-governmental cooperation (moderate efficiency loss)'
  },
  {
    taxComponent: 'SALES',
    governmentComponent: ComponentType.FEDERAL_SYSTEM,
    collectionBonus: 0.88,
    complianceBonus: 1.05,
    effectivenessMultiplier: 0.95,
    description: 'Multiple sales tax jurisdictions complicate collection but allow local control'
  },
  {
    taxComponent: 'PROPERTY',
    governmentComponent: ComponentType.FEDERAL_SYSTEM,
    collectionBonus: 1.05,
    complianceBonus: 1.15,
    effectivenessMultiplier: 1.10,
    description: 'Local property tax collection actually benefits from federal structure'
  },

  // Surveillance System Synergies (high enforcement, low trust)
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.SURVEILLANCE_SYSTEM,
    collectionBonus: 1.30,
    complianceBonus: 0.75,
    effectivenessMultiplier: 1.05,
    description: 'Extensive monitoring catches evasion but reduces voluntary compliance'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.SURVEILLANCE_SYSTEM,
    collectionBonus: 1.35,
    complianceBonus: 0.70,
    effectivenessMultiplier: 1.08,
    description: 'Corporate surveillance identifies tax avoidance but creates adversarial relationship'
  },
  {
    taxComponent: 'CAPITAL_GAINS',
    governmentComponent: ComponentType.SURVEILLANCE_SYSTEM,
    collectionBonus: 1.40,
    complianceBonus: 0.68,
    effectivenessMultiplier: 1.10,
    description: 'Financial surveillance tracks capital movements but reduces trust'
  },

  // Democratic Process Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.DEMOCRATIC_PROCESS,
    collectionBonus: 0.95,
    complianceBonus: 1.30,
    effectivenessMultiplier: 1.15,
    description: 'Democratic legitimacy increases voluntary tax compliance despite slower implementation'
  },
  {
    taxComponent: 'PROPERTY',
    governmentComponent: ComponentType.DEMOCRATIC_PROCESS,
    collectionBonus: 0.92,
    complianceBonus: 1.25,
    effectivenessMultiplier: 1.10,
    description: 'Local democratic input on property taxes builds community buy-in'
  },

  // Electoral Legitimacy Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.ELECTORAL_LEGITIMACY,
    collectionBonus: 0.98,
    complianceBonus: 1.35,
    effectivenessMultiplier: 1.20,
    description: 'Electoral mandate for tax policy significantly increases voluntary compliance'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.ELECTORAL_LEGITIMACY,
    collectionBonus: 1.00,
    complianceBonus: 1.28,
    effectivenessMultiplier: 1.18,
    description: 'Democratically approved corporate taxes face less business resistance'
  },

  // Performance Legitimacy Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.PERFORMANCE_LEGITIMACY,
    collectionBonus: 1.10,
    complianceBonus: 1.40,
    effectivenessMultiplier: 1.30,
    description: 'Visible results from tax spending dramatically increase compliance'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.PERFORMANCE_LEGITIMACY,
    collectionBonus: 1.12,
    complianceBonus: 1.35,
    effectivenessMultiplier: 1.28,
    description: 'Business support when corporate taxes fund effective programs'
  },

  // Institutional Legitimacy Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.INSTITUTIONAL_LEGITIMACY,
    collectionBonus: 1.15,
    complianceBonus: 1.45,
    effectivenessMultiplier: 1.35,
    description: 'Deep trust in institutions creates exceptional voluntary tax compliance'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.INSTITUTIONAL_LEGITIMACY,
    collectionBonus: 1.18,
    complianceBonus: 1.42,
    effectivenessMultiplier: 1.32,
    description: 'Institutional trust reduces corporate tax planning and avoidance'
  },

  // Social Democracy Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.SOCIAL_DEMOCRACY,
    collectionBonus: 1.20,
    complianceBonus: 1.50,
    effectivenessMultiplier: 1.40,
    description: 'Social contract model creates exceptional tax compliance in exchange for services'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.SOCIAL_DEMOCRACY,
    collectionBonus: 1.18,
    complianceBonus: 1.38,
    effectivenessMultiplier: 1.32,
    description: 'Business accepts high corporate taxes in social democratic model'
  },
  {
    taxComponent: 'SALES',
    governmentComponent: ComponentType.SOCIAL_DEMOCRACY,
    collectionBonus: 1.25,
    complianceBonus: 1.40,
    effectivenessMultiplier: 1.35,
    description: 'High VAT rates sustainable with strong social services'
  },

  // Meritocratic System Synergies
  {
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.MERITOCRATIC_SYSTEM,
    collectionBonus: 1.28,
    complianceBonus: 1.25,
    effectivenessMultiplier: 1.30,
    description: 'Merit-based tax administration maximizes technical efficiency'
  },
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.MERITOCRATIC_SYSTEM,
    collectionBonus: 1.32,
    complianceBonus: 1.28,
    effectivenessMultiplier: 1.35,
    description: 'Expert administrators handle complex corporate tax systems effectively'
  },

  // Economic Planning Synergies
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.ECONOMIC_PLANNING,
    collectionBonus: 1.25,
    complianceBonus: 1.15,
    effectivenessMultiplier: 1.22,
    description: 'Planned economy uses corporate taxes for strategic resource allocation'
  },
  {
    taxComponent: 'EXCISE',
    governmentComponent: ComponentType.ECONOMIC_PLANNING,
    collectionBonus: 1.30,
    complianceBonus: 1.20,
    effectivenessMultiplier: 1.28,
    description: 'Excise taxes align with economic planning objectives'
  },

  // Developmental State Synergies
  {
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.DEVELOPMENTAL_STATE,
    collectionBonus: 1.22,
    complianceBonus: 1.25,
    effectivenessMultiplier: 1.28,
    description: 'Development focus creates business buy-in for corporate taxation'
  },
  {
    taxComponent: 'CUSTOMS',
    governmentComponent: ComponentType.DEVELOPMENTAL_STATE,
    collectionBonus: 1.28,
    complianceBonus: 1.22,
    effectivenessMultiplier: 1.30,
    description: 'Strategic tariff policy supports industrial development'
  }
];

// ============================================
// TAX-ECONOMY IMPACT
// ============================================

export interface TaxEconomyImpact {
  taxComponent: string;
  gdpGrowthModifier: number; // Annual GDP growth change (e.g., -0.015 = -1.5%)
  incomeInequalityModifier: number; // Gini coefficient change (e.g., -0.03 = -3 points)
  businessInvestmentModifier: number; // Business investment change (e.g., -0.08 = -8%)
  consumerSpendingModifier: number; // Consumer spending change (e.g., -0.05 = -5%)
  formalEconomyShare: number; // Shift from informal to formal economy (e.g., +0.02 = +2%)
  revenueEfficiencyModifier: number; // Revenue collection efficiency (e.g., 0.85 = 85% collected)
  description: string;
}

export const TAX_ECONOMY_IMPACT: TaxEconomyImpact[] = [
  // Personal Income Tax
  {
    taxComponent: 'INCOME',
    gdpGrowthModifier: -0.012,
    incomeInequalityModifier: -0.04,
    businessInvestmentModifier: -0.02,
    consumerSpendingModifier: -0.06,
    formalEconomyShare: 0.03,
    revenueEfficiencyModifier: 0.75,
    description: 'Progressive income tax reduces inequality but moderately dampens consumption and growth. Encourages formalization.'
  },

  // Corporate Income Tax
  {
    taxComponent: 'CORPORATE',
    gdpGrowthModifier: -0.025,
    incomeInequalityModifier: -0.02,
    businessInvestmentModifier: -0.12,
    consumerSpendingModifier: -0.01,
    formalEconomyShare: -0.02,
    revenueEfficiencyModifier: 0.68,
    description: 'Corporate tax significantly reduces business investment and can drive informalization. Moderate inequality reduction.'
  },

  // Sales Tax / VAT
  {
    taxComponent: 'SALES',
    gdpGrowthModifier: -0.018,
    incomeInequalityModifier: 0.03,
    businessInvestmentModifier: -0.03,
    consumerSpendingModifier: -0.10,
    formalEconomyShare: 0.05,
    revenueEfficiencyModifier: 0.82,
    description: 'VAT/sales tax is regressive (increases inequality) but highly efficient. Dampens consumption, encourages formalization.'
  },

  // Property Tax
  {
    taxComponent: 'PROPERTY',
    gdpGrowthModifier: -0.008,
    incomeInequalityModifier: -0.05,
    businessInvestmentModifier: -0.04,
    consumerSpendingModifier: -0.02,
    formalEconomyShare: 0.01,
    revenueEfficiencyModifier: 0.88,
    description: 'Property tax is progressive with minimal growth impact. Highly efficient and stable revenue source.'
  },

  // Capital Gains Tax
  {
    taxComponent: 'CAPITAL_GAINS',
    gdpGrowthModifier: -0.015,
    incomeInequalityModifier: -0.08,
    businessInvestmentModifier: -0.15,
    consumerSpendingModifier: 0.00,
    formalEconomyShare: 0.02,
    revenueEfficiencyModifier: 0.60,
    description: 'Capital gains tax strongly reduces inequality but significantly dampens investment. Difficult to enforce.'
  },

  // Estate Tax
  {
    taxComponent: 'ESTATE',
    gdpGrowthModifier: -0.002,
    incomeInequalityModifier: -0.10,
    businessInvestmentModifier: -0.05,
    consumerSpendingModifier: 0.00,
    formalEconomyShare: 0.00,
    revenueEfficiencyModifier: 0.55,
    description: 'Estate tax maximally reduces wealth inequality with minimal growth impact. Very difficult to collect efficiently.'
  },

  // Gift Tax
  {
    taxComponent: 'GIFT',
    gdpGrowthModifier: 0.000,
    incomeInequalityModifier: -0.03,
    businessInvestmentModifier: 0.00,
    consumerSpendingModifier: 0.00,
    formalEconomyShare: 0.00,
    revenueEfficiencyModifier: 0.45,
    description: 'Gift tax prevents estate tax evasion, modest inequality reduction. Extremely difficult to enforce.'
  },

  // Customs Duties / Tariffs
  {
    taxComponent: 'CUSTOMS',
    gdpGrowthModifier: -0.030,
    incomeInequalityModifier: 0.02,
    businessInvestmentModifier: -0.08,
    consumerSpendingModifier: -0.06,
    formalEconomyShare: -0.01,
    revenueEfficiencyModifier: 0.90,
    description: 'Tariffs reduce growth through inefficiency, slightly regressive. Easy to collect but economically distortionary.'
  },

  // Excise Tax (Sin Taxes)
  {
    taxComponent: 'EXCISE',
    gdpGrowthModifier: -0.005,
    incomeInequalityModifier: 0.01,
    businessInvestmentModifier: -0.02,
    consumerSpendingModifier: -0.04,
    formalEconomyShare: 0.01,
    revenueEfficiencyModifier: 0.85,
    description: 'Excise taxes on tobacco, alcohol, fuel generate revenue while addressing externalities. Slightly regressive.'
  },

  // Payroll Tax
  {
    taxComponent: 'PAYROLL',
    gdpGrowthModifier: -0.010,
    incomeInequalityModifier: -0.02,
    businessInvestmentModifier: -0.06,
    consumerSpendingModifier: -0.04,
    formalEconomyShare: -0.03,
    revenueEfficiencyModifier: 0.92,
    description: 'Payroll taxes efficient but discourage formal employment. Moderate growth and inequality impact.'
  },

  // Other Taxes (aggregated minor taxes)
  {
    taxComponent: 'OTHER',
    gdpGrowthModifier: -0.005,
    incomeInequalityModifier: 0.00,
    businessInvestmentModifier: -0.02,
    consumerSpendingModifier: -0.01,
    formalEconomyShare: 0.00,
    revenueEfficiencyModifier: 0.70,
    description: 'Miscellaneous taxes have varying impacts depending on design. Generally moderate efficiency.'
  }
];

// ============================================
// THREE-WAY CROSS-BUILDER SYNERGIES
// ============================================

export interface CrossBuilderSynergy {
  id: string;
  taxComponent: string;
  governmentComponent: ComponentType;
  economicCondition: string;
  compoundEffectiveness: number; // Total effectiveness multiplier
  thresholdRequirement?: string;
  description: string;
}

export const TAX_CROSS_BUILDER_SYNERGIES: CrossBuilderSynergy[] = [
  // Advanced Economy × Digital Government × Progressive Income Tax
  {
    id: 'advanced_digital_income',
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.DIGITAL_GOVERNMENT,
    economicCondition: 'Advanced Economy',
    compoundEffectiveness: 1.60,
    thresholdRequirement: 'GDP per capita > $40,000',
    description: 'Advanced digital infrastructure enables sophisticated progressive taxation with minimal evasion'
  },

  // Developing Economy × Social Democracy × VAT
  {
    id: 'developing_social_vat',
    taxComponent: 'SALES',
    governmentComponent: ComponentType.SOCIAL_DEMOCRACY,
    economicCondition: 'Developing Economy',
    compoundEffectiveness: 1.45,
    thresholdRequirement: 'GDP per capita $5,000-$15,000',
    description: 'VAT funds social programs in developing democracies, creating virtuous cycle'
  },

  // High Inequality × Progressive Income × Institutional Legitimacy
  {
    id: 'inequality_progressive_institutional',
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.INSTITUTIONAL_LEGITIMACY,
    economicCondition: 'High Income Inequality',
    compoundEffectiveness: 1.50,
    thresholdRequirement: 'Gini coefficient > 0.40',
    description: 'Strong institutions enable progressive taxation to address inequality without capital flight'
  },

  // Export-Led Economy × Developmental State × Customs
  {
    id: 'export_developmental_customs',
    taxComponent: 'CUSTOMS',
    governmentComponent: ComponentType.DEVELOPMENTAL_STATE,
    economicCondition: 'Export-Led Growth',
    compoundEffectiveness: 1.40,
    thresholdRequirement: 'Exports > 40% of GDP',
    description: 'Strategic tariff policy supports industrial development in export-oriented economy'
  },

  // Financial Center × Meritocratic × Capital Gains
  {
    id: 'financial_meritocratic_capital',
    taxComponent: 'CAPITAL_GAINS',
    governmentComponent: ComponentType.MERITOCRATIC_SYSTEM,
    economicCondition: 'Financial Services Hub',
    compoundEffectiveness: 1.55,
    thresholdRequirement: 'Finance > 15% of GDP',
    description: 'Expert administration essential for complex capital gains taxation in financial centers'
  },

  // High Formalization × Professional Bureaucracy × Corporate Tax
  {
    id: 'formal_professional_corporate',
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.PROFESSIONAL_BUREAUCRACY,
    economicCondition: 'High Formalization',
    compoundEffectiveness: 1.48,
    thresholdRequirement: 'Formal economy > 85%',
    description: 'Professional tax administration maximizes corporate tax collection in formalized economy'
  },

  // Emerging Economy × Technocratic Process × Income Tax
  {
    id: 'emerging_technocratic_income',
    taxComponent: 'INCOME',
    governmentComponent: ComponentType.TECHNOCRATIC_PROCESS,
    economicCondition: 'Emerging Economy',
    compoundEffectiveness: 1.42,
    thresholdRequirement: 'GDP growth 4-8% annually',
    description: 'Data-driven tax policy optimization crucial during rapid economic transition'
  },

  // Mature Welfare State × Social Democracy × Payroll Tax
  {
    id: 'welfare_social_payroll',
    taxComponent: 'PAYROLL',
    governmentComponent: ComponentType.SOCIAL_DEMOCRACY,
    economicCondition: 'Comprehensive Welfare System',
    compoundEffectiveness: 1.52,
    thresholdRequirement: 'Social spending > 25% of GDP',
    description: 'Payroll taxes fund social insurance in social democratic welfare states'
  },

  // Real Estate Boom × Rule of Law × Property Tax
  {
    id: 'realestate_ruleoflaw_property',
    taxComponent: 'PROPERTY',
    governmentComponent: ComponentType.RULE_OF_LAW,
    economicCondition: 'Property Market Growth',
    compoundEffectiveness: 1.38,
    thresholdRequirement: 'Property values growing > 5% annually',
    description: 'Strong legal framework captures property value appreciation through taxation'
  },

  // High Consumption × Digital Government × Sales Tax
  {
    id: 'consumption_digital_sales',
    taxComponent: 'SALES',
    governmentComponent: ComponentType.DIGITAL_GOVERNMENT,
    economicCondition: 'Consumer Economy',
    compoundEffectiveness: 1.58,
    thresholdRequirement: 'Consumption > 60% of GDP',
    description: 'Digital sales tax collection maximizes revenue in high-consumption economies'
  },

  // Innovation Economy × Performance Legitimacy × Corporate Tax
  {
    id: 'innovation_performance_corporate',
    taxComponent: 'CORPORATE',
    governmentComponent: ComponentType.PERFORMANCE_LEGITIMACY,
    economicCondition: 'Innovation-Driven Economy',
    compoundEffectiveness: 1.35,
    thresholdRequirement: 'R&D spending > 2.5% of GDP',
    description: 'Performance-based legitimacy enables corporate taxation when government delivers results for innovation'
  },

  // Resource Dependent × Economic Planning × Excise Tax
  {
    id: 'resource_planning_excise',
    taxComponent: 'EXCISE',
    governmentComponent: ComponentType.ECONOMIC_PLANNING,
    economicCondition: 'Resource-Based Economy',
    compoundEffectiveness: 1.46,
    thresholdRequirement: 'Natural resources > 20% of exports',
    description: 'Planned resource taxation (severance/excise taxes) optimizes development'
  }
];

// ============================================
// COMPREHENSIVE TYPE DEFINITIONS
// ============================================

export interface UnifiedTaxEffectiveness {
  overallScore: number; // 0-100 comprehensive effectiveness score
  collectionEfficiency: number; // Percentage of owed taxes actually collected
  complianceRate: number; // Voluntary compliance rate
  revenueStability: number; // Revenue predictability score
  economicImpact: {
    gdpGrowthEffect: number; // Net GDP growth impact
    inequalityEffect: number; // Net Gini coefficient change
    investmentEffect: number; // Business investment change
    consumingEffect: number; // Consumer spending change
    formalizationEffect: number; // Formal economy share change
  };
  governmentSynergies: TaxGovernmentSynergy[];
  crossBuilderSynergies: CrossBuilderSynergy[];
  effectivenessBreakdown: {
    component: string;
    baseEffectiveness: number;
    governmentBonus: number;
    economicBonus: number;
    finalEffectiveness: number;
  }[];
}

export interface TaxCollectionMetrics {
  theoreticalRevenue: number; // Maximum possible revenue
  actualRevenue: number; // Expected collected revenue
  collectionGap: number; // Revenue lost to evasion/avoidance
  collectionCost: number; // Cost of administration
  netRevenue: number; // Revenue minus collection costs
  efficiency: number; // Net revenue / theoretical revenue
  complianceRate: number; // Voluntary compliance percentage
  auditCoverage: number; // Percentage of returns audited
  enforcementCost: number; // Cost of enforcement activities
}

export interface TaxEconomicImpact {
  shortTermImpact: {
    gdpChange: number;
    employmentChange: number;
    investmentChange: number;
    consumptionChange: number;
  };
  mediumTermImpact: {
    gdpChange: number;
    inequalityChange: number;
    productivityChange: number;
    formalizationChange: number;
  };
  longTermImpact: {
    sustainableGrowth: number;
    structuralChange: number;
    competitivenessChange: number;
    innovationChange: number;
  };
  distributionalEffects: {
    bottomQuintile: number;
    secondQuintile: number;
    middleQuintile: number;
    fourthQuintile: number;
    topQuintile: number;
    top1Percent: number;
  };
}

export interface TaxSystemIssue {
  id: string;
  type: 'conflict' | 'missing_synergy' | 'inefficiency' | 'policy_gap' | 'economic_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: number; // Effectiveness penalty (0-100)
  recommendation: string;
  affectedComponents: string[];
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate unified tax effectiveness considering all three builders
 */
export function getUnifiedTaxEffectiveness(
  taxSystem: TaxSystem & { taxCategories?: TaxCategory[] },
  governmentComponents: ComponentType[],
  economicData: {
    gdpPerCapita: number;
    giniCoefficient: number;
    gdpGrowthRate: number;
    formalEconomyShare: number;
    consumptionGDPPercent: number;
    exportsGDPPercent: number;
  }
): UnifiedTaxEffectiveness {
  const categories = taxSystem.taxCategories || [];
  let totalCollectionEfficiency = taxSystem.collectionEfficiency || 70;
  let totalComplianceRate = taxSystem.complianceRate || 65;

  // Track synergies
  const activeSynergies: TaxGovernmentSynergy[] = [];
  const activeCrossBuilderSynergies: CrossBuilderSynergy[] = [];
  const effectivenessBreakdown: UnifiedTaxEffectiveness['effectivenessBreakdown'] = [];

  // Calculate for each tax category
  categories.forEach(category => {
    let categoryCollectionBonus = 1.0;
    let categoryComplianceBonus = 1.0;
    let categoryEffectivenessBonus = 1.0;

    // Apply government synergies
    governmentComponents.forEach(govComp => {
      const synergy = TAX_GOVERNMENT_SYNERGIES.find(
        s => s.taxComponent === category.categoryType && s.governmentComponent === govComp
      );

      if (synergy) {
        categoryCollectionBonus *= synergy.collectionBonus;
        categoryComplianceBonus *= synergy.complianceBonus;
        categoryEffectivenessBonus *= synergy.effectivenessMultiplier;
        activeSynergies.push(synergy);
      }
    });

    // Apply cross-builder synergies
    governmentComponents.forEach(govComp => {
      const economicCondition = determineEconomicCondition(economicData);
      const crossSynergy = TAX_CROSS_BUILDER_SYNERGIES.find(
        s => s.taxComponent === category.categoryType &&
             s.governmentComponent === govComp &&
             s.economicCondition === economicCondition
      );

      if (crossSynergy) {
        categoryEffectivenessBonus *= crossSynergy.compoundEffectiveness;
        activeCrossBuilderSynergies.push(crossSynergy);
      }
    });

    effectivenessBreakdown.push({
      component: category.categoryName,
      baseEffectiveness: category.rate || 0,
      governmentBonus: (categoryCollectionBonus + categoryComplianceBonus) / 2 - 1,
      economicBonus: categoryEffectivenessBonus - 1,
      finalEffectiveness: (category.rate || 0) * categoryEffectivenessBonus
    });
  });

  // Calculate aggregate economic impact
  let netGDPEffect = 0;
  let netInequalityEffect = 0;
  let netInvestmentEffect = 0;
  let netConsumptionEffect = 0;
  let netFormalizationEffect = 0;

  categories.forEach(category => {
    const impact = TAX_ECONOMY_IMPACT.find(i => i.taxComponent === category.categoryType);
    if (impact && category.rate) {
      const weight = category.rate / 100; // Weight by tax rate
      netGDPEffect += impact.gdpGrowthModifier * weight;
      netInequalityEffect += impact.incomeInequalityModifier * weight;
      netInvestmentEffect += impact.businessInvestmentModifier * weight;
      netConsumptionEffect += impact.consumerSpendingModifier * weight;
      netFormalizationEffect += impact.formalEconomyShare * weight;
    }
  });

  // Calculate overall effectiveness score
  const baseScore = 60; // Starting score
  const synergyBonus = activeSynergies.length * 3; // +3 per synergy
  const crossBuilderBonus = activeCrossBuilderSynergies.length * 5; // +5 per cross-builder synergy
  const economicPenalty = Math.abs(netGDPEffect) * 100; // Penalty for GDP drag

  const overallScore = Math.max(0, Math.min(100,
    baseScore + synergyBonus + crossBuilderBonus - economicPenalty
  ));

  return {
    overallScore,
    collectionEfficiency: totalCollectionEfficiency,
    complianceRate: totalComplianceRate,
    revenueStability: calculateRevenueStability(categories),
    economicImpact: {
      gdpGrowthEffect: netGDPEffect,
      inequalityEffect: netInequalityEffect,
      investmentEffect: netInvestmentEffect,
      consumingEffect: netConsumptionEffect,
      formalizationEffect: netFormalizationEffect
    },
    governmentSynergies: activeSynergies,
    crossBuilderSynergies: activeCrossBuilderSynergies,
    effectivenessBreakdown
  };
}

/**
 * Calculate tax collection efficiency with government and economic factors
 */
export function calculateTaxCollectionEfficiency(
  taxSystem: TaxSystem & { taxCategories?: TaxCategory[] },
  governmentComponents: ComponentType[],
  economicData: {
    gdpPerCapita: number;
    formalEconomyShare: number;
    digitalizationIndex?: number;
  }
): TaxCollectionMetrics {
  const baseEfficiency = taxSystem.collectionEfficiency || 70;
  let collectionMultiplier = 1.0;

  // Apply government component effects
  if (governmentComponents.includes(ComponentType.DIGITAL_GOVERNMENT)) {
    collectionMultiplier *= 1.30;
  }
  if (governmentComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    collectionMultiplier *= 1.25;
  }
  if (governmentComponents.includes(ComponentType.SURVEILLANCE_SYSTEM)) {
    collectionMultiplier *= 1.20;
  }

  // Economic factors
  const formalizationBonus = economicData.formalEconomyShare * 0.3; // Up to +30% for fully formal economy
  const developmentBonus = Math.min(0.2, economicData.gdpPerCapita / 200000); // Up to +20% for very wealthy

  const finalEfficiency = Math.min(95, baseEfficiency * collectionMultiplier * (1 + formalizationBonus + developmentBonus));

  // Calculate metrics
  const categories = taxSystem.taxCategories || [];
  const theoreticalRevenue = categories.reduce((sum, cat) => sum + (cat.baseRate || 0) * 1000000, 0);
  const actualRevenue = theoreticalRevenue * (finalEfficiency / 100);
  const collectionCost = actualRevenue * 0.02; // 2% collection cost
  const netRevenue = actualRevenue - collectionCost;

  return {
    theoreticalRevenue,
    actualRevenue,
    collectionGap: theoreticalRevenue - actualRevenue,
    collectionCost,
    netRevenue,
    efficiency: finalEfficiency,
    complianceRate: taxSystem.complianceRate || 65,
    auditCoverage: governmentComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY) ? 5 : 2,
    enforcementCost: collectionCost * 0.3
  };
}

/**
 * Calculate tax compliance rate with cultural and institutional factors
 */
export function calculateTaxComplianceRate(
  taxSystem: TaxSystem,
  governmentComponents: ComponentType[],
  economicData: {
    giniCoefficient: number;
    trustInGovernment?: number;
  }
): number {
  const baseCompliance = taxSystem.complianceRate || 65;
  let complianceMultiplier = 1.0;

  // Institutional factors
  if (governmentComponents.includes(ComponentType.INSTITUTIONAL_LEGITIMACY)) {
    complianceMultiplier *= 1.45;
  }
  if (governmentComponents.includes(ComponentType.PERFORMANCE_LEGITIMACY)) {
    complianceMultiplier *= 1.40;
  }
  if (governmentComponents.includes(ComponentType.ELECTORAL_LEGITIMACY)) {
    complianceMultiplier *= 1.35;
  }
  if (governmentComponents.includes(ComponentType.RULE_OF_LAW)) {
    complianceMultiplier *= 1.30;
  }
  if (governmentComponents.includes(ComponentType.SOCIAL_DEMOCRACY)) {
    complianceMultiplier *= 1.50;
  }

  // Negative factors
  if (governmentComponents.includes(ComponentType.SURVEILLANCE_SYSTEM)) {
    complianceMultiplier *= 0.75; // Reduces voluntary compliance
  }

  // Inequality penalty (high inequality reduces compliance)
  const inequalityPenalty = Math.max(0.8, 1 - (economicData.giniCoefficient - 0.3) * 0.5);

  return Math.min(95, baseCompliance * complianceMultiplier * inequalityPenalty);
}

/**
 * Calculate comprehensive economic impact of tax system
 */
export function calculateEconomicImpactOfTax(
  taxSystem: TaxSystem & { taxCategories?: TaxCategory[] },
  economicData: CoreEconomicIndicatorsData & { labor?: Partial<LaborEmploymentData> }
): TaxEconomicImpact {
  const categories = taxSystem.taxCategories || [];

  // Aggregate impacts from all tax categories
  let totalGDPEffect = 0;
  let totalInequalityEffect = 0;
  let totalInvestmentEffect = 0;
  let totalConsumptionEffect = 0;

  categories.forEach(category => {
    const impact = TAX_ECONOMY_IMPACT.find(i => i.taxComponent === category.categoryType);
    if (impact && category.rate) {
      const weight = category.rate / 100;
      totalGDPEffect += impact.gdpGrowthModifier * weight;
      totalInequalityEffect += impact.incomeInequalityModifier * weight;
      totalInvestmentEffect += impact.businessInvestmentModifier * weight;
      totalConsumptionEffect += impact.consumerSpendingModifier * weight;
    }
  });

  // Calculate distributional effects (progressive vs regressive)
  const progressivity = calculateTaxProgressivity(categories);

  return {
    shortTermImpact: {
      gdpChange: totalGDPEffect * economicData.nominalGDP,
      employmentChange: totalInvestmentEffect * 0.5, // Investment affects employment
      investmentChange: totalInvestmentEffect,
      consumptionChange: totalConsumptionEffect
    },
    mediumTermImpact: {
      gdpChange: totalGDPEffect * 1.5, // Compounding effects
      inequalityChange: totalInequalityEffect,
      productivityChange: totalInvestmentEffect * 0.3, // Investment improves productivity
      formalizationChange: 0.02 // Modest formalization
    },
    longTermImpact: {
      sustainableGrowth: totalGDPEffect * 2,
      structuralChange: totalInvestmentEffect * 0.8,
      competitivenessChange: totalGDPEffect * 0.6,
      innovationChange: totalInvestmentEffect * 0.4
    },
    distributionalEffects: {
      bottomQuintile: progressivity * 0.05,
      secondQuintile: progressivity * 0.03,
      middleQuintile: progressivity * 0.01,
      fourthQuintile: progressivity * -0.01,
      topQuintile: progressivity * -0.05,
      top1Percent: progressivity * -0.10
    }
  };
}

/**
 * Get active tax-government synergies
 */
export function getTaxGovernmentSynergies(
  taxCategories: TaxCategory[],
  governmentComponents: ComponentType[]
): TaxGovernmentSynergy[] {
  const synergies: TaxGovernmentSynergy[] = [];

  taxCategories.forEach(category => {
    governmentComponents.forEach(govComp => {
      const synergy = TAX_GOVERNMENT_SYNERGIES.find(
        s => s.taxComponent === category.categoryType && s.governmentComponent === govComp
      );
      if (synergy) {
        synergies.push(synergy);
      }
    });
  });

  return synergies;
}

/**
 * Get economic impact for tax categories
 */
export function getTaxEconomyImpact(
  taxCategories: TaxCategory[]
): TaxEconomyImpact[] {
  return taxCategories
    .map(cat => TAX_ECONOMY_IMPACT.find(i => i.taxComponent === cat.categoryType))
    .filter((impact): impact is TaxEconomyImpact => impact !== undefined);
}

/**
 * Detect issues in tax system configuration
 */
export function detectTaxSystemIssues(
  taxSystem: TaxSystem & { taxCategories?: TaxCategory[] },
  governmentComponents: ComponentType[],
  economicData: {
    gdpPerCapita: number;
    giniCoefficient: number;
    formalEconomyShare: number;
  }
): TaxSystemIssue[] {
  const issues: TaxSystemIssue[] = [];
  const categories = taxSystem.taxCategories || [];

  // Check for missing digital infrastructure in advanced economy
  if (economicData.gdpPerCapita > 40000 &&
      !governmentComponents.includes(ComponentType.DIGITAL_GOVERNMENT)) {
    issues.push({
      id: 'missing_digital_gov',
      type: 'missing_synergy',
      severity: 'high',
      title: 'Missing Digital Government Infrastructure',
      description: 'Advanced economy lacks digital tax infrastructure, losing 25-35% collection efficiency',
      impact: 25,
      recommendation: 'Implement Digital Government component for automated tax collection and filing',
      affectedComponents: categories.map(c => c.categoryName)
    });
  }

  // Check for high inequality without progressive taxation
  if (economicData.giniCoefficient > 0.45) {
    const hasProgressiveIncome = categories.some(c =>
      c.categoryType === 'INCOME' && (c.rate || 0) > 30
    );

    if (!hasProgressiveIncome) {
      issues.push({
        id: 'inequality_no_progressive',
        type: 'policy_gap',
        severity: 'high',
        title: 'High Inequality Without Progressive Taxation',
        description: 'Gini coefficient above 0.45 without strong progressive income tax to address inequality',
        impact: 20,
        recommendation: 'Implement progressive income tax or capital gains tax to reduce inequality',
        affectedComponents: ['Income Distribution', 'Social Stability']
      });
    }
  }

  // Check for surveillance without rule of law
  if (governmentComponents.includes(ComponentType.SURVEILLANCE_SYSTEM) &&
      !governmentComponents.includes(ComponentType.RULE_OF_LAW)) {
    issues.push({
      id: 'surveillance_without_law',
      type: 'conflict',
      severity: 'critical',
      title: 'Surveillance System Without Rule of Law',
      description: 'Tax surveillance without legal protections severely damages compliance (-25%)',
      impact: 30,
      recommendation: 'Implement Rule of Law component or remove Surveillance System',
      affectedComponents: ['Tax Compliance', 'Public Trust']
    });
  }

  // Check for federal system coordination issues
  if (governmentComponents.includes(ComponentType.FEDERAL_SYSTEM)) {
    const complexTaxes = categories.filter(c =>
      ['INCOME', 'SALES', 'CORPORATE'].includes(c.categoryType)
    );

    if (complexTaxes.length > 2) {
      issues.push({
        id: 'federal_coordination',
        type: 'inefficiency',
        severity: 'medium',
        title: 'Federal Tax Coordination Challenges',
        description: 'Multiple complex taxes in federal system create coordination inefficiencies (-12% efficiency)',
        impact: 12,
        recommendation: 'Simplify tax structure or strengthen central coordination mechanisms',
        affectedComponents: complexTaxes.map(c => c.categoryName)
      });
    }
  }

  // Check for low formalization with complex taxes
  if (economicData.formalEconomyShare < 0.60) {
    const complexTaxes = categories.filter(c =>
      ['CORPORATE', 'CAPITAL_GAINS', 'ESTATE'].includes(c.categoryType)
    );

    if (complexTaxes.length > 0) {
      issues.push({
        id: 'informal_economy_complex',
        type: 'inefficiency',
        severity: 'high',
        title: 'Complex Taxes in Informal Economy',
        description: 'Corporate and capital taxes ineffective with 40%+ informal economy',
        impact: 35,
        recommendation: 'Focus on simpler taxes (VAT, excise) until formalization improves',
        affectedComponents: complexTaxes.map(c => c.categoryName)
      });
    }
  }

  // Check for missing professional bureaucracy with complex system
  if (categories.length > 5 &&
      !governmentComponents.includes(ComponentType.PROFESSIONAL_BUREAUCRACY) &&
      !governmentComponents.includes(ComponentType.MERITOCRATIC_SYSTEM)) {
    issues.push({
      id: 'complex_without_capacity',
      type: 'missing_synergy',
      severity: 'high',
      title: 'Complex Tax System Without Administrative Capacity',
      description: 'Complex multi-tax system requires professional tax administration (-20% efficiency)',
      impact: 20,
      recommendation: 'Implement Professional Bureaucracy or Meritocratic System for tax administration',
      affectedComponents: ['Tax Administration', 'Collection Efficiency']
    });
  }

  // Check for regressive tax burden
  const vatRate = categories.find(c => c.categoryType === 'SALES')?.rate || 0;
  const incomeRate = categories.find(c => c.categoryType === 'INCOME')?.rate || 0;

  if (vatRate > incomeRate * 1.5 && economicData.giniCoefficient > 0.35) {
    issues.push({
      id: 'regressive_burden',
      type: 'economic_risk',
      severity: 'medium',
      title: 'Regressive Tax Structure in Unequal Society',
      description: 'Heavy reliance on VAT/sales tax increases inequality in already unequal society',
      impact: 15,
      recommendation: 'Balance with progressive income or wealth taxes',
      affectedComponents: ['Sales Tax', 'Income Tax', 'Inequality']
    });
  }

  return issues;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function determineEconomicCondition(economicData: {
  gdpPerCapita: number;
  giniCoefficient: number;
  consumptionGDPPercent: number;
  exportsGDPPercent: number;
}): string {
  if (economicData.gdpPerCapita > 40000) return 'Advanced Economy';
  if (economicData.gdpPerCapita > 15000) return 'Developed Economy';
  if (economicData.gdpPerCapita > 5000) return 'Emerging Economy';
  if (economicData.giniCoefficient > 0.45) return 'High Income Inequality';
  if (economicData.exportsGDPPercent > 40) return 'Export-Led Growth';
  if (economicData.consumptionGDPPercent > 60) return 'Consumer Economy';
  return 'Developing Economy';
}

function calculateRevenueStability(categories: TaxCategory[]): number {
  // More diverse tax base = more stable
  const diversityScore = Math.min(100, categories.length * 15);

  // Property and payroll taxes are stable
  const stableCategories = categories.filter(c =>
    ['PROPERTY', 'PAYROLL'].includes(c.categoryType)
  ).length;
  const stabilityBonus = stableCategories * 10;

  return Math.min(100, diversityScore + stabilityBonus);
}

function calculateTaxProgressivity(categories: TaxCategory[]): number {
  let progressivityScore = 0;

  // Progressive taxes
  categories.forEach(cat => {
    if (['INCOME', 'ESTATE', 'CAPITAL_GAINS'].includes(cat.categoryType)) {
      progressivityScore += (cat.rate || 0) * 0.5;
    }
  });

  // Regressive taxes
  categories.forEach(cat => {
    if (['SALES', 'CUSTOMS', 'EXCISE'].includes(cat.categoryType)) {
      progressivityScore -= (cat.rate || 0) * 0.3;
    }
  });

  return progressivityScore / 100; // Normalize to -1 to 1 scale
}
