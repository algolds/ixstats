// src/app/countries/_components/economy/GovernmentSpending.tsx
"use client";

import React, { useState, type ElementType } from "react";
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
  LineChart,
  HelpCircle,
  Eye,
  Pencil,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type {
  CoreEconomicIndicatorsData,
  SpendingCategory,
  GovernmentSpendingData,
} from "~/types/economics";
import { createDefaultGovernmentSpendingData } from "~/lib/government-spending-defaults";
import { Button } from "~/components/ui/button";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

// Mapping from icon string names to Lucide components
const iconMap: Record<string, ElementType> = {
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

interface GovernmentSpendingProps extends GovernmentSpendingData {
  nominalGDP: number;
  totalPopulation: number;
  onSpendingDataChangeAction: (spendingData: GovernmentSpendingData) => void;
  isReadOnly?: boolean;
  indicators?: CoreEconomicIndicatorsData;
  onIndicatorsChangeAction?: (newData: CoreEconomicIndicatorsData) => void;
}

export function GovernmentSpending({
  education = 0,
  healthcare = 0,
  socialSafety = 0,
  totalSpending,
  spendingGDPPercent,
  spendingPerCapita,
  spendingCategories,
  deficitSurplus = 0,
  performanceBasedBudgeting = false,
  universalBasicServices = false,
  greenInvestmentPriority = false,
  digitalGovernmentInitiative = false,
  nominalGDP,
  totalPopulation,
  onSpendingDataChangeAction,
  isReadOnly = false,
  indicators,
  onIndicatorsChangeAction,
}: GovernmentSpendingProps) {
  // Reconstruct spendingData object for compatibility
  const spendingData: GovernmentSpendingData = createDefaultGovernmentSpendingData({
    education,
    healthcare,
    socialSafety,
    totalSpending,
    spendingGDPPercent,
    spendingPerCapita,
    spendingCategories,
    deficitSurplus,
    performanceBasedBudgeting,
    universalBasicServices,
    greenInvestmentPriority,
    digitalGovernmentInitiative,
  });
  const [selectedView, setSelectedView] = useState<
    "overview" | "breakdown" | "efficiency" | "analysis"
  >("overview");
  const [editMode, setEditMode] = useState(false);

  const handleSpendingPercentChange = (index: number, value: number) => {
    if (isReadOnly) return;
    const newCategories = [...spendingData.spendingCategories];

    const totalOthers = newCategories.reduce(
      (sum, cat, idx) => (idx !== index ? sum + cat.percent : sum),
      0
    );

    const adjustedValue = Math.min(value, Math.max(0, 100 - totalOthers));

    if (newCategories[index]) {
      newCategories[index] = {
        ...newCategories[index],
        percent: adjustedValue,
        amount: (spendingData.totalSpending * adjustedValue) / 100,
      };

      const remainingPercent = 100 - adjustedValue;
      const sumOfOthersForNormalization = newCategories
        .filter((_, idx) => idx !== index)
        .reduce((sum, cat) => sum + cat.percent, 0);

      const normalizedCategories = newCategories.map((cat, idx) => {
        if (idx === index) return cat;
        if (sumOfOthersForNormalization === 0) {
          const otherCatsCount = newCategories.length - 1;
          if (otherCatsCount > 0) {
            const equalShare = remainingPercent / otherCatsCount;
            return {
              ...cat,
              percent: equalShare,
              amount: (spendingData.totalSpending * equalShare) / 100,
            };
          }
          return cat;
        }

        const normalizedPercent = (cat.percent / sumOfOthersForNormalization) * remainingPercent;
        return {
          ...cat,
          percent: normalizedPercent,
          amount: (spendingData.totalSpending * normalizedPercent) / 100,
        };
      });

      onSpendingDataChangeAction({
        ...spendingData,
        spendingCategories: normalizedCategories,
      });
    }
  };

  const handleTotalSpendingChange = (value: number) => {
    if (isReadOnly) return;
    const newSpendingData = { ...spendingData };
    newSpendingData.totalSpending = value;
    newSpendingData.spendingGDPPercent = nominalGDP > 0 ? (value / nominalGDP) * 100 : 0;
    newSpendingData.spendingPerCapita = totalPopulation > 0 ? value / totalPopulation : 0;

    newSpendingData.spendingCategories = spendingData.spendingCategories.map(
      (cat: SpendingCategory) => ({
        ...cat,
        amount: (value * cat.percent) / 100,
      })
    );

    onSpendingDataChangeAction(newSpendingData);
  };

  const handleSpendingGDPPercentChange = (value: number) => {
    if (isReadOnly) return;
    const newTotalSpending = (nominalGDP * value) / 100;
    handleTotalSpendingChange(newTotalSpending);
  };

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? "$" : "";
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? `${prefix}N/A` : "N/A";
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

  const pieData = spendingData.spendingCategories.map((cat: SpendingCategory) => ({
    name: cat.category,
    value: cat.percent,
    color: cat.color || "#CCCCCC",
  }));

  const barData = spendingData.spendingCategories.map((cat: SpendingCategory) => ({
    name: cat.category,
    amount: cat.amount,
    color: cat.color || "#CCCCCC",
  }));

  const perCapitaData = spendingData.spendingCategories.map((cat: SpendingCategory) => ({
    name: cat.category,
    amount: totalPopulation > 0 ? cat.amount / totalPopulation : 0,
    color: cat.color || "#CCCCCC",
  }));

  // Calculate efficiency metrics for each spending category
  const efficiencyData = spendingData.spendingCategories
    .map((cat: SpendingCategory) => {
      // This is a simplified efficiency score - in a real app, you'd use actual metrics
      // Efficiency is higher for categories with higher impact per dollar spent
      const efficiencyScore = Math.random() * 40 + 60; // Random score between 60-100 for demonstration
      return {
        ...cat,
        efficiency: efficiencyScore,
        impact: (cat.amount / spendingData.totalSpending) * efficiencyScore,
      };
    })
    .sort((a: any, b: any) => b.impact - a.impact);

  /**
   * Renders an icon component based on the icon name
   * @param iconName - The name of the icon to render
   * @returns JSX element with the appropriate icon
   */
  const renderIcon = (iconName?: string): React.ReactElement => {
    // Get the icon component from the icon map, ensuring type safety
    const safeIconName = iconName ? String(iconName) : "";
    const IconComponent: React.ElementType =
      safeIconName && iconMap[safeIconName]
        ? (iconMap[safeIconName] as React.ElementType)
        : MoreHorizontal;
    return React.createElement(IconComponent, { className: "h-4 w-4 mr-2 text-gray-400" });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Building className="text-primary h-5 w-5" />
              Government Spending
            </h3>
            <p className="text-muted-foreground text-sm">
              Budget allocation and spending priorities
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
            <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
              <TabsList className="grid w-[400px] grid-cols-4">
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
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-6 w-6 text-blue-600" />
                  <Badge variant="outline" className="text-xs">
                    Total Spending
                  </Badge>
                </div>
                <UITooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total government spending</p>
                    <p className="font-medium">{formatNumber(spendingData.totalSpending)}</p>
                    <p className="text-xs">{spendingData.spendingGDPPercent.toFixed(1)}% of GDP</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <div className="space-y-1">
                <UITooltip>
                  <TooltipTrigger>
                    <div className="cursor-help text-xl font-bold">
                      {formatNumber(spendingData.spendingGDPPercent, 1, false)}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total: {formatNumber(spendingData.totalSpending)}</p>
                  </TooltipContent>
                </UITooltip>
                <div className="text-muted-foreground text-sm">of GDP</div>
                <div className="text-muted-foreground text-xs">Government Budget</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users2 className="h-6 w-6 text-purple-600" />
                  <Badge variant="outline" className="text-xs">
                    Per Capita
                  </Badge>
                </div>
                <UITooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Government spending per person</p>
                    <p className="font-medium">{formatNumber(spendingData.spendingPerCapita)}</p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-bold">
                  {formatNumber(spendingData.spendingPerCapita)}
                </div>
                <div className="text-muted-foreground text-sm">Spending per Citizen</div>
                <div className="text-muted-foreground text-xs">
                  Annual government spending per person
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-6 w-6 text-green-600" />
                  <Badge
                    className={budgetHealth.color.replace("text-", "bg-").replace("600", "100")}
                    variant="secondary"
                  >
                    {budgetHealth.label}
                  </Badge>
                </div>
                <UITooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Budget {spendingData.deficitSurplus >= 0 ? "surplus" : "deficit"}</p>
                    <p className="font-medium">
                      {formatNumber(Math.abs(spendingData.deficitSurplus))}
                    </p>
                    <p className="text-xs">
                      {formatNumber(
                        Math.abs((spendingData.deficitSurplus / nominalGDP) * 100),
                        1,
                        false
                      )}
                      % of GDP
                    </p>
                  </TooltipContent>
                </UITooltip>
              </div>
              <div className="space-y-1">
                <UITooltip>
                  <TooltipTrigger>
                    <div className={`cursor-help text-xl font-bold ${budgetHealth.color}`}>
                      {formatNumber(
                        Math.abs((spendingData.deficitSurplus / nominalGDP) * 100),
                        1,
                        false
                      )}
                      %
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatNumber(Math.abs(spendingData.deficitSurplus))}</p>
                  </TooltipContent>
                </UITooltip>
                <div className="text-muted-foreground text-sm">
                  {spendingData.deficitSurplus >= 0 ? "Budget Surplus" : "Budget Deficit"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Use conditional rendering instead of TabsContent */}
        {selectedView === "overview" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                          label={({ name, percent }: any) =>
                            `${name}: ${percent ? (percent * 100).toFixed(1) : "0"}%`
                          }
                        >
                          {pieData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
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
                  <Building className="text-primary mr-2 h-4 w-4" />
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
                    className="bg-muted slider h-2 w-full cursor-pointer appearance-none rounded-lg"
                    disabled={isReadOnly}
                  />
                  <div className="text-muted-foreground flex justify-between text-xs">
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
                  <h5 className="mb-3 text-sm font-semibold">Spending Summary</h5>
                  <div className="space-y-2">
                    {spendingData.spendingCategories.map((cat: SpendingCategory) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center" style={{ color: cat.color }}>
                          {renderIcon(cat.icon)}
                          <span className="text-sm">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium">{formatNumber(cat.amount)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {selectedView === "breakdown" && (
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
                      <RechartsTooltip formatter={(value) => formatNumber(value as number)} />
                      <Bar dataKey="amount" name="Spending Amount">
                        {barData.map((entry: any, index: number) => (
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

              {spendingData.spendingCategories.map((cat: SpendingCategory, index: number) => (
                <Card key={cat.category}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center" style={{ color: cat.color }}>
                        {renderIcon(cat.icon)}
                        <h5 className="font-medium">{cat.category}</h5>
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {formatNumber(cat.amount)} ({cat.percent.toFixed(1)}%)
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-muted-foreground mb-1 text-xs">{cat.description}</div>
                      <div className="flex items-center">
                        <input
                          type="range"
                          min="1"
                          max="40"
                          step="0.1"
                          value={cat.percent}
                          onChange={(e) =>
                            handleSpendingPercentChange(index, parseFloat(e.target.value))
                          }
                          className="bg-muted slider mr-2 h-2 w-full cursor-pointer appearance-none rounded-lg"
                          disabled={isReadOnly}
                        />
                        <span className="w-12 text-right text-sm font-medium">
                          {cat.percent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatNumber(totalPopulation > 0 ? cat.amount / totalPopulation : 0)} per
                        capita
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedView === "efficiency" && (
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
                      <RechartsTooltip formatter={(value) => formatNumber(value as number)} />
                      <Bar dataKey="amount" name="Per Capita Spending">
                        {perCapitaData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Spending Priorities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {spendingData.spendingCategories
                      .sort((a: SpendingCategory, b: SpendingCategory) => b.percent - a.percent)
                      .map((cat: SpendingCategory, index: number) => (
                        <div key={cat.category} className="flex items-center justify-between">
                          <div className="flex items-center" style={{ color: cat.color }}>
                            <div className="text-muted-foreground w-5 text-center text-xs font-medium">
                              {index + 1}
                            </div>
                            {renderIcon(cat.icon)}
                            <span className="text-sm">{cat.category}</span>
                          </div>
                          <div className="text-sm font-medium">{cat.percent.toFixed(1)}%</div>
                        </div>
                      ))}
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
                      .sort((a: SpendingCategory, b: SpendingCategory) =>
                        totalPopulation > 0
                          ? b.amount / totalPopulation - a.amount / totalPopulation
                          : 0
                      )
                      .map((cat: SpendingCategory) => (
                        <div key={cat.category} className="flex items-center justify-between">
                          <div className="flex items-center" style={{ color: cat.color }}>
                            {renderIcon(cat.icon)}
                            <span className="text-sm">{cat.category}</span>
                          </div>
                          <div className="text-sm font-medium">
                            {formatNumber(totalPopulation > 0 ? cat.amount / totalPopulation : 0)}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {selectedView === "analysis" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget Efficiency Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {efficiencyData.map((cat: any) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {renderIcon(cat.icon)}
                          <span className="text-sm font-medium">{cat.category}</span>
                        </div>
                        <div className="text-sm">
                          <Badge
                            variant={
                              cat.efficiency > 80
                                ? "default"
                                : cat.efficiency > 65
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {cat.efficiency.toFixed(0)}% efficient
                          </Badge>
                        </div>
                      </div>
                      <Progress value={cat.efficiency} className="h-2" />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>
                          Budget: {formatNumber(cat.amount)} ({cat.percent.toFixed(1)}%)
                        </span>
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
                    <span className="text-sm">
                      {formatNumber(spendingData.totalSpending + spendingData.deficitSurplus)}
                    </span>
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
                    className="mt-2 h-2"
                  />

                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>Deficit</span>
                    <span>Balance</span>
                    <span>Surplus</span>
                  </div>

                  {Math.abs(spendingData.deficitSurplus) > 0.05 * spendingData.totalSpending && (
                    <Alert
                      variant={spendingData.deficitSurplus >= 0 ? "default" : "destructive"}
                      className="mt-3"
                    >
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
            <h4 className="mb-1 text-sm font-medium">Spending Analysis</h4>
            <p className="text-muted-foreground text-xs">
              Government spends {formatNumber(spendingData.totalSpending)} (
              {spendingData.spendingGDPPercent.toFixed(1)}% of GDP), with the highest allocation to{" "}
              {spendingData.spendingCategories.sort(
                (a: SpendingCategory, b: SpendingCategory) => b.percent - a.percent
              )[0]?.category ?? "Unknown"}{" "}
              (
              {(
                spendingData.spendingCategories.sort(
                  (a: SpendingCategory, b: SpendingCategory) => b.percent - a.percent
                )[0]?.percent ?? 0
              ).toFixed(1)}
              %). The budget is currently{" "}
              {spendingData.deficitSurplus >= 0
                ? `in surplus by ${formatNumber(spendingData.deficitSurplus)}`
                : `in deficit by ${formatNumber(Math.abs(spendingData.deficitSurplus))}`}
              .
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}
