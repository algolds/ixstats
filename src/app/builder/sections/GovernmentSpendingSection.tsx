"use client";

import React from 'react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import {
  EnhancedSlider,
  EnhancedToggle,
  EnhancedPieChart,
  EnhancedBarChart,
  MetricCard,
} from '../primitives/enhanced';
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
    { name: 'Education', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent || 0, icon: '🎓', priority: 'high', color: 'blue' },
    { name: 'Healthcare', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent || 0, icon: '🏥', priority: 'high', color: 'emerald' },
    { name: 'Defense', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent || 0, icon: '🛡️', priority: 'medium', color: 'red' },
    { name: 'Infrastructure', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent || 0, icon: '🏗️', priority: 'high', color: 'gold' },
    { name: 'Social Security', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Social Security')?.percent || 0, icon: '👥', priority: 'high', color: 'purple' },
    { name: 'Environmental', value: inputs.governmentSpending.spendingCategories.find(c => c.category === 'Other')?.percent || 0 || 8, icon: '🌱', priority: 'medium', color: 'emerald' }
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
        <EnhancedSlider
          label="Education Spending"
          description="Investment in education system and human capital"
          value={Number(inputs.governmentSpending.spendingCategories.find(c => c.category === 'Education')?.percent) || 0}
          onChange={(value) => updateSpending('education', Number(value))}
          min={5}
          max={35}
          step={0.5}
          precision={1}
          unit="% of budget"
          sectionId="government"
          showTicks={true}
          tickCount={7}
          showValue={true}
          showRange={true}
        />

        <EnhancedSlider
          label="Healthcare Spending"
          description="Public health services and medical infrastructure"
          value={Number(inputs.governmentSpending.spendingCategories.find(c => c.category === 'Healthcare')?.percent) || 0}
          onChange={(value) => updateSpending('healthcare', Number(value))}
          min={8}
          max={40}
          step={0.5}
          precision={1}
          unit="% of budget"
          sectionId="government"
          showTicks={true}
          tickCount={7}
          showValue={true}
          showRange={true}
        />

        <EnhancedSlider
          label="Defense Spending"
          description="Military and national security expenditure"
          value={Number(inputs.governmentSpending.spendingCategories.find(c => c.category === 'Defense')?.percent) || 0}
          onChange={(value) => updateSpending('defense', Number(value))}
          min={2}
          max={30}
          step={0.5}
          precision={1}
          unit="% of budget"
          sectionId="government"
          showTicks={true}
          tickCount={6}
          showValue={true}
          showRange={true}
        />

        <EnhancedSlider
          label="Infrastructure Spending"
          description="Roads, utilities, and public works projects"
          value={Number(inputs.governmentSpending.spendingCategories.find(c => c.category === 'Infrastructure')?.percent) || 0}
          onChange={(value) => updateSpending('infrastructure', Number(value))}
          min={5}
          max={25}
          step={0.5}
          precision={1}
          unit="% of budget"
          sectionId="government"
          showTicks={true}
          tickCount={5}
          showValue={true}
          showRange={true}
        />

        <EnhancedSlider
          label="Social Security"
          description="Pensions, unemployment, and welfare programs"
          value={Number(inputs.governmentSpending.spendingCategories.find(c => c.category === 'Social Security')?.percent) || 0}
          onChange={(value) => updateSpending('socialSecurity', Number(value))}
          min={5}
          max={35}
          step={0.5}
          precision={1}
          unit="% of budget"
          sectionId="government"
          showTicks={true}
          tickCount={7}
          showValue={true}
          showRange={true}
        />

        <EnhancedSlider
          label="Environmental Programs"
          description="Green initiatives and climate action funding"
          value={Number(inputs.governmentSpending.spendingCategories.find(c => c.category === 'Other')?.percent) || 8}
          onChange={(value) => updateSpending('environmental', Number(value))}
          min={2}
          max={20}
          step={0.5}
          precision={1}
          unit="% of budget"
          sectionId="government"
          showTicks={true}
          tickCount={5}
          showValue={true}
          showRange={true}
        />
      </div>

      {/* Spending Policy Toggles */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">Spending Policies</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnhancedToggle
            label="Performance-Based Budgeting"
            description="Link funding to measurable outcomes"
            checked={inputs.governmentSpending.performanceBasedBudgeting}
            onChange={(checked) => updateSpendingPolicy('performanceBasedBudgeting', checked)}
            sectionId="government"
            variant="switch"
            showIcons={true}
          />

          <EnhancedToggle
            label="Universal Basic Services"
            description="Free public services for all citizens"
            checked={inputs.governmentSpending.universalBasicServices}
            onChange={(checked) => updateSpendingPolicy('universalBasicServices', checked)}
            sectionId="government"
            variant="switch"
            showIcons={true}
          />

          <EnhancedToggle
            label="Green Investment Priority"
            description="Prioritize environmental and sustainable projects"
            checked={inputs.governmentSpending.greenInvestmentPriority}
            onChange={(checked) => updateSpendingPolicy('greenInvestmentPriority', checked)}
            sectionId="government"
            variant="switch"
            showIcons={true}
          />

          <EnhancedToggle
            label="Digital Government Initiative"
            description="Major investment in digital infrastructure"
            checked={inputs.governmentSpending.digitalGovernmentInitiative}
            onChange={(checked) => updateSpendingPolicy('digitalGovernmentInitiative', checked)}
            sectionId="government"
            variant="switch"
            showIcons={true}
          />
        </div>
      </div>

      {/* Spending Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedPieChart
          data={spendingCategories.map(cat => ({
            category: cat.name,
            value: cat.value,
            icon: cat.icon,
          }))}
          dataKey="value"
          nameKey="category"
          title="Budget Allocation"
          description="Government spending by sector"
          height={350}
          sectionId="government"
          showLegend={true}
          showPercentage={true}
          formatValue={(value) => `${value.toFixed(1)}%`}
          minSlicePercentage={2}
        />

        <EnhancedBarChart
          data={spendingEfficiencyData}
          xKey="name"
          yKey={['allocation', 'efficiency']}
          title="Spending Efficiency Analysis"
          description="Budget allocation vs effectiveness scores"
          height={350}
          sectionId="government"
          formatValue={(value) => `${value.toFixed(1)}%`}
          showTooltip={true}
          showGrid={true}
          stacked={false}
        />
      </div>

      {/* Note: Historical trends chart removed - can be added back with Enhanced Line Chart */}
      <div className="w-full p-4 rounded-lg border border-purple-200/30 bg-purple-50/20">
        <p className="text-sm text-muted-foreground text-center">
          📊 Historical spending trends visualization will be available when Enhanced Line Chart is implemented
        </p>
      </div>
    </div>
  );
}