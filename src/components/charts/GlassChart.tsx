"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { chartColorPalette, getChartColor } from '~/lib/builder-theme-utils';

interface GlassChartProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  depth?: 'base' | 'elevated' | 'modal';
  blur?: 'light' | 'medium' | 'heavy';
  height?: number | string;
  loading?: boolean;
  error?: string;
  actions?: React.ReactNode;
  theme?: 'default' | 'gold' | 'blue' | 'emerald' | 'purple';
}

interface ChartSkeletonProps {
  height?: number | string;
  type?: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
}

function ChartSkeleton({ height = 300, type = 'bar' }: ChartSkeletonProps) {
  const elements = useMemo((): React.ReactElement | React.ReactElement[] => {
    switch (type) {
      case 'bar':
        return Array.from({ length: 6 }, (_, i) => (
          <motion.div
            key={i}
            className="bg-[var(--color-bg-secondary)]/30 rounded-sm"
            style={{
              height: `${Math.random() * 60 + 20}%`,
              width: '12%',
              marginLeft: i === 0 ? '0' : '2%',
            }}
            initial={{ height: 0 }}
            animate={{ height: `${Math.random() * 60 + 20}%` }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
          />
        ));
      case 'line':
        return (
          <motion.svg
            className="w-full h-full"
            viewBox="0 0 400 200"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.path
              d="M20,150 Q100,100 200,120 T380,80"
              stroke="hsl(var(--color-brand-primary-hsl))"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              className="opacity-60"
            />
          </motion.svg>
        );
      case 'pie':
        return (
          <motion.div
            className="w-32 h-32 rounded-full mx-auto"
            style={{
              background: `conic-gradient(
                hsl(var(--color-brand-primary-hsl)) 0deg 120deg,
                hsl(var(--color-success-hsl)) 120deg 200deg,
                hsl(var(--color-warning-hsl)) 200deg 280deg,
                hsl(var(--color-error-hsl)) 280deg 360deg
              )`
            }}
            initial={{ scale: 0, rotate: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        );
      default:
        return [];
    }
  }, [type]);

  return (
    <div
      className="flex items-end justify-center p-6"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {elements}
    </div>
  );
}

export function GlassChart({
  children,
  title,
  description,
  className,
  depth = 'base',
  blur = 'light',
  height = 300,
  loading = false,
  error,
  actions,
  theme = 'default'
}: GlassChartProps) {
  const depthClasses = {
    base: 'bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)]',
    elevated: 'bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border-primary)] shadow-lg',
    modal: 'bg-[var(--color-bg-secondary)]/70 border border-[var(--color-border-secondary)] shadow-2xl'
  };

  const blurClasses = {
    light: 'backdrop-blur-sm',
    medium: 'backdrop-blur-md',
    heavy: 'backdrop-blur-lg'
  };

  const themeClasses = {
    default: '',
    gold: 'border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5',
    blue: 'border-blue-400/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/5',
    emerald: 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5',
    purple: 'border-purple-400/30 bg-gradient-to-br from-purple-500/10 to-pink-500/5'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        'rounded-lg overflow-hidden',
        depthClasses[depth],
        blurClasses[blur],
        themeClasses[theme],
        className
      )}
    >
      {/* Header */}
      {(title || description || actions) && (
        <div className="p-4 border-b border-[var(--color-border-primary)]/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {title && (
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="relative"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-4 text-center">
              <motion.div
                className="w-8 h-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent mx-auto"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-sm text-[var(--color-text-muted)]">Loading chart data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[var(--color-error)]/20 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-error)]">Chart Error</p>
              <p className="text-xs text-[var(--color-text-muted)]">{error}</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Chart theme provider for consistent styling across all chart types
 */
export const chartTheme = {
  colors: chartColorPalette,
  text: {
    primary: 'hsl(var(--color-text-primary-hsl))',
    secondary: 'hsl(var(--color-text-secondary-hsl))',
    muted: 'hsl(var(--color-text-muted-hsl))',
  },
  grid: {
    stroke: 'hsl(var(--color-border-primary-hsl))',
    strokeWidth: 1,
    opacity: 0.3,
  },
  tooltip: {
    background: 'hsl(var(--color-bg-secondary-hsl))',
    border: 'hsl(var(--color-border-primary-hsl))',
    text: 'hsl(var(--color-text-primary-hsl))',
  },
  legend: {
    text: 'hsl(var(--color-text-secondary-hsl))',
    fontSize: 12,
  }
};

export default GlassChart;