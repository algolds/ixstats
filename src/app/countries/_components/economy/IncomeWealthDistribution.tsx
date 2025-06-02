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
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
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
} from 'recharts';
import { formatCurrency, formatPercentage, formatPopulation } from "./utils";
import type { IncomeWealthDistributionData } from "~/types/economics";

interface IncomeWealthDistributionProps {
  incomeData: IncomeWealthDistributionData;
  totalPopulation: number;
  gdpPerCapita: number;
  onIncomeDataChange?: (data: IncomeWealthDistributionData) => void;
  isReadOnly?: boolean;
  showAnalytics?: boolean;
}

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export function IncomeWealthDistribution({
  incomeData,
  totalPopulation,
  gdpPerCapita,
  onIncomeDataChange,
  isReadOnly = true,
  showAnalytics = true,
}: IncomeWealthDistributionProps) {
  const [view, setView] = useState<"overview" | "distribution" | "inequality" | "mobility">("overview");

  // Calculate derived metrics
  const getInequalityRating = (gini: number) => {
    if (gini <= 0.25) return { label: "Very Equal", color: "text-green-600", badge: "bg-green-100" };
    if (gini <= 0.35) return { label: "Moderately Equal", color: "text-blue-600", badge: "bg-blue-100" };
    if (gini <= 0.45) return { label: "Average Inequality", color: "text-yellow-600", badge: "bg-yellow-100" };
    if (gini <= 0.55) return { label: "High Inequality", color: "text-orange-600", badge: "bg-orange-100" };
    return { label: "Extreme Inequality", color: "text-red-600", badge: "bg-red-100" };
  };

  const getMobilityRating = (index: number) => {
    if (index >= 80) return { label: "Very High", color: "text-green-600", badge: "bg-green-100" };
    if (index >= 60) return { label: "High", color: "text-blue-600", badge: "bg-blue-100" };
    if (index >= 40) return { label: "Moderate", color: "text-yellow-600", badge: "bg-yellow-100" };
    if (index >= 20) return { label: "Low", color: "text-orange-600", badge: "bg-orange-100" };
    return { label: "Very Low", color: "text-red-600", badge: "bg-red-100" };
  };

  const inequalityRating = getInequalityRating(incomeData.incomeInequalityGini);
  const mobilityRating = getMobilityRating(incomeData.socialMobilityIndex);

  // Calculate population and wealth by class
  const classMetrics = incomeData.economicClasses.map(cls => ({
    ...cls,
    population: Math.round(totalPopulation * (cls.populationPercent / 100)),
    totalWealth: Math.round(gdpPerCapita * totalPopulation * (cls.wealthPercent / 100)),
  }));

  // Generate Lorenz curve data
  const lorenzCurveData = useMemo(() => {
    const sortedClasses = [...incomeData.economicClasses].sort((a, b) => a.averageIncome - b.averageIncome);
    
    let cumulativePopulation = 0;
    let cumulativeIncome = 0;
    const totalIncome = sortedClasses.reduce((sum, cls) => 
      sum + (cls.averageIncome * cls.populationPercent), 0
    );
    
    const points = [{ x: 0, y: 0 }];
    
    sortedClasses.forEach(cls => {
      cumulativePopulation += cls.populationPercent;
      cumulativeIncome += (cls.averageIncome * cls.populationPercent);
      
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

  const handleClassChange = (index: number, field: keyof typeof incomeData.economicClasses[0], value: number) => {
    if (isReadOnly || !onIncomeDataChange) return;

    const updatedClasses = [...incomeData.economicClasses];
    if (updatedClasses[index]) {
      updatedClasses[index] = { ...updatedClasses[index], [field]: value };
      
      // Normalize percentages if needed
      if (field === 'populationPercent' || field === 'wealthPercent') {
        const total = updatedClasses.reduce((sum, cls) => sum + cls[field], 0);
        if (total !== 100) {
          const factor = 100 / total;
          updatedClasses.forEach(cls => {
            cls[field] = cls[field] * factor;
          });
        }
      }
      
      onIncomeDataChange({
        ...incomeData,
        economicClasses: updatedClasses,
      });
    }
  };

  const handleMetricChange = (field: keyof IncomeWealthDistributionData, value: number) => {
    if (isReadOnly || !onIncomeDataChange || field === 'economicClasses') return;
    
    onIncomeDataChange({
      ...incomeData,
      [field]: value,
    });
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Income & Wealth Distribution
          </h3>
          <p className="text-sm text-muted-foreground">
            Economic inequality and social mobility analysis
          </p>
        </div>
        {showAnalytics && (
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="grid grid-cols-4 w-[480px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="inequality">Inequality</TabsTrigger>
              <TabsTrigger value="mobility">Mobility</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Scale className="h-5 w-5 text-purple-600" />
              <Badge className={`${inequalityRating.badge} ${inequalityRating.color}`}>
                {inequalityRating.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{incomeData.incomeInequalityGini.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Gini Coefficient</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-red-600" />
              <Badge variant="outline" className="text-xs">Poverty</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{incomeData.povertyRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">~{formatPopulation(totalPopulation * (incomeData.povertyRate / 100))}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
              <Badge className={`${mobilityRating.badge} ${mobilityRating.color}`}>
                {mobilityRating.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{incomeData.socialMobilityIndex}</div>
              <div className="text-xs text-muted-foreground">Social Mobility Index</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-xs">Classes</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{incomeData.economicClasses.length}</div>
              <div className="text-xs text-muted-foreground">Economic Classes</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Population Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Population by Class</CardTitle>
              <CardDescription>Distribution of people across economic classes</CardDescription>
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
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {populationPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Wealth Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Wealth by Class</CardTitle>
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
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {wealthPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Economic Classes Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Economic Classes Overview</CardTitle>
            <CardDescription>Detailed breakdown of each economic class</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classMetrics.map((cls, index) => (
                <div key={cls.name} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: cls.color || COLORS[index % COLORS.length] }}
                      />
                      <h4 className="font-medium">{cls.name}</h4>
                    </div>
                    <Badge variant="outline">
                      {formatPopulation(cls.population)} people
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Population Share</div>
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
                      <div className="text-muted-foreground">Income vs GDP/capita</div>
                      <div className="font-medium">{((cls.averageIncome / gdpPerCapita) * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <Label className="text-xs">Population %</Label>
                        <Input
                          type="number"
                          value={cls.populationPercent}
                          onChange={(e) => handleClassChange(index, 'populationPercent', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Wealth %</Label>
                        <Input
                          type="number"
                          value={cls.wealthPercent}
                          onChange={(e) => handleClassChange(index, 'wealthPercent', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Avg Income</Label>
                        <Input
                          type="number"
                          value={cls.averageIncome}
                          onChange={(e) => handleClassChange(index, 'averageIncome', parseFloat(e.target.value) || 0)}
                          step="1000"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="distribution" className="space-y-6">
        {/* Income Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Income Distribution Analysis</CardTitle>
            <CardDescription>Average income and wealth share by economic class</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'income' ? formatCurrency(value) : `${value.toFixed(1)}%`,
                      name === 'income' ? 'Avg Income' : name === 'population' ? 'Population' : 'Wealth Share'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="income" name="Average Income" fill="#3b82f6" />
                  <Bar yAxisId="right" dataKey="wealth" name="Wealth Share %" fill="#10b981" />
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
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="income" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="inequality" className="space-y-6">
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
                    label={{ value: 'Cumulative % of Population', position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis 
                    type="number" 
                    domain={[0, 100]} 
                    label={{ value: 'Cumulative % of Income', angle: -90, position: 'insideLeft' }} 
                  />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Line 
                    data={[{x: 0, y: 0}, {x: 100, y: 100}]} 
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
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                The area between the equality line and the Lorenz curve represents inequality. 
                Gini coefficient: {incomeData.incomeInequalityGini.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inequality Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Inequality Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm">Gini Coefficient</Label>
                  <span className={`text-sm font-medium ${inequalityRating.color}`}>
                    {incomeData.incomeInequalityGini.toFixed(2)}
                  </span>
                </div>
                {!isReadOnly ? (
                  <Input
                    type="number"
                    value={incomeData.incomeInequalityGini}
                    onChange={(e) => handleMetricChange('incomeInequalityGini', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                ) : (
                  <Progress value={incomeData.incomeInequalityGini * 100} className="h-2" />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  0 = Perfect equality, 1 = Perfect inequality
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm">Poverty Rate</Label>
                  <span className="text-sm font-medium">
                    {incomeData.povertyRate.toFixed(1)}%
                  </span>
                </div>
                {!isReadOnly ? (
                  <Input
                    type="number"
                    value={incomeData.povertyRate}
                    onChange={(e) => handleMetricChange('povertyRate', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    max="100"
                  />
                ) : (
                  <Progress value={incomeData.povertyRate} className="h-2" />
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPopulation(totalPopulation * (incomeData.povertyRate / 100))} people below poverty line
                </p>
              </div>

              <div className="p-3 border rounded-lg">
                <h5 className="text-sm font-medium mb-2">Wealth Concentration</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Top 10% wealth share:</span>
                    <span className="font-medium">
                      {incomeData.economicClasses
                        .sort((a, b) => b.averageIncome - a.averageIncome)
                        .slice(0, Math.ceil(incomeData.economicClasses.length * 0.1))
                        .reduce((sum, cls) => sum + cls.wealthPercent, 0)
                        .toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bottom 50% wealth share:</span>
                    <span className="font-medium">
                      {incomeData.economicClasses
                        .sort((a, b) => a.averageIncome - b.averageIncome)
                        .slice(0, Math.ceil(incomeData.economicClasses.length * 0.5))
                        .reduce((sum, cls) => sum + cls.wealthPercent, 0)
                        .toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>International Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Your Country</span>
                  <div className="text-right">
                    <div className="font-medium">{incomeData.incomeInequalityGini.toFixed(2)}</div>
                    <Badge className={`${inequalityRating.badge} ${inequalityRating.color} text-xs`}>
                      {inequalityRating.label}
                    </Badge>
                  </div>
                </div>
                
                {/* Reference countries for comparison */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Nordic Average</span>
                    <span>0.27</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>EU Average</span>
                    <span>0.31</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>OECD Average</span>
                    <span>0.33</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>World Average</span>
                    <span>0.38</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="mobility" className="space-y-6">
        {/* Social Mobility Index */}
        <Card>
          <CardHeader>
            <CardTitle>Social Mobility Analysis</CardTitle>
            <CardDescription>Opportunity for economic advancement across generations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm">Social Mobility Index</Label>
                <Badge className={`${mobilityRating.badge} ${mobilityRating.color}`}>
                  {mobilityRating.label} Mobility
                </Badge>
              </div>
              {!isReadOnly ? (
                <Input
                  type="number"
                  value={incomeData.socialMobilityIndex}
                  onChange={(e) => handleMetricChange('socialMobilityIndex', parseFloat(e.target.value) || 0)}
                  step="1"
                  min="0"
                  max="100"
                />
              ) : (
                <div className="space-y-2">
                  <Progress value={incomeData.socialMobilityIndex} className="h-3" />
                  <div className="text-2xl font-bold">{incomeData.socialMobilityIndex}/100</div>
                </div>
              )}
            </div>

            {/* Mobility Factors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <h5 className="text-sm font-medium mb-2">Contributing Factors</h5>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Education Access</span>
                    <Progress value={incomeData.socialMobilityIndex * 0.9} className="w-20 h-1.5" />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Job Opportunities</span>
                    <Progress value={incomeData.socialMobilityIndex * 0.85} className="w-20 h-1.5" />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Income Equality</span>
                    <Progress value={(1 - incomeData.incomeInequalityGini) * 100} className="w-20 h-1.5" />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Social Programs</span>
                    <Progress value={incomeData.socialMobilityIndex * 0.8} className="w-20 h-1.5" />
                  </div>
                </div>
              </div>

              <div className="p-3 border rounded-lg">
                <h5 className="text-sm font-medium mb-2">Generational Impact</h5>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Bottom to Middle:</span>
                    <div className="font-medium">
                      {incomeData.socialMobilityIndex >= 80 ? "1-2" :
                       incomeData.socialMobilityIndex >= 60 ? "2-3" :
                       incomeData.socialMobilityIndex >= 40 ? "3-4" :
                       incomeData.socialMobilityIndex >= 20 ? "4-5" : "5+"} generations
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Middle to Top:</span>
                    <div className="font-medium">
                      {incomeData.socialMobilityIndex >= 80 ? "2-3" :
                       incomeData.socialMobilityIndex >= 60 ? "3-4" :
                       incomeData.socialMobilityIndex >= 40 ? "4-5" :
                       incomeData.socialMobilityIndex >= 20 ? "5-6" : "6+"} generations
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobility Description */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {incomeData.socialMobilityIndex >= 80 
                  ? "Excellent social mobility. Citizens have strong opportunities to improve their economic status through education and work."
                  : incomeData.socialMobilityIndex >= 60
                  ? "Good social mobility. Most citizens can advance economically with effort and opportunity."
                  : incomeData.socialMobilityIndex >= 40
                  ? "Moderate social mobility. Economic advancement is possible but faces some structural barriers."
                  : incomeData.socialMobilityIndex >= 20
                  ? "Limited social mobility. Significant barriers prevent most from changing economic class."
                  : "Very low social mobility. Economic status is largely determined by birth circumstances."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Policy Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Recommendations</CardTitle>
            <CardDescription>Suggestions to improve income distribution and mobility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {incomeData.incomeInequalityGini > 0.4 && (
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-sm font-medium">High Inequality</h5>
                    <p className="text-xs text-muted-foreground">
                      Consider progressive taxation, minimum wage increases, or wealth redistribution policies.
                    </p>
                  </div>
                </div>
              )}
              
              {incomeData.socialMobilityIndex < 50 && (
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-sm font-medium">Low Social Mobility</h5>
                    <p className="text-xs text-muted-foreground">
                      Invest in public education, job training programs, and reduce barriers to entrepreneurship.
                    </p>
                  </div>
                </div>
              )}
              
              {incomeData.povertyRate > 20 && (
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-sm font-medium">High Poverty Rate</h5>
                    <p className="text-xs text-muted-foreground">
                      Expand social safety nets, create job opportunities, and improve access to basic services.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Summary Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">Income Distribution Summary</div>
          <p className="text-sm mt-1">
            Society has {inequalityRating.label.toLowerCase()} (Gini: {incomeData.incomeInequalityGini.toFixed(2)}) 
            with {incomeData.povertyRate.toFixed(1)}% living in poverty. 
            Social mobility is {mobilityRating.label.toLowerCase()}, 
            {incomeData.socialMobilityIndex >= 60 
              ? " allowing citizens good opportunities for economic advancement."
              : " presenting challenges for economic advancement across generations."}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}