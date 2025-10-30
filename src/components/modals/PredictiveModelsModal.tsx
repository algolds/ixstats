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
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  RefreshCw,
  Download,
  Filter,
  Search,
  Zap,
  Target,
  Users,
  DollarSign,
  Globe,
  Shield,
  Lightbulb,
  Eye,
  BarChart4,
  PieChart as PieChartIcon,
  ScatterChart as ScatterChartIcon,
  Brain,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  Gauge,
  Target as TargetIcon,
  AlertCircle,
  Info,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";

interface PredictiveModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

interface PredictionScenario {
  id: string;
  name: string;
  description: string;
  probability: number;
  gdpGrowth: number;
  populationGrowth: number;
  inflationRate: number;
  unemploymentRate: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  risks: string[];
  opportunities: string[];
  recommendations: string[];
}

interface ForecastData {
  year: number;
  optimistic: number;
  realistic: number;
  pessimistic: number;
  confidenceLower: number;
  confidenceUpper: number;
}

const SCENARIO_COLORS = {
  optimistic: "#10b981",
  realistic: "#3b82f6",
  pessimistic: "#ef4444",
};

const CONFIDENCE_COLORS = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#ef4444",
};

export function PredictiveModelsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: PredictiveModelsModalProps) {
  const [activeTab, setActiveTab] = useState("forecasts");
  const [selectedTimeframe, setSelectedTimeframe] = useState("5y");
  const [selectedMetric, setSelectedMetric] = useState("gdp");
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string>("realistic");
  const [forecastHorizon, setForecastHorizon] = useState(10);

  // Get country data
  const { data: countryData, isLoading: countryLoading } =
    api.countries.getByIdWithEconomicData.useQuery({ id: countryId }, { enabled: isOpen });

  // Get predictive models
  const { data: predictiveModels, isLoading: modelsLoading } =
    api.unifiedIntelligence.getPredictiveModels.useQuery(
      {
        countryId: countryId || "disabled",
        timeframe: "5_years",
        scenarios: ["optimistic", "realistic", "pessimistic"],
      },
      { enabled: isOpen && !!countryId }
    );

  // Get historical data for context
  const { data: historicalData, isLoading: historicalLoading } =
    api.countries.getHistoricalData.useQuery({ countryId }, { enabled: isOpen });

  const isLoading = countryLoading || modelsLoading || historicalLoading;

  // Generate forecast data
  const forecastData = useMemo(() => {
    if (!countryData) return [];

    const currentYear = IxTime.getCurrentGameYear();
    const data: ForecastData[] = [];

    for (let i = 0; i <= forecastHorizon; i++) {
      const year = currentYear + i;
      const yearsFromNow = i;

      // Base values
      const currentGdp = countryData.currentTotalGdp || 0;
      const currentPopulation = countryData.currentPopulation || 0;
      const currentGdpPerCapita = countryData.currentGdpPerCapita || 0;

      // Growth rates with scenario modifiers
      const baseGdpGrowth = countryData.adjustedGdpGrowth || 0;
      const basePopGrowth = countryData.populationGrowthRate || 0;

      // Scenario multipliers
      const optimisticMultiplier = 1.3;
      const realisticMultiplier = 1.0;
      const pessimisticMultiplier = 0.7;

      // Calculate projections
      const optimisticGdp =
        currentGdp * Math.pow(1 + baseGdpGrowth * optimisticMultiplier, yearsFromNow);
      const realisticGdp =
        currentGdp * Math.pow(1 + baseGdpGrowth * realisticMultiplier, yearsFromNow);
      const pessimisticGdp =
        currentGdp * Math.pow(1 + baseGdpGrowth * pessimisticMultiplier, yearsFromNow);

      // Confidence intervals (simplified)
      const confidenceRange = 0.15; // 15% range
      const confidenceLower = realisticGdp * (1 - confidenceRange);
      const confidenceUpper = realisticGdp * (1 + confidenceRange);

      data.push({
        year,
        optimistic: optimisticGdp / 1e12, // Convert to trillions
        realistic: realisticGdp / 1e12,
        pessimistic: pessimisticGdp / 1e12,
        confidenceLower: confidenceLower / 1e12,
        confidenceUpper: confidenceUpper / 1e12,
      });
    }

    return data;
  }, [countryData, forecastHorizon]);

  // Generate scenarios
  const scenarios: PredictionScenario[] = useMemo(() => {
    if (!countryData) return [];

    return [
      {
        id: "optimistic",
        name: "Optimistic Growth",
        description: "High economic growth driven by favorable conditions and strong policies",
        probability: 0.25,
        gdpGrowth: (countryData.adjustedGdpGrowth || 0) * 1.3 * 100,
        populationGrowth: (countryData.populationGrowthRate || 0) * 1.2 * 100,
        inflationRate: 2.5,
        unemploymentRate: 4.0,
        confidenceInterval: { lower: 0.85, upper: 1.15 },
        risks: ["Overheating economy", "Asset bubbles", "Environmental degradation"],
        opportunities: ["Rapid development", "High employment", "Strong investment returns"],
        recommendations: [
          "Implement cooling measures if growth exceeds targets",
          "Monitor asset prices and inflation",
          "Invest in sustainable infrastructure",
        ],
      },
      {
        id: "realistic",
        name: "Realistic Baseline",
        description: "Moderate growth based on current trends and policies",
        probability: 0.5,
        gdpGrowth: (countryData.adjustedGdpGrowth || 0) * 100,
        populationGrowth: (countryData.populationGrowthRate || 0) * 100,
        inflationRate: 3.0,
        unemploymentRate: 5.5,
        confidenceInterval: { lower: 0.9, upper: 1.1 },
        risks: ["External economic shocks", "Policy uncertainty", "Demographic challenges"],
        opportunities: ["Stable growth", "Balanced development", "Sustainable progress"],
        recommendations: [
          "Maintain current policy framework",
          "Monitor external risks",
          "Invest in human capital",
        ],
      },
      {
        id: "pessimistic",
        name: "Pessimistic Scenario",
        description: "Lower growth due to adverse conditions or policy failures",
        probability: 0.25,
        gdpGrowth: (countryData.adjustedGdpGrowth || 0) * 0.7 * 100,
        populationGrowth: (countryData.populationGrowthRate || 0) * 0.8 * 100,
        inflationRate: 4.5,
        unemploymentRate: 7.0,
        confidenceInterval: { lower: 0.75, upper: 1.25 },
        risks: ["Economic stagnation", "High unemployment", "Social unrest"],
        opportunities: ["Policy reform", "Structural improvements", "Innovation focus"],
        recommendations: [
          "Implement stimulus measures",
          "Reform economic policies",
          "Address structural issues",
        ],
      },
    ];
  }, [countryData]);

  // Calculate model accuracy metrics
  const modelMetrics = useMemo(() => {
    if (!historicalData || historicalData.length < 10) return null;

    // Simplified accuracy calculation
    const recentData = historicalData.slice(-10);
    const predictions = recentData.map((point: any, index: number) => {
      const actualGdp = point.totalGdp;
      const predictedGdp =
        (countryData?.currentTotalGdp || 0) *
        Math.pow(1 + (countryData?.adjustedGdpGrowth || 0), index);
      return { actual: actualGdp, predicted: predictedGdp };
    });

    const errors = predictions.map((p) => Math.abs(p.actual - p.predicted) / p.actual);
    const meanError = errors.reduce((sum, error) => sum + error, 0) / errors.length;
    const accuracy = Math.max(0, 1 - meanError);

    return {
      accuracy: accuracy * 100,
      confidence: accuracy > 0.8 ? "high" : accuracy > 0.6 ? "medium" : "low",
      lastUpdated: new Date(),
      dataPoints: historicalData.length,
    };
  }, [historicalData, countryData]);

  const getScenarioColor = (scenario: string) => {
    return SCENARIO_COLORS[scenario as keyof typeof SCENARIO_COLORS] || "#6b7280";
  };

  const getConfidenceColor = (confidence: string) => {
    return CONFIDENCE_COLORS[confidence as keyof typeof CONFIDENCE_COLORS] || "#6b7280";
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] max-w-7xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-green-500" />
              Predictive Models - {countryName}
            </DialogTitle>
            <DialogDescription>
              Loading economic forecasts and scenario analysis...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-green-500" />
            Predictive Models - {countryName}
          </DialogTitle>
          <DialogDescription>
            Economic forecasts, scenario analysis, and predictive modeling with confidence intervals
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="metrics">Model Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="forecasts" className="space-y-6">
            {/* Forecast Controls */}
            <GlassCard>
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Economic Forecasts</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Timeframe:</Label>
                      <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1y">1 Year</SelectItem>
                          <SelectItem value="3y">3 Years</SelectItem>
                          <SelectItem value="5y">5 Years</SelectItem>
                          <SelectItem value="10y">10 Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={showConfidenceIntervals}
                        onCheckedChange={setShowConfidenceIntervals}
                      />
                      <Label className="text-sm">Confidence Intervals</Label>
                    </div>
                  </div>
                </div>

                {/* Main Forecast Chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: any) => [`$${value.toFixed(2)}T`, "GDP"]}
                        labelFormatter={(label) => `Year ${label}`}
                      />
                      <Legend />

                      {/* Confidence intervals */}
                      {showConfidenceIntervals && (
                        <Area
                          dataKey="confidenceUpper"
                          stackId="confidence"
                          fill="#3b82f6"
                          fillOpacity={0.1}
                          stroke="none"
                        />
                      )}

                      {/* Scenario lines */}
                      <Line
                        type="monotone"
                        dataKey="optimistic"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Optimistic"
                      />
                      <Line
                        type="monotone"
                        dataKey="realistic"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        name="Realistic"
                      />
                      <Line
                        type="monotone"
                        dataKey="pessimistic"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Pessimistic"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </GlassCard>

            {/* Forecast Summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {scenarios.map((scenario) => (
                <GlassCard key={scenario.id}>
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold">{scenario.name}</h4>
                      <Badge
                        variant="outline"
                        style={{ borderColor: getScenarioColor(scenario.id) }}
                      >
                        {(scenario.probability * 100).toFixed(0)}%
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>GDP Growth:</span>
                        <span className="font-medium">{scenario.gdpGrowth.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Population Growth:</span>
                        <span className="font-medium">{scenario.populationGrowth.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inflation:</span>
                        <span className="font-medium">{scenario.inflationRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unemployment:</span>
                        <span className="font-medium">{scenario.unemploymentRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-6">
            {/* Scenario Analysis */}
            <div className="space-y-4">
              {scenarios.map((scenario) => (
                <GlassCard key={scenario.id}>
                  <div className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{scenario.name}</h3>
                        <p className="text-muted-foreground text-sm">{scenario.description}</p>
                      </div>
                      <Badge
                        variant="outline"
                        style={{ borderColor: getScenarioColor(scenario.id) }}
                      >
                        {(scenario.probability * 100).toFixed(0)}% Probability
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="mb-3 font-medium">Key Metrics</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">GDP Growth Rate:</span>
                            <span className="font-medium">{scenario.gdpGrowth.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Population Growth:</span>
                            <span className="font-medium">
                              {scenario.populationGrowth.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Inflation Rate:</span>
                            <span className="font-medium">
                              {scenario.inflationRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Unemployment Rate:</span>
                            <span className="font-medium">
                              {scenario.unemploymentRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 font-medium">Confidence Interval</h4>
                        <div className="text-muted-foreground text-sm">
                          {scenario.confidenceInterval.lower.toFixed(2)}x -{" "}
                          {scenario.confidenceInterval.upper.toFixed(2)}x
                        </div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 font-medium">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Key Risks
                        </h4>
                        <ul className="space-y-1">
                          {scenario.risks.map((risk, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <ChevronRight className="text-muted-foreground h-3 w-3" />
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="mb-3 flex items-center gap-2 font-medium">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Opportunities
                        </h4>
                        <ul className="space-y-1">
                          {scenario.opportunities.map((opportunity, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <ChevronRight className="text-muted-foreground h-3 w-3" />
                              {opportunity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-medium">
                        <Target className="h-4 w-4 text-blue-500" />
                        Recommendations
                      </h4>
                      <ul className="space-y-1">
                        {scenario.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <ChevronRight className="text-muted-foreground h-3 w-3" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {/* Risk Analysis */}
            <GlassCard>
              <div className="p-6">
                <h3 className="mb-4 text-lg font-semibold">Risk Analysis</h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 font-medium">Scenario Probabilities</h4>
                    <div className="space-y-3">
                      {scenarios.map((scenario) => (
                        <div key={scenario.id} className="flex items-center justify-between">
                          <span className="text-sm">{scenario.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${scenario.probability * 100}%`,
                                  backgroundColor: getScenarioColor(scenario.id),
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {(scenario.probability * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-medium">Growth Projections</h4>
                    <div className="space-y-2">
                      {scenarios.map((scenario) => (
                        <div key={scenario.id} className="flex items-center justify-between">
                          <span className="text-sm">{scenario.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {scenario.gdpGrowth.toFixed(1)}%
                            </span>
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: getScenarioColor(scenario.id) }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            {/* Model Performance Metrics */}
            <GlassCard>
              <div className="p-6">
                <h3 className="mb-4 text-lg font-semibold">Model Performance</h3>

                {modelMetrics ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="text-center">
                      <div
                        className="mb-2 text-3xl font-bold"
                        style={{ color: getConfidenceColor(modelMetrics.confidence) }}
                      >
                        {modelMetrics.accuracy.toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground text-sm">Model Accuracy</div>
                      <Badge
                        variant="outline"
                        className="mt-2"
                        style={{ borderColor: getConfidenceColor(modelMetrics.confidence) }}
                      >
                        {modelMetrics.confidence} confidence
                      </Badge>
                    </div>

                    <div className="text-center">
                      <div className="mb-2 text-3xl font-bold">{modelMetrics.dataPoints}</div>
                      <div className="text-muted-foreground text-sm">Data Points</div>
                    </div>

                    <div className="text-center">
                      <div className="mb-2 text-sm font-medium">
                        {modelMetrics.lastUpdated.toLocaleDateString()}
                      </div>
                      <div className="text-muted-foreground text-sm">Last Updated</div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Info className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-muted-foreground">
                      Insufficient historical data for accuracy metrics
                    </p>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
