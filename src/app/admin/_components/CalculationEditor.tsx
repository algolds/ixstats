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
// import { api } from "~/trpc/react"; // Disabled for now to prevent API errors

interface CalculationModule {
  id: string;
  name: string;
  description: string;
  category: "economic" | "demographic" | "stability" | "governance";
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
};

export function CalculationEditor() {
  const [selectedModule, setSelectedModule] = useState<CalculationModule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, CalculationResult>>({});
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);

  // Mock data - replace with actual API calls
  const [modules, setModules] = useState<CalculationModule[]>([
    {
      id: "gdp-growth",
      name: "GDP Growth Calculation",
      description: "Calculates GDP growth rate with tier-based constraints and DM modifiers",
      category: "economic",
      formula: `
function calculateGDPGrowth(baseGDP, population, tier, globalFactor, dmModifiers) {
  // Base growth rate based on economic tier
  const tierMultipliers = {
    1: 0.10, // Impoverished: max 10%
    2: 0.075, // Developing: max 7.5%
    3: 0.05, // Developed: max 5%
    4: 0.035, // Healthy: max 3.5%
    5: 0.0275, // Strong: max 2.75%
    6: 0.015, // Very Strong: max 1.5%
    7: 0.005  // Extravagant: max 0.5%
  };
  
  let growthRate = Math.min(
    globalFactor * tierMultipliers[tier],
    tierMultipliers[tier]
  );
  
  // Apply DM modifiers
  for (const modifier of dmModifiers) {
    if (modifier.type === 'gdp_adjustment') {
      growthRate *= (1 + modifier.value);
    }
  }
  
  // Apply population scaling factor
  const populationFactor = Math.log(population / 1000000) * 0.01;
  growthRate += populationFactor;
  
  return Math.max(growthRate, -0.05); // Minimum -5% growth
}`,
      variables: {
        baseGDP: 50000,
        population: 5000000,
        tier: 3,
      },
      constants: {
        globalFactor: 1.0321,
        minGrowthRate: -0.05,
        populationScaling: 0.01,
      },
      dependencies: ["dm-modifiers", "economic-tiers"],
      testCases: [
        {
          id: "test-1",
          name: "Developed Country Normal Growth",
          inputs: { baseGDP: 45000, population: 10000000, tier: 3 },
          expectedOutput: 0.048,
          status: "pending",
        },
        {
          id: "test-2",
          name: "Impoverished Country High Growth",
          inputs: { baseGDP: 2000, population: 50000000, tier: 1 },
          expectedOutput: 0.095,
          status: "pending",
        },
      ],
      lastModified: new Date(),
      modifiedBy: "admin",
      isActive: true,
      version: "2.1.3",
    },
    {
      id: "tax-efficiency",
      name: "Tax Collection Efficiency",
      description:
        "Calculates government tax collection effectiveness with atomic government modifiers",
      category: "economic",
      formula: `
function calculateTaxEfficiency(baseTaxRate, governmentType, atomicComponents, corruption) {
  let efficiency = baseTaxRate;
  
  // Government type modifiers
  const govModifiers = {
    democracy: 0.85,
    autocracy: 0.75,
    technocracy: 0.95,
    military: 0.70
  };
  
  efficiency *= govModifiers[governmentType] || 0.80;
  
  // Apply atomic component bonuses
  for (const component of atomicComponents) {
    switch (component.type) {
      case 'PROFESSIONAL_BUREAUCRACY':
        efficiency *= 1.30;
        break;
      case 'RULE_OF_LAW':
        efficiency *= 1.20;
        break;
      case 'SURVEILLANCE_SYSTEM':
        efficiency *= 1.15;
        break;
    }
  }
  
  // Apply corruption penalty
  efficiency *= (1 - corruption);
  
  return Math.min(efficiency, 0.98); // Maximum 98% efficiency
}`,
      variables: {
        baseTaxRate: 0.25,
        corruption: 0.12,
      },
      constants: {
        maxEfficiency: 0.98,
        professionalBureaucracyBonus: 1.3,
        ruleOfLawBonus: 1.2,
      },
      dependencies: ["atomic-components", "government-types"],
      testCases: [
        {
          id: "test-3",
          name: "High Efficiency Democracy",
          inputs: { baseTaxRate: 0.3, corruption: 0.05 },
          expectedOutput: 0.77,
          status: "pending",
        },
      ],
      lastModified: new Date(Date.now() - 86400000),
      modifiedBy: "admin",
      isActive: true,
      version: "1.8.1",
    },
    {
      id: "stability-index",
      name: "Country Stability Index",
      description:
        "Calculates overall country stability based on economic, political, and social factors",
      category: "stability",
      formula: `
function calculateStabilityIndex(economic, political, social, atomicComponents) {
  const weights = {
    economic: 0.4,
    political: 0.35,
    social: 0.25
  };
  
  let baseStability = (
    economic * weights.economic +
    political * weights.political +
    social * weights.social
  );
  
  // Apply atomic governance bonuses
  let atomicBonus = 1.0;
  for (const component of atomicComponents) {
    if (component.type === 'INDEPENDENT_JUDICIARY') {
      atomicBonus *= 1.12;
    }
    if (component.type === 'DEMOCRATIC_PROCESS') {
      atomicBonus *= 1.08;
    }
  }
  
  return Math.min(baseStability * atomicBonus, 100);
}`,
      variables: {
        economic: 75,
        political: 68,
        social: 82,
      },
      constants: {
        economicWeight: 0.4,
        politicalWeight: 0.35,
        socialWeight: 0.25,
        maxStability: 100,
      },
      dependencies: ["atomic-components"],
      testCases: [
        {
          id: "test-4",
          name: "Stable Democratic Country",
          inputs: { economic: 80, political: 75, social: 85 },
          expectedOutput: 78.5,
          status: "pending",
        },
      ],
      lastModified: new Date(Date.now() - 172800000),
      modifiedBy: "admin",
      isActive: true,
      version: "3.0.2",
    },
    {
      id: "population-growth",
      name: "Population Growth Dynamics",
      description:
        "Calculates population growth with demographic transition, healthcare, and urbanization factors",
      category: "demographic",
      formula: `
function calculatePopulationGrowth(currentPop, birthRate, deathRate, tier, healthcare, urbanization) {
  // Base natural increase
  let naturalIncrease = birthRate - deathRate;

  // Demographic transition model
  const transitionFactors = {
    1: 1.0,   // Pre-transition: high birth/death
    2: 1.15,  // Early transition: high birth, falling death
    3: 0.85,  // Late transition: falling birth/death
    4: 0.65,  // Post-transition: low birth/death
  };

  naturalIncrease *= (transitionFactors[Math.min(tier, 4)] || 1.0);

  // Healthcare impact on death rate
  const healthcareFactor = (1 - (healthcare * 0.003));
  naturalIncrease -= deathRate * healthcareFactor;

  // Urbanization effect (tends to reduce birth rates)
  const urbanEffect = Math.pow(urbanization / 100, 1.2) * -0.008;
  naturalIncrease += urbanEffect;

  return Math.max(naturalIncrease, -0.02); // Min -2% (crisis scenarios)
}`,
      variables: {
        currentPop: 50000000,
        birthRate: 0.018,
        deathRate: 0.009,
        tier: 3,
        healthcare: 75,
        urbanization: 65,
      },
      constants: {
        maxGrowth: 0.05,
        minGrowth: -0.02,
        urbanizationFactor: 0.008,
      },
      dependencies: ["economic-tiers", "healthcare-system"],
      testCases: [
        {
          id: "test-5",
          name: "Developing Country High Growth",
          inputs: { birthRate: 0.025, deathRate: 0.008, tier: 2, healthcare: 60, urbanization: 40 },
          expectedOutput: 0.0195,
          status: "pending",
        },
      ],
      lastModified: new Date(Date.now() - 259200000),
      modifiedBy: "admin",
      isActive: true,
      version: "2.5.0",
    },
    {
      id: "military-strength",
      name: "Military Strength Calculation",
      description:
        "Calculates effective military power with technology, training, and logistics factors",
      category: "governance",
      formula: `
function calculateMilitaryStrength(personnel, equipment, technology, training, logistics, budget) {
  // Base strength from personnel and equipment
  let baseStrength = Math.sqrt(personnel * equipment);

  // Technology multiplier (1.0 to 3.0)
  const techMultiplier = 1.0 + (technology / 50);

  // Training effectiveness (0.5 to 1.5)
  const trainingFactor = 0.5 + (training / 100);

  // Logistics efficiency (critical for sustained operations)
  const logisticsFactor = Math.pow(logistics / 100, 0.8);

  // Budget sustainability factor
  const budgetAdequacy = Math.min(budget / (personnel * 50000), 1.5);

  // Combined military power
  const strength = baseStrength *
                   techMultiplier *
                   trainingFactor *
                   logisticsFactor *
                   budgetAdequacy;

  return Math.round(strength);
}`,
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
          id: "test-6",
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
      lastModified: new Date(Date.now() - 345600000),
      modifiedBy: "admin",
      isActive: true,
      version: "1.6.4",
    },
    {
      id: "trade-balance",
      name: "Trade Balance & Current Account",
      description:
        "Calculates trade balance considering exports, imports, services, and financial flows",
      category: "economic",
      formula: `
function calculateTradeBalance(exports, imports, services, fdi, remittances, tourism) {
  // Goods trade balance
  const goodsBalance = exports - imports;

  // Services balance (net)
  const servicesBalance = services;

  // Income from FDI and financial assets
  const incomeBalance = fdi * 0.07; // 7% return on FDI

  // Transfers (remittances, tourism)
  const transfersBalance = remittances + tourism;

  // Current account = Goods + Services + Income + Transfers
  const currentAccount = goodsBalance + servicesBalance + incomeBalance + transfersBalance;

  // Trade balance as % of GDP
  const tradeIntensity = (exports + imports) / 2;

  return {
    currentAccount,
    goodsBalance,
    servicesBalance,
    tradeIntensity
  };
}`,
      variables: {
        exports: 450000000000,
        imports: 380000000000,
        services: 25000000000,
        fdi: 150000000000,
        remittances: 8000000000,
        tourism: 12000000000,
      },
      constants: {
        fdiReturnRate: 0.07,
        goodsWeight: 0.7,
        servicesWeight: 0.3,
      },
      dependencies: ["trade-partners", "exchange-rates"],
      testCases: [
        {
          id: "test-7",
          name: "Trade Surplus Economy",
          inputs: {
            exports: 500000000000,
            imports: 350000000000,
            services: 30000000000,
            fdi: 180000000000,
            remittances: 10000000000,
            tourism: 15000000000,
          },
          expectedOutput: 205600000000,
          status: "pending",
        },
      ],
      lastModified: new Date(Date.now() - 432000000),
      modifiedBy: "admin",
      isActive: true,
      version: "2.3.1",
    },
    {
      id: "atomic-synergy",
      name: "Atomic Government Synergy Calculator",
      description: "Calculates synergy bonuses from atomic government component combinations",
      category: "governance",
      formula: `
function calculateAtomicSynergy(components) {
  let totalSynergy = 0;
  const synergyPairs = {
    'PROFESSIONAL_BUREAUCRACY+RULE_OF_LAW': 1.25,
    'DEMOCRATIC_PROCESS+INDEPENDENT_JUDICIARY': 1.30,
    'SURVEILLANCE_SYSTEM+RULE_OF_LAW': 1.15,
    'UNIVERSAL_EDUCATION+PROFESSIONAL_BUREAUCRACY': 1.20,
    'SOCIAL_SAFETY_NET+UNIVERSAL_HEALTHCARE': 1.35,
    'MILITARY_INDUSTRIAL_COMPLEX+PROFESSIONAL_BUREAUCRACY': 1.18,
    'FREE_PRESS+DEMOCRATIC_PROCESS': 1.22,
    'DIGITAL_GOVERNANCE+PROFESSIONAL_BUREAUCRACY': 1.28
  };

  // Check all component pairs for synergies
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const pairKey = \`\${components[i]}+\${components[j]}\`;
      const reversePair = \`\${components[j]}+\${components[i]}\`;

      if (synergyPairs[pairKey]) {
        totalSynergy += (synergyPairs[pairKey] - 1.0);
      } else if (synergyPairs[reversePair]) {
        totalSynergy += (synergyPairs[reversePair] - 1.0);
      }
    }
  }

  // Diminishing returns for many components
  const componentCount = components.length;
  const scalingFactor = Math.min(1.0, 5.0 / componentCount);

  return 1.0 + (totalSynergy * scalingFactor);
}`,
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
          id: "test-8",
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
      lastModified: new Date(Date.now() - 518400000),
      modifiedBy: "admin",
      isActive: true,
      version: "3.2.0",
    },
  ]);

  const runTestCase = async (moduleId: string, testCase: TestCase) => {
    // Simulate running the calculation
    const startTime = performance.now();

    try {
      // Mock calculation execution
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Mock result (in reality, this would execute the actual formula)
      const mockResult = testCase.expectedOutput * (0.95 + Math.random() * 0.1);
      const success = Math.abs(mockResult - testCase.expectedOutput) < 0.01;

      const result: CalculationResult = {
        success,
        result: mockResult,
        executionTime,
        intermediateSteps: {
          step1:
            typeof testCase.inputs.baseGDP === "number"
              ? testCase.inputs.baseGDP
              : typeof testCase.inputs.economic === "number"
                ? testCase.inputs.economic
                : 0,
          step2: mockResult * 0.7,
          step3: mockResult,
        },
      };

      setTestResults((prev) => ({
        ...prev,
        [testCase.id]: result,
      }));

      // Update test case status
      setModules((prev) =>
        prev.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                testCases: module.testCases.map((tc) =>
                  tc.id === testCase.id
                    ? { ...tc, status: success ? "passed" : "failed", actualOutput: mockResult }
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

  const saveModule = () => {
    if (!selectedModule) return;

    // Mock save operation
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calculation Editor</h2>
          <p className="text-muted-foreground">Edit and test internal calculation formulas</p>
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
                        {category.label}
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
                            placeholder="Enter JavaScript function..."
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
                        <Label>Formula Code</Label>
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
                                value={value}
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
                              <span className="font-medium">{value}</span>
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
                                    <span>{value}</span>
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
                              {entry.timestamp.toLocaleString()}
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
                  <p className="text-muted-foreground">Select a calculation module to edit</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
