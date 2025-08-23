"use client";

import React, { useMemo } from 'react';
import { Building2, GraduationCap, Heart, Shield, Hammer, Users, Leaf, BarChart3, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  EnhancedSlider,
  EnhancedNumberInput,
  GlassProgressIndicator,
  MetricCard,
  ViewTransition
} from '../primitives/enhanced';
import { StandardSectionTemplate, SECTION_THEMES } from '../primitives/StandardSectionTemplate';
import type { StandardSectionProps } from '../primitives/StandardSectionTemplate';
import type { GovernmentSpendingData } from '../lib/economy-data-service';

export function GovernmentSpendingSectionModern({
  inputs,
  onInputsChange,
  showAdvanced,
  onToggleAdvanced,
  referenceCountry,
  className
}: StandardSectionProps) {
  const governmentSpending = inputs.governmentSpending;
  const nominalGDP = inputs.coreIndicators.nominalGDP;
  
  // Handle input changes with proper type safety
  const handleSpendingChange = (field: keyof GovernmentSpendingData, value: any) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newGovernmentSpending = { ...governmentSpending, [field]: safeValue };
    onInputsChange({ ...inputs, governmentSpending: newGovernmentSpending });
  };

  const handleCategoryChange = (category: string, value: number) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const newCategories = governmentSpending.spendingCategories.map(cat =>
      cat.category.toLowerCase() === category.toLowerCase() 
        ? { ...cat, percent: safeValue }
        : cat
    );
    handleSpendingChange('spendingCategories', newCategories);
  };

  // Calculate spending analysis
  const spendingAnalysis = useMemo(() => {
    const categories = [
      { name: 'Education', category: 'Education', icon: GraduationCap, priority: 'high', color: '#3b82f6' },
      { name: 'Healthcare', category: 'Healthcare', icon: Heart, priority: 'high', color: '#10b981' },
      { name: 'Defense', category: 'Defense', icon: Shield, priority: 'medium', color: '#ef4444' },
      { name: 'Infrastructure', category: 'Infrastructure', icon: Hammer, priority: 'high', color: '#f59e0b' },
      { name: 'Social Security', category: 'Social Security', icon: Users, priority: 'high', color: '#8b5cf6' },
      { name: 'Environmental', category: 'Environmental', icon: Leaf, priority: 'medium', color: '#06b6d4' }
    ];

    // Safely extract values with NaN protection
    const safeGDP = typeof nominalGDP === 'number' && !isNaN(nominalGDP) ? nominalGDP : 0;
    
    const spendingData = categories.map(cat => {
      const spendingCat = governmentSpending.spendingCategories.find(sc => 
        sc.category.toLowerCase() === cat.category.toLowerCase()
      );
      const safePercent = typeof spendingCat?.percent === 'number' && !isNaN(spendingCat.percent) ? spendingCat.percent : 0;
      return {
        ...cat,
        percent: safePercent,
        amount: safeGDP * safePercent / 100
      };
    });

    const totalSpending = spendingData.reduce((sum, cat) => {
      const safePercent = typeof cat.percent === 'number' && !isNaN(cat.percent) ? cat.percent : 0;
      return sum + safePercent;
    }, 0);
    const isBalanced = Math.abs(totalSpending - 100) <= 1;
    
    const priorityBalance = {
      high: spendingData.filter(cat => cat.priority === 'high').reduce((sum, cat) => {
        const safePercent = typeof cat.percent === 'number' && !isNaN(cat.percent) ? cat.percent : 0;
        return sum + safePercent;
      }, 0),
      medium: spendingData.filter(cat => cat.priority === 'medium').reduce((sum, cat) => {
        const safePercent = typeof cat.percent === 'number' && !isNaN(cat.percent) ? cat.percent : 0;
        return sum + safePercent;
      }, 0),
    };

    const spendingHealth = isBalanced && priorityBalance.high > 50 ? 'excellent' :
                          isBalanced ? 'good' :
                          Math.abs(totalSpending - 100) <= 5 ? 'concerning' : 'critical';

    return {
      categories: spendingData,
      totalSpending,
      isBalanced,
      priorityBalance,
      spendingHealth,
      totalAmount: nominalGDP * totalSpending / 100
    };
  }, [governmentSpending, nominalGDP]);

  // Auto-balance function
  const autoBalance = () => {
    const currentTotal = spendingAnalysis.totalSpending;
    if (Math.abs(currentTotal - 100) <= 1) return; // Already balanced

    const adjustment = (100 - currentTotal) / spendingAnalysis.categories.length;
    const newCategories = governmentSpending.spendingCategories.map(cat => ({
      ...cat,
      percent: Math.max(0, cat.percent + adjustment)
    }));

    handleSpendingChange('spendingCategories', newCategories);
  };

  // Basic view content - Essential spending allocation
  const basicContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Overview Metrics */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Allocation"
          value={`${spendingAnalysis.totalSpending.toFixed(1)}%`}
          icon={BarChart3}
          sectionId="government"
        />
        <MetricCard
          label="Total Amount"
          value={`$${spendingAnalysis.totalAmount.toLocaleString()}`}
          icon={DollarSign}
          sectionId="government"
        />
        <MetricCard
          label="Budget Status"
          value={spendingAnalysis.isBalanced ? 'Balanced' : 'Unbalanced'}
          icon={spendingAnalysis.isBalanced ? CheckCircle : AlertTriangle}
          sectionId="government"
        />
        <MetricCard
          label="Priority Spending"
          value={`${spendingAnalysis.priorityBalance.high.toFixed(1)}%`}
          unit="high priority"
          icon={Building2}
          sectionId="government"
        />
      </div>

      {/* Budget Balance Indicator */}
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Budget Allocation ({spendingAnalysis.totalSpending.toFixed(1)}% of 100%)
          </h4>
          {!spendingAnalysis.isBalanced && (
            <button
              onClick={autoBalance}
              className="px-3 py-1 text-xs bg-[var(--primitive-primary)]/20 hover:bg-[var(--primitive-primary)]/30 text-[var(--primitive-primary)] rounded-md transition-colors"
            >
              Auto-Balance
            </button>
          )}
        </div>
        
        <GlassProgressIndicator
          value={Math.min(spendingAnalysis.totalSpending, 100)}
          max={100}
          variant="linear"
          showPercentage={true}
          showValue={false}
          sectionId="government"
          color={spendingAnalysis.isBalanced ? '#10b981' : 
                 Math.abs(spendingAnalysis.totalSpending - 100) <= 5 ? '#f59e0b' : '#ef4444'}
        />
        
        {!spendingAnalysis.isBalanced && (
          <p className="text-xs text-muted-foreground">
            {spendingAnalysis.totalSpending > 100 ? 
              `Over-allocated by ${(spendingAnalysis.totalSpending - 100).toFixed(1)}%` :
              `Under-allocated by ${(100 - spendingAnalysis.totalSpending).toFixed(1)}%`
            }
          </p>
        )}
      </div>

      {/* Essential Spending Categories */}
      <div className="space-y-4">
        <h5 className="text-sm font-semibold text-foreground">High Priority Spending</h5>
        
        {spendingAnalysis.categories
          .filter(cat => cat.priority === 'high')
          .map((category) => (
            <EnhancedSlider
              key={category.name}
              label={category.name}
              value={category.percent}
              onChange={(value) => handleCategoryChange(category.category, Number(value))}
              min={0}
              max={40}
              step={0.5}
              unit="%"
              sectionId="government"
              icon={category.icon}
              showTicks={true}
              tickCount={5}
            />
          ))}
      </div>

      <div className="space-y-4">
        <h5 className="text-sm font-semibold text-foreground">Secondary Spending</h5>
        
        {spendingAnalysis.categories
          .filter(cat => cat.priority === 'medium')
          .map((category) => (
            <EnhancedSlider
              key={category.name}
              label={category.name}
              value={category.percent}
              onChange={(value) => handleCategoryChange(category.category, Number(value))}
              min={0}
              max={25}
              step={0.5}
              unit="%"
              sectionId="government"
              icon={category.icon}
              showTicks={true}
              tickCount={5}
            />
          ))}
      </div>
    </div>
  );

  // Advanced view content - Detailed spending analysis
  const advancedContent = (
    <div className="space-y-8">
      {/* Detailed Category Breakdown */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Detailed Budget Allocation
        </h4>
        
        {/* Category Cards with Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {spendingAnalysis.categories.map((category) => (
            <div key={category.name} className="p-4 rounded-lg bg-[var(--primitive-background)]/30 border border-[var(--primitive-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <category.icon className="h-5 w-5 text-[var(--primitive-primary)]" />
                  <div>
                    <h5 className="text-sm font-semibold text-foreground">{category.name}</h5>
                    <p className="text-xs text-muted-foreground capitalize">{category.priority} priority</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{category.percent.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">${category.amount.toLocaleString()}</p>
                </div>
              </div>
              
              <EnhancedSlider
                value={category.percent}
                onChange={(value) => handleCategoryChange(category.category, Number(value))}
                min={0}
                max={category.priority === 'high' ? 40 : 25}
                step={0.1}
                unit="%"
                sectionId="government"
                showTicks={true}
                tickCount={5}
                size="sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Spending Efficiency Analysis */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Spending Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Priority Balance */}
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-foreground">Priority Distribution</h5>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">High Priority</span>
                <span className="text-sm font-medium text-foreground">
                  {spendingAnalysis.priorityBalance.high.toFixed(1)}%
                </span>
              </div>
              <GlassProgressIndicator
                value={spendingAnalysis.priorityBalance.high}
                max={80}
                variant="linear"
                height={8}
                showPercentage={false}
                sectionId="government"
                color="#10b981"
              />
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Medium Priority</span>
                <span className="text-sm font-medium text-foreground">
                  {spendingAnalysis.priorityBalance.medium.toFixed(1)}%
                </span>
              </div>
              <GlassProgressIndicator
                value={spendingAnalysis.priorityBalance.medium}
                max={40}
                variant="linear"
                height={8}
                showPercentage={false}
                sectionId="government"
                color="#f59e0b"
              />
            </div>
          </div>

          {/* Spending Health Assessment */}
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-foreground">Budget Health</h5>
            
            <div className="p-4 rounded-lg bg-[var(--primitive-background)]/30 border border-[var(--primitive-border)]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {spendingAnalysis.spendingHealth === 'excellent' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {spendingAnalysis.spendingHealth === 'good' && <CheckCircle className="h-5 w-5 text-blue-500" />}
                  {spendingAnalysis.spendingHealth === 'concerning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                  {spendingAnalysis.spendingHealth === 'critical' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                  <span className="font-medium text-foreground capitalize">
                    {spendingAnalysis.spendingHealth}
                  </span>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  {spendingAnalysis.isBalanced && (
                    <p className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Budget is properly allocated (100%)
                    </p>
                  )}
                  {spendingAnalysis.priorityBalance.high > 50 && (
                    <p className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Strong focus on high-priority areas
                    </p>
                  )}
                  {!spendingAnalysis.isBalanced && (
                    <p className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                      Budget allocation does not total 100%
                    </p>
                  )}
                  {spendingAnalysis.priorityBalance.high < 40 && (
                    <p className="flex items-center gap-1 text-yellow-500">
                      <AlertTriangle className="h-3 w-3" />
                      Consider increasing high-priority spending
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-Capita Spending */}
      <div className="space-y-6">
        <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Per-Capita Analysis
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {spendingAnalysis.categories.slice(0, 6).map((category) => (
            <MetricCard
              key={category.name}
              label={`${category.name} per Person`}
              value={`$${(category.amount / inputs.coreIndicators.totalPopulation).toFixed(0)}`}
              icon={category.icon}
              sectionId="government"
              size="sm"
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <StandardSectionTemplate
      title="Government Spending"
      description="Budget allocation and public expenditure priorities"
      icon={Building2}
      basicContent={basicContent}
      advancedContent={advancedContent}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      theme={SECTION_THEMES.government}
      depth="elevated"
      blur="medium"
      className={className}
      inputs={inputs}
      onInputsChange={onInputsChange}
      referenceCountry={referenceCountry}
    />
  );
}