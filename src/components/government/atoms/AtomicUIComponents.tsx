"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight,
  Activity,
  Zap,
  Target,
  Shield,
  Users,
  Building2,
  Scale,
  Crown
} from 'lucide-react';

// ============================================
// ATOMIC METRICS COMPONENTS
// ============================================

interface AtomicMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  status?: 'success' | 'warning' | 'error' | 'neutral';
  icon?: React.ElementType;
  className?: string;
}

export const AtomicMetric: React.FC<AtomicMetricProps> = ({
  label,
  value,
  unit,
  trend,
  trendValue,
  status = 'neutral',
  icon: Icon,
  className
}) => {
  const statusColors = {
    success: 'text-green-500 bg-green-500/10',
    warning: 'text-yellow-500 bg-yellow-500/10',
    error: 'text-red-500 bg-red-500/10',
    neutral: 'text-gray-500 bg-gray-500/10'
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-hierarchy-interactive rounded-lg p-4 border border-border/50",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && (
          <div className={cn("p-1.5 rounded-md", statusColors[status])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-sm text-muted-foreground mb-1">{unit}</span>}
      </div>

      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendIcon className={cn(
            "h-4 w-4",
            trend === 'up' ? 'text-green-500' :
            trend === 'down' ? 'text-red-500' :
            'text-gray-500'
          )} />
          {trendValue !== undefined && (
            <span className={cn(
              "text-sm",
              trend === 'up' ? 'text-green-500' :
              trend === 'down' ? 'text-red-500' :
              'text-gray-500'
            )}>
              {trendValue > 0 ? '+' : ''}{trendValue}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// ATOMIC PROGRESS COMPONENTS
// ============================================

interface AtomicProgressProps {
  label: string;
  value: number;
  max: number;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AtomicProgress: React.FC<AtomicProgressProps> = ({
  label,
  value,
  max,
  showPercentage = true,
  color = 'blue',
  size = 'md',
  className
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500'
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {showPercentage && (
          <span className="text-sm text-muted-foreground">
            {percentage.toFixed(0)}%
          </span>
        )}
      </div>
      <div className={cn(
        "relative w-full rounded-full bg-muted overflow-hidden",
        sizeClasses[size]
      )}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn(
            "absolute top-0 left-0 h-full rounded-full",
            colorClasses[color]
          )}
        />
      </div>
    </div>
  );
};

// ============================================
// ATOMIC GAUGE COMPONENTS
// ============================================

interface AtomicGaugeProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  thresholds?: {
    critical: number;
    warning: number;
    good: number;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AtomicGauge: React.FC<AtomicGaugeProps> = ({
  value,
  max,
  label,
  unit,
  thresholds,
  size = 'md',
  className
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage / 100) * 180 - 90;

  const getColor = () => {
    if (!thresholds) return 'text-blue-500';
    if (percentage >= thresholds.good) return 'text-green-500';
    if (percentage >= thresholds.warning) return 'text-yellow-500';
    if (percentage >= thresholds.critical) return 'text-red-500';
    return 'text-gray-500';
  };

  const sizeClasses = {
    sm: 'h-24 w-24',
    md: 'h-32 w-32',
    lg: 'h-40 w-40'
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          <motion.circle
            initial={{ strokeDasharray: '0 283' }}
            animate={{ strokeDasharray: `${(percentage / 100) * 283} 283` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            cx="50%"
            cy="50%"
            r="45%"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className={getColor()}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{value.toLocaleString()}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <span className="text-sm font-medium mt-2">{label}</span>
    </div>
  );
};

// ============================================
// ATOMIC STATUS INDICATORS
// ============================================

interface AtomicStatusProps {
  status: 'active' | 'inactive' | 'pending' | 'error' | 'success';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

export const AtomicStatus: React.FC<AtomicStatusProps> = ({
  status,
  label,
  size = 'md',
  pulse = false,
  className
}) => {
  const statusConfig = {
    active: { color: 'bg-green-500', icon: CheckCircle },
    inactive: { color: 'bg-gray-500', icon: Minus },
    pending: { color: 'bg-yellow-500', icon: Activity },
    error: { color: 'bg-red-500', icon: AlertTriangle },
    success: { color: 'bg-emerald-500', icon: CheckCircle }
  };

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div className={cn(
          "rounded-full",
          sizeClasses[size],
          config.color,
          pulse && "animate-pulse"
        )} />
        {pulse && (
          <div className={cn(
            "absolute inset-0 rounded-full animate-ping",
            sizeClasses[size],
            config.color,
            "opacity-75"
          )} />
        )}
      </div>
      {label && (
        <div className="flex items-center gap-1">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
      )}
    </div>
  );
};

// ============================================
// ATOMIC EFFECTIVENESS METER
// ============================================

interface AtomicEffectivenessProps {
  value: number;
  label: string;
  description?: string;
  showDetails?: boolean;
  factors?: {
    name: string;
    impact: number;
    positive: boolean;
  }[];
  className?: string;
}

export const AtomicEffectiveness: React.FC<AtomicEffectivenessProps> = ({
  value,
  label,
  description,
  showDetails = false,
  factors,
  className
}) => {
  const getEffectivenessLevel = () => {
    if (value >= 90) return { level: 'Excellent', color: 'text-green-500' };
    if (value >= 75) return { level: 'Good', color: 'text-blue-500' };
    if (value >= 60) return { level: 'Moderate', color: 'text-yellow-500' };
    if (value >= 40) return { level: 'Poor', color: 'text-orange-500' };
    return { level: 'Critical', color: 'text-red-500' };
  };

  const effectiveness = getEffectivenessLevel();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "glass-hierarchy-child rounded-lg p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{label}</h4>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{value}%</div>
          <div className={cn("text-sm", effectiveness.color)}>
            {effectiveness.level}
          </div>
        </div>
      </div>

      <AtomicProgress
        label=""
        value={value}
        max={100}
        color={value >= 75 ? 'green' : value >= 50 ? 'yellow' : 'red'}
        showPercentage={false}
      />

      {showDetails && factors && factors.length > 0 && (
        <div className="pt-3 border-t border-border/50 space-y-2">
          <span className="text-sm font-medium">Contributing Factors:</span>
          {factors.map((factor, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{factor.name}</span>
              <span className={cn(
                "font-medium",
                factor.positive ? 'text-green-500' : 'text-red-500'
              )}>
                {factor.positive ? '+' : ''}{factor.impact}%
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// ATOMIC COMPONENT CARD
// ============================================

interface AtomicComponentCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  effectiveness: number;
  cost: number;
  isActive: boolean;
  onToggle?: () => void;
  onConfigure?: () => void;
  synergies?: string[];
  conflicts?: string[];
  className?: string;
}

export const AtomicComponentCard: React.FC<AtomicComponentCardProps> = ({
  title,
  description,
  icon: Icon,
  effectiveness,
  cost,
  isActive,
  onToggle,
  onConfigure,
  synergies,
  conflicts,
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "glass-hierarchy-child rounded-lg p-4 border transition-all",
        isActive ? 'border-primary bg-primary/5' : 'border-border/50',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isActive ? 'bg-primary/20 text-primary' : 'bg-muted'
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <AtomicStatus
          status={isActive ? 'active' : 'inactive'}
          size="md"
          pulse={isActive}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <AtomicMetric
          label="Effectiveness"
          value={effectiveness}
          unit="%"
          status={effectiveness >= 75 ? 'success' : effectiveness >= 50 ? 'warning' : 'error'}
        />
        <AtomicMetric
          label="Cost"
          value={cost}
          unit="₡/mo"
          status="neutral"
        />
      </div>

      {(synergies && synergies.length > 0) || (conflicts && conflicts.length > 0) ? (
        <div className="space-y-2 mb-3">
          {synergies && synergies.length > 0 && (
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">
                Synergies: {synergies.join(', ')}
              </span>
            </div>
          )}
          {conflicts && conflicts.length > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">
                Conflicts: {conflicts.join(', ')}
              </span>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex gap-2">
        {onToggle && (
          <button
            onClick={onToggle}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              isActive
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                : 'bg-primary/20 text-primary hover:bg-primary/30'
            )}
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
        )}
        {onConfigure && (
          <button
            onClick={onConfigure}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
          >
            Configure
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// ATOMIC SYNERGY INDICATOR
// ============================================

interface AtomicSynergyProps {
  components: string[];
  synergyLevel: 'high' | 'medium' | 'low' | 'conflict';
  description?: string;
  className?: string;
}

export const AtomicSynergy: React.FC<AtomicSynergyProps> = ({
  components,
  synergyLevel,
  description,
  className
}) => {
  const levelConfig = {
    high: { color: 'text-green-500', bg: 'bg-green-500/20', label: 'High Synergy' },
    medium: { color: 'text-blue-500', bg: 'bg-blue-500/20', label: 'Medium Synergy' },
    low: { color: 'text-yellow-500', bg: 'bg-yellow-500/20', label: 'Low Synergy' },
    conflict: { color: 'text-red-500', bg: 'bg-red-500/20', label: 'Conflict' }
  };

  const config = levelConfig[synergyLevel];

  return (
    <div className={cn(
      "glass-hierarchy-interactive rounded-lg p-3",
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-sm font-medium", config.color)}>
          {config.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {components.map((component, index) => (
          <React.Fragment key={component}>
            <span className={cn(
              "px-2 py-1 rounded-md text-xs",
              config.bg,
              config.color
            )}>
              {component}
            </span>
            {index < components.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
            )}
          </React.Fragment>
        ))}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

export default {
  AtomicMetric,
  AtomicProgress,
  AtomicGauge,
  AtomicStatus,
  AtomicEffectiveness,
  AtomicComponentCard,
  AtomicSynergy
};