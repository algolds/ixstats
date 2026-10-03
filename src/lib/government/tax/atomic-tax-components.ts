// Domain catalog and calculation utilities for Atomic Tax Components.

interface AtomicTaxComponent {
  id: string;
  name: string;
  category: TaxComponentCategory;
  description: string;
  implementationCost: number;
  maintenanceCost: number;
  effectiveness: number;
  prerequisites: string[];
  synergies: string[];
  conflicts: string[];
  impactsOn: string[];
  metadata: {
    complexity: "Low" | "Medium" | "High";
    timeToImplement: string;
    staffRequired: number;
    technologyRequired: boolean;
  };
}

export interface EffectivenessMetrics {
  baseEffectiveness: number;
  synergyBonus: number;
  conflictPenalty: number;
  totalEffectiveness: number;
  synergyCount: number;
  conflictCount: number;
}

type TaxComponentCategory =
  | "Collection Methods"
  | "Revenue Strategies"
  | "Compliance Systems"
  | "Incentive Structures"
  | "Administration";

/** Catalog entry as authored: costs, empty link lists and metadata in compact form. */
type TaxComponentDef = Pick<
  AtomicTaxComponent,
  "name" | "category" | "description" | "effectiveness"
> & {
  cost: [implementation: number, maintenance: number];
  prerequisites?: string[];
  synergies: string[];
  conflicts?: string[];
  impactsOn: string[];
  meta: [
    complexity: AtomicTaxComponent["metadata"]["complexity"],
    timeToImplement: string,
    staffRequired: number,
    technologyRequired: boolean,
  ];
};

const TAX_COMPONENT_DEFS: Record<string, TaxComponentDef> = {
  digital_filing: {
    name: "Digital Tax Filing",
    category: "Collection Methods",
    description:
      "Online platform for electronic tax filing, reducing paperwork and processing time",
    cost: [150000, 50000],
    effectiveness: 85,
    synergies: [
      "e_filing_infrastructure",
      "taxpayer_portal",
      "automated_verification",
      "integrated_systems",
    ],
    impactsOn: ["collectionEfficiency", "complianceRate", "administrativeCost"],
    meta: ["Medium", "12 months", 15, true],
  },
  withholding_system: {
    name: "Withholding System",
    category: "Collection Methods",
    description:
      "Employers withhold taxes at source, ensuring steady revenue flow and reducing evasion",
    cost: [100000, 40000],
    effectiveness: 92,
    synergies: ["third_party_reporting", "real_time_reporting", "automated_verification"],
    impactsOn: ["collectionEfficiency", "complianceRate", "cashFlow"],
    meta: ["Medium", "18 months", 25, true],
  },
  real_time_reporting: {
    name: "Real-Time Reporting",
    category: "Collection Methods",
    description: "Instant tax reporting and verification system for transactions",
    cost: [200000, 80000],
    effectiveness: 88,
    prerequisites: ["digital_filing"],
    synergies: [
      "withholding_system",
      "blockchain_ledger",
      "integrated_systems",
      "advanced_analytics",
    ],
    impactsOn: ["collectionEfficiency", "evasionRate", "complianceRate"],
    meta: ["High", "24 months", 35, true],
  },
  mobile_payment: {
    name: "Mobile Payment Integration",
    category: "Collection Methods",
    description: "Mobile apps and digital wallets for easy tax payments",
    cost: [120000, 45000],
    effectiveness: 80,
    prerequisites: ["digital_filing"],
    synergies: ["taxpayer_portal", "simplified_filing", "digital_filing"],
    impactsOn: ["complianceRate", "taxpayerSatisfaction", "collectionEfficiency"],
    meta: ["Low", "9 months", 12, true],
  },
  blockchain_ledger: {
    name: "Blockchain Ledger",
    category: "Collection Methods",
    description: "Immutable blockchain-based transaction and tax payment records",
    cost: [300000, 100000],
    effectiveness: 90,
    prerequisites: ["digital_filing", "real_time_reporting"],
    synergies: ["automated_verification", "integrated_systems", "advanced_analytics"],
    impactsOn: ["fraudPrevention", "transparency", "auditEfficiency"],
    meta: ["High", "36 months", 45, true],
  },
  automated_verification: {
    name: "Automated Verification",
    category: "Collection Methods",
    description: "AI-powered automated verification of tax returns and payments",
    cost: [180000, 70000],
    effectiveness: 87,
    prerequisites: ["digital_filing"],
    synergies: [
      "risk_based_auditing",
      "advanced_analytics",
      "blockchain_ledger",
      "real_time_reporting",
    ],
    impactsOn: ["processingSpeed", "errorRate", "auditEfficiency"],
    meta: ["High", "18 months", 30, true],
  },
  biometric_auth: {
    name: "Biometric Authentication",
    category: "Collection Methods",
    description: "Biometric identity verification for secure tax filing and payment",
    cost: [160000, 60000],
    effectiveness: 83,
    prerequisites: ["digital_filing"],
    synergies: ["taxpayer_portal", "mobile_payment", "automated_verification"],
    impactsOn: ["fraudPrevention", "identityVerification", "security"],
    meta: ["High", "15 months", 20, true],
  },
  progressive_tax: {
    name: "Progressive Tax",
    category: "Revenue Strategies",
    description: "Higher earners pay higher rates, promoting income equality",
    cost: [80000, 35000],
    effectiveness: 85,
    synergies: ["wealth_tax", "digital_filing", "withholding_system"],
    conflicts: ["flat_tax"],
    impactsOn: ["revenueGeneration", "incomeInequality", "taxpayerBurden"],
    meta: ["Medium", "12 months", 18, false],
  },
  flat_tax: {
    name: "Flat Tax",
    category: "Revenue Strategies",
    description: "Single rate for all income levels, simplified but less progressive",
    cost: [50000, 20000],
    effectiveness: 75,
    synergies: ["simplified_filing", "small_business_relief"],
    conflicts: ["progressive_tax", "wealth_tax"],
    impactsOn: ["administrativeSimplicity", "revenueGeneration", "complianceRate"],
    meta: ["Low", "6 months", 10, false],
  },
  vat: {
    name: "Value-Added Tax (VAT)",
    category: "Revenue Strategies",
    description: "Tax on the value added at each stage of production and distribution",
    cost: [120000, 50000],
    effectiveness: 88,
    synergies: ["real_time_reporting", "third_party_reporting", "digital_filing"],
    impactsOn: ["revenueGeneration", "consumptionBehavior", "businessCompliance"],
    meta: ["High", "24 months", 40, true],
  },
  carbon_tax: {
    name: "Carbon Tax",
    category: "Revenue Strategies",
    description: "Tax on carbon emissions to incentivize environmental sustainability",
    cost: [140000, 60000],
    effectiveness: 80,
    synergies: ["green_credits", "advanced_analytics", "third_party_reporting"],
    impactsOn: ["environmentalImpact", "revenueGeneration", "industrialBehavior"],
    meta: ["High", "18 months", 35, true],
  },
  wealth_tax: {
    name: "Wealth Tax",
    category: "Revenue Strategies",
    description: "Tax on net wealth including assets, real estate, and investments",
    cost: [110000, 55000],
    effectiveness: 82,
    synergies: ["progressive_tax", "advanced_analytics", "automated_verification"],
    conflicts: ["flat_tax"],
    impactsOn: ["revenueGeneration", "wealthInequality", "capitalFlight"],
    meta: ["High", "24 months", 30, true],
  },
  land_value_tax: {
    name: "Land Value Tax",
    category: "Revenue Strategies",
    description: "Tax based on unimproved land value, encouraging efficient land use",
    cost: [90000, 40000],
    effectiveness: 78,
    synergies: ["advanced_analytics", "automated_verification"],
    impactsOn: ["revenueGeneration", "landUtilization", "housingAffordability"],
    meta: ["Medium", "18 months", 25, true],
  },
  financial_transaction_tax: {
    name: "Financial Transaction Tax",
    category: "Revenue Strategies",
    description: "Small tax on financial transactions, reducing speculation",
    cost: [130000, 50000],
    effectiveness: 76,
    prerequisites: ["digital_filing"],
    synergies: ["real_time_reporting", "blockchain_ledger", "automated_verification"],
    impactsOn: ["revenueGeneration", "marketVolatility", "financialStability"],
    meta: ["High", "15 months", 28, true],
  },
  digital_services_tax: {
    name: "Digital Services Tax",
    category: "Revenue Strategies",
    description: "Tax on digital platforms and services revenue",
    cost: [100000, 45000],
    effectiveness: 81,
    prerequisites: ["digital_filing"],
    synergies: ["real_time_reporting", "international_cooperation", "advanced_analytics"],
    impactsOn: ["revenueGeneration", "digitalEconomy", "internationalRelations"],
    meta: ["High", "18 months", 22, true],
  },
  luxury_tax: {
    name: "Luxury Goods Tax",
    category: "Revenue Strategies",
    description: "Higher rates on luxury items and services",
    cost: [70000, 30000],
    effectiveness: 72,
    synergies: ["vat", "progressive_tax"],
    impactsOn: ["revenueGeneration", "consumptionBehavior", "luxuryMarket"],
    meta: ["Low", "9 months", 15, false],
  },
  resource_extraction_tax: {
    name: "Resource Extraction Tax",
    category: "Revenue Strategies",
    description: "Tax on natural resource extraction, ensuring public benefit",
    cost: [95000, 42000],
    effectiveness: 84,
    synergies: ["carbon_tax", "third_party_reporting", "advanced_analytics"],
    impactsOn: ["revenueGeneration", "resourceManagement", "environmentalImpact"],
    meta: ["Medium", "12 months", 20, true],
  },
  audit_system: {
    name: "Comprehensive Audit System",
    category: "Compliance Systems",
    description: "Systematic auditing of tax returns to ensure compliance",
    cost: [180000, 90000],
    effectiveness: 88,
    synergies: ["risk_based_auditing", "advanced_analytics", "automated_verification"],
    impactsOn: ["complianceRate", "evasionRate", "taxpayerTrust"],
    meta: ["High", "24 months", 50, true],
  },
  risk_based_auditing: {
    name: "Risk-Based Auditing",
    category: "Compliance Systems",
    description: "AI-driven risk assessment to target high-risk taxpayers",
    cost: [210000, 85000],
    effectiveness: 92,
    prerequisites: ["audit_system", "digital_filing"],
    synergies: ["automated_verification", "advanced_analytics", "third_party_reporting"],
    impactsOn: ["auditEfficiency", "evasionDetection", "resourceOptimization"],
    meta: ["High", "18 months", 40, true],
  },
  whistleblower_rewards: {
    name: "Whistleblower Rewards",
    category: "Compliance Systems",
    description: "Financial incentives for reporting tax evasion",
    cost: [50000, 25000],
    effectiveness: 75,
    synergies: ["audit_system", "third_party_reporting"],
    impactsOn: ["evasionDetection", "publicParticipation", "transparencyIndex"],
    meta: ["Low", "6 months", 8, false],
  },
  third_party_reporting: {
    name: "Third-Party Reporting",
    category: "Compliance Systems",
    description: "Banks, employers, and businesses report financial information",
    cost: [130000, 55000],
    effectiveness: 90,
    prerequisites: ["digital_filing"],
    synergies: ["withholding_system", "real_time_reporting", "automated_verification", "vat"],
    impactsOn: ["complianceRate", "dataAccuracy", "evasionRate"],
    meta: ["Medium", "15 months", 32, true],
  },
  tax_education: {
    name: "Tax Education Programs",
    category: "Compliance Systems",
    description: "Public education on tax obligations and benefits",
    cost: [80000, 40000],
    effectiveness: 70,
    synergies: ["simplified_filing", "taxpayer_assistance", "taxpayer_portal"],
    impactsOn: ["complianceRate", "taxpayerSatisfaction", "voluntaryCompliance"],
    meta: ["Low", "12 months", 20, false],
  },
  simplified_filing: {
    name: "Simplified Filing",
    category: "Compliance Systems",
    description: "Pre-filled returns and simplified forms for easy compliance",
    cost: [110000, 45000],
    effectiveness: 86,
    prerequisites: ["digital_filing"],
    synergies: ["withholding_system", "third_party_reporting", "flat_tax", "mobile_payment"],
    impactsOn: ["complianceRate", "taxpayerSatisfaction", "filingErrorRate"],
    meta: ["Medium", "12 months", 25, true],
  },
  taxpayer_assistance: {
    name: "Taxpayer Assistance Centers",
    category: "Compliance Systems",
    description: "Physical and virtual centers providing tax help and support",
    cost: [140000, 70000],
    effectiveness: 82,
    synergies: ["tax_education", "taxpayer_portal", "simplified_filing"],
    impactsOn: ["taxpayerSatisfaction", "complianceRate", "errorResolution"],
    meta: ["Medium", "18 months", 60, false],
  },
  rd_credits: {
    name: "R&D Tax Credits",
    category: "Incentive Structures",
    description: "Tax credits for research and development investments",
    cost: [90000, 40000],
    effectiveness: 85,
    synergies: ["innovation_incentives", "investment_zones", "advanced_analytics"],
    impactsOn: ["innovation", "economicGrowth", "businessInvestment"],
    meta: ["Medium", "12 months", 22, true],
  },
  green_credits: {
    name: "Green Tax Credits",
    category: "Incentive Structures",
    description: "Credits for environmentally sustainable practices",
    cost: [100000, 45000],
    effectiveness: 83,
    synergies: ["carbon_tax", "rd_credits", "advanced_analytics"],
    impactsOn: ["environmentalImpact", "greenInvestment", "sustainability"],
    meta: ["Medium", "15 months", 25, true],
  },
  small_business_relief: {
    name: "Small Business Relief",
    category: "Incentive Structures",
    description: "Reduced rates and simplified compliance for small businesses",
    cost: [70000, 30000],
    effectiveness: 80,
    synergies: ["simplified_filing", "flat_tax", "entrepreneurship_incentives"],
    impactsOn: ["businessFormation", "economicGrowth", "entrepreneurship"],
    meta: ["Low", "9 months", 15, false],
  },
  export_incentives: {
    name: "Export Tax Incentives",
    category: "Incentive Structures",
    description: "Tax benefits for export-oriented businesses",
    cost: [85000, 38000],
    effectiveness: 78,
    synergies: ["investment_zones", "international_cooperation"],
    impactsOn: ["exports", "tradeBalance", "economicGrowth"],
    meta: ["Medium", "12 months", 18, false],
  },
  investment_zones: {
    name: "Tax-Free Investment Zones",
    category: "Incentive Structures",
    description: "Special economic zones with reduced or zero tax rates",
    cost: [150000, 65000],
    effectiveness: 82,
    synergies: ["export_incentives", "rd_credits", "regional_offices"],
    impactsOn: ["foreignInvestment", "regionalDevelopment", "economicGrowth"],
    meta: ["High", "24 months", 35, false],
  },
  apprenticeship_credits: {
    name: "Apprenticeship Tax Credits",
    category: "Incentive Structures",
    description: "Credits for training and employing apprentices",
    cost: [65000, 28000],
    effectiveness: 76,
    synergies: ["education_credits", "small_business_relief"],
    impactsOn: ["skillsDevelopment", "employmentRate", "humanCapital"],
    meta: ["Low", "9 months", 12, false],
  },
  childcare_credits: {
    name: "Childcare Tax Credits",
    category: "Incentive Structures",
    description: "Credits for childcare expenses to support working families",
    cost: [75000, 32000],
    effectiveness: 81,
    synergies: ["education_credits", "progressive_tax"],
    impactsOn: ["workforceParticipation", "familySupport", "genderEquality"],
    meta: ["Low", "9 months", 14, false],
  },
  education_credits: {
    name: "Education Tax Credits",
    category: "Incentive Structures",
    description: "Credits for education expenses and student loan payments",
    cost: [80000, 35000],
    effectiveness: 84,
    synergies: ["childcare_credits", "apprenticeship_credits", "progressive_tax"],
    impactsOn: ["educationAccess", "humanCapital", "socialMobility"],
    meta: ["Medium", "12 months", 18, false],
  },
  innovation_incentives: {
    name: "Innovation Incentives",
    category: "Incentive Structures",
    description: "Comprehensive innovation tax incentive package",
    cost: [95000, 42000],
    effectiveness: 86,
    synergies: ["rd_credits", "green_credits", "investment_zones"],
    impactsOn: ["innovation", "economicGrowth", "competitiveness"],
    meta: ["Medium", "15 months", 24, false],
  },
  entrepreneurship_incentives: {
    name: "Entrepreneurship Incentives",
    category: "Incentive Structures",
    description: "Tax incentives for new business formation",
    cost: [75000, 33000],
    effectiveness: 79,
    synergies: ["small_business_relief", "investment_zones"],
    impactsOn: ["entrepreneurship", "businessFormation", "economicDynamism"],
    meta: ["Low", "9 months", 16, false],
  },
  e_filing_infrastructure: {
    name: "E-Filing Infrastructure",
    category: "Administration",
    description: "Comprehensive digital infrastructure for tax administration",
    cost: [250000, 100000],
    effectiveness: 90,
    synergies: ["digital_filing", "taxpayer_portal", "integrated_systems", "advanced_analytics"],
    impactsOn: ["operationalEfficiency", "costReduction", "serviceQuality"],
    meta: ["High", "30 months", 50, true],
  },
  tax_courts: {
    name: "Specialized Tax Courts",
    category: "Administration",
    description: "Dedicated courts for resolving tax disputes efficiently",
    cost: [200000, 95000],
    effectiveness: 87,
    synergies: ["appeals_process", "taxpayer_assistance"],
    impactsOn: ["disputeResolution", "taxpayerConfidence", "legalClarity"],
    meta: ["High", "36 months", 75, false],
  },
  advanced_analytics: {
    name: "Advanced Analytics",
    category: "Administration",
    description: "AI and machine learning for tax policy analysis and forecasting",
    cost: [220000, 90000],
    effectiveness: 93,
    prerequisites: ["e_filing_infrastructure", "digital_filing"],
    synergies: [
      "risk_based_auditing",
      "automated_verification",
      "integrated_systems",
      "blockchain_ledger",
    ],
    impactsOn: ["policyEffectiveness", "revenueForecastAccuracy", "riskDetection"],
    meta: ["High", "24 months", 45, true],
  },
  integrated_systems: {
    name: "Integrated Government Systems",
    category: "Administration",
    description: "Integration with other government databases and systems",
    cost: [280000, 110000],
    effectiveness: 91,
    prerequisites: ["e_filing_infrastructure"],
    synergies: [
      "third_party_reporting",
      "real_time_reporting",
      "automated_verification",
      "advanced_analytics",
    ],
    impactsOn: ["dataAccuracy", "operationalEfficiency", "interagencyCooperation"],
    meta: ["High", "36 months", 60, true],
  },
  taxpayer_portal: {
    name: "Taxpayer Self-Service Portal",
    category: "Administration",
    description: "Comprehensive online portal for all tax-related services",
    cost: [170000, 70000],
    effectiveness: 88,
    prerequisites: ["digital_filing"],
    synergies: ["mobile_payment", "simplified_filing", "taxpayer_assistance", "biometric_auth"],
    impactsOn: ["taxpayerSatisfaction", "serviceAccessibility", "costReduction"],
    meta: ["Medium", "18 months", 35, true],
  },
  regional_offices: {
    name: "Regional Tax Offices",
    category: "Administration",
    description: "Decentralized regional offices for better service coverage",
    cost: [190000, 85000],
    effectiveness: 79,
    synergies: ["taxpayer_assistance", "investment_zones"],
    impactsOn: ["serviceAccessibility", "regionalPresence", "localCompliance"],
    meta: ["Medium", "24 months", 100, false],
  },
  appeals_process: {
    name: "Structured Appeals Process",
    category: "Administration",
    description: "Fair and transparent process for taxpayers to dispute assessments",
    cost: [120000, 55000],
    effectiveness: 85,
    synergies: ["tax_courts", "taxpayer_assistance", "taxpayer_portal"],
    impactsOn: ["taxpayerTrust", "disputeResolution", "fairness"],
    meta: ["Medium", "18 months", 40, false],
  },
  international_cooperation: {
    name: "International Tax Cooperation",
    category: "Administration",
    description: "Agreements and systems for cross-border tax coordination",
    cost: [160000, 68000],
    effectiveness: 84,
    prerequisites: ["e_filing_infrastructure"],
    synergies: ["digital_services_tax", "export_incentives", "integrated_systems"],
    impactsOn: ["taxAvoidancePrevention", "internationalRelations", "revenueProtection"],
    meta: ["High", "24 months", 35, true],
  },
};

export const ATOMIC_TAX_COMPONENTS: Record<string, AtomicTaxComponent> = Object.fromEntries(
  Object.entries(TAX_COMPONENT_DEFS).map(([id, def]) => [
    id,
    {
      id,
      name: def.name,
      category: def.category,
      description: def.description,
      implementationCost: def.cost[0],
      maintenanceCost: def.cost[1],
      effectiveness: def.effectiveness,
      prerequisites: def.prerequisites ?? [],
      synergies: def.synergies,
      conflicts: def.conflicts ?? [],
      impactsOn: def.impactsOn,
      metadata: {
        complexity: def.meta[0],
        timeToImplement: def.meta[1],
        staffRequired: def.meta[2],
        technologyRequired: def.meta[3],
      },
    },
  ])
);

const TAX_SYNERGIES: Record<string, Record<string, number>> = {
  digital_filing: {
    e_filing_infrastructure: 15,
    taxpayer_portal: 12,
    automated_verification: 10,
    integrated_systems: 8,
    real_time_reporting: 10,
    simplified_filing: 8,
    mobile_payment: 7,
  },
  withholding_system: {
    third_party_reporting: 12,
    real_time_reporting: 10,
    automated_verification: 8,
    simplified_filing: 7,
  },
  real_time_reporting: {
    withholding_system: 10,
    blockchain_ledger: 12,
    integrated_systems: 10,
    advanced_analytics: 9,
    automated_verification: 8,
  },
  blockchain_ledger: {
    automated_verification: 15,
    integrated_systems: 12,
    advanced_analytics: 10,
    real_time_reporting: 12,
  },
  automated_verification: {
    risk_based_auditing: 14,
    advanced_analytics: 12,
    blockchain_ledger: 15,
    real_time_reporting: 8,
  },
  progressive_tax: {
    wealth_tax: 10,
    digital_filing: 5,
    withholding_system: 6,
    education_credits: 5,
    childcare_credits: 5,
  },
  vat: {
    real_time_reporting: 12,
    third_party_reporting: 10,
    digital_filing: 8,
  },
  carbon_tax: {
    green_credits: 14,
    advanced_analytics: 8,
    third_party_reporting: 6,
  },
  wealth_tax: {
    progressive_tax: 10,
    advanced_analytics: 9,
    automated_verification: 7,
  },
  risk_based_auditing: {
    automated_verification: 14,
    advanced_analytics: 12,
    third_party_reporting: 10,
    audit_system: 8,
  },
  third_party_reporting: {
    withholding_system: 12,
    real_time_reporting: 10,
    automated_verification: 8,
    vat: 10,
  },
  simplified_filing: {
    withholding_system: 7,
    third_party_reporting: 6,
    flat_tax: 8,
    mobile_payment: 5,
    digital_filing: 8,
  },
  rd_credits: {
    innovation_incentives: 12,
    investment_zones: 8,
    advanced_analytics: 5,
  },
  green_credits: {
    carbon_tax: 14,
    rd_credits: 6,
    advanced_analytics: 5,
  },
  small_business_relief: {
    simplified_filing: 10,
    flat_tax: 8,
    entrepreneurship_incentives: 9,
  },
  e_filing_infrastructure: {
    digital_filing: 15,
    taxpayer_portal: 12,
    integrated_systems: 10,
    advanced_analytics: 8,
  },
  advanced_analytics: {
    risk_based_auditing: 12,
    automated_verification: 12,
    integrated_systems: 10,
    blockchain_ledger: 10,
  },
  integrated_systems: {
    third_party_reporting: 12,
    real_time_reporting: 10,
    automated_verification: 9,
    advanced_analytics: 10,
  },
  taxpayer_portal: {
    mobile_payment: 10,
    simplified_filing: 9,
    taxpayer_assistance: 8,
    biometric_auth: 7,
    digital_filing: 12,
  },
};

const TAX_CONFLICTS: Record<string, string[]> = {
  progressive_tax: ["flat_tax"],
  flat_tax: ["progressive_tax", "wealth_tax"],
  wealth_tax: ["flat_tax"],
};

function checkTaxSynergy(component1Id: string, component2Id: string): number {
  const synergy1 = TAX_SYNERGIES[component1Id]?.[component2Id] || 0;
  const synergy2 = TAX_SYNERGIES[component2Id]?.[component1Id] || 0;
  return Math.max(synergy1, synergy2);
}

function checkTaxConflicts(component1Id: string, component2Id: string): boolean {
  const conflicts1 = TAX_CONFLICTS[component1Id] || [];
  const conflicts2 = TAX_CONFLICTS[component2Id] || [];
  return conflicts1.includes(component2Id) || conflicts2.includes(component1Id);
}

export function calculateTotalTaxEffectiveness(selectedComponentIds: string[]): {
  baseEffectiveness: number;
  synergyBonus: number;
  conflictPenalty: number;
  totalEffectiveness: number;
  synergyCount: number;
  conflictCount: number;
} {
  const components = selectedComponentIds.map((id) => ATOMIC_TAX_COMPONENTS[id]).filter(Boolean);

  const baseEffectiveness =
    components.reduce((sum, comp) => sum + comp!.effectiveness, 0) / (components.length || 1);

  let synergyBonus = 0;
  let synergyCount = 0;
  let conflictPenalty = 0;
  let conflictCount = 0;

  for (let i = 0; i < selectedComponentIds.length; i++) {
    for (let j = i + 1; j < selectedComponentIds.length; j++) {
      const comp1 = selectedComponentIds[i];
      const comp2 = selectedComponentIds[j];

      const synergy = checkTaxSynergy(comp1!, comp2!);
      if (synergy > 0) {
        synergyBonus += synergy;
        synergyCount++;
      }

      if (checkTaxConflicts(comp1!, comp2!)) {
        conflictPenalty += 15;
        conflictCount++;
      }
    }
  }

  const totalEffectiveness = Math.max(
    0,
    Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty)
  );

  return {
    baseEffectiveness,
    synergyBonus,
    conflictPenalty,
    totalEffectiveness,
    synergyCount,
    conflictCount,
  };
}

export const TAX_COMPONENT_CATEGORIES = Object.entries(ATOMIC_TAX_COMPONENTS).reduce(
  (byCategory, [id, component]) => {
    (byCategory[component.category] ??= []).push(id);
    return byCategory;
  },
  {} as Record<TaxComponentCategory, string[]>
);
