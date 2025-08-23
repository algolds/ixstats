"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Building2, 
  Activity,
  Zap,
  Heart,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent } from './GlassCard';
import { BuilderVitalityRings } from '../BuilderVitalityRings';
import { PolicyAdvisor } from '../../primitives/PolicyAdvisor';
import { generatePolicyAdvisorTips } from '../../utils/policyAdvisorUtils';
import type { EconomicInputs } from '../../lib/economy-data-service';
import type { ExtractedColors } from '~/lib/image-color-extractor';
import { NumberFlowDisplay } from '~/components/ui/number-flow';

interface LiveFeedbackProps {
  inputs: EconomicInputs;
  className?: string;
  extractedColors?: ExtractedColors | null;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  activeSection?: string;
}

interface EconomicMetric {
  id: string;
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ElementType;
  unit: string;
  category: 'economic' | 'social' | 'stability';
}


export function LiveFeedback({ inputs, className, extractedColors, flagUrl, coatOfArmsUrl, activeSection }: LiveFeedbackProps) {
  const [metrics, setMetrics] = useState<EconomicMetric[]>([]);
  
  // Generate policy advisor tips for live preview
  const advisorTips = generatePolicyAdvisorTips(inputs, activeSection);

  useEffect(() => {
    // Calculate real-time metrics based on economic inputs
    const calculateMetrics = (): EconomicMetric[] => {
      const gdp = inputs.coreIndicators.totalPopulation * inputs.coreIndicators.gdpPerCapita;
      const taxRevenue = gdp * (inputs.fiscalSystem.taxRevenueGDPPercent / 100);
      const governmentBudget = gdp * (inputs.fiscalSystem.governmentBudgetGDPPercent / 100);
      const budgetBalance = taxRevenue - governmentBudget;
      
      // Economic stability score based on multiple factors
      const stabilityFactors = [
        Math.max(0, 100 - inputs.laborEmployment.unemploymentRate * 2), // Unemployment impact
        Math.max(0, 100 - Math.abs(inputs.coreIndicators.inflationRate - 2) * 5), // Inflation target (2%)
        Math.max(0, 100 - Math.abs(inputs.fiscalSystem.totalDebtGDPRatio) / 2), // Debt impact
        Math.min(100, inputs.coreIndicators.realGDPGrowthRate * 20) // Growth boost
      ];
      const economicStability = stabilityFactors.reduce((a, b) => a + b, 0) / stabilityFactors.length;

      // Social wellbeing based on spending and policies
      const socialSpending = (inputs.governmentSpending.education + 
                             inputs.governmentSpending.healthcare + 
                             inputs.governmentSpending.socialSafety) / 3;
      const socialWellbeing = Math.min(100, socialSpending + 
        (inputs.laborEmployment.minimumWage / inputs.coreIndicators.gdpPerCapita * 100) * 50);

      return [
        {
          id: 'gdp-total',
          label: 'Total GDP',
          value: gdp,
          change: inputs.coreIndicators.realGDPGrowthRate,
          trend: inputs.coreIndicators.realGDPGrowthRate > 0 ? 'up' : 'down',
          icon: DollarSign,
          unit: '$',
          category: 'economic'
        },
        {
          id: 'unemployment',
          label: 'Unemployment',
          value: inputs.laborEmployment.unemploymentRate,
          change: -0.3, // Simulated change
          trend: 'down',
          icon: Users,
          unit: '%',
          category: 'social'
        },
        {
          id: 'budget-balance',
          label: 'Budget Balance',
          value: budgetBalance,
          change: budgetBalance > 0 ? 1.2 : -0.8,
          trend: budgetBalance > 0 ? 'up' : 'down',
          icon: Building2,
          unit: '$',
          category: 'economic'
        },
        {
          id: 'population',
          label: 'Population',
          value: inputs.coreIndicators.totalPopulation,
          change: 0.8, // Population growth
          trend: 'up',
          icon: Users,
          unit: '',
          category: 'economic'
        },
        {
          id: 'gdp-per-capita',
          label: 'GDP per Capita',
          value: inputs.coreIndicators.gdpPerCapita,
          change: inputs.coreIndicators.realGDPGrowthRate,
          trend: inputs.coreIndicators.realGDPGrowthRate > 0 ? 'up' : 'down',
          icon: TrendingUp,
          unit: '$',
          category: 'economic'
        },
        {
          id: 'growth-rate',
          label: 'Growth Rate',
          value: inputs.coreIndicators.realGDPGrowthRate,
          change: 0.1, // Small positive change
          trend: inputs.coreIndicators.realGDPGrowthRate > 2 ? 'up' : inputs.coreIndicators.realGDPGrowthRate > 0 ? 'stable' : 'down',
          icon: inputs.coreIndicators.realGDPGrowthRate > 0 ? TrendingUp : TrendingDown,
          unit: '%',
          category: 'economic'
        }
      ];
    };

    const newMetrics = calculateMetrics();
    setMetrics(newMetrics);
  }, [inputs]);



  return (
    <GlassCard 
      depth="elevated" 
      blur="medium" 
      theme="blue" 
      className={cn('w-full', className)}
      motionPreset="slide"
    >
      <GlassCardContent>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-400/30">
              <Zap className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">MyCountry Live Preview</h3>
              <p className="text-sm text-muted-foreground">Real-time economic vitality analysis</p>
            </div>
          </div>

          {/* National Vitality Rings */}
          <BuilderVitalityRings
            economicInputs={inputs}
            extractedColors={extractedColors}
            flagUrl={flagUrl}
            coatOfArmsUrl={coatOfArmsUrl}
            compact={true}
            showMomentum={true}
            className="w-full"
          />

          {/* Key Metrics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Key Economic Indicators
            </h4>
            <div className="space-y-2">
              {metrics.map((metric) => {
                const Icon = metric.icon as React.ComponentType<{ className?: string }>;
                return (
                  <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-card/50 border border-border min-h-[44px]"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">{metric.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <NumberFlowDisplay
                        value={metric.value}
                        format={metric.unit === '$' ? 'currency' : metric.unit === '%' ? 'percentage' : 'default'}
                        className="text-xs font-semibold text-foreground"
                        duration={800}
                      />
                      <div className="flex items-center gap-0.5">
                        {metric.trend === 'up' ? (
                          <TrendingUp className="h-2.5 w-2.5 text-green-400 flex-shrink-0" />
                        ) : metric.trend === 'down' ? (
                          <TrendingDown className="h-2.5 w-2.5 text-red-400 flex-shrink-0" />
                        ) : null}
                        <NumberFlowDisplay
                          value={metric.change}
                          format="percentage"
                          prefix={metric.change > 0 ? '+' : ''}
                          trend={metric.trend}
                          className="text-xs font-medium"
                          duration={600}
                          decimalPlaces={1}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Policy Insights */}
          {advisorTips.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Live Policy Insights
              </h4>
              <div className="space-y-2">
                {advisorTips.slice(0, 2).map((tip) => {
                  const getTipIcon = (type: typeof tip.type) => {
                    switch (type) {
                      case 'warning': return AlertTriangle;
                      case 'suggestion': return Shield;
                      case 'optimization': return TrendingUp;
                    }
                  };
                  
                  const getTipColor = (type: typeof tip.type) => {
                    switch (type) {
                      case 'warning': return 'border-red-400/30 bg-red-400/10 text-red-300 dark:text-red-200';
                      case 'suggestion': return 'border-blue-400/30 bg-blue-400/10 text-blue-300 dark:text-blue-200';
                      case 'optimization': return 'border-green-400/30 bg-green-400/10 text-green-300 dark:text-green-200';
                    }
                  };

                  const Icon = getTipIcon(tip.type) as React.ComponentType<{ className?: string }>;
                  return (
                    <motion.div
                      key={tip.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'p-3 rounded-lg border',
                        getTipColor(tip.type)
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="font-medium text-xs mb-1">{tip.title}</h5>
                          <p className="text-xs opacity-75">{tip.impact}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}