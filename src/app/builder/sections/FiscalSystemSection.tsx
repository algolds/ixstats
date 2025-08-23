"use client";

import React, { useState, useMemo } from 'react';
import { Coins, TrendingUp, TrendingDown, DollarSign, Building, Building2, CreditCard, Shield, PieChart, AlertTriangle } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedDial,
  EnhancedNumberInput,
  EnhancedToggle,
  EnhancedBarChart,
  EnhancedPieChart,
  MetricCard,
} from '../primitives/enhanced';
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
    const budgetHealth: 'up' | 'neutral' | 'down' = budgetBalance >= 0 ? 'up' : Math.abs(budgetBalance / nominalGDP) < 0.03 ? 'neutral' : 'down';
    
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
        theme: budgetBalance >= 0 ? 'emerald' as const : 'red' as const,
        trend: budgetHealth
      },
      {
        label: "Public Debt",
        value: `${fiscalSystem.totalDebtGDPRatio.toFixed(1)}%`,
        unit: "of GDP",
        icon: CreditCard,
        theme: fiscalSystem.totalDebtGDPRatio > 90 ? 'red' as const : fiscalSystem.totalDebtGDPRatio > 60 ? 'gold' as const : 'blue' as const,
        trend: fiscalSystem.totalDebtGDPRatio > 90 ? 'down' as const : 'neutral' as const
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
      newTaxRates.personalIncomeTaxRates[1].rate = Number(value);
    } else if (category === 'corporate' && newTaxRates.corporateTaxRates[1]) {
      newTaxRates.corporateTaxRates[1].rate = Number(value);
    } else if (category === 'sales') {
      newTaxRates.salesTaxRate = Number(value);
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
      revenue: (fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0) * 0.8,
      color: 'blue'
    },
    { 
      name: 'Corporate Tax', 
      rate: fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0, 
      revenue: (fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0) * 0.6,
      color: 'emerald'
    },
    { 
      name: 'VAT/Sales Tax', 
      rate: fiscalSystem.taxRates.salesTaxRate, 
      revenue: fiscalSystem.taxRates.salesTaxRate * 1.2,
      color: 'gold'
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

  const taxBredownData = [
    { category: 'Income Tax', value: fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0, color: 'blue' },
    { category: 'Corporate Tax', value: fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0, color: 'emerald' },
    { category: 'Sales Tax', value: fiscalSystem.taxRates.salesTaxRate, color: 'gold' },
    { category: 'Property Tax', value: fiscalSystem.taxRates.propertyTaxRate, color: 'purple' },
    { category: 'Other Taxes', value: Math.max(0, fiscalSystem.taxRevenueGDPPercent - 
      ((fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate || 0) + 
       (fiscalSystem.taxRates.corporateTaxRates[1]?.rate || 0) + 
       fiscalSystem.taxRates.salesTaxRate + 
       fiscalSystem.taxRates.propertyTaxRate)), color: 'red' }
  ];

  // Basic view content - Essential fiscal controls
  const basicContent = (
    <>
      {/* Overview Metrics */}
      <div className="md:col-span-2 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <MetricCard
              key={index}
              {...metric}
              sectionId="fiscal"
              className="h-full"
            />
          ))}
        </div>
      </div>

      <EnhancedSlider
        label="Tax Revenue (% of GDP)"
        description="Government revenue from all taxes as percentage of GDP"
        value={fiscalSystem.taxRevenueGDPPercent}
        onChange={(value) => handleFiscalChange('taxRevenueGDPPercent', value)}
        min={5}
        max={50}
        step={0.5}
        precision={1}
        unit="% of GDP"
        sectionId="fiscal"
        icon={DollarSign}
        showTicks={true}
        tickCount={6}
        showValue={true}
        showRange={true}
        referenceValue={referenceCountry?.taxRevenuePercent}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Government Spending (% of GDP)"
        description="Total government expenditure as percentage of GDP"
        value={fiscalSystem.governmentBudgetGDPPercent}
        onChange={(value) => handleFiscalChange('governmentBudgetGDPPercent', value)}
        min={10}
        max={60}
        step={0.5}
        precision={1}
        unit="% of GDP"
        sectionId="fiscal"
        icon={Building}
        showTicks={true}
        tickCount={6}
        showValue={true}
        showRange={true}
        referenceValue={referenceCountry?.governmentSpending}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Public Debt (% of GDP)"
        description="Total government debt as percentage of GDP"
        value={fiscalSystem.totalDebtGDPRatio}
        onChange={(value) => handleFiscalChange('totalDebtGDPRatio', value)}
        min={0}
        max={200}
        step={1}
        precision={1}
        unit="% of GDP"
        sectionId="fiscal"
        icon={CreditCard}
        showTicks={true}
        tickCount={5}
        showValue={true}
        showRange={true}
      />

      {/* Basic visualization */}
      <div className="md:col-span-2">
        <EnhancedPieChart
          data={taxBredownData}
          dataKey="value"
          nameKey="category"
          title="Tax Revenue Sources"
          description="Breakdown of government revenue streams"
          height={250}
          sectionId="fiscal"
          showLegend={true}
          showPercentage={true}
          formatValue={(value) => `${value.toFixed(1)}%`}
          minSlicePercentage={3}
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
            <EnhancedBarChart
              data={taxData}
              xKey="name"
              yKey="rate"
              title="Tax Rates vs Revenue Generation"
              description="Tax policy effectiveness"
              height={300}
              sectionId="fiscal"
            />
          </div>

          {/* Tax Rate Controls */}
          <EnhancedSlider
            label="Income Tax Rate"
            value={Number(fiscalSystem.taxRates.personalIncomeTaxRates[1]?.rate) || 0}
            onChange={(value) => handleTaxRateChange('income', value)}
            min={0}
            max={70}
            step={0.5}
            unit="%"
            sectionId="fiscal"
            icon={DollarSign}
            showTicks={true}
            tickCount={8}
          />

          <EnhancedSlider
            label="Corporate Tax Rate"
            value={Number(fiscalSystem.taxRates.corporateTaxRates[1]?.rate) || 0}
            onChange={(value) => handleTaxRateChange('corporate', value)}
            min={0}
            max={50}
            step={0.5}
            unit="%"
            sectionId="fiscal"
            icon={Building}
            showTicks={true}
            tickCount={6}
          />

          <EnhancedSlider
            label="Sales Tax Rate"
            value={Number(fiscalSystem.taxRates.salesTaxRate) || 0}
            onChange={(value) => handleTaxRateChange('sales', value)}
            min={0}
            max={30}
            step={0.5}
            unit="%"
            sectionId="fiscal"
            icon={CreditCard}
            showTicks={true}
            tickCount={7}
          />

          <EnhancedSlider
            label="Property Tax Rate"
            value={Number(fiscalSystem.taxRates.propertyTaxRate) || 0}
            onChange={(value) => handleFiscalChange('taxRates', {
              ...fiscalSystem.taxRates,
              propertyTaxRate: Number(value)
            })}
            min={0}
            max={5}
            step={0.1}
            unit="%"
            sectionId="fiscal"
            icon={Building}
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
            <EnhancedSlider
              key={category.category}
              label={category.category}
              value={category.percent}
              onChange={(value) => handleSpendingCategoryChange(index, value)}
              min={0}
              max={40}
              step={0.1}
              unit="%"
              sectionId="fiscal"
              icon={Building}
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
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Budget Balance Projection</h4>
              <p className="text-xs text-muted-foreground">Historical and projected budget balance as % of GDP</p>
              <div className="h-64 bg-card/50 rounded-lg border border-border flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Chart placeholder - Budget Balance Trend</span>
              </div>
            </div>
          </div>

          <EnhancedSlider
            label="Internal Debt (% of GDP)"
            value={Number(fiscalSystem.internalDebtGDPPercent) || 0}
            onChange={(value) => handleFiscalChange('internalDebtGDPPercent', Number(value))}
            min={0}
            max={150}
            step={1}
            unit="%"
            sectionId="fiscal"
            icon={CreditCard}
            showTicks={true}
            tickCount={6}
          />

          <EnhancedSlider
            label="External Debt (% of GDP)"
            value={Number(fiscalSystem.externalDebtGDPPercent) || 0}
            onChange={(value) => handleFiscalChange('externalDebtGDPPercent', Number(value))}
            min={0}
            max={100}
            step={1}
            unit="%"
            sectionId="fiscal"
            icon={TrendingDown}
            showTicks={true}
            tickCount={6}
          />

          <EnhancedNumberInput
            label="Interest Rates (%)"
            value={Number(fiscalSystem.interestRates) || 0}
            onChange={(value) => handleFiscalChange('interestRates', Number(value))}
            min={0}
            max={15}
            step={0.1}
            precision={1}
            unit="%"
            sectionId="fiscal"
            icon={DollarSign}
          />

          <EnhancedNumberInput
            label="Debt Ceiling (% of GDP)"
            value={Number(fiscalSystem.debtCeiling) || 0}
            onChange={(value) => handleFiscalChange('debtCeiling', Number(value))}
            min={0}
            max={500}
            step={10}
            precision={0}
            unit="%"
            sectionId="fiscal"
            icon={Shield}
          />

          {/* Policy Toggles */}
          <div className="md:col-span-2 space-y-4">
            <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Fiscal Policies
            </h5>
            <FormGrid columns={2}>
              <EnhancedToggle
                label="Progressive Tax System"
                description="Higher rates for higher income brackets"
                checked={fiscalSystem.progressiveTaxation}
                onChange={(checked) => handleFiscalChange('progressiveTaxation', checked)}
                sectionId="fiscal"
                icon={TrendingUp}
              />
              <EnhancedToggle
                label="Balanced Budget Rule"
                description="Constitutional requirement for balanced budgets"
                checked={fiscalSystem.balancedBudgetRule}
                onChange={(checked) => handleFiscalChange('balancedBudgetRule', checked)}
                sectionId="fiscal"
                icon={Shield}
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
      config={sectionConfigs.fiscal || { 
        id: 'fiscal', 
        title: 'Fiscal System', 
        icon: Building2, 
        theme: 'blue' as const
      }}
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