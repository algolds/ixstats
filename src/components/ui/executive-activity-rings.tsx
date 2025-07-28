/**
 * Executive Activity Rings Component
 * Streamlined activity rings for MyCountry dashboard with prominent info display
 */

import React from 'react';
import { motion } from 'framer-motion';
import { HealthRing } from './health-ring';
import { Badge } from './badge';
import { formatCurrency, formatPopulation } from '~/lib/chart-utils';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Shield, 
  Target,
  Activity,
  Crown,
  Zap
} from 'lucide-react';
import { cn } from '~/lib/utils';

interface CountryData {
  name: string;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  currentPopulation: number;
  populationGrowthRate?: number | null;
  adjustedGdpGrowth?: number | null;
  economicTier: string;
  populationTier?: string | null;
  populationDensity?: number | null;
}

interface ExecutiveActivityRingsProps {
  countryData: CountryData;
  onRingClick?: (ringIndex: number) => void;
  className?: string;
  compact?: boolean;
}

export const ExecutiveActivityRings: React.FC<ExecutiveActivityRingsProps> = ({
  countryData,
  onRingClick,
  className,
  compact = false
}) => {
  // Calculate health scores
  const economicHealth = Math.min(100, (countryData.currentGdpPerCapita / 50000) * 100);
  const populationHealth = Math.min(100, Math.max(0, (((countryData.populationGrowthRate ?? 0) * 100) + 2) * 25));
  const developmentIndex = countryData.economicTier === "Extravagant" ? 100 : 
                          countryData.economicTier === "Very Strong" ? 85 :
                          countryData.economicTier === "Strong" ? 70 :
                          countryData.economicTier === "Healthy" ? 55 :
                          countryData.economicTier === "Developed" ? 40 :
                          countryData.economicTier === "Developing" ? 25 : 10;

  const rings = [
    {
      id: 'economic',
      label: 'Economic Power',
      icon: <DollarSign className="h-5 w-5" />,
      value: economicHealth,
      color: '#10b981', // Emerald-500
      metric: formatCurrency(countryData.currentGdpPerCapita),
      subtitle: 'GDP per Capita',
      description: 'Economic strength and prosperity indicator',
      badge: economicHealth > 80 ? 'Excellent' : economicHealth > 60 ? 'Strong' : economicHealth > 40 ? 'Moderate' : 'Developing',
      badgeVariant: economicHealth > 80 ? 'default' : economicHealth > 60 ? 'secondary' : economicHealth > 40 ? 'outline' : 'destructive'
    },
    {
      id: 'population',
      label: 'Demographics',
      icon: <Users className="h-5 w-5" />,
      value: populationHealth,
      color: '#3b82f6', // Blue-500
      metric: formatPopulation(countryData.currentPopulation),
      subtitle: 'Population',
      description: 'Population dynamics and growth trends',
      badge: countryData.populationTier ?? 'Standard',
      badgeVariant: 'outline' as const
    },
    {
      id: 'development',
      label: 'Development Index',
      icon: <TrendingUp className="h-5 w-5" />,
      value: developmentIndex,
      color: '#8b5cf6', // Purple-500
      metric: countryData.economicTier,
      subtitle: 'Economic Tier',
      description: 'Overall development and infrastructure quality',
      badge: `Tier ${developmentIndex > 90 ? 'I' : developmentIndex > 70 ? 'II' : developmentIndex > 50 ? 'III' : 'IV'}`,
      badgeVariant: 'secondary' as const
    }
  ];

  if (compact) {
    return (
      <div className={cn("grid grid-cols-3 gap-3", className)}>
        {rings.map((ring, index) => (
          <motion.div
            key={ring.id}
            className="flex flex-col items-center p-3 rounded-lg glass-hierarchy-child hover:glass-depth-2 transition-all duration-200 cursor-pointer group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onRingClick?.(index)}
          >
            <div className="relative mb-2">
              <HealthRing
                value={ring.value}
                size={50}
                color={ring.color}
                label={ring.label}
                tooltip={`Click to view ${ring.label.toLowerCase()} details`}
                isClickable={true}
                className="group-hover:drop-shadow-lg transition-all duration-200"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ color: ring.color }} className="opacity-80 group-hover:opacity-100 transition-opacity">
                  {ring.icon}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-foreground text-center">{ring.label}</span>
            <span className="text-xs text-muted-foreground text-center truncate w-full">
              {ring.metric}
            </span>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {rings.map((ring, index) => (
        <motion.div
          key={ring.id}
          className="flex items-center gap-4 p-4 rounded-lg glass-hierarchy-child hover:glass-depth-2 transition-all duration-200 cursor-pointer group"
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onRingClick?.(index)}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
        >
          {/* Activity Ring */}
          <div className="relative flex-shrink-0">
            <HealthRing
              value={ring.value}
              size={80}
              color={ring.color}
              label={ring.label}
              tooltip={ring.description}
              isClickable={true}
              className="group-hover:drop-shadow-lg transition-all duration-200"
            />
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
  );
};

export default ExecutiveActivityRings;