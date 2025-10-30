// src/app/countries/_components/economy/IncomeWealthDistribution.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Scale,
  Users,
  TrendingUp,
  DollarSign,
  BarChart3,
  Info,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Eye,
  Pencil,
  HelpCircle,
  Activity,
  Home,
  Banknote,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
  ScatterChart,
  Scatter,
} from "recharts";
import { formatCurrency, formatPercentage, formatPopulation } from "./utils";
import type { IncomeWealthDistributionData } from "~/types/economics";

export interface RealCountryData {
  name: string;
  incomeInequalityGini?: number;
  povertyRate?: number;
}

interface IncomeWealthDistributionProps {
  incomeData: IncomeWealthDistributionData;
  referenceCountry?: RealCountryData;
  totalPopulation: number;
  gdpPerCapita: number;
  /** SERVER ACTION */
  onIncomeDataChangeAction: (data: IncomeWealthDistributionData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

export function IncomeWealthDistribution({
  incomeData,
  referenceCountry,
  totalPopulation,
  gdpPerCapita,
  onIncomeDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: IncomeWealthDistributionProps) {
  const [view, setView] = useState<"overview" | "detailed">("overview");
  const [editMode, setEditMode] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("distribution");

  // Health assessment functions
  function getInequalityHealth() {
    const gini = incomeData.incomeInequalityGini;
    if (gini <= 0.25)
      return { label: "Very Equal", color: "text-green-600", variant: "default" as const };
    if (gini <= 0.35)
      return { label: "Moderately Equal", color: "text-blue-600", variant: "secondary" as const };
    if (gini <= 0.45)
      return {
        label: "Average Inequality",
        color: "text-yellow-600",
        variant: "destructive" as const,
      };
    if (gini <= 0.55)
      return {
        label: "High Inequality",
        color: "text-orange-600",
        variant: "destructive" as const,
      };
    return { label: "Extreme Inequality", color: "text-red-600", variant: "destructive" as const };
  }

  function getMobilityHealth() {
    const index = incomeData.socialMobilityIndex;
    if (index >= 80) return { label: "Very High", color: "text-green-600" };
    if (index >= 60) return { label: "High", color: "text-blue-600" };
    if (index >= 40) return { label: "Moderate", color: "text-yellow-600" };
    if (index >= 20) return { label: "Low", color: "text-orange-600" };
    return { label: "Very Low", color: "text-red-600" };
  }

  function getPovertyHealth() {
    const rate = incomeData.povertyRate;
    if (rate <= 5) return { label: "Very Low", color: "text-green-600" };
    if (rate <= 10) return { label: "Low", color: "text-blue-600" };
    if (rate <= 20) return { label: "Moderate", color: "text-yellow-600" };
    if (rate <= 30) return { label: "High", color: "text-orange-600" };
    return { label: "Very High", color: "text-red-600" };
  }

  const inequalityHealth = getInequalityHealth();
  const mobilityHealth = getMobilityHealth();
  const povertyHealth = getPovertyHealth();

  // Handler functions
  function handleField<K extends keyof IncomeWealthDistributionData>(
    field: K,
    value: number | any
  ) {
    const next = { ...incomeData, [field]: value };
    onIncomeDataChangeAction(next);
  }

  /**
   * Handles changes to economic class data with proper type safety
   * @param index - Index of the economic class to update
   * @param field - Field name to update
   * @param value - New value for the field
   */
  function handleClassChange(
    index: number,
    field: keyof (typeof incomeData.economicClasses)[0],
    value: number
  ) {
    if (index >= incomeData.economicClasses.length) return;

    const updatedClasses = [...incomeData.economicClasses];
    const currentClass = updatedClasses[index];
    if (!currentClass) return;

    // Ensure all required properties are maintained when updating
    updatedClasses[index] = {
      name: currentClass.name,
      populationPercent: field === "populationPercent" ? value : currentClass.populationPercent,
      wealthPercent: field === "wealthPercent" ? value : currentClass.wealthPercent,
      averageIncome: field === "averageIncome" ? value : currentClass.averageIncome,
      color: currentClass.color,
    };

    // Normalize percentages if needed
    if (field === "populationPercent" || field === "wealthPercent") {
      const total = updatedClasses.reduce((sum, cls) => sum + cls[field], 0);
      if (total !== 100 && total > 0) {
        const factor = 100 / total;
        updatedClasses.forEach((cls) => {
          cls[field] = cls[field] * factor;
        });
      }
    }

    onIncomeDataChangeAction({
      ...incomeData,
      economicClasses: updatedClasses,
    });
  }

  // Calculate derived metrics
  const classMetrics = incomeData.economicClasses.map((cls) => ({
    ...cls,
    population: Math.round(totalPopulation * (cls.populationPercent / 100)),
    totalWealth: Math.round(gdpPerCapita * totalPopulation * (cls.wealthPercent / 100)),
  }));

  // Generate Lorenz curve data
  const lorenzCurveData = useMemo(() => {
    const sortedClasses = [...incomeData.economicClasses].sort(
      (a, b) => a.averageIncome - b.averageIncome
    );

    let cumulativePopulation = 0;
    let cumulativeIncome = 0;
    const totalIncome = sortedClasses.reduce(
      (sum, cls) => sum + cls.averageIncome * cls.populationPercent,
      0
    );

    const points = [{ x: 0, y: 0 }];

    sortedClasses.forEach((cls) => {
      cumulativePopulation += cls.populationPercent;
      cumulativeIncome += cls.averageIncome * cls.populationPercent;

      points.push({
        x: cumulativePopulation,
        y: (cumulativeIncome / totalIncome) * 100,
      });
    });

    return points;
  }, [incomeData.economicClasses]);

  // Decile distribution for more detailed analysis
  const decileData = useMemo(() => {
    const deciles = [];
    for (let i = 1; i <= 10; i++) {
      const percentile = i * 10;
      // Simplified calculation - in real app would use actual distribution
      const income = gdpPerCapita * (0.2 + (i / 10) * 1.8);
      deciles.push({
        decile: `D${i}`,
        percentile,
        income,
        share: i <= 3 ? 5 : i <= 7 ? 10 : i === 10 ? 25 : 15,
      });
    }
    return deciles;
  }, [gdpPerCapita]);

  // Key metrics for overview
  const keyMetrics = [
    {
      label: "Gini Coefficient",
      field: "incomeInequalityGini" as const,
      value: incomeData.incomeInequalityGini,
      target: 0.35,
      reverse: true,
      description: "0 = Perfect equality, 1 = Perfect inequality",
      icon: Scale,
      format: (v: number) => v.toFixed(2),
    },
    {
      label: "Poverty Rate",
      field: "povertyRate" as const,
      value: incomeData.povertyRate,
      target: 10,
      reverse: true,
      description: "% below poverty line",
      icon: Users,
      format: (v: number) => formatPercentage(v),
    },
    {
      label: "Social Mobility",
      field: "socialMobilityIndex" as const,
      value: incomeData.socialMobilityIndex,
      target: 70,
      reverse: false,
      description: "Economic opportunity index (0-100)",
      icon: ArrowUpRight,
      format: (v: number) => v.toString(),
    },
  ];

  // Prepare visualization data
  const populationPieData = incomeData.economicClasses.map((cls, index) => ({
    name: cls.name,
    value: cls.populationPercent,
    color: cls.color || COLORS[index % COLORS.length],
  }));

  const wealthPieData = incomeData.economicClasses.map((cls, index) => ({
    name: cls.name,
    value: cls.wealthPercent,
    color: cls.color || COLORS[index % COLORS.length],
  }));

  const incomeBarData = incomeData.economicClasses.map((cls, index) => ({
    name: cls.name,
    income: cls.averageIncome,
    population: cls.populationPercent,
    wealth: cls.wealthPercent,
    color: cls.color || COLORS[index % COLORS.length],
  }));

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Scale className="text-primary h-5 w-5" />
              Income & Wealth Distribution
            </h3>
            <p className="text-muted-foreground text-sm">
              Economic inequality and social mobility analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Eye className="mr-1 h-4 w-4" /> : <Pencil className="mr-1 h-4 w-4" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="detailed">Detailed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Health Status */}
        <Alert
          className={`border-l-4 ${
            inequalityHealth.color === "text-green-600"
              ? "border-l-green-500"
              : inequalityHealth.color === "text-blue-600"
                ? "border-l-blue-500"
                : inequalityHealth.color === "text-yellow-600"
                  ? "border-l-yellow-500"
                  : "border-l-red-500"
          }`}
        >
          <Scale className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Income Inequality:{" "}
              <span className={`font-semibold ${inequalityHealth.color}`}>
                {inequalityHealth.label}
              </span>
              <span className="ml-4">
                Social Mobility:{" "}
                <span className={`font-semibold ${mobilityHealth.color}`}>
                  {mobilityHealth.label}
                </span>
              </span>
            </span>
            <Badge variant={povertyHealth.color === "text-green-600" ? "default" : "destructive"}>
              {formatPercentage(incomeData.povertyRate)} in Poverty
            </Badge>
          </AlertDescription>
        </Alert>

        {/* Economic Classes Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="text-primary h-4 w-4" />
              Economic Classes Distribution
            </CardTitle>
            <CardDescription>
              Population and wealth distribution across economic classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              {classMetrics.map((cls, index) => (
                <div key={cls.name} className="bg-muted/30 rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: cls.color || COLORS[index % COLORS.length] }}
                      />
                      <h4 className="font-medium">{cls.name}</h4>
                    </div>
                    <Badge variant="outline">{formatPopulation(cls.population)} people</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground">Population</div>
                      <div className="font-medium">{cls.populationPercent.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Wealth Share</div>
                      <div className="font-medium">{cls.wealthPercent.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg Income</div>
                      <div className="font-medium">{formatCurrency(cls.averageIncome)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">vs GDP/capita</div>
                      <div className="font-medium">
                        {((cls.averageIncome / gdpPerCapita) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Overview Tab */}
        {view === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {keyMetrics.map((metric) => {
                const Icon = metric.icon;
                const progress = metric.reverse
                  ? Math.max(0, 100 - (metric.value / metric.target) * 100)
                  : Math.min(100, (metric.value / metric.target) * 100);

                return (
                  <Card key={metric.field}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="text-primary h-4 w-4" />
                          <span className="text-sm font-medium">{metric.label}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="text-muted-foreground h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{metric.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{metric.format(metric.value)}</span>
                          {editMode ? (
                            <Input
                              type="number"
                              value={metric.value}
                              onChange={(e) =>
                                handleField(metric.field, parseFloat(e.target.value) || 0)
                              }
                              className="h-8 w-20 text-right"
                              step={metric.field === "incomeInequalityGini" ? "0.01" : "0.1"}
                              min="0"
                              max={metric.field === "incomeInequalityGini" ? "1" : "100"}
                            />
                          ) : (
                            <Badge
                              variant={
                                progress >= 80
                                  ? "default"
                                  : progress >= 60
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {progress >= 80 ? "Good" : progress >= 60 ? "Fair" : "Poor"}
                            </Badge>
                          )}
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="text-muted-foreground text-xs">
                          Target: {metric.format(metric.target)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Population Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Population by Class</CardTitle>
                  <CardDescription>Share of people in each economic class</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={populationPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }: any) =>
                            `${name}: ${percent ? (percent * 100).toFixed(1) : "0"}%`
                          }
                        >
                          {populationPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Wealth Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Wealth by Class</CardTitle>
                  <CardDescription>Share of total wealth held by each class</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={wealthPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }: any) =>
                            `${name}: ${percent ? (percent * 100).toFixed(1) : "0"}%`
                          }
                        >
                          {wealthPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparison with Reference Country */}
            {showComparison && referenceCountry && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Comparison with {referenceCountry.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {referenceCountry.incomeInequalityGini && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Gini Coefficient:</span>
                        <div className="space-x-2">
                          <Badge variant="outline">
                            {referenceCountry.incomeInequalityGini.toFixed(2)}
                          </Badge>
                          <span>vs</span>
                          <Badge
                            variant={
                              incomeData.incomeInequalityGini <=
                              referenceCountry.incomeInequalityGini
                                ? "default"
                                : "secondary"
                            }
                          >
                            {incomeData.incomeInequalityGini.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {referenceCountry.povertyRate && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Poverty Rate:</span>
                        <div className="space-x-2">
                          <Badge variant="outline">
                            {formatPercentage(referenceCountry.povertyRate)}
                          </Badge>
                          <span>vs</span>
                          <Badge
                            variant={
                              incomeData.povertyRate <= referenceCountry.povertyRate
                                ? "default"
                                : "secondary"
                            }
                          >
                            {formatPercentage(incomeData.povertyRate)}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Detailed Tab */}
        {view === "detailed" && (
          <div className="space-y-6">
            <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
                <TabsTrigger value="inequality">Inequality</TabsTrigger>
                <TabsTrigger value="mobility">Mobility</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
              </TabsList>

              <TabsContent value="distribution" className="space-y-4">
                {/* Income Distribution Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Income Distribution Analysis</CardTitle>
                    <CardDescription>
                      Average income and wealth share by economic class
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={incomeBarData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" orientation="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <RechartsTooltip
                            formatter={(value: number, name: string) => [
                              name === "income" ? formatCurrency(value) : `${value.toFixed(1)}%`,
                              name === "income"
                                ? "Avg Income"
                                : name === "population"
                                  ? "Population"
                                  : "Wealth Share",
                            ]}
                          />
                          <Legend />
                          <Bar
                            yAxisId="left"
                            dataKey="income"
                            name="Average Income"
                            fill="#3b82f6"
                          />
                          <Bar
                            yAxisId="right"
                            dataKey="wealth"
                            name="Wealth Share %"
                            fill="#10b981"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Decile Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Income by Decile</CardTitle>
                    <CardDescription>Distribution across population deciles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={decileData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="decile" />
                          <YAxis />
                          <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                          <Area
                            type="monotone"
                            dataKey="income"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            fillOpacity={0.6}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inequality" className="space-y-4">
                {/* Lorenz Curve */}
                <Card>
                  <CardHeader>
                    <CardTitle>Lorenz Curve</CardTitle>
                    <CardDescription>Visual representation of income inequality</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            label={{
                              value: "Cumulative % of Population",
                              position: "insideBottom",
                              offset: -5,
                            }}
                          />
                          <YAxis
                            type="number"
                            domain={[0, 100]}
                            label={{
                              value: "Cumulative % of Income",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line
                            data={[
                              { x: 0, y: 0 },
                              { x: 100, y: 100 },
                            ]}
                            type="linear"
                            dataKey="y"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            name="Perfect Equality"
                            dot={false}
                          />
                          <Line
                            data={lorenzCurveData}
                            type="monotone"
                            dataKey="y"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            name="Actual Distribution"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-muted/50 mt-4 rounded-lg p-3">
                      <p className="text-muted-foreground text-sm">
                        The area between the equality line and the Lorenz curve represents
                        inequality. Gini coefficient: {incomeData.incomeInequalityGini.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Inequality Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Inequality Indicators</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-sm">Gini Coefficient</Label>
                        <span className={`text-sm font-medium ${inequalityHealth.color}`}>
                          {incomeData.incomeInequalityGini.toFixed(2)}
                        </span>
                      </div>
                      {editMode ? (
                        <Slider
                          value={[incomeData.incomeInequalityGini * 100]}
                          onValueChange={([value]) =>
                            handleField("incomeInequalityGini", (value ?? 0) / 100)
                          }
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      ) : (
                        <Progress value={incomeData.incomeInequalityGini * 100} className="h-2" />
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        0 = Perfect equality, 1 = Perfect inequality
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-sm">Poverty Rate</Label>
                        <span className="text-sm font-medium">
                          {incomeData.povertyRate.toFixed(1)}%
                        </span>
                      </div>
                      {editMode ? (
                        <Slider
                          value={[incomeData.povertyRate]}
                          onValueChange={([value]) => handleField("povertyRate", value)}
                          max={50}
                          step={0.1}
                          className="w-full"
                        />
                      ) : (
                        <Progress value={incomeData.povertyRate * 2} className="h-2" />
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatPopulation(totalPopulation * (incomeData.povertyRate / 100))} people
                        below poverty line
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mobility" className="space-y-4">
                {/* Social Mobility Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Social Mobility Analysis</CardTitle>
                    <CardDescription>
                      Opportunity for economic advancement across generations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-sm">Social Mobility Index</Label>
                        <Badge
                          className={`${mobilityHealth.color.replace("text-", "bg-").replace("600", "100")}`}
                        >
                          {mobilityHealth.label} Mobility
                        </Badge>
                      </div>
                      {editMode ? (
                        <Slider
                          value={[incomeData.socialMobilityIndex]}
                          onValueChange={([value]) => handleField("socialMobilityIndex", value)}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      ) : (
                        <div className="space-y-2">
                          <Progress value={incomeData.socialMobilityIndex} className="h-3" />
                          <div className="text-2xl font-bold">
                            {incomeData.socialMobilityIndex}/100
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobility Factors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3">
                        <h5 className="mb-2 text-sm font-medium">Contributing Factors</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Education Access</span>
                            <Progress
                              value={incomeData.socialMobilityIndex * 0.9}
                              className="h-1.5 w-20"
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Job Opportunities</span>
                            <Progress
                              value={incomeData.socialMobilityIndex * 0.85}
                              className="h-1.5 w-20"
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Income Equality</span>
                            <Progress
                              value={(1 - incomeData.incomeInequalityGini) * 100}
                              className="h-1.5 w-20"
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Social Programs</span>
                            <Progress
                              value={incomeData.socialMobilityIndex * 0.8}
                              className="h-1.5 w-20"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border p-3">
                        <h5 className="mb-2 text-sm font-medium">Generational Impact</h5>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Bottom to Middle:</span>
                            <div className="font-medium">
                              {incomeData.socialMobilityIndex >= 80
                                ? "1-2"
                                : incomeData.socialMobilityIndex >= 60
                                  ? "2-3"
                                  : incomeData.socialMobilityIndex >= 40
                                    ? "3-4"
                                    : incomeData.socialMobilityIndex >= 20
                                      ? "4-5"
                                      : "5+"}{" "}
                              generations
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Middle to Top:</span>
                            <div className="font-medium">
                              {incomeData.socialMobilityIndex >= 80
                                ? "2-3"
                                : incomeData.socialMobilityIndex >= 60
                                  ? "3-4"
                                  : incomeData.socialMobilityIndex >= 40
                                    ? "4-5"
                                    : incomeData.socialMobilityIndex >= 20
                                      ? "5-6"
                                      : "6+"}{" "}
                              generations
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="classes" className="space-y-4">
                {/* Economic Classes Editor */}
                <Card>
                  <CardHeader>
                    <CardTitle>Economic Classes Configuration</CardTitle>
                    <CardDescription>
                      Adjust population and wealth distribution by class
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {incomeData.economicClasses.map((cls, index) => (
                        <div key={cls.name} className="bg-muted/30 rounded-lg border p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="h-4 w-4 rounded-full"
                                style={{
                                  backgroundColor: cls.color || COLORS[index % COLORS.length],
                                }}
                              />
                              <h4 className="font-medium">{cls.name}</h4>
                            </div>
                            <Badge variant="outline">
                              {formatPopulation(classMetrics[index]?.population || 0)} people
                            </Badge>
                          </div>

                          {editMode ? (
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Population %</Label>
                                <Input
                                  type="number"
                                  value={cls.populationPercent}
                                  onChange={(e) =>
                                    handleClassChange(
                                      index,
                                      "populationPercent",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Wealth %</Label>
                                <Input
                                  type="number"
                                  value={cls.wealthPercent}
                                  onChange={(e) =>
                                    handleClassChange(
                                      index,
                                      "wealthPercent",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Avg Income</Label>
                                <Input
                                  type="number"
                                  value={cls.averageIncome}
                                  onChange={(e) =>
                                    handleClassChange(
                                      index,
                                      "averageIncome",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  step="1000"
                                  className="h-8"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                              <div>
                                <div className="text-muted-foreground">Population Share</div>
                                <div className="font-medium">
                                  {cls.populationPercent.toFixed(1)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Wealth Share</div>
                                <div className="font-medium">{cls.wealthPercent.toFixed(1)}%</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Avg Income</div>
                                <div className="font-medium">
                                  {formatCurrency(cls.averageIncome)}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Income vs GDP/capita</div>
                                <div className="font-medium">
                                  {((cls.averageIncome / gdpPerCapita) * 100).toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Summary Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Income Distribution Summary</div>
            <p className="mt-1 text-sm">
              Society has {inequalityHealth.label.toLowerCase()} (Gini:{" "}
              {incomeData.incomeInequalityGini.toFixed(2)}) with {incomeData.povertyRate.toFixed(1)}
              % living in poverty. Social mobility is {mobilityHealth.label.toLowerCase()},
              {incomeData.socialMobilityIndex >= 60
                ? " allowing citizens good opportunities for economic advancement."
                : " presenting challenges for economic advancement across generations."}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}
