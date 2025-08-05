"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Globe, Building2, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

interface ActivityRing {
  id: string;
  title: string;
  description: string;
  value: number; // 0-100 percentage
  max: number;
  color: string;
  icon: LucideIcon;
  metrics: {
    primary: string;
    secondary: string;
    trend: 'up' | 'down' | 'stable';
    change: string;
  };
}

interface ActivityRingsProps {
  rings: ActivityRing[];
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRingClick?: (ringId: string) => void;
  onRingHover?: (ringId: string) => void;
  className?: string;
}

const RING_CONFIGS = {
  sm: {
    diameter: 80,
    strokeWidth: 6,
    gap: 3,
    centerSize: 32,
    iconSize: 16,
  },
  md: {
    diameter: 120,
    strokeWidth: 8,
    gap: 4,
    centerSize: 48,
    iconSize: 20,
  },
  lg: {
    diameter: 160,
    strokeWidth: 12,
    gap: 6,
    centerSize: 64,
    iconSize: 24,
  },
};

const RING_COLORS = {
  economic: '#059669', // Emerald-600 - matches economy tab theme
  population: '#0891B2', // Cyan-600 - matches demographics tab theme  
  diplomatic: '#7C3AED', // Violet-600 - matches government tab theme
  governmental: '#DC2626', // Red-600 - matches labor tab theme
};

function ActivityRingComponent({
  ring,
  config,
  index,
  interactive = false,
  onClick,
  onHover,
}: {
  ring: ActivityRing;
  config: typeof RING_CONFIGS.md;
  index: number;
  interactive?: boolean;
  onClick?: (ringId: string) => void;
  onHover?: (ringId: string) => void;
}) {
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference * (1 - ring.value / 100);
  
  const Icon = ring.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className={`relative cursor-pointer ${interactive ? 'hover:scale-105' : ''}`}
          style={{
            width: config.diameter,
            height: config.diameter,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
            delay: index * 0.1,
          }}
          onClick={() => onClick?.(ring.id)}
          onMouseEnter={() => onHover?.(ring.id)}
          whileHover={interactive ? { scale: 1.05 } : {}}
          whileTap={interactive ? { scale: 0.95 } : {}}
        >
          {/* Background Ring */}
          <svg
            className="absolute inset-0 transform -rotate-90"
            width={config.diameter}
            height={config.diameter}
          >
            <circle
              cx={config.diameter / 2}
              cy={config.diameter / 2}
              r={radius}
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth={config.strokeWidth}
              className="dark:stroke-white/10"
            />
          </svg>

          {/* Progress Ring */}
          <svg
            className="absolute inset-0 transform -rotate-90"
            width={config.diameter}
            height={config.diameter}
          >
            <defs>
              <filter id={`glow-${ring.id}`} x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
                <feGaussianBlur stdDeviation="12" result="coloredBlur2"/>
                <feMerge>
                  <feMergeNode in="coloredBlur2"/>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <linearGradient id={`gradient-${ring.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={ring.color} stopOpacity="1"/>
                <stop offset="40%" stopColor={ring.color} stopOpacity="0.9"/>
                <stop offset="70%" stopColor={ring.color} stopOpacity="0.7"/>
                <stop offset="100%" stopColor={ring.color} stopOpacity="0.4"/>
              </linearGradient>
              <radialGradient id={`radial-glow-${ring.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={ring.color} stopOpacity="0.8"/>
                <stop offset="70%" stopColor={ring.color} stopOpacity="0.3"/>
                <stop offset="100%" stopColor={ring.color} stopOpacity="0"/>
              </radialGradient>
            </defs>
            <motion.circle
              cx={config.diameter / 2}
              cy={config.diameter / 2}
              r={radius}
              fill="none"
              stroke={`url(#gradient-${ring.id})`}
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                delay: index * 0.2,
              }}
              style={{
                filter: `url(#glow-${ring.id})`,
              }}
              className="glass-hierarchy-interactive"
            />
          </svg>

          {/* Center Content */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
            style={{
              width: config.centerSize,
              height: config.centerSize,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Icon
              size={config.iconSize}
              className="mb-1"
              style={{ color: ring.color }}
            />
            <motion.div
              className="text-lg font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 + 0.5 }}
            >
              {ring.value}%
            </motion.div>
          </div>

          {/* Animated Glow Background */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `url(#radial-glow-${ring.id})`,
              filter: 'blur(8px)',
            }}
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.3,
            }}
          />

          {/* Pulse Effect for Critical Values */}
          {ring.value < 40 && (
            <motion.div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${ring.color}15 0%, transparent 60%)`,
                filter: 'blur(4px)',
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </motion.div>
      </TooltipTrigger>
      
      <TooltipContent className="glass-hierarchy-child p-4 max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Icon size={16} style={{ color: ring.color }} />
            <span className="font-semibold">{ring.title}</span>
          </div>
          <p className="text-sm text-muted-foreground">{ring.description}</p>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Score:</span>
              <span className="font-medium">{ring.value}/100</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Primary:</span>
              <span className="font-medium">{ring.metrics.primary}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Secondary:</span>
              <span className="font-medium">{ring.metrics.secondary}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Trend:</span>
              <span className={`font-medium flex items-center gap-1 ${
                ring.metrics.trend === 'up' ? 'text-green-600' :
                ring.metrics.trend === 'down' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {ring.metrics.trend === 'up' ? '↗' : 
                 ring.metrics.trend === 'down' ? '↘' : '→'}
                {ring.metrics.change}
              </span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {ring.value >= 80 ? 'Excellent performance' :
               ring.value >= 60 ? 'Good performance' :
               ring.value >= 40 ? 'Needs attention' :
               'Critical - immediate action required'}
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ActivityRings({
  rings,
  size = 'md',
  interactive = true,
  onRingClick,
  onRingHover,
  className = '',
}: ActivityRingsProps) {
  const config = RING_CONFIGS[size];

  return (
    <div className={`flex flex-wrap gap-6 justify-center ${className}`}>
      {rings.map((ring, index) => (
        <ActivityRingComponent
          key={ring.id && ring.id.trim() && ring.id.trim().length > 0 ? `ring-${ring.id.trim()}` : `ring-fallback-${index}`}
          ring={ring}
          config={config}
          index={index}
          interactive={interactive}
          onClick={onRingClick}
          onHover={onRingHover}
        />
      ))}
    </div>
  );
}

// Default rings configuration for MyCountry
export function createDefaultActivityRings(countryData: {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  economicMetrics: {
    gdpPerCapita: string;
    growthRate: string;
    tier: string;
  };
  populationMetrics: {
    population: string;
    growthRate: string;
    tier: string;
  };
  diplomaticMetrics: {
    allies: string;
    reputation: string;
    treaties: string;
  };
  governmentMetrics: {
    approval: string;
    efficiency: string;
    stability: string;
  };
}): ActivityRing[] {
  return [
    {
      id: 'economic-vitality',
      title: 'Economic Vitality',
      description: 'Overall economic health including GDP growth, trade balance, and economic stability',
      value: countryData.economicVitality,
      max: 100,
      color: RING_COLORS.economic,
      icon: TrendingUp,
      metrics: {
        primary: countryData.economicMetrics.gdpPerCapita,
        secondary: `${countryData.economicMetrics.growthRate} growth`,
        trend: 'up',
        change: countryData.economicMetrics.tier,
      },
    },
    {
      id: 'population-wellbeing',
      title: 'Population Wellbeing',
      description: 'Demographics health, quality of life, education, and social cohesion indicators',
      value: countryData.populationWellbeing,
      max: 100,
      color: RING_COLORS.population,
      icon: Users,
      metrics: {
        primary: countryData.populationMetrics.population,
        secondary: `${countryData.populationMetrics.growthRate} growth`,
        trend: 'stable',
        change: `Tier ${countryData.populationMetrics.tier}`,
      },
    },
    {
      id: 'diplomatic-standing',
      title: 'Diplomatic Standing',
      description: 'International relationships, treaties, trade partnerships, and global reputation',
      value: countryData.diplomaticStanding,
      max: 100,
      color: RING_COLORS.diplomatic,
      icon: Globe,
      metrics: {
        primary: `${countryData.diplomaticMetrics.allies} allies`,
        secondary: countryData.diplomaticMetrics.reputation,
        trend: 'up',
        change: `${countryData.diplomaticMetrics.treaties} treaties`,
      },
    },
    {
      id: 'governmental-efficiency',
      title: 'Government Efficiency',
      description: 'Policy effectiveness, administrative efficiency, public approval, and governance quality',
      value: countryData.governmentalEfficiency,
      max: 100,
      color: RING_COLORS.governmental,
      icon: Building2,
      metrics: {
        primary: `${countryData.governmentMetrics.approval} approval`,
        secondary: countryData.governmentMetrics.efficiency,
        trend: 'stable',
        change: countryData.governmentMetrics.stability,
      },
    },
  ];
}

export default ActivityRings;