// src/app/economy/components/FiscalSystem.tsx
// Tax & spending management

import { useState, useEffect, useMemo } from "react";
import { PieChart, DollarSign, TrendingDown, Building, Shield, GraduationCap, Heart, Wrench, Users, Scale, MapPin } from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { EnhancedEconomicInputs, TaxBracket, CorporateTaxTier, GovernmentSpending, EconomicHint } from "../lib/enhanced-economic-types";

interface FiscalSystemProps {
  inputs: EnhancedEconomicInputs;
  onInputsChange: (inputs: Partial<EnhancedEconomicInputs>) => void;
  referenceCountries: any[];
}

export function FiscalSystem({ 
  inputs, 
  onInputsChange, 
  referenceCountries 
}: FiscalSystemProps) {
  const [hints, setHints] = useState<EconomicHint[]>([]);
  const [activeTab, setActiveTab] = useState<'revenue' | 'spending' | 'debt'>('revenue');

  // Calculate fiscal metrics
  const totalGDP = inputs.population * inputs.gdpPerCapita;
  const totalTaxRevenue = totalGDP * (inputs.taxRevenuePercent / 100);
  const governmentBudget = totalGDP * (inputs.governmentBudgetPercent / 100);
  const budgetBalance = totalTaxRevenue - governmentBudget;
  const budgetBalancePercent = (budgetBalance / totalGDP) * 100;

  // Update calculated fields
  useEffect(() => {
    onInputsChange({
      governmentRevenueTotal: totalTaxRevenue,
      taxRevenuePerCapita: totalTaxRevenue / inputs.population,
      budgetDeficitSurplus: budgetBalance
    });
  }, [totalTaxRevenue, budgetBalance, inputs.population]);

  // Government spending categories with icons
  const spendingCategories = [
    { key: 'defense', label: 'Defense & Security', icon: Shield, color: '#ef4444' },
    { key: 'education', label: 'Education', icon: GraduationCap, color: '#3b82f6' },
    { key: 'healthcare', label: 'Healthcare', icon: Heart, color: '#10b981' },
    { key: 'infrastructure', label: 'Infrastructure', icon: Wrench, color: '#f59e0b' },
    { key: 'socialServices', label: 'Social Services', icon: Users, color: '#8b5cf6' },
    { key: 'administration', label: 'Administration', icon: Building, color: '#6b7280' },
    { key: 'diplomatic', label: 'Foreign Affairs', icon: MapPin, color: '#06b6d4' },
    { key: 'justice', label: 'Justice & Law', icon: Scale, color: '#ec4899' },
  ];

  // Spending data for charts
  const spendingData = spendingCategories.map(category => ({
    name: category.label,
    value: inputs.governmentSpendingBreakdown[category.key as keyof GovernmentSpending],
    amount: (governmentBudget * inputs.governmentSpendingBreakdown[category.key as keyof GovernmentSpending] / 100),
    color: category.color
  }));

  // Tax revenue breakdown
  const taxBreakdownData = [
    { name: 'Income Tax', percentage: 45, amount: totalTaxRevenue * 0.45 },
    { name: 'Corporate Tax', percentage: 20, amount: totalTaxRevenue * 0.20 },
    { name: 'Sales Tax', percentage: 15, amount: totalTaxRevenue * 0.15 },
    { name: 'Property Tax', percentage: 10, amount: totalTaxRevenue * 0.10 },
    { name: 'Other Taxes', percentage: 10, amount: totalTaxRevenue * 0.10 },
  ];

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  // Handle spending category changes
  const handleSpendingChange = (category: string, value: number) => {
    const newSpending = { ...inputs.governmentSpendingBreakdown };
    newSpending[category as keyof GovernmentSpending] = value;
    
    // Ensure total doesn't exceed 100%
    const total = Object.values(newSpending).reduce((sum, val) => sum + val, 0);
    if (total <= 100) {
      onInputsChange({ governmentSpendingBreakdown: newSpending });
    }
  };

  // Handle tax bracket changes
  const handleTaxBracketChange = (index: number, field: keyof TaxBracket, value: number | null) => {
    const newBrackets = [...inputs.personalIncomeTaxRates];
    newBrackets[index] = { ...newBrackets[index], [field]: value };
    onInputsChange({ personalIncomeTaxRates: newBrackets });
  };

  const addTaxBracket = () => {
    const lastBracket = inputs.personalIncomeTaxRates[inputs.personalIncomeTaxRates.length - 1];
    const newBracket: TaxBracket = {
      minIncome: lastBracket?.maxIncome || 50000,
      maxIncome: null,
      rate: 0.25
    };
    onInputsChange({ 
      personalIncomeTaxRates: [...inputs.personalIncomeTaxRates, newBracket] 
    });
  };

  // Generate fiscal hints
  useEffect(() => {
    generateFiscalHints();
  }, [budgetBalancePercent, inputs.taxRevenuePercent, inputs.governmentBudgetPercent]);

  const generateFiscalHints = () => {
    const newHints: EconomicHint[] = [];

    // Budget balance analysis
    if (budgetBalancePercent < -10) {
      newHints.push({
        type: 'warning',
        title: 'Large Budget Deficit',
        message: 'Budget deficit exceeding 10% of GDP indicates fiscal crisis risk.',
        relatedCountries: ['Greece (2010)', 'Venezuela'],
        impact: 'high'
      });
    } else if (budgetBalancePercent < -3) {
      newHints.push({
        type: 'warning',
        title: 'Budget Deficit',
        message: 'Consider reducing spending or increasing revenue to improve fiscal health.',
        relatedCountries: ['United States', 'United Kingdom'],
        impact: 'medium'
      });
    } else if (budgetBalancePercent > 5) {
      newHints.push({
        type: 'info',
        title: 'Budget Surplus',
        message: 'Strong fiscal position allows for investment or debt reduction.',
        relatedCountries: ['Norway', 'Singapore'],
        impact: 'low'
      });
    }

    // Tax burden analysis
    if (inputs.taxRevenuePercent > 40) {
      newHints.push({
        type: 'suggestion',
        title: 'High Tax Burden',
        message: 'High tax rates may impact economic competitiveness but fund robust public services.',
        relatedCountries: ['Denmark', 'France'],
        impact: 'medium'
      });
    } else if (inputs.taxRevenuePercent < 15) {
      newHints.push({
        type: 'suggestion',
        title: 'Low Tax Burden',
        message: 'Low taxes may stimulate growth but limit public service funding.',
        relatedCountries: ['United States', 'Singapore'],
        impact: 'medium'
      });
    }

    setHints(newHints);
  };

  const getTotalSpending = () => {
    return Object.values(inputs.governmentSpendingBreakdown).reduce((sum, val) => sum + val, 0);
  };

  const getBudgetHealthColor = () => {
    if (budgetBalancePercent < -5) return 'text-red-500';
    if (budgetBalancePercent < 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold flex items-center">
            <Building className="h-5 w-5 mr-2" />
            Fiscal System
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Government revenue, taxation, and spending management
          </p>
        </div>

        <div className="card-content space-y-6">
          {/* Fiscal Overview Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatCurrency(totalTaxRevenue)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Tax Revenue</div>
              <div className="text-xs text-blue-400">{inputs.taxRevenuePercent.toFixed(1)}% of GDP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatCurrency(governmentBudget)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Government Budget</div>
              <div className="text-xs text-purple-400">{inputs.governmentBudgetPercent.toFixed(1)}% of GDP</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getBudgetHealthColor()}`}>
                {budgetBalance >= 0 ? '+' : ''}{formatCurrency(budgetBalance)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Budget Balance</div>
              <div className={`text-xs ${getBudgetHealthColor()}`}>
                {budgetBalancePercent >= 0 ? '+' : ''}{budgetBalancePercent.toFixed(1)}% of GDP
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatCurrency(inputs.taxRevenuePerCapita)}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Tax per Capita</div>
              <div className="text-xs text-orange-400">Per citizen annually</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-[var(--color-bg-secondary)] rounded-lg p-1">
            {[
              { id: 'revenue', label: 'Tax Revenue', icon: DollarSign },
              { id: 'spending', label: 'Government Spending', icon: PieChart },
              { id: 'debt', label: 'Debt & Deficit', icon: TrendingDown }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-[var(--color-brand-primary)] text-white'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              {/* Tax Revenue Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Tax Rates</h4>
                  
                  {/* Sales Tax */}
                  <div className="space-y-2">
                    <label className="form-label">Sales Tax Rate</label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="0.5"
                      value={inputs.salesTaxRate}
                      onChange={(e) => onInputsChange({ salesTaxRate: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-brand-primary)]">{inputs.salesTaxRate}%</span>
                      <span>30%</span>
                    </div>
                  </div>

                  {/* Property Tax */}
                  <div className="space-y-2">
                    <label className="form-label">Property Tax Rate</label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={inputs.propertyTaxRate}
                      onChange={(e) => onInputsChange({ propertyTaxRate: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-brand-primary)]">{inputs.propertyTaxRate}%</span>
                      <span>5%</span>
                    </div>
                  </div>

                  {/* Payroll Tax */}
                  <div className="space-y-2">
                    <label className="form-label">Payroll Tax Rate</label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="0.5"
                      value={inputs.payrollTaxRate}
                      onChange={(e) => onInputsChange({ payrollTaxRate: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                      <span>0%</span>
                      <span className="font-medium text-[var(--color-brand-primary)]">{inputs.payrollTaxRate}%</span>
                      <span>20%</span>
                    </div>
                  </div>
                </div>

                {/* Tax Revenue Breakdown Chart */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Revenue Sources</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={taxBreakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="percentage"
                        >
                          {taxBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `${value}% (${formatCurrency(taxBreakdownData.find(d => d.name === name)?.amount || 0)})`,
                            name
                          ]}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Income Tax Brackets */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Income Tax Brackets</h4>
                  <button
                    onClick={addTaxBracket}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    Add Bracket
                  </button>
                </div>
                <div className="space-y-2">
                  {inputs.personalIncomeTaxRates.map((bracket, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div>
                        <label className="text-xs text-[var(--color-text-muted)]">Min Income</label>
                        <input
                          type="number"
                          value={bracket.minIncome}
                          onChange={(e) => handleTaxBracketChange(index, 'minIncome', parseFloat(e.target.value) || 0)}
                          className="form-input text-xs"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--color-text-muted)]">Max Income</label>
                        <input
                          type="number"
                          value={bracket.maxIncome || ''}
                          onChange={(e) => handleTaxBracketChange(index, 'maxIncome', e.target.value ? parseFloat(e.target.value) : null)}
                          className="form-input text-xs"
                          placeholder="No limit"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--color-text-muted)]">Tax Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={bracket.rate * 100}
                          onChange={(e) => handleTaxBracketChange(index, 'rate', parseFloat(e.target.value) / 100 || 0)}
                          className="form-input text-xs"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => {
                            const newBrackets = inputs.personalIncomeTaxRates.filter((_, i) => i !== index);
                            onInputsChange({ personalIncomeTaxRates: newBrackets });
                          }}
                          className="btn-secondary text-xs py-1 px-2 text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'spending' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Spending Chart */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Budget Allocation</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={spendingData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {spendingData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `${value}% (${formatCurrency(spendingData.find(d => d.name === name)?.amount || 0)})`,
                            name
                          ]}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      Total Allocated: {getTotalSpending().toFixed(1)}% 
                      {getTotalSpending() < 100 && (
                        <span className="text-yellow-400 ml-2">
                          ({(100 - getTotalSpending()).toFixed(1)}% unallocated)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Spending Controls */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Budget Categories</h4>
                  <div className="space-y-3">
                    {spendingCategories.map(category => {
                      const Icon = category.icon;
                      const value = inputs.governmentSpendingBreakdown[category.key as keyof GovernmentSpending];
                      const amount = (governmentBudget * value / 100);
                      
                      return (
                        <div key={category.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="form-label flex items-center text-xs">
                              <Icon className="h-4 w-4 mr-2" style={{ color: category.color }} />
                              {category.label}
                            </label>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            step="0.5"
                            value={value}
                            onChange={(e) => handleSpendingChange(category.key, parseFloat(e.target.value))}
                            className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                          />
                          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                            <span>0%</span>
                            <span className="font-medium" style={{ color: category.color }}>
                              {value.toFixed(1)}%
                            </span>
                            <span>50%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'debt' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Debt Levels */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Government Debt</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="form-label">Internal Debt (% of GDP)</label>
                      <input
                        type="range"
                        min="0"
                        max="150"
                        step="1"
                        value={inputs.internalDebtPercent}
                        onChange={(e) => onInputsChange({ internalDebtPercent: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                        <span>0%</span>
                        <span className="font-medium text-blue-400">{inputs.internalDebtPercent}%</span>
                        <span>150%</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Domestic government debt: {formatCurrency(totalGDP * inputs.internalDebtPercent / 100)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="form-label">External Debt (% of GDP)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={inputs.externalDebtPercent}
                        onChange={(e) => onInputsChange({ externalDebtPercent: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                        <span>0%</span>
                        <span className="font-medium text-red-400">{inputs.externalDebtPercent}%</span>
                        <span>100%</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Foreign government debt: {formatCurrency(totalGDP * inputs.externalDebtPercent / 100)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fiscal Health Indicators */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Fiscal Health</h4>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--color-text-secondary)]">Total Debt to GDP</span>
                        <span className={`text-lg font-bold ${
                          (inputs.internalDebtPercent + inputs.externalDebtPercent) > 90 ? 'text-red-400' :
                          (inputs.internalDebtPercent + inputs.externalDebtPercent) > 60 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {(inputs.internalDebtPercent + inputs.externalDebtPercent).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (inputs.internalDebtPercent + inputs.externalDebtPercent) > 90 ? 'bg-red-500' :
                            (inputs.internalDebtPercent + inputs.externalDebtPercent) > 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, (inputs.internalDebtPercent + inputs.externalDebtPercent))}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--color-text-secondary)]">Budget Balance</span>
                        <span className={`text-lg font-bold ${getBudgetHealthColor()}`}>
                          {budgetBalancePercent >= 0 ? '+' : ''}{budgetBalancePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {budgetBalance >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(budgetBalance))}
                      </div>
                    </div>

                    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--color-text-secondary)]">Debt per Capita</span>
                        <span className="text-lg font-bold text-[var(--color-text-primary)]">
                          {formatCurrency((totalGDP * (inputs.internalDebtPercent + inputs.externalDebtPercent) / 100) / inputs.population)}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        Government debt burden per citizen
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fiscal Hints */}
          {hints.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center">
                <Building className="h-4 w-4 mr-2" />
                Fiscal Policy Analysis
              </h4>
              <div className="space-y-2">
                {hints.map((hint, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      hint.type === 'warning' ? 'border-[var(--color-warning)] bg-yellow-500/10' :
                      hint.type === 'suggestion' ? 'border-[var(--color-info)] bg-blue-500/10' :
                      'border-[var(--color-success)] bg-green-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-[var(--color-text-primary)]">
                          {hint.title}
                        </h5>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {hint.message}
                        </p>
                        {hint.relatedCountries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {hint.relatedCountries.map(country => (
                              <span 
                                key={country}
                                className="px-2 py-1 text-xs bg-[var(--color-bg-secondary)] rounded-full text-[var(--color-text-secondary)]"
                              >
                                {country}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          cursor: pointer;
          border: 2px solid var(--color-bg-primary);
        }
      `}</style>
    </div>
  );
}