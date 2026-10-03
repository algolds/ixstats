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
import { cn } from "~/lib/utils/cn";
import { GlassChart, chartTheme } from "./GlassChart";
import type { ChartTooltipProps, ChartPayloadEntry } from "~/types/charts";

interface BaseChartProps<T = Record<string, unknown>> {
  data: T[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  loading?: boolean;
  error?: string;
  theme?: "default" | "gold" | "blue" | "emerald" | "purple" | "cyan" | "red";
  hideLegend?: boolean;
  hideGrid?: boolean;
  hideXAxis?: boolean;
  hideYAxis?: boolean;
}

interface BarChartProps<T = Record<string, unknown>> extends BaseChartProps<T> {
  xKey: string;
  yKey: string | string[];
  colors?: string[];
  stacked?: boolean;
  valueFormatter?: (value: number) => string;
}

interface LineChartProps<T = Record<string, unknown>> extends BaseChartProps<T> {
  xKey: string;
  yKey: string | string[];
  colors?: string[];
  curved?: boolean;
  area?: boolean;
}

interface PieChartProps<T = Record<string, unknown>> extends BaseChartProps<T> {
  dataKey: string;
  nameKey: string;
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
}

// Custom Glass Tooltip Component
function GlassTooltip({ active, payload, label, labelFormatter, formatter }: ChartTooltipProps) {
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
      {label !== undefined && label !== null && (
        <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
          {labelFormatter ? labelFormatter(label, payload) : String(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: ChartPayloadEntry, index: number) => (
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

type ChartTheme = NonNullable<BaseChartProps["theme"]>;

/** Per theme: bar gradient stops, line/area stroke and pie slice palette. */
const THEME_COLORS: Record<ChartTheme, { bar: [string, string]; stroke: string; pie: string[] }> = {
  default: {
    bar: ["#94A3B8", "#475569"],
    stroke: "#94A3B8",
    pie: ["#94A3B8", "#475569", "#64748B", "#334155"],
  },
  blue: {
    bar: ["#60A5FA", "#2563EB"],
    stroke: "#3B82F6",
    pie: ["#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"],
  },
  purple: {
    bar: ["#C084FC", "#7C3AED"],
    stroke: "#A855F7",
    pie: ["#C084FC", "#9333EA", "#7C3AED", "#581C87"],
  },
  emerald: {
    bar: ["#34D399", "#059669"],
    stroke: "#10B981",
    pie: ["#34D399", "#10B981", "#059669", "#064E3B"],
  },
  gold: {
    bar: ["#FBBF24", "#D97706"],
    stroke: "#F59E0B",
    pie: ["#FBBF24", "#F59E0B", "#D97706", "#78350F"],
  },
  cyan: {
    bar: ["#22D3EE", "#0891B2"],
    stroke: "#06B6D4",
    pie: ["#22D3EE", "#06B6D4", "#0891B2", "#164E63"],
  },
  red: {
    bar: ["#F87171", "#DC2626"],
    stroke: "#EF4444",
    pie: ["#F87171", "#EF4444", "#DC2626", "#7F1D1D"],
  },
};

const AXIS_STYLE = {
  tick: { fill: chartTheme.text.secondary, fontSize: 10 },
  axisLine: { stroke: chartTheme.grid.stroke },
  tickLine: { stroke: chartTheme.grid.stroke },
};

/** Glass card + responsive container shared by every chart type. */
function ChartFrame({
  children,
  ...frame
}: Pick<
  BaseChartProps,
  "title" | "description" | "height" | "className" | "loading" | "error" | "theme"
> & {
  children: React.ReactElement;
}) {
  return (
    <GlassChart {...frame}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </GlassChart>
  );
}

/** Grid, axes, tooltip and legend of the cartesian charts. */
function cartesianParts(
  props: Pick<BaseChartProps, "hideGrid" | "hideLegend" | "hideXAxis" | "hideYAxis"> & {
    xKey: string;
    tooltip?: React.ReactElement;
    yTickFormatter?: (value: number | string | unknown) => string;
  }
) {
  return [
    !props.hideGrid && (
      <CartesianGrid
        key="grid"
        strokeDasharray="3 3"
        stroke={chartTheme.grid.stroke}
        opacity={chartTheme.grid.opacity}
      />
    ),
    <XAxis key="x" dataKey={props.xKey} {...AXIS_STYLE} hide={props.hideXAxis} />,
    <YAxis key="y" {...AXIS_STYLE} tickFormatter={props.yTickFormatter} hide={props.hideYAxis} />,
    <Tooltip key="tooltip" content={props.tooltip ?? <GlassTooltip />} />,
    !props.hideLegend && (
      <Legend key="legend" wrapperStyle={{ color: chartTheme.text.secondary }} />
    ),
  ];
}

const chartMargin = (hideXAxis: boolean, hideYAxis: boolean) => ({
  top: hideXAxis ? 10 : 20,
  right: 10,
  left: hideYAxis ? 10 : 20,
  bottom: 5,
});

const compactAxisValue = (value: number) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
};

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
  const formatYAxis = (value: number | string | unknown): string =>
    typeof value === "number" ? (valueFormatter ?? compactAxisValue)(value) : String(value ?? "");

  const gradientId = useMemo(() => `bar-grad-${theme}-${crypto.randomUUID()}`, [theme]);
  const [gradientTop, gradientBottom] = (THEME_COLORS[theme] ?? THEME_COLORS.default).bar;
  const fillAt = (index: number) =>
    colors ? colors[index % colors.length] : `url(#${gradientId})`;

  const keys = Array.isArray(yKey) ? yKey : [yKey];

  return (
    <ChartFrame
      title={title}
      description={description}
      height={height}
      className={className}
      loading={loading}
      error={error}
      theme={theme}
    >
      <BarChart data={data} margin={chartMargin(hideXAxis, hideYAxis)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientTop} stopOpacity={1} />
            <stop offset="100%" stopColor={gradientBottom} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        {cartesianParts({
          xKey,
          hideGrid,
          hideLegend,
          hideXAxis,
          hideYAxis,
          yTickFormatter: formatYAxis,
          tooltip: (
            <GlassTooltip
              formatter={valueFormatter ? (value: number) => valueFormatter(value) : undefined}
            />
          ),
        })}
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={fillAt(Array.isArray(yKey) ? index : 0)}
            stackId={stacked && Array.isArray(yKey) ? "stack" : undefined}
            radius={[4, 4, 0, 0]}
          >
            {/* Stacked bars take the series colour; otherwise each bar cycles the palette */}
            {!(stacked && Array.isArray(yKey)) &&
              data.map((_entry, cellIndex) => (
                <Cell
                  key={`cell-${key}-${cellIndex}`}
                  fill={fillAt(Array.isArray(yKey) ? index : cellIndex)}
                />
              ))}
          </Bar>
        ))}
      </BarChart>
    </ChartFrame>
  );
}

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
  const gradientId = useMemo(() => `area-grad-${theme}-${crypto.randomUUID()}`, [theme]);
  const strokeColor = (THEME_COLORS[theme] ?? THEME_COLORS.default).stroke;
  const ChartComponent = area ? AreaChart : LineChart;
  const type = curved ? "monotone" : "linear";

  return (
    <ChartFrame
      title={title}
      description={description}
      height={height}
      className={className}
      loading={loading}
      error={error}
      theme={theme}
    >
      <ChartComponent data={data} margin={chartMargin(hideXAxis, hideYAxis)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        {cartesianParts({ xKey, hideGrid, hideLegend, hideXAxis, hideYAxis })}
        {(Array.isArray(yKey) ? yKey : [yKey]).map((key, index) => {
          const color = colors
            ? colors[Array.isArray(yKey) ? index % colors.length : 0]
            : strokeColor;
          return area ? (
            <Area
              key={key}
              type={type}
              dataKey={key}
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
            />
          ) : (
            <Line
              key={key}
              type={type}
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: color }}
            />
          );
        })}
      </ChartComponent>
    </ChartFrame>
  );
}

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
  const chartColors = colors ?? (THEME_COLORS[theme] ?? THEME_COLORS.default).pie;

  return (
    <ChartFrame
      title={title}
      description={description}
      height={height}
      className={className}
      loading={loading}
      error={error}
      theme={theme}
    >
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip content={<GlassTooltip />} />
        {!hideLegend && <Legend wrapperStyle={{ color: chartTheme.text.secondary }} />}
      </PieChart>
    </ChartFrame>
  );
}
