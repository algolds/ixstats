// src/app/countries/_components/economy/GovernmentSpending.tsx
"use client";

import { useState } from "react";
import {
  Building,
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  Briefcase,
  Globe,
  Scale,
  BarChart2,
  Info,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export interface SpendingCategory {
  category: string;
  amount: number;
  percent: number;
  icon: React.ElementType;
  color: string;
  description: string;
}

export interface GovernmentSpendingData {
  totalGovernmentSpending: number;
  spendingGDPPercent: number;
  spendingPerCapita: number;
  spendingCategories: SpendingCategory[];
  budgetDeficitSurplus: number;
}

export interface RealCountrySpendingData {
  name: string;
  spendingGDPPercent: number;
}

interface GovernmentSpendingProps {
  spendingData: GovernmentSpendingData;
  referenceCountry?: RealCountrySpendingData;
  nominalGDP: number;
  totalPopulation: number;
  onSpendingDataChangeAction: (spendingData: GovernmentSpendingData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function GovernmentSpending({
  spendingData,
  referenceCountry,
  nominalGDP,
  totalPopulation,
  onSpendingDataChangeAction,
  isReadOnly = false,
  showComparison = true,
}: GovernmentSpendingProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'comparison'>('overview');

  const handleSpendingPercentChange = (index: number, value: number) => {
    const newCategories = [...spendingData.spendingCategories];
    
    // Calculate the total of all other percentages
    const totalOthers = newCategories.reduce((sum, cat, idx) => 
      idx !== index ? sum + cat.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newCategories[index]) {
      newCategories[index] = {
        ...newCategories[index],
        percent: adjustedValue,
        amount: (spendingData.totalGovernmentSpending * adjustedValue) / 100
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedCategories = newCategories.map((cat, idx) => {
        if (idx === index) return cat;
        
        const normalizedPercent = (cat.percent / totalOthers) * remainingPercent;
        return {
          ...cat,
          percent: normalizedPercent,
          amount: (spendingData.totalGovernmentSpending * normalizedPercent) / 100
        };
      });
      
      onSpendingDataChangeAction({
        ...spendingData,
        spendingCategories: normalizedCategories
      });
    }
  };

  const handleTotalSpendingChange = (value: number) => {
    const newSpendingData = { ...spendingData };
    newSpendingData.totalGovernmentSpending = value;
    newSpendingData.spendingGDPPercent = (value / nominalGDP) * 100;
    newSpendingData.spendingPerCapita = value / totalPopulation;
    
    // Update amounts for all categories
    newSpendingData.spendingCategories = spendingData.spendingCategories.map(cat => ({
      ...cat,
      amount: (value * cat.percent) / 100
    }));
    
    onSpendingDataChangeAction(newSpendingData);
  };

  const handleSpendingGDPPercentChange = (value: number) => {
    const newTotalSpending = (nominalGDP * value) / 100;
    handleTotalSpendingChange(newTotalSpending);
  };

  const getBudgetHealth = () => {
    const deficit = spendingData.budgetDeficitSurplus;
    const deficitPercent = (deficit / nominalGDP) * 100;
    
    if (deficitPercent > 1) return { color: "text-green-600", label: "Surplus" };
    if (deficitPercent > -2) return { color: "text-blue-600", label: "Balanced" };
    if (deficitPercent > -5) return { color: "text-yellow-600", label: "Moderate Deficit" };
    return { color: "text-red-600", label: "High Deficit" };
  };

  const budgetHealth = getBudgetHealth();

  // Data for pie chart
  const pieData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    value: cat.percent,
    color: cat.color
  }));

  // Data for bar chart
  const barData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: cat.amount,
    color: cat.color
  }));

  // Per capita spending data
  const perCapitaData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: cat.amount / totalPopulation,
    color: cat.color
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Government Spending
          </h3>
          <p className="text-sm text-muted-foreground">
            Budget allocation and spending priorities across government functions
          </p>
        </div>
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Spending Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(spendingData.totalGovernmentSpending)}</div>
            <p className="text-xs text-muted-foreground">
              {spendingData.spendingGDPPercent.toFixed(1)}% of GDP
            </p>
            {referenceCountry && showComparison && (
              <p className="text-xs text-muted-foreground">
                Ref: {referenceCountry.spendingGDPPercent.toFixed(1)}% GDP
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Per Capita</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(spendingData.spendingPerCapita)}</div>
            <p className="text-xs text-muted-foreground">
              Per citizen spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Balance</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${budgetHealth.color}`}>
              {formatCurrency(Math.abs(spendingData.budgetDeficitSurplus))}
            </div>
            <p className="text-xs text-muted-foreground">
              {spendingData.budgetDeficitSurplus >= 0 ? 'Budget Surplus' : 'Budget Deficit'}
            </p>
            <Badge className={budgetHealth.color.replace('text-', 'bg-').replace('600', '100')}>
              {budgetHealth.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold mb-4">Spending Distribution</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-4">
            {!isReadOnly && (
              <div>
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  Government Spending (% of GDP)
                </Label>
                <div className="space-y-2">
                  <div className="px-3">
                    <Slider
                      value={[spendingData.spendingGDPPercent]}
                      onValueChange={(value) => handleSpendingGDPPercentChange(value[0]!)}
                      max={60}
                      min={10}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span className="font-medium text-foreground">
                      {spendingData.spendingGDPPercent.toFixed(1)}%
                    </span>
                    <span>60%</span>
                  </div>
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Spending Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {spendingData.spendingCategories.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: cat.color }} />
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(cat.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="detailed" className="space-y-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Bar dataKey="amount" name="Spending Amount">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <h4 className="text-md font-semibold">Spending Categories</h4>
          
          {spendingData.spendingCategories.map((cat, index) => {
            const Icon = cat.icon;
            return (
              <Card key={cat.category}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" style={{ color: cat.color }} />
                      <h5 className="font-medium">{cat.category}</h5>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(cat.amount)} ({cat.percent.toFixed(1)}%)
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground mb-1">{cat.description}</div>
                    {!isReadOnly && (
                      <>
                        <div className="px-3">
                          <Slider
                            value={[cat.percent]}
                            onValueChange={(value) => handleSpendingPercentChange(index, value[0]!)}
                            max={40}
                            min={1}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1%</span>
                          <span className="font-medium text-foreground">
                            {cat.percent.toFixed(1)}%
                          </span>
                          <span>40%</span>
                        </div>
                      </>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(cat.amount / totalPopulation)} per capita
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="comparison" className="space-y-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perCapitaData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Bar dataKey="amount" name="Per Capita Spending">
                {perCapitaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Spending Priorities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {spendingData.spendingCategories
                  .sort((a, b) => b.percent - a.percent)
                  .map((cat, index) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 text-center text-xs font-medium text-muted-foreground">{index + 1}</div>
                          <Icon className="h-4 w-4" style={{ color: cat.color }} />
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {cat.percent.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Per Capita Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {spendingData.spendingCategories
                  .sort((a, b) => (b.amount / totalPopulation) - (a.amount / totalPopulation))
                  .map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: cat.color }} />
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {formatCurrency(cat.amount / totalPopulation)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Spending Analysis
          </div>
          <div className="text-sm">
            Your government spends {formatCurrency(spendingData.totalGovernmentSpending)} ({spendingData.spendingGDPPercent.toFixed(1)}% of GDP), 
            with the highest allocation to {
              spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.category ?? 'Unknown'
            } ({
              spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.percent.toFixed(1) ?? '0.0'
            }%). 
            The budget is currently {
              spendingData.budgetDeficitSurplus >= 0 
                ? `in surplus by ${formatCurrency(spendingData.budgetDeficitSurplus)}`
                : `in deficit by ${formatCurrency(Math.abs(spendingData.budgetDeficitSurplus))}`
            }.
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}