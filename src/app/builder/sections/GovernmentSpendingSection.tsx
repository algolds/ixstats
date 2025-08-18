"use client";

import React from 'react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import {
  GlassSlider,
  GlassToggle,
  GlassPieChart,
  GlassBarChart,
  GoogleLineChart,
} from '~/components/charts';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';

interface GovernmentSpendingSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
}

export function GovernmentSpendingSection({ 
  inputs, 
  onInputsChange 
}: GovernmentSpendingSectionProps) {
  // Government spending data for visualization
  const spendingCategories = [
    { name: 'Education', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0, icon: '🎓', priority: 'high' },
    { name: 'Healthcare', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0, icon: '🏥', priority: 'high' },
    { name: 'Defense', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0, icon: '🛡️', priority: 'medium' },
    { name: 'Infrastructure', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0, icon: '🏗️', priority: 'high' },
    { name: 'Social Security', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Social Security')?.percent || 0, icon: '👥', priority: 'high' },
    { name: 'Environmental', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Other')?.percent || 0 || 8, icon: '🌱', priority: 'medium' }
  ];

  const totalSpending = spendingCategories.reduce((sum, cat) => sum + cat.value, 0);
  const isValidBudget = Math.abs(totalSpending - 100) <= 1; // Allow 1% variance

  const spendingEfficiencyData = spendingCategories.map(cat => ({
    name: cat.name,
    allocation: cat.value,
    efficiency: Math.random() * 30 + 60, // Mock efficiency score
    impact: cat.priority === 'high' ? cat.value * 1.2 : cat.value * 0.8
  }));

  const historicalSpendingData = [
    ['Year', 'Education', 'Healthcare', 'Defense', 'Infrastructure'],
    ['2020', 15, 22, 18, 12],
    ['2021', 16, 23, 17, 13],
    ['2022', 17, 24, 16, 14],
    ['2023', 18, 25, 15, 15],
    ['2024', inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0, inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0, 
            inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0, inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0]
  ];

  const updateSpending = (category: string, value: number) => {
    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: inputs.governmentSpending.spendingCategories.map(c =>
          c.category.toLowerCase() === category.toLowerCase() ? { ...c, percent: value } : c
        )
      }
    });
  };

  const updateSpendingPolicy = (policy: keyof typeof inputs.governmentSpending, checked: boolean) => {
    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        [policy]: checked
      }
    });
  };

  // Auto-balance feature
  const autoBalance = () => {
    const currentTotal = totalSpending;
    const adjustment = (100 - currentTotal) / spendingCategories.length;
    
    const newSpendingCategories = inputs.governmentSpending.spendingCategories.map(cat => {
      return {
        ...cat,
        percent: Math.max(0, cat.percent + adjustment)
      };
    });
    
    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: newSpendingCategories
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Budget Balance Indicator */}
      <div className="bg-[var(--color-bg-secondary)]/50 rounded-lg p-4 border border-[var(--color-border-primary)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            Budget Allocation Total
          </span>
          <div className={cn(
            'text-lg font-bold',
            isValidBudget 
              ? 'text-[var(--color-success)]' 
              : 'text-[var(--color-error)]'
          )}>
            {totalSpending.toFixed(1)}%
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 bg-[var(--color-bg-tertiary)] rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                isValidBudget 
                  ? 'bg-[var(--color-success)]' 
                  : totalSpending > 100 
                    ? 'bg-[var(--color-error)]' 
                    : 'bg-[var(--color-warning)]'
              )}
              style={{ width: `${Math.min(100, totalSpending)}%` }}
            />
          </div>
          <Button
            onClick={autoBalance}
            variant="outline"
            size="sm"
            className="ml-3 text-xs"
          >
            Auto-Balance
          </Button>
        </div>
      </div>

      {/* Spending Category Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassSlider
          label="Education Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0}
          onChange={(value) => updateSpending('education', value)}
          min={5}
          max={35}
          step={0.5}
          unit="% of budget"
          theme="blue"
          showTicks={true}
          tickCount={7}
        />

        <GlassSlider
          label="Healthcare Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0}
          onChange={(value) => updateSpending('healthcare', value)}
          min={8}
          max={40}
          step={0.5}
          unit="% of budget"
          theme="default"
          showTicks={true}
          tickCount={7}
        />

        <GlassSlider
          label="Defense Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0}
          onChange={(value) => updateSpending('defense', value)}
          min={2}
          max={30}
          step={0.5}
          unit="% of budget"
          theme="purple"
          showTicks={true}
          tickCount={6}
        />

        <GlassSlider
          label="Infrastructure Spending"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0}
          onChange={(value) => updateSpending('infrastructure', value)}
          min={5}
          max={25}
          step={0.5}
          unit="% of budget"
          theme="emerald"
          showTicks={true}
          tickCount={5}
        />

        <GlassSlider
          label="Social Security"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Social Security')?.percent || 0}
          onChange={(value) => updateSpending('socialSecurity', value)}
          min={5}
          max={35}
          step={0.5}
          unit="% of budget"
          theme="gold"
          showTicks={true}
          tickCount={7}
        />

        <GlassSlider
          label="Environmental Programs"
          value={inputs.governmentSpending.spendingCategories.find(c => c.category === 'Other')?.percent || 0 || 8}
          onChange={(value) => updateSpending('environmental', value)}
          min={2}
          max={20}
          step={0.5}
          unit="% of budget"
          theme="emerald"
          showTicks={true}
          tickCount={5}
        />
      </div>

      {/* Spending Policy Toggles */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Spending Policies</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassToggle
            label="Performance-Based Budgeting"
            description="Link funding to measurable outcomes"
            checked={inputs.governmentSpending.performanceBasedBudgeting}
            onChange={(checked) => updateSpendingPolicy('performanceBasedBudgeting', checked)}
            theme="blue"
          />

          <GlassToggle
            label="Universal Basic Services"
            description="Free public services for all citizens"
            checked={inputs.governmentSpending.universalBasicServices}
            onChange={(checked) => updateSpendingPolicy('universalBasicServices', checked)}
            theme="emerald"
          />

          <GlassToggle
            label="Green Investment Priority"
            description="Prioritize environmental and sustainable projects"
            checked={inputs.governmentSpending.greenInvestmentPriority}
            onChange={(checked) => updateSpendingPolicy('greenInvestmentPriority', checked)}
            theme="emerald"
          />

          <GlassToggle
            label="Digital Government Initiative"
            description="Major investment in digital infrastructure"
            checked={inputs.governmentSpending.digitalGovernmentInitiative}
            onChange={(checked) => updateSpendingPolicy('digitalGovernmentInitiative', checked)}
            theme="purple"
          />
        </div>
      </div>

      {/* Spending Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPieChart
          data={spendingCategories.map(cat => ({
            category: cat.name,
            amount: cat.value,
            percent: cat.value,
            icon: cat.icon,
          }))}
          dataKey="amount"
          nameKey="category"
          title="Budget Allocation"
          description="Government spending by sector"
          height={350}
          theme="purple"
        />

        <GlassBarChart
          data={spendingEfficiencyData}
          xKey="name"
          yKey={['allocation', 'efficiency']}
          title="Spending Efficiency Analysis"
          description="Budget allocation vs effectiveness scores"
          height={350}
          theme="gold"
        />
      </div>

      <div className="w-full">
        <GoogleLineChart
          data={historicalSpendingData}
          title="Historical Spending Trends"
          description="Government spending patterns over time (% of total budget)"
          height={250}
          theme="blue"
          curveType="function"
        />
      </div>
    </div>
  );
}