"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Slider } from "~/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import {
  Target,
  Calendar,
  TrendingUp,
  Lightbulb,
  Play,
  Save,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  Zap,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";

interface StrategicPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  timeframe: number; // years
  parameters: {
    populationGrowthModifier: number;
    economicGrowthModifier: number;
    investmentLevel: number;
    infrastructureSpending: number;
    educationSpending: number;
    healthcareSpending: number;
    militarySpending: number;
    tradeOpenness: number;
    environmentalProtection: number;
    socialPrograms: number;
  };
  risks: Array<{
    type: string;
    probability: number;
    impact: number;
    description: string;
  }>;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: Date;
  lastModified: Date;
}

export function StrategicPlanningModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: StrategicPlanningModalProps) {
  const [activeTab, setActiveTab] = useState("scenarios");
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [scenarioForm, setScenarioForm] = useState({
    name: "",
    description: "",
    timeframe: 10,
    parameters: {
      populationGrowthModifier: 1.0,
      economicGrowthModifier: 1.0,
      investmentLevel: 20,
      infrastructureSpending: 15,
      educationSpending: 10,
      healthcareSpending: 12,
      militarySpending: 8,
      tradeOpenness: 70,
      environmentalProtection: 25,
      socialPrograms: 18,
    },
  });

  const { data: economicData, isLoading: isEconomicLoading } =
    api.countries.getEconomicData.useQuery(
      { countryId },
      {
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
      }
    );

  // Mock scenarios data (in real implementation, this would come from API)
  const scenarios: Scenario[] = useMemo(
    () => [
      {
        id: "1",
        name: "Economic Growth Focus",
        description: "Prioritize economic development through increased investment and trade",
        timeframe: 10,
        parameters: {
          populationGrowthModifier: 1.0,
          economicGrowthModifier: 1.3,
          investmentLevel: 35,
          infrastructureSpending: 25,
          educationSpending: 15,
          healthcareSpending: 10,
          militarySpending: 5,
          tradeOpenness: 90,
          environmentalProtection: 15,
          socialPrograms: 12,
        },
        risks: [
          {
            type: "Environmental",
            probability: 0.6,
            impact: 0.4,
            description: "Increased pollution and environmental degradation",
          },
          {
            type: "Social",
            probability: 0.3,
            impact: 0.5,
            description: "Potential increase in inequality",
          },
        ],
        status: "active",
        createdAt: new Date(),
        lastModified: new Date(),
      },
      {
        id: "2",
        name: "Balanced Development",
        description: "Sustainable approach balancing economic, social, and environmental factors",
        timeframe: 15,
        parameters: {
          populationGrowthModifier: 1.0,
          economicGrowthModifier: 1.1,
          investmentLevel: 25,
          infrastructureSpending: 20,
          educationSpending: 18,
          healthcareSpending: 15,
          militarySpending: 8,
          tradeOpenness: 75,
          environmentalProtection: 30,
          socialPrograms: 22,
        },
        risks: [
          {
            type: "Economic",
            probability: 0.2,
            impact: 0.3,
            description: "Slower economic growth than alternatives",
          },
        ],
        status: "draft",
        createdAt: new Date(),
        lastModified: new Date(),
      },
      {
        id: "3",
        name: "Social Development Priority",
        description: "Focus on human development, education, and social welfare",
        timeframe: 20,
        parameters: {
          populationGrowthModifier: 0.9,
          economicGrowthModifier: 0.9,
          investmentLevel: 18,
          infrastructureSpending: 15,
          educationSpending: 25,
          healthcareSpending: 20,
          militarySpending: 6,
          tradeOpenness: 60,
          environmentalProtection: 35,
          socialPrograms: 30,
        },
        risks: [
          {
            type: "Economic",
            probability: 0.4,
            impact: 0.6,
            description: "Reduced short-term economic competitiveness",
          },
          {
            type: "Political",
            probability: 0.3,
            impact: 0.4,
            description: "Pressure from business interests",
          },
        ],
        status: "draft",
        createdAt: new Date(),
        lastModified: new Date(),
      },
    ],
    []
  );

  const projectionData = useMemo(() => {
    if (!economicData || !selectedScenario) return [];

    const currentYear = IxTime.getCurrentGameYear();
    const data = [];

    for (let i = 0; i <= selectedScenario.timeframe; i++) {
      const year = currentYear + i;
      const yearsFromNow = i;

      // Apply scenario modifiers to growth calculations
      const modifiedPopGrowth =
        ((economicData as any)?.populationGrowthRate ?? 0) *
        selectedScenario.parameters.populationGrowthModifier;
      const modifiedEconGrowth =
        ((economicData as any)?.adjustedGdpGrowth ?? 0) *
        selectedScenario.parameters.economicGrowthModifier;

      const popGrowthFactor = Math.pow(1 + modifiedPopGrowth, yearsFromNow);
      const econGrowthFactor = Math.pow(1 + modifiedEconGrowth, yearsFromNow);

      data.push({
        year,
        population: (((economicData as any)?.currentPopulation ?? 0) * popGrowthFactor) / 1000000, // in millions
        totalGdp: (((economicData as any)?.currentTotalGdp ?? 0) * econGrowthFactor) / 1000000000, // in billions
        gdpPerCapita: ((economicData as any)?.currentGdpPerCapita ?? 0) * econGrowthFactor,
        isProjection: i > 0,
      });
    }

    return data;
  }, [economicData, selectedScenario]);

  const riskAnalysis = useMemo(() => {
    if (!selectedScenario) return null;

    const totalRisk = selectedScenario.risks.reduce(
      (sum, risk) => sum + risk.probability * risk.impact,
      0
    );

    const riskLevel =
      totalRisk < 0.2 ? "Low" : totalRisk < 0.4 ? "Medium" : totalRisk < 0.6 ? "High" : "Critical";

    return {
      totalRisk,
      riskLevel,
      majorRisks: selectedScenario.risks.filter((r) => r.probability * r.impact > 0.3),
    };
  }, [selectedScenario]);

  const handleParameterChange = (parameter: string, value: number) => {
    setScenarioForm((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [parameter]: value,
      },
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "draft":
        return "text-yellow-600 bg-yellow-100";
      case "completed":
        return "text-blue-600 bg-blue-100";
      case "archived":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-3 w-3" />;
      case "draft":
        return <Clock className="h-3 w-3" />;
      case "completed":
        return <CheckCircle className="h-3 w-3" />;
      case "archived":
        return <Save className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Strategic Planning - {countryName}
          </DialogTitle>
          <DialogDescription>
            Create and analyze strategic scenarios for long-term national development
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="builder">Scenario Builder</TabsTrigger>
            <TabsTrigger value="analysis">Impact Analysis</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="mt-6 space-y-6">
            {/* Current Country Overview */}
            {isEconomicLoading ? (
              <Skeleton className="h-32" />
            ) : economicData ? (
              <GlassCard variant="diplomatic" className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="h-5 w-5" />
                  Current National Status
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatPopulation((economicData as any)?.currentPopulation ?? 0)}
                    </div>
                    <div className="text-muted-foreground text-sm">Population</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency((economicData as any)?.currentTotalGdp ?? 0)}
                    </div>
                    <div className="text-muted-foreground text-sm">Total GDP</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency((economicData as any)?.currentGdpPerCapita ?? 0)}
                    </div>
                    <div className="text-muted-foreground text-sm">GDP per Capita</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {(((economicData as any)?.adjustedGdpGrowth ?? 0) * 100).toFixed(2)}%
                    </div>
                    <div className="text-muted-foreground text-sm">Growth Rate</div>
                  </div>
                </div>
              </GlassCard>
            ) : null}

            {/* Scenarios List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Strategic Scenarios</h3>
                <Button
                  onClick={() => {
                    setActiveTab("builder");
                  }}
                  className="flex items-center gap-2"
                >
                  <Lightbulb className="h-4 w-4" />
                  Create New Scenario
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scenarios.map((scenario) => (
                  <GlassCard
                    key={scenario.id}
                    variant="social"
                    className={`cursor-pointer p-6 transition-all hover:scale-105 ${
                      selectedScenario?.id === scenario.id ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => setSelectedScenario(scenario)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold">{scenario.name}</h4>
                        <Badge className={`text-xs ${getStatusColor(scenario.status)}`}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(scenario.status)}
                            {scenario.status}
                          </span>
                        </Badge>
                      </div>

                      <p className="text-muted-foreground text-sm">{scenario.description}</p>

                      <div className="text-muted-foreground flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {scenario.timeframe} years
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {scenario.risks.length} risks
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Econ Growth:</span>
                          <span className="ml-1 font-medium">
                            {((scenario.parameters.economicGrowthModifier - 1) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Investment:</span>
                          <span className="ml-1 font-medium">
                            {scenario.parameters.investmentLevel}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="builder" className="mt-6 space-y-6">
            <GlassCard variant="economic" className="p-6">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-5 w-5" />
                Scenario Builder
              </h3>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="font-medium">Basic Information</h4>

                  <div className="space-y-2">
                    <Label htmlFor="scenario-name">Scenario Name</Label>
                    <Input
                      id="scenario-name"
                      placeholder="Enter scenario name"
                      value={scenarioForm.name}
                      onChange={(e) =>
                        setScenarioForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scenario-description">Description</Label>
                    <Textarea
                      id="scenario-description"
                      placeholder="Describe the scenario objectives and approach"
                      value={scenarioForm.description}
                      onChange={(e) =>
                        setScenarioForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Planning Timeframe: {scenarioForm.timeframe} years</Label>
                    <Slider
                      value={[scenarioForm.timeframe]}
                      onValueChange={(value: number[]) =>
                        setScenarioForm((prev) => ({ ...prev, timeframe: value[0] ?? 10 }))
                      }
                      max={50}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Parameters */}
                <div className="space-y-4">
                  <h4 className="font-medium">Strategic Parameters</h4>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        Economic Growth Modifier:{" "}
                        {((scenarioForm.parameters.economicGrowthModifier - 1) * 100).toFixed(1)}%
                      </Label>
                      <Slider
                        value={[scenarioForm.parameters.economicGrowthModifier]}
                        onValueChange={(value: number[]) =>
                          handleParameterChange("economicGrowthModifier", value[0] ?? 1.0)
                        }
                        max={2.0}
                        min={0.5}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Investment Level: {scenarioForm.parameters.investmentLevel}% of GDP
                      </Label>
                      <Slider
                        value={[scenarioForm.parameters.investmentLevel]}
                        onValueChange={(value: number[]) =>
                          handleParameterChange("investmentLevel", value[0] ?? 20)
                        }
                        max={50}
                        min={10}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Infrastructure Spending: {scenarioForm.parameters.infrastructureSpending}%
                        of Budget
                      </Label>
                      <Slider
                        value={[scenarioForm.parameters.infrastructureSpending]}
                        onValueChange={(value: number[]) =>
                          handleParameterChange("infrastructureSpending", value[0] ?? 15)
                        }
                        max={40}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Education Spending: {scenarioForm.parameters.educationSpending}% of Budget
                      </Label>
                      <Slider
                        value={[scenarioForm.parameters.educationSpending]}
                        onValueChange={(value: number[]) =>
                          handleParameterChange("educationSpending", value[0] ?? 10)
                        }
                        max={30}
                        min={5}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Trade Openness: {scenarioForm.parameters.tradeOpenness}%</Label>
                      <Slider
                        value={[scenarioForm.parameters.tradeOpenness]}
                        onValueChange={(value: number[]) =>
                          handleParameterChange("tradeOpenness", value[0] ?? 70)
                        }
                        max={100}
                        min={20}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <Button
                  onClick={() => {
                    // Save scenario logic would go here
                    console.log("Saving scenario:", scenarioForm);
                  }}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Scenario
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab("analysis");
                  }}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analyze Impact
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="analysis" className="mt-6 space-y-6">
            {selectedScenario ? (
              <>
                {/* Scenario Overview */}
                <GlassCard variant="social" className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedScenario.name}</h3>
                      <p className="text-muted-foreground">{selectedScenario.description}</p>
                    </div>
                    <Badge className={getStatusColor(selectedScenario.status)}>
                      {selectedScenario.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedScenario.timeframe}
                      </div>
                      <div className="text-muted-foreground text-sm">Years</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {((selectedScenario.parameters.economicGrowthModifier - 1) * 100).toFixed(
                          1
                        )}
                        %
                      </div>
                      <div className="text-muted-foreground text-sm">Growth Modifier</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {riskAnalysis?.riskLevel}
                      </div>
                      <div className="text-muted-foreground text-sm">Risk Level</div>
                    </div>
                  </div>
                </GlassCard>

                {/* Projections Chart */}
                <GlassCard variant="diplomatic" className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <TrendingUp className="h-5 w-5" />
                    Economic Projections
                  </h3>

                  {projectionData.length > 0 && (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={projectionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="year" />
                          <YAxis yAxisId="gdp" orientation="left" />
                          <YAxis yAxisId="pop" orientation="right" />
                          <Tooltip
                            formatter={(value: number | string, name: string) => {
                              if (name === "totalGdp" && typeof value === "number")
                                return [`$${value.toFixed(1)}B`, "Total GDP"];
                              if (name === "population" && typeof value === "number")
                                return [`${value.toFixed(1)}M`, "Population"];
                              if (name === "gdpPerCapita" && typeof value === "number")
                                return [formatCurrency(value), "GDP per Capita"];
                              return [value, name];
                            }}
                            labelFormatter={(label) => `Year ${label}`}
                          />
                          <Area
                            yAxisId="gdp"
                            type="monotone"
                            dataKey="totalGdp"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                          <Line
                            yAxisId="pop"
                            type="monotone"
                            dataKey="population"
                            stroke="#10b981"
                            strokeWidth={2}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </GlassCard>

                {/* Risk Analysis */}
                {riskAnalysis && (
                  <GlassCard variant="security" className="p-6">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Analysis
                    </h3>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="mb-3 font-medium">Overall Risk Assessment</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Risk Level:</span>
                            <Badge
                              className={
                                riskAnalysis.riskLevel === "Low"
                                  ? "bg-green-100 text-green-800"
                                  : riskAnalysis.riskLevel === "Medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : riskAnalysis.riskLevel === "High"
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-red-100 text-red-800"
                              }
                            >
                              {riskAnalysis.riskLevel}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Risk Score:</span>
                            <span className="font-medium">
                              {(riskAnalysis.totalRisk * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 font-medium">Major Risk Factors</h4>
                        <div className="space-y-2">
                          {riskAnalysis.majorRisks.map((risk, index) => (
                            <div key={index} className="bg-muted/50 rounded p-2 text-sm">
                              <div className="font-medium">{risk.type}</div>
                              <div className="text-muted-foreground">{risk.description}</div>
                              <div className="mt-1 text-xs">
                                Probability: {(risk.probability * 100).toFixed(0)}% | Impact:{" "}
                                {(risk.impact * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )}
              </>
            ) : (
              <GlassCard variant="social" className="p-12 text-center">
                <Target className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">Select a Scenario</h3>
                <p className="text-muted-foreground">
                  Choose a scenario from the Scenarios tab to view detailed impact analysis
                </p>
              </GlassCard>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="mt-6 space-y-6">
            <GlassCard variant="diplomatic" className="p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5" />
                Scenario Comparison
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {scenarios.map((scenario) => (
                    <GlassCard key={scenario.id} variant="social" className="p-4">
                      <h4 className="mb-2 font-semibold">{scenario.name}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Timeframe:</span>
                          <span>{scenario.timeframe} years</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Econ Growth:</span>
                          <span>
                            {((scenario.parameters.economicGrowthModifier - 1) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Investment:</span>
                          <span>{scenario.parameters.investmentLevel}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Risks:</span>
                          <span>{scenario.risks.length}</span>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>

                <div className="text-muted-foreground text-center">
                  <Zap className="mx-auto mb-2 h-8 w-8" />
                  <p>Advanced comparison charts and analysis coming soon!</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
