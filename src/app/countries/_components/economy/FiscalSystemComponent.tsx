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
} from 'recharts';
import { formatCurrency, formatPercentage, calculateBudgetHealth } from "./utils";
import type { FiscalSystemData } from "~/types/economics";

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

  return (
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

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-xs">Revenue</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatCurrency(fiscalData.governmentRevenueTotal)}</div>
              <div className="text-xs text-muted-foreground">{fiscalData.taxRevenueGDPPercent.toFixed(1)}% of GDP</div>
              <div className="text-xs text-muted-foreground">{formatCurrency(fiscalData.taxRevenuePerCapita)} per capita</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Building className="h-5 w-5 text-blue-600" />
              <Badge variant="outline" className="text-xs">Budget</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatCurrency((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}</div>
              <div className="text-xs text-muted-foreground">{fiscalData.governmentBudgetGDPPercent.toFixed(1)}% of GDP</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              {fiscalData.budgetDeficitSurplus >= 0 ? (
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
                {formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}
              </div>
              <div className="text-xs text-muted-foreground">
                {fiscalData.budgetDeficitSurplus >= 0 ? 'Surplus' : 'Deficit'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="h-5 w-5 text-orange-600" />
              <Badge variant="outline" className="text-xs">Debt</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{fiscalData.totalDebtGDPRatio.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">of GDP</div>
              <div className="text-xs text-muted-foreground">{formatCurrency(fiscalData.debtPerCapita)} per capita</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <TabsContent value="overview" className="space-y-6">
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

        {/* Quick Stats */}
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
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Debt Composition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={debtComposition}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {debtComposition.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="revenue" className="space-y-6">
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
      </TabsContent>

      <TabsContent value="debt" className="space-y-6">
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
                    value={fiscalData.interestRates}
                    onChange={(e) => handleFieldChange('interestRates', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    max="20"
                  />
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
      </TabsContent>

      <TabsContent value="analysis" className="space-y-6">
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
      </TabsContent>

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
  );
}