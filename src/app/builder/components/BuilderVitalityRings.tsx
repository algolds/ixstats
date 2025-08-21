"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HealthRing } from '~/components/ui/health-ring';
import { Badge } from '~/components/ui/badge';
import { formatCurrency, formatPopulation } from '~/lib/chart-utils';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Shield, 
  Target,
  Activity,
  Crown,
  Zap,
  Flag
} from 'lucide-react';
import { cn } from '~/lib/utils';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { ExtractedColors } from '~/lib/image-color-extractor';

interface BuilderVitalityRingsProps {
  economicInputs: EconomicInputs;
  extractedColors?: ExtractedColors | null;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  onRingClick?: (ringIndex: number) => void;
  className?: string;
  compact?: boolean;
  showMomentum?: boolean;
}

export const BuilderVitalityRings: React.FC<BuilderVitalityRingsProps> = ({
  economicInputs,
  extractedColors,
  flagUrl,
  coatOfArmsUrl,
  onRingClick,
  className,
  compact = false,
  showMomentum = true
}) => {
  const [prevMetrics, setPrevMetrics] = useState<any>(null);
  const [momentum, setMomentum] = useState({ economic: 0, social: 0, government: 0 });

  // Calculate health scores from economic inputs
  const economicHealth = Math.min(100, (economicInputs.coreIndicators.gdpPerCapita / 50000) * 100);
  const socialHealth = Math.min(100, Math.max(0, (((economicInputs.demographics.populationGrowthRate) + 2) * 25)));
  const governmentHealth = Math.min(100, (economicInputs.fiscalSystem.taxRevenueGDPPercent / 30) * 100);

  // Calculate momentum (rate of change)
  useEffect(() => {
    if (prevMetrics && showMomentum) {
      const economicMomentum = economicHealth - prevMetrics.economic;
      const socialMomentum = socialHealth - prevMetrics.social;
      const governmentMomentum = governmentHealth - prevMetrics.government;
      
      setMomentum({
        economic: economicMomentum,
        social: socialMomentum,
        government: governmentMomentum
      });
    }
    
    setPrevMetrics({ 
      economic: economicHealth, 
      social: socialHealth, 
      government: governmentHealth 
    });
  }, [economicHealth, socialHealth, governmentHealth, showMomentum]);

  // Use extracted colors or fallback to defaults
  const colors = extractedColors || {
    primary: '#10b981',
    secondary: '#3b82f6',
    accent: '#8b5cf6'
  };

  const rings = [
    {
      id: 'economic',
      label: 'Economic Vitality',
      icon: <DollarSign className="h-5 w-5" />,
      value: economicHealth,
      color: colors.primary,
      metric: formatCurrency(economicInputs.coreIndicators.gdpPerCapita),
      subtitle: 'GDP per Capita',
      description: 'Economic strength and prosperity indicator',
      momentum: momentum.economic,
      badge: economicHealth > 80 ? 'Excellent' : economicHealth > 60 ? 'Strong' : economicHealth > 40 ? 'Moderate' : 'Developing',
      badgeVariant: economicHealth > 80 ? 'default' : economicHealth > 60 ? 'secondary' : economicHealth > 40 ? 'outline' : 'destructive'
    },
    {
      id: 'social',
      label: 'Social Vitality',
      icon: <Users className="h-5 w-5" />,
      value: socialHealth,
      color: colors.secondary,
      metric: formatPopulation(economicInputs.coreIndicators.totalPopulation),
      subtitle: 'Population',
      description: 'Social stability and demographic health',
      momentum: momentum.social,
      badge: socialHealth > 75 ? 'Thriving' : socialHealth > 50 ? 'Stable' : socialHealth > 25 ? 'Growing' : 'Emerging',
      badgeVariant: 'outline' as const
    },
    {
      id: 'government',
      label: 'Government Vitality',
      icon: <Shield className="h-5 w-5" />,
      value: governmentHealth,
      color: colors.accent,
      metric: `${economicInputs.fiscalSystem.taxRevenueGDPPercent.toFixed(1)}%`,
      subtitle: 'Tax Revenue',
      description: 'Government efficiency and fiscal health',
      momentum: momentum.government,
      badge: governmentHealth > 80 ? 'Efficient' : governmentHealth > 60 ? 'Balanced' : governmentHealth > 40 ? 'Adequate' : 'Strained',
      badgeVariant: 'secondary' as const
    }
  ];

  // Calculate momentum rotation speed (degrees per second)
  const getMomentumRotation = (momentum: number) => {
    return Math.abs(momentum) * 10; // 10 degrees per momentum point
  };

  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Country Header */}
        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
          {flagUrl && (
            <div className="w-8 h-6 rounded border border-white/20 overflow-hidden flex-shrink-0">
              <img src={flagUrl} alt="Flag" className="w-full h-full object-cover" />
            </div>
          )}
         
        </div>

        {/* Compact Rings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {rings.map((ring, index) => (
            <motion.div
              key={ring.id}
              className="flex flex-col items-center p-4 md:p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group touch-manipulation min-h-[44px]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onRingClick?.(index)}
            >
              <div className="relative mb-2">
                <motion.div
                  animate={showMomentum ? { 
                    rotate: ring.momentum !== 0 ? [0, getMomentumRotation(ring.momentum)] : 0
                  } : {}}
                  transition={{ 
                    duration: 2, 
                    repeat: ring.momentum !== 0 ? Infinity : 0, 
                    ease: "linear" 
                  }}
                >
                  <HealthRing
                    value={ring.value}
                    size={50}
                    color={ring.color}
                    label={ring.label}
                    tooltip={`${ring.description} (Momentum: ${ring.momentum > 0 ? '+' : ''}${ring.momentum.toFixed(1)})`}
                    isClickable={true}
                    className="group-hover:drop-shadow-lg transition-all duration-200"
                  />
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div style={{ color: ring.color }} className="opacity-80 group-hover:opacity-100 transition-opacity">
                    {ring.icon}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-foreground text-center">{ring.label.split(' ')[0]}</span>
              <span className="text-xs text-muted-foreground text-center truncate w-full">
                {ring.metric}
              </span>
              {/* Momentum Indicator */}
              {showMomentum && ring.momentum !== 0 && (
                <div className={cn(
                  "text-xs font-medium flex items-center gap-1 mt-1",
                  ring.momentum > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {ring.momentum > 0 ? <TrendingUp className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                  {Math.abs(ring.momentum).toFixed(1)}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Country Header with Symbols */}
      <div className="flex items-center gap-4 p-6 bg-white/5 rounded-lg border border-white/10">
        <div className="flex gap-2">
          {flagUrl && (
            <div className="w-12 h-8 rounded border border-white/20 overflow-hidden">
              <img src={flagUrl} alt="Flag" className="w-full h-full object-cover" />
            </div>
          )}
          {coatOfArmsUrl && (
            <div className="w-8 h-8 rounded border border-white/20 overflow-hidden">
              <img src={coatOfArmsUrl} alt="Coat of Arms" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{economicInputs.countryName}</h2>
          <p className="text-white/60">Live Economic Dashboard</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {Math.round((economicHealth + socialHealth + governmentHealth) / 3)}%
          </div>
          <p className="text-sm text-white/60">Overall Vitality</p>
        </div>
      </div>

      {/* Individual Vitality Rings */}
      <div className="space-y-4">
        {rings.map((ring, index) => (
          <motion.div
            key={ring.id}
            className="flex items-center gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group"
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onRingClick?.(index)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            {/* Vitality Ring with Momentum */}
            <div className="relative flex-shrink-0">
              <motion.div
                animate={showMomentum ? { 
                  rotate: ring.momentum !== 0 ? [0, getMomentumRotation(ring.momentum)] : 0
                } : {}}
                transition={{ 
                  duration: 3, 
                  repeat: ring.momentum !== 0 ? Infinity : 0, 
                  ease: "linear" 
                }}
              >
                <HealthRing
                  value={ring.value}
                  size={80}
                  color={ring.color}
                  label={ring.label}
                  tooltip={ring.description}
                  isClickable={true}
                  className="group-hover:drop-shadow-lg transition-all duration-200"
                />
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div 
                  style={{ color: ring.color }} 
                  className="opacity-80 group-hover:opacity-100 transition-opacity"
                  whileHover={{ scale: 1.1 }}
                >
                  {ring.icon}
                </motion.div>
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-foreground group-hover:text-opacity-80 transition-colors">
                  {ring.label}
                </h4>
                <Badge variant={ring.badgeVariant as any} className="text-xs">
                  {ring.badge}
                </Badge>
                {/* Momentum Badge */}
                {showMomentum && ring.momentum !== 0 && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      ring.momentum > 0 ? "border-green-500/50 text-green-400" : "border-red-500/50 text-red-400"
                    )}
                  >
                    {ring.momentum > 0 ? '+' : ''}{ring.momentum.toFixed(1)}
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold mb-1" style={{ color: ring.color }}>
                {ring.metric}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{ring.subtitle}</p>
              <p className="text-xs text-muted-foreground opacity-80 group-hover:opacity-100 transition-opacity">
                {ring.description}
              </p>
            </div>

            {/* Performance Indicator */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-lg font-bold glow-text" style={{ color: ring.color }}>
                {Math.round(ring.value)}%
              </div>
              <div className="flex items-center gap-1">
                {ring.value > 75 ? (
                  <Crown className="h-4 w-4 text-yellow-400" />
                ) : ring.value > 50 ? (
                  <Target className="h-4 w-4 text-blue-400" />
                ) : ring.value > 25 ? (
                  <Activity className="h-4 w-4 text-orange-400" />
                ) : (
                  <Zap className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BuilderVitalityRings;