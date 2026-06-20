// src/lib/policy-recommender.ts
// Intelligent policy recommendation system based on country stats, atomic components, and economic conditions

import type { Country, GovernmentComponent } from "@prisma/client";

export interface PolicyRecommendation {
  id: string;
  name: string;
  description: string;
  policyType: "economic" | "social" | "diplomatic" | "infrastructure" | "governance";
  category: string;
  priority: "critical" | "high" | "medium" | "low";

  // Why this is recommended
  recommendationReason: string;
  suitabilityScore: number; // 0-100

  // Prerequisites
  meetsRequirements: boolean;
  missingRequirements: string[];

  // Expected effects
  estimatedEffects: {
    gdpEffect: number;
    employmentEffect: number;
    inflationEffect: number;
    taxRevenueEffect: number;
    customEffects?: Record<string, number>;
  };

  implementationCost: number;
  maintenanceCost: number;

  objectives: string[];
  targetMetrics: Record<string, boolean>;
}

export interface CountryContext {
  country: Country;
  governmentComponents?: GovernmentComponent[];
  economyData?: {
    gdpPerCapita: number;
    totalGdp: number;
    unemploymentRate: number;
    inflationRate: number;
    taxRevenueGDPPercent: number;
    laborForceParticipationRate: number;
  };
  activePolicies?: string[]; // IDs of active policies
}

/**
 * Policy Templates - Contextual recommendations based on country stats
 */
const POLICY_TEMPLATES: Record<
  string,
  Omit<
    PolicyRecommendation,
    "suitabilityScore" | "meetsRequirements" | "missingRequirements" | "recommendationReason"
  > & {
    conditions: (ctx: CountryContext) => {
      suitable: boolean;
      reason: string;
      score: number;
      missing: string[];
    };
  }
> = {
  // ==========================================================================
  // ADVANCED ECONOMY POLICIES (High-tier countries)
  // ==========================================================================

  INNOVATION_HUB: {
    id: "innovation_hub",
    name: "Innovation Hub Development",
    description:
      "Establish technology and innovation centers to drive R&D, attract high-skill workers, and boost productivity.",
    policyType: "economic",
    category: "technology",
    priority: "high",
    estimatedEffects: {
      gdpEffect: 3.5,
      employmentEffect: -2.0,
      inflationEffect: 0.5,
      taxRevenueEffect: 2.5,
      customEffects: {
        innovationIndex: 25,
        highSkilledImmigration: 15,
      },
    },
    implementationCost: 500000000,
    maintenanceCost: 50000000,
    objectives: [
      "Boost innovation and R&D capacity",
      "Attract high-skilled workers",
      "Increase productivity and competitiveness",
    ],
    targetMetrics: {
      gdp: true,
      employment: true,
      innovationIndex: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const gdpPerCapita = ctx.country.currentGdpPerCapita;
      const unemployment = ctx.economyData?.unemploymentRate ?? 5.0;

      const isHighTier = tier === "Developed" || tier === "Advanced";
      const hasHighGdp = gdpPerCapita > 40000;
      const hasLowUnemployment = unemployment < 6.0;

      const missing: string[] = [];
      if (!isHighTier) missing.push("Advanced/Developed economic tier");
      if (!hasHighGdp) missing.push("GDP per capita > $40,000");
      if (!hasLowUnemployment) missing.push("Unemployment rate < 6%");

      const suitable = isHighTier && hasHighGdp && hasLowUnemployment;
      const score = (isHighTier ? 40 : 0) + (hasHighGdp ? 30 : 0) + (hasLowUnemployment ? 30 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Your advanced economy is well-positioned for innovation-driven growth."
          : "This policy requires a stronger economic foundation.",
      };
    },
  },

  FINANCIAL_SERVICES_EXPANSION: {
    id: "financial_services_expansion",
    name: "Financial Services Sector Expansion",
    description:
      "Develop advanced financial services sector with modern regulatory framework to become a regional financial hub.",
    policyType: "economic",
    category: "financial_sector",
    priority: "high",
    estimatedEffects: {
      gdpEffect: 4.0,
      employmentEffect: -1.5,
      inflationEffect: 0.3,
      taxRevenueEffect: 3.5,
      customEffects: {
        financialSectorGDP: 35,
        internationalInvestment: 25,
      },
    },
    implementationCost: 750000000,
    maintenanceCost: 75000000,
    objectives: [
      "Become regional financial center",
      "Attract international investment",
      "Develop sophisticated financial markets",
    ],
    targetMetrics: {
      gdp: true,
      taxRevenue: true,
      internationalTrade: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const gdpPerCapita = ctx.country.currentGdpPerCapita;
      const taxRevenue = ctx.economyData?.taxRevenueGDPPercent ?? 0;

      const isHighTier = tier === "Developed" || tier === "Advanced";
      const hasHighGdp = gdpPerCapita > 35000;
      const hasStrongFiscal = taxRevenue > 20;

      const missing: string[] = [];
      if (!isHighTier) missing.push("Advanced/Developed economic tier");
      if (!hasHighGdp) missing.push("GDP per capita > $35,000");
      if (!hasStrongFiscal) missing.push("Tax revenue > 20% of GDP");

      const suitable = isHighTier && hasHighGdp && hasStrongFiscal;
      const score = (isHighTier ? 40 : 0) + (hasHighGdp ? 30 : 0) + (hasStrongFiscal ? 30 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Your economy has the financial stability and sophistication for this expansion."
          : "Strengthen your fiscal position before pursuing financial services expansion.",
      };
    },
  },

  // ==========================================================================
  // MID-TIER ECONOMY POLICIES
  // ==========================================================================

  EXPORT_PROMOTION: {
    id: "export_promotion",
    name: "Export Promotion Initiative",
    description:
      "Provide incentives and support for export-oriented industries to boost international trade.",
    policyType: "economic",
    category: "trade",
    priority: "high",
    estimatedEffects: {
      gdpEffect: 2.8,
      employmentEffect: -3.5,
      inflationEffect: -0.5,
      taxRevenueEffect: 1.5,
      customEffects: {
        exportsGDP: 20,
        tradeBalance: 15,
      },
    },
    implementationCost: 200000000,
    maintenanceCost: 25000000,
    objectives: [
      "Increase export competitiveness",
      "Improve trade balance",
      "Create manufacturing jobs",
    ],
    targetMetrics: {
      gdp: true,
      employment: true,
      tradeBalance: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const unemployment = ctx.economyData?.unemploymentRate ?? 5.0;
      const population = ctx.country.currentPopulation;

      const isMidTier = tier === "Emerging" || tier === "Developing" || tier === "Developed";
      const hasUnemployment = unemployment > 5.0;
      const hasPopulation = population > 5000000;

      const missing: string[] = [];
      if (!hasPopulation) missing.push("Population > 5 million");

      const suitable = isMidTier && hasPopulation;
      const score = (isMidTier ? 50 : 0) + (hasUnemployment ? 25 : 0) + (hasPopulation ? 25 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Your economy can benefit from increased export activity and job creation."
          : "This policy is best suited for larger economies.",
      };
    },
  },

  INFRASTRUCTURE_MODERNIZATION: {
    id: "infrastructure_modernization",
    name: "Infrastructure Modernization Program",
    description:
      "Major investment in transportation, utilities, and digital infrastructure to support economic growth.",
    policyType: "infrastructure",
    category: "development",
    priority: "critical",
    estimatedEffects: {
      gdpEffect: 3.2,
      employmentEffect: -4.5,
      inflationEffect: 1.0,
      taxRevenueEffect: 0.5,
      customEffects: {
        infrastructureQuality: 30,
        businessEnvironment: 20,
      },
    },
    implementationCost: 1000000000,
    maintenanceCost: 100000000,
    objectives: [
      "Modernize national infrastructure",
      "Reduce transportation costs",
      "Improve business environment",
      "Create construction jobs",
    ],
    targetMetrics: {
      gdp: true,
      employment: true,
      infrastructure: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const gdp = ctx.economyData?.totalGdp ?? ctx.country.currentTotalGdp ?? 0;
      const taxRevenue = ctx.economyData?.taxRevenueGDPPercent ?? 0;

      const canAfford = gdp > 100000000000 && taxRevenue > 15;
      const needsInfrastructure = tier !== "Advanced";

      const missing: string[] = [];
      if (!canAfford) missing.push("Total GDP > $100B and tax revenue > 15% of GDP");

      const suitable = canAfford;
      const score = (canAfford ? 60 : 0) + (needsInfrastructure ? 40 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Strategic infrastructure investment can unlock significant economic growth."
          : "Strengthen fiscal capacity before undertaking major infrastructure projects.",
      };
    },
  },

  // ==========================================================================
  // DEVELOPING ECONOMY POLICIES
  // ==========================================================================

  BASIC_EDUCATION_EXPANSION: {
    id: "basic_education_expansion",
    name: "Universal Basic Education Program",
    description: "Expand access to primary and secondary education to build human capital.",
    policyType: "social",
    category: "education",
    priority: "critical",
    estimatedEffects: {
      gdpEffect: 1.5,
      employmentEffect: -1.0,
      inflationEffect: 0.2,
      taxRevenueEffect: -1.0,
      customEffects: {
        literacyRate: 15,
        educationYears: 2,
        futureProductivity: 25,
      },
    },
    implementationCost: 150000000,
    maintenanceCost: 30000000,
    objectives: [
      "Increase literacy and education levels",
      "Build foundation for future economic growth",
      "Reduce inequality",
    ],
    targetMetrics: {
      literacy: true,
      education: true,
      humanCapital: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const literacy = ctx.country.literacyRate ?? 85;

      const isDeveloping = tier === "Developing" || tier === "Least Developed";
      const needsEducation = literacy < 90;

      const missing: string[] = [];

      const suitable = isDeveloping || needsEducation;
      const score = (isDeveloping ? 50 : 0) + (needsEducation ? 50 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Investing in education now will pay dividends for decades to come."
          : "Your education system is well-developed. Consider advanced education policies.",
      };
    },
  },

  AGRICULTURAL_SUPPORT: {
    id: "agricultural_support",
    name: "Agricultural Development & Support",
    description:
      "Provide support for agricultural sector through subsidies, technology, and market access improvements.",
    policyType: "economic",
    category: "agriculture",
    priority: "high",
    estimatedEffects: {
      gdpEffect: 2.0,
      employmentEffect: -2.5,
      inflationEffect: -1.0,
      taxRevenueEffect: 0.5,
      customEffects: {
        foodSecurity: 20,
        ruralDevelopment: 25,
        agriculturalProductivity: 30,
      },
    },
    implementationCost: 100000000,
    maintenanceCost: 20000000,
    objectives: [
      "Improve food security",
      "Support rural communities",
      "Increase agricultural productivity",
    ],
    targetMetrics: {
      gdp: true,
      employment: true,
      foodSecurity: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const ruralPop = ctx.country.ruralPopulationPercent ?? 30;

      const isDeveloping =
        tier === "Developing" || tier === "Least Developed" || tier === "Emerging";
      const hasRuralPop = ruralPop > 20;

      const missing: string[] = [];

      const suitable = isDeveloping && hasRuralPop;
      const score = (isDeveloping ? 50 : 0) + (hasRuralPop ? 50 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Your agricultural sector represents significant economic potential and social importance."
          : "This policy is more suited for countries with larger rural populations.",
      };
    },
  },

  // ==========================================================================
  // LABOR POLICIES
  // ==========================================================================

  JOB_TRAINING_INITIATIVE: {
    id: "job_training_initiative",
    name: "Workforce Retraining & Skills Development",
    description: "Comprehensive programs to upskill workers and reduce structural unemployment.",
    policyType: "social",
    category: "labor",
    priority: "high",
    estimatedEffects: {
      gdpEffect: 1.8,
      employmentEffect: -3.0,
      inflationEffect: 0.3,
      taxRevenueEffect: 1.0,
      customEffects: {
        laborProductivity: 15,
        skillsMatch: 25,
      },
    },
    implementationCost: 250000000,
    maintenanceCost: 50000000,
    objectives: [
      "Reduce unemployment through skills training",
      "Match workforce skills to market needs",
      "Increase labor productivity",
    ],
    targetMetrics: {
      unemployment: true,
      productivity: true,
      education: true,
    },
    conditions: (ctx) => {
      const unemployment = ctx.economyData?.unemploymentRate ?? 5.0;
      const participation = ctx.economyData?.laborForceParticipationRate ?? 65;

      const hasUnemployment = unemployment > 6.0;
      const hasLowParticipation = participation < 70;

      const missing: string[] = [];

      const suitable = hasUnemployment || hasLowParticipation;
      const score = (hasUnemployment ? 60 : 0) + (hasLowParticipation ? 40 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Your labor market would benefit significantly from skills development programs."
          : "Your labor market is relatively healthy. Consider advanced workforce policies.",
      };
    },
  },

  LABOR_RIGHTS_ENHANCEMENT: {
    id: "labor_rights_enhancement",
    name: "Labor Rights & Protection Enhancement",
    description:
      "Strengthen worker protections, improve working conditions, and ensure fair wages.",
    policyType: "social",
    category: "labor_rights",
    priority: "medium",
    estimatedEffects: {
      gdpEffect: 0.5,
      employmentEffect: 0.5,
      inflationEffect: 0.8,
      taxRevenueEffect: -0.5,
      customEffects: {
        workerSatisfaction: 30,
        socialStability: 20,
        productivity: 10,
      },
    },
    implementationCost: 50000000,
    maintenanceCost: 10000000,
    objectives: [
      "Improve worker protections",
      "Ensure fair wages",
      "Reduce labor disputes",
      "Increase social stability",
    ],
    targetMetrics: {
      laborRights: true,
      socialStability: true,
      inequality: true,
    },
    conditions: (ctx) => {
      const tier = ctx.country.economicTier;
      const gdpPerCapita = ctx.country.currentGdpPerCapita;

      const isEmerging = tier === "Emerging" || tier === "Developing";
      const hasModerateGdp = gdpPerCapita > 10000 && gdpPerCapita < 40000;

      const missing: string[] = [];

      const suitable = isEmerging || hasModerateGdp;
      const score = (isEmerging ? 50 : 0) + (hasModerateGdp ? 50 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Strengthening labor protections can improve social stability and productivity."
          : "This policy is most impactful for emerging economies.",
      };
    },
  },

  // ==========================================================================
  // FISCAL/TAX POLICIES
  // ==========================================================================

  TAX_REFORM_PROGRESSIVE: {
    id: "tax_reform_progressive",
    name: "Progressive Tax System Reform",
    description:
      "Implement or enhance progressive taxation to increase revenue and reduce inequality.",
    policyType: "economic",
    category: "taxation",
    priority: "high",
    estimatedEffects: {
      gdpEffect: -0.5,
      employmentEffect: 0.2,
      inflationEffect: -0.3,
      taxRevenueEffect: 4.0,
      customEffects: {
        inequality: -15,
        fiscalCapacity: 25,
      },
    },
    implementationCost: 75000000,
    maintenanceCost: 15000000,
    objectives: [
      "Increase tax revenue",
      "Reduce income inequality",
      "Improve fiscal sustainability",
    ],
    targetMetrics: {
      taxRevenue: true,
      inequality: true,
      fiscalBalance: true,
    },
    conditions: (ctx) => {
      const taxRevenue = ctx.economyData?.taxRevenueGDPPercent ?? 0;
      const tier = ctx.country.economicTier;

      const hasLowRevenue = taxRevenue < 25;
      const canImplement = tier !== "Least Developed";

      const missing: string[] = [];
      if (!canImplement) missing.push("Minimum Developing economic tier");

      const suitable = hasLowRevenue && canImplement;
      const score = (hasLowRevenue ? 60 : 0) + (canImplement ? 40 : 0);

      return {
        suitable,
        score,
        missing,
        reason: suitable
          ? "Your fiscal capacity would benefit from progressive tax reform."
          : hasLowRevenue
            ? "Strengthen administrative capacity before implementing progressive taxation."
            : "Your tax system is already well-developed.",
      };
    },
  },

  // ==========================================================================
  // GOVERNANCE POLICIES
  // ==========================================================================

  ANTI_CORRUPTION_REFORM: {
    id: "anti_corruption_reform",
    name: "Anti-Corruption & Transparency Initiative",
    description:
      "Strengthen institutions, increase transparency, and combat corruption to improve governance.",
    policyType: "governance",
    category: "institutional_reform",
    priority: "critical",
    estimatedEffects: {
      gdpEffect: 2.5,
      employmentEffect: -0.5,
      inflationEffect: -0.2,
      taxRevenueEffect: 2.0,
      customEffects: {
        corruptionIndex: -25,
        institutionalQuality: 30,
        businessEnvironment: 20,
      },
    },
    implementationCost: 100000000,
    maintenanceCost: 25000000,
    objectives: [
      "Reduce corruption",
      "Increase government transparency",
      "Strengthen rule of law",
      "Improve business environment",
    ],
    targetMetrics: {
      corruption: true,
      institutionalQuality: true,
      businessEnvironment: true,
    },
    conditions: (ctx) => {
      // This is beneficial for most countries, especially developing/emerging
      const tier = ctx.country.economicTier;
      const isDeveloping =
        tier === "Developing" || tier === "Least Developed" || tier === "Emerging";

      const missing: string[] = [];

      const suitable = true; // Always recommended
      const score = isDeveloping ? 90 : 70;

      return {
        suitable,
        score,
        missing,
        reason: "Good governance is fundamental to long-term economic success.",
      };
    },
  },
};

/**
 * Get policy recommendations based on country context
 */
export function getPolicyRecommendations(context: CountryContext): PolicyRecommendation[] {
  const recommendations: PolicyRecommendation[] = [];

  for (const [key, template] of Object.entries(POLICY_TEMPLATES)) {
    const evaluation = template.conditions(context);

    const recommendation: PolicyRecommendation = {
      id: template.id,
      name: template.name,
      description: template.description,
      policyType: template.policyType,
      category: template.category,
      priority: template.priority,
      estimatedEffects: template.estimatedEffects,
      implementationCost: template.implementationCost,
      maintenanceCost: template.maintenanceCost,
      objectives: template.objectives,
      targetMetrics: template.targetMetrics,

      suitabilityScore: evaluation.score,
      meetsRequirements: evaluation.suitable,
      missingRequirements: evaluation.missing,
      recommendationReason: evaluation.reason,
    };

    recommendations.push(recommendation);
  }

  // Sort by suitability score (highest first)
  return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

/**
 * Get top N policy recommendations
 */
export function getTopPolicyRecommendations(
  context: CountryContext,
  limit: number = 5
): PolicyRecommendation[] {
  const all = getPolicyRecommendations(context);
  return all.filter((r) => r.meetsRequirements).slice(0, limit);
}

/**
 * Get recommendations by policy type
 */
export function getPolicyRecommendationsByType(
  context: CountryContext,
  policyType: PolicyRecommendation["policyType"]
): PolicyRecommendation[] {
  const all = getPolicyRecommendations(context);
  return all.filter((r) => r.policyType === policyType);
}
