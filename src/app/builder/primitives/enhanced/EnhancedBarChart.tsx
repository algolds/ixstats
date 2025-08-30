"use client";

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { useSectionTheme, generateSectionChartColors, getGlassClasses } from './theme-utils';
import { MOTION_VARIANTS } from './animation-utils';
import type { EnhancedChartProps } from './types';

interface EnhancedBarChartProps extends EnhancedChartProps {
  xKey: string;
  yKey: string | string[];
  colors?: string[];
  stacked?: boolean;
  horizontal?: boolean;
  showValues?: boolean;
  formatValue?: (value: number) => string;
  formatLabel?: (label: string) => string;
  maxBars?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  formatValue?: (value: number) => string;
  colors: string[];
}

// Custom label renderer for bar values
function renderCustomLabel(entry: any, formatValue?: (value: number) => string) {
  if (!entry || entry.value === undefined || entry.value === null) return null;
  
  return (
    <text
      x={entry.x + entry.width / 2}
      y={entry.y - 5}
      fill="currentColor"
      textAnchor="middle"
      dominantBaseline="bottom"
      fontSize="11"
      fontWeight="500"
      className="fill-gray-700 dark:fill-gray-300"
    >
      {formatValue ? formatValue(entry.value) : entry.value}
    </text>
  );
}

function ChartTooltip({ active, payload, label, formatValue, colors }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

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
      {label && (
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color || colors[index] }}
            />
            <span className="text-gray-900 dark:text-gray-100">
              {entry.name}: 
              <span className="font-mono ml-1">
                {formatValue ? formatValue(entry.value) : entry.value}
              </span>
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function EnhancedBarChart({
  data,
  title,
  description,
  height = 300,
  width,
  sectionId,
  theme,
  loading = false,
  error,
  showLegend = false,
  showTooltip = true,
  showGrid = true,
  animationDuration = 800,
  className,
  xKey,
  yKey,
  colors,
  stacked = false,
  horizontal = false,
  showValues = false,
  formatValue,
  formatLabel,
  maxBars = 20
}: EnhancedBarChartProps) {
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
    
    const yKeys = Array.isArray(yKey) ? yKey : [yKey];
    const generatedColors = generateSectionChartColors(sectionId, resolvedTheme, Math.max(yKeys.length, data.length));
    
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
  }, [colors, yKey, sectionId, resolvedTheme, data.length]);

  // Process and limit data if needed
  const processedData = useMemo(() => {
    if (data.length <= maxBars) return data;
    
    // If too many bars, take top N by value
    const sorted = [...data].sort((a, b) => {
      const aValue = Array.isArray(yKey) ? yKey.reduce((sum, key) => sum + (a[key] || 0), 0) : (a[yKey] || 0);
      const bValue = Array.isArray(yKey) ? yKey.reduce((sum, key) => sum + (b[key] || 0), 0) : (b[yKey] || 0);
      return bValue - aValue;
    });
    
    return sorted.slice(0, maxBars);
  }, [data, maxBars, yKey]);

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
            className="w-8 h-8 border-3 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full"
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
      <div 
        className={cn(
          'p-4 rounded-lg',
          getGlassClasses('base', resolvedTheme, sectionId)
        )}
        style={{ 
          height: `${!isNaN(height) ? height + 32 : 300}px`, 
          width: (width && !isNaN(width)) ? `${width}px` : undefined 
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={processedData}
            layout={horizontal ? 'horizontal' : 'vertical'}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            {showGrid && (
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="currentColor"
                className="stroke-gray-300 dark:stroke-gray-600"
                opacity={0.3}
              />
            )}
            
            <XAxis
              dataKey={horizontal ? undefined : xKey}
              type={horizontal ? 'number' : 'category'}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="fill-gray-700 dark:fill-gray-300"
              axisLine={{ stroke: 'currentColor' }}
              tickLine={{ stroke: 'currentColor' }}
              tickFormatter={horizontal ? formatValue : formatLabel}
            />
            
            <YAxis
              dataKey={horizontal ? xKey : undefined}
              type={horizontal ? 'category' : 'number'}
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="fill-gray-700 dark:fill-gray-300"
              axisLine={{ stroke: 'currentColor' }}
              tickLine={{ stroke: 'currentColor' }}
              tickFormatter={horizontal ? formatLabel : formatValue}
              domain={horizontal ? undefined : ['dataMin * 0.95', 'dataMax * 1.05']}
              allowDataOverflow={false}
            />

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

            {/* Render bars */}
            {Array.isArray(yKey) ? (
              yKey.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={chartColors[index]}
                  stroke={chartColors[index]}
                  strokeWidth={1}
                  stackId={stacked ? 'stack' : undefined}
                  animationDuration={animationDuration}
                  minPointSize={10}
                  radius={[2, 2, 0, 0]}
                >
                  {/* Individual cell colors if needed */}
                  {!stacked && processedData.map((entry, cellIndex) => (
                    <Cell 
                      key={`cell-${cellIndex}`} 
                      fill={chartColors[cellIndex % chartColors.length]} 
                    />
                  ))}
                  {/* Add data labels if showValues is true */}
                  {showValues && (
                    <LabelList
                      dataKey={key}
                      position="top"
                      fontSize={11}
                      fontWeight="500"
                      className="fill-gray-700 dark:fill-gray-300"
                      formatter={formatValue ? (value: any) => formatValue(Number(value)) : undefined}
                    />
                  )}
                </Bar>
              ))
            ) : (
              <Bar
                dataKey={yKey}
                fill={chartColors[0]}
                stroke={chartColors[0]}
                strokeWidth={1}
                animationDuration={animationDuration}
                minPointSize={10}
                radius={[2, 2, 0, 0]}
              >
                {/* Individual cell colors */}
                {processedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={chartColors[index % chartColors.length]} 
                  />
                ))}
                {/* Add data labels if showValues is true */}
                {showValues && (
                  <LabelList
                    dataKey={yKey}
                    position="top"
                    fontSize={11}
                    fontWeight="500"
                    className="fill-gray-700 dark:fill-gray-300"
                    formatter={formatValue ? (value: any) => formatValue(Number(value)) : undefined}
                  />
                )}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data truncation notice */}
      {data.length > maxBars && (
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          Showing top {maxBars} of {data.length} items
        </p>
      )}
    </motion.div>
  );
}