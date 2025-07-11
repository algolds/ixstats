// src/app/countries/_components/economy/FiscalSystemComponent.tsx
"use client";

import React, { useState } from "react";
import {
  Building,
  PieChart,
  Percent,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Info,
  DollarSign,
  Calculator,
  AlertTriangle,
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  BarChart4,
  ChartPie,
  HelpCircle,
  Eye,
  Pencil,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatCurrency, formatPercentage, calculateBudgetHealth } from "./utils";
import type { FiscalSystemData } from "~/types/economics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";

interface FiscalSystemComponentProps {
  fiscalData: FiscalSystemData;
  nominalGDP: number;
  totalPopulation: number;
  onFiscalDataChange?: (data: FiscalSystemData) => void;
  isReadOnly?: boolean;
  showAnalytics?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

export function FiscalSystemComponent({
  fiscalData,
  nominalGDP,
  totalPopulation,
  onFiscalDataChange,
  isReadOnly = true,
  showAnalytics = true,
}: FiscalSystemComponentProps) {
  const [view, setView] = useState<"overview" | "revenue" | "debt" | "analysis">("overview");
  const [editMode, setEditMode] = useState(false);

  const budgetHealth = calculateBudgetHealth({
    budgetDeficitSurplus: fiscalData.budgetDeficitSurplus,
    nominalGDP: nominalGDP,
  });

  const handleFieldChange = (field: keyof FiscalSystemData, value: any) => {
    if (isReadOnly || !onFiscalDataChange) return;
    
    const updatedData = { ...fiscalData, [field]: value };
    
    // Recalculate derived values
    if (field === 'taxRevenueGDPPercent') {
      updatedData.governmentRevenueTotal = (nominalGDP * value) / 100;
      updatedData.taxRevenuePerCapita = updatedData.governmentRevenueTotal / totalPopulation;
    }
    
    if (field === 'governmentBudgetGDPPercent') {
      const totalSpending = (nominalGDP * value) / 100;
      updatedData.budgetDeficitSurplus = updatedData.governmentRevenueTotal - totalSpending;
    }
    
    if (field === 'internalDebtGDPPercent' || field === 'externalDebtGDPPercent') {
      updatedData.totalDebtGDPRatio = updatedData.internalDebtGDPPercent + updatedData.externalDebtGDPPercent;
      updatedData.debtPerCapita = (nominalGDP * updatedData.totalDebtGDPRatio) / (100 * totalPopulation);
      updatedData.debtServiceCosts = (nominalGDP * updatedData.totalDebtGDPRatio * updatedData.interestRates) / 10000;
    }
    
    onFiscalDataChange(updatedData);
  };

  const handleTaxRateChange = (type: string, value: number) => {
    if (isReadOnly || !onFiscalDataChange) return;
    
    const updatedTaxRates = { ...fiscalData.taxRates };
    
    if (type === 'salesTaxRate') updatedTaxRates.salesTaxRate = value;
    if (type === 'propertyTaxRate') updatedTaxRates.propertyTaxRate = value;
    if (type === 'payrollTaxRate') updatedTaxRates.payrollTaxRate = value;
    if (type === 'wealthTaxRate') updatedTaxRates.wealthTaxRate = value;
    
    onFiscalDataChange({
      ...fiscalData,
      taxRates: updatedTaxRates
    });
  };

  // Prepare data for visualizations
  const revenueData = [
    { name: 'Income Tax', value: fiscalData.taxRevenueGDPPercent * 0.4, color: COLORS[0] },
    { name: 'Corporate Tax', value: fiscalData.taxRevenueGDPPercent * 0.25, color: COLORS[1] },
    { name: 'Sales Tax', value: fiscalData.taxRevenueGDPPercent * 0.2, color: COLORS[2] },
    { name: 'Other Taxes', value: fiscalData.taxRevenueGDPPercent * 0.15, color: COLORS[3] },
  ];

  const debtComposition = [
    { name: 'Internal Debt', value: fiscalData.internalDebtGDPPercent, color: COLORS[0] },
    { name: 'External Debt', value: fiscalData.externalDebtGDPPercent, color: COLORS[1] },
  ];
  
  const spendingData = fiscalData.governmentSpendingByCategory || [
    { category: 'Defense', amount: nominalGDP * 0.04, percent: 20 },
    { category: 'Education', amount: nominalGDP * 0.035, percent: 17.5 },
    { category: 'Healthcare', amount: nominalGDP * 0.035, percent: 17.5 },
    { category: 'Infrastructure', amount: nominalGDP * 0.025, percent: 12.5 },
    { category: 'Social Security', amount: nominalGDP * 0.045, percent: 22.5 },
    { category: 'Other', amount: nominalGDP * 0.02, percent: 10 },
  ];

  const fiscalMetrics = [
    {
      label: "Tax Revenue",
      value: fiscalData.taxRevenueGDPPercent,
      optimal: { min: 15, max: 30 },
      color: fiscalData.taxRevenueGDPPercent >= 15 && fiscalData.taxRevenueGDPPercent <= 30 ? "text-green-600" : "text-yellow-600",
    },
    {
      label: "Gov Budget",
      value: fiscalData.governmentBudgetGDPPercent,
      optimal: { min: 18, max: 32 },
      color: fiscalData.governmentBudgetGDPPercent >= 18 && fiscalData.governmentBudgetGDPPercent <= 32 ? "text-green-600" : "text-yellow-600",
    },
    {
      label: "Total Debt",
      value: fiscalData.totalDebtGDPRatio,
      optimal: { min: 20, max: 60 },
      color: fiscalData.totalDebtGDPRatio <= 60 ? "text-green-600" : fiscalData.totalDebtGDPRatio <= 90 ? "text-yellow-600" : "text-red-600",
    },
  ];

  // Get icon for category
  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'Defense': return <Shield className="h-4 w-4 mr-2" />;
      case 'Education': return <GraduationCap className="h-4 w-4 mr-2" />;
      case 'Healthcare': return <Heart className="h-4 w-4 mr-2" />;
      case 'Infrastructure': return <Truck className="h-4 w-4 mr-2" />;
      case 'Social Security': return <Users2 className="h-4 w-4 mr-2" />;
      default: return <Building className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Fiscal System
            </h3>
            <p className="text-sm text-muted-foreground">
              Government finances, taxation, and debt management
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Eye className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            {showAnalytics && (
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="grid grid-cols-4 w-[400px]">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="revenue">Revenue</TabsTrigger>
                  <TabsTrigger value="debt">Debt</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <Badge variant="outline" className="text-xs">Revenue</Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Government tax revenue as % of GDP</p>
                    <p className="font-medium">{formatCurrency(fiscalData.governmentRevenueTotal)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="text-2xl font-bold cursor-help">{formatPercentage(fiscalData.taxRevenueGDPPercent)}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total: {formatCurrency(fiscalData.governmentRevenueTotal)}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-xs text-muted-foreground">of GDP</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(fiscalData.taxRevenuePerCapita)} per capita</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <Badge variant="outline" className="text-xs">Budget</Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Government spending as % of GDP</p>
                    <p className="font-medium">{formatCurrency((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="text-2xl font-bold cursor-help">{formatPercentage(fiscalData.governmentBudgetGDPPercent)}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total: {formatCurrency((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-xs text-muted-foreground">of GDP</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {fiscalData.budgetDeficitSurplus >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                  <Badge className={budgetHealth.color.replace('text-', 'bg-').replace('600', '100')} variant="secondary">
                    {budgetHealth.label}
                  </Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Budget {fiscalData.budgetDeficitSurplus >= 0 ? 'surplus' : 'deficit'}</p>
                    <p className="font-medium">{formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}</p>
                    <p className="text-xs">{formatPercentage(Math.abs(fiscalData.budgetDeficitSurplus / nominalGDP * 100))} of GDP</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className={`text-2xl font-bold cursor-help ${budgetHealth.color}`}>
                      {formatPercentage(Math.abs(fiscalData.budgetDeficitSurplus / nominalGDP * 100))}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-xs text-muted-foreground">
                  {fiscalData.budgetDeficitSurplus >= 0 ? 'Surplus' : 'Deficit'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  <Badge variant="outline" className="text-xs">Debt</Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total government debt as % of GDP</p>
                    <p className="font-medium">{formatCurrency((nominalGDP * fiscalData.totalDebtGDPRatio) / 100)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="text-2xl font-bold cursor-help">{formatPercentage(fiscalData.totalDebtGDPRatio)}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total: {formatCurrency((nominalGDP * fiscalData.totalDebtGDPRatio) / 100)}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-xs text-muted-foreground">of GDP</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(fiscalData.debtPerCapita)} per capita</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Content - Using conditional rendering instead of TabsContent */}
        {view === "overview" && (
          <div className="space-y-6">
            {/* Fiscal Health Indicators */}
            <Card>
              <CardHeader>
                <CardTitle>Fiscal Health Indicators</CardTitle>
                <CardDescription>Key metrics compared to optimal ranges</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fiscalMetrics.map((metric) => (
                  <div key={metric.label} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">{metric.label}</Label>
                      <span className={`text-sm font-medium ${metric.color}`}>
                        {metric.value.toFixed(1)}% of GDP
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (metric.value / metric.optimal.max) * 100)} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Optimal: {metric.optimal.min}-{metric.optimal.max}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Budget Balance & Spending Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={revenueData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {revenueData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Spending Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {spendingData.slice(0, 5).map((item) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {getCategoryIcon(item.category)}
                            <span className="text-sm">{item.category}</span>
                          </div>
                          <span className="text-sm font-medium">
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={item.percent} className="h-1" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {view === "revenue" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax Revenue Details</CardTitle>
                <CardDescription>Breakdown of government revenue sources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isReadOnly ? (
                  <>
                    <div>
                      <Label>Tax Revenue (% of GDP)</Label>
                      <Input
                        type="number"
                        value={fiscalData.taxRevenueGDPPercent}
                        onChange={(e) => handleFieldChange('taxRevenueGDPPercent', parseFloat(e.target.value) || 0)}
                        step="0.1"
                        min="0"
                        max="50"
                      />
                    </div>
                    
                    {/* Tax Rate Controls - Added from Builder */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">
                            Sales Tax Rate
                          </Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="25"
                              step="0.1"
                              value={fiscalData.taxRates.salesTaxRate}
                              onChange={(e) => handleTaxRateChange('salesTaxRate', parseFloat(e.target.value))}
                              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0%</span>
                              <span className="font-medium">
                                {fiscalData.taxRates.salesTaxRate.toFixed(1)}%
                              </span>
                              <span>25%</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">
                            Property Tax Rate
                          </Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="5"
                              step="0.1"
                              value={fiscalData.taxRates.propertyTaxRate}
                              onChange={(e) => handleTaxRateChange('propertyTaxRate', parseFloat(e.target.value))}
                              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0%</span>
                              <span className="font-medium">
                                {fiscalData.taxRates.propertyTaxRate.toFixed(1)}%
                              </span>
                              <span>5%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">
                            Payroll Tax Rate
                          </Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="0.1"
                              value={fiscalData.taxRates.payrollTaxRate}
                              onChange={(e) => handleTaxRateChange('payrollTaxRate', parseFloat(e.target.value))}
                              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0%</span>
                              <span className="font-medium">
                                {fiscalData.taxRates.payrollTaxRate.toFixed(1)}%
                              </span>
                              <span>30%</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">
                            Wealth Tax Rate
                          </Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.1"
                              value={fiscalData.taxRates.wealthTaxRate}
                              onChange={(e) => handleTaxRateChange('wealthTaxRate', parseFloat(e.target.value))}
                              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0%</span>
                              <span className="font-medium">
                                {fiscalData.taxRates.wealthTaxRate.toFixed(1)}%
                              </span>
                              <span>3%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Changes to tax revenue will affect government income and budget calculations.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Tax Revenue</div>
                        <div className="text-lg font-semibold">{formatCurrency(fiscalData.governmentRevenueTotal)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tax % of GDP</div>
                        <div className="text-lg font-semibold">{fiscalData.taxRevenueGDPPercent.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    {/* Revenue Composition Chart */}
                    <div className="h-64 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => `${value}%`} />
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Bar dataKey="value" name="% of GDP">
                            {revenueData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Tax Rates Display */}
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Tax Rates by Category</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sales Tax:</span>
                          <span className="font-medium">{(fiscalData.taxRates?.salesTaxRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Property Tax:</span>
                          <span className="font-medium">{(fiscalData.taxRates?.propertyTaxRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payroll Tax:</span>
                          <span className="font-medium">{(fiscalData.taxRates?.payrollTaxRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Wealth Tax:</span>
                          <span className="font-medium">{(fiscalData.taxRates?.wealthTaxRate || 0).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {view === "debt" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Government Debt Analysis</CardTitle>
                <CardDescription>Debt levels and servicing costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isReadOnly ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Internal Debt (% of GDP)</Label>
                        <Input
                          type="number"
                          value={fiscalData.internalDebtGDPPercent}
                          onChange={(e) => handleFieldChange('internalDebtGDPPercent', parseFloat(e.target.value) || 0)}
                          step="1"
                          min="0"
                          max="200"
                        />
                      </div>
                      <div>
                        <Label>External Debt (% of GDP)</Label>
                        <Input
                          type="number"
                          value={fiscalData.externalDebtGDPPercent}
                          onChange={(e) => handleFieldChange('externalDebtGDPPercent', parseFloat(e.target.value) || 0)}
                          step="1"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Interest Rate (%)</Label>
                      <Input
                        type="number"
                        value={fiscalData.interestRates * 100} // Convert from decimal to percentage
                        onChange={(e) => handleFieldChange('interestRates', parseFloat(e.target.value) / 100 || 0)} // Convert back to decimal
                        step="0.1"
                        min="0"
                        max="20"
                      />
                    </div>
                    
                    {/* Debt projection chart - builder style */}
                    <div className="p-4 mt-4 bg-muted/30 rounded-lg">
                      <h5 className="text-sm font-medium mb-2">Debt Service Projection</h5>
                      <div className="text-sm text-muted-foreground mb-3">
                        Annual debt service cost is {formatCurrency(fiscalData.debtServiceCosts)}, 
                        which is {((fiscalData.debtServiceCosts / fiscalData.governmentRevenueTotal) * 100).toFixed(1)}% of annual revenue.
                      </div>
                      
                      {fiscalData.totalDebtGDPRatio > 90 && (
                        <Alert className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Debt exceeds 90% of GDP which may impact fiscal sustainability.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Internal Debt</div>
                        <div className="text-xl font-bold">{fiscalData.internalDebtGDPPercent.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">of GDP</div>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">External Debt</div>
                        <div className="text-xl font-bold">{fiscalData.externalDebtGDPPercent.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">of GDP</div>
                      </div>
                    </div>
                    
                    {/* Debt Composition Chart */}
                    <div className="h-56 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={debtComposition}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({name, value}) => `${name}: ${value.toFixed(1)}%`}
                          >
                            {debtComposition.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-sm font-semibold mb-3">Debt Service Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Debt:</span>
                          <span className="font-medium">{fiscalData.totalDebtGDPRatio.toFixed(1)}% of GDP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Debt per Capita:</span>
                          <span className="font-medium">{formatCurrency(fiscalData.debtPerCapita)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Interest Rate:</span>
                          <span className="font-medium">{(fiscalData.interestRates * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual Debt Service:</span>
                          <span className="font-medium">{formatCurrency(fiscalData.debtServiceCosts)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Service/Revenue Ratio:</span>
                          <span className="font-medium">
                            {((fiscalData.debtServiceCosts / fiscalData.governmentRevenueTotal) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {fiscalData.totalDebtGDPRatio > 90 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          High debt levels may impact economic growth and fiscal flexibility.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {view === "analysis" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fiscal Sustainability Analysis</CardTitle>
                <CardDescription>Assessment of fiscal health and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Debt Sustainability */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Debt Sustainability</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {fiscalData.totalDebtGDPRatio <= 60 ? (
                          <Badge className="bg-green-100 text-green-800">Sustainable</Badge>
                        ) : fiscalData.totalDebtGDPRatio <= 90 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Moderate Risk</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">High Risk</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          Debt-to-GDP: {fiscalData.totalDebtGDPRatio.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fiscalData.totalDebtGDPRatio <= 60 
                          ? "Debt levels are within sustainable limits."
                          : fiscalData.totalDebtGDPRatio <= 90
                          ? "Debt is elevated but manageable with prudent fiscal policy."
                          : "High debt levels require immediate fiscal consolidation."}
                      </p>
                    </div>
                  </div>

                  {/* Revenue Adequacy */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Revenue Adequacy</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {fiscalData.taxRevenueGDPPercent >= 20 ? (
                          <Badge className="bg-green-100 text-green-800">Adequate</Badge>
                        ) : fiscalData.taxRevenueGDPPercent >= 15 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Moderate</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">Low</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          Tax-to-GDP: {fiscalData.taxRevenueGDPPercent.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fiscalData.taxRevenueGDPPercent >= 20 
                          ? "Revenue collection is sufficient for government operations."
                          : fiscalData.taxRevenueGDPPercent >= 15
                          ? "Revenue is adequate but could be improved."
                          : "Low revenue constrains government capacity."}
                      </p>
                    </div>
                  </div>

                  {/* Budget Balance */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Budget Balance</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {fiscalData.budgetDeficitSurplus > 0 ? (
                          <Badge className="bg-green-100 text-green-800">Surplus</Badge>
                        ) : fiscalData.budgetDeficitSurplus >= -0.02 * nominalGDP ? (
                          <Badge className="bg-blue-100 text-blue-800">Balanced</Badge>
                        ) : fiscalData.budgetDeficitSurplus >= -0.05 * nominalGDP ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Moderate Deficit</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">High Deficit</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {fiscalData.budgetDeficitSurplus >= 0 
                            ? `Surplus: ${formatCurrency(fiscalData.budgetDeficitSurplus)}`
                            : `Deficit: ${formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fiscalData.budgetDeficitSurplus > 0
                          ? "Budget surplus allows for debt reduction or increased investment."
                          : fiscalData.budgetDeficitSurplus >= -0.02 * nominalGDP
                          ? "Budget is effectively balanced, providing fiscal stability."
                          : fiscalData.budgetDeficitSurplus >= -0.05 * nominalGDP
                          ? "Moderate deficit requires monitoring to ensure sustainability."
                          : "High deficit indicates structural fiscal imbalance requiring correction."}
                      </p>
                    </div>
                  </div>

                  {/* Fiscal Space */}
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Fiscal Space</h4>
                    <Progress 
                      value={Math.max(0, 100 - fiscalData.totalDebtGDPRatio)} 
                      className="h-2 mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available fiscal space for counter-cyclical policies or emergency spending.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fiscal Policy Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {fiscalData.totalDebtGDPRatio > 90 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <span className="font-medium">Reduce Debt Burden</span>: High debt levels may constrain growth. Consider debt restructuring and gradual reduction.
                      </div>
                    </div>
                  )}

                  {fiscalData.budgetDeficitSurplus < -0.05 * nominalGDP && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <span className="font-medium">Address Budget Deficit</span>: Large deficits may lead to unsustainable debt accumulation. Consider revenue enhancement or spending efficiency.
                      </div>
                    </div>
                  )}

                  {fiscalData.taxRevenueGDPPercent < 15 && (
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <span className="font-medium">Improve Revenue Collection</span>: Tax revenue is below recommended levels. Consider tax base broadening or improved compliance.
                      </div>
                    </div>
                  )}

                  {fiscalData.debtServiceCosts / fiscalData.governmentRevenueTotal > 0.15 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div>
                        <span className="font-medium">Manage Debt Service Costs</span>: Debt servicing exceeds 15% of revenue, creating fiscal pressure. Consider refinancing or debt management strategies.
                      </div>
                    </div>
                  )}

                  {fiscalData.budgetDeficitSurplus > 0.02 * nominalGDP && (
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <span className="font-medium">Utilize Budget Surplus</span>: Consider debt reduction, strategic investments, or building fiscal reserves.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Fiscal Health Summary */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Fiscal Status: <span className={budgetHealth.color}>{budgetHealth.label}</span></div>
            <p className="text-sm mt-1">
              {fiscalData.budgetDeficitSurplus >= 0
                ? `Running a surplus of ${formatCurrency(fiscalData.budgetDeficitSurplus)} allows for debt reduction.`
                : `Deficit of ${formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))} requires careful management.`}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}