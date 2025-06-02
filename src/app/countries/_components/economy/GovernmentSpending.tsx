// src/app/countries/_components/economy/GovernmentSpending.tsx
"use client";

import React, { useState } from "react";
import {
  Building2,
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  Briefcase,
  MoreHorizontal,
  Info,
  BarChart2,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calculator,
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
  PieChart as RechartsPieChart,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { formatCurrency, formatPercentage, calculateBudgetHealth } from "./utils";
import type { GovernmentSpendingData } from "~/types/economics";

interface GovernmentSpendingProps {
  spendingData: GovernmentSpendingData;
  nominalGDP: number;
  totalPopulation: number;
  onSpendingDataChangeAction?: (data: GovernmentSpendingData) => void;
  isReadOnly?: boolean;
  showAnalytics?: boolean;
}

// Icon mapping for spending categories
const categoryIcons: Record<string, React.ElementType> = {
  Defense: Shield,
  Education: GraduationCap,
  Healthcare: Heart,
  Infrastructure: Truck,
  "Social Services": Users2,
  "Social Security": Users2,
  Other: MoreHorizontal,
};

const COLORS = ['#8b5cf6', '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#6b7280'];

export function GovernmentSpending({
  spendingData,
  nominalGDP,
  totalPopulation,
  onSpendingDataChangeAction,
  isReadOnly = true,
  showAnalytics = true,
}: GovernmentSpendingProps) {
  const [view, setView] = useState<"overview" | "breakdown" | "efficiency" | "comparison">("overview");

  const budgetHealth = calculateBudgetHealth({
    budgetDeficitSurplus: spendingData.deficitSurplus,
    nominalGDP: nominalGDP,
  });

  const handleCategoryPercentChange = (index: number, newPercent: number) => {
    if (isReadOnly || !onSpendingDataChangeAction) return;

    const categories = [...spendingData.spendingCategories];
    const totalOthers = categories.reduce((sum, cat, idx) => 
      idx !== index ? sum + cat.percent : sum, 0
    );
    
    const adjustedPercent = Math.min(newPercent, 100 - totalOthers);
    
    if (categories[index]) {
      categories[index] = {
        ...categories[index],
        percent: adjustedPercent,
        amount: (spendingData.totalSpending * adjustedPercent) / 100,
      };
      
      // Normalize other categories
      const remainingPercent = 100 - adjustedPercent;
      if (totalOthers > 0) {
        categories.forEach((cat, idx) => {
          if (idx !== index) {
            cat.percent = (cat.percent / totalOthers) * remainingPercent;
            cat.amount = (spendingData.totalSpending * cat.percent) / 100;
          }
        });
      }
      
      onSpendingDataChangeAction({
        ...spendingData,
        spendingCategories: categories,
      });
    }
  };

  // Calculate metrics
  const largestCategory = spendingData.spendingCategories.reduce((max, cat) => 
    cat.percent > max.percent ? cat : max, spendingData.spendingCategories[0]
  );

  const getPerCapitaSpending = (amount: number) => amount / totalPopulation;

  // Prepare data for visualizations
  const pieData = spendingData.spendingCategories.map((cat, index) => ({
    name: cat.category,
    value: cat.percent,
    amount: cat.amount,
    color: cat.color || COLORS[index % COLORS.length],
  }));

  const barData = spendingData.spendingCategories.map((cat, index) => ({
    category: cat.category,
    amount: cat.amount,
    perCapita: getPerCapitaSpending(cat.amount),
    percent: cat.percent,
    color: cat.color || COLORS[index % COLORS.length],
  }));

  // Efficiency metrics (example calculations)
  const efficiencyMetrics = spendingData.spendingCategories.map(cat => ({
    category: cat.category,
    efficiency: Math.min(100, (cat.percent / 20) * 100), // Simplified efficiency score
    benchmark: 85, // Example benchmark
  }));

  // Radar chart data for spending priorities
  const radarData = spendingData.spendingCategories.map(cat => ({
    category: cat.category,
    actual: cat.percent,
    optimal: 100 / spendingData.spendingCategories.length, // Equal distribution as baseline
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Government Spending
          </h3>
          <p className="text-sm text-muted-foreground">
            Budget allocation and spending priorities
          </p>
        </div>
        {showAnalytics && (
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="grid grid-cols-4 w-[480px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
              <TabsTrigger value="comparison">Analysis</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-xs">Total</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatCurrency(spendingData.totalSpending)}</div>
              <div className="text-xs text-muted-foreground">{spendingData.spendingGDPPercent.toFixed(1)}% of GDP</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users2 className="h-5 w-5 text-purple-600" />
              <Badge variant="outline" className="text-xs">Per Capita</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatCurrency(spendingData.spendingPerCapita)}</div>
              <div className="text-xs text-muted-foreground">per person</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              {spendingData.deficitSurplus >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <Badge className={budgetHealth.color.replace('text-', 'bg-').replace('600', '100')} variant="secondary">
                {budgetHealth.label}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className={`text-2xl font-bold ${budgetHealth.color}`}>
                {formatCurrency(Math.abs(spendingData.deficitSurplus))}
              </div>
              <div className="text-xs text-muted-foreground">
                {spendingData.deficitSurplus >= 0 ? 'Budget Surplus' : 'Budget Deficit'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart2 className="h-5 w-5 text-orange-600" />
              <Badge variant="outline" className="text-xs">Priority</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold">{largestCategory?.category || 'N/A'}</div>
              <div className="text-xs text-muted-foreground">
                {largestCategory?.percent.toFixed(1)}% of budget
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spending Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Distribution</CardTitle>
              <CardDescription>Budget allocation by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${percent.toFixed(1)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Percent']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Spending Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Summary</CardTitle>
              <CardDescription>Key allocations and amounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {spendingData.spendingCategories.map((cat, index) => {
                const Icon = categoryIcons[cat.category] || MoreHorizontal;
                return (
                  <div key={cat.category} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md" style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] + '20' }}>
                        <Icon className="h-4 w-4" style={{ color: cat.color || COLORS[index % COLORS.length] }} />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{cat.category}</div>
                        <div className="text-xs text-muted-foreground">{cat.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">{formatCurrency(cat.amount)}</div>
                      <div className="text-xs text-muted-foreground">{cat.percent.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="breakdown" className="space-y-6">
        {/* Detailed Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Spending Breakdown</CardTitle>
            <CardDescription>Category-wise allocation with per capita analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'amount' ? formatCurrency(value) : 
                      name === 'perCapita' ? formatCurrency(value) :
                      `${value.toFixed(1)}%`, 
                      name === 'amount' ? 'Total' : 
                      name === 'perCapita' ? 'Per Capita' : 'Percent'
                    ]} 
                  />
                  <Legend />
                  <Bar dataKey="amount" name="Total Amount" fill="#3b82f6" />
                  <Bar dataKey="perCapita" name="Per Capita" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spendingData.spendingCategories.map((cat, index) => {
            const Icon = categoryIcons[cat.category] || MoreHorizontal;
            return (
              <Card key={cat.category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: cat.color || COLORS[index % COLORS.length] }} />
                    {cat.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Percent of Budget:</span>
                    <span className="font-medium">{cat.percent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Per Capita:</span>
                    <span className="font-medium">{formatCurrency(getPerCapitaSpending(cat.amount))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">% of GDP:</span>
                    <span className="font-medium">{((cat.amount / nominalGDP) * 100).toFixed(2)}%</span>
                  </div>
                  {!isReadOnly && (
                    <div className="pt-2">
                      <Label className="text-xs">Adjust Percentage</Label>
                      <Input
                        type="number"
                        value={cat.percent}
                        onChange={(e) => handleCategoryPercentChange(index, parseFloat(e.target.value) || 0)}
                        step="0.1"
                        min="0"
                        max="100"
                        className="mt-1"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="efficiency" className="space-y-6">
        {/* Efficiency Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Efficiency Analysis</CardTitle>
            <CardDescription>Performance metrics by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {efficiencyMetrics.map((metric, index) => {
                const Icon = categoryIcons[metric.category] || MoreHorizontal;
                const isEfficient = metric.efficiency >= metric.benchmark;
                
                return (
                  <div key={metric.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{metric.category}</span>
                      </div>
                      <Badge className={isEfficient ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                        {isEfficient ? "Efficient" : "Review Needed"}
                      </Badge>
                    </div>
                    <div className="relative">
                      <Progress value={metric.efficiency} className="h-2" />
                      <div 
                        className="absolute top-0 h-2 w-0.5 bg-red-600" 
                        style={{ left: `${metric.benchmark}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Efficiency: {metric.efficiency.toFixed(0)}%</span>
                      <span>Benchmark: {metric.benchmark}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Spending Priorities Radar */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Priorities</CardTitle>
            <CardDescription>Actual vs optimal distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis angle={90} domain={[0, Math.max(...radarData.map(d => Math.max(d.actual, d.optimal)))]} />
                  <Radar name="Actual" dataKey="actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Radar name="Equal Distribution" dataKey="optimal" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="comparison" className="space-y-6">
        {/* Analysis and Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Analysis</CardTitle>
            <CardDescription>Key insights and recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Budget Balance Analysis */}
            <div className="p-4 border rounded-lg">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Budget Balance
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={budgetHealth.color.replace('text-', 'bg-').replace('600', '100')}>
                    {budgetHealth.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {spendingData.deficitSurplus >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(spendingData.deficitSurplus))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {spendingData.deficitSurplus >= 0 
                    ? "Budget surplus allows for debt reduction or increased investment."
                    : "Budget deficit may require revenue increases or spending cuts."}
                </p>
              </div>
            </div>

            {/* Spending Priorities */}
            <div className="p-4 border rounded-lg">
              <h4 className="text-sm font-semibold mb-2">Spending Priorities</h4>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Highest allocation: <span className="font-medium">{largestCategory?.category}</span> at {largestCategory?.percent.toFixed(1)}% of budget
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    <span>Education: {spendingData.spendingCategories.find(c => c.category === 'Education')?.percent.toFixed(1) || 0}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    <span>Healthcare: {spendingData.spendingCategories.find(c => c.category === 'Healthcare')?.percent.toFixed(1) || 0}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>Defense: {spendingData.spendingCategories.find(c => c.category === 'Defense')?.percent.toFixed(1) || 0}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    <span>Infrastructure: {spendingData.spendingCategories.find(c => c.category === 'Infrastructure')?.percent.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="p-4 border rounded-lg">
              <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {spendingData.spendingGDPPercent > 30 && (
                  <li>• Consider efficiency improvements to reduce spending-to-GDP ratio</li>
                )}
                {spendingData.spendingCategories.find(c => c.category === 'Education' && c.percent < 15) && (
                  <li>• Education spending below recommended 15% minimum</li>
                )}
                {spendingData.spendingCategories.find(c => c.category === 'Healthcare' && c.percent < 10) && (
                  <li>• Healthcare allocation may be insufficient for population needs</li>
                )}
                {spendingData.deficitSurplus < 0 && Math.abs(spendingData.deficitSurplus) > nominalGDP * 0.03 && (
                  <li>• Deficit exceeds 3% of GDP - fiscal consolidation recommended</li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Summary Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">Spending Summary</div>
          <p className="text-sm mt-1">
            Government spends {formatCurrency(spendingData.totalSpending)} ({spendingData.spendingGDPPercent.toFixed(1)}% of GDP), 
            with the highest allocation to {largestCategory?.category} ({largestCategory?.percent.toFixed(1)}%). 
            The budget is {spendingData.deficitSurplus >= 0 ? 'in surplus' : 'in deficit'} by {formatCurrency(Math.abs(spendingData.deficitSurplus))}.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}