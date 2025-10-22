"use client";

import React, { useState, useMemo, type ElementType } from 'react';
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
  Activity,
  PieChart,
  Globe,
  Target,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Clock,
  Settings,
  Play
} from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { api } from '~/trpc/react';
import { useBuilderContext } from '../components/enhanced/context/BuilderStateContext';

// Enhanced Components
import {
  EnhancedSlider,
  EnhancedNumberInput,
  EnhancedToggle,
  EnhancedBarChart,
  EnhancedPieChart,
  MetricCard
} from '../primitives/enhanced';

// Help System
import { EconomicsHelpSystem, FieldHelpTooltip } from '../components/help/GovernmentHelpSystem';
import { EconomicsHelpContent } from '../components/help/EconomicsHelpContent';

// Glass Design System
import { 
  SectionBase, 
  SectionLayout, 
  sectionConfigs,
  sectionUtils,
  type ExtendedSectionProps 
} from '../components/glass/SectionBase';
import { FormGrid } from '../components/glass/ProgressiveViews';

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

// Economy Builder Integration
import type { EconomicInputs } from '../lib/economy-data-service';
import type { EconomyBuilderState } from '~/types/economy-builder';
import { EconomyBuilderModal } from '../components/enhanced/EconomyBuilderModal';
import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';

interface EconomySectionComponentProps extends ExtendedSectionProps {
  onToggleAdvanced?: () => void;
  countryId?: string;
  mode?: 'create' | 'edit';
  fieldLocks?: Record<string, import('../components/enhanced/builderConfig').FieldLockConfig>;
}

interface Metric {
  label: string;
  value: string | number;
  unit?: string;
  icon: ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

export function EconomySection({
  inputs,
  onInputsChange,
  showAdvanced = false,
  onToggleAdvanced,
  referenceCountry,
  className,
  countryId,
  mode = 'create',
  fieldLocks
}: EconomySectionComponentProps) {
  const isEditMode = mode === 'edit';
  const { EDIT_MODE_FIELD_LOCKS } = require('../components/enhanced/builderConfig');
  const locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});

  // Get builder context to update global state
  const builderContext = useBuilderContext?.();

  // Economy Builder State
  const [isEconomyBuilderOpen, setIsEconomyBuilderOpen] = useState(false);
  const [economyBuilderState, setEconomyBuilderState] = useState<EconomyBuilderState | null>(null);

  // Economy Builder Handlers
  const handleOpenEconomyBuilder = () => {
    setIsEconomyBuilderOpen(true);
  };

  const handleSaveEconomyBuilder = (builder: EconomyBuilderState) => {
    setEconomyBuilderState(builder); // Update local state for UI

    // Update global builder state if context is available
    if (builderContext?.updateEconomyBuilderState) {
      builderContext.updateEconomyBuilderState(builder);
      console.log('✅ Economy builder saved to global state:', builder);
    } else {
      console.warn('⚠️ Builder context not available - economy state not persisted to global state');
    }
  };

  // Calculate component effectiveness if we have economy builder state
  const componentEffectiveness = useMemo(() => {
    if (!economyBuilderState?.selectedAtomicComponents) return 0;
    
    const components = economyBuilderState.selectedAtomicComponents;
    const totalEffectiveness = components.reduce(
      (sum, comp) => sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0), 0
    );
    
    return totalEffectiveness / components.length || 0;
  }, [economyBuilderState]);
  
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

  // Calculate metrics for overview
  const metrics: Metric[] = useMemo(() => {
    const workingAgePopulation = Math.round(totalPopulation * 0.65);
    const laborForce = Math.round(workingAgePopulation * 0.65); // 65% participation rate
    const employed = Math.round(laborForce * ((100 - unemploymentRate) / 100));
    
    return [
      {
        label: "GDP Per Capita",
        value: sectionUtils.formatCurrency(gdpPerCapita, '$', 0),
        unit: "/person",
        icon: DollarSign,
        trend: gdpGrowthRate > 2 ? 'up' : gdpGrowthRate < 0 ? 'down' : 'neutral'
      },
      {
        label: "Economic Health",
        value: `${economicHealthScore.toFixed(0)}/100`,
        icon: economicHealthScore >= 70 ? CheckCircle : economicHealthScore < 40 ? AlertTriangle : Gauge,
        trend: economicHealthScore >= 60 ? 'up' : economicHealthScore < 40 ? 'down' : 'neutral'
      },
      {
        label: "Unemployment Rate",
        value: `${unemploymentRate.toFixed(1)}%`,
        icon: unemploymentRate > 10 ? TrendingDown : TrendingUp,
        trend: unemploymentRate < 5 ? 'up' : unemploymentRate > 8 ? 'down' : 'neutral'
      },
      {
        label: "Inflation Rate",
        value: `${inflationRate.toFixed(1)}%`,
        unit: "/year",
        icon: Target,
        trend: Math.abs(inflationRate - 2) < 1 ? 'up' : inflationRate > 5 ? 'down' : 'neutral'
      }
    ];
  }, [totalPopulation, gdpPerCapita, gdpGrowthRate, unemploymentRate, inflationRate, economicHealthScore]);

  // Handle input changes for economic parameters
  const handleEconomicChange = (field: string, value: any) => {
    const keys = field.split('.');
    const updatedInputs = { ...inputs };
    
    if (keys.length === 1) {
      (updatedInputs.coreIndicators as any)[keys[0]] = value;
    } else if (keys.length === 2) {
      (updatedInputs as any)[keys[0]] = {
        ...(updatedInputs as any)[keys[0]],
        [keys[1]]: value
      };
    }

    onInputsChange(updatedInputs);
  };

  // Basic view content - Essential economic indicators
  const basicContent = (
    <>
      {/* Economy Builder Trigger */}
      <div className="md:col-span-2 mb-6">
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Economy Builder</h3>
                <p className="text-sm text-muted-foreground">
                  Configure your economic system with atomic components and advanced settings
                </p>
              </div>
            </div>
            <Button 
              onClick={handleOpenEconomyBuilder}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Configure Economy
            </Button>
          </div>
          
          {/* Economy Builder Summary */}
          {economyBuilderState && (
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {economyBuilderState.selectedAtomicComponents.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Components</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {componentEffectiveness.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Effectiveness</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {economyBuilderState.sectors.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Sectors</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {economyBuilderState.structure.economicModel}
                  </div>
                  <div className="text-xs text-muted-foreground">Model</div>
                </div>
              </div>
              
              {/* Selected Components */}
              <div className="mt-3">
                <div className="text-sm font-medium mb-2">Selected Components:</div>
                <div className="flex flex-wrap gap-1">
                  {economyBuilderState.selectedAtomicComponents.slice(0, 5).map((componentType) => {
                    const component = ATOMIC_ECONOMIC_COMPONENTS[componentType];
                    if (!component) return null;
                    return (
                      <Badge key={componentType} variant="outline" className="text-xs">
                        {component.name}
                      </Badge>
                    );
                  })}
                  {economyBuilderState.selectedAtomicComponents.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{economyBuilderState.selectedAtomicComponents.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Overview Metrics */}
      <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="GDP Per Capita"
          value={sectionUtils.formatCurrency(gdpPerCapita, '$', 0)}
          icon={DollarSign}
          sectionId="core"
          trend={gdpGrowthRate > 2 ? 'up' : gdpGrowthRate < 0 ? 'down' : 'neutral'}
        />
        <MetricCard
          label="Economic Health"
          value={`${economicHealthScore.toFixed(0)}/100`}
          icon={economicHealthScore >= 70 ? CheckCircle : economicHealthScore < 40 ? AlertTriangle : Gauge}
          sectionId="core"
          trend={economicHealthScore >= 60 ? 'up' : economicHealthScore < 40 ? 'down' : 'neutral'}
        />
        <MetricCard
          label="Unemployment"
          value={`${unemploymentRate.toFixed(1)}%`}
          icon={unemploymentRate > 10 ? TrendingDown : TrendingUp}
          sectionId="labor"
          trend={unemploymentRate < 5 ? 'up' : unemploymentRate > 8 ? 'down' : 'neutral'}
        />
        <MetricCard
          label="Inflation Rate"
          value={`${inflationRate.toFixed(1)}%`}
          icon={Target}
          sectionId="core"
          trend={Math.abs(inflationRate - 2) < 1 ? 'up' : inflationRate > 5 ? 'down' : 'neutral'}
        />
      </div>

      {/* Essential Economic Controls */}
      <EnhancedSlider
        label="GDP Growth Rate"
        description="Annual real GDP growth percentage"
        value={Number(gdpGrowthRate) || 0}
        onChange={(value) => handleEconomicChange('realGDPGrowthRate', Number(value))}
        min={-10}
        max={15}
        step={0.1}
        unit="%"
        sectionId="core"
        icon={TrendingUp}
        showTicks={true}
        tickCount={6}
        showValue={true}
        showRange={true}
        referenceValue={referenceCountry?.growthRate}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      <EnhancedSlider
        label="Inflation Rate"
        description="Annual consumer price inflation"
        value={Number(inflationRate) || 0}
        onChange={(value) => handleEconomicChange('inflationRate', Number(value))}
        min={-5}
        max={20}
        step={0.1}
        unit="%"
        sectionId="core"
        icon={Target}
        showTicks={true}
        tickCount={6}
        showValue={true}
        showRange={true}
        referenceValue={referenceCountry?.inflationRate}
        referenceLabel={referenceCountry?.name}
        showComparison={true}
      />

      {/* Economic Health Visualization */}
      <div className="md:col-span-2">
        <EnhancedBarChart
          data={[
            { name: 'GDP Growth', value: gdpGrowthRate, color: 'emerald' },
            { name: 'Inflation', value: inflationRate, color: 'blue' },
            { name: 'Unemployment', value: unemploymentRate, color: 'red' },
            { name: 'Economic Health', value: economicHealthScore, color: 'gold' }
          ]}
          xKey="name"
          yKey="value"
          title="Key Economic Indicators"
          description="Core economic performance metrics"
          height={250}
          sectionId="core"
          formatValue={(value) => `${value.toFixed(1)}%`}
          showTooltip={true}
          showGrid={true}
          showValues={true}
        />
      </div>
    </>
  );

  // Advanced view content - Detailed economic analysis
  const advancedContent = (
    <>
      {/* Advanced Economic Controls */}
      <EnhancedNumberInput
        label="Gini Coefficient"
        description="Income inequality measure (0 = perfect equality, 1 = maximum inequality)"
        value={typeof giniCoefficient === 'number' ? giniCoefficient : 0.38}
        onChange={(value) => handleEconomicChange('giniCoefficient', Number(value))}
        min={0.2}
        max={0.8}
        step={0.01}
        sectionId="core"
        icon={BarChart3}
        showButtons={true}
        format={(value) => Number(value).toFixed(2)}
        helpContent={EconomicsHelpContent.coreIndicators.content}
        helpTitle="Gini Coefficient"
      />

      <EnhancedSlider
        label="Public Debt Ratio"
        description="Government debt as percentage of GDP"
        value={Number(publicDebtGDP) || 60}
        onChange={(value) => handleEconomicChange('fiscalSystem.totalDebtGDPRatio', Number(value))}
        min={0}
        max={200}
        step={1}
        unit="%"
        sectionId="core"
        icon={Building2}
        showTicks={true}
        tickCount={5}
        showValue={true}
        showRange={true}
        helpContent={EconomicsHelpContent.fiscalSystem.content}
        helpTitle="Public Debt Ratio"
      />

      {/* Economic Structure Visualization */}
      <div className="md:col-span-2">
        <EnhancedPieChart
          data={[
            { name: 'Agriculture', value: economyData.sectors.sectorGDPContribution.agriculture, color: 'emerald' },
            { name: 'Industry', value: economyData.sectors.sectorGDPContribution.manufacturing, color: 'blue' },
            { name: 'Services', value: economyData.sectors.sectorGDPContribution.finance + economyData.sectors.sectorGDPContribution.professional, color: 'purple' },
            { name: 'Technology', value: economyData.sectors.sectorGDPContribution.information, color: 'gold' }
          ]}
          dataKey="value"
          nameKey="name"
          title="Economic Structure"
          description="GDP composition by sector"
          height={300}
          sectionId="core"
          showLegend={true}
          showLabels={true}
          showPercentage={true}
          formatValue={(value) => `${value.toFixed(1)}%`}
        />
      </div>

      {/* Income Distribution */}
      <div className="md:col-span-2">
        <EnhancedBarChart
          data={[
            { name: 'Lower Class', value: economyData.income.incomeClasses.lowerClass.percent, color: 'red' },
            { name: 'Middle Class', value: economyData.income.incomeClasses.middleClass.percent, color: 'blue' },
            { name: 'Upper Class', value: economyData.income.incomeClasses.upperClass.percent, color: 'emerald' }
          ]}
          xKey="name"
          yKey="value"
          title="Income Distribution"
          description="Population distribution by income class"
          height={250}
          sectionId="core"
          formatValue={(value) => `${value.toFixed(1)}%`}
          showTooltip={true}
          showGrid={true}
          showValues={true}
        />
      </div>

      {/* Trade Balance */}
      <div className="md:col-span-2">
        <EnhancedBarChart
          data={[
            { name: 'Exports', value: economyData.trade.exportsGDPPercent, color: 'emerald' },
            { name: 'Imports', value: economyData.trade.importsGDPPercent, color: 'red' },
            { name: 'Trade Balance', value: economyData.trade.tradeBalance, color: 'blue' }
          ]}
          xKey="name"
          yKey="value"
          title="International Trade"
          description="Trade flows as percentage of GDP"
          height={250}
          sectionId="core"
          formatValue={(value) => `${value.toFixed(1)}%`}
          showTooltip={true}
          showGrid={true}
          showValues={true}
        />
      </div>
    </>
  );

  // Generate economic insights
  const generateInsights = () => {
    const insights = [];
    
    if (gdpGrowthRate < 0) {
      insights.push("Negative GDP growth indicates economic recession");
    } else if (gdpGrowthRate > 5) {
      insights.push("High growth rate suggests strong economic expansion");
    }
    
    if (inflationRate > 5) {
      insights.push("High inflation may require monetary policy intervention");
    } else if (inflationRate < 0) {
      insights.push("Deflation can indicate economic weakness");
    }
    
    if (unemploymentRate > 10) {
      insights.push("High unemployment suggests need for job creation policies");
    } else if (unemploymentRate < 3) {
      insights.push("Very low unemployment may indicate labor shortages");
    }
    
    if (giniCoefficient > 0.5) {
      insights.push("High income inequality may require redistributive policies");
    }
    
    if (publicDebtGDP > 100) {
      insights.push("High public debt may limit fiscal policy options");
    }
    
    return insights;
  };

  const insights = generateInsights();

  // Calculate derived metrics
  const workingAgePopulation = Math.round(totalPopulation * 0.65);
  const laborForce = Math.round(workingAgePopulation * 0.65);
  const employed = Math.round(laborForce * ((100 - unemploymentRate) / 100));

  return (
    <>
      <SectionBase
        config={{
          id: "economy",
          title: "Economic System",
          subtitle: "Comprehensive economic analysis and configuration",
          icon: Building2,
          theme: "blue"
        }}
        inputs={inputs}
        onInputsChange={onInputsChange}
        isReadOnly={false}
        showComparison={true}
        showAdvanced={showAdvanced}
        onToggleAdvanced={onToggleAdvanced}
        referenceCountry={referenceCountry}
        metrics={metrics}
        validation={{
          errors: [],
          warnings: insights,
          info: [
            `Economic Health Score: ${economicHealthScore.toFixed(0)}/100`,
            `Sustainability Score: ${sustainabilityScore.toFixed(0)}/100`,
            `Working Age Population: ${sectionUtils.formatNumber(workingAgePopulation)}`,
            `Total Labor Force: ${sectionUtils.formatNumber(laborForce)}`
          ]
        }}
        className={className}
        helpContent={<EconomicsHelpSystem />}
      >
        <SectionLayout
          basicContent={basicContent}
          advancedContent={advancedContent}
          showAdvanced={showAdvanced}
          basicColumns={2}
          advancedColumns={2}
        />
      </SectionBase>

      {/* Economy Builder Modal */}
      <EconomyBuilderModal
        isOpen={isEconomyBuilderOpen}
        onClose={() => setIsEconomyBuilderOpen(false)}
        onSave={handleSaveEconomyBuilder}
        initialData={economyBuilderState || undefined}
        economicInputs={inputs}
        countryId={countryId}
      />
    </>
  );
}