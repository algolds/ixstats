"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart,
  BarChart3,
  Zap,
  Activity,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/lib/utils';
import { useAtomicEconomics, useAtomicState } from './AtomicStateProvider';

interface AtomicEconomicIndicatorsProps {
  variant?: 'compact' | 'detailed' | 'dashboard';
  className?: string;
}

interface EconomicMetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  description: string;
  atomicContribution: number;
  color: 'green' | 'blue' | 'purple' | 'orange';
  progress?: number;
}

function EconomicMetricCard({ 
  title, 
  value, 
  change, 
  icon, 
  description, 
  atomicContribution,
  color,
  progress 
}: EconomicMetricCardProps) {
  const colorClasses = {
    green: 'from-green-50 to-emerald-50 border-green-200 text-green-700',
    blue: 'from-blue-50 to-cyan-50 border-blue-200 text-blue-700',
    purple: 'from-purple-50 to-violet-50 border-purple-200 text-purple-700',
    orange: 'from-orange-50 to-amber-50 border-orange-200 text-orange-700'
  };

  const iconColorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600'
  };

  return (
    <motion.div
      className={cn(
        "p-4 rounded-lg border bg-gradient-to-br",
        colorClasses[color]
      )}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={cn("p-1 rounded", iconColorClasses[color])}>
            {icon}
          </div>
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <div className={cn(
          "flex items-center space-x-1 text-xs",
          change >= 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-2xl font-bold">
          {value}
        </div>
        
        <div className="text-xs opacity-70">
          {description}
        </div>

        {progress !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Performance</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="opacity-70">Atomic Contribution:</span>
          <Badge variant="outline" className="text-xs">
            +{(atomicContribution * 100).toFixed(0)}%
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

export function AtomicEconomicIndicators({ 
  variant = 'detailed', 
  className 
}: AtomicEconomicIndicatorsProps) {
  const { economicModifiers, economicPerformance, taxEffectiveness } = useAtomicEconomics();
  const { state } = useAtomicState();

  // Calculate derived metrics
  const gdpGrowthImpact = ((economicModifiers.gdpImpact ?? 0) * 100);
  const taxEfficiencyGain = ((taxEffectiveness.overallMultiplier - 0.8) * 100);
  const stabilityScore = economicModifiers.stabilityIndex ?? 50;
  const investmentAttraction = (economicModifiers.internationalStanding ?? 50);

  const metrics = [
    {
      title: 'GDP Growth Impact',
      value: `${gdpGrowthImpact >= 0 ? '+' : ''}${gdpGrowthImpact.toFixed(1)}%`,
      change: gdpGrowthImpact,
      icon: <TrendingUp className="w-4 h-4" />,
      description: 'Atomic component impact on economic growth',
      atomicContribution: economicPerformance.gdpGrowthMultiplier - 1,
      color: 'green' as const,
      progress: Math.max(0, Math.min(100, 50 + gdpGrowthImpact * 2))
    },
    {
      title: 'Tax Efficiency',
      value: `${taxEfficiencyGain >= 0 ? '+' : ''}${taxEfficiencyGain.toFixed(1)}%`,
      change: taxEfficiencyGain,
      icon: <DollarSign className="w-4 h-4" />,
      description: 'Enhanced tax collection through atomic governance',
      atomicContribution: taxEffectiveness.overallMultiplier - 0.8,
      color: 'blue' as const,
      progress: taxEffectiveness.overallMultiplier * 100
    },
    {
      title: 'Economic Stability',
      value: `${stabilityScore.toFixed(0)}/100`,
      change: stabilityScore - 50, // Assuming 50 is baseline
      icon: <Activity className="w-4 h-4" />,
      description: 'Government stability impact on economy',
      atomicContribution: (stabilityScore - 50) / 100,
      color: 'purple' as const,
      progress: stabilityScore
    },
    {
      title: 'Investment Attraction',
      value: `${investmentAttraction.toFixed(0)}%`,
      change: investmentAttraction - 50, // Assuming 50% is baseline
      icon: <Target className="w-4 h-4" />,
      description: 'Foreign investment attractiveness boost',
      atomicContribution: economicModifiers.internationalStanding ?? 50,
      color: 'orange' as const,
      progress: investmentAttraction
    }
  ];

  if (variant === 'compact') {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Atomic Economic Impact</h3>
          <Badge variant="default" className="bg-primary/10 text-primary">
            {state.selectedComponents.length} Active Components
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {metrics.slice(0, 2).map((metric, index) => (
            <EconomicMetricCard key={index} {...metric} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Economic Performance</h2>
          </div>
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
            Atomic-Powered
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <EconomicMetricCard key={index} {...metric} />
          ))}
        </div>

        {/* Summary insights */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Atomic Economic Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-primary mb-2">Performance Drivers</h4>
                <ul className="space-y-1 text-muted-foreground">
                  {state.synergies.slice(0, 3).map((synergy, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                      <span className="text-xs">{synergy.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-primary mb-2">Key Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overall Effectiveness:</span>
                    <span className="font-medium">{state.effectivenessScore.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Synergies:</span>
                    <span className="font-medium text-green-600">{state.synergies.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">System Conflicts:</span>
                    <span className={`font-medium ${state.conflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {state.conflicts.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detailed view (default)
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Economic Impact Analysis</h2>
          <p className="text-muted-foreground">
            Real-time economic effects of your atomic government components
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
            {state.selectedComponents.length} Components Active
          </Badge>
          <Badge variant={state.effectivenessScore >= 75 ? "default" : "secondary"}>
            {state.effectivenessScore.toFixed(0)}% Effective
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((metric, index) => (
          <EconomicMetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Detailed projections */}
      <Card>
        <CardHeader>
          <CardTitle>Economic Projections</CardTitle>
          <p className="text-sm text-muted-foreground">
            Future economic performance based on current atomic configuration
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium">1-Year Projection</h4>
              <div className="text-2xl font-bold text-primary">
                +{((economicModifiers.gdpImpact ?? 0) * 100).toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                GDP growth impact
              </p>
              <div className="text-sm">
                <span className="text-muted-foreground">Confidence: </span>
                <span className="font-medium">85%</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">3-Year Projection</h4>
              <div className="text-2xl font-bold text-primary">
                +{((economicModifiers.gdpImpact ?? 0) * 100).toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                Cumulative GDP impact
              </p>
              <div className="text-sm">
                <span className="text-muted-foreground">Tax Revenue Boost: </span>
                <span className="font-medium">
                  ${((economicModifiers.taxEfficiency ?? 1.0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Long-term Outlook</h4>
              <div className={cn(
                "text-2xl font-bold",
                (economicModifiers.stabilityIndex ?? 50) > 60 ? 'text-green-600' :
                (economicModifiers.stabilityIndex ?? 50) < 40 ? 'text-red-600' : 'text-yellow-600'
              )}>
                {(economicModifiers.stabilityIndex ?? 50) > 60 ? 'IMPROVING' :
                (economicModifiers.stabilityIndex ?? 50) < 40 ? 'DECLINING' : 'STABLE'}
              </div>
              <p className="text-sm text-muted-foreground">
                Stability trend
              </p>
              <div className="text-sm">
                <span className="text-muted-foreground">Risk Factors: </span>
                <span className="font-medium">
                  {(economicModifiers.stabilityIndex as any).factors.length}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}