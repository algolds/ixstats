// src/app/countries/_components/economy/GovernmentSpending.tsx
"use client";

import { useState, type ElementType } from "react"; 
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
  AlertTriangle,
  MoreHorizontal,
  DollarSign,
  Landmark,
  PieChart,
  BarChart4,
  LayoutList,
  LineChart
} from "lucide-react";
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  CartesianGrid,
} from 'recharts';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { CoreEconomicIndicatorsData } from "~/types/economics";

// Match the SpendingCategory type from src/types/economics.ts for data consistency
interface SpendingCategory {
  category: string;
  amount: number;
  percent: number;
  icon?: string; // Icon is a string (name of Lucide icon or similar)
  color?: string; 
  description?: string;
}

interface GovernmentSpendingData {
  totalSpending: number;
  spendingGDPPercent: number;
  spendingPerCapita: number;
  spendingCategories: SpendingCategory[];
  deficitSurplus: number;
}

interface GovernmentSpendingProps {
  spendingData: GovernmentSpendingData;
  nominalGDP: number;
  totalPopulation: number;
  onSpendingDataChangeAction: (spendingData: GovernmentSpendingData) => void;
  isReadOnly?: boolean; 
  indicators?: CoreEconomicIndicatorsData; 
  onIndicatorsChangeAction?: (newData: CoreEconomicIndicatorsData) => void;
}

// Mapping from icon string names to Lucide components
const iconMap: { [key: string]: ElementType } = {
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  Briefcase,
  Globe,
  Scale,
  Building,
  Landmark,
  MoreHorizontal, // Default/fallback icon
};

export function GovernmentSpending({
  spendingData,
  nominalGDP,
  totalPopulation,
  onSpendingDataChangeAction,
  isReadOnly = false, 
  indicators,
  onIndicatorsChangeAction
}: GovernmentSpendingProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'breakdown' | 'efficiency' | 'analysis'>('overview');

  const handleSpendingPercentChange = (index: number, value: number) => {
    if (isReadOnly) return;
    const newCategories = [...spendingData.spendingCategories];
    
    const totalOthers = newCategories.reduce((sum, cat, idx) => 
      idx !== index ? sum + cat.percent : sum, 0);
    
    const adjustedValue = Math.min(value, Math.max(0, 100 - totalOthers)); 
    
    if (newCategories[index]) {
      newCategories[index] = {
        ...newCategories[index],
        percent: adjustedValue,
        amount: (spendingData.totalSpending * adjustedValue) / 100
      };
      
      const remainingPercent = 100 - adjustedValue;
      const sumOfOthersForNormalization = newCategories
        .filter((_, idx) => idx !== index)
        .reduce((sum, cat) => sum + cat.percent, 0);

      const normalizedCategories = newCategories.map((cat, idx) => {
        if (idx === index) return cat;
        if (sumOfOthersForNormalization === 0) { 
            const otherCatsCount = newCategories.length -1;
            if (otherCatsCount > 0) {
                const equalShare = remainingPercent / otherCatsCount;
                 return {
                    ...cat,
                    percent: equalShare,
                    amount: (spendingData.totalSpending * equalShare) / 100
                };
            }
            return cat; 
        }
        
        const normalizedPercent = (cat.percent / sumOfOthersForNormalization) * remainingPercent;
        return {
          ...cat,
          percent: normalizedPercent,
          amount: (spendingData.totalSpending * normalizedPercent) / 100
        };
      });
      
      onSpendingDataChangeAction({
        ...spendingData,
        spendingCategories: normalizedCategories
      });
    }
  };

  const handleTotalSpendingChange = (value: number) => {
    if (isReadOnly) return;
    const newSpendingData = { ...spendingData };
    newSpendingData.totalSpending = value;
    newSpendingData.spendingGDPPercent = nominalGDP > 0 ? (value / nominalGDP) * 100 : 0;
    newSpendingData.spendingPerCapita = totalPopulation > 0 ? value / totalPopulation : 0;
    
    newSpendingData.spendingCategories = spendingData.spendingCategories.map(cat => ({
      ...cat,
      amount: (value * cat.percent) / 100
    }));
    
    onSpendingDataChangeAction(newSpendingData);
  };

  const handleSpendingGDPPercentChange = (value: number) => {
    if (isReadOnly) return;
    const newTotalSpending = (nominalGDP * value) / 100;
    handleTotalSpendingChange(newTotalSpending);
  };

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? `${prefix}N/A` : 'N/A';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const getBudgetHealth = () => {
    const deficit = spendingData.deficitSurplus;
    const deficitPercent = nominalGDP > 0 ? (deficit / nominalGDP) * 100 : 0;
    
    if (deficitPercent > 1) return { color: "text-green-600", label: "Surplus" };
    if (deficitPercent > -2) return { color: "text-blue-600", label: "Balanced" };
    if (deficitPercent > -5) return { color: "text-yellow-600", label: "Moderate Deficit" };
    return { color: "text-red-600", label: "High Deficit" };
  };

  const budgetHealth = getBudgetHealth();

  const pieData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    value: cat.percent,
    color: cat.color || '#CCCCCC' 
  }));

  const barData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: cat.amount,
    color: cat.color || '#CCCCCC'
  }));

  const perCapitaData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: totalPopulation > 0 ? cat.amount / totalPopulation : 0,
    color: cat.color || '#CCCCCC'
  }));

  // Calculate efficiency metrics for each spending category
  const efficiencyData = spendingData.spendingCategories.map(cat => {
    // This is a simplified efficiency score - in a real app, you'd use actual metrics
    // Efficiency is higher for categories with higher impact per dollar spent
    const efficiencyScore = Math.random() * 40 + 60; // Random score between 60-100 for demonstration
    return {
      ...cat,
      efficiency: efficiencyScore,
      impact: (cat.amount / spendingData.totalSpending) * efficiencyScore
    };
  }).sort((a, b) => b.impact - a.impact);

  const renderIcon = (iconName?: string) => {
    const IconComponent = iconName ? iconMap[iconName] : null;
    return IconComponent ? <IconComponent className="h-4 w-4 mr-2" /> : <MoreHorizontal className="h-4 w-4 mr-2 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Government Spending
          </h3>
          <p className="text-sm text-muted-foreground">
            Budget allocation and spending priorities
          </p>
        </div>
        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
          <TabsList className="grid grid-cols-4 w-[400px]">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <PieChart className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="flex items-center gap-1">
              <BarChart4 className="h-3.5 w-3.5" /> Breakdown
            </TabsTrigger>
            <TabsTrigger value="efficiency" className="flex items-center gap-1">
              <LayoutList className="h-3.5 w-3.5" /> Comparison
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-1">
              <LineChart className="h-3.5 w-3.5" /> Analysis
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Building className="h-6 w-6 text-blue-600" />
              <Badge variant="outline" className="text-xs">Total Spending</Badge>
            </div>
            <div className="text-xl font-bold">
              {formatNumber(spendingData.totalSpending)}
            </div>
            <div className="text-sm text-muted-foreground">Government Budget</div>
            <div className="text-xs text-muted-foreground">
              {spendingData.spendingGDPPercent.toFixed(1)}% of GDP
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users2 className="h-6 w-6 text-purple-600" />
              <Badge variant="outline" className="text-xs">Per Capita</Badge>
            </div>
            <div className="text-xl font-bold">
              {formatNumber(spendingData.spendingPerCapita)}
            </div>
            <div className="text-sm text-muted-foreground">Spending per Citizen</div>
            <div className="text-xs text-muted-foreground">
              Annual government spending per person
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart2 className="h-6 w-6 text-green-600" />
              <Badge className={budgetHealth.color.replace('text-', 'bg-').replace('600', '100')} variant="secondary">
                {budgetHealth.label}
              </Badge>
            </div>
            <div className={`text-xl font-bold ${budgetHealth.color}`}>
              {formatNumber(Math.abs(spendingData.deficitSurplus))}
            </div>
            <div className="text-sm text-muted-foreground">
              {spendingData.deficitSurplus >= 0 ? 'Budget Surplus' : 'Budget Deficit'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Use conditional rendering instead of TabsContent */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending Distribution</CardTitle>
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
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center">
                <Building className="h-4 w-4 mr-2 text-primary" />
                Government Spending (% of GDP)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="0.1"
                  value={spendingData.spendingGDPPercent}
                  onChange={(e) => handleSpendingGDPPercentChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  disabled={isReadOnly}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10%</span>
                  <span className="font-medium">
                    {spendingData.spendingGDPPercent.toFixed(1)}%
                  </span>
                  <span>60%</span>
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <h5 className="text-sm font-semibold mb-3">Spending Summary</h5>
                <div className="space-y-2">
                  {spendingData.spendingCategories.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center" style={{ color: cat.color }}>
                        {renderIcon(cat.icon)}
                        <span className="text-sm">{cat.category}</span>
                      </div>
                      <div className="text-sm font-medium">
                        {formatNumber(cat.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedView === 'breakdown' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatNumber(value as number)} />
                    <Bar dataKey="amount" name="Spending Amount">
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h4 className="text-md font-semibold">Spending Categories</h4>
            
            {spendingData.spendingCategories.map((cat, index) => (
              <Card key={cat.category}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center" style={{ color: cat.color }}>
                      {renderIcon(cat.icon)}
                      <h5 className="font-medium">{cat.category}</h5>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatNumber(cat.amount)} ({cat.percent.toFixed(1)}%)
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground mb-1">{cat.description}</div>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="1"
                        max="40"
                        step="0.1"
                        value={cat.percent}
                        onChange={(e) => handleSpendingPercentChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider mr-2"
                        disabled={isReadOnly}
                      />
                      <span className="text-sm font-medium w-12 text-right">
                        {cat.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(totalPopulation > 0 ? cat.amount / totalPopulation : 0)} per capita
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedView === 'efficiency' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per Capita Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perCapitaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatNumber(value as number)} />
                    <Bar dataKey="amount" name="Per Capita Spending">
                      {perCapitaData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending Priorities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {spendingData.spendingCategories
                    .sort((a, b) => b.percent - a.percent)
                    .map((cat, index) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center" style={{ color: cat.color }}>
                          <div className="w-5 text-center text-xs font-medium text-muted-foreground">{index + 1}</div>
                          {renderIcon(cat.icon)}
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {cat.percent.toFixed(1)}%
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per Capita Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {spendingData.spendingCategories
                    .sort((a, b) => (totalPopulation > 0 ? (b.amount / totalPopulation) - (a.amount / totalPopulation) : 0))
                    .map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center" style={{ color: cat.color }}>
                           {renderIcon(cat.icon)}
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {formatNumber(totalPopulation > 0 ? cat.amount / totalPopulation : 0)}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {selectedView === 'analysis' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget Efficiency Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {efficiencyData.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {renderIcon(cat.icon)}
                        <span className="text-sm font-medium">{cat.category}</span>
                      </div>
                      <div className="text-sm">
                        <Badge variant={cat.efficiency > 80 ? "success" : cat.efficiency > 65 ? "secondary" : "outline"}>
                          {cat.efficiency.toFixed(0)}% efficient
                        </Badge>
                      </div>
                    </div>
                    <Progress value={cat.efficiency} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Budget: {formatNumber(cat.amount)} ({cat.percent.toFixed(1)}%)</span>
                      <span>Impact Score: {cat.impact.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Budget Balance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Revenue:</span>
                  <span className="text-sm">{formatNumber(spendingData.totalSpending + spendingData.deficitSurplus)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Spending:</span>
                  <span className="text-sm">{formatNumber(spendingData.totalSpending)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Budget Balance:</span>
                  <span className={`text-sm font-semibold ${budgetHealth.color}`}>
                    {spendingData.deficitSurplus >= 0 
                      ? `+${formatNumber(spendingData.deficitSurplus)} (Surplus)` 
                      : `-${formatNumber(Math.abs(spendingData.deficitSurplus))} (Deficit)`}
                  </span>
                </div>
                
                <Progress 
                  value={50 + (spendingData.deficitSurplus / spendingData.totalSpending) * 50} 
                  className="h-2 mt-2"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Deficit</span>
                  <span>Balance</span>
                  <span>Surplus</span>
                </div>
                
                {Math.abs(spendingData.deficitSurplus) > 0.05 * spendingData.totalSpending && (
                  <Alert variant={spendingData.deficitSurplus >= 0 ? "default" : "warning"} className="mt-3">
                    {spendingData.deficitSurplus >= 0 ? (
                      <Info className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {spendingData.deficitSurplus >= 0 
                        ? "Current budget has a significant surplus. Consider investments or tax adjustments."
                        : "Budget deficit exceeds 5% of total spending. Consider revenue increases or spending reductions."}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <h4 className="text-sm font-medium mb-1">
            Spending Analysis
          </h4>
          <p className="text-xs text-muted-foreground">
            Government spends {formatNumber(spendingData.totalSpending)} ({spendingData.spendingGDPPercent.toFixed(1)}% of GDP), 
            with the highest allocation to {
              spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.category ?? 'Unknown'
            } ({
              (spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.percent ?? 0).toFixed(1)
            }%). 
            The budget is currently {
              spendingData.deficitSurplus >= 0 
                ? `in surplus by ${formatNumber(spendingData.deficitSurplus)}`
                : `in deficit by ${formatNumber(Math.abs(spendingData.deficitSurplus))}`
            }.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}