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
  Shield
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { GlassCard, GlassCardContent } from './GlassCard';
import type { EconomicInputs } from '../../lib/economy-data-service';

interface LiveFeedbackProps {
  inputs: EconomicInputs;
  className?: string;
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

interface CitizenSentiment {
  overall: number;
  economic: number;
  social: number;
  political: number;
}

export function LiveFeedback({ inputs, className }: LiveFeedbackProps) {
  const [metrics, setMetrics] = useState<EconomicMetric[]>([]);
  const [sentiment, setSentiment] = useState<CitizenSentiment>({
    overall: 75,
    economic: 70,
    social: 80,
    political: 75
  });

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
          id: 'economic-stability',
          label: 'Economic Stability',
          value: economicStability,
          change: economicStability > 70 ? 0.5 : -0.2,
          trend: economicStability > 70 ? 'up' : 'down',
          icon: Activity,
          unit: '%',
          category: 'stability'
        },
        {
          id: 'social-wellbeing',
          label: 'Social Wellbeing',
          value: socialWellbeing,
          change: socialWellbeing > 75 ? 0.8 : -0.3,
          trend: socialWellbeing > 75 ? 'up' : 'down',
          icon: Heart,
          unit: '%',
          category: 'social'
        }
      ];
    };

    const newMetrics = calculateMetrics();
    setMetrics(newMetrics);

    // Update citizen sentiment based on metrics
    const economicScore = newMetrics.filter(m => m.category === 'economic')
      .reduce((avg, m) => avg + (m.trend === 'up' ? 80 : 60), 0) / 2;
    const socialScore = newMetrics.filter(m => m.category === 'social')
      .reduce((avg, m) => avg + (m.trend === 'up' ? 85 : 65), 0) / 2;
    const stabilityScore = newMetrics.filter(m => m.category === 'stability')
      .reduce((avg, m) => avg + m.value, 0) / 1;

    setSentiment({
      overall: (economicScore + socialScore + stabilityScore) / 3,
      economic: economicScore,
      social: socialScore,
      political: stabilityScore
    });
  }, [inputs]);

  const formatValue = (value: number, unit: string): string => {
    if (unit === '$') {
      if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    }
    return `${value.toFixed(1)}${unit}`;
  };

  const getSentimentColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentIcon = (score: number) => {
    if (score >= 80) return Shield;
    if (score >= 60) return Activity;
    return TrendingDown;
  };

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
              <h3 className="font-semibold text-white">Live Economic Dashboard</h3>
              <p className="text-sm text-white/70">Real-time impact analysis</p>
            </div>
          </div>

          {/* Citizen Sentiment */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Overall', value: sentiment.overall },
              { label: 'Economic', value: sentiment.economic },
              { label: 'Social', value: sentiment.social },
              { label: 'Political', value: sentiment.political }
            ].map((item) => {
              const SentimentIcon = getSentimentIcon(item.value);
              return (
                <div key={item.label} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <SentimentIcon className={cn('h-4 w-4', getSentimentColor(item.value))} />
                    <span className={cn('text-lg font-bold', getSentimentColor(item.value))}>
                      {item.value.toFixed(0)}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{item.label}</p>
                </div>
              );
            })}
          </div>

          {/* Key Metrics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white/80 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Key Economic Indicators
            </h4>
            <div className="space-y-2">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-white/60" />
                      <span className="text-sm text-white/80">{metric.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {formatValue(metric.value, metric.unit)}
                      </span>
                      <div className="flex items-center gap-1">
                        {metric.trend === 'up' ? (
                          <TrendingUp className="h-3 w-3 text-green-400" />
                        ) : metric.trend === 'down' ? (
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        ) : null}
                        <span className={cn(
                          'text-xs font-medium',
                          metric.trend === 'up' ? 'text-green-400' : 
                          metric.trend === 'down' ? 'text-red-400' : 'text-white/60'
                        )}>
                          {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}