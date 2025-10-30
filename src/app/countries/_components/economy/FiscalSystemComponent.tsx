// src/app/countries/_components/economy/FiscalSystemComponent.tsx
"use client";

import React from "react";
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
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
  LabelList,
  Label as RechartsLabel,
} from "recharts";
import { formatCurrency, formatPercentage } from "./utils";
import type { FiscalSystemData } from "~/types/economics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import { useFiscalData } from "~/hooks/useFiscalData";
import { FISCAL_CHART_COLORS } from "~/lib/fiscal-calculations";

interface FiscalSystemComponentProps {
  fiscalData: FiscalSystemData;
  nominalGDP: number;
  totalPopulation: number;
  onFiscalDataChange?: (data: FiscalSystemData) => void;
  isReadOnly?: boolean;
  showAnalytics?: boolean;
  governmentStructure?: any; // Government structure data for dynamic spending
  countryId?: string; // For fetching government data
}

const COLORS = FISCAL_CHART_COLORS;

export function FiscalSystemComponent({
  fiscalData,
  nominalGDP,
  totalPopulation,
  onFiscalDataChange,
  isReadOnly = true,
  showAnalytics = true,
  governmentStructure,
  countryId,
}: FiscalSystemComponentProps) {
  // Use custom hook for all fiscal data logic
  const fiscal = useFiscalData({
    fiscalData,
    nominalGDP,
    totalPopulation,
    onFiscalDataChange,
    isReadOnly,
    governmentStructure,
  });

  const {
    view,
    editMode,
    budgetHealth,
    revenueChartData,
    spendingChartData,
    debtChartData,
    fiscalMetrics,
    handleFieldChange,
    handleTaxRateChange,
    setView,
    toggleEditMode,
  } = fiscal;

  // Get icon for category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Defense":
        return <Shield className="mr-2 h-4 w-4" />;
      case "Education":
        return <GraduationCap className="mr-2 h-4 w-4" />;
      case "Healthcare":
        return <Heart className="mr-2 h-4 w-4" />;
      case "Infrastructure":
        return <Truck className="mr-2 h-4 w-4" />;
      case "Social Security":
        return <Users2 className="mr-2 h-4 w-4" />;
      default:
        return <Building className="mr-2 h-4 w-4" />;
    }
  };

  // Custom label function for pie charts to show data directly on chart
  const renderPieLabel = (entry: any) => {
    if (entry.value < 2) return null; // Don't show labels for very small slices
    return `${entry.value.toFixed(1)}%`;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Building className="text-primary h-5 w-5" />
              Fiscal System
            </h3>
            <p className="text-muted-foreground text-sm">
              Government finances, taxation, and debt management
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <Button variant={editMode ? "default" : "outline"} size="sm" onClick={toggleEditMode}>
                {editMode ? <Eye className="mr-1 h-4 w-4" /> : <Pencil className="mr-1 h-4 w-4" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            {showAnalytics && (
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="grid w-[600px] grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="revenue">Tax Revenue</TabsTrigger>
                  <TabsTrigger value="spending">Gov Spending</TabsTrigger>
                  <TabsTrigger value="debt">Debt Mgmt</TabsTrigger>
                  <TabsTrigger value="taxes">Tax Builder</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <Badge variant="outline" className="text-xs">
                    Revenue
                  </Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Government tax revenue as % of GDP</p>
                    <p className="font-medium">
                      {formatCurrency(fiscalData.governmentRevenueTotal)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="cursor-help text-2xl font-bold">
                      {formatPercentage(fiscalData.taxRevenueGDPPercent)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total: {formatCurrency(fiscalData.governmentRevenueTotal)}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-muted-foreground text-xs">of GDP</div>
                <div className="text-muted-foreground text-xs">
                  {formatCurrency(fiscalData.taxRevenuePerCapita)} per capita
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <Badge variant="outline" className="text-xs">
                    Budget
                  </Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Government spending as % of GDP</p>
                    <p className="font-medium">
                      {formatCurrency((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="cursor-help text-2xl font-bold">
                      {formatPercentage(fiscalData.governmentBudgetGDPPercent)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Total:{" "}
                      {formatCurrency((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-muted-foreground text-xs">of GDP</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {fiscalData.budgetDeficitSurplus >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                  <Badge
                    className={budgetHealth.color.replace("text-", "bg-").replace("600", "100")}
                    variant="secondary"
                  >
                    {budgetHealth.label}
                  </Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Budget {fiscalData.budgetDeficitSurplus >= 0 ? "surplus" : "deficit"}</p>
                    <p className="font-medium">
                      {formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}
                    </p>
                    <p className="text-xs">
                      {formatPercentage(
                        Math.abs((fiscalData.budgetDeficitSurplus / nominalGDP) * 100)
                      )}{" "}
                      of GDP
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className={`cursor-help text-2xl font-bold ${budgetHealth.color}`}>
                      {formatPercentage(
                        Math.abs((fiscalData.budgetDeficitSurplus / nominalGDP) * 100)
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-muted-foreground text-xs">
                  {fiscalData.budgetDeficitSurplus >= 0 ? "Surplus" : "Deficit"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  <Badge variant="outline" className="text-xs">
                    Debt
                  </Badge>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total government debt as % of GDP</p>
                    <p className="font-medium">
                      {formatCurrency((nominalGDP * fiscalData.totalDebtGDPRatio) / 100)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <Tooltip>
                  <TooltipTrigger>
                    <div className="cursor-help text-2xl font-bold">
                      {formatPercentage(fiscalData.totalDebtGDPRatio)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Total: {formatCurrency((nominalGDP * fiscalData.totalDebtGDPRatio) / 100)}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-muted-foreground text-xs">of GDP</div>
                <div className="text-muted-foreground text-xs">
                  {formatCurrency(fiscalData.debtPerCapita)} per capita
                </div>
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
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{metric.label}</Label>
                      <span className={`text-sm font-medium ${metric.color}`}>
                        {metric.value.toFixed(1)}% of GDP
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, (metric.value / metric.optimal.max) * 100)}
                      className="h-2"
                    />
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>
                        Optimal: {metric.optimal.min}-{metric.optimal.max}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Budget Balance & Spending Preview */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={revenueChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          label={renderPieLabel}
                          labelLine={false}
                        >
                          {revenueChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value, entry: any) => (
                            <span style={{ color: entry.color }}>
                              {value}: {entry.payload?.value?.toFixed(1)}%
                            </span>
                          )}
                        />
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
                    {spendingChartData
                      .slice(0, 5)
                      .map((item: { category: string; amount: number; percent: number }) => (
                        <div key={item.category} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {getCategoryIcon(item.category)}
                              <span className="text-sm">{item.category}</span>
                            </div>
                            <span className="text-sm font-medium">{item.percent.toFixed(1)}%</span>
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
                        onChange={(e) =>
                          handleFieldChange("taxRevenueGDPPercent", parseFloat(e.target.value) || 0)
                        }
                        step="0.1"
                        min="0"
                        max="50"
                      />
                    </div>

                    {/* Tax Rate Controls - Added from Builder */}
                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Sales Tax Rate</Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="25"
                              step="0.1"
                              value={fiscalData.taxRates.salesTaxRate}
                              onChange={(e) =>
                                handleTaxRateChange("salesTaxRate", parseFloat(e.target.value))
                              }
                              className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                            />
                            <div className="text-muted-foreground flex justify-between text-xs">
                              <span>0%</span>
                              <span className="font-medium">
                                {fiscalData.taxRates.salesTaxRate.toFixed(1)}%
                              </span>
                              <span>25%</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Property Tax Rate</Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="5"
                              step="0.1"
                              value={fiscalData.taxRates.propertyTaxRate}
                              onChange={(e) =>
                                handleTaxRateChange("propertyTaxRate", parseFloat(e.target.value))
                              }
                              className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                            />
                            <div className="text-muted-foreground flex justify-between text-xs">
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
                          <Label className="text-sm font-medium">Payroll Tax Rate</Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="0.1"
                              value={fiscalData.taxRates.payrollTaxRate}
                              onChange={(e) =>
                                handleTaxRateChange("payrollTaxRate", parseFloat(e.target.value))
                              }
                              className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                            />
                            <div className="text-muted-foreground flex justify-between text-xs">
                              <span>0%</span>
                              <span className="font-medium">
                                {fiscalData.taxRates.payrollTaxRate.toFixed(1)}%
                              </span>
                              <span>30%</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Wealth Tax Rate</Label>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.1"
                              value={fiscalData.taxRates.wealthTaxRate}
                              onChange={(e) =>
                                handleTaxRateChange("wealthTaxRate", parseFloat(e.target.value))
                              }
                              className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                            />
                            <div className="text-muted-foreground flex justify-between text-xs">
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
                        Changes to tax revenue will affect government income and budget
                        calculations.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-muted-foreground text-sm">Total Tax Revenue</div>
                        <div className="text-lg font-semibold">
                          {formatCurrency(fiscalData.governmentRevenueTotal)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm">Tax % of GDP</div>
                        <div className="text-lg font-semibold">
                          {fiscalData.taxRevenueGDPPercent.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Revenue Composition Chart */}
                    <div className="mt-4 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => `${value}%`} />
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Bar dataKey="value" name="% of GDP">
                            {revenueChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Tax Rates Display */}
                    <div className="border-t pt-4">
                      <h4 className="mb-3 text-sm font-semibold">Tax Rates by Category</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sales Tax:</span>
                          <span className="font-medium">
                            {(fiscalData.taxRates?.salesTaxRate || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Property Tax:</span>
                          <span className="font-medium">
                            {(fiscalData.taxRates?.propertyTaxRate || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payroll Tax:</span>
                          <span className="font-medium">
                            {(fiscalData.taxRates?.payrollTaxRate || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Wealth Tax:</span>
                          <span className="font-medium">
                            {(fiscalData.taxRates?.wealthTaxRate || 0).toFixed(1)}%
                          </span>
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
                          onChange={(e) =>
                            handleFieldChange(
                              "internalDebtGDPPercent",
                              parseFloat(e.target.value) || 0
                            )
                          }
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
                          onChange={(e) =>
                            handleFieldChange(
                              "externalDebtGDPPercent",
                              parseFloat(e.target.value) || 0
                            )
                          }
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
                        onChange={(e) =>
                          handleFieldChange("interestRates", parseFloat(e.target.value) / 100 || 0)
                        } // Convert back to decimal
                        step="0.1"
                        min="0"
                        max="20"
                      />
                    </div>

                    {/* Debt projection chart - builder style */}
                    <div className="bg-muted/30 mt-4 rounded-lg p-4">
                      <h5 className="mb-2 text-sm font-medium">Debt Service Projection</h5>
                      <div className="text-muted-foreground mb-3 text-sm">
                        Annual debt service cost is {formatCurrency(fiscalData.debtServiceCosts)},
                        which is{" "}
                        {(
                          (fiscalData.debtServiceCosts / fiscalData.governmentRevenueTotal) *
                          100
                        ).toFixed(1)}
                        % of annual revenue.
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
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="text-muted-foreground mb-1 text-sm">Internal Debt</div>
                        <div className="text-xl font-bold">
                          {fiscalData.internalDebtGDPPercent.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground text-xs">of GDP</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="text-muted-foreground mb-1 text-sm">External Debt</div>
                        <div className="text-xl font-bold">
                          {fiscalData.externalDebtGDPPercent.toFixed(1)}%
                        </div>
                        <div className="text-muted-foreground text-xs">of GDP</div>
                      </div>
                    </div>

                    {/* Debt Composition Chart */}
                    <div className="mt-4 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={debtChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }: any) =>
                              `${name}: ${value ? value.toFixed(1) : "0"}%`
                            }
                          >
                            {debtChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-lg border p-4">
                      <h4 className="mb-3 text-sm font-semibold">Debt Service Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Debt:</span>
                          <span className="font-medium">
                            {fiscalData.totalDebtGDPRatio.toFixed(1)}% of GDP
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Debt per Capita:</span>
                          <span className="font-medium">
                            {formatCurrency(fiscalData.debtPerCapita)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Interest Rate:</span>
                          <span className="font-medium">
                            {(fiscalData.interestRates * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual Debt Service:</span>
                          <span className="font-medium">
                            {formatCurrency(fiscalData.debtServiceCosts)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Service/Revenue Ratio:</span>
                          <span className="font-medium">
                            {(
                              (fiscalData.debtServiceCosts / fiscalData.governmentRevenueTotal) *
                              100
                            ).toFixed(1)}
                            %
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

        {view === "spending" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Government Spending Breakdown</CardTitle>
                <CardDescription>
                  Detailed analysis of government expenditures by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Enhanced Spending Chart */}
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={spendingChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                        <YAxis
                          yAxisId="left"
                          label={{ value: "% of Budget", angle: -90, position: "insideLeft" }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{ value: "Amount (Billions)", angle: 90, position: "insideRight" }}
                        />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [
                            name === "percent" ? `${value.toFixed(1)}%` : formatCurrency(value),
                            name === "percent" ? "% of Budget" : "Amount",
                          ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="percent" fill="#3b82f6" name="% of Budget">
                          <LabelList
                            dataKey="percent"
                            position="top"
                            formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                          />
                        </Bar>
                        <Bar yAxisId="right" dataKey="amount" fill="#10b981" name="Amount">
                          <LabelList
                            dataKey="amount"
                            position="top"
                            formatter={(value: any) => formatCurrency(Number(value))}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Spending Analysis Grid */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {spendingChartData.map((item: any) => (
                      <Card key={item.category}>
                        <CardContent className="p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center">
                              {getCategoryIcon(item.category)}
                              <span className="text-sm font-medium">{item.category}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-2xl font-bold">{formatCurrency(item.amount)}</div>
                            <div className="text-muted-foreground text-sm">
                              {item.percent.toFixed(1)}% of total budget
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {formatCurrency(item.amount / totalPopulation)} per capita
                            </div>
                          </div>
                          <Progress value={item.percent} className="mt-2 h-2" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Spending Efficiency Metrics */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Spending Efficiency</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Total Spending/GDP</span>
                            <Badge variant="outline">
                              {(
                                (spendingChartData.reduce(
                                  (sum: number, item: any) => sum + item.amount,
                                  0
                                ) /
                                  nominalGDP) *
                                100
                              ).toFixed(1)}
                              %
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Per Capita Spending</span>
                            <Badge variant="outline">
                              {formatCurrency(
                                spendingChartData.reduce(
                                  (sum: number, item: any) => sum + item.amount,
                                  0
                                ) / totalPopulation
                              )}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Admin Efficiency</span>
                            <Badge className="bg-green-100 text-green-800">High</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Priority Areas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {spendingChartData
                            .sort((a: any, b: any) => b.percent - a.percent)
                            .slice(0, 3)
                            .map((item: any, index: number) => (
                              <div key={item.category} className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs"
                                >
                                  {index + 1}
                                </Badge>
                                <div className="flex items-center">
                                  {getCategoryIcon(item.category)}
                                  <span className="text-sm">{item.category}</span>
                                </div>
                                <Badge className="ml-auto">{item.percent.toFixed(1)}%</Badge>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {view === "taxes" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax System Builder</CardTitle>
                <CardDescription>Design and configure your nation's tax system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Tax Structure Configuration */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold">Direct Taxes</h4>

                      {/* Personal Income Tax */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Personal Income Tax</Label>
                          <Badge>
                            {(fiscalData.taxRates?.personalIncomeTaxRates?.[0]?.rate || 20).toFixed(
                              1
                            )}
                            %
                          </Badge>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          step="1"
                          value={fiscalData.taxRates?.personalIncomeTaxRates?.[0]?.rate || 20}
                          onChange={(e) => {
                            const newRates = [
                              ...(fiscalData.taxRates?.personalIncomeTaxRates || [
                                { bracket: 50000, rate: 20 },
                              ]),
                            ];
                            newRates[0] = { ...newRates[0], rate: parseFloat(e.target.value) };
                            onFiscalDataChange?.({
                              ...fiscalData,
                              taxRates: {
                                ...fiscalData.taxRates,
                                personalIncomeTaxRates: newRates,
                              },
                            });
                          }}
                          className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>0%</span>
                          <span>Progressive Rate</span>
                          <span>50%</span>
                        </div>
                      </div>

                      {/* Corporate Tax */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Corporate Tax Rate</Label>
                          <Badge>
                            {(fiscalData.taxRates?.corporateTaxRates?.[0]?.rate || 25).toFixed(1)}%
                          </Badge>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          step="1"
                          value={fiscalData.taxRates?.corporateTaxRates?.[0]?.rate || 25}
                          onChange={(e) => {
                            const newRates = [
                              ...(fiscalData.taxRates?.corporateTaxRates || [
                                { size: "Small", rate: 25 },
                              ]),
                            ];
                            newRates[0] = { ...newRates[0], rate: parseFloat(e.target.value) };
                            onFiscalDataChange?.({
                              ...fiscalData,
                              taxRates: { ...fiscalData.taxRates, corporateTaxRates: newRates },
                            });
                          }}
                          className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>0%</span>
                          <span>Business Tax</span>
                          <span>40%</span>
                        </div>
                      </div>

                      {/* Wealth Tax */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Wealth Tax Rate</Label>
                          <Badge>{(fiscalData.taxRates?.wealthTaxRate || 0).toFixed(1)}%</Badge>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={fiscalData.taxRates?.wealthTaxRate || 0}
                          onChange={(e) =>
                            handleTaxRateChange("wealthTaxRate", parseFloat(e.target.value))
                          }
                          className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>0%</span>
                          <span>Net Worth</span>
                          <span>5%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold">Indirect Taxes</h4>

                      {/* Sales Tax */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Sales Tax (VAT)</Label>
                          <Badge>{(fiscalData.taxRates?.salesTaxRate || 0).toFixed(1)}%</Badge>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          step="0.5"
                          value={fiscalData.taxRates?.salesTaxRate || 0}
                          onChange={(e) =>
                            handleTaxRateChange("salesTaxRate", parseFloat(e.target.value))
                          }
                          className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>0%</span>
                          <span>Consumption Tax</span>
                          <span>25%</span>
                        </div>
                      </div>

                      {/* Property Tax */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Property Tax Rate</Label>
                          <Badge>{(fiscalData.taxRates?.propertyTaxRate || 0).toFixed(1)}%</Badge>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={fiscalData.taxRates?.propertyTaxRate || 0}
                          onChange={(e) =>
                            handleTaxRateChange("propertyTaxRate", parseFloat(e.target.value))
                          }
                          className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>0%</span>
                          <span>Real Estate</span>
                          <span>5%</span>
                        </div>
                      </div>

                      {/* Payroll Tax */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Payroll Tax Rate</Label>
                          <Badge>{(fiscalData.taxRates?.payrollTaxRate || 0).toFixed(1)}%</Badge>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="0.5"
                          value={fiscalData.taxRates?.payrollTaxRate || 0}
                          onChange={(e) =>
                            handleTaxRateChange("payrollTaxRate", parseFloat(e.target.value))
                          }
                          className="bg-muted h-2 w-full cursor-pointer appearance-none rounded-lg"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>0%</span>
                          <span>Social Security</span>
                          <span>30%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tax Revenue Projection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Revenue Projection</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(fiscalData.governmentRevenueTotal * 0.4)}
                          </div>
                          <div className="text-muted-foreground text-xs">Income Tax</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(fiscalData.governmentRevenueTotal * 0.25)}
                          </div>
                          <div className="text-muted-foreground text-xs">Corporate Tax</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {formatCurrency(fiscalData.governmentRevenueTotal * 0.2)}
                          </div>
                          <div className="text-muted-foreground text-xs">Sales Tax</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {formatCurrency(fiscalData.governmentRevenueTotal * 0.15)}
                          </div>
                          <div className="text-muted-foreground text-xs">Other Taxes</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tax System Summary */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">Tax System Configuration</div>
                      <p className="mt-1 text-sm">
                        Total projected revenue:{" "}
                        <strong>{formatCurrency(fiscalData.governmentRevenueTotal)}</strong>(
                        {fiscalData.taxRevenueGDPPercent.toFixed(1)}% of GDP)
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Effective tax rate:{" "}
                        {((fiscalData.governmentRevenueTotal / nominalGDP) * 100).toFixed(1)}% of
                        GDP
                      </p>
                    </AlertDescription>
                  </Alert>
                </div>
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
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 text-sm font-semibold">Debt Sustainability</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {fiscalData.totalDebtGDPRatio <= 60 ? (
                          <Badge className="bg-green-100 text-green-800">Sustainable</Badge>
                        ) : fiscalData.totalDebtGDPRatio <= 90 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Moderate Risk</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">High Risk</Badge>
                        )}
                        <span className="text-muted-foreground text-sm">
                          Debt-to-GDP: {fiscalData.totalDebtGDPRatio.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {fiscalData.totalDebtGDPRatio <= 60
                          ? "Debt levels are within sustainable limits."
                          : fiscalData.totalDebtGDPRatio <= 90
                            ? "Debt is elevated but manageable with prudent fiscal policy."
                            : "High debt levels require immediate fiscal consolidation."}
                      </p>
                    </div>
                  </div>

                  {/* Revenue Adequacy */}
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 text-sm font-semibold">Revenue Adequacy</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {fiscalData.taxRevenueGDPPercent >= 20 ? (
                          <Badge className="bg-green-100 text-green-800">Adequate</Badge>
                        ) : fiscalData.taxRevenueGDPPercent >= 15 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Moderate</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">Low</Badge>
                        )}
                        <span className="text-muted-foreground text-sm">
                          Tax-to-GDP: {fiscalData.taxRevenueGDPPercent.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {fiscalData.taxRevenueGDPPercent >= 20
                          ? "Revenue collection is sufficient for government operations."
                          : fiscalData.taxRevenueGDPPercent >= 15
                            ? "Revenue is adequate but could be improved."
                            : "Low revenue constrains government capacity."}
                      </p>
                    </div>
                  </div>

                  {/* Budget Balance */}
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 text-sm font-semibold">Budget Balance</h4>
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
                        <span className="text-muted-foreground text-sm">
                          {fiscalData.budgetDeficitSurplus >= 0
                            ? `Surplus: ${formatCurrency(fiscalData.budgetDeficitSurplus)}`
                            : `Deficit: ${formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus))}`}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
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
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 text-sm font-semibold">Fiscal Space</h4>
                    <Progress
                      value={Math.max(0, 100 - fiscalData.totalDebtGDPRatio)}
                      className="mb-2 h-2"
                    />
                    <p className="text-muted-foreground text-xs">
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
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                      <div>
                        <span className="font-medium">Reduce Debt Burden</span>: High debt levels
                        may constrain growth. Consider debt restructuring and gradual reduction.
                      </div>
                    </div>
                  )}

                  {fiscalData.budgetDeficitSurplus < -0.05 * nominalGDP && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                      <div>
                        <span className="font-medium">Address Budget Deficit</span>: Large deficits
                        may lead to unsustainable debt accumulation. Consider revenue enhancement or
                        spending efficiency.
                      </div>
                    </div>
                  )}

                  {fiscalData.taxRevenueGDPPercent < 15 && (
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 text-blue-600" />
                      <div>
                        <span className="font-medium">Improve Revenue Collection</span>: Tax revenue
                        is below recommended levels. Consider tax base broadening or improved
                        compliance.
                      </div>
                    </div>
                  )}

                  {fiscalData.debtServiceCosts / fiscalData.governmentRevenueTotal > 0.15 && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                      <div>
                        <span className="font-medium">Manage Debt Service Costs</span>: Debt
                        servicing exceeds 15% of revenue, creating fiscal pressure. Consider
                        refinancing or debt management strategies.
                      </div>
                    </div>
                  )}

                  {fiscalData.budgetDeficitSurplus > 0.02 * nominalGDP && (
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 text-blue-600" />
                      <div>
                        <span className="font-medium">Utilize Budget Surplus</span>: Consider debt
                        reduction, strategic investments, or building fiscal reserves.
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
            <div className="font-medium">
              Fiscal Status: <span className={budgetHealth.color}>{budgetHealth.label}</span>
            </div>
            <p className="mt-1 text-sm">
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
