"use client";

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Factory, 
  Ship, 
  Zap,
  BarChart3,
  Building2,
  Gauge,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { api } from '~/trpc/react';

// Atomic Components
import {
  EmploymentMetrics,
  IncomeDistribution,
  SectorAnalysis,
  TradeMetrics,
  ProductivityIndicators
} from '../components/economy';

// Glass Design System
import { 
  SectionBase, 
  SectionLayout, 
  sectionConfigs,
  sectionUtils,
  type ExtendedSectionProps 
} from '../components/glass/SectionBase';

// Types and Calculations
import type { 
  EconomySectionProps, 
  ComprehensiveEconomyData 
} from '../types/economy';
import { 
  calculateComprehensiveEconomy,
  calculateEconomicHealth,
  calculateSustainabilityScore
} from '../lib/economy-calculations';

// Existing Integration
import type { EconomicInputs } from '../lib/economy-data-service';
import { MetricCard } from '../primitives/enhanced';

interface EconomySectionComponentProps extends ExtendedSectionProps {
  onToggleAdvanced?: () => void;
  countryId?: string;
}

export function EconomySection({
  inputs,
  onInputsChange,
  showAdvanced = false,
  onToggleAdvanced,
  referenceCountry,
  className,
  countryId
}: EconomySectionComponentProps) {
  
  const [activeView, setActiveView] = useState<'overview' | 'employment' | 'income' | 'sectors' | 'trade' | 'productivity'>('overview');
  
  // Extract core economic data from inputs
  const totalPopulation = inputs.coreIndicators.totalPopulation;
  const nominalGDP = inputs.coreIndicators.nominalGDP;
  const gdpPerCapita = inputs.coreIndicators.gdpPerCapita;
  const gdpGrowthRate = inputs.coreIndicators.realGDPGrowthRate;
  const inflationRate = inputs.coreIndicators.inflationRate;
  const unemploymentRate = inputs.laborEmployment.unemploymentRate;
  const giniCoefficient = inputs.coreIndicators.giniCoefficient || 0.38;
  const publicDebtGDP = inputs.fiscalSystem.totalDebtGDPRatio || 60;

  // Generate comprehensive economy data
  const economyData = useMemo<ComprehensiveEconomyData>(() => {
    return calculateComprehensiveEconomy(
      totalPopulation,
      nominalGDP,
      gdpPerCapita,
      gdpGrowthRate,
      inflationRate,
      unemploymentRate,
      giniCoefficient,
      publicDebtGDP
    );
  }, [totalPopulation, nominalGDP, gdpPerCapita, gdpGrowthRate, inflationRate, unemploymentRate, giniCoefficient, publicDebtGDP]);

  // Calculate overall scores
  const economicHealthScore = useMemo(() => calculateEconomicHealth(economyData), [economyData]);
  const sustainabilityScore = useMemo(() => calculateSustainabilityScore(economyData), [economyData]);

  // Get atomic components if country ID is provided
  const { data: atomicComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || '' },
    { 
      enabled: !!countryId && showAdvanced,
      staleTime: 30000 
    }
  );

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', variant: 'default' as const, color: 'emerald' };
    if (score >= 65) return { label: 'Good', variant: 'default' as const, color: 'blue' };
    if (score >= 50) return { label: 'Fair', variant: 'secondary' as const, color: 'yellow' };
    return { label: 'Needs Improvement', variant: 'destructive' as const, color: 'red' };
  };

  const healthStatus = getHealthStatus(economicHealthScore);
  const sustainabilityStatus = getHealthStatus(sustainabilityScore);

  // Format currency helper
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toFixed(0)}`;
  };

  // Overview Content
  const overviewContent = (
    <div className="space-y-6">
      {/* Health Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Activity className="h-5 w-5" />
                Economic Health
              </span>
              <Badge variant={healthStatus.variant}>{healthStatus.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold text-{healthStatus.color}-600">
                  {economicHealthScore.toFixed(0)}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Composite score based on growth, inflation, employment, debt, and trade metrics
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Gauge className="h-5 w-5" />
                Sustainability
              </span>
              <Badge variant={sustainabilityStatus.variant}>{sustainabilityStatus.label}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-3xl font-bold text-{sustainabilityStatus.color}-600">
                  {sustainabilityScore.toFixed(0)}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Long-term economic viability based on debt, productivity, and innovation
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Economic Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="GDP"
          value={formatCurrency(nominalGDP)}
          icon={BarChart3}
          description={`${formatCurrency(gdpPerCapita)} per capita`}
          trend={gdpGrowthRate > 2 ? 'up' : gdpGrowthRate > 0 ? 'neutral' : 'down'}
        />
        
        <MetricCard
          label="GDP Growth"
          value={`${gdpGrowthRate.toFixed(1)}%`}
          icon={TrendingUp}
          description="Annual real growth"
          trend={gdpGrowthRate > 2 ? 'up' : 'neutral'}
        />
        
        <MetricCard
          label="Inflation"
          value={`${inflationRate.toFixed(1)}%`}
          icon={Activity}
          description={Math.abs(inflationRate - 2) < 1 ? 'Near target' : 'Off target'}
          trend={Math.abs(inflationRate - 2) < 1 ? 'up' : 'neutral'}
        />
        
        <MetricCard
          label="Unemployment"
          value={`${unemploymentRate.toFixed(1)}%`}
          icon={Users}
          description={`${Math.round(totalPopulation * 0.65 * (unemploymentRate / 100)).toLocaleString()} people`}
          trend={unemploymentRate < 5 ? 'up' : unemploymentRate > 8 ? 'down' : 'neutral'}
        />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Labor Market
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Workforce</span>
              <span className="font-medium">{economyData.employment.totalWorkforce.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Participation Rate</span>
              <span className="font-medium">{economyData.employment.laborForceParticipationRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Employment Rate</span>
              <span className="font-medium">{economyData.employment.employmentRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Income & Inequality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Median Income</span>
              <span className="font-medium">{formatCurrency(economyData.income.nationalMedianIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gini Coefficient</span>
              <span className="font-medium">{(economyData.income.giniCoefficient * 100).toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Poverty Rate</span>
              <span className="font-medium">{economyData.income.povertyRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Ship className="h-4 w-4" />
              Trade Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Exports</span>
              <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(economyData.trade.totalExports)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Imports</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(economyData.trade.totalImports)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Balance</span>
              <span className={`font-medium ${economyData.trade.tradeBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(Math.abs(economyData.trade.tradeBalance))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Economic Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Economic Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {economyData.sectors.economicStructure.primarySector.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Primary Sector</div>
              <div className="text-xs text-muted-foreground">(Agriculture, Mining)</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {economyData.sectors.economicStructure.secondarySector.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Secondary Sector</div>
              <div className="text-xs text-muted-foreground">(Manufacturing)</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {economyData.sectors.economicStructure.tertiarySector.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Tertiary Sector</div>
              <div className="text-xs text-muted-foreground">(Services)</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {economyData.sectors.economicStructure.quaternarySector.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Quaternary Sector</div>
              <div className="text-xs text-muted-foreground">(Knowledge, Tech)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render content based on active view
  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return overviewContent;
      case 'employment':
        return (
          <EmploymentMetrics 
            data={economyData.employment}
            totalPopulation={totalPopulation}
            showAdvanced={showAdvanced}
          />
        );
      case 'income':
        return (
          <IncomeDistribution
            data={economyData.income}
            totalPopulation={totalPopulation}
            showAdvanced={showAdvanced}
          />
        );
      case 'sectors':
        return (
          <SectorAnalysis
            data={economyData.sectors}
            nominalGDP={nominalGDP}
            showAdvanced={showAdvanced}
          />
        );
      case 'trade':
        return (
          <TradeMetrics
            data={economyData.trade}
            nominalGDP={nominalGDP}
            showAdvanced={showAdvanced}
          />
        );
      case 'productivity':
        return (
          <ProductivityIndicators
            data={economyData.productivity}
            showAdvanced={showAdvanced}
          />
        );
      default:
        return overviewContent;
    }
  };

  return (
    <SectionBase
      config={{
        id: "economy",
        title: "Comprehensive Economy",
        subtitle: "Detailed economic analysis covering employment, income, sectors, trade, and productivity",
        icon: Building2,
        theme: "neutral"
      }}
      inputs={inputs}
      onInputsChange={onInputsChange}
      isReadOnly={false}
      showComparison={false}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      className={className}
    >
      <div className="space-y-6">
        {/* View Selector */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'employment', label: 'Employment', icon: Users },
            { id: 'income', label: 'Income', icon: DollarSign },
            { id: 'sectors', label: 'Sectors', icon: Factory },
            { id: 'trade', label: 'Trade', icon: Ship },
            { id: 'productivity', label: 'Productivity', icon: Zap },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeView === id
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {renderContent()}

        {/* Integration Note */}
        {showAdvanced && (
          <Alert>
            <Building2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Economic System Integration</strong><br />
              This comprehensive economy section integrates with Labor & Employment, Fiscal System, and Government Spending sections.
              Changes here reflect atomic economic components and real-time calculations based on your country's core indicators.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SectionBase>
  );
}

