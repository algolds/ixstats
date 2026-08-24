// src/app/admin/calculations/system-formulas.ts
import type { CalculationModule } from "./calculation-types";

export const SYSTEM_FORMULAS: CalculationModule[] = [
  // ECONOMIC FORMULAS
  {
    id: "tier-based-growth",
    name: "Tier-Based Growth Engine",
    description: "Core growth system using economic tiers for realistic growth rates",
    category: "economic",
    formula: `adjustedGrowth = baseGrowth * tierMultiplier * localFactor

Tier Multipliers:
- Tier 1 (Emerging): 1.8x
- Tier 2 (Developing): 1.5x
- Tier 3 (Industrializing): 1.2x
- Tier 4 (Advanced): 1.0x
- Tier 5 (Mature): 0.8x`,
    variables: {
      baseGrowth: 3.5,
      tier: 2,
      localFactor: 1.0,
    },
    constants: {
      tier1Multiplier: 1.8,
      tier2Multiplier: 1.5,
      tier3Multiplier: 1.2,
      tier4Multiplier: 1.0,
      tier5Multiplier: 0.8,
    },
    dependencies: ["economic-tiers"],
    testCases: [
      {
        id: "test-tier1",
        name: "Emerging Economy Growth",
        inputs: { baseGrowth: 3.5, tier: 1, localFactor: 1.0 },
        expectedOutput: 6.3,
        status: "pending",
      },
      {
        id: "test-tier5",
        name: "Mature Economy Growth",
        inputs: { baseGrowth: 1.5, tier: 5, localFactor: 1.0 },
        expectedOutput: 1.2,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },
  {
    id: "economic-resilience-index",
    name: "Economic Resilience Index (ERI)",
    description: "Measures country's ability to withstand economic shocks (0-100)",
    category: "stability",
    formula: `ERI = (fiscalStability * 0.3) +
     (monetaryStability * 0.25) +
     (structuralBalance * 0.25) +
     (socialCohesion * 0.2)

Components:
- Fiscal Stability: 100 - (debtToGDP * 0.5) - (deficitGDP * 2)
- Monetary Stability: 100 - (inflation * 10) - (currencyVolatility * 5)
- Structural Balance: 50 + (sectorDiversity * 30) - (exportDependency * 20)
- Social Cohesion: 100 - (giniCoefficient * 150) - (unemploymentRate * 2)`,
    variables: {
      debtToGDP: 60,
      deficitGDP: 3,
      inflation: 2.5,
      currencyVolatility: 3.0,
      sectorDiversity: 0.6,
      exportDependency: 0.45,
      giniCoefficient: 0.35,
      unemploymentRate: 5.5,
    },
    constants: {
      fiscalWeight: 0.3,
      monetaryWeight: 0.25,
      structuralWeight: 0.25,
      socialWeight: 0.2,
    },
    dependencies: ["fiscal-data", "monetary-policy", "labor-market"],
    testCases: [
      {
        id: "test-eri-balanced",
        name: "Balanced Economy ERI",
        inputs: {
          debtToGDP: 60,
          deficitGDP: 3,
          inflation: 2.5,
          currencyVolatility: 3.0,
          sectorDiversity: 0.6,
          exportDependency: 0.45,
          giniCoefficient: 0.35,
          unemploymentRate: 5.5,
        },
        expectedOutput: 56.25,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },
  {
    id: "gdp-projections",
    name: "Multi-Factor GDP Projections",
    description: "Comprehensive GDP projection with policies, synergies, and trade effects",
    category: "economic",
    formula: `projectedGDP = currentGDP *
             (1 + adjustedGrowthRate)^years *
             policyMultiplier *
             (1 + synergyBonus) *
             (1 + tradeMultiplier)

Components:
- Base GDP Growth: currentGDP * (1 + adjustedGrowthRate)^years
- Policy Multipliers: product of all active policy effects
- Synergy Bonus: sum of component synergy bonuses
- Trade Multiplier: baseTradeBonus * (embassyCount / 10) * tradeOpenness`,
    variables: {
      currentGDP: 1500000000000,
      adjustedGrowthRate: 4.2,
      years: 10,
      policyMultiplier: 1.005,
      synergyBonus: 0.003,
      tradeMultiplier: 0.002,
    },
    constants: {
      baseTradeBonus: 0.005,
      embassyScaling: 10,
    },
    dependencies: ["growth-engine", "policies", "synergies", "diplomatic-network"],
    testCases: [
      {
        id: "test-gdp-10year",
        name: "10-Year GDP Projection",
        inputs: {
          currentGDP: 1500000000000,
          adjustedGrowthRate: 5.2,
          years: 10,
        },
        expectedOutput: 2487000000000,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },

  // POPULATION & DEMOGRAPHICS
  {
    id: "population-growth",
    name: "Population Growth Dynamics",
    description: "Population growth with demographic transition and IxTime adjustment",
    category: "demographic",
    formula: `newPopulation = currentPopulation * (1 + (growthRate / 100))^years

IxTime Adjustment:
- IxTime runs at 2x real-world speed
- 1 real year = 2 IxTime years
- Growth calculations use IxTime years`,
    variables: {
      currentPopulation: 50000000,
      growthRate: 1.2,
      years: 10,
    },
    constants: {
      ixTimeMultiplier: 2,
      maxGrowthRate: 5.0,
      minGrowthRate: -2.0,
    },
    dependencies: ["ixtime-system"],
    testCases: [
      {
        id: "test-pop-10year",
        name: "10-Year Population Growth",
        inputs: { currentPopulation: 50000000, growthRate: 1.2, years: 10 },
        expectedOutput: 56340000,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },

  // VITALITY SCORES
  {
    id: "economic-vitality",
    name: "Economic Vitality Score",
    description: "Comprehensive economic health measurement (0-100)",
    category: "stability",
    formula: `economicVitality = (GDPGrowth * 15) +
                    (employmentRate * 0.3) +
                    (fiscalHealth * 0.25) +
                    (tradeBalance * 0.1)

normalized = clamp(economicVitality, 0, 100)`,
    variables: {
      gdpGrowth: 4.2,
      employmentRate: 95,
      fiscalHealth: 75,
      tradeBalance: 5000000000,
    },
    constants: {
      growthWeight: 15,
      employmentWeight: 0.3,
      fiscalWeight: 0.25,
      tradeWeight: 0.1,
    },
    dependencies: ["economic-data", "labor-market"],
    testCases: [
      {
        id: "test-vitality-strong",
        name: "Strong Economy Vitality",
        inputs: { gdpGrowth: 5.0, employmentRate: 96, fiscalHealth: 80, tradeBalance: 8000000000 },
        expectedOutput: 85,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },

  // SYNERGY CALCULATIONS
  {
    id: "embassy-synergy",
    name: "Embassy Synergy Calculator",
    description: "Calculates synergy bonuses from shared atomic government components",
    category: "synergy",
    formula: `Step 1: Component Matching
matchScore = (sharedComponents / totalComponents) * 100

Step 2: Effectiveness Calculation
effectivenessAverage = (componentA.effectiveness + componentB.effectiveness) / 2

Step 3: Benefit Calculation
economicBonus = 2.0% * (matchScore / 100) * effectivenessAverage
diplomaticBonus = 3.0% * (matchScore / 100) * effectivenessAverage
culturalBonus = 1.5% * (matchScore / 100) * effectivenessAverage`,
    variables: {
      sharedComponents: 2,
      totalComponents: 5,
      componentAEffectiveness: 85,
      componentBEffectiveness: 92,
    },
    constants: {
      economicBonusBase: 2.0,
      diplomaticBonusBase: 3.0,
      culturalBonusBase: 1.5,
    },
    dependencies: ["atomic-government", "diplomatic-network"],
    testCases: [
      {
        id: "test-synergy-40pct",
        name: "40% Match Synergy",
        inputs: {
          sharedComponents: 2,
          totalComponents: 5,
          componentAEffectiveness: 85,
          componentBEffectiveness: 92,
        },
        expectedOutput: 0.7,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },
  {
    id: "atomic-government-synergy",
    name: "Atomic Government Component Synergy",
    description: "Calculates synergy bonuses from atomic government component combinations",
    category: "synergy",
    formula: `totalSynergy = 0

For each component pair:
  if synergyPairs[pairKey] exists:
    totalSynergy += (synergyPair - 1.0)

// Diminishing returns for many components
componentCount = components.length
scalingFactor = min(1.0, 5.0 / componentCount)

finalMultiplier = 1.0 + (totalSynergy * scalingFactor)`,
    variables: {
      components: ["PROFESSIONAL_BUREAUCRACY", "RULE_OF_LAW", "DEMOCRATIC_PROCESS"] as string[],
    },
    constants: {
      maxSynergy: 2.0,
      scalingThreshold: 5,
      baseMultiplier: 1.0,
    },
    dependencies: ["atomic-government"],
    testCases: [
      {
        id: "test-gov-synergy",
        name: "Democratic Rule of Law Synergy",
        inputs: {
          components: [
            "PROFESSIONAL_BUREAUCRACY",
            "RULE_OF_LAW",
            "DEMOCRATIC_PROCESS",
            "INDEPENDENT_JUDICIARY",
          ] as string[],
        },
        expectedOutput: 1.65,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },

  // TAX SYSTEM
  {
    id: "progressive-income-tax",
    name: "Progressive Income Tax Calculation",
    description: "Multi-bracket progressive income tax with effective rate calculation",
    category: "tax",
    formula: `For each tax bracket [threshold, rate]:
  If income > threshold:
    taxableIncome = income - threshold
    tax += min(taxableIncome, nextThreshold - threshold) * rate

effectiveRate = totalTax / income`,
    variables: {
      income: 200000,
      bracket1Threshold: 0,
      bracket1Rate: 0.1,
      bracket2Threshold: 50000,
      bracket2Rate: 0.2,
      bracket3Threshold: 150000,
      bracket3Rate: 0.3,
    },
    constants: {
      maxBrackets: 10,
    },
    dependencies: ["tax-system"],
    testCases: [
      {
        id: "test-tax-200k",
        name: "$200k Income Tax",
        inputs: { income: 200000 },
        expectedOutput: 40000,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },
  {
    id: "total-tax-revenue",
    name: "Total Tax Revenue Calculation",
    description: "Comprehensive tax revenue from all sources",
    category: "tax",
    formula: `totalRevenue = incomeTax + corporateTax + salesTax +
             propertyTax + exciseTaxes + tariffs

taxToGDPRatio = (totalRevenue / GDP) * 100

Corporate Tax:
corporateTax = corporateProfits * corporateRate
adjustedTax = corporateTax * (1 - exemptionRate) * (1 + complianceRate)

Sales Tax (VAT):
salesTax = (consumption * salesTaxRate) * collectionEfficiency`,
    variables: {
      incomeTax: 150000000000,
      corporateTax: 80000000000,
      salesTax: 60000000000,
      propertyTax: 40000000000,
      exciseTaxes: 20000000000,
      tariffs: 15000000000,
      gdp: 1500000000000,
    },
    constants: {
      optimalTaxToGDP: 25,
      minTaxToGDP: 15,
      maxTaxToGDP: 45,
    },
    dependencies: ["tax-system", "economic-data"],
    testCases: [
      {
        id: "test-total-revenue",
        name: "Total Tax Revenue",
        inputs: {
          incomeTax: 150000000000,
          corporateTax: 80000000000,
          salesTax: 60000000000,
          gdp: 1500000000000,
        },
        expectedOutput: 24.33,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },

  // MILITARY CALCULATIONS
  {
    id: "military-strength",
    name: "Military Strength Calculation",
    description: "Effective military power with technology, training, and logistics factors",
    category: "military",
    formula: `// Base strength from personnel and equipment
baseStrength = sqrt(personnel * equipment)

// Technology multiplier (1.0 to 3.0)
techMultiplier = 1.0 + (technology / 50)

// Training effectiveness (0.5 to 1.5)
trainingFactor = 0.5 + (training / 100)

// Logistics efficiency
logisticsFactor = pow(logistics / 100, 0.8)

// Budget sustainability
budgetAdequacy = min(budget / (personnel * 50000), 1.5)

// Combined military power
strength = baseStrength * techMultiplier * trainingFactor * logisticsFactor * budgetAdequacy`,
    variables: {
      personnel: 500000,
      equipment: 15000,
      technology: 75,
      training: 85,
      logistics: 70,
      budget: 50000000000,
    },
    constants: {
      basePersonnelCost: 50000,
      techScalingFactor: 50,
      logisticsPower: 0.8,
    },
    dependencies: ["military-units", "defense-budget"],
    testCases: [
      {
        id: "test-military-modern",
        name: "Modern Professional Military",
        inputs: {
          personnel: 400000,
          equipment: 12000,
          technology: 85,
          training: 90,
          logistics: 80,
          budget: 60000000000,
        },
        expectedOutput: 3500000,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },

  // DIPLOMATIC CALCULATIONS
  {
    id: "diplomatic-standing",
    name: "Diplomatic Standing Score",
    description: "Overall diplomatic influence and international standing (0-100)",
    category: "diplomatic",
    formula: `diplomaticStanding = (allianceCount * 5) +
                     (positiveRelationships * 2) +
                     (diplomaticReputation * 0.5) +
                     (internationalTreaties * 3)

normalized = clamp(diplomaticStanding, 0, 100)`,
    variables: {
      allianceCount: 8,
      positiveRelationships: 25,
      diplomaticReputation: 75,
      internationalTreaties: 12,
    },
    constants: {
      allianceWeight: 5,
      relationshipWeight: 2,
      reputationWeight: 0.5,
      treatyWeight: 3,
    },
    dependencies: ["diplomatic-network", "international-relations"],
    testCases: [
      {
        id: "test-diplo-strong",
        name: "Strong Diplomatic Position",
        inputs: {
          allianceCount: 10,
          positiveRelationships: 30,
          diplomaticReputation: 85,
          internationalTreaties: 15,
        },
        expectedOutput: 95,
        status: "pending",
      },
    ],
    lastModified: new Date(),
    modifiedBy: "system",
    isActive: true,
    version: "1.0.0",
  },
];
