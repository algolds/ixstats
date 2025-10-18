"use client";

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { GlassChart, chartTheme } from './GlassChart';
import { getChartColor, generateChartColors } from '~/lib/builder-theme-utils';

interface BaseChartProps {
  data: any[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  loading?: boolean;
  error?: string;
  theme?: 'default' | 'gold' | 'blue' | 'emerald' | 'purple';
}

interface BarChartProps extends BaseChartProps {
  xKey: string;
  yKey: string | string[];
  colors?: string[];
  stacked?: boolean;
  valueFormatter?: (value: number) => string;
}

interface LineChartProps extends BaseChartProps {
  xKey: string;
  yKey: string | string[];
  colors?: string[];
  curved?: boolean;
  area?: boolean;
}

interface PieChartProps extends BaseChartProps {
  dataKey: string;
  nameKey: string;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
}

// Custom Glass Tooltip Component
function GlassTooltip({ active, payload, label, labelFormatter, formatter }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'backdrop-blur-md bg-[var(--color-bg-secondary)]/90',
        'border border-[var(--color-border-primary)]/50',
        'rounded-lg p-3 shadow-lg'
      )}
    >
      {label && (
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[var(--color-text-secondary)]">
              {entry.name}:
            </span>
            <span className="text-[var(--color-text-primary)] font-medium">
              {formatter ? formatter(entry.value, entry.name, entry, index, payload) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Glass Bar Chart
export function GlassBarChart({
  data,
  xKey,
  yKey,
  colors,
  stacked = false,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = 'default',
  valueFormatter
}: BarChartProps) {
  const chartColors = useMemo(() => {
    if (colors) return colors;
    const keys = Array.isArray(yKey) ? yKey : [yKey];
    return generateChartColors(keys.length, 'primary');
  }, [colors, yKey]);

  const formatYAxis = (value: any) => {
    if (typeof value === 'number') {
      if (valueFormatter) return valueFormatter(value);
      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value.toFixed(0);
    }
    return value;
  };

  return (
    <GlassChart
      title={title}
      description={description}
      height={height}
      className={className}
      loading={loading}
      error={error}
      theme={theme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={chartTheme.grid.stroke}
            opacity={chartTheme.grid.opacity}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fill: chartTheme.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
          />
          <YAxis
            tick={{ fill: chartTheme.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
            tickFormatter={formatYAxis}
          />
          <Tooltip content={<GlassTooltip formatter={valueFormatter ? (value: number) => valueFormatter(value) : undefined} />} />
          <Legend
            wrapperStyle={{ color: chartTheme.text.secondary }}
          />
          {Array.isArray(yKey) ? (
            yKey.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={chartColors[index % chartColors.length]}
                stackId={stacked ? 'stack' : undefined}
                radius={[2, 2, 0, 0]}
              >
                {/* Individual cell colors for non-stacked multi-key charts */}
                {!stacked && data.map((entry, cellIndex) => (
                  <Cell 
                    key={`cell-${key}-${cellIndex}`} 
                    fill={chartColors[index % chartColors.length]} 
                  />
                ))}
              </Bar>
            ))
          ) : (
            <Bar
              dataKey={yKey}
              fill={chartColors[0]}
              radius={[4, 4, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </GlassChart>
  );
}

// Glass Line Chart
export function GlassLineChart({
  data,
  xKey,
  yKey,
  colors,
  curved = true,
  area = false,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = 'default'
}: LineChartProps) {
  const chartColors = useMemo(() => {
    if (colors) return colors;
    const keys = Array.isArray(yKey) ? yKey : [yKey];
    return generateChartColors(keys.length, 'primary');
  }, [colors, yKey]);

  const ChartComponent = area ? AreaChart : LineChart;

  return (
    <GlassChart
      title={title}
      description={description}
      height={height}
      className={className}
      loading={loading}
      error={error}
      theme={theme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={chartTheme.grid.stroke}
            opacity={chartTheme.grid.opacity}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fill: chartTheme.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
          />
          <YAxis
            tick={{ fill: chartTheme.text.secondary, fontSize: 12 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
          />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ color: chartTheme.text.secondary }} />
          {Array.isArray(yKey) ? (
            yKey.map((key, index) => {
              const color = chartColors[index % chartColors.length];
              return area ? (
                <Area
                  key={key}
                  type={curved ? "monotone" : "linear"}
                  dataKey={key}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ) : (
                <Line
                  key={key}
                  type={curved ? "monotone" : "linear"}
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: color }}
                />
              );
            })
          ) : (
            area ? (
              <Area
                type={curved ? "monotone" : "linear"}
                dataKey={yKey}
                stroke={chartColors[0]}
                fill={chartColors[0]}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ) : (
              <Line
                type={curved ? "monotone" : "linear"}
                dataKey={yKey}
                stroke={chartColors[0]}
                strokeWidth={2}
                dot={{ fill: chartColors[0], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: chartColors[0] }}
              />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </GlassChart>
  );
}

// Glass Pie Chart
export function GlassPieChart({
  data,
  dataKey,
  nameKey,
  colors,
  innerRadius = 0,
  outerRadius = 80,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = 'default'
}: PieChartProps) {
  const chartColors = useMemo(() => {
    if (colors) return colors;
    return generateChartColors(data.length, 'primary');
  }, [colors, data.length]);

  return (
    <GlassChart
      title={title}
      description={description}
      height={height}
      className={className}
      loading={loading}
      error={error}
      theme={theme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={chartColors[index % chartColors.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ color: chartTheme.text.secondary }} />
        </PieChart>
      </ResponsiveContainer>
    </GlassChart>
  );
}