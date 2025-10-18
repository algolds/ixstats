"use client";

// Intelligence Charts - Reusable chart components for intelligence visualization
// Refactored from EnhancedIntelligenceBriefing.tsx

import React from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { CHART_COLORS, CHART_DEFAULTS, commonChartProps } from "./chartConfig";
import type { ChartDataPoint, TimeSeriesDataPoint, MultiSeriesDataPoint } from "./chartConfig";

export interface BaseChartProps {
  title?: string;
  description?: string;
  className?: string;
  height?: number;
  color?: string;
}

export interface LineChartProps extends BaseChartProps {
  data: TimeSeriesDataPoint[];
  dataKey?: string;
  xAxisKey?: string;
  showGrid?: boolean;
}

export const IntelligenceLineChart: React.FC<LineChartProps> = ({
  data,
  title,
  description,
  dataKey = "value",
  xAxisKey = "name",
  showGrid = true,
  height = 300,
  color = CHART_COLORS.primary,
  className
}) => {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart data={data} {...commonChartProps}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_DEFAULTS.gridStroke}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <YAxis
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_DEFAULTS.tooltipBackground,
                border: `1px solid ${CHART_DEFAULTS.tooltipBorder}`,
                borderRadius: '8px'
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={CHART_DEFAULTS.strokeWidth}
              dot={{ r: CHART_DEFAULTS.dotSize, fill: color }}
              activeDot={{ r: 6 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export interface BarChartProps extends BaseChartProps {
  data: ChartDataPoint[];
  dataKey?: string;
  xAxisKey?: string;
  showGrid?: boolean;
  colors?: string[];
}

export const IntelligenceBarChart: React.FC<BarChartProps> = ({
  data,
  title,
  description,
  dataKey = "value",
  xAxisKey = "name",
  showGrid = true,
  height = 300,
  color = CHART_COLORS.primary,
  colors,
  className
}) => {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={data} {...commonChartProps}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_DEFAULTS.gridStroke}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <YAxis
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_DEFAULTS.tooltipBackground,
                border: `1px solid ${CHART_DEFAULTS.tooltipBorder}`,
                borderRadius: '8px'
              }}
            />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
              {colors ? (
                data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))
              ) : (
                <Cell fill={color} />
              )}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export interface AreaChartProps extends BaseChartProps {
  data: TimeSeriesDataPoint[];
  dataKey?: string;
  xAxisKey?: string;
  showGrid?: boolean;
  gradientId?: string;
}

export const IntelligenceAreaChart: React.FC<AreaChartProps> = ({
  data,
  title,
  description,
  dataKey = "value",
  xAxisKey = "name",
  showGrid = true,
  height = 300,
  color = CHART_COLORS.primary,
  gradientId = "areaGradient",
  className
}) => {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} {...commonChartProps}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_DEFAULTS.gridStroke}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <YAxis
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_DEFAULTS.tooltipBackground,
                border: `1px solid ${CHART_DEFAULTS.tooltipBorder}`,
                borderRadius: '8px'
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={CHART_DEFAULTS.strokeWidth}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export interface RadarChartProps extends BaseChartProps {
  data: ChartDataPoint[];
  dataKey?: string;
  angleKey?: string;
}

export const IntelligenceRadarChart: React.FC<RadarChartProps> = ({
  data,
  title,
  description,
  dataKey = "value",
  angleKey = "name",
  height = 300,
  color = CHART_COLORS.primary,
  className
}) => {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={data}>
            <PolarGrid stroke={CHART_DEFAULTS.gridStroke} />
            <PolarAngleAxis
              dataKey={angleKey}
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <PolarRadiusAxis
              stroke={CHART_COLORS.muted}
              fontSize={10}
            />
            <Radar
              name="Metrics"
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_DEFAULTS.tooltipBackground,
                border: `1px solid ${CHART_DEFAULTS.tooltipBorder}`,
                borderRadius: '8px'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Multi-line chart for comparison
export interface MultiLineChartProps extends BaseChartProps {
  data: MultiSeriesDataPoint[];
  lines: {
    dataKey: string;
    name: string;
    color: string;
  }[];
  xAxisKey?: string;
  showGrid?: boolean;
}

export const IntelligenceMultiLineChart: React.FC<MultiLineChartProps> = ({
  data,
  lines,
  title,
  description,
  xAxisKey = "name",
  showGrid = true,
  height = 300,
  className
}) => {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart data={data} {...commonChartProps}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_DEFAULTS.gridStroke}
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <YAxis
              stroke={CHART_COLORS.muted}
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_DEFAULTS.tooltipBackground,
                border: `1px solid ${CHART_DEFAULTS.tooltipBorder}`,
                borderRadius: '8px'
              }}
            />
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={CHART_DEFAULTS.strokeWidth}
                dot={{ r: CHART_DEFAULTS.dotSize, fill: line.color }}
                activeDot={{ r: 6 }}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
