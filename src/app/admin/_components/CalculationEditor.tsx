// src/app/admin/_components/CalculationEditor.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Calculator,
  Code,
  Save,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Users,
  Globe,
  Edit3,
  Eye,
  History,
  Shield,
  HandshakeIcon,
  Scale,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { api } from "~/trpc/react";

interface CalculationModule {
  id: string;
  name: string;
  description: string;
  category: "economic" | "demographic" | "stability" | "governance" | "synergy" | "military" | "diplomatic" | "tax";
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
  const [testResults, setTestResults] = useState<Record<string, CalculationResult>>({});
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);

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

  const runTestCase = async (moduleId: string, testCase: TestCase) => {
    const startTime = performance.now();

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

      const calculationResult: CalculationResult = {
        success: result.passed ?? true,
        result: result.result,
        executionTime: result.executionTime,
        intermediateSteps: result.intermediateSteps,
      };

      setTestResults((prev) => ({
        ...prev,
        [testCase.id]: calculationResult,
      }));

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
    } catch (error) {
      const result: CalculationResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: performance.now() - startTime,
      };

      setTestResults((prev) => ({
        ...prev,
        [testCase.id]: result,
      }));
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calculation Editor</h2>
          <p className="text-muted-foreground">
            View and test {modules.length} system calculation formulas
          </p>
        </div>
        <div className="flex gap-2">
          {selectedModule && (
            <>
              <Button
                variant="outline"
                onClick={() => runAllTests(selectedModule.id)}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Run All Tests
              </Button>
              <Button onClick={() => setIsEditing(!isEditing)} className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                {isEditing ? "Cancel" : "Edit"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Module List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Calculation Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(CALCULATION_CATEGORIES).map(([key, category]) => {
                  const categoryModules = modules.filter((m) => m.category === key);
                  if (categoryModules.length === 0) return null;

                  return (
                    <div key={key}>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <category.icon className={`h-4 w-4 ${category.color}`} />
                        {category.label} ({categoryModules.length})
                      </h4>
                      {categoryModules.map((module) => (
                        <div
                          key={module.id}
                          onClick={() => setSelectedModule(module)}
                          className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                            selectedModule?.id === module.id
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium">{module.name}</h5>
                            <Badge
                              variant={module.isActive ? "default" : "secondary"}
                              className="text-xs"
                            >
                              v{module.version}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                            {module.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {module.testCases.length > 0 && (
                              <div className="flex items-center gap-1">
                                {module.testCases.some((tc) => tc.status === "passed") && (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                )}
                                {module.testCases.some((tc) => tc.status === "failed") && (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                )}
                                <span className="text-muted-foreground text-xs">
                                  {module.testCases.filter((tc) => tc.status === "passed").length}/
                                  {module.testCases.length} tests
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Module Details */}
        <div className="lg:col-span-3">
          {selectedModule ? (
            <Tabs defaultValue="formula" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="formula">Formula</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
                <TabsTrigger value="tests">Tests</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="formula" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedModule.name}</CardTitle>
                        <p className="text-muted-foreground text-sm">
                          {selectedModule.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedModule.isActive ? "default" : "secondary"}>
                          {selectedModule.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">v{selectedModule.version}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="formula">Formula Code</Label>
                          <Textarea
                            id="formula"
                            value={selectedModule.formula}
                            onChange={(e) =>
                              setSelectedModule({
                                ...selectedModule,
                                formula: e.target.value,
                              })
                            }
                            className="min-h-[300px] font-mono text-sm"
                            placeholder="Enter formula..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveModule} className="flex items-center gap-2">
                            <Save className="h-4 w-4" />
                            Save Changes
                          </Button>
                          <Button variant="outline" onClick={() => setIsEditing(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label>Formula</Label>
                        <pre className="bg-muted overflow-x-auto rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                          {selectedModule.formula}
                        </pre>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                      <div>
                        <Label>Dependencies</Label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedModule.dependencies.map((dep) => (
                            <Badge key={dep} variant="outline" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Last Modified</Label>
                        <p className="text-muted-foreground">
                          {selectedModule.lastModified.toLocaleString()} by{" "}
                          {selectedModule.modifiedBy}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variables" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Variables</CardTitle>
                      <p className="text-muted-foreground text-sm">
                        Input variables that can be modified
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(selectedModule.variables).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <Label className="font-mono text-sm">{key}</Label>
                            {isEditing ? (
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
                                className="w-32 text-right"
                              />
                            ) : (
                              <span className="font-medium">{String(value)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Constants</CardTitle>
                      <p className="text-muted-foreground text-sm">
                        Fixed values used in calculations
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(selectedModule.constants).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <Label className="font-mono text-sm">{key}</Label>
                            <span className="text-muted-foreground font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="tests" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Test Cases</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      Validate formula behavior with different inputs
                    </p>
                  </CardHeader>
                  <CardContent>
                    {selectedModule.testCases.length > 0 ? (
                      <div className="space-y-4">
                        {selectedModule.testCases.map((testCase) => (
                          <div key={testCase.id} className="rounded-lg border p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-medium">{testCase.name}</h4>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    testCase.status === "passed"
                                      ? "default"
                                      : testCase.status === "failed"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {testCase.status}
                                </Badge>
                                <Button
                                  size="sm"
                                  onClick={() => runTestCase(selectedModule.id, testCase)}
                                  className="flex items-center gap-1"
                                >
                                  <Play className="h-3 w-3" />
                                  Run
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                              <div>
                                <Label>Inputs</Label>
                                <div className="mt-1 space-y-1">
                                  {Object.entries(testCase.inputs).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="font-mono">{key}:</span>
                                      <span>{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <Label>Expected Output</Label>
                                <p className="mt-1 font-mono">{testCase.expectedOutput}</p>
                              </div>
                              <div>
                                <Label>Actual Output</Label>
                                <p className="mt-1 font-mono">
                                  {testCase.actualOutput?.toFixed(4) || "Not run"}
                                </p>
                              </div>
                            </div>

                            {testResults[testCase.id] && (
                              <div className="bg-muted mt-4 rounded p-3">
                                <div className="flex items-center justify-between text-sm">
                                  <span>
                                    Execution time:{" "}
                                    {testResults[testCase.id].executionTime.toFixed(2)}ms
                                  </span>
                                  {testResults[testCase.id].success ? (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-4 w-4" />
                                      Passed
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-red-600">
                                      <AlertTriangle className="h-4 w-4" />
                                      Failed
                                    </span>
                                  )}
                                </div>
                                {testResults[testCase.id].error && (
                                  <Alert className="mt-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                      {testResults[testCase.id].error}
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-8 text-center">
                        No test cases available for this formula
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Execution History</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      Recent changes and test executions
                    </p>
                  </CardHeader>
                  <CardContent>
                    {executionHistory.length > 0 ? (
                      <div className="space-y-3">
                        {executionHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between border-b py-2"
                          >
                            <div className="flex items-center gap-3">
                              <History className="text-muted-foreground h-4 w-4" />
                              <div>
                                <p className="text-sm font-medium">
                                  {entry.action} - {entry.module}
                                </p>
                                <p className="text-muted-foreground text-xs">by {entry.user}</p>
                              </div>
                            </div>
                            <span className="text-muted-foreground text-xs">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-8 text-center">
                        No execution history available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Calculator className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
                  <p className="text-muted-foreground">
                    Select a calculation module to view details
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {modules.length} formulas available
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
