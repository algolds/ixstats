// src/app/admin/_components/CalculationEditor.tsx
"use client";

import { useState, useEffect } from "react";
import { Calculator, FloppyDisk as Save, Play, WarningTriangle as AlertTriangle, CheckCircle, StatUp as TrendingUp, Dollar as DollarSign, Group as Users, Globe, EditPencil as Edit3, ClockRotateRight as History, Shield, Community as HandshakeIcon, ScaleFrameEnlarge as Scale, SystemRestart as Loader2, Code, Terminal, Search } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { api } from "~/trpc/react";

interface CalculationModule {
  id: string;
  name: string;
  description: string;
  category:
    | "economic"
    | "demographic"
    | "stability"
    | "governance"
    | "synergy"
    | "military"
    | "diplomatic"
    | "tax";
  formula: string;
  variables: Record<string, number | string | string[]>;
  constants: Record<string, number>;
  dependencies: string[];
  testCases: TestCase[];
  lastModified: Date;
  modifiedBy: string;
  isActive: boolean;
  version: string;
}

interface TestCase {
  id: string;
  name: string;
  inputs: Record<string, number | string | string[]>;
  expectedOutput: number;
  actualOutput?: number;
  status: "passed" | "failed" | "pending";
}

interface CalculationResult {
  success: boolean;
  result?: number;
  error?: string;
  executionTime: number;
  intermediateSteps?: Record<string, number>;
}

const CALCULATION_CATEGORIES = {
  economic: { label: "Economic", icon: DollarSign, color: "text-green-500" },
  demographic: { label: "Demographics", icon: Users, color: "text-blue-500" },
  stability: { label: "Stability", icon: Globe, color: "text-purple-500" },
  governance: { label: "Governance", icon: TrendingUp, color: "text-orange-500" },
  synergy: { label: "Synergy", icon: HandshakeIcon, color: "text-indigo-500" },
  military: { label: "Military", icon: Shield, color: "text-red-500" },
  diplomatic: { label: "Diplomatic", icon: Globe, color: "text-cyan-500" },
  tax: { label: "Tax System", icon: Scale, color: "text-amber-500" },
};

// Comprehensive formula definitions from /docs/systems/calculations.md
const SYSTEM_FORMULAS: CalculationModule[] = [
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

export function CalculationEditor() {
  const [selectedModule, setSelectedModule] = useState<CalculationModule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);

  // Sandbox simulation states
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sandboxInputs, setSandboxInputs] = useState<Record<string, number>>({});
  const [sandboxResult, setSandboxResult] = useState<CalculationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Fetch formulas from API
  const { data: formulasData, isLoading } = api.formulas.getAll.useQuery();
  const { data: historyData } = api.formulas.getExecutionHistory.useQuery({ limit: 10 });
  const testFormulaMutation = api.formulas.testFormula.useMutation();
  const updateFormulaMutation = api.formulas.update.useMutation();

  // Combine API formulas with system formulas
  const [modules, setModules] = useState<CalculationModule[]>(SYSTEM_FORMULAS);

  // Update modules when API data loads
  useEffect(() => {
    if (formulasData?.formulas) {
      const apiModules: CalculationModule[] = formulasData.formulas.map((f: any) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        category: (f.category || "economic") as CalculationModule["category"],
        formula: f.formula,
        variables: f.variables as Record<string, number | string | string[]>,
        constants: f.constants as Record<string, number>,
        dependencies: [],
        testCases: [],
        lastModified: f.lastModified,
        modifiedBy: f.modifiedBy,
        isActive: f.isActive,
        version: f.version,
      }));

      // Merge API formulas with system formulas (API formulas take precedence)
      const apiFormulaIds = new Set(apiModules.map((m) => m.id));
      const mergedModules = [
        ...apiModules,
        ...SYSTEM_FORMULAS.filter((m) => !apiFormulaIds.has(m.id)),
      ];

      setModules(mergedModules);
    }
  }, [formulasData]);

  // Update execution history when API data loads
  useEffect(() => {
    if (historyData?.history) {
      setExecutionHistory(
        historyData.history.map((h: any) => ({
          id: h.id,
          action: h.action,
          module: h.formulaName,
          timestamp: h.timestamp,
          user: h.user,
        }))
      );
    }
  }, [historyData]);

  // Initialize sandbox inputs when selectedModule changes
  useEffect(() => {
    if (selectedModule) {
      const inputs: Record<string, number> = {};
      Object.entries(selectedModule.variables).forEach(([key, value]) => {
        inputs[key] = typeof value === "number" ? value : 0;
      });
      setSandboxInputs(inputs);
      setSandboxResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule?.id]);

  const runSandboxSimulation = async () => {
    if (!selectedModule) return;
    setIsSimulating(true);
    try {
      const result = await testFormulaMutation.mutateAsync({
        formulaId: selectedModule.id,
        testInputs: sandboxInputs,
      });

      setSandboxResult({
        success: result.passed ?? true,
        result: result.result,
        executionTime: result.executionTime,
        intermediateSteps: result.intermediateSteps,
      });
    } catch (error) {
      setSandboxResult({
        success: false,
        error: error instanceof Error ? error.message : "Calculation failed",
        executionTime: 0,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const runTestCase = async (moduleId: string, testCase: TestCase) => {
    try {
      // Use API mutation to test formula
      const result = await testFormulaMutation.mutateAsync({
        formulaId: moduleId,
        testInputs: Object.entries(testCase.inputs).reduce(
          (acc, [key, value]) => {
            if (typeof value === "number") {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, number>
        ),
        expectedOutput: testCase.expectedOutput,
      });

      // Update test case status
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                testCases: module.testCases.map((tc) =>
                  tc.id === testCase.id
                    ? {
                        ...tc,
                        status: result.passed ? "passed" : "failed",
                        actualOutput: result.result,
                      }
                    : tc
                ),
              }
            : module
        )
      );
    } catch (_error) {
      // Test execution failed
    }
  };

  const runAllTests = async (moduleId: string) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    for (const testCase of module.testCases) {
      await runTestCase(moduleId, testCase);
    }
  };

  const saveModule = async () => {
    if (!selectedModule) return;

    try {
      await updateFormulaMutation.mutateAsync({
        id: selectedModule.id,
        name: selectedModule.name,
        description: selectedModule.description,
        formula: selectedModule.formula,
        variables: Object.entries(selectedModule.variables).reduce(
          (acc, [key, value]) => {
            if (typeof value === "number") {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, number>
        ),
        isActive: selectedModule.isActive,
      });

      setModules((prev) =>
        prev.map((m) =>
          m.id === selectedModule.id
            ? { ...selectedModule, lastModified: new Date(), modifiedBy: "admin" }
            : m
        )
      );

      setIsEditing(false);

      // Add to execution history
      setExecutionHistory((prev) => [
        {
          id: Date.now().toString(),
          action: "saved",
          module: selectedModule.name,
          timestamp: new Date(),
          user: "admin",
        },
        ...prev.slice(0, 9),
      ]);
    } catch (error) {
      console.error("Failed to save module:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calculation Console IDE</h2>
          <p className="text-muted-foreground">
            Manage, edit, and simulate {modules.length} mathematical core modules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Module List Sidebar */}
        <div className="lg:col-span-1">
          <Card className="facet-surface border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Calculator className="h-4 w-4 text-indigo-500" />
                Calculation Engines
              </CardTitle>
              <div className="relative mt-2">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Filter modules..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="border-border/30 bg-card/10 focus:border-primary/50 focus:ring-primary/20 h-9 pl-10 text-xs focus:ring-1"
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              <div className="space-y-4">
                {Object.entries(CALCULATION_CATEGORIES).map(([key, category]) => {
                  const categoryModules = modules.filter(
                    (m) =>
                      m.category === key &&
                      (m.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                        m.description.toLowerCase().includes(sidebarSearch.toLowerCase()))
                  );
                  if (categoryModules.length === 0) return null;

                  return (
                    <div key={key} className="space-y-1.5">
                      <h4 className="text-muted-foreground flex items-center gap-2 px-1 text-[10px] font-bold tracking-wider uppercase">
                        <category.icon className={`h-3 w-3 ${category.color}`} />
                        {category.label} ({categoryModules.length})
                      </h4>
                      <div className="space-y-1">
                        {categoryModules.map((module) => (
                          <div
                            key={module.id}
                            onClick={() => setSelectedModule(module)}
                            className={`cursor-pointer rounded-lg border p-2.5 transition-all duration-200 ${
                              selectedModule?.id === module.id
                                ? "bg-primary/10 border-primary/40 shadow-sm"
                                : "border-border/10 bg-card/5 hover:bg-card/10 hover:border-border/20"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h5 className="max-w-[140px] truncate text-xs font-semibold">
                                {module.name}
                              </h5>
                              <Badge
                                variant={module.isActive ? "default" : "secondary"}
                                className="bg-card/30 h-4 border-none px-1 py-0 text-[9px]"
                              >
                                v{module.version}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[10px]">
                              {module.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {modules.filter(
                  (m) =>
                    m.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                    m.description.toLowerCase().includes(sidebarSearch.toLowerCase())
                ).length === 0 && (
                  <div className="text-muted-foreground py-8 text-center text-xs">
                    No matching modules found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* IDE Workspace (width: 3/4) */}
        <div className="lg:col-span-3">
          {selectedModule ? (
            <div className="animate-in fade-in grid grid-cols-1 gap-6 duration-200 xl:grid-cols-3">
              {/* Left Column: Code Editor & Formula Spec (width: 2/3) */}
              <div className="space-y-6 xl:col-span-2">
                <Card className="facet-surface border-border/40">
                  <CardHeader className="border-border/10 border-b pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base font-bold">
                            {selectedModule.name}
                          </CardTitle>
                          <Badge
                            variant={selectedModule.isActive ? "default" : "secondary"}
                            className="h-4 text-[10px]"
                          >
                            {selectedModule.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="h-4 text-[10px]">
                            v{selectedModule.version}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {selectedModule.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={saveModule}
                              className="flex h-8 items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsEditing(false);
                                // Reload original module
                                const original = modules.find((m) => m.id === selectedModule.id);
                                if (original) setSelectedModule(original);
                              }}
                              className="border-border/30 h-8"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="border-border/30 bg-card/10 hover:bg-card/25 flex h-8 items-center gap-1.5"
                            variant="outline"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit Formula
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Code Editor view */}
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-bold tracking-wider uppercase">
                        <Label className="flex items-center gap-1 text-[10px]">
                          <Code className="h-3.5 w-3.5 text-indigo-500" />
                          Formula Source Code
                        </Label>
                        <span className="font-mono text-[9px]">
                          javascript / mathematical syntax
                        </span>
                      </div>
                      {isEditing ? (
                        <div className="border-border/40 bg-card/10 focus-within:border-primary/50 focus-within:ring-primary/20 relative overflow-hidden rounded-lg border transition-all focus-within:ring-1">
                          <Textarea
                            id="formula"
                            value={selectedModule.formula}
                            onChange={(e) =>
                              setSelectedModule({
                                ...selectedModule,
                                formula: e.target.value,
                              })
                            }
                            className="text-foreground min-h-[250px] resize-y border-0 bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="Enter formula expression..."
                          />
                        </div>
                      ) : (
                        <div className="border-border/30 bg-card/20 text-foreground relative overflow-hidden rounded-lg border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                          <div className="flex gap-4">
                            <div className="text-muted-foreground/30 border-border/10 flex flex-col border-r pr-2 text-right font-mono text-[10px] select-none">
                              {selectedModule.formula.split("\n").map((_, i) => (
                                <span key={i}>{i + 1}</span>
                              ))}
                            </div>
                            <pre className="text-foreground mt-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">
                              {selectedModule.formula}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata Specs & Dependencies */}
                    <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                          Dependencies
                        </Label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedModule.dependencies.length > 0 ? (
                            selectedModule.dependencies.map((dep) => (
                              <Badge
                                key={dep}
                                variant="outline"
                                className="border-indigo-500/20 bg-indigo-500/5 text-[9px] text-indigo-400"
                              >
                                {dep}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-[10px]">
                              No dependencies
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                          Metadata Specs
                        </Label>
                        <div className="text-muted-foreground mt-1 space-y-0.5 font-mono text-[11px]">
                          <div>Modified: {selectedModule.lastModified.toLocaleString()}</div>
                          <div>User: {selectedModule.modifiedBy}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Edit Mode Variables configuration */}
                {isEditing && (
                  <Card className="facet-surface border-border/40">
                    <CardHeader className="border-border/10 border-b pb-3">
                      <CardTitle className="text-sm font-bold">Edit Default Variables</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Variables */}
                        <div className="space-y-3">
                          <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                            Variables
                          </h4>
                          {Object.entries(selectedModule.variables).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between gap-4">
                              <span className="max-w-[150px] truncate font-mono text-xs">
                                {key}
                              </span>
                              <Input
                                type="number"
                                step="0.0001"
                                value={typeof value === "number" ? value : 0}
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value) || 0;
                                  setSelectedModule({
                                    ...selectedModule,
                                    variables: {
                                      ...selectedModule.variables,
                                      [key]: newValue,
                                    },
                                  });
                                }}
                                className="border-border/30 bg-card/10 h-8 w-28 text-right text-xs"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Constants */}
                        <div className="space-y-3">
                          <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                            Constants (Static)
                          </h4>
                          {Object.entries(selectedModule.constants).map(([key, value]) => (
                            <div
                              key={key}
                              className="border-border/5 flex items-center justify-between gap-4 border-b py-1"
                            >
                              <span className="text-muted-foreground font-mono text-xs">{key}</span>
                              <span className="font-mono text-xs font-semibold">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column: Sandbox & Test Suite (width: 1/3) */}
              <div className="space-y-6 xl:col-span-1">
                {/* Sandbox Simulator */}
                <Card className="facet-surface border-border/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-1.5 text-sm font-bold">
                      <Play className="h-4 w-4 fill-indigo-500/20 text-indigo-500" />
                      Sandbox Simulator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {Object.keys(sandboxInputs).length > 0 ? (
                        Object.entries(sandboxInputs).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground max-w-[150px] truncate font-mono">
                                {key}
                              </span>
                              <span className="font-mono text-[11px] font-semibold">
                                {value.toFixed(4)}
                              </span>
                            </div>
                            <Input
                              type="number"
                              step="0.0001"
                              value={value}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setSandboxInputs((prev) => ({ ...prev, [key]: val }));
                              }}
                              className="border-border/30 bg-card/10 h-8 text-right font-mono text-xs"
                            />
                          </div>
                        ))
                      ) : (
                        <div className="text-muted-foreground py-2 text-center text-xs">
                          No input variables configured.
                        </div>
                      )}

                      {selectedModule.constants &&
                        Object.keys(selectedModule.constants).length > 0 && (
                          <div className="border-border/10 space-y-1 border-t pt-2">
                            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                              Constants
                            </span>
                            <div className="space-y-1 font-mono text-[10px]">
                              {Object.entries(selectedModule.constants).map(
                                ([constKey, constVal]) => (
                                  <div
                                    key={constKey}
                                    className="text-muted-foreground flex justify-between"
                                  >
                                    <span>{constKey}:</span>
                                    <span className="text-foreground">{String(constVal)}</span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>

                    <Button
                      onClick={runSandboxSimulation}
                      disabled={isSimulating}
                      className="h-9 w-full rounded-lg bg-indigo-600 text-xs font-bold text-white transition-all hover:bg-indigo-700"
                    >
                      {isSimulating ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Simulating...
                        </>
                      ) : (
                        <>
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Run Simulation
                        </>
                      )}
                    </Button>

                    {/* Simulation Result Badge */}
                    {sandboxResult && (
                      <div className="border-border/20 bg-card/15 animate-in fade-in space-y-2 rounded-xl border p-3.5 duration-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Output:</span>
                          <span className="text-muted-foreground font-mono text-xs font-semibold">
                            {sandboxResult.executionTime.toFixed(1)}ms
                          </span>
                        </div>
                        {sandboxResult.error ? (
                          <Alert className="border-destructive/30 bg-destructive/10 text-destructive-foreground py-2">
                            <AlertTriangle className="text-destructive h-3.5 w-3.5" />
                            <AlertDescription className="text-[10px] leading-relaxed">
                              {sandboxResult.error}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="text-primary bg-primary/10 border-primary/20 rounded-lg border py-2.5 text-center font-mono text-lg font-bold shadow-sm">
                            {sandboxResult.result?.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 5,
                            })}
                          </div>
                        )}

                        {/* Intermediate steps */}
                        {sandboxResult.intermediateSteps &&
                          Object.keys(sandboxResult.intermediateSteps).length > 0 && (
                            <div className="border-border/10 border-t pt-2">
                              <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                                Execution Steps
                              </span>
                              <div className="mt-1 space-y-1 font-mono text-[10px]">
                                {Object.entries(sandboxResult.intermediateSteps).map(
                                  ([stepKey, stepVal]) => (
                                    <div
                                      key={stepKey}
                                      className="text-muted-foreground flex justify-between"
                                    >
                                      <span>{stepKey}:</span>
                                      <span className="text-foreground">{String(stepVal)}</span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Integrated Unit Tests */}
                <Card className="facet-surface border-border/40">
                  <CardHeader className="border-border/10 flex flex-row items-center justify-between border-b pb-3">
                    <CardTitle className="flex items-center gap-1.5 text-sm font-bold">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Verification Tests
                    </CardTitle>
                    {selectedModule.testCases.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runAllTests(selectedModule.id)}
                        className="hover:bg-card/10 h-7 text-xs font-semibold text-emerald-500 hover:text-emerald-600"
                      >
                        Run All
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-3">
                    {selectedModule.testCases.length > 0 ? (
                      selectedModule.testCases.map((testCase) => (
                        <div
                          key={testCase.id}
                          className="border-border/20 bg-card/5 space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="max-w-[150px] truncate text-xs font-semibold">
                              {testCase.name}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={
                                  testCase.status === "passed"
                                    ? "default"
                                    : testCase.status === "failed"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className="h-4 border-none px-1 py-0 text-[9px]"
                              >
                                {testCase.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => runTestCase(selectedModule.id, testCase)}
                                className="hover:bg-card/10 h-6 w-6 rounded-full p-0"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-muted-foreground border-border/5 grid grid-cols-2 gap-2 border-t pt-1 font-mono text-[10px]">
                            <div>
                              Expected:{" "}
                              <span className="text-foreground">{testCase.expectedOutput}</span>
                            </div>
                            <div>
                              Actual:{" "}
                              <span className="text-foreground">
                                {testCase.actualOutput?.toFixed(4) || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground py-4 text-center text-[10px]">
                        No unit test suites configured.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Home Landing Dashboard */
            <Card className="facet-surface border-border/40 animate-in fade-in duration-200">
              <CardContent className="space-y-6 pt-8 pb-8">
                <div className="mx-auto max-w-md space-y-3 text-center">
                  <div className="inline-block rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-indigo-500">
                    <Calculator className="h-10 w-10" />
                  </div>
                  <h3 className="text-lg font-bold">Calculation Console IDE</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Welcome to the formula administration workspace. Select any module from the
                    sidebar index to review mathematical expressions, configure default input
                    parameters, and run live sandbox simulations.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
                  <div className="bg-card/5 border-border/20 space-y-1 rounded-xl border p-4 text-center">
                    <div className="font-mono text-xl font-bold text-indigo-400">
                      {modules.length}
                    </div>
                    <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Total Engines
                    </div>
                  </div>
                  <div className="bg-card/5 border-border/20 space-y-1 rounded-xl border p-4 text-center">
                    <div className="font-mono text-xl font-bold text-emerald-400">
                      {modules.filter((m) => m.isActive).length}
                    </div>
                    <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Active Formulas
                    </div>
                  </div>
                  <div className="bg-card/5 border-border/20 space-y-1 rounded-xl border p-4 text-center">
                    <div className="font-mono text-xl font-bold text-purple-400">
                      {Object.keys(CALCULATION_CATEGORIES).length}
                    </div>
                    <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Categories
                    </div>
                  </div>
                </div>

                {/* Collapsible history log summary */}
                <div className="border-border/10 space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                      <History className="text-muted-foreground h-4 w-4" />
                      Recent Run Activity Logs
                    </h4>
                  </div>
                  {executionHistory.length > 0 ? (
                    <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                      {executionHistory.slice(0, 5).map((entry) => (
                        <div
                          key={entry.id}
                          className="border-border/10 bg-card/5 flex items-center justify-between rounded-lg border p-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Terminal className="text-muted-foreground h-3.5 w-3.5" />
                            <div>
                              <span className="text-foreground font-semibold">{entry.action}</span>
                              <span className="text-muted-foreground ml-2 text-[10px]">
                                by {entry.user}
                              </span>
                            </div>
                          </div>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-4 text-center text-[10px]">
                      No recent activity logged.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
