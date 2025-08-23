"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useSectionTheme, getGlassClasses } from './theme-utils';
import { useFormattedAnimatedValue, MOTION_VARIANTS } from './animation-utils';
import type { MetricCardProps } from './types';

export function MetricCard({
  label,
  value,
  unit,
  description,
  icon: Icon,
  sectionId,
  theme,
  trend,
  change,
  changeUnit,
  className
}: MetricCardProps) {
  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId, theme);
  
  const numericValue = typeof value === 'number' ? value : 0;
  const isNumeric = typeof value === 'number';
  const safeValue = value ?? 0;
  
  // Animated value for smooth number transitions
  const animatedValue = useFormattedAnimatedValue(
    numericValue,
    isNumeric ? undefined : () => safeValue.toString()
  );

  // Get trend icon and color
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <motion.div
      {...MOTION_VARIANTS.scaleIn}
      className={cn(
        'p-4 rounded-lg transition-all duration-200 hover:shadow-lg',
        getGlassClasses('base', resolvedTheme, sectionId),
        className
      )}
      style={cssVars as React.CSSProperties}
    >
      {/* Header with Icon and Label */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="flex-shrink-0 p-2 rounded-lg"
              style={{ backgroundColor: colors.background }}
            >
              <Icon 
                className="h-5 w-5" 
                style={{ color: colors.primary }}
              />
            </motion.div>
          )}
          
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {label}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Trend Indicator */}
        {trend && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex-shrink-0"
          >
            {getTrendIcon()}
          </motion.div>
        )}
      </div>

      {/* Main Value */}
      <div className="mb-2">
        <div className="flex items-baseline gap-1 flex-wrap">
          <motion.span 
            className="text-2xl font-bold font-mono text-foreground"
            style={{ color: colors.primary }}
          >
            {isNumeric ? animatedValue : safeValue}
          </motion.span>
          
          {unit && (
            <span className="text-sm text-muted-foreground font-medium">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Change Indicator */}
      {change !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-1 text-sm"
        >
          <span className={cn('font-semibold', getTrendColor())}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}
            {changeUnit}
          </span>
          <span className="text-muted-foreground">
            from previous
          </span>
        </motion.div>
      )}

      {/* Animated Background Glow on Hover */}
      <motion.div
        className="absolute inset-0 rounded-lg opacity-0 pointer-events-none"
        whileHover={{ opacity: 0.1 }}
        style={{ backgroundColor: colors.primary }}
        transition={{ duration: 0.2 }}
      />
    </motion.div>
  );
}