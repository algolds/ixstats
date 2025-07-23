// src/app/economy/components/FiscalSystem.tsx
"use client";

import React, { useState } from "react";
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
import type { FiscalSystemData, RealCountryData } from "../lib/economy-data-service";

interface FiscalSystemProps {
  fiscalData: FiscalSystemData;
  referenceCountry: RealCountryData;
  nominalGDP: number;
  totalPopulation: number;
  onFiscalDataChange: (fiscalData: FiscalSystemData) => void;
}

export function FiscalSystemComponent({
  fiscalData,
  referenceCountry,
  nominalGDP,
  totalPopulation,
  onFiscalDataChange,
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
        bracket: field === 'bracket' ? value : currentRate.bracket,
        rate: field === 'rate' ? value : currentRate.rate
      };
    } else if (category === 'corporateTaxRates' && newTaxRates.corporateTaxRates[index]) {
      const currentRate = newTaxRates.corporateTaxRates[index];
      newTaxRates.corporateTaxRates[index] = {
        size: field === 'size' ? String(value) : currentRate.size,
        rate: field === 'rate' ? value : currentRate.rate
      };
    } else if (category === 'exciseTaxRates' && newTaxRates.exciseTaxRates[index]) {
      const currentRate = newTaxRates.exciseTaxRates[index];
      newTaxRates.exciseTaxRates[index] = {
        type: field === 'type' ? String(value) : currentRate.type,
        rate: field === 'rate' ? value : currentRate.rate
      };
    }
    
    onFiscalDataChange({ ...fiscalData, taxRates: newTaxRates });
  };

  const handleSpendingCategoryChange = (index: number, percent: number) => {
    const newCategories = [...fiscalData.governmentSpendingByCategory];
    const totalSpending = (nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100;
    
    if (newCategories[index]) {
      newCategories[index] = {
        category: newCategories[index].category,
        percent,
        amount: (totalSpending * percent) / 100
      };
    }
    
    onFiscalDataChange({
      ...fiscalData,
      governmentSpendingByCategory: newCategories
    });
  };

  const formatNumber = (num: number | undefined, precision = 1): string => {
    if (typeof num !== 'number' || isNaN(num)) return '$0';
    if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(precision)}K`;
    return `$${num.toFixed(0)}`;
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

  const spendingCategoryIcons: Record<string, React.ElementType> = {
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
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <Building className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Fiscal System
        </h3>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1">
          {['revenue', 'spending', 'debt'].map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view as any)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                selectedView === view
                  ? 'bg-[var(--color-brand-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Fiscal Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {formatNumber(fiscalData.governmentRevenueTotal)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Revenue</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {fiscalData.taxRevenueGDPPercent.toFixed(1)}% of GDP
          </div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Building className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {formatNumber((nominalGDP * fiscalData.governmentBudgetGDPPercent) / 100)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Spending</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {fiscalData.governmentBudgetGDPPercent.toFixed(1)}% of GDP
          </div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <HealthIcon className={`h-6 w-6 ${budgetHealth.color.replace('text-', 'text-')}`} />
          </div>
          <div className={`text-xl font-bold ${budgetHealth.color}`}>
            {formatNumber(Math.abs(fiscalData.budgetDeficitSurplus || 0))}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {(fiscalData.budgetDeficitSurplus || 0) >= 0 ? 'Surplus' : 'Deficit'}
          </div>
          <div className={`text-xs ${budgetHealth.color}`}>
            {budgetHealth.label}
          </div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="h-6 w-6 text-orange-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {fiscalData.totalDebtGDPRatio.toFixed(1)}%
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Debt</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {formatNumber(fiscalData.debtPerCapita)} per capita
          </div>
        </div>
      </div>

      {selectedView === 'revenue' && (
        <div className="space-y-6">
          {/* Tax Revenue Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="form-label flex items-center">
                  <Percent className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                  Tax Revenue (% of GDP)
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="0.1"
                    value={fiscalData.taxRevenueGDPPercent}
                    onChange={(e) => handleInputChange('taxRevenueGDPPercent', parseFloat(e.target.value))}
                    className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                    <span>5%</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {fiscalData.taxRevenueGDPPercent.toFixed(1)}%
                    </span>
                    <span>50%</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Ref: {referenceCountry.taxRevenuePercent.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Tax Revenue per Capita</label>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {formatNumber(fiscalData.taxRevenuePerCapita)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Total: {formatNumber(fiscalData.governmentRevenueTotal)}
                </div>
              </div>
            </div>
          </div>

          {/* Tax Rate Sliders */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-[var(--color-text-primary)]">Tax Rates</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Sales Tax Rate
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="25"
                      step="0.1"
                      value={fiscalData.taxRates.salesTaxRate}
                      onChange={(e) => handleInputChange('taxRates', {
                        ...fiscalData.taxRates,
                        salesTaxRate: parseFloat(e.target.value)
                      })}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {fiscalData.taxRates.salesTaxRate.toFixed(1)}%
                      </span>
                      <span>25%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Property Tax Rate
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={fiscalData.taxRates.propertyTaxRate}
                      onChange={(e) => handleInputChange('taxRates', {
                        ...fiscalData.taxRates,
                        propertyTaxRate: parseFloat(e.target.value)
                      })}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {fiscalData.taxRates.propertyTaxRate.toFixed(1)}%
                      </span>
                      <span>5%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Payroll Tax Rate
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="0.1"
                      value={fiscalData.taxRates.payrollTaxRate}
                      onChange={(e) => handleInputChange('taxRates', {
                        ...fiscalData.taxRates,
                        payrollTaxRate: parseFloat(e.target.value)
                      })}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {fiscalData.taxRates.payrollTaxRate.toFixed(1)}%
                      </span>
                      <span>30%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Wealth Tax Rate
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={fiscalData.taxRates.wealthTaxRate}
                      onChange={(e) => handleInputChange('taxRates', {
                        ...fiscalData.taxRates,
                        wealthTaxRate: parseFloat(e.target.value)
                      })}
                      className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {fiscalData.taxRates.wealthTaxRate.toFixed(1)}%
                      </span>
                      <span>3%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === 'spending' && (
        <div className="space-y-6">
          <div>
            <label className="form-label flex items-center">
              <Building className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
              Government Budget (% of GDP)
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="10"
                max="60"
                step="0.1"
                value={fiscalData.governmentBudgetGDPPercent}
                onChange={(e) => handleInputChange('governmentBudgetGDPPercent', parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>10%</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {fiscalData.governmentBudgetGDPPercent.toFixed(1)}%
                </span>
                <span>60%</span>
              </div>
            </div>
          </div>

          {/* Spending Categories */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-[var(--color-text-primary)] flex items-center">
              <PieChart className="h-4 w-4 mr-2" />
              Spending by Category
            </h4>
            
            {fiscalData.governmentSpendingByCategory.map((category: any, index: number) => {
              // Get the appropriate icon component for this spending category
              // Falls back to MoreHorizontal icon if no specific icon is found
              const categoryName = String(category.category || 'Other');
              const IconComponent: React.ElementType = spendingCategoryIcons[categoryName] || MoreHorizontal;
              return (
                <div key={categoryName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[var(--color-text-primary)] flex items-center">
                      {React.createElement(IconComponent, { className: "h-4 w-4 mr-2" })}
                      {categoryName}
                    </label>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {category.percent.toFixed(1)}% ({formatNumber(category.amount)})
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-3">
                      <div
                        className="h-3 rounded-full bg-[var(--color-brand-primary)] transition-all duration-300"
                        style={{ width: `${category.percent}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="0.1"
                      value={category.percent}
                      onChange={(e) => handleSpendingCategoryChange(index, parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedView === 'debt' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="form-label">Internal Debt (% of GDP)</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="150"
                    step="1"
                    value={fiscalData.internalDebtGDPPercent}
                    onChange={(e) => handleInputChange('internalDebtGDPPercent', parseFloat(e.target.value))}
                    className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                    <span>0%</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {fiscalData.internalDebtGDPPercent.toFixed(1)}%
                    </span>
                    <span>150%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">External Debt (% of GDP)</label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={fiscalData.externalDebtGDPPercent}
                    onChange={(e) => handleInputChange('externalDebtGDPPercent', parseFloat(e.target.value))}
                    className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                    <span>0%</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {fiscalData.externalDebtGDPPercent.toFixed(1)}%
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Interest Rates (%)</label>
                <input
                  type="number"
                  value={fiscalData.interestRates}
                  onChange={(e) => handleInputChange('interestRates', parseFloat(e.target.value) || 0)}
                  className="form-input"
                  step="0.1"
                  min="0"
                />
              </div>

              <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                <h5 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Debt Summary</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Total Debt:</span>
                    <span className="font-medium">{fiscalData.totalDebtGDPRatio.toFixed(1)}% GDP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Per Capita:</span>
                    <span className="font-medium">{formatNumber(fiscalData.debtPerCapita)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Annual Service:</span>
                    <span className="font-medium">{formatNumber(fiscalData.debtServiceCosts)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-[var(--color-info)] mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Fiscal Health: <span className={budgetHealth.color}>{budgetHealth.label}</span>
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              {(fiscalData.budgetDeficitSurplus || 0) >= 0
                ? `Running a surplus of ${formatNumber(fiscalData.budgetDeficitSurplus)} allows for debt reduction and future investments.`
                : Math.abs(((fiscalData.budgetDeficitSurplus || 0) / nominalGDP) * 100) <= 2
                ? "Running a manageable deficit. Monitor debt levels and consider revenue increases."
                : "High deficit requires attention. Consider reducing spending or increasing revenue to maintain fiscal sustainability."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
