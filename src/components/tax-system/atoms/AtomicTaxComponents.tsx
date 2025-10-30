"use client";

import React from "react";
import {
  Receipt,
  Smartphone,
  Database,
  Shield,
  TrendingUp,
  Scale,
  Award,
  Target,
  Users,
  Building2,
  Globe,
  DollarSign,
  FileText,
  Clock,
  Calculator,
  Search,
  BookOpen,
  Landmark,
  BarChart3,
  Zap,
} from "lucide-react";

// ==================== TYPE DEFINITIONS ====================

export interface AtomicTaxComponent {
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

export type TaxComponentCategory =
  | "Collection Methods"
  | "Revenue Strategies"
  | "Compliance Systems"
  | "Incentive Structures"
  | "Administration";

// ==================== ATOMIC TAX COMPONENT LIBRARY ====================

export const ATOMIC_TAX_COMPONENTS: Record<string, AtomicTaxComponent> = {
  // COLLECTION METHODS (7)
  digital_filing: {
    id: "digital_filing",
    name: "Digital Tax Filing",
    category: "Collection Methods",
    description:
      "Online platform for electronic tax filing, reducing paperwork and processing time",
    implementationCost: 150000,
    maintenanceCost: 50000,
    effectiveness: 85,
    prerequisites: [],
    synergies: [
      "e_filing_infrastructure",
      "taxpayer_portal",
      "automated_verification",
      "integrated_systems",
    ],
    conflicts: [],
    impactsOn: ["collectionEfficiency", "complianceRate", "administrativeCost"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 15,
      technologyRequired: true,
    },
  },
  withholding_system: {
    id: "withholding_system",
    name: "Withholding System",
    category: "Collection Methods",
    description:
      "Employers withhold taxes at source, ensuring steady revenue flow and reducing evasion",
    implementationCost: 100000,
    maintenanceCost: 40000,
    effectiveness: 92,
    prerequisites: [],
    synergies: ["third_party_reporting", "real_time_reporting", "automated_verification"],
    conflicts: [],
    impactsOn: ["collectionEfficiency", "complianceRate", "cashFlow"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "18 months",
      staffRequired: 25,
      technologyRequired: true,
    },
  },
  real_time_reporting: {
    id: "real_time_reporting",
    name: "Real-Time Reporting",
    category: "Collection Methods",
    description: "Instant tax reporting and verification system for transactions",
    implementationCost: 200000,
    maintenanceCost: 80000,
    effectiveness: 88,
    prerequisites: ["digital_filing"],
    synergies: [
      "withholding_system",
      "blockchain_ledger",
      "integrated_systems",
      "advanced_analytics",
    ],
    conflicts: [],
    impactsOn: ["collectionEfficiency", "evasionRate", "complianceRate"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 35,
      technologyRequired: true,
    },
  },
  mobile_payment: {
    id: "mobile_payment",
    name: "Mobile Payment Integration",
    category: "Collection Methods",
    description: "Mobile apps and digital wallets for easy tax payments",
    implementationCost: 120000,
    maintenanceCost: 45000,
    effectiveness: 80,
    prerequisites: ["digital_filing"],
    synergies: ["taxpayer_portal", "simplified_filing", "digital_filing"],
    conflicts: [],
    impactsOn: ["complianceRate", "taxpayerSatisfaction", "collectionEfficiency"],
    metadata: {
      complexity: "Low",
      timeToImplement: "9 months",
      staffRequired: 12,
      technologyRequired: true,
    },
  },
  blockchain_ledger: {
    id: "blockchain_ledger",
    name: "Blockchain Ledger",
    category: "Collection Methods",
    description: "Immutable blockchain-based transaction and tax payment records",
    implementationCost: 300000,
    maintenanceCost: 100000,
    effectiveness: 90,
    prerequisites: ["digital_filing", "real_time_reporting"],
    synergies: ["automated_verification", "integrated_systems", "advanced_analytics"],
    conflicts: [],
    impactsOn: ["fraudPrevention", "transparency", "auditEfficiency"],
    metadata: {
      complexity: "High",
      timeToImplement: "36 months",
      staffRequired: 45,
      technologyRequired: true,
    },
  },
  automated_verification: {
    id: "automated_verification",
    name: "Automated Verification",
    category: "Collection Methods",
    description: "AI-powered automated verification of tax returns and payments",
    implementationCost: 180000,
    maintenanceCost: 70000,
    effectiveness: 87,
    prerequisites: ["digital_filing"],
    synergies: [
      "risk_based_auditing",
      "advanced_analytics",
      "blockchain_ledger",
      "real_time_reporting",
    ],
    conflicts: [],
    impactsOn: ["processingSpeed", "errorRate", "auditEfficiency"],
    metadata: {
      complexity: "High",
      timeToImplement: "18 months",
      staffRequired: 30,
      technologyRequired: true,
    },
  },
  biometric_auth: {
    id: "biometric_auth",
    name: "Biometric Authentication",
    category: "Collection Methods",
    description: "Biometric identity verification for secure tax filing and payment",
    implementationCost: 160000,
    maintenanceCost: 60000,
    effectiveness: 83,
    prerequisites: ["digital_filing"],
    synergies: ["taxpayer_portal", "mobile_payment", "automated_verification"],
    conflicts: [],
    impactsOn: ["fraudPrevention", "identityVerification", "security"],
    metadata: {
      complexity: "High",
      timeToImplement: "15 months",
      staffRequired: 20,
      technologyRequired: true,
    },
  },

  // REVENUE STRATEGIES (10)
  progressive_tax: {
    id: "progressive_tax",
    name: "Progressive Tax",
    category: "Revenue Strategies",
    description: "Higher earners pay higher rates, promoting income equality",
    implementationCost: 80000,
    maintenanceCost: 35000,
    effectiveness: 85,
    prerequisites: [],
    synergies: ["wealth_tax", "digital_filing", "withholding_system"],
    conflicts: ["flat_tax"],
    impactsOn: ["revenueGeneration", "incomeInequality", "taxpayerBurden"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 18,
      technologyRequired: false,
    },
  },
  flat_tax: {
    id: "flat_tax",
    name: "Flat Tax",
    category: "Revenue Strategies",
    description: "Single rate for all income levels, simplified but less progressive",
    implementationCost: 50000,
    maintenanceCost: 20000,
    effectiveness: 75,
    prerequisites: [],
    synergies: ["simplified_filing", "small_business_relief"],
    conflicts: ["progressive_tax", "wealth_tax"],
    impactsOn: ["administrativeSimplicity", "revenueGeneration", "complianceRate"],
    metadata: {
      complexity: "Low",
      timeToImplement: "6 months",
      staffRequired: 10,
      technologyRequired: false,
    },
  },
  vat: {
    id: "vat",
    name: "Value-Added Tax (VAT)",
    category: "Revenue Strategies",
    description: "Tax on the value added at each stage of production and distribution",
    implementationCost: 120000,
    maintenanceCost: 50000,
    effectiveness: 88,
    prerequisites: [],
    synergies: ["real_time_reporting", "third_party_reporting", "digital_filing"],
    conflicts: [],
    impactsOn: ["revenueGeneration", "consumptionBehavior", "businessCompliance"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 40,
      technologyRequired: true,
    },
  },
  carbon_tax: {
    id: "carbon_tax",
    name: "Carbon Tax",
    category: "Revenue Strategies",
    description: "Tax on carbon emissions to incentivize environmental sustainability",
    implementationCost: 140000,
    maintenanceCost: 60000,
    effectiveness: 80,
    prerequisites: [],
    synergies: ["green_credits", "advanced_analytics", "third_party_reporting"],
    conflicts: [],
    impactsOn: ["environmentalImpact", "revenueGeneration", "industrialBehavior"],
    metadata: {
      complexity: "High",
      timeToImplement: "18 months",
      staffRequired: 35,
      technologyRequired: true,
    },
  },
  wealth_tax: {
    id: "wealth_tax",
    name: "Wealth Tax",
    category: "Revenue Strategies",
    description: "Tax on net wealth including assets, real estate, and investments",
    implementationCost: 110000,
    maintenanceCost: 55000,
    effectiveness: 82,
    prerequisites: [],
    synergies: ["progressive_tax", "advanced_analytics", "automated_verification"],
    conflicts: ["flat_tax"],
    impactsOn: ["revenueGeneration", "wealthInequality", "capitalFlight"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 30,
      technologyRequired: true,
    },
  },
  land_value_tax: {
    id: "land_value_tax",
    name: "Land Value Tax",
    category: "Revenue Strategies",
    description: "Tax based on unimproved land value, encouraging efficient land use",
    implementationCost: 90000,
    maintenanceCost: 40000,
    effectiveness: 78,
    prerequisites: [],
    synergies: ["advanced_analytics", "automated_verification"],
    conflicts: [],
    impactsOn: ["revenueGeneration", "landUtilization", "housingAffordability"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "18 months",
      staffRequired: 25,
      technologyRequired: true,
    },
  },
  financial_transaction_tax: {
    id: "financial_transaction_tax",
    name: "Financial Transaction Tax",
    category: "Revenue Strategies",
    description: "Small tax on financial transactions, reducing speculation",
    implementationCost: 130000,
    maintenanceCost: 50000,
    effectiveness: 76,
    prerequisites: ["digital_filing"],
    synergies: ["real_time_reporting", "blockchain_ledger", "automated_verification"],
    conflicts: [],
    impactsOn: ["revenueGeneration", "marketVolatility", "financialStability"],
    metadata: {
      complexity: "High",
      timeToImplement: "15 months",
      staffRequired: 28,
      technologyRequired: true,
    },
  },
  digital_services_tax: {
    id: "digital_services_tax",
    name: "Digital Services Tax",
    category: "Revenue Strategies",
    description: "Tax on digital platforms and services revenue",
    implementationCost: 100000,
    maintenanceCost: 45000,
    effectiveness: 81,
    prerequisites: ["digital_filing"],
    synergies: ["real_time_reporting", "international_cooperation", "advanced_analytics"],
    conflicts: [],
    impactsOn: ["revenueGeneration", "digitalEconomy", "internationalRelations"],
    metadata: {
      complexity: "High",
      timeToImplement: "18 months",
      staffRequired: 22,
      technologyRequired: true,
    },
  },
  luxury_tax: {
    id: "luxury_tax",
    name: "Luxury Goods Tax",
    category: "Revenue Strategies",
    description: "Higher rates on luxury items and services",
    implementationCost: 70000,
    maintenanceCost: 30000,
    effectiveness: 72,
    prerequisites: [],
    synergies: ["vat", "progressive_tax"],
    conflicts: [],
    impactsOn: ["revenueGeneration", "consumptionBehavior", "luxuryMarket"],
    metadata: {
      complexity: "Low",
      timeToImplement: "9 months",
      staffRequired: 15,
      technologyRequired: false,
    },
  },
  resource_extraction_tax: {
    id: "resource_extraction_tax",
    name: "Resource Extraction Tax",
    category: "Revenue Strategies",
    description: "Tax on natural resource extraction, ensuring public benefit",
    implementationCost: 95000,
    maintenanceCost: 42000,
    effectiveness: 84,
    prerequisites: [],
    synergies: ["carbon_tax", "third_party_reporting", "advanced_analytics"],
    conflicts: [],
    impactsOn: ["revenueGeneration", "resourceManagement", "environmentalImpact"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 20,
      technologyRequired: true,
    },
  },

  // COMPLIANCE SYSTEMS (7)
  audit_system: {
    id: "audit_system",
    name: "Comprehensive Audit System",
    category: "Compliance Systems",
    description: "Systematic auditing of tax returns to ensure compliance",
    implementationCost: 180000,
    maintenanceCost: 90000,
    effectiveness: 88,
    prerequisites: [],
    synergies: ["risk_based_auditing", "advanced_analytics", "automated_verification"],
    conflicts: [],
    impactsOn: ["complianceRate", "evasionRate", "taxpayerTrust"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 50,
      technologyRequired: true,
    },
  },
  risk_based_auditing: {
    id: "risk_based_auditing",
    name: "Risk-Based Auditing",
    category: "Compliance Systems",
    description: "AI-driven risk assessment to target high-risk taxpayers",
    implementationCost: 210000,
    maintenanceCost: 85000,
    effectiveness: 92,
    prerequisites: ["audit_system", "digital_filing"],
    synergies: ["automated_verification", "advanced_analytics", "third_party_reporting"],
    conflicts: [],
    impactsOn: ["auditEfficiency", "evasionDetection", "resourceOptimization"],
    metadata: {
      complexity: "High",
      timeToImplement: "18 months",
      staffRequired: 40,
      technologyRequired: true,
    },
  },
  whistleblower_rewards: {
    id: "whistleblower_rewards",
    name: "Whistleblower Rewards",
    category: "Compliance Systems",
    description: "Financial incentives for reporting tax evasion",
    implementationCost: 50000,
    maintenanceCost: 25000,
    effectiveness: 75,
    prerequisites: [],
    synergies: ["audit_system", "third_party_reporting"],
    conflicts: [],
    impactsOn: ["evasionDetection", "publicParticipation", "transparencyIndex"],
    metadata: {
      complexity: "Low",
      timeToImplement: "6 months",
      staffRequired: 8,
      technologyRequired: false,
    },
  },
  third_party_reporting: {
    id: "third_party_reporting",
    name: "Third-Party Reporting",
    category: "Compliance Systems",
    description: "Banks, employers, and businesses report financial information",
    implementationCost: 130000,
    maintenanceCost: 55000,
    effectiveness: 90,
    prerequisites: ["digital_filing"],
    synergies: ["withholding_system", "real_time_reporting", "automated_verification", "vat"],
    conflicts: [],
    impactsOn: ["complianceRate", "dataAccuracy", "evasionRate"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "15 months",
      staffRequired: 32,
      technologyRequired: true,
    },
  },
  tax_education: {
    id: "tax_education",
    name: "Tax Education Programs",
    category: "Compliance Systems",
    description: "Public education on tax obligations and benefits",
    implementationCost: 80000,
    maintenanceCost: 40000,
    effectiveness: 70,
    prerequisites: [],
    synergies: ["simplified_filing", "taxpayer_assistance", "taxpayer_portal"],
    conflicts: [],
    impactsOn: ["complianceRate", "taxpayerSatisfaction", "voluntaryCompliance"],
    metadata: {
      complexity: "Low",
      timeToImplement: "12 months",
      staffRequired: 20,
      technologyRequired: false,
    },
  },
  simplified_filing: {
    id: "simplified_filing",
    name: "Simplified Filing",
    category: "Compliance Systems",
    description: "Pre-filled returns and simplified forms for easy compliance",
    implementationCost: 110000,
    maintenanceCost: 45000,
    effectiveness: 86,
    prerequisites: ["digital_filing"],
    synergies: ["withholding_system", "third_party_reporting", "flat_tax", "mobile_payment"],
    conflicts: [],
    impactsOn: ["complianceRate", "taxpayerSatisfaction", "filingErrorRate"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 25,
      technologyRequired: true,
    },
  },
  taxpayer_assistance: {
    id: "taxpayer_assistance",
    name: "Taxpayer Assistance Centers",
    category: "Compliance Systems",
    description: "Physical and virtual centers providing tax help and support",
    implementationCost: 140000,
    maintenanceCost: 70000,
    effectiveness: 82,
    prerequisites: [],
    synergies: ["tax_education", "taxpayer_portal", "simplified_filing"],
    conflicts: [],
    impactsOn: ["taxpayerSatisfaction", "complianceRate", "errorResolution"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "18 months",
      staffRequired: 60,
      technologyRequired: false,
    },
  },

  // INCENTIVE STRUCTURES (8)
  rd_credits: {
    id: "rd_credits",
    name: "R&D Tax Credits",
    category: "Incentive Structures",
    description: "Tax credits for research and development investments",
    implementationCost: 90000,
    maintenanceCost: 40000,
    effectiveness: 85,
    prerequisites: [],
    synergies: ["innovation_incentives", "investment_zones", "advanced_analytics"],
    conflicts: [],
    impactsOn: ["innovation", "economicGrowth", "businessInvestment"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 22,
      technologyRequired: true,
    },
  },
  green_credits: {
    id: "green_credits",
    name: "Green Tax Credits",
    category: "Incentive Structures",
    description: "Credits for environmentally sustainable practices",
    implementationCost: 100000,
    maintenanceCost: 45000,
    effectiveness: 83,
    prerequisites: [],
    synergies: ["carbon_tax", "rd_credits", "advanced_analytics"],
    conflicts: [],
    impactsOn: ["environmentalImpact", "greenInvestment", "sustainability"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "15 months",
      staffRequired: 25,
      technologyRequired: true,
    },
  },
  small_business_relief: {
    id: "small_business_relief",
    name: "Small Business Relief",
    category: "Incentive Structures",
    description: "Reduced rates and simplified compliance for small businesses",
    implementationCost: 70000,
    maintenanceCost: 30000,
    effectiveness: 80,
    prerequisites: [],
    synergies: ["simplified_filing", "flat_tax", "entrepreneurship_incentives"],
    conflicts: [],
    impactsOn: ["businessFormation", "economicGrowth", "entrepreneurship"],
    metadata: {
      complexity: "Low",
      timeToImplement: "9 months",
      staffRequired: 15,
      technologyRequired: false,
    },
  },
  export_incentives: {
    id: "export_incentives",
    name: "Export Tax Incentives",
    category: "Incentive Structures",
    description: "Tax benefits for export-oriented businesses",
    implementationCost: 85000,
    maintenanceCost: 38000,
    effectiveness: 78,
    prerequisites: [],
    synergies: ["investment_zones", "international_cooperation"],
    conflicts: [],
    impactsOn: ["exports", "tradeBalance", "economicGrowth"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 18,
      technologyRequired: false,
    },
  },
  investment_zones: {
    id: "investment_zones",
    name: "Tax-Free Investment Zones",
    category: "Incentive Structures",
    description: "Special economic zones with reduced or zero tax rates",
    implementationCost: 150000,
    maintenanceCost: 65000,
    effectiveness: 82,
    prerequisites: [],
    synergies: ["export_incentives", "rd_credits", "regional_offices"],
    conflicts: [],
    impactsOn: ["foreignInvestment", "regionalDevelopment", "economicGrowth"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 35,
      technologyRequired: false,
    },
  },
  apprenticeship_credits: {
    id: "apprenticeship_credits",
    name: "Apprenticeship Tax Credits",
    category: "Incentive Structures",
    description: "Credits for training and employing apprentices",
    implementationCost: 65000,
    maintenanceCost: 28000,
    effectiveness: 76,
    prerequisites: [],
    synergies: ["education_credits", "small_business_relief"],
    conflicts: [],
    impactsOn: ["skillsDevelopment", "employmentRate", "humanCapital"],
    metadata: {
      complexity: "Low",
      timeToImplement: "9 months",
      staffRequired: 12,
      technologyRequired: false,
    },
  },
  childcare_credits: {
    id: "childcare_credits",
    name: "Childcare Tax Credits",
    category: "Incentive Structures",
    description: "Credits for childcare expenses to support working families",
    implementationCost: 75000,
    maintenanceCost: 32000,
    effectiveness: 81,
    prerequisites: [],
    synergies: ["education_credits", "progressive_tax"],
    conflicts: [],
    impactsOn: ["workforceParticipation", "familySupport", "genderEquality"],
    metadata: {
      complexity: "Low",
      timeToImplement: "9 months",
      staffRequired: 14,
      technologyRequired: false,
    },
  },
  education_credits: {
    id: "education_credits",
    name: "Education Tax Credits",
    category: "Incentive Structures",
    description: "Credits for education expenses and student loan payments",
    implementationCost: 80000,
    maintenanceCost: 35000,
    effectiveness: 84,
    prerequisites: [],
    synergies: ["childcare_credits", "apprenticeship_credits", "progressive_tax"],
    conflicts: [],
    impactsOn: ["educationAccess", "humanCapital", "socialMobility"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "12 months",
      staffRequired: 18,
      technologyRequired: false,
    },
  },

  // ADMINISTRATION (7)
  e_filing_infrastructure: {
    id: "e_filing_infrastructure",
    name: "E-Filing Infrastructure",
    category: "Administration",
    description: "Comprehensive digital infrastructure for tax administration",
    implementationCost: 250000,
    maintenanceCost: 100000,
    effectiveness: 90,
    prerequisites: [],
    synergies: ["digital_filing", "taxpayer_portal", "integrated_systems", "advanced_analytics"],
    conflicts: [],
    impactsOn: ["operationalEfficiency", "costReduction", "serviceQuality"],
    metadata: {
      complexity: "High",
      timeToImplement: "30 months",
      staffRequired: 50,
      technologyRequired: true,
    },
  },
  tax_courts: {
    id: "tax_courts",
    name: "Specialized Tax Courts",
    category: "Administration",
    description: "Dedicated courts for resolving tax disputes efficiently",
    implementationCost: 200000,
    maintenanceCost: 95000,
    effectiveness: 87,
    prerequisites: [],
    synergies: ["appeals_process", "taxpayer_assistance"],
    conflicts: [],
    impactsOn: ["disputeResolution", "taxpayerConfidence", "legalClarity"],
    metadata: {
      complexity: "High",
      timeToImplement: "36 months",
      staffRequired: 75,
      technologyRequired: false,
    },
  },
  advanced_analytics: {
    id: "advanced_analytics",
    name: "Advanced Analytics",
    category: "Administration",
    description: "AI and machine learning for tax policy analysis and forecasting",
    implementationCost: 220000,
    maintenanceCost: 90000,
    effectiveness: 93,
    prerequisites: ["e_filing_infrastructure", "digital_filing"],
    synergies: [
      "risk_based_auditing",
      "automated_verification",
      "integrated_systems",
      "blockchain_ledger",
    ],
    conflicts: [],
    impactsOn: ["policyEffectiveness", "revenueForecastAccuracy", "riskDetection"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 45,
      technologyRequired: true,
    },
  },
  integrated_systems: {
    id: "integrated_systems",
    name: "Integrated Government Systems",
    category: "Administration",
    description: "Integration with other government databases and systems",
    implementationCost: 280000,
    maintenanceCost: 110000,
    effectiveness: 91,
    prerequisites: ["e_filing_infrastructure"],
    synergies: [
      "third_party_reporting",
      "real_time_reporting",
      "automated_verification",
      "advanced_analytics",
    ],
    conflicts: [],
    impactsOn: ["dataAccuracy", "operationalEfficiency", "interagencyCooperation"],
    metadata: {
      complexity: "High",
      timeToImplement: "36 months",
      staffRequired: 60,
      technologyRequired: true,
    },
  },
  taxpayer_portal: {
    id: "taxpayer_portal",
    name: "Taxpayer Self-Service Portal",
    category: "Administration",
    description: "Comprehensive online portal for all tax-related services",
    implementationCost: 170000,
    maintenanceCost: 70000,
    effectiveness: 88,
    prerequisites: ["digital_filing"],
    synergies: ["mobile_payment", "simplified_filing", "taxpayer_assistance", "biometric_auth"],
    conflicts: [],
    impactsOn: ["taxpayerSatisfaction", "serviceAccessibility", "costReduction"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "18 months",
      staffRequired: 35,
      technologyRequired: true,
    },
  },
  regional_offices: {
    id: "regional_offices",
    name: "Regional Tax Offices",
    category: "Administration",
    description: "Decentralized regional offices for better service coverage",
    implementationCost: 190000,
    maintenanceCost: 85000,
    effectiveness: 79,
    prerequisites: [],
    synergies: ["taxpayer_assistance", "investment_zones"],
    conflicts: [],
    impactsOn: ["serviceAccessibility", "regionalPresence", "localCompliance"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "24 months",
      staffRequired: 100,
      technologyRequired: false,
    },
  },
  appeals_process: {
    id: "appeals_process",
    name: "Structured Appeals Process",
    category: "Administration",
    description: "Fair and transparent process for taxpayers to dispute assessments",
    implementationCost: 120000,
    maintenanceCost: 55000,
    effectiveness: 85,
    prerequisites: [],
    synergies: ["tax_courts", "taxpayer_assistance", "taxpayer_portal"],
    conflicts: [],
    impactsOn: ["taxpayerTrust", "disputeResolution", "fairness"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "18 months",
      staffRequired: 40,
      technologyRequired: false,
    },
  },

  // Additional synergy components for cross-references
  innovation_incentives: {
    id: "innovation_incentives",
    name: "Innovation Incentives",
    category: "Incentive Structures",
    description: "Comprehensive innovation tax incentive package",
    implementationCost: 95000,
    maintenanceCost: 42000,
    effectiveness: 86,
    prerequisites: [],
    synergies: ["rd_credits", "green_credits", "investment_zones"],
    conflicts: [],
    impactsOn: ["innovation", "economicGrowth", "competitiveness"],
    metadata: {
      complexity: "Medium",
      timeToImplement: "15 months",
      staffRequired: 24,
      technologyRequired: false,
    },
  },
  entrepreneurship_incentives: {
    id: "entrepreneurship_incentives",
    name: "Entrepreneurship Incentives",
    category: "Incentive Structures",
    description: "Tax incentives for new business formation",
    implementationCost: 75000,
    maintenanceCost: 33000,
    effectiveness: 79,
    prerequisites: [],
    synergies: ["small_business_relief", "investment_zones"],
    conflicts: [],
    impactsOn: ["entrepreneurship", "businessFormation", "economicDynamism"],
    metadata: {
      complexity: "Low",
      timeToImplement: "9 months",
      staffRequired: 16,
      technologyRequired: false,
    },
  },
  international_cooperation: {
    id: "international_cooperation",
    name: "International Tax Cooperation",
    category: "Administration",
    description: "Agreements and systems for cross-border tax coordination",
    implementationCost: 160000,
    maintenanceCost: 68000,
    effectiveness: 84,
    prerequisites: ["e_filing_infrastructure"],
    synergies: ["digital_services_tax", "export_incentives", "integrated_systems"],
    conflicts: [],
    impactsOn: ["taxAvoidancePrevention", "internationalRelations", "revenueProtection"],
    metadata: {
      complexity: "High",
      timeToImplement: "24 months",
      staffRequired: 35,
      technologyRequired: true,
    },
  },
};

// ==================== SYNERGY AND CONFLICT MAPPINGS ====================

export const TAX_SYNERGIES: Record<string, Record<string, number>> = {
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

export const TAX_CONFLICTS: Record<string, string[]> = {
  progressive_tax: ["flat_tax"],
  flat_tax: ["progressive_tax", "wealth_tax"],
  wealth_tax: ["flat_tax"],
};

// ==================== CALCULATION FUNCTIONS ====================

export function checkTaxSynergy(component1Id: string, component2Id: string): number {
  const synergy1 = TAX_SYNERGIES[component1Id]?.[component2Id] || 0;
  const synergy2 = TAX_SYNERGIES[component2Id]?.[component1Id] || 0;
  return Math.max(synergy1, synergy2);
}

export function checkTaxConflicts(component1Id: string, component2Id: string): boolean {
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
    components.reduce((sum, comp) => sum + comp.effectiveness, 0) / (components.length || 1);

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

// ==================== COMPONENT CATEGORIES ====================

export const TAX_COMPONENT_CATEGORIES: Record<TaxComponentCategory, string[]> = {
  "Collection Methods": [
    "digital_filing",
    "withholding_system",
    "real_time_reporting",
    "mobile_payment",
    "blockchain_ledger",
    "automated_verification",
    "biometric_auth",
  ],
  "Revenue Strategies": [
    "progressive_tax",
    "flat_tax",
    "vat",
    "carbon_tax",
    "wealth_tax",
    "land_value_tax",
    "financial_transaction_tax",
    "digital_services_tax",
    "luxury_tax",
    "resource_extraction_tax",
  ],
  "Compliance Systems": [
    "audit_system",
    "risk_based_auditing",
    "whistleblower_rewards",
    "third_party_reporting",
    "tax_education",
    "simplified_filing",
    "taxpayer_assistance",
  ],
  "Incentive Structures": [
    "rd_credits",
    "green_credits",
    "small_business_relief",
    "export_incentives",
    "investment_zones",
    "apprenticeship_credits",
    "childcare_credits",
    "education_credits",
    "innovation_incentives",
    "entrepreneurship_incentives",
  ],
  Administration: [
    "e_filing_infrastructure",
    "tax_courts",
    "advanced_analytics",
    "integrated_systems",
    "taxpayer_portal",
    "regional_offices",
    "appeals_process",
    "international_cooperation",
  ],
};

// ==================== ICON MAPPING ====================

const CATEGORY_ICONS: Record<TaxComponentCategory, React.ReactNode> = {
  "Collection Methods": <Smartphone className="h-5 w-5" />,
  "Revenue Strategies": <DollarSign className="h-5 w-5" />,
  "Compliance Systems": <Shield className="h-5 w-5" />,
  "Incentive Structures": <Award className="h-5 w-5" />,
  Administration: <Building2 className="h-5 w-5" />,
};

const COMPONENT_ICONS: Record<string, React.ReactNode> = {
  digital_filing: <FileText className="h-4 w-4" />,
  withholding_system: <Receipt className="h-4 w-4" />,
  real_time_reporting: <Clock className="h-4 w-4" />,
  mobile_payment: <Smartphone className="h-4 w-4" />,
  blockchain_ledger: <Database className="h-4 w-4" />,
  automated_verification: <Zap className="h-4 w-4" />,
  biometric_auth: <Shield className="h-4 w-4" />,
  progressive_tax: <TrendingUp className="h-4 w-4" />,
  flat_tax: <Scale className="h-4 w-4" />,
  vat: <Receipt className="h-4 w-4" />,
  carbon_tax: <Globe className="h-4 w-4" />,
  wealth_tax: <DollarSign className="h-4 w-4" />,
  audit_system: <Search className="h-4 w-4" />,
  risk_based_auditing: <Target className="h-4 w-4" />,
  third_party_reporting: <Users className="h-4 w-4" />,
  tax_education: <BookOpen className="h-4 w-4" />,
  simplified_filing: <FileText className="h-4 w-4" />,
  rd_credits: <Award className="h-4 w-4" />,
  green_credits: <Award className="h-4 w-4" />,
  small_business_relief: <Building2 className="h-4 w-4" />,
  e_filing_infrastructure: <Database className="h-4 w-4" />,
  tax_courts: <Landmark className="h-4 w-4" />,
  advanced_analytics: <BarChart3 className="h-4 w-4" />,
  taxpayer_portal: <Globe className="h-4 w-4" />,
  appeals_process: <Scale className="h-4 w-4" />,
};

// ==================== REACT COMPONENT ====================

import { UnifiedAtomicComponentSelector } from "~/components/atomic/shared/UnifiedAtomicComponentSelector";
import { TAX_THEME } from "~/components/atomic/shared/themes";

interface AtomicTaxComponentSelectorProps {
  selectedComponents: string[];
  onComponentChange: (componentIds: string[]) => void;
  maxComponents?: number;
  isReadOnly?: boolean;
}

export function AtomicTaxComponentSelector({
  selectedComponents,
  onComponentChange,
  maxComponents = 15,
  isReadOnly = false,
}: AtomicTaxComponentSelectorProps) {
  return (
    <UnifiedAtomicComponentSelector
      components={ATOMIC_TAX_COMPONENTS}
      categories={TAX_COMPONENT_CATEGORIES}
      selectedComponents={selectedComponents}
      onComponentChange={onComponentChange}
      maxComponents={maxComponents}
      isReadOnly={isReadOnly}
      theme={TAX_THEME}
      systemName="Atomic Tax Components"
      systemIcon={Receipt}
      calculateEffectiveness={calculateTotalTaxEffectiveness}
      checkSynergy={checkTaxSynergy}
      checkConflict={checkTaxConflicts}
    />
  );
}
