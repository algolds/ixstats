// src/lib/policy-taxonomy.ts
/**
 * Hierarchical Policy Taxonomy
 *
 * Comprehensive library of policy templates that map to game economic effects
 * Based on DOCS/QUICK_ACTIONS_SYSTEM.md specifications
 */

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  policyType: 'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance';
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  keywords: string[];
  tags: string[];

  // Economic effects (percentage changes)
  gdpEffect?: number;
  employmentEffect?: number; // Negative = unemployment reduction (improvement)
  inflationEffect?: number;
  taxRevenueEffect?: number;

  // Cost estimates (in currency units)
  implementationCost?: number;
  maintenanceCost?: number;
  estimatedBenefit?: string;

  // Target metrics (which country metrics this affects)
  targetMetrics?: string[];

  // Related data mappings
  dataMapping?: {
    model: string;
    field?: string;
    filter?: Record<string, any>;
  };

  // Objectives and requirements
  objectives?: string[];
  requiredMetrics?: Record<string, number>; // Minimum values required
  recommendedFor?: string[]; // Economic conditions when recommended

  children?: PolicyTemplate[];
}

export const policyTaxonomy: PolicyTemplate[] = [
  // ============================================================
  // ECONOMIC POLICIES
  // ============================================================
  {
    id: "economic",
    name: "Economic Policies",
    description: "Fiscal, monetary, taxation, and trade policies",
    policyType: "economic",
    category: "economic",
    priority: "high",
    keywords: ["economic", "fiscal", "monetary", "trade", "taxation"],
    tags: ["economic", "policy"],
    targetMetrics: ["currentTotalGdp", "adjustedGdpGrowth", "taxRevenueGDPPercent"],
    children: [
      {
        id: "economic-fiscal-stimulus",
        name: "Economic Stimulus Package",
        description: "Government spending increase to boost economic activity during recession",
        policyType: "economic",
        category: "fiscal",
        priority: "high",
        keywords: ["stimulus", "recession", "spending", "recovery"],
        tags: ["economic", "stimulus", "fiscal"],
        gdpEffect: 2.5,
        employmentEffect: -3.0, // Reduces unemployment
        inflationEffect: 0.5,
        taxRevenueEffect: 1.0,
        implementationCost: 50000000,
        maintenanceCost: 5000000,
        estimatedBenefit: "Boost GDP by 2.5%, reduce unemployment by 3%, stimulate economic recovery",
        targetMetrics: ["currentTotalGdp", "unemploymentRate", "adjustedGdpGrowth"],
        objectives: [
          "Increase GDP growth",
          "Reduce unemployment",
          "Stimulate consumer spending",
          "Support businesses"
        ],
        recommendedFor: ["recession", "high-unemployment", "low-growth"]
      },
      {
        id: "economic-austerity",
        name: "Austerity Measures",
        description: "Reduce government spending and increase taxes to control debt",
        policyType: "economic",
        category: "fiscal",
        priority: "medium",
        keywords: ["austerity", "debt", "deficit", "spending cuts"],
        tags: ["economic", "austerity", "fiscal"],
        gdpEffect: -1.5,
        employmentEffect: 2.0, // Increases unemployment (negative)
        inflationEffect: -0.5,
        taxRevenueEffect: -1.5,
        implementationCost: 0,
        maintenanceCost: 0,
        estimatedBenefit: "Reduce deficit by 5%, control debt growth, improve credit rating",
        targetMetrics: ["budgetDeficitSurplus", "totalDebtGDPRatio"],
        objectives: [
          "Reduce budget deficit",
          "Control debt-to-GDP ratio",
          "Improve fiscal sustainability"
        ],
        recommendedFor: ["high-debt", "budget-deficit", "credit-rating-concerns"]
      },
      {
        id: "economic-tax",
        name: "Tax Policies",
        description: "Taxation reforms affecting income, corporate, and indirect taxes",
        policyType: "economic",
        category: "taxation",
        priority: "high",
        keywords: ["tax", "taxation", "revenue", "fiscal"],
        tags: ["economic", "taxation"],
        targetMetrics: ["taxRevenueGDPPercent", "taxRevenuePerCapita"],
        children: [
          {
            id: "economic-tax-cut-income",
            name: "Income Tax Cut",
            description: "Reduce personal income tax rates to increase disposable income",
            policyType: "economic",
            category: "taxation",
            priority: "medium",
            keywords: ["tax cut", "income tax", "personal tax"],
            tags: ["economic", "taxation", "tax cut"],
            gdpEffect: 1.0,
            employmentEffect: -0.5,
            inflationEffect: 0.3,
            taxRevenueEffect: -3.0,
            implementationCost: 0,
            maintenanceCost: 0,
            estimatedBenefit: "Increase consumer spending, boost economic growth",
            targetMetrics: ["taxRevenueGDPPercent", "currentTotalGdp"],
            dataMapping: {
              model: "RevenueSource",
              filter: { name: "Income Tax" }
            }
          },
          {
            id: "economic-tax-increase-corporate",
            name: "Corporate Tax Increase",
            description: "Raise corporate tax rates to increase government revenue",
            policyType: "economic",
            category: "taxation",
            priority: "medium",
            keywords: ["corporate tax", "business tax", "revenue"],
            tags: ["economic", "taxation", "corporate"],
            gdpEffect: -0.5,
            employmentEffect: 0.3,
            inflationEffect: 0.1,
            taxRevenueEffect: 4.0,
            implementationCost: 0,
            maintenanceCost: 0,
            estimatedBenefit: "Increase tax revenue by 4%, fund social programs",
            targetMetrics: ["taxRevenueGDPPercent"],
            dataMapping: {
              model: "RevenueSource",
              filter: { name: "Corporate Tax" }
            }
          },
          {
            id: "economic-tax-vat-increase",
            name: "VAT/Sales Tax Increase",
            description: "Raise consumption taxes to broaden tax base",
            policyType: "economic",
            category: "taxation",
            priority: "low",
            keywords: ["vat", "sales tax", "consumption tax"],
            tags: ["economic", "taxation", "vat"],
            gdpEffect: -0.3,
            employmentEffect: 0.1,
            inflationEffect: 0.8,
            taxRevenueEffect: 3.5,
            implementationCost: 0,
            maintenanceCost: 0,
            estimatedBenefit: "Increase tax revenue, reduce reliance on income taxes",
            targetMetrics: ["taxRevenueGDPPercent", "inflationRate"],
            dataMapping: {
              model: "RevenueSource",
              filter: { category: "Indirect Tax" }
            }
          },
          {
            id: "economic-tax-progressive",
            name: "Progressive Tax Reform",
            description: "Implement more progressive tax brackets favoring lower incomes",
            policyType: "economic",
            category: "taxation",
            priority: "medium",
            keywords: ["progressive", "tax reform", "inequality"],
            tags: ["economic", "taxation", "reform"],
            gdpEffect: 0.3,
            employmentEffect: -0.2,
            inflationEffect: 0.1,
            taxRevenueEffect: 1.5,
            implementationCost: 5000000,
            maintenanceCost: 500000,
            estimatedBenefit: "Reduce income inequality, increase consumer spending",
            targetMetrics: ["incomeInequalityGini", "taxRevenueGDPPercent"]
          }
        ]
      },
      {
        id: "economic-monetary",
        name: "Monetary Policies",
        description: "Interest rate and money supply management",
        policyType: "economic",
        category: "monetary",
        priority: "high",
        keywords: ["monetary", "interest", "inflation", "central bank"],
        tags: ["economic", "monetary"],
        targetMetrics: ["inflationRate", "interestRates"],
        children: [
          {
            id: "economic-monetary-rate-cut",
            name: "Interest Rate Cut",
            description: "Lower interest rates to stimulate borrowing and investment",
            policyType: "economic",
            category: "monetary",
            priority: "high",
            keywords: ["interest rate", "monetary policy", "stimulus"],
            tags: ["economic", "monetary", "stimulus"],
            gdpEffect: 1.8,
            employmentEffect: -1.5,
            inflationEffect: 0.6,
            taxRevenueEffect: 0.8,
            implementationCost: 0,
            maintenanceCost: 0,
            estimatedBenefit: "Boost investment, increase GDP growth, lower unemployment",
            targetMetrics: ["currentTotalGdp", "interestRates"],
            recommendedFor: ["low-growth", "recession"]
          },
          {
            id: "economic-monetary-rate-hike",
            name: "Interest Rate Increase",
            description: "Raise interest rates to control inflation",
            policyType: "economic",
            category: "monetary",
            priority: "high",
            keywords: ["interest rate", "inflation control", "monetary tightening"],
            tags: ["economic", "monetary", "inflation"],
            gdpEffect: -0.8,
            employmentEffect: 1.0,
            inflationEffect: -1.5,
            taxRevenueEffect: -0.3,
            implementationCost: 0,
            maintenanceCost: 0,
            estimatedBenefit: "Control inflation, stabilize currency",
            targetMetrics: ["inflationRate", "interestRates"],
            recommendedFor: ["high-inflation", "overheating"]
          }
        ]
      },
      {
        id: "economic-trade",
        name: "Trade Policies",
        description: "International trade agreements, tariffs, and export promotion",
        policyType: "economic",
        category: "trade",
        priority: "medium",
        keywords: ["trade", "exports", "imports", "tariffs"],
        tags: ["economic", "trade"],
        targetMetrics: ["exportsGDPPercent", "importsGDPPercent"],
        children: [
          {
            id: "economic-trade-liberalization",
            name: "Trade Liberalization",
            description: "Reduce tariffs and trade barriers to boost international trade",
            policyType: "economic",
            category: "trade",
            priority: "medium",
            keywords: ["free trade", "liberalization", "tariffs"],
            tags: ["economic", "trade", "liberalization"],
            gdpEffect: 2.0,
            employmentEffect: -1.0,
            inflationEffect: -0.3,
            taxRevenueEffect: -0.5,
            implementationCost: 2000000,
            maintenanceCost: 200000,
            estimatedBenefit: "Increase exports, lower consumer prices, boost competitiveness",
            targetMetrics: ["exportsGDPPercent", "currentTotalGdp"]
          },
          {
            id: "economic-trade-protectionism",
            name: "Protectionist Tariffs",
            description: "Increase tariffs to protect domestic industries",
            policyType: "economic",
            category: "trade",
            priority: "low",
            keywords: ["protectionism", "tariffs", "domestic industry"],
            tags: ["economic", "trade", "protectionism"],
            gdpEffect: -0.5,
            employmentEffect: -0.3,
            inflationEffect: 0.8,
            taxRevenueEffect: 1.5,
            implementationCost: 1000000,
            maintenanceCost: 100000,
            estimatedBenefit: "Protect domestic jobs, increase tariff revenue",
            targetMetrics: ["importsGDPPercent", "taxRevenueGDPPercent"]
          },
          {
            id: "economic-trade-export-promotion",
            name: "Export Promotion Program",
            description: "Subsidies and support for exporters",
            policyType: "economic",
            category: "trade",
            priority: "medium",
            keywords: ["exports", "promotion", "subsidies"],
            tags: ["economic", "trade", "exports"],
            gdpEffect: 1.5,
            employmentEffect: -0.8,
            inflationEffect: 0.2,
            taxRevenueEffect: -1.0,
            implementationCost: 15000000,
            maintenanceCost: 2000000,
            estimatedBenefit: "Increase exports by 15%, create export jobs",
            targetMetrics: ["exportsGDPPercent"]
          }
        ]
      },
      {
        id: "economic-labor",
        name: "Labor & Employment Policies",
        description: "Minimum wage, unemployment benefits, worker protections",
        policyType: "economic",
        category: "labor",
        priority: "high",
        keywords: ["labor", "employment", "wages", "workers"],
        tags: ["economic", "labor"],
        targetMetrics: ["unemploymentRate", "minimumWage", "laborForceParticipationRate"],
        children: [
          {
            id: "economic-labor-minimum-wage-increase",
            name: "Minimum Wage Increase",
            description: "Raise minimum wage to improve living standards",
            policyType: "economic",
            category: "labor",
            priority: "high",
            keywords: ["minimum wage", "wages", "living standards"],
            tags: ["economic", "labor", "wages"],
            gdpEffect: 0.5,
            employmentEffect: 0.5, // May increase unemployment slightly
            inflationEffect: 0.4,
            taxRevenueEffect: 0.8,
            implementationCost: 0,
            maintenanceCost: 0,
            estimatedBenefit: "Reduce poverty, increase consumer spending",
            targetMetrics: ["minimumWage", "povertyRate", "averageAnnualIncome"]
          },
          {
            id: "economic-labor-unemployment-extension",
            name: "Unemployment Benefits Extension",
            description: "Extend unemployment insurance coverage and duration",
            policyType: "economic",
            category: "labor",
            priority: "high",
            keywords: ["unemployment", "benefits", "insurance", "social safety net"],
            tags: ["economic", "labor", "unemployment"],
            gdpEffect: 0.3,
            employmentEffect: 0.2,
            inflationEffect: 0.1,
            taxRevenueEffect: -2.0,
            implementationCost: 30000000,
            maintenanceCost: 5000000,
            estimatedBenefit: "Support unemployed workers, maintain consumer demand",
            targetMetrics: ["unemploymentRate", "povertyRate"],
            recommendedFor: ["recession", "high-unemployment"]
          },
          {
            id: "economic-labor-training",
            name: "Job Training & Reskilling Program",
            description: "Fund vocational training and skills development",
            policyType: "economic",
            category: "labor",
            priority: "medium",
            keywords: ["training", "skills", "education", "workforce"],
            tags: ["economic", "labor", "training"],
            gdpEffect: 1.0,
            employmentEffect: -2.0,
            inflationEffect: 0.0,
            taxRevenueEffect: 0.5,
            implementationCost: 20000000,
            maintenanceCost: 3000000,
            estimatedBenefit: "Reduce unemployment, increase productivity",
            targetMetrics: ["unemploymentRate", "laborForceParticipationRate"]
          }
        ]
      }
    ]
  },

  // ============================================================
  // SOCIAL POLICIES
  // ============================================================
  {
    id: "social",
    name: "Social Policies",
    description: "Healthcare, education, welfare, and social programs",
    policyType: "social",
    category: "social",
    priority: "high",
    keywords: ["social", "healthcare", "education", "welfare"],
    tags: ["social", "policy"],
    targetMetrics: ["lifeExpectancy", "literacyRate", "povertyRate"],
    children: [
      {
        id: "social-healthcare-universal",
        name: "Universal Healthcare Implementation",
        description: "Establish comprehensive public healthcare system",
        policyType: "social",
        category: "healthcare",
        priority: "high",
        keywords: ["healthcare", "universal", "public health"],
        tags: ["social", "healthcare"],
        gdpEffect: -0.5,
        employmentEffect: -1.5,
        inflationEffect: 0.2,
        taxRevenueEffect: -5.0,
        implementationCost: 200000000,
        maintenanceCost: 50000000,
        estimatedBenefit: "Improve life expectancy by 3 years, reduce medical bankruptcies",
        targetMetrics: ["lifeExpectancy", "povertyRate"],
        objectives: [
          "Provide healthcare access for all citizens",
          "Reduce medical costs",
          "Improve public health outcomes"
        ],
        dataMapping: {
          model: "GovernmentDepartment",
          filter: { category: "Health" }
        }
      },
      {
        id: "social-education-expansion",
        name: "Education System Expansion",
        description: "Increase funding for schools and universities",
        policyType: "social",
        category: "education",
        priority: "high",
        keywords: ["education", "schools", "universities", "literacy"],
        tags: ["social", "education"],
        gdpEffect: 0.8,
        employmentEffect: -0.5,
        inflationEffect: 0.1,
        taxRevenueEffect: -3.0,
        implementationCost: 100000000,
        maintenanceCost: 20000000,
        estimatedBenefit: "Increase literacy rate, improve workforce quality",
        targetMetrics: ["literacyRate"],
        objectives: [
          "Improve literacy rates",
          "Enhance workforce skills",
          "Increase educational attainment"
        ],
        dataMapping: {
          model: "GovernmentDepartment",
          filter: { category: "Education" }
        }
      },
      {
        id: "social-welfare-expansion",
        name: "Social Welfare Expansion",
        description: "Expand social safety net and poverty reduction programs",
        policyType: "social",
        category: "welfare",
        priority: "medium",
        keywords: ["welfare", "poverty", "social assistance"],
        tags: ["social", "welfare"],
        gdpEffect: 0.3,
        employmentEffect: 0.2,
        inflationEffect: 0.2,
        taxRevenueEffect: -2.5,
        implementationCost: 50000000,
        maintenanceCost: 10000000,
        estimatedBenefit: "Reduce poverty rate by 5%, improve social stability",
        targetMetrics: ["povertyRate", "incomeInequalityGini"],
        objectives: [
          "Reduce poverty",
          "Provide basic income security",
          "Improve social cohesion"
        ]
      },
      {
        id: "social-pension-reform",
        name: "Pension System Reform",
        description: "Modernize pension system and increase coverage",
        policyType: "social",
        category: "pension",
        priority: "medium",
        keywords: ["pension", "retirement", "elderly", "social security"],
        tags: ["social", "pension"],
        gdpEffect: -0.3,
        employmentEffect: 0.0,
        inflationEffect: 0.1,
        taxRevenueEffect: -2.0,
        implementationCost: 75000000,
        maintenanceCost: 15000000,
        estimatedBenefit: "Ensure retirement security, reduce elderly poverty",
        targetMetrics: ["povertyRate"],
        objectives: [
          "Ensure retirement security",
          "Increase pension coverage",
          "Reduce elderly poverty"
        ]
      }
    ]
  },

  // ============================================================
  // INFRASTRUCTURE POLICIES
  // ============================================================
  {
    id: "infrastructure",
    name: "Infrastructure Policies",
    description: "Transportation, utilities, housing, and digital infrastructure",
    policyType: "infrastructure",
    category: "infrastructure",
    priority: "high",
    keywords: ["infrastructure", "transportation", "construction"],
    tags: ["infrastructure", "policy"],
    children: [
      {
        id: "infrastructure-transport-investment",
        name: "Transportation Infrastructure Investment",
        description: "Major investment in roads, railways, and public transit",
        policyType: "infrastructure",
        category: "transportation",
        priority: "high",
        keywords: ["transportation", "infrastructure", "roads", "railways"],
        tags: ["infrastructure", "transportation"],
        gdpEffect: 2.0,
        employmentEffect: -2.5,
        inflationEffect: 0.4,
        taxRevenueEffect: -3.0,
        implementationCost: 150000000,
        maintenanceCost: 10000000,
        estimatedBenefit: "Improve connectivity, reduce transport costs, create construction jobs",
        targetMetrics: ["currentTotalGdp", "unemploymentRate"],
        objectives: [
          "Improve transportation networks",
          "Reduce transport costs",
          "Create infrastructure jobs"
        ]
      },
      {
        id: "infrastructure-digital",
        name: "Digital Infrastructure Expansion",
        description: "Expand broadband and telecommunications infrastructure",
        policyType: "infrastructure",
        category: "digital",
        priority: "high",
        keywords: ["digital", "broadband", "internet", "telecommunications"],
        tags: ["infrastructure", "digital"],
        gdpEffect: 1.5,
        employmentEffect: -1.0,
        inflationEffect: 0.2,
        taxRevenueEffect: -1.5,
        implementationCost: 80000000,
        maintenanceCost: 8000000,
        estimatedBenefit: "Increase digital connectivity, enable remote work, boost tech sector",
        targetMetrics: ["currentTotalGdp"],
        objectives: [
          "Expand broadband coverage",
          "Improve digital connectivity",
          "Support tech industry growth"
        ]
      },
      {
        id: "infrastructure-renewable",
        name: "Renewable Energy Investment",
        description: "Invest in solar, wind, and clean energy infrastructure",
        policyType: "infrastructure",
        category: "energy",
        priority: "high",
        keywords: ["renewable", "energy", "clean", "green"],
        tags: ["infrastructure", "energy", "environmental"],
        gdpEffect: 1.2,
        employmentEffect: -1.8,
        inflationEffect: 0.1,
        taxRevenueEffect: -2.0,
        implementationCost: 120000000,
        maintenanceCost: 12000000,
        estimatedBenefit: "Reduce carbon emissions, create green jobs, energy independence",
        targetMetrics: ["currentTotalGdp"],
        objectives: [
          "Transition to renewable energy",
          "Reduce carbon emissions",
          "Create green jobs"
        ]
      },
      {
        id: "infrastructure-housing",
        name: "Affordable Housing Program",
        description: "Build public housing and subsidize affordable housing",
        policyType: "infrastructure",
        category: "housing",
        priority: "medium",
        keywords: ["housing", "affordable", "public housing"],
        tags: ["infrastructure", "housing", "social"],
        gdpEffect: 0.8,
        employmentEffect: -1.2,
        inflationEffect: 0.3,
        taxRevenueEffect: -2.5,
        implementationCost: 90000000,
        maintenanceCost: 8000000,
        estimatedBenefit: "Reduce homelessness, lower housing costs, improve living standards",
        targetMetrics: ["povertyRate"],
        objectives: [
          "Increase affordable housing supply",
          "Reduce homelessness",
          "Lower housing costs"
        ]
      }
    ]
  },

  // ============================================================
  // ENVIRONMENTAL POLICIES
  // ============================================================
  {
    id: "environmental",
    name: "Environmental Policies",
    description: "Climate change mitigation, conservation, pollution control",
    policyType: "governance",
    category: "environmental",
    priority: "high",
    keywords: ["environment", "climate", "pollution", "conservation"],
    tags: ["environmental", "policy"],
    children: [
      {
        id: "environmental-carbon-tax",
        name: "Carbon Tax Implementation",
        description: "Tax carbon emissions to reduce pollution",
        policyType: "governance",
        category: "environmental",
        priority: "high",
        keywords: ["carbon", "tax", "emissions", "climate"],
        tags: ["environmental", "taxation"],
        gdpEffect: -0.3,
        employmentEffect: 0.2,
        inflationEffect: 0.5,
        taxRevenueEffect: 2.5,
        implementationCost: 5000000,
        maintenanceCost: 500000,
        estimatedBenefit: "Reduce carbon emissions by 15%, generate revenue for green initiatives",
        objectives: [
          "Reduce carbon emissions",
          "Incentivize clean energy",
          "Generate environmental revenue"
        ]
      },
      {
        id: "environmental-green-subsidy",
        name: "Green Energy Subsidies",
        description: "Subsidize renewable energy adoption for businesses and households",
        policyType: "governance",
        category: "environmental",
        priority: "medium",
        keywords: ["green", "renewable", "subsidies", "clean energy"],
        tags: ["environmental", "energy"],
        gdpEffect: 0.8,
        employmentEffect: -0.5,
        inflationEffect: 0.1,
        taxRevenueEffect: -1.5,
        implementationCost: 40000000,
        maintenanceCost: 8000000,
        estimatedBenefit: "Accelerate renewable energy adoption, reduce emissions",
        objectives: [
          "Accelerate renewable energy adoption",
          "Support green technology",
          "Reduce fossil fuel dependence"
        ]
      }
    ]
  }
];

// Utility functions
export function flattenPolicyTaxonomy(items: PolicyTemplate[] = policyTaxonomy): PolicyTemplate[] {
  const result: PolicyTemplate[] = [];
  for (const item of items) {
    result.push({ ...item, children: undefined });
    if (item.children) {
      result.push(...flattenPolicyTaxonomy(item.children));
    }
  }
  return result;
}

export function searchPolicyTemplates(query: string, items: PolicyTemplate[] = policyTaxonomy): PolicyTemplate[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  const flatItems = flattenPolicyTaxonomy(items);
  return flatItems.filter(item =>
    item.name.toLowerCase().includes(lowerQuery) ||
    item.description.toLowerCase().includes(lowerQuery) ||
    item.keywords.some(kw => kw.toLowerCase().includes(lowerQuery)) ||
    item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getPolicyTemplateById(id: string, items: PolicyTemplate[] = policyTaxonomy): PolicyTemplate | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = getPolicyTemplateById(id, item.children);
      if (found) return found;
    }
  }
  return null;
}

export function getPolicyTemplatePath(id: string, items: PolicyTemplate[] = policyTaxonomy, path: PolicyTemplate[] = []): PolicyTemplate[] | null {
  for (const item of items) {
    const currentPath = [...path, item];
    if (item.id === id) return currentPath;
    if (item.children) {
      const found = getPolicyTemplatePath(id, item.children, currentPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get policy recommendations based on country metrics
 */
export function getRecommendedPolicies(conditions: string[], items: PolicyTemplate[] = policyTaxonomy): PolicyTemplate[] {
  const flatItems = flattenPolicyTaxonomy(items);
  return flatItems.filter(item =>
    item.recommendedFor && item.recommendedFor.some(rec => conditions.includes(rec))
  );
}
