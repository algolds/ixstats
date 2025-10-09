"use client";

import React, { useMemo } from 'react';
import { Coins, TrendingUp, TrendingDown, DollarSign, Building, CreditCard, Shield, PieChart, AlertTriangle, Percent } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedNumberInput,
  GlassSelectBox,
  GlassProgressIndicator,
  MetricCard,
  ViewTransition
} from '../primitives/enhanced';
import { StandardSectionTemplate, SECTION_THEMES } from '../primitives/StandardSectionTemplate';
import type { StandardSectionProps } from '../primitives/StandardSectionTemplate';
import type { FiscalSystemData } from '../lib/economy-data-service';

export function FiscalSystemSectionModern({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: StandardSectionProps) {
  const fiscalSystem = inputs.fiscalSystem;
  const nominalGDP = inputs.coreIndicators.nominalGDP;
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  
  // Handle input changes with proper type safety and auto-calculations
  const handleFiscalChange = (field: keyof FiscalSystemData, value: any) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newFiscalSystem = { ...fiscalSystem, [field]: safeValue };
    
    // Auto-calculate derived values with NaN protection
    const safeGDP = typeof nominalGDP === 'number' && !isNaN(nominalGDP) ? nominalGDP : 0;
    const safePopulation = typeof totalPopulation === 'number' && !isNaN(totalPopulation) ? totalPopulation : 1;
    
    if (field === 'taxRevenueGDPPercent') {
      newFiscalSystem.governmentRevenueTotal = (safeGDP * safeValue) / 100;
      newFiscalSystem.taxRevenuePerCapita = safePopulation > 0 ? newFiscalSystem.governmentRevenueTotal / safePopulation : 0;
    } else if (field === 'governmentBudgetGDPPercent') {
      const totalSpending = (safeGDP * safeValue) / 100;
      const currentRevenue = typeof newFiscalSystem.governmentRevenueTotal === 'number' && !isNaN(newFiscalSystem.governmentRevenueTotal) 
        ? newFiscalSystem.governmentRevenueTotal : 0;
      newFiscalSystem.budgetDeficitSurplus = currentRevenue - totalSpending;
    }
    
    onInputsChange({ ...inputs, fiscalSystem: newFiscalSystem });
  };

  const handleTaxRateChange = (category: 'income' | 'corporate' | 'sales', value: number) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newTaxRates = { ...fiscalSystem.taxRates, [category]: safeValue };
    
    // Recalculate weighted average tax rate with safe values
    const safeIncome = typeof newTaxRates.income === 'number' && !isNaN(newTaxRates.income) ? newTaxRates.income : 0;
    const safeCorporate = typeof newTaxRates.corporate === 'number' && !isNaN(newTaxRates.corporate) ? newTaxRates.corporate : 0;
    const safeSales = typeof newTaxRates.sales === 'number' && !isNaN(newTaxRates.sales) ? newTaxRates.sales : 0;
    
    const weightedAverage = (
      safeIncome * 0.5 + 
      safeCorporate * 0.3 + 
      safeSales * 0.2
    );
    
    handleFiscalChange('taxRates', newTaxRates);
    handleFiscalChange('taxRevenueGDPPercent', weightedAverage);
  };

  // Calculate fiscal health indicators
  const fiscalHealth = useMemo(() => {
    // Safely extract and validate all values
    const safeRevenue = typeof fiscalSystem.governmentRevenueTotal === 'number' && !isNaN(fiscalSystem.governmentRevenueTotal) 
      ? fiscalSystem.governmentRevenueTotal : 0;
    const safeGDP = typeof nominalGDP === 'number' && !isNaN(nominalGDP) ? nominalGDP : 1;
    const safeBudgetPercent = typeof fiscalSystem.governmentBudgetGDPPercent === 'number' && !isNaN(fiscalSystem.governmentBudgetGDPPercent) 
      ? fiscalSystem.governmentBudgetGDPPercent : 0;
    const safePopulation = typeof totalPopulation === 'number' && !isNaN(totalPopulation) ? totalPopulation : 1;
    const safeBudgetBalance = typeof fiscalSystem.budgetDeficitSurplus === 'number' && !isNaN(fiscalSystem.budgetDeficitSurplus) 
      ? fiscalSystem.budgetDeficitSurplus : 0;
    const safeDebtRatio = typeof fiscalSystem.totalDebtGDPRatio === 'number' && !isNaN(fiscalSystem.totalDebtGDPRatio) 
      ? fiscalSystem.totalDebtGDPRatio : 0;
    
    const totalRevenue = safeRevenue;
    const totalSpending = (safeGDP * safeBudgetPercent) / 100;
    const budgetBalance = safeBudgetBalance;
    const debtRatio = safeDebtRatio;
    
    const budgetHealthStatus = budgetBalance >= 0 ? 'surplus' : 
                              safeGDP > 0 && Math.abs(budgetBalance / safeGDP) < 0.03 ? 'balanced' : 'deficit';
    
    const debtHealthStatus = debtRatio > 90 ? 'critical' : 
                            debtRatio > 60 ? 'concerning' : 'healthy';
    
    const overallHealth = budgetHealthStatus === 'surplus' && debtHealthStatus === 'healthy' ? 'excellent' :
                         budgetHealthStatus !== 'deficit' && debtHealthStatus !== 'critical' ? 'good' : 
                         'needs_attention';
    
    return {
      totalRevenue,
      totalSpending,
      budgetBalance,
      budgetHealthStatus,
      debtHealthStatus,
      overallHealth,
      revenuePerCapita: safePopulation > 0 ? totalRevenue / safePopulation : 0,
      spendingPerCapita: safePopulation > 0 ? totalSpending / safePopulation : 0
    };
  }, [fiscalSystem, nominalGDP, totalPopulation]);

  // Basic view content - Essential fiscal indicators
  const basicContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview Metrics */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Tax Revenue"
          value={`${fiscalSystem.taxRevenueGDPPercent.toFixed(1)}%`}
          unit="of GDP"
          icon={DollarSign}
          sectionId="fiscal"
        />
        <MetricCard
          label="Gov. Spending"
          value={`${fiscalSystem.governmentBudgetGDPPercent.toFixed(1)}%`}
          unit="of GDP"
          icon={Building}
          sectionId="fiscal"
        />
        <MetricCard
          label="Budget Balance"
          value={Math.abs(fiscalHealth.budgetBalance).toLocaleString()}
          unit={fiscalHealth.budgetBalance >= 0 ? 'Surplus' : 'Deficit'}
          icon={fiscalHealth.budgetBalance >= 0 ? TrendingUp : TrendingDown}
          sectionId="fiscal"
        />
        <MetricCard
          label="Public Debt"
          value={`${fiscalSystem.totalDebtGDPRatio.toFixed(1)}%`}
          unit="of GDP"
          icon={CreditCard}
          sectionId="fiscal"
        />
      </div>

      {/* Essential Controls */}
      <EnhancedSlider
        label="Tax Revenue (% of GDP)"
        description="Total government tax revenue as percentage of GDP"
        value={Number(fiscalSystem.taxRevenueGDPPercent) || 0}
        onChange={(value) => handleFiscalChange('taxRevenueGDPPercent', Number(value))}
        min={10}
        max={50}
        step={0.1}
        unit="%"
        sectionId="fiscal"
        icon={DollarSign}
        showTicks={true}
        tickCount={5}
        referenceValue={referenceCountry?.taxRevenuePercent}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Government Spending (% of GDP)"
        description="Total government expenditure as percentage of GDP"
        value={Number(fiscalSystem.governmentBudgetGDPPercent) || 0}
        onChange={(value) => handleFiscalChange('governmentBudgetGDPPercent', Number(value))}
        min={15}
        max={60}
        step={0.1}
        unit="%"
        sectionId="fiscal"
        icon={Building}
        showTicks={true}
        tickCount={5}
        referenceValue={referenceCountry?.governmentSpending}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Public Debt (% of GDP)"
        description="Total government debt as percentage of GDP"
        value={Number(fiscalSystem.totalDebtGDPRatio) || 0}
        onChange={(value) => handleFiscalChange('totalDebtGDPRatio', Number(value))}
        min={0}
        max={150}
        step={1}
        unit="%"
        sectionId="fiscal"
        icon={CreditCard}
        showTicks={true}
        tickCount={6}
      />

      {/* Budget Health Indicator */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Fiscal Health
        </h4>
        
        <GlassProgressIndicator
          label="Overall Fiscal Health"
          value={fiscalHealth.overallHealth === 'excellent' ? 100 : 
                 fiscalHealth.overallHealth === 'good' ? 75 : 50}
          max={100}
          variant="linear"
          showPercentage={false}
          showValue={false}
          sectionId="fiscal"
          color={fiscalHealth.overallHealth === 'excellent' ? '#10b981' : 
                 fiscalHealth.overallHealth === 'good' ? '#f59e0b' : '#ef4444'}
        />
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Budget: <span className={`font-medium ${
            fiscalHealth.budgetHealthStatus === 'surplus' ? 'text-green-500' : 
            fiscalHealth.budgetHealthStatus === 'balanced' ? 'text-yellow-500' : 'text-red-500'
          }`}>{fiscalHealth.budgetHealthStatus}</span></p>
          <p>Debt: <span className={`font-medium ${
            fiscalHealth.debtHealthStatus === 'healthy' ? 'text-green-500' : 
            fiscalHealth.debtHealthStatus === 'concerning' ? 'text-yellow-500' : 'text-red-500'
          }`}>{fiscalHealth.debtHealthStatus}</span></p>
        </div>
      </div>
    </div>
  );

  // Advanced view content - Detailed fiscal system
  const advancedContent = (
    <div className="space-y-8">
      {/* Tax System Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Tax System
        </h4>
        
        {/* Tax Rate Overview */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            label="Income Tax"
            value={fiscalSystem.incomeTaxRate}
            unit="%"
            icon={DollarSign}
            sectionId="fiscal"
          />
          <MetricCard
            label="Corporate Tax"
            value={fiscalSystem.corporateTaxRate}
            unit="%"
            icon={Building}
            sectionId="fiscal"
          />
          <MetricCard
            label="Sales Tax"
            value={fiscalSystem.taxRates.sales}
            unit="%"
            icon={Coins}
            sectionId="fiscal"
          />
        </div>

        {/* Tax Rate Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EnhancedSlider
            label="Personal Income Tax Rate"
            value={Number(fiscalSystem.taxRates.income) || 0}
            onChange={(value) => handleTaxRateChange('income', Number(value))}
            min={0}
            max={50}
            step={0.5}
            unit="%"
            sectionId="fiscal"
            icon={DollarSign}
            showTicks={true}
            tickCount={5}
          />
          
          <EnhancedSlider
            label="Corporate Tax Rate"
            value={Number(fiscalSystem.taxRates.corporate) || 0}
            onChange={(value) => handleTaxRateChange('corporate', Number(value))}
            min={0}
            max={40}
            step={0.5}
            unit="%"
            sectionId="fiscal"
            icon={Building}
            showTicks={true}
            tickCount={5}
          />
          
          <EnhancedSlider
            label="Sales/VAT Tax Rate"
            value={Number(fiscalSystem.taxRates.sales) || 0}
            onChange={(value) => handleTaxRateChange('sales', Number(value))}
            min={0}
            max={25}
            step={0.25}
            unit="%"
            sectionId="fiscal"
            icon={Coins}
            showTicks={true}
            tickCount={5}
          />
        </div>
      </div>

      {/* Revenue Breakdown Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue Breakdown
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Revenue per Capita */}
          <div className="space-y-4">
            <EnhancedNumberInput
              label="Total Revenue"
              value={fiscalHealth.totalRevenue}
              onChange={(value) => {
                const newPercentage = (Number(value) / nominalGDP) * 100;
                handleFiscalChange('taxRevenueGDPPercent', newPercentage);
              }}
              min={nominalGDP * 0.1}
              max={nominalGDP * 0.5}
              step={nominalGDP * 0.001}
              unit=""
              sectionId="fiscal"
              icon={DollarSign}
              format={(value) => `$${Number(value).toLocaleString()}`}
            />
            
            <MetricCard
              label="Revenue per Capita"
              value={fiscalHealth.revenuePerCapita.toLocaleString()}
              unit="per person"
              icon={DollarSign}
              sectionId="fiscal"
              size="sm"
            />
          </div>

          {/* Revenue Efficiency */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary border border-border">
              <h5 className="text-sm font-semibold text-foreground mb-3">Revenue Efficiency</h5>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Tax to GDP Ratio</span>
                  <span className="text-sm font-medium text-foreground">
                    {fiscalSystem.taxRevenueGDPPercent.toFixed(1)}%
                  </span>
                </div>
                
                <GlassProgressIndicator
                  value={fiscalSystem.taxRevenueGDPPercent}
                  max={40}
                  variant="linear"
                  height={6}
                  showPercentage={false}
                  sectionId="fiscal"
                />
                
                <p className="text-xs text-muted-foreground">
                  {fiscalSystem.taxRevenueGDPPercent < 20 ? 'Low tax burden' : 
                   fiscalSystem.taxRevenueGDPPercent > 35 ? 'High tax burden' : 'Moderate tax burden'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debt Management Section */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Debt Management
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnhancedNumberInput
            label="Debt Service (Annual)"
            description="Annual debt service payments"
            value={fiscalSystem.debtServiceCosts || 0}
            onChange={(value) => handleFiscalChange('debtServiceCosts', Number(value))}
            min={0}
            max={fiscalHealth.totalRevenue * 0.3}
            step={fiscalHealth.totalRevenue * 0.001}
            unit=""
            sectionId="fiscal"
            icon={CreditCard}
            format={(value) => `$${Number(value).toLocaleString()}`}
          />
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary border border-border">
              <h5 className="text-sm font-semibold text-foreground mb-3">Debt Sustainability</h5>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Debt-to-GDP Ratio</span>
                  <span className="text-sm font-medium text-foreground">
                    {fiscalSystem.totalDebtGDPRatio.toFixed(1)}%
                  </span>
                </div>
                
                <GlassProgressIndicator
                  value={Math.min(fiscalSystem.totalDebtGDPRatio, 150)}
                  max={150}
                  variant="linear"
                  height={6}
                  showPercentage={false}
                  sectionId="fiscal"
                  color={fiscalSystem.totalDebtGDPRatio > 90 ? '#ef4444' : 
                         fiscalSystem.totalDebtGDPRatio > 60 ? '#f59e0b' : '#10b981'}
                />
                
                <div className="flex items-center gap-2">
                  {fiscalSystem.totalDebtGDPRatio > 90 && 
                    <AlertTriangle className="h-4 w-4 text-red-500" />}
                  <p className="text-xs text-muted-foreground">
                    {fiscalSystem.totalDebtGDPRatio > 90 ? 'Critical debt level' : 
                     fiscalSystem.totalDebtGDPRatio > 60 ? 'Elevated debt level' : 'Sustainable debt level'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <StandardSectionTemplate
      title="Fiscal System"
      description="Government revenue, spending, and debt management"
      icon={Coins}
      basicContent={basicContent}
      advancedContent={advancedContent}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      theme={SECTION_THEMES.fiscal}
      depth="elevated"
      blur="medium"
      className={className}
      inputs={inputs}
      onInputsChange={onInputsChange}
      referenceCountry={referenceCountry}
    />
  );
}