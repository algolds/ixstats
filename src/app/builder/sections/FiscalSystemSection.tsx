"use client";

import React, { useState, useMemo } from 'react';
import { Coins, TrendingUp, TrendingDown, DollarSign, Building, CreditCard, Shield, PieChart, AlertTriangle } from 'lucide-react';
import {
  GlassSlider,
  GlassDial,
  GlassNumberPicker,
  GlassToggle,
  GlassBarChart,
  GoogleGaugeChart,
  GoogleLineChart,
} from '~/components/charts';
import type { EconomicInputs, FiscalSystemData } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';
import { 
  SectionBase, 
  SectionLayout, 
  sectionConfigs, 
  sectionUtils,
  type ExtendedSectionProps 
} from '../components/glass/SectionBase';
import { FormGrid } from '../components/glass/ProgressiveViews';

interface FiscalSystemSectionProps extends ExtendedSectionProps {
  onToggleAdvanced?: () => void;
}

export function FiscalSystemSection({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: FiscalSystemSectionProps) {
  const [selectedView, setSelectedView] = useState<'revenue' | 'spending' | 'debt'>('revenue');
  
  const fiscalSystem = inputs.fiscalSystem;
  const nominalGDP = inputs.coreIndicators.nominalGDP;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  
  // Calculate metrics for overview
  const metrics = useMemo(() => {
    const totalRevenue = fiscalSystem.governmentRevenueTotal;
    const totalSpending = (nominalGDP * fiscalSystem.governmentBudgetGDPPercent) / 100;
    const budgetBalance = fiscalSystem.budgetDeficitSurplus || 0;
    const budgetHealth = budgetBalance >= 0 ? 'up' : Math.abs(budgetBalance / nominalGDP) < 0.03 ? 'neutral' : 'down';
    
    return [
      {
        label: "Tax Revenue",
        value: sectionUtils.formatCurrency(totalRevenue),
        unit: `(${fiscalSystem.taxRevenueGDPPercent.toFixed(1)}% GDP)`,
        icon: DollarSign,
        theme: 'blue' as const
      },
      {
        label: "Government Spending",
        value: sectionUtils.formatCurrency(totalSpending),
        unit: `(${fiscalSystem.governmentBudgetGDPPercent.toFixed(1)}% GDP)`,
        icon: Building,
        theme: 'blue' as const
      },
      {
        label: "Budget Balance",
        value: sectionUtils.formatCurrency(Math.abs(budgetBalance)),
        unit: budgetBalance >= 0 ? 'Surplus' : 'Deficit',
        icon: budgetBalance >= 0 ? TrendingUp : TrendingDown,
        theme: budgetBalance >= 0 ? 'emerald' : 'red' as const,
        trend: budgetHealth
      },
      {
        label: "Public Debt",
        value: `${fiscalSystem.totalDebtGDPRatio.toFixed(1)}%`,
        unit: "of GDP",
        icon: CreditCard,
        theme: fiscalSystem.totalDebtGDPRatio > 90 ? 'red' : fiscalSystem.totalDebtGDPRatio > 60 ? 'gold' : 'blue' as const,
        trend: fiscalSystem.totalDebtGDPRatio > 90 ? 'down' : 'neutral'
      }
    ];
  }, [fiscalSystem, nominalGDP]);

  // Handle input changes with proper type safety
  const handleFiscalChange = (field: keyof FiscalSystemData, value: any) => {
    const newFiscalSystem = { ...fiscalSystem, [field]: value };
    
    // Auto-calculate derived values
    if (field === 'taxRevenueGDPPercent') {
      newFiscalSystem.governmentRevenueTotal = (nominalGDP * value) / 100;
      newFiscalSystem.taxRevenuePerCapita = newFiscalSystem.governmentRevenueTotal / totalPopulation;
    } else if (field === 'governmentBudgetGDPPercent') {
      const totalSpending = (nominalGDP * value) / 100;
      newFiscalSystem.budgetDeficitSurplus = newFiscalSystem.governmentRevenueTotal - totalSpending;
    }
    
    onInputsChange({ ...inputs, fiscalSystem: newFiscalSystem });
  };

  const handleTaxRateChange = (category: 'income' | 'corporate' | 'sales', value: number) => {
    const newTaxRates = { ...fiscalSystem.taxRates };
    
    if (category === 'income' && newTaxRates.personalIncomeTaxRates[1]) {
      newTaxRates.personalIncomeTaxRates[1].rate = value;
    } else if (category === 'corporate' && newTaxRates.corporateTaxRates[1]) {
      newTaxRates.corporateTaxRates[1].rate = value;
    } else if (category === 'sales') {
      newTaxRates.salesTaxRate = value;
    }
    
    handleFiscalChange('taxRates', newTaxRates);
  };

  const handleSpendingCategoryChange = (index: number, percent: number) => {
    const newCategories = [...fiscalSystem.governmentSpendingByCategory];
    const totalSpending = (nominalGDP * fiscalSystem.governmentBudgetGDPPercent) / 100;
    
    if (newCategories[index]) {
      newCategories[index] = {
        category: newCategories[index].category,
        percent,
        amount: (totalSpending * percent) / 100
      };
    }
    
    handleFiscalChange('governmentSpendingByCategory', newCategories);
  };

  // Prepare chart data
  const taxData = [
    { 
      name: 'Income Tax', 
      rate: fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0, 
      revenue: (fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0) * 0.8 
    },
    { 
      name: 'Corporate Tax', 
      rate: fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0, 
      revenue: (fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0) * 0.6 
    },
    { 
      name: 'VAT/Sales Tax', 
      rate: fiscalSystem.taxRates.salesTaxRate, 
      revenue: fiscalSystem.taxRates.salesTaxRate * 1.2 
    }
  ];

  const budgetBalanceData = [
    ['Year', 'Budget Balance'],
    ['2020', -3.2],
    ['2021', -4.1],
    ['2022', -2.8],
    ['2023', -1.5],
    ['2024', (fiscalSystem.budgetDeficitSurplus / nominalGDP) * 100 || -2.0],
    ['2025', ((fiscalSystem.budgetDeficitSurplus / nominalGDP) * 100 || -2.0) * 0.8],
    ['2026', ((fiscalSystem.budgetDeficitSurplus / nominalGDP) * 100 || -2.0) * 0.6]
  ];

  const fiscalHealthScore = Math.max(0, Math.min(100, 
    100 - (fiscalSystem.totalDebtGDPRatio * 0.5) - (Math.abs((fiscalSystem.budgetDeficitSurplus / nominalGDP) * 100 || 0) * 10)
  ));

  const fiscalGaugeData = [
    ['Label', 'Value'],
    ['Fiscal Health', fiscalHealthScore]
  ];

  // Basic view content - Essential fiscal controls
  const basicContent = (
    <>
      <GlassNumberPicker
        label="Tax Revenue (% of GDP)"
        value={fiscalSystem.taxRevenueGDPPercent}
        onChange={(value) => handleFiscalChange('taxRevenueGDPPercent', value)}
        min={5}
        max={50}
        step={0.5}
        unit="% of GDP"
        theme="blue"
      />

      <GlassNumberPicker
        label="Government Spending (% of GDP)"
        value={fiscalSystem.governmentBudgetGDPPercent}
        onChange={(value) => handleFiscalChange('governmentBudgetGDPPercent', value)}
        min={10}
        max={60}
        step={0.5}
        unit="% of GDP"
        theme="blue"
      />

      <GlassDial
        label="Public Debt (% of GDP)"
        value={fiscalSystem.totalDebtGDPRatio}
        onChange={(value) => handleFiscalChange('totalDebtGDPRatio', value)}
        min={0}
        max={200}
        step={1}
        unit="%"
        theme="blue"
      />

      {/* Basic visualization */}
      <div className="md:col-span-2">
        <GoogleGaugeChart
          data={fiscalGaugeData}
          title="Fiscal Health Score"
          description="Overall fiscal sustainability"
          height={250}
          theme="blue"
          min={0}
          max={100}
          yellowFrom={30}
          yellowTo={70}
          redFrom={0}
          redTo={30}
        />
      </div>
    </>
  );

  // Advanced view content - Detailed fiscal management
  const advancedContent = (
    <>
      {/* View Selector */}
      <div className="md:col-span-2">
        <div className="flex bg-card/50 rounded-lg p-1 backdrop-blur-sm border border-border">
          {(['revenue', 'spending', 'debt'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 capitalize ${
                selectedView === view
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
              }`}
            >
              {view === 'revenue' ? 'Tax Revenue' : view === 'spending' ? 'Government Spending' : 'Debt Management'}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue/Tax System */}
      {selectedView === 'revenue' && (
        <>
          <div className="md:col-span-2">
            <GlassBarChart
              data={taxData}
              xKey="name"
              yKey={['rate', 'revenue']}
              title="Tax Rates vs Revenue Generation"
              description="Tax policy effectiveness"
              height={300}
              theme="blue"
            />
          </div>

          {/* Tax Rate Controls */}
          <GlassSlider
            label="Income Tax Rate"
            value={fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0}
            onChange={(value) => handleTaxRateChange('income', value)}
            min={0}
            max={70}
            step={0.5}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={8}
          />

          <GlassSlider
            label="Corporate Tax Rate"
            value={fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0}
            onChange={(value) => handleTaxRateChange('corporate', value)}
            min={0}
            max={50}
            step={0.5}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="Sales Tax Rate"
            value={fiscalSystem.taxRates.salesTaxRate}
            onChange={(value) => handleTaxRateChange('sales', value)}
            min={0}
            max={30}
            step={0.5}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={7}
          />

          <GlassSlider
            label="Property Tax Rate"
            value={fiscalSystem.taxRates.propertyTaxRate}
            onChange={(value) => handleFiscalChange('taxRates', {
              ...fiscalSystem.taxRates,
              propertyTaxRate: value
            })}
            min={0}
            max={5}
            step={0.1}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />
        </>
      )}

      {/* Government Spending */}
      {selectedView === 'spending' && (
        <>
          {/* Spending Categories */}
          {fiscalSystem.governmentSpendingByCategory.map((category, index) => (
            <GlassSlider
              key={category.category}
              label={category.category}
              value={category.percent}
              onChange={(value) => handleSpendingCategoryChange(index, value)}
              min={0}
              max={40}
              step={0.1}
              unit="%"
              theme="blue"
              showTicks={true}
              tickCount={5}
            />
          ))}
        </>
      )}

      {/* Debt Management */}
      {selectedView === 'debt' && (
        <>
          <div className="md:col-span-2">
            <GoogleLineChart
              data={budgetBalanceData}
              title="Budget Balance Projection"
              description="Historical and projected budget balance as % of GDP"
              height={250}
              theme="blue"
              curveType="function"
            />
          </div>

          <GlassSlider
            label="Internal Debt (% of GDP)"
            value={fiscalSystem.internalDebtGDPPercent}
            onChange={(value) => handleFiscalChange('internalDebtGDPPercent', value)}
            min={0}
            max={150}
            step={1}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />

          <GlassSlider
            label="External Debt (% of GDP)"
            value={fiscalSystem.externalDebtGDPPercent}
            onChange={(value) => handleFiscalChange('externalDebtGDPPercent', value)}
            min={0}
            max={100}
            step={1}
            unit="%"
            theme="blue"
            showTicks={true}
            tickCount={6}
          />

          <GlassNumberPicker
            label="Interest Rates (%)"
            value={fiscalSystem.interestRates}
            onChange={(value) => handleFiscalChange('interestRates', value)}
            min={0}
            max={15}
            step={0.1}
            unit="%"
            theme="blue"
          />

          <GlassNumberPicker
            label="Debt Ceiling (% of GDP)"
            value={fiscalSystem.debtCeiling}
            onChange={(value) => handleFiscalChange('debtCeiling', value)}
            min={0}
            max={500}
            step={10}
            unit="%"
            theme="blue"
          />

          {/* Policy Toggles */}
          <div className="md:col-span-2 space-y-4">
            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Fiscal Policies
            </h5>
            <FormGrid columns={2}>
              <GlassToggle
                label="Progressive Tax System"
                description="Higher rates for higher income brackets"
                checked={fiscalSystem.progressiveTaxation}
                onChange={(checked) => handleFiscalChange('progressiveTaxation', checked)}
                theme="blue"
              />
              <GlassToggle
                label="Balanced Budget Rule"
                description="Constitutional requirement for balanced budgets"
                checked={fiscalSystem.balancedBudgetRule}
                onChange={(checked) => handleFiscalChange('balancedBudgetRule', checked)}
                theme="blue"
              />
            </FormGrid>
          </div>
        </>
      )}
    </>
  );

  // Generate fiscal insights
  const generateInsights = () => {
    const insights = [];
    const deficitPercent = Math.abs((fiscalSystem.budgetDeficitSurplus || 0) / nominalGDP) * 100;
    
    if (deficitPercent > 5) {
      insights.push("High budget deficit may require fiscal consolidation measures");
    }
    
    if (fiscalSystem.totalDebtGDPRatio > 90) {
      insights.push("Public debt exceeds 90% of GDP - consider debt reduction strategies");
    } else if (fiscalSystem.totalDebtGDPRatio > 60) {
      insights.push("Public debt approaching concerning levels - monitor carefully");
    }
    
    if (fiscalSystem.taxRevenueGDPPercent < 15) {
      insights.push("Low tax revenue may limit government's ability to provide public services");
    } else if (fiscalSystem.taxRevenueGDPPercent > 40) {
      insights.push("High tax burden may impact economic competitiveness");
    }
    
    return insights;
  };

  const insights = generateInsights();

  return (
    <SectionBase
      config={sectionConfigs.fiscal}
      inputs={inputs}
      onInputsChange={onInputsChange}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      referenceCountry={referenceCountry}
      metrics={metrics}
      validation={{
        errors: [],
        warnings: insights,
        info: [
          `Fiscal Health Score: ${fiscalHealthScore.toFixed(0)}/100`,
          `Debt Service Cost: ${sectionUtils.formatCurrency(fiscalSystem.debtServiceCosts)}/year`
        ]
      }}
      className={className}
    >
      <SectionLayout
        basicContent={basicContent}
        advancedContent={advancedContent}
        showAdvanced={showAdvanced}
        basicColumns={2}
        advancedColumns={2}
      />
    </SectionBase>
  );
}