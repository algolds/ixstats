// src/app/economy/components/GovernmentSpending.tsx
"use client";

import React, { useState, type ElementType } from "react"; 
import {
  Building,
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  Briefcase,
  Globe,
  Scale,
  BarChart2,
  Info,
  MoreHorizontal // Added MoreHorizontal as a fallback icon
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SpendingCategory, GovernmentSpendingData, CoreEconomicIndicatorsData } from '~/types/economics';

interface GovernmentSpendingProps {
  spendingData: GovernmentSpendingData;
  nominalGDP: number;
  totalPopulation: number;
  onSpendingDataChangeAction: (spendingData: GovernmentSpendingData) => void; // Renamed prop
  isReadOnly?: boolean; 
  // Add missing props if this component is also expected to handle core indicators
  indicators?: CoreEconomicIndicatorsData; 
  onIndicatorsChangeAction?: (newData: CoreEconomicIndicatorsData) => void;
}

// Mapping from icon string names to Lucide components
const iconMap: Record<string, ElementType> = {
  Shield,
  GraduationCap,
  Heart,
  Truck,
  Users2,
  Briefcase,
  Globe,
  Scale,
  Building,
  MoreHorizontal, // Default/fallback icon
  // Add other icons by name as needed
};


export function GovernmentSpending({
  spendingData,
  nominalGDP,
  totalPopulation,
  onSpendingDataChangeAction, // Use renamed prop
  isReadOnly = false, 
  indicators, // Accept indicators
  onIndicatorsChangeAction // Accept onIndicatorsChangeAction
}: GovernmentSpendingProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'comparison'>('overview');

  const handleSpendingPercentChange = (index: number, value: number) => {
    if (isReadOnly) return;
    const newCategories = [...spendingData.spendingCategories];
    
    const totalOthers = newCategories.reduce((sum, cat, idx) => 
      idx !== index ? sum + cat.percent : sum, 0);
    
    const adjustedValue = Math.min(value, Math.max(0, 100 - totalOthers)); 
    
    if (newCategories[index]) {
      newCategories[index] = {
        ...newCategories[index],
        percent: adjustedValue,
        amount: (spendingData.totalSpending * adjustedValue) / 100
      };
      
      const remainingPercent = 100 - adjustedValue;
      const sumOfOthersForNormalization = newCategories
        .filter((_, idx) => idx !== index)
        .reduce((sum, cat) => sum + cat.percent, 0);

      const normalizedCategories = newCategories.map((cat, idx) => {
        if (idx === index) return cat;
        if (sumOfOthersForNormalization === 0) { 
            const otherCatsCount = newCategories.length -1;
            if (otherCatsCount > 0) {
                const equalShare = remainingPercent / otherCatsCount;
                 return {
                    ...cat,
                    percent: equalShare,
                    amount: (spendingData.totalSpending * equalShare) / 100
                };
            }
            return cat; 
        }
        
        const normalizedPercent = (cat.percent / sumOfOthersForNormalization) * remainingPercent;
        return {
          ...cat,
          percent: normalizedPercent,
          amount: (spendingData.totalSpending * normalizedPercent) / 100
        };
      });
      
      onSpendingDataChangeAction({ // Use renamed prop
        ...spendingData,
        spendingCategories: normalizedCategories
      });
    }
  };

  const handleTotalSpendingChange = (value: number) => {
    if (isReadOnly) return;
    const newSpendingData = { ...spendingData };
    newSpendingData.totalSpending = value;
    newSpendingData.spendingGDPPercent = nominalGDP > 0 ? (value / nominalGDP) * 100 : 0;
    newSpendingData.spendingPerCapita = totalPopulation > 0 ? value / totalPopulation : 0;
    
    newSpendingData.spendingCategories = spendingData.spendingCategories.map(cat => ({
      ...cat,
      amount: (value * cat.percent) / 100
    }));
    
    onSpendingDataChangeAction(newSpendingData); // Use renamed prop
  };

  const handleSpendingGDPPercentChange = (value: number) => {
    if (isReadOnly) return;
    const newTotalSpending = (nominalGDP * value) / 100;
    handleTotalSpendingChange(newTotalSpending);
  };

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? `${prefix}N/A` : 'N/A';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const getBudgetHealth = () => {
    const deficit = spendingData.deficitSurplus ?? 0;
    const deficitPercent = nominalGDP > 0 ? (deficit / nominalGDP) * 100 : 0;
    
    if (deficitPercent > 1) return { color: "text-green-600", label: "Surplus" };
    if (deficitPercent > -2) return { color: "text-blue-600", label: "Balanced" };
    if (deficitPercent > -5) return { color: "text-yellow-600", label: "Moderate Deficit" };
    return { color: "text-red-600", label: "High Deficit" };
  };

  const budgetHealth = getBudgetHealth();

  const pieData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    value: cat.percent,
    color: cat.color || '#CCCCCC' 
  }));

  const barData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: cat.amount,
    color: cat.color || '#CCCCCC'
  }));

  const perCapitaData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: totalPopulation > 0 ? cat.amount / totalPopulation : 0,
    color: cat.color || '#CCCCCC'
  }));

  /**
   * Renders an icon component based on the icon name with type safety
   * @param iconName - Optional icon name to render
   * @returns JSX element with the appropriate icon
   */
  const renderIcon = (iconName?: string): React.ReactElement => {
    // Ensure type safety when accessing the icon map
    const IconComponent: React.ElementType = (iconName && iconMap[iconName]) ? iconMap[iconName] as React.ElementType : MoreHorizontal;
    return React.createElement(IconComponent, { className: "h-4 w-4 mr-2 text-gray-400" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
          <Building className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
          Government Spending
        </h3>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-1">
          {['overview', 'detailed', 'comparison'].map((view) => (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Building className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {formatNumber(spendingData.totalSpending)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Government Spending</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {spendingData.spendingGDPPercent.toFixed(1)}% of GDP
          </div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <Users2 className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-[var(--color-text-primary)]">
            {formatNumber(spendingData.spendingPerCapita)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Spending per Capita</div>
        </div>

        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between mb-2">
            <BarChart2 className="h-6 w-6 text-green-600" />
          </div>
          <div className={`text-xl font-bold ${budgetHealth.color}`}>
            {formatNumber(Math.abs(spendingData.deficitSurplus))}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {spendingData.deficitSurplus >= 0 ? 'Budget Surplus' : 'Budget Deficit'}
          </div>
          <div className={`text-xs ${budgetHealth.color}`}>
            {budgetHealth.label}
          </div>
        </div>
      </div>

      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-4">Spending Distribution</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(1) : '0'}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="form-label flex items-center">
                <Building className="h-4 w-4 mr-2 text-[var(--color-brand-primary)]" />
                Government Spending (% of GDP)
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="0.1"
                  value={spendingData.spendingGDPPercent}
                  onChange={(e) => handleSpendingGDPPercentChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider"
                  disabled={isReadOnly}
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>10%</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {spendingData.spendingGDPPercent.toFixed(1)}%
                  </span>
                  <span>60%</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
              <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Spending Summary</h5>
              <div className="space-y-2">
                {spendingData.spendingCategories.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center" style={{ color: cat.color }}>
                        {renderIcon(cat.icon)}
                        <span className="text-sm text-[var(--color-text-primary)]">{cat.category}</span>
                      </div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {formatNumber(cat.amount)}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedView === 'detailed' && (
        <div className="space-y-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatNumber(value as number)} />
                <Bar dataKey="amount" name="Spending Amount">
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-semibold text-[var(--color-text-primary)]">Spending Categories</h4>
            
            {spendingData.spendingCategories.map((cat, index) => (
                <div key={cat.category} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center" style={{ color: cat.color }}>
                      {renderIcon(cat.icon)}
                      <h5 className="font-medium text-[var(--color-text-primary)]">{cat.category}</h5>
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {formatNumber(cat.amount)} ({cat.percent.toFixed(1)}%)
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">{cat.description}</div>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="1"
                        max="40"
                        step="0.1"
                        value={cat.percent}
                        onChange={(e) => handleSpendingPercentChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer slider mr-2"
                        disabled={isReadOnly}
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {cat.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {formatNumber(totalPopulation > 0 ? cat.amount / totalPopulation : 0)} per capita
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {selectedView === 'comparison' && (
        <div className="space-y-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perCapitaData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatNumber(value as number)} />
                <Bar dataKey="amount" name="Per Capita Spending">
                  {perCapitaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
              <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Spending Priorities</h5>
              <div className="space-y-3">
                {spendingData.spendingCategories
                  .sort((a, b) => b.percent - a.percent)
                  .map((cat, index) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center" style={{ color: cat.color }}>
                          <div className="w-5 text-center text-xs font-medium text-[var(--color-text-muted)]">{index + 1}</div>
                          {renderIcon(cat.icon)}
                          <span className="text-sm text-[var(--color-text-primary)]">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {cat.percent.toFixed(1)}%
                        </div>
                      </div>
                    )
                  )}
              </div>
            </div>

            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
              <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Per Capita Analysis</h5>
              <div className="space-y-3">
                {spendingData.spendingCategories
                  .sort((a, b) => (totalPopulation > 0 ? (b.amount / totalPopulation) - (a.amount / totalPopulation) : 0))
                  .map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center" style={{ color: cat.color }}>
                           {renderIcon(cat.icon)}
                          <span className="text-sm text-[var(--color-text-primary)]">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {formatNumber(totalPopulation > 0 ? cat.amount / totalPopulation : 0)}
                        </div>
                      </div>
                    )
                  )}
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
              Spending Analysis
            </h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              Your government spends {formatNumber(spendingData.totalSpending)} ({spendingData.spendingGDPPercent.toFixed(1)}% of GDP), 
              with the highest allocation to {
                spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.category ?? 'Unknown'
              } ({
                (spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.percent ?? 0).toFixed(1)
              }%). 
              The budget is currently {
                spendingData.deficitSurplus >= 0 
                  ? `in surplus by ${formatNumber(spendingData.deficitSurplus)}`
                  : `in deficit by ${formatNumber(Math.abs(spendingData.deficitSurplus))}`
              }.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
