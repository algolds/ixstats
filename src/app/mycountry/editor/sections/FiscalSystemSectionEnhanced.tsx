"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Scale, AlertTriangle, Info } from 'lucide-react';
import { EnhancedSlider } from '~/app/builder/primitives/enhanced';
import { TaxBuilder, type TaxBuilderState } from '~/components/tax-system/TaxBuilder';
import type { EconomicInputs } from '~/app/builder/lib/economy-data-service';
import { api } from '~/trpc/react';
import { usePendingLocks } from "../hooks/usePendingLocks";

interface FiscalSystemSectionEnhancedProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  showAdvanced?: boolean;
  countryId: string;
  onTaxSystemSave?: (taxData: TaxBuilderState) => void;
  onTaxSystemChange?: (taxData: TaxBuilderState) => void;
}

export function FiscalSystemSectionEnhanced({
  inputs,
  onInputsChange,
  showAdvanced = false,
  countryId,
  onTaxSystemSave,
  onTaxSystemChange
}: FiscalSystemSectionEnhancedProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const fiscal = inputs.fiscalSystem;
  const nominalGDP = inputs.coreIndicators.nominalGDP;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  const { isLocked } = usePendingLocks();

  // Fetch tax system data
  const { data: taxSystemData, refetch: refetchTaxSystem } = api.taxSystem.getByCountryId.useQuery(
    { countryId: countryId || 'placeholder' },
    {
      enabled: !!countryId && countryId.length > 0,
      retry: false
    }
  );

  // Calculate metrics
  const taxRevenue = (nominalGDP * fiscal.taxRevenueGDPPercent) / 100;
  const govBudget = (nominalGDP * fiscal.governmentBudgetGDPPercent) / 100;
  const budgetBalance = taxRevenue - govBudget;
  const totalDebt = (nominalGDP * fiscal.totalDebtGDPRatio) / 100;
  const perCapitaDebt = totalDebt / totalPopulation;

  const handleFiscalChange = (field: string, value: number) => {
    const newFiscal = { ...fiscal };

    if (field === 'taxRevenueGDPPercent') {
      newFiscal.taxRevenueGDPPercent = value;
    } else if (field === 'governmentBudgetGDPPercent') {
      newFiscal.governmentBudgetGDPPercent = value;
    } else if (field === 'totalDebtGDPRatio') {
      newFiscal.totalDebtGDPRatio = value;
    }

    // Recalculate budget deficit/surplus
    const newTaxRevenue = (nominalGDP * newFiscal.taxRevenueGDPPercent) / 100;
    const newGovBudget = (nominalGDP * newFiscal.governmentBudgetGDPPercent) / 100;
    newFiscal.budgetDeficitSurplus = ((newTaxRevenue - newGovBudget) / nominalGDP) * 100;

    onInputsChange({ ...inputs, fiscalSystem: newFiscal });
  };

  const handleTaxSystemSave = async (taxData: TaxBuilderState) => {
    if (onTaxSystemSave) {
      onTaxSystemSave(taxData);
    }
    await refetchTaxSystem();
  };

  const formatCurrency = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const budgetStatus = budgetBalance >= 0 ? 'surplus' : 'deficit';
  const debtStatus = fiscal.totalDebtGDPRatio > 100 ? 'critical' : fiscal.totalDebtGDPRatio > 60 ? 'warning' : 'healthy';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Fiscal System & Taxation</h3>
          <p className="text-sm text-muted-foreground">
            Configure tax revenue, government spending, debt, and tax structure
          </p>
        </div>
        <Badge
          variant={budgetStatus === 'surplus' ? 'default' : 'destructive'}
          className="px-3 py-1"
        >
          {budgetStatus === 'surplus' ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(budgetBalance))}
        </Badge>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fiscal.taxRevenueGDPPercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Tax Revenue</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(taxRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fiscal.governmentBudgetGDPPercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Gov Budget</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(govBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${budgetStatus === 'surplus' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {budgetStatus === 'surplus' ? (
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{fiscal.budgetDeficitSurplus.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(budgetBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${debtStatus === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : debtStatus === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <AlertTriangle className={`h-5 w-5 ${debtStatus === 'critical' ? 'text-red-600 dark:text-red-400' : debtStatus === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{fiscal.totalDebtGDPRatio.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Debt/GDP</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(totalDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Revenue & Budget</TabsTrigger>
          <TabsTrigger value="debt">Debt Management</TabsTrigger>
          <TabsTrigger value="taxation">Tax System</TabsTrigger>
        </TabsList>

        {/* Revenue & Budget Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Tax Revenue</CardTitle>
              <CardDescription>
                Total government revenue as % of GDP. This is the high-level revenue mix; detailed tax rules are configured under the Tax System tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Tax Revenue (% of GDP)"
                value={fiscal.taxRevenueGDPPercent}
                onChange={(value) => handleFiscalChange('taxRevenueGDPPercent', value)}
                min={5}
                max={60}
                step={0.5}
                unit="%"
                description={`${formatCurrency(taxRevenue)} total revenue`}
                disabled={isLocked('taxRevenueGDPPercent')}
              />
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {fiscal.taxRevenueGDPPercent < 20 && "Low tax revenue - limited government services"}
                  {fiscal.taxRevenueGDPPercent >= 20 && fiscal.taxRevenueGDPPercent < 35 && "Moderate tax revenue - balanced approach"}
                  {fiscal.taxRevenueGDPPercent >= 35 && "High tax revenue - extensive government services"}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Government Budget</CardTitle>
              <CardDescription>
                Total government spending as % of GDP. The allocations to departments are managed in the Government builder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Government Budget (% of GDP)"
                value={fiscal.governmentBudgetGDPPercent}
                onChange={(value) => handleFiscalChange('governmentBudgetGDPPercent', value)}
                min={10}
                max={70}
                step={0.5}
                unit="%"
                description={`${formatCurrency(govBudget)} total spending`}
                disabled={isLocked('governmentBudgetGDPPercent')}
              />
              {budgetBalance < 0 && (
                <Alert className="mt-4" variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Budget deficit of {formatCurrency(Math.abs(budgetBalance))} will increase national debt
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debt Tab */}
        <TabsContent value="debt" className="space-y-6 mt-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">National Debt</CardTitle>
              <CardDescription>Total government debt as % of GDP</CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSlider
                label="Total Debt (% of GDP)"
                value={fiscal.totalDebtGDPRatio}
                onChange={(value) => handleFiscalChange('totalDebtGDPRatio', value)}
                min={0}
                max={300}
                step={1}
                unit="%"
                description={`${formatCurrency(totalDebt)} total debt • ${formatCurrency(perCapitaDebt)} per capita`}
                disabled={isLocked('totalDebtGDPRatio')}
              />
              <Alert className="mt-4" variant={debtStatus === 'critical' ? 'destructive' : debtStatus === 'warning' ? 'default' : 'default'}>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {debtStatus === 'healthy' && "Healthy debt levels - sustainable fiscal position"}
                  {debtStatus === 'warning' && "Elevated debt levels - monitor fiscal sustainability"}
                  {debtStatus === 'critical' && "Critical debt levels - urgent fiscal reforms needed"}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base">Debt Analysis</CardTitle>
              <CardDescription>Key debt metrics and sustainability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Debt</p>
                  <p className="text-xl font-bold">{formatCurrency(totalDebt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Per Capita Debt</p>
                  <p className="text-xl font-bold">{formatCurrency(perCapitaDebt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Debt/Revenue Ratio</p>
                  <p className="text-xl font-bold">{(totalDebt / taxRevenue).toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Annual Deficit</p>
                  <p className="text-xl font-bold">{formatCurrency(Math.abs(budgetBalance))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Taxation Tab */}
        <TabsContent value="taxation" className="space-y-6 mt-6">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Tax System Configuration
              </CardTitle>
              <CardDescription>
                Design your comprehensive tax structure with brackets, exemptions, and deductions. These mechanics feed into your overall revenue but are distinct from the simple revenue % slider above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaxBuilder
                initialData={taxSystemData || undefined}
                onChange={(data) => {
                  // Tax system changes will be tracked in the parent editor
                  if (process.env.NODE_ENV !== 'production') {
                    console.log('Tax system changed:', data);
                  }
                  if (onTaxSystemChange) {
                    onTaxSystemChange(data);
                  }
                }}
                hideSaveButton={true}
                isReadOnly={false}
                countryId={countryId}
                showAtomicIntegration={true}
                enableAutoSync={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
