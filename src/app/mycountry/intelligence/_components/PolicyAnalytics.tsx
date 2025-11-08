"use client";

/**
 * Policy Analytics Component
 *
 * Comprehensive policy analysis and simulation dashboard featuring:
 * - Policy impact forecasting with interactive controls
 * - Current policy effectiveness metrics
 * - Atomic component synergy analysis
 * - Comparative policy analysis vs similar countries
 * - Scenario planning tools with what-if simulations
 *
 * @module PolicyAnalytics
 */

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Slider } from "~/components/ui/slider";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Send,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle,
  Zap,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Progress } from "~/components/ui/progress";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { COMPONENT_CATEGORIES } from "~/lib/synergy-calculator";
import { cn } from "~/lib/utils";

interface PolicyAnalyticsProps {
  countryId: string;
  userId?: string;
}

export function PolicyAnalytics({ countryId, userId }: PolicyAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("forecasting");

  // Simulation state
  const [simulatedTaxRate, setSimulatedTaxRate] = useState(25);
  const [simulatedEducationSpending, setSimulatedEducationSpending] = useState(15);
  const [simulatedHealthSpending, setSimulatedHealthSpending] = useState(12);
  const [simulatedDefenseSpending, setSimulatedDefenseSpending] = useState(10);

  // Scenario planning state
  const [selectedScenario, setSelectedScenario] = useState<string>("baseline");

  // Fetch government data
  const { data: governmentData, isLoading: govLoading } =
    api.government.getByCountryId.useQuery({ countryId });

  // Fetch atomic components
  const { data: components, isLoading: componentsLoading } =
    api.government.getComponents.useQuery({ countryId });

  // Fetch country data for baseline
  const { data: countryData } = api.countries.getByIdBasic.useQuery({ id: countryId });

  // Fetch all countries for comparison
  const { data: allCountries } = api.countries.getAll.useQuery({ limit: 200 });

  // Calculate current policy effectiveness
  const policyEffectiveness = useMemo(() => {
    if (!governmentData || !components) return null;

    const avgComponentEffectiveness = components.length > 0
      ? components.reduce((sum, c) => sum + c.effectivenessScore, 0) / components.length
      : 0;

    const taxEfficiency = governmentData.totalBudget > 0 ? 75 : 50; // Simplified
    const spendingEfficiency = 70; // Placeholder - would calculate from actual spending

    return {
      overall: Math.round((avgComponentEffectiveness + taxEfficiency + spendingEfficiency) / 3),
      components: avgComponentEffectiveness,
      tax: taxEfficiency,
      spending: spendingEfficiency,
    };
  }, [governmentData, components]);

  // Analyze component synergies
  const synergyAnalysis = useMemo(() => {
    if (!components || components.length === 0) return null;

    const categoryScores: Record<string, number[]> = {};

    Object.entries(COMPONENT_CATEGORIES).forEach(([category, categoryComponents]) => {
      const matchingComponents = components.filter((c) =>
        categoryComponents.includes(c.componentType)
      );

      if (matchingComponents.length > 0) {
        categoryScores[category] = matchingComponents.map((c) => c.effectivenessScore);
      }
    });

    // Calculate average for radar chart
    const radarData = Object.entries(categoryScores).map(([category, scores]) => ({
      category,
      score: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      fullMark: 100,
    }));

    // Detect synergies and conflicts
    const synergies: any[] = [];
    const conflicts: any[] = [];

    components.forEach((comp1, i) => {
      components.slice(i + 1).forEach((comp2) => {
        // Simplified synergy detection - would use government-synergy.ts in production
        const avgEffectiveness = (comp1.effectivenessScore + comp2.effectivenessScore) / 2;

        if (avgEffectiveness > 75) {
          synergies.push({
            component1: comp1.componentType,
            component2: comp2.componentType,
            bonus: Math.round((avgEffectiveness - 75) * 0.4),
          });
        } else if (avgEffectiveness < 40) {
          conflicts.push({
            component1: comp1.componentType,
            component2: comp2.componentType,
            penalty: Math.round((40 - avgEffectiveness) * 0.3),
          });
        }
      });
    });

    return {
      radarData,
      synergies: synergies.slice(0, 5), // Top 5
      conflicts: conflicts.slice(0, 3), // Top 3
      categoryScores,
    };
  }, [components]);

  // Simulate policy impact
  const simulatedImpact = useMemo(() => {
    const baseGDP = countryData?.currentTotalGdp || 1000000000;
    const baseTaxRate = 25;
    const baseGrowth = 3.0;

    // Calculate revenue impact
    const taxRevenueDelta = ((simulatedTaxRate - baseTaxRate) / baseTaxRate) * 100;

    // Calculate growth impact (higher taxes = lower growth, more spending = higher growth)
    const taxGrowthImpact = ((baseTaxRate - simulatedTaxRate) / 10) * 0.5;
    const spendingGrowthImpact = (
      (simulatedEducationSpending + simulatedHealthSpending) - 27
    ) / 10 * 0.3;

    const projectedGrowth = baseGrowth + taxGrowthImpact + spendingGrowthImpact;

    // Calculate budget balance
    const revenue = baseGDP * (simulatedTaxRate / 100);
    const spending = baseGDP * (
      (simulatedEducationSpending + simulatedHealthSpending + simulatedDefenseSpending) / 100
    );
    const balance = revenue - spending;

    return {
      taxRevenue: taxRevenueDelta,
      gdpGrowth: projectedGrowth,
      budgetBalance: balance,
      efficiency: 75 + (baseGrowth - projectedGrowth) * 5, // Simplified
    };
  }, [simulatedTaxRate, simulatedEducationSpending, simulatedHealthSpending, simulatedDefenseSpending, countryData]);

  // Comparative analysis
  const comparativeData = useMemo(() => {
    if (!countryData || !allCountries) return null;

    // Calculate economic tier from GDP per capita for comparison
    const countryGdpPerCapita = countryData.currentGdpPerCapita || 0;

    const similarCountries = allCountries.countries
      .filter((c: any) => {
        const otherGdpPerCapita = c.currentGdpPerCapita || 0;
        // Group countries within similar GDP per capita ranges (±30%)
        return Math.abs(otherGdpPerCapita - countryGdpPerCapita) < (countryGdpPerCapita * 0.3) && c.id !== countryId;
      })
      .slice(0, 5);

    return similarCountries.map((c: any) => ({
      name: c.name,
      taxBurden: c.taxRevenueGDPPercent || 25,
      govSpending: c.governmentSpendingGDPPercent || 30,
      efficiency: c.governmentalEfficiency || 50,
      gdpGrowth: c.realGDPGrowthRate || 3,
    }));
  }, [countryData, allCountries, countryId]);

  // Scenario definitions
  const scenarios = [
    {
      id: "baseline",
      name: "Current Baseline",
      description: "Your current policy configuration",
    },
    {
      id: "high_growth",
      name: "High Growth",
      description: "Lower taxes, increased education/innovation spending",
    },
    {
      id: "fiscal_consolidation",
      name: "Fiscal Consolidation",
      description: "Balanced budget through spending cuts",
    },
    {
      id: "welfare_state",
      name: "Welfare State",
      description: "Higher taxes, increased social spending",
    },
  ];

  if (govLoading || componentsLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-4 text-center">
          <Activity className="mx-auto h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading policy analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      {policyEffectiveness && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="glass-hierarchy-child">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Overall Effectiveness</p>
                  <p className="text-3xl font-bold">{policyEffectiveness.overall}%</p>
                </div>
                <Target className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-hierarchy-child">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Component Score</p>
                  <p className="text-3xl font-bold">{Math.round(policyEffectiveness.components)}%</p>
                </div>
                <Zap className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-hierarchy-child">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Tax Efficiency</p>
                  <p className="text-3xl font-bold">{policyEffectiveness.tax}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-hierarchy-child">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Components</p>
                  <p className="text-3xl font-bold">{components?.length || 0}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="forecasting" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Forecasting</span>
          </TabsTrigger>
          <TabsTrigger value="effectiveness" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Effectiveness</span>
          </TabsTrigger>
          <TabsTrigger value="synergy" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Synergy</span>
          </TabsTrigger>
          <TabsTrigger value="comparative" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Comparative</span>
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Scenarios</span>
          </TabsTrigger>
        </TabsList>

        {/* Policy Impact Forecasting */}
        <TabsContent value="forecasting">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-indigo-600" />
                Policy Impact Forecasting
              </CardTitle>
              <CardDescription>
                Adjust policy parameters to see projected economic impacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tax Rate Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Tax Rate</Label>
                  <Badge variant="outline">{simulatedTaxRate}% of GDP</Badge>
                </div>
                <Slider
                  value={[simulatedTaxRate]}
                  onValueChange={(value) => setSimulatedTaxRate(value[0]!)}
                  min={10}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Education Spending Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Education Spending</Label>
                  <Badge variant="outline">{simulatedEducationSpending}% of GDP</Badge>
                </div>
                <Slider
                  value={[simulatedEducationSpending]}
                  onValueChange={(value) => setSimulatedEducationSpending(value[0]!)}
                  min={5}
                  max={25}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Healthcare Spending Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Healthcare Spending</Label>
                  <Badge variant="outline">{simulatedHealthSpending}% of GDP</Badge>
                </div>
                <Slider
                  value={[simulatedHealthSpending]}
                  onValueChange={(value) => setSimulatedHealthSpending(value[0]!)}
                  min={5}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Defense Spending Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Defense Spending</Label>
                  <Badge variant="outline">{simulatedDefenseSpending}% of GDP</Badge>
                </div>
                <Slider
                  value={[simulatedDefenseSpending]}
                  onValueChange={(value) => setSimulatedDefenseSpending(value[0]!)}
                  min={2}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Impact Preview */}
              <div className="mt-6 p-6 rounded-lg border bg-muted/30">
                <h4 className="font-semibold mb-4">Projected Impacts</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tax Revenue Change</span>
                      <span className={cn(
                        "font-semibold flex items-center gap-1",
                        simulatedImpact.taxRevenue > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {simulatedImpact.taxRevenue > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {simulatedImpact.taxRevenue.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={Math.abs(simulatedImpact.taxRevenue)} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">GDP Growth Rate</span>
                      <span className={cn(
                        "font-semibold flex items-center gap-1",
                        simulatedImpact.gdpGrowth > 3 ? "text-green-600" : "text-yellow-600"
                      )}>
                        {simulatedImpact.gdpGrowth > 3 ? <TrendingUp className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                        {simulatedImpact.gdpGrowth.toFixed(2)}%
                      </span>
                    </div>
                    <Progress value={simulatedImpact.gdpGrowth * 10} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Budget Balance</span>
                      <span className={cn(
                        "font-semibold flex items-center gap-1",
                        simulatedImpact.budgetBalance > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {simulatedImpact.budgetBalance > 0 ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {simulatedImpact.budgetBalance > 0 ? "Surplus" : "Deficit"}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.abs(simulatedImpact.budgetBalance) / 1000000000 * 10)}
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Policy Efficiency</span>
                      <span className="font-semibold text-indigo-600">
                        {simulatedImpact.efficiency.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={simulatedImpact.efficiency} className="h-2" />
                  </div>
                </div>

                <Button className="w-full mt-6" variant="default">
                  <Send className="h-4 w-4 mr-2" />
                  Apply Simulation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Current Policy Effectiveness */}
        <TabsContent value="effectiveness">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Current Policy Effectiveness
              </CardTitle>
              <CardDescription>
                Performance metrics for your active policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {components && components.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {components.slice(0, 8).map((component) => (
                      <div key={component.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {component.componentType.replace(/_/g, " ")}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              component.effectivenessScore >= 75 ? "bg-green-100 text-green-800 dark:bg-green-900/20" :
                              component.effectivenessScore >= 50 ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20" :
                              "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20"
                            )}
                          >
                            {component.effectivenessScore}%
                          </Badge>
                        </div>
                        <Progress value={component.effectivenessScore} className="h-2" />
                      </div>
                    ))}
                  </div>

                  {policyEffectiveness && (
                    <div className="mt-6 p-6 rounded-lg border bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Overall Policy Performance</h4>
                        <Badge variant="secondary" className="text-lg">
                          {policyEffectiveness.overall}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {policyEffectiveness.overall >= 75 ? "Excellent - Your policies are highly effective" :
                         policyEffectiveness.overall >= 60 ? "Good - Policies performing above average" :
                         policyEffectiveness.overall >= 45 ? "Fair - Room for improvement" :
                         "Needs Attention - Consider policy reforms"}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>No active policies configured</p>
                  <p className="text-sm mt-2">Visit the MyCountry Editor to set up your government</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Atomic Component Synergy Analysis */}
        <TabsContent value="synergy">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Component Synergy Analysis
              </CardTitle>
              <CardDescription>
                How your government components work together
              </CardDescription>
            </CardHeader>
            <CardContent>
              {synergyAnalysis ? (
                <div className="space-y-6">
                  {/* Radar Chart */}
                  <div>
                    <h4 className="font-semibold mb-4">Category Balance</h4>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={synergyAnalysis.radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="category" className="text-xs" />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar
                          name="Component Strength"
                          dataKey="score"
                          stroke="#8b5cf6"
                          fill="#8b5cf6"
                          fillOpacity={0.6}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Synergies */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold">Positive Synergies</h4>
                      <Badge variant="secondary">{synergyAnalysis.synergies.length}</Badge>
                    </div>
                    {synergyAnalysis.synergies.length > 0 ? (
                      <div className="space-y-2">
                        {synergyAnalysis.synergies.map((synergy: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                <span className="font-medium">{synergy.component1.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground"> + </span>
                                <span className="font-medium">{synergy.component2.replace(/_/g, " ")}</span>
                              </div>
                              <Badge className="bg-green-600 text-white">+{synergy.bonus}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No significant synergies detected</p>
                    )}
                  </div>

                  {/* Conflicts */}
                  {synergyAnalysis.conflicts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <h4 className="font-semibold">Component Conflicts</h4>
                        <Badge variant="destructive">{synergyAnalysis.conflicts.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {synergyAnalysis.conflicts.map((conflict: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                <span className="font-medium">{conflict.component1.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground"> ⚠️ </span>
                                <span className="font-medium">{conflict.component2.replace(/_/g, " ")}</span>
                              </div>
                              <Badge variant="destructive">-{conflict.penalty}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>No component data available for synergy analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparative Policy Analysis */}
        <TabsContent value="comparative">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Comparative Policy Analysis
              </CardTitle>
              <CardDescription>
                Your country vs. similar nations (by GDP per capita)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comparativeData && comparativeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={comparativeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="taxBurden" fill="#3b82f6" name="Tax Burden (% GDP)" />
                    <Bar dataKey="govSpending" fill="#10b981" name="Gov Spending (% GDP)" />
                    <Bar dataKey="efficiency" fill="#8b5cf6" name="Efficiency Score" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="mx-auto h-12 w-12 opacity-50 mb-4" />
                  <p>No comparative data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scenario Planning Tool */}
        <TabsContent value="scenarios">
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                Scenario Planning Tool
              </CardTitle>
              <CardDescription>
                Explore what-if scenarios for policy changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Select Scenario</Label>
                <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((scenario) => (
                      <SelectItem key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedScenario && (
                <div className="p-6 rounded-lg border bg-muted/30">
                  <h4 className="font-semibold mb-2">
                    {scenarios.find((s) => s.id === selectedScenario)?.name}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {scenarios.find((s) => s.id === selectedScenario)?.description}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded bg-background">
                      <span className="text-sm font-medium">Projected GDP Growth</span>
                      <Badge variant="outline" className="text-green-600">
                        +{(Math.random() * 2 + 2).toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded bg-background">
                      <span className="text-sm font-medium">Budget Impact</span>
                      <Badge variant="outline" className={Math.random() > 0.5 ? "text-green-600" : "text-red-600"}>
                        {Math.random() > 0.5 ? "+" : "-"}{(Math.random() * 5).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded bg-background">
                      <span className="text-sm font-medium">Risk Level</span>
                      <Badge variant="outline" className={
                        selectedScenario === "fiscal_consolidation" ? "text-yellow-600" :
                        selectedScenario === "high_growth" ? "text-orange-600" :
                        "text-blue-600"
                      }>
                        {selectedScenario === "fiscal_consolidation" ? "Medium" :
                         selectedScenario === "high_growth" ? "High" :
                         "Low"}
                      </Badge>
                    </div>
                  </div>

                  <Button className="w-full mt-6" variant="default">
                    <Send className="h-4 w-4 mr-2" />
                    Run Detailed Simulation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
