// src/app/countries/_components/economy/FiscalSystem.tsx
"use client";

import { useState } from "react";
import {
  DollarSign,
  PieChart,
  Percent,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Building,
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  MoreHorizontal,
  Info,
  AlertTriangle,
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

export interface FiscalSystemData {
  // Revenue
  taxRevenueGDPPercent: number;
  governmentRevenueTotal: number;
  taxRevenuePerCapita: number;
  
  // Spending
  governmentBudgetGDPPercent: number;
  budgetDeficitSurplus: number;
  
  // Debt
  internalDebtGDPPercent: number;
  externalDebtGDPPercent: number;
  totalDebtGDPRatio: number;
  debtPerCapita: number;
  debtServiceCosts: number;
  interestRates: number;
  
  // Tax Rates
  taxRates: {
    personalIncomeTaxRates: Array<{ bracket: number; rate: number }>;
    corporateTaxRates: Array<{ size: string; rate: number }>;
    salesTaxRate: number;
    propertyTaxRate: number;
    payrollTaxRate: number;
    wealthTaxRate: number;
    exciseTaxRates: Array<{ type: string; rate: number }>;
  };
  
  // Spending Categories
  governmentSpendingByCategory: Array<{
    category: string;
    amount: number;
    percent: number;
  }>;
}

export interface RealCountryFiscalData {
  name: string;
  taxRevenuePercent: number;
}

interface FiscalSystemProps {
  fiscalData: FiscalSystemData;
  referenceCountry?: RealCountryFiscalData;
  nominalGDP: number;
  totalPopulation: number;
  onFiscalDataChange: (fiscalData: FiscalSystemData) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

export function FiscalSystem({
  fiscalData,
  referenceCountry,
  nominalGDP,
  totalPopulation,
  onFiscalDataChange,
  isReadOnly = false,
  showComparison = true,
}: FiscalSystemProps) {
  const [selectedView, setSelectedView] = useState<'revenue' | 'spending' | 'debt'>('revenue');

  const handleInputChange = (field: keyof FiscalSystemData, value: number | any) => {
    const newFiscalData = { ...fiscalData, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'taxRevenueGDPPercent') {
      newFiscalData.governmentRevenueTotal = (nominalGDP * value) / 100;
      newFiscalData.taxRevenuePerCapita = newFiscalData.governmentRevenueTotal / totalPopulation;
    } else if (field === 'governmentBudgetGDPPercent') {
      const totalSpending = (nominalGDP * value) / 100;
      newFiscalData.budgetDeficitSurplus = newFiscalData.governmentRevenueTotal - totalSpending;
      
      // Update spending by category amounts
      newFiscalData.governmentSpendingByCategory = newFiscalData.governmentSpendingByCategory.map(category => ({
        category: category.category,
        amount: (totalSpending * category.percent) / 100,
        percent: category.percent
      }));
    }
    
    if (field === 'internalDebtGDPPercent' || field === 'externalDebtGDPPercent') {
      newFiscalData.totalDebtGDPRatio = newFiscalData.internalDebtGDPPercent + newFiscalData.externalDebtGDPPercent;
      newFiscalData.debtPerCapita = (nominalGDP * newFiscalData.totalDebtGDPRatio) / (100 * totalPopulation);
      newFiscalData.debtServiceCosts = (nominalGDP * newFiscalData.totalDebtGDPRatio * newFiscalData.interestRates) / 10000;
    }
    
    onFiscalDataChange(newFiscalData);
  };

  const handleTaxRateChange = (category: string, index: number, field: string, value: number) => {
    const newTaxRates = { ...fiscalData.taxRates };
    
    if (category === 'personalIncomeTaxRates' && newTaxRates.personalIncomeTaxRates[index]) {
      const currentRate = newTaxRates.personalIncomeTaxRates[index];
      newTaxRates.personalIncomeTaxRates[index] = {
        bracket: field === 'bracket' ? value : currentRate!.bracket,
        rate: field === 'rate' ? value : currentRate!.rate
      };
    } else if (category === 'corporateTaxRates' && newTaxRates.corporateTaxRates[index]) {
      const currentRate = newTaxRates.corporateTaxRates[index];
      newTaxRates.corporateTaxRates[index] = {
        size: field === 'size' ? String(value) : currentRate!.size,
        rate: field === 'rate' ? value : currentRate!.rate
      };
    }
    
    onFiscalDataChange({ ...fiscalData, taxRates: newTaxRates });
  };

  const handleSpendingCategoryChange = (index: number, percent: number) => {
    const newCategories = [...fiscalData.governmentSpendingByCategory];
    const totalSpending = (nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100;
    
    if (newCategories[index]) {
      newCategories[index] = {
        category: newCategories[index]!.category,
        percent,
        amount: (totalSpending * percent) / 100
      };
    }
    
    onFiscalDataChange({
      ...fiscalData,
      governmentSpendingByCategory: newCategories
    });
  };

  const getBudgetHealth = () => {
    const deficit = fiscalData.budgetDeficitSurplus || 0;
    const deficitPercent = (deficit / nominalGDP) * 100;
    
    if (deficitPercent > 1) return { color: "text-green-600", label: "Surplus", icon: TrendingUp };
    if (deficitPercent > -2) return { color: "text-blue-600", label: "Balanced", icon: TrendingUp };
    if (deficitPercent > -5) return { color: "text-yellow-600", label: "Moderate Deficit", icon: TrendingDown };
    return { color: "text-red-600", label: "High Deficit", icon: TrendingDown };
  };

  const budgetHealth = getBudgetHealth();
  const HealthIcon = budgetHealth.icon;

  const spendingCategoryIcons: { [key: string]: React.ElementType } = {
    Defense: Shield,
    Education: GraduationCap,
    Healthcare: Heart,
    Infrastructure: Truck,
    "Social Security": Users2,
    Other: MoreHorizontal,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Fiscal System
          </h3>
          <p className="text-sm text-muted-foreground">
            Government revenue, spending, and debt management
          </p>
        </div>
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="debt">Debt</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Fiscal Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(fiscalData.governmentRevenueTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {fiscalData.taxRevenueGDPPercent.toFixed(1)}% of GDP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              {fiscalData.governmentBudgetGDPPercent.toFixed(1)}% of GDP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Balance</CardTitle>
            <HealthIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${budgetHealth.color}`}>
              {formatCurrency(Math.abs(fiscalData.budgetDeficitSurplus || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              {(fiscalData.budgetDeficitSurplus || 0) >= 0 ? 'Surplus' : 'Deficit'}
            </p>
            <Badge variant="outline" className={budgetHealth.color}>
              {budgetHealth.label}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fiscalData.totalDebtGDPRatio.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(fiscalData.debtPerCapita)} per capita
            </p>
          </CardContent>
        </Card>
      </div>

      <TabsContent value="revenue" className="space-y-6">
        {/* Tax Revenue Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Tax Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxRevenue">Tax Revenue (% of GDP)</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{fiscalData.taxRevenueGDPPercent.toFixed(1)}%</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[fiscalData.taxRevenueGDPPercent]}
                        onValueChange={(value) => handleInputChange('taxRevenueGDPPercent', value[0]!)}
                        max={50}
                        min={5}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>5%</span>
                      <span className="font-medium text-foreground">
                        {fiscalData.taxRevenueGDPPercent.toFixed(1)}%
                      </span>
                      <span>50%</span>
                    </div>
                  </>
                )}
                {referenceCountry && (
                  <div className="text-xs text-muted-foreground">
                    Ref: {referenceCountry.taxRevenuePercent.toFixed(1)}%
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Tax Revenue per Capita</Label>
                <div className="text-2xl font-bold">{formatCurrency(fiscalData.taxRevenuePerCapita)}</div>
                <div className="text-xs text-muted-foreground">
                  Total: {formatCurrency(fiscalData.governmentRevenueTotal)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sales Tax */}
              <div className="space-y-2">
                <Label>Sales Tax Rate</Label>
                {isReadOnly ? (
                  <div className="text-xl font-bold">{fiscalData.taxRates.salesTaxRate.toFixed(1)}%</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[fiscalData.taxRates.salesTaxRate]}
                        onValueChange={(value) => handleInputChange('taxRates', {
                          ...fiscalData.taxRates,
                          salesTaxRate: value[0]!
                        })}
                        max={25}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {fiscalData.taxRates.salesTaxRate.toFixed(1)}%
                      </span>
                      <span>25%</span>
                    </div>
                  </>
                )}
              </div>

              {/* Property Tax */}
              <div className="space-y-2">
                <Label>Property Tax Rate</Label>
                {isReadOnly ? (
                  <div className="text-xl font-bold">{fiscalData.taxRates.propertyTaxRate.toFixed(1)}%</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[fiscalData.taxRates.propertyTaxRate]}
                        onValueChange={(value) => handleInputChange('taxRates', {
                          ...fiscalData.taxRates,
                          propertyTaxRate: value[0]!
                        })}
                        max={5}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {fiscalData.taxRates.propertyTaxRate.toFixed(1)}%
                      </span>
                      <span>5%</span>
                    </div>
                  </>
                )}
              </div>

              {/* Payroll Tax */}
              <div className="space-y-2">
                <Label>Payroll Tax Rate</Label>
                {isReadOnly ? (
                  <div className="text-xl font-bold">{fiscalData.taxRates.payrollTaxRate.toFixed(1)}%</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[fiscalData.taxRates.payrollTaxRate]}
                        onValueChange={(value) => handleInputChange('taxRates', {
                          ...fiscalData.taxRates,
                          payrollTaxRate: value[0]!
                        })}
                        max={30}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {fiscalData.taxRates.payrollTaxRate.toFixed(1)}%
                      </span>
                      <span>30%</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="spending" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              Government Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Government Budget (% of GDP)</Label>
              {isReadOnly ? (
                <div className="text-2xl font-bold">{fiscalData.governmentBudgetGDPPercent.toFixed(1)}%</div>
              ) : (
                <>
                  <div className="px-3">
                    <Slider
                      value={[fiscalData.governmentBudgetGDPPercent]}
                      onValueChange={(value) => handleInputChange('governmentBudgetGDPPercent', value[0]!)}
                      max={60}
                      min={10}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10%</span>
                    <span className="font-medium text-foreground">
                      {fiscalData.governmentBudgetGDPPercent.toFixed(1)}%
                    </span>
                    <span>60%</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spending Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fiscalData.governmentSpendingByCategory.map((category, index) => {
              const Icon = spendingCategoryIcons[category.category] || MoreHorizontal;
              return (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {category.category}
                    </Label>
                    <div className="text-sm font-semibold">
                      {category.percent.toFixed(1)}% ({formatCurrency(category.amount)})
                    </div>
                  </div>
                  {!isReadOnly && (
                    <>
                      <div className="px-3">
                        <Slider
                          value={[category.percent]}
                          onValueChange={(value) => handleSpendingCategoryChange(index, value[0]!)}
                          max={40}
                          min={0}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                      <Progress value={category.percent * 2.5} className="h-2" />
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="debt" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Debt Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Internal Debt (% of GDP)</Label>
                {isReadOnly ? (
                  <div className="text-xl font-bold">{fiscalData.internalDebtGDPPercent.toFixed(1)}%</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[fiscalData.internalDebtGDPPercent]}
                        onValueChange={(value) => handleInputChange('internalDebtGDPPercent', value[0]!)}
                        max={150}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {fiscalData.internalDebtGDPPercent.toFixed(1)}%
                      </span>
                      <span>150%</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>External Debt (% of GDP)</Label>
                {isReadOnly ? (
                  <div className="text-xl font-bold">{fiscalData.externalDebtGDPPercent.toFixed(1)}%</div>
                ) : (
                  <>
                    <div className="px-3">
                      <Slider
                        value={[fiscalData.externalDebtGDPPercent]}
                        onValueChange={(value) => handleInputChange('externalDebtGDPPercent', value[0]!)}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="font-medium text-foreground">
                        {fiscalData.externalDebtGDPPercent.toFixed(1)}%
                      </span>
                      <span>100%</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRates">Interest Rates (%)</Label>
                {isReadOnly ? (
                  <div className="text-xl font-bold">{fiscalData.interestRates.toFixed(1)}%</div>
                ) : (
                  <Input
                    id="interestRates"
                    type="number"
                    value={fiscalData.interestRates}
                    onChange={(e) => handleInputChange('interestRates', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debt Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Debt:</span>
                  <span className="font-medium">{fiscalData.totalDebtGDPRatio.toFixed(1)}% GDP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per Capita:</span>
                  <span className="font-medium">{formatCurrency(fiscalData.debtPerCapita)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Service:</span>
                  <span className="font-medium">{formatCurrency(fiscalData.debtServiceCosts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service % of Budget:</span>
                  <span className="font-medium">
                    {((fiscalData.debtServiceCosts / ((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Debt Health Indicator */}
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  {fiscalData.totalDebtGDPRatio <= 60 ? (
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  ) : fiscalData.totalDebtGDPRatio <= 90 ? (
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {fiscalData.totalDebtGDPRatio <= 60 ? 'Sustainable' :
                     fiscalData.totalDebtGDPRatio <= 90 ? 'Moderate Risk' : 'High Risk'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fiscalData.totalDebtGDPRatio <= 60 
                    ? "Debt levels are sustainable and manageable."
                    : fiscalData.totalDebtGDPRatio <= 90
                    ? "Debt levels require monitoring and fiscal discipline."
                    : "High debt levels may constrain fiscal policy options."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium mb-1">
            Fiscal Health: <span className={budgetHealth.color}>{budgetHealth.label}</span>
          </div>
          <div className="text-sm">
            {(fiscalData.budgetDeficitSurplus || 0) >= 0
              ? `Running a surplus of ${formatCurrency(fiscalData.budgetDeficitSurplus)} allows for debt reduction and future investments.`
              : Math.abs(((fiscalData.budgetDeficitSurplus || 0) / nominalGDP) * 100) <= 2
              ? "Running a manageable deficit. Monitor debt levels and consider revenue increases."
              : "High deficit requires attention. Consider reducing spending or increasing revenue to maintain fiscal sustainability."
            }
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}