"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useSectionTheme, getGlassClasses } from './theme-utils';
import { useAnimatedValue, DEFAULT_ANIMATIONS } from './animation-utils';
import type { EnhancedInputProps } from './types';

interface GlassProgressIndicatorProps extends Omit<EnhancedInputProps, 'value' | 'onChange'> {
  value: number;
  max?: number;
  variant?: 'linear' | 'circular' | 'ring';
  showPercentage?: boolean;
  showValue?: boolean;
  height?: number;
  thickness?: number;
  icon?: React.ComponentType<any>;
  color?: string;
  backgroundColor?: string;
}

export function GlassProgressIndicator({
  value,
  max = 100,
  min = 0,
  label,
  description,
  unit = '%',
  sectionId,
  theme,
  size = 'md',
  variant = 'linear',
  showPercentage = true,
  showValue = false,
  height,
  thickness,
  icon: Icon,
  color,
  backgroundColor,
  animationDuration = 800,
  className
}: GlassProgressIndicatorProps) {
  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);
  
  // Calculate percentage (0-100)
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  // Animated percentage for smooth transitions
  const animatedValue = useAnimatedValue(
    percentage,
    { ...DEFAULT_ANIMATIONS.spring, duration: animationDuration }
  );

  const sizeConfigs = {
    sm: { linear: 6, circular: 60, thickness: 4 },
    md: { linear: 8, circular: 80, thickness: 6 },
    lg: { linear: 12, circular: 100, thickness: 8 }
  };

  const config = sizeConfigs[size];
  const progressHeight = height || config.linear;
  const progressThickness = thickness || config.thickness;

  if (variant === 'circular' || variant === 'ring') {
    const radius = config.circular / 2 - progressThickness;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div 
        className={cn('flex flex-col items-center space-y-3', className)}
        style={cssVars as React.CSSProperties}
      >
        {/* Label */}
        {label && (
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--primitive-text)]">
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </label>
        )}

        {/* Circular Progress */}
        <div className="relative">
          <svg
            width={config.circular}
            height={config.circular}
            className="transform -rotate-90"
          >
            {/* Background Circle */}
            <circle
              cx={config.circular / 2}
              cy={config.circular / 2}
              r={radius}
              stroke={backgroundColor || 'var(--primitive-border)'}
              strokeWidth={progressThickness}
              fill="none"
              className="opacity-20"
            />
            
            {/* Progress Circle */}
            <motion.circle
              cx={config.circular / 2}
              cy={config.circular / 2}
              r={radius}
              stroke={color || colors.primary}
              strokeWidth={progressThickness}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{
                duration: animationDuration / 1000,
                ease: "easeOut"
              }}
              className="drop-shadow-sm"
              style={{
                filter: `drop-shadow(0 0 8px ${color || colors.primary}40)`
              }}
            />
          </svg>

          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {showPercentage && (
              <motion.span 
                className="text-lg font-bold text-[var(--primitive-text)]"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.3 }}
              >
                {Math.round(percentage)}%
              </motion.span>
            )}
            {showValue && (
              <span className="text-sm text-[var(--primitive-muted)]">
                {value}{unit}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-[var(--primitive-muted)] text-center">{description}</p>
        )}
      </div>
    );
  }

  // Linear Progress
  return (
    <div 
      className={cn('space-y-2', className)}
      style={cssVars as React.CSSProperties}
    >
      {/* Header */}
      {(label || showPercentage || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--primitive-text)]">
              {Icon && <Icon className="h-4 w-4" />}
              {label}
            </label>
          )}
          
          {(showPercentage || showValue) && (
            <div className="flex items-center gap-2 text-sm">
              {showPercentage && (
                <motion.span className="font-mono text-[var(--primitive-text)]">
                  {Math.round(percentage)}%
                </motion.span>
              )}
              {showValue && (
                <span className="text-[var(--primitive-muted)]">
                  {value}{unit}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className={cn(
        'relative rounded-full overflow-hidden',
        getGlassClasses('base', resolvedTheme, sectionId),
        'bg-gray-100/80 dark:bg-gray-800/80',
        'border border-gray-200/40 dark:border-gray-700/40'
      )} style={{ height: progressHeight }}>
        
        {/* Background Track */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: backgroundColor || 'transparent'
          }}
        />

        {/* Progress Fill */}
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            background: color || `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
            boxShadow: `0 0 12px ${color || colors.primary}40`
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: animationDuration / 1000,
            ease: "easeOut"
          }}
        />

        {/* Shine Effect */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
          }}
          animate={{
            x: ['-100%', '100%']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-[var(--primitive-muted)]">{description}</p>
      )}
    </div>
  );
}