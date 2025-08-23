"use client";

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useSectionTheme, generateSectionChartColors, getGlassClasses } from './theme-utils';
import { MOTION_VARIANTS } from './animation-utils';
import type { EnhancedChartProps } from './types';

interface EnhancedPieChartProps extends EnhancedChartProps {
  dataKey: string;
  nameKey: string;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
  showPercentage?: boolean;
  formatValue?: (value: number) => string;
  minSlicePercentage?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  formatValue?: (value: number) => string;
  colors: string[];
}

function ChartTooltip({ active, payload, formatValue, colors }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'backdrop-blur-md bg-white/95 dark:bg-gray-800/95',
        'border border-gray-200/50 dark:border-gray-600/50',
        'rounded-lg p-3 shadow-xl dark:shadow-gray-900/50'
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: data.payload.fill }}
        />
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {data.name}
        </span>
      </div>
      <div className="text-sm text-gray-900 dark:text-gray-100 mt-1">
        Value: <span className="font-mono">
          {formatValue ? formatValue(data.value) : data.value}
        </span>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400">
        {data.payload.percentage?.toFixed(1)}% of total
      </div>
    </motion.div>
  );
}

export function EnhancedPieChart({
  data,
  title,
  description,
  height = 300,
  width,
  sectionId,
  theme,
  loading = false,
  error,
  showLegend = true,
  showTooltip = true,
  animationDuration = 800,
  className,
  dataKey,
  nameKey,
  colors,
  innerRadius = 0,
  outerRadius,
  showLabels = false,
  showPercentage = true,
  formatValue,
  minSlicePercentage = 2
}: EnhancedPieChartProps) {
  const { theme: resolvedTheme, colors: themeColors, cssVars } = useSectionTheme(sectionId, theme);
  
  // Generate section-appropriate colors
  const chartColors = useMemo(() => {
    if (colors) return colors;
    
    // Check if data has color field and map to theme colors
    const hasDataColors = data.some(item => 'color' in item);
    if (hasDataColors) {
      const colorMap = {
        'emerald': 'hsl(160, 84%, 60%)', // Green for positive
        'red': 'hsl(0, 84%, 60%)', // Red for negative
        'gold': 'hsl(45, 93%, 58%)', // Gold for neutral
        'blue': 'hsl(217, 91%, 60%)', // Blue for info
        'purple': 'hsl(262, 83%, 58%)' // Purple for special
      };
      
      return data.map(item => {
        const colorKey = (item as any).color;
        return colorMap[colorKey as keyof typeof colorMap] || 'hsl(217, 91%, 60%)';
      });
    }
    
    const generatedColors = generateSectionChartColors(sectionId, resolvedTheme, data.length);
    
    // FINAL SAFETY CHECK: Replace any dark/black colors with bright alternatives
    return generatedColors.map((color, index) => {
      // If somehow a dark color gets through, replace with bright fallbacks
      if (color.includes('rgb(0') || color.includes('hsl(0, 0%') || color.includes('#000')) {
        const fallbackColors = [
          'hsl(217, 91%, 60%)', // Blue
          'hsl(160, 84%, 60%)', // Emerald
          'hsl(45, 93%, 58%)',  // Gold
          'hsl(262, 83%, 58%)', // Purple
          'hsl(0, 84%, 60%)'    // Red
        ];
        return fallbackColors[index % fallbackColors.length];
      }
      return color;
    });
  }, [colors, sectionId, resolvedTheme, data.length, themeColors]);

  // Process data to add percentages and handle small slices
  const processedData = useMemo(() => {
    const total = data.reduce((sum, item) => sum + (item[dataKey] || 0), 0);
    
    let processed = data.map((item, index) => {
      const value = item[dataKey] || 0;
      const percentage = total > 0 ? (value / total) * 100 : 0;
      
      return {
        ...item,
        value,
        percentage,
        fill: chartColors[index % chartColors.length]
      };
    });

    // Group small slices into "Others" if specified
    if (minSlicePercentage > 0) {
      const largeSlices = processed.filter(item => item.percentage >= minSlicePercentage);
      const smallSlices = processed.filter(item => item.percentage < minSlicePercentage);
      
      if (smallSlices.length > 1) {
        const othersValue = smallSlices.reduce((sum, item) => sum + item.value, 0);
        const othersPercentage = smallSlices.reduce((sum, item) => sum + item.percentage, 0);
        
        processed = [
          ...largeSlices,
          {
            [nameKey]: 'Others',
            value: othersValue,
            percentage: othersPercentage,
            fill: chartColors[chartColors.length - 1]
          }
        ];
      }
    }

    return processed;
  }, [data, dataKey, nameKey, chartColors, minSlicePercentage]);

  // Calculate chart radius
  const chartRadius = outerRadius || Math.min(height, width || height) / 2 - 40;

  // Custom label rendering
  const renderCustomLabel = (entry: any) => {
    if (!showLabels) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (chartRadius - innerRadius) * 0.5;
    const x = entry.cx + radius * Math.cos(-entry.midAngle * RADIAN);
    const y = entry.cy + radius * Math.sin(-entry.midAngle * RADIAN);

    if (entry.percentage < 5) return null; // Don't show labels for very small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="currentColor"
        textAnchor={x > entry.cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="500"
        className="fill-gray-900 dark:fill-gray-100"
      >
        {showPercentage ? `${entry.percentage.toFixed(1)}%` : entry[nameKey]}
      </text>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <div 
        className={cn('space-y-4', className)}
        style={cssVars as React.CSSProperties}
      >
        {title && (
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
            )}
          </div>
        )}
        
        <div 
          className={cn(
            'flex items-center justify-center rounded-lg',
            getGlassClasses('base', resolvedTheme, sectionId)
          )}
          style={{ height: `${height}px` }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 border-4 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full"
          />
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div 
        className={cn('space-y-4', className)}
        style={cssVars as React.CSSProperties}
      >
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        )}
        
        <div 
          className={cn(
            'flex items-center justify-center rounded-lg p-6 text-center',
            getGlassClasses('base', resolvedTheme, sectionId)
          )}
          style={{ height: `${height}px` }}
        >
          <div className="space-y-2">
            <div className="text-red-500 dark:text-red-400 text-lg">⚠</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      {...MOTION_VARIANTS.fadeIn}
      transition={{ duration: animationDuration / 1000 }}
      className={cn('space-y-4', className)}
      style={cssVars as React.CSSProperties}
    >
      {/* Header */}
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Pie Chart */}
        <div 
          className={cn(
            'flex-shrink-0 p-4 rounded-lg',
            getGlassClasses('base', resolvedTheme, sectionId)
          )}
          style={{ height: `${height + 32}px`, width: width || height + 32 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={chartRadius}
                innerRadius={innerRadius}
                dataKey="value"
                animationBegin={0}
                animationDuration={animationDuration}
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              
              {showTooltip && (
                <Tooltip 
                  content={(props) => (
                    <ChartTooltip 
                      {...props} 
                      formatValue={formatValue}
                      colors={chartColors.filter((color): color is string => color !== undefined)}
                    />
                  )}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex-1 min-w-0">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {processedData.map((entry, index) => (
                <motion.div
                  key={entry[nameKey]}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-center justify-between p-2 rounded transition-colors',
                    'hover:bg-gray-100/50 dark:hover:bg-gray-700/50'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {entry[nameKey]}
                    </span>
                  </div>
                  
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {formatValue ? formatValue(entry.value) : entry.value}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.percentage.toFixed(1)}%
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}