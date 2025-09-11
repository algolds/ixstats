"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Shield, 
  Globe,
  Activity,
  AlertCircle,
  CheckCircle,
  Info,
  Settings
} from 'lucide-react';
import { ComponentType } from '@prisma/client';
import { cn } from '~/lib/utils';
import type { AtomicEconomicModifiers } from '~/lib/atomic-builder-state';

interface AtomicImpactPreviewProps {
  selectedComponents: ComponentType[];
  economicImpact: AtomicEconomicModifiers;
  effectivenessScore: number;
  synergyCount: number;
  conflictCount: number;
  className?: string;
}

interface ImpactCardProps {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple';
  subtitle?: string;
}

function ImpactCard({ 
  title, 
  icon, 
  value, 
  change, 
  trend, 
  color = 'blue',
  subtitle 
}: ImpactCardProps) {
  const colorClasses = {
    green: 'from-green-50 to-emerald-50 border-green-200 text-green-700',
    red: 'from-red-50 to-rose-50 border-red-200 text-red-700',
    blue: 'from-blue-50 to-cyan-50 border-blue-200 text-blue-700',
    orange: 'from-orange-50 to-amber-50 border-orange-200 text-orange-700',
    purple: 'from-purple-50 to-violet-50 border-purple-200 text-purple-700'
  };

  const trendIcon = {
    up: <TrendingUp className="w-3 h-3" />,
    down: <TrendingDown className="w-3 h-3" />,
    stable: <Activity className="w-3 h-3" />
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
          {icon}
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        {trend && (
          <div className={cn(
            "flex items-center space-x-1 text-xs",
            trend === 'up' ? 'text-green-600' : 
            trend === 'down' ? 'text-red-600' : 'text-gray-600'
          )}>
            {trendIcon[trend]}
            {change}
          </div>
        )}
      </div>
      
      <div className="text-2xl font-bold mb-1">
        {value}
      </div>
      
      {subtitle && (
        <div className="text-xs opacity-70">
          {subtitle}
        </div>
      )}
    </motion.div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  color?: 'green' | 'red' | 'blue' | 'orange';
  showValue?: boolean;
}

function ProgressBar({ value, max, color = 'blue', showValue = true }: ProgressBarProps) {
  const percentage = (value / max) * 100;
  
  const colorClasses = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className="space-y-1">
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <motion.div
          className={cn("h-2 rounded-full transition-all", colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>
      {showValue && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{value.toFixed(1)}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

export function AtomicImpactPreview({
  selectedComponents,
  economicImpact,
  effectivenessScore,
  synergyCount,
  conflictCount,
  className
}: AtomicImpactPreviewProps) {
  const {
    gdpImpact,
    taxEfficiency,
    stabilityIndex,
    internationalStanding
  } = economicImpact;

  // Calculate net synergy score
  const netSynergyScore = synergyCount - conflictCount;
  
  // Determine overall system health
  const systemHealth = effectivenessScore >= 80 ? 'excellent' :
                      effectivenessScore >= 60 ? 'good' :
                      effectivenessScore >= 40 ? 'fair' : 'poor';

  return (
    <div className={cn("atomic-impact-preview space-y-6", className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Live Impact Preview
        </h2>
        <p className="text-sm text-muted-foreground">
          Real-time analysis of your atomic component selection
        </p>
      </div>

      {/* Overall Effectiveness Score */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg">
        <div className="text-center mb-3">
          <div className="text-3xl font-bold text-foreground">
            {effectivenessScore.toFixed(0)}%
          </div>
          <div className="text-sm text-muted-foreground">
            System Effectiveness
          </div>
        </div>
        
        <ProgressBar 
          value={effectivenessScore} 
          max={100} 
          color={effectivenessScore >= 80 ? 'green' : effectivenessScore >= 60 ? 'blue' : 'red'}
        />
        
        <div className={cn(
          "text-xs text-center mt-2 font-medium",
          systemHealth === 'excellent' ? 'text-green-600' :
          systemHealth === 'good' ? 'text-blue-600' :
          systemHealth === 'fair' ? 'text-orange-600' : 'text-red-600'
        )}>
          {systemHealth === 'excellent' && '🎯 Exceptional Configuration'}
          {systemHealth === 'good' && '✅ Strong Configuration'}
          {systemHealth === 'fair' && '⚠️ Moderate Configuration'}
          {systemHealth === 'poor' && '❌ Needs Improvement'}
        </div>
      </div>

      {/* Synergies and Conflicts */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "p-3 rounded-lg border",
          synergyCount > 0 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle className={cn(
              "w-4 h-4",
              synergyCount > 0 ? "text-green-600" : "text-gray-400"
            )} />
            <span className="text-sm font-medium">Synergies</span>
          </div>
          <div className="text-lg font-bold text-green-700">
            +{synergyCount}
          </div>
        </div>

        <div className={cn(
          "p-3 rounded-lg border",
          conflictCount > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle className={cn(
              "w-4 h-4",
              conflictCount > 0 ? "text-red-600" : "text-gray-400"
            )} />
            <span className="text-sm font-medium">Conflicts</span>
          </div>
          <div className="text-lg font-bold text-red-700">
            -{conflictCount}
          </div>
        </div>
      </div>

      {/* Economic Impact Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Economic Impact</h3>
        
        <div className="grid grid-cols-1 gap-3">
          {/* GDP Impact */}
          <ImpactCard
            title="GDP Growth"
            icon={<TrendingUp className="w-4 h-4" />}
            value={`${((gdpImpact.current - 1) * 100).toFixed(1)}%`}
            change={gdpImpact.current > 1 ? `+${((gdpImpact.current - 1) * 100).toFixed(1)}%` : '0%'}
            trend={gdpImpact.current > 1.05 ? 'up' : gdpImpact.current > 0.95 ? 'stable' : 'down'}
            color="green"
            subtitle={`Confidence: ${gdpImpact.confidence}%`}
          />

          {/* Tax Efficiency */}
          <ImpactCard
            title="Tax Efficiency"
            icon={<DollarSign className="w-4 h-4" />}
            value={`${((taxEfficiency.currentMultiplier - 1) * 100).toFixed(1)}%`}
            change={`${taxEfficiency.complianceRate}% compliance`}
            trend={taxEfficiency.currentMultiplier > 1.1 ? 'up' : 'stable'}
            color="blue"
            subtitle="Collection efficiency boost"
          />

          {/* Stability Index */}
          <ImpactCard
            title="Stability"
            icon={<Shield className="w-4 h-4" />}
            value={`${stabilityIndex.current.toFixed(0)}/100`}
            change={stabilityIndex.trend}
            trend={stabilityIndex.trend === 'improving' ? 'up' : stabilityIndex.trend === 'declining' ? 'down' : 'stable'}
            color="purple"
            subtitle={`${stabilityIndex.factors.length} factors`}
          />

          {/* International Standing */}
          <ImpactCard
            title="Int'l Standing"
            icon={<Globe className="w-4 h-4" />}
            value={`+${(internationalStanding.tradeBonus * 100).toFixed(1)}%`}
            change={`+${(internationalStanding.diplomaticWeight * 100).toFixed(1)}% influence`}
            trend={internationalStanding.tradeBonus > 0.1 ? 'up' : 'stable'}
            color="orange"
            subtitle="Trade & diplomacy bonus"
          />
        </div>
      </div>

      {/* Component Count Display */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Active Components
            </span>
          </div>
          <span className="text-sm font-medium">
            {selectedComponents.length}/25
          </span>
        </div>
        
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div 
            className="bg-primary h-1 rounded-full transition-all"
            style={{ width: `${(selectedComponents.length / 25) * 100}%` }}
          />
        </div>
      </div>

      {/* Projections */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Future Projections</h3>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
            <span>1 Year GDP Impact:</span>
            <span className="font-medium">
              +{((gdpImpact.projected1Year - 1) * 100).toFixed(1)}%
            </span>
          </div>
          
          <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
            <span>3 Year GDP Impact:</span>
            <span className="font-medium">
              +{((gdpImpact.projected3Years - 1) * 100).toFixed(1)}%
            </span>
          </div>
          
          <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
            <span>Tax Revenue Boost:</span>
            <span className="font-medium">
              ${(taxEfficiency.projectedRevenue / 1000).toFixed(0)}k
            </span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {selectedComponents.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              System Analysis
            </span>
          </div>
          
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            {effectivenessScore >= 85 && (
              <div>✓ Exceptional system effectiveness - ideal configuration</div>
            )}
            {synergyCount > conflictCount && (
              <div>✓ Positive synergies outweigh conflicts</div>
            )}
            {conflictCount > 0 && (
              <div>⚠ Component conflicts detected - consider alternatives</div>
            )}
            {selectedComponents.length < 5 && (
              <div>💡 Add more components for comprehensive governance</div>
            )}
            {gdpImpact.current > 1.2 && (
              <div>🚀 Strong economic growth potential</div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedComponents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted/30 rounded-full flex items-center justify-center">
            <Settings className="w-8 h-8" />
          </div>
          <p className="text-sm">
            Select atomic components to see live impact analysis
          </p>
        </div>
      )}
    </div>
  );
}