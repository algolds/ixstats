// src/app/economy/components/GovernmentSpending.tsx
"use client";

import { useState } from "react";
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
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SpendingCategory {
  category: string;
  amount: number;
  percent: number;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface GovernmentSpendingData {
  totalSpending: number;
  spendingGDPPercent: number;
  spendingPerCapita: number;
  spendingCategories: SpendingCategory[];
  deficitSurplus: number;
}

interface GovernmentSpendingProps {
  spendingData: GovernmentSpendingData;
  nominalGDP: number;
  totalPopulation: number;
  onSpendingDataChange: (spendingData: GovernmentSpendingData) => void;
}

export function GovernmentSpending({
  spendingData,
  nominalGDP,
  totalPopulation,
  onSpendingDataChange,
}: GovernmentSpendingProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'comparison'>('overview');

  const handleSpendingPercentChange = (index: number, value: number) => {
    const newCategories = [...spendingData.spendingCategories];
    
    // Calculate the total of all other percentages
    const totalOthers = newCategories.reduce((sum, cat, idx) => 
      idx !== index ? sum + cat.percent : sum, 0);
    
    // Adjust the new value to ensure total is 100%
    const adjustedValue = Math.min(value, 100 - totalOthers);
    
    if (newCategories[index]) {
      newCategories[index] = {
        ...newCategories[index],
        percent: adjustedValue,
        amount: (spendingData.totalSpending * adjustedValue) / 100
      };
      
      // Normalize other values to ensure total is 100%
      const remainingPercent = 100 - adjustedValue;
      const normalizedCategories = newCategories.map((cat, idx) => {
        if (idx === index) return cat;
        
        const normalizedPercent = (cat.percent / totalOthers) * remainingPercent;
        return {
          ...cat,
          percent: normalizedPercent,
          amount: (spendingData.totalSpending * normalizedPercent) / 100
        };
      });
      
      onSpendingDataChange({
        ...spendingData,
        spendingCategories: normalizedCategories
      });
    }
  };

  const handleTotalSpendingChange = (value: number) => {
    const newSpendingData = { ...spendingData };
    newSpendingData.totalSpending = value;
    newSpendingData.spendingGDPPercent = (value / nominalGDP) * 100;
    newSpendingData.spendingPerCapita = value / totalPopulation;
    
    // Update amounts for all categories
    newSpendingData.spendingCategories = spendingData.spendingCategories.map(cat => ({
      ...cat,
      amount: (value * cat.percent) / 100
    }));
    
    onSpendingDataChange(newSpendingData);
  };

  const handleSpendingGDPPercentChange = (value: number) => {
    const newTotalSpending = (nominalGDP * value) / 100;
    handleTotalSpendingChange(newTotalSpending);
  };

  const formatNumber = (num: number, precision = 1, isCurrency = true): string => {
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const getBudgetHealth = () => {
    const deficit = spendingData.deficitSurplus;
    const deficitPercent = (deficit / nominalGDP) * 100;
    
    if (deficitPercent > 1) return { color: "text-green-600", label: "Surplus" };
    if (deficitPercent > -2) return { color: "text-blue-600", label: "Balanced" };
    if (deficitPercent > -5) return { color: "text-yellow-600", label: "Moderate Deficit" };
    return { color: "text-red-600", label: "High Deficit" };
  };

  const budgetHealth = getBudgetHealth();

  // Data for pie chart
  const pieData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    value: cat.percent,
    color: cat.color
  }));

  // Data for bar chart
  const barData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: cat.amount,
    color: cat.color
  }));

  // Per capita spending data
  const perCapitaData = spendingData.spendingCategories.map(cat => ({
    name: cat.category,
    amount: cat.amount / totalPopulation,
    color: cat.color
  }));

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

      {/* Spending Overview */}
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
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                {spendingData.spendingCategories.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Icon className="h-4 w-4 mr-2" style={{ color: cat.color }} />
                        <span className="text-sm text-[var(--color-text-primary)]">{cat.category}</span>
                      </div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {formatNumber(cat.amount)}
                      </div>
                    </div>
                  );
                })}
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
            
            {spendingData.spendingCategories.map((cat, index) => {
              const Icon = cat.icon;
              return (
                <div key={cat.category} className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <Icon className="h-5 w-5 mr-2" style={{ color: cat.color }} />
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
                      />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] w-12 text-right">
                        {cat.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {formatNumber(cat.amount / totalPopulation)} per capita
                    </div>
                  </div>
                </div>
              );
            })}
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
                  .map((cat, index) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-5 text-center text-xs font-medium text-[var(--color-text-muted)]">{index + 1}</div>
                          <Icon className="h-4 w-4 mx-2" style={{ color: cat.color }} />
                          <span className="text-sm text-[var(--color-text-primary)]">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {cat.percent.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
              <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Per Capita Analysis</h5>
              <div className="space-y-3">
                {spendingData.spendingCategories
                  .sort((a, b) => (b.amount / totalPopulation) - (a.amount / totalPopulation))
                  .map((cat, index) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.category} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Icon className="h-4 w-4 mr-2" style={{ color: cat.color }} />
                          <span className="text-sm text-[var(--color-text-primary)]">{cat.category}</span>
                        </div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {formatNumber(cat.amount / totalPopulation)}
                        </div>
                      </div>
                    );
                  })}
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
                spendingData.spendingCategories.sort((a, b) => b.percent - a.percent)[0]?.percent.toFixed(1) ?? '0.0'
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
