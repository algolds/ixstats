"use client";

import React, { useMemo } from "react";
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
} from "recharts";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { GlassChart, chartTheme } from "./GlassChart";
import { generateChartColors } from "~/lib/builder";

interface BaseChartProps {
  data: any[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  loading?: boolean;
  error?: string;
  theme?: "default" | "gold" | "blue" | "emerald" | "purple";
  hideLegend?: boolean;
  hideGrid?: boolean;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
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
        "bg-[var(--color-bg-secondary)]/90 backdrop-blur-md",
        "border border-[var(--color-border-primary)]/50",
        "rounded-lg p-3 shadow-lg"
      )}
    >
      {label && (
        <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-[var(--color-text-secondary)]">{entry.name}:</span>
            <span className="font-medium text-[var(--color-text-primary)]">
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
  theme = "default",
  valueFormatter,
  hideLegend = false,
  hideGrid = false,
  hideXAxis = false,
  hideYAxis = false,
}: BarChartProps) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const chartColors = useMemo(() => {
    if (colors) return colors;
    const keys = Array.isArray(yKey) ? yKey : [yKey];
    return generateChartColors(keys.length, "primary");
  }, [colors, yKey]);

  const formatYAxis = (value: any) => {
    if (typeof value === "number") {
      if (valueFormatter) return valueFormatter(value);
      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value.toFixed(0);
    }
    return value;
  };

  const gradientId = useMemo(
    // oxlint-disable-next-line
    () => `bar-grad-${theme}-${Math.random().toString(36).substr(2, 9)}`,
    [theme]
  );

  // Map theme to premium gradient stop colors
  const themeColors = {
    default: ["#94A3B8", "#475569"],
    blue: ["#60A5FA", "#2563EB"],
    purple: ["#C084FC", "#7C3AED"],
    emerald: ["#34D399", "#059669"],
    gold: ["#FBBF24", "#D97706"],
  }[theme] || ["#94A3B8", "#475569"];

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
        <BarChart
          data={data}
          margin={{ top: hideXAxis ? 10 : 20, right: 10, left: hideYAxis ? 10 : 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColors[0]} stopOpacity={1} />
              <stop offset="100%" stopColor={themeColors[1]} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          {!hideGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
              opacity={chartTheme.grid.opacity}
            />
          )}
          <XAxis
            dataKey={xKey}
            tick={{ fill: chartTheme.text.secondary, fontSize: 10 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
            hide={hideXAxis}
          />
          <YAxis
            tick={{ fill: chartTheme.text.secondary, fontSize: 10 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
            tickFormatter={formatYAxis}
            hide={hideYAxis}
          />
          <Tooltip
            content={
              <GlassTooltip
                formatter={valueFormatter ? (value: number) => valueFormatter(value) : undefined}
              />
            }
          />
          {!hideLegend && <Legend wrapperStyle={{ color: chartTheme.text.secondary }} />}
          {Array.isArray(yKey) ? (
            yKey.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors ? colors[index % colors.length] : `url(#${gradientId})`}
                stackId={stacked ? "stack" : undefined}
                radius={[4, 4, 0, 0]}
              >
                {!stacked &&
                  data.map((entry, cellIndex) => (
                    <Cell
                      key={`cell-${key}-${cellIndex}`}
                      fill={colors ? colors[index % colors.length] : `url(#${gradientId})`}
                    />
                  ))}
              </Bar>
            ))
          ) : (
            <Bar
              dataKey={yKey}
              fill={colors ? colors[0] : `url(#${gradientId})`}
              radius={[4, 4, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors ? colors[index % colors.length] : `url(#${gradientId})`}
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
  theme = "default",
  hideLegend = false,
  hideGrid = false,
  hideXAxis = false,
  hideYAxis = false,
}: LineChartProps) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const chartColors = useMemo(() => {
    if (colors) return colors;
    const keys = Array.isArray(yKey) ? yKey : [yKey];
    return generateChartColors(keys.length, "primary");
  }, [colors, yKey]);

  const ChartComponent = area ? AreaChart : LineChart;
  const gradientId = useMemo(
    // oxlint-disable-next-line
    () => `area-grad-${theme}-${Math.random().toString(36).substr(2, 9)}`,
    [theme]
  );

  // Stroke color for the line based on the theme
  const themeStrokeColor =
    {
      default: "#94A3B8",
      blue: "#3B82F6",
      purple: "#A855F7",
      emerald: "#10B981",
      gold: "#F59E0B",
    }[theme] || "#94A3B8";

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
        <ChartComponent
          data={data}
          margin={{ top: hideXAxis ? 10 : 20, right: 10, left: hideYAxis ? 10 : 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={themeStrokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={themeStrokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          {!hideGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.grid.stroke}
              opacity={chartTheme.grid.opacity}
            />
          )}
          <XAxis
            dataKey={xKey}
            tick={{ fill: chartTheme.text.secondary, fontSize: 10 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
            hide={hideXAxis}
          />
          <YAxis
            tick={{ fill: chartTheme.text.secondary, fontSize: 10 }}
            axisLine={{ stroke: chartTheme.grid.stroke }}
            tickLine={{ stroke: chartTheme.grid.stroke }}
            hide={hideYAxis}
          />
          <Tooltip content={<GlassTooltip />} />
          {!hideLegend && <Legend wrapperStyle={{ color: chartTheme.text.secondary }} />}
          {Array.isArray(yKey) ? (
            yKey.map((key, index) => {
              const color = colors ? colors[index % colors.length] : themeStrokeColor;
              return area ? (
                <Area
                  key={key}
                  type={curved ? "monotone" : "linear"}
                  dataKey={key}
                  stroke={color}
                  fill={`url(#${gradientId})`}
                  strokeWidth={2}
                />
              ) : (
                <Line
                  key={key}
                  type={curved ? "monotone" : "linear"}
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, fill: color }}
                />
              );
            })
          ) : area ? (
            <Area
              type={curved ? "monotone" : "linear"}
              dataKey={yKey}
              stroke={colors ? colors[0] : themeStrokeColor}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
            />
          ) : (
            <Line
              type={curved ? "monotone" : "linear"}
              dataKey={yKey}
              stroke={colors ? colors[0] : themeStrokeColor}
              strokeWidth={2}
              dot={{ fill: colors ? colors[0] : themeStrokeColor, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: colors ? colors[0] : themeStrokeColor }}
            />
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
  theme = "default",
  hideLegend = false,
}: PieChartProps) {
  const chartColors = useMemo(() => {
    if (colors) return colors;
    // Map theme to custom pie palettes for extra premium feel
    const palettes = {
      default: ["#94A3B8", "#475569", "#64748B", "#334155"],
      blue: ["#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"],
      purple: ["#C084FC", "#9333EA", "#7C3AED", "#581C87"],
      emerald: ["#34D399", "#10B981", "#059669", "#064E3B"],
      gold: ["#FBBF24", "#F59E0B", "#D97706", "#78350F"],
    };
    const palette = palettes[theme] || palettes.default;
    return palette;
  }, [colors, theme]);

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
            paddingAngle={3} // Added slice spacing!
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip />} />
          {!hideLegend && <Legend wrapperStyle={{ color: chartTheme.text.secondary }} />}
        </PieChart>
      </ResponsiveContainer>
    </GlassChart>
  );
}
