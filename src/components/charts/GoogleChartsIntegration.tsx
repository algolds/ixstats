"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { Chart } from "react-google-charts";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { GlassChart, chartTheme } from "./GlassChart";
import { generateChartColors } from "~/lib/builder-theme-utils";

interface BaseGoogleChartProps {
  data: any[][];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  loading?: boolean;
  error?: string;
  theme?: "default" | "gold" | "blue" | "emerald" | "purple";
  options?: any;
}

interface GoogleLineChartProps extends BaseGoogleChartProps {
  curveType?: "function" | "none";
  pointSize?: number;
  lineWidth?: number;
}

interface GoogleBarChartProps extends BaseGoogleChartProps {
  orientation?: "horizontal" | "vertical";
  stacked?: boolean;
}

interface GooglePieChartProps extends BaseGoogleChartProps {
  is3D?: boolean;
  pieHole?: number;
  pieSliceText?: "percentage" | "value" | "label" | "none";
}

interface GoogleGeoChartProps extends BaseGoogleChartProps {
  region?: string;
  displayMode?: "regions" | "markers";
  colorAxis?: {
    minValue?: number;
    maxValue?: number;
    colors?: string[];
  };
}

interface GoogleGaugeChartProps extends BaseGoogleChartProps {
  min?: number;
  max?: number;
  yellowFrom?: number;
  yellowTo?: number;
  redFrom?: number;
  redTo?: number;
}

// Get theme-aware Google Charts options
function getGoogleChartTheme(theme: string, baseOptions: any = {}) {
  const themeColors = {
    default: generateChartColors(10, "primary"),
    gold: ["#F59E0B", "#FBBF24", "#FCD34D", "#FDE68A"],
    blue: ["#3B82F6", "#60A5FA", "#93C5FD", "#DBEAFE"],
    emerald: ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0"],
    purple: ["#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"],
  };

  return {
    backgroundColor: "transparent",
    chartArea: {
      backgroundColor: "transparent",
      left: 50,
      top: 50,
      width: "85%",
      height: "75%",
    },
    legend: {
      textStyle: {
        color: chartTheme.text.secondary,
        fontSize: 12,
        fontName: "Inter, system-ui, sans-serif",
      },
      position: "bottom",
      alignment: "center",
    },
    titleTextStyle: {
      color: chartTheme.text.primary,
      fontSize: 16,
      fontName: "Inter, system-ui, sans-serif",
      bold: true,
    },
    hAxis: {
      textStyle: {
        color: chartTheme.text.secondary,
        fontSize: 11,
        fontName: "Inter, system-ui, sans-serif",
      },
      titleTextStyle: {
        color: chartTheme.text.secondary,
        fontSize: 12,
        fontName: "Inter, system-ui, sans-serif",
      },
      gridlines: {
        color: chartTheme.grid.stroke,
        count: 5,
      },
      minorGridlines: {
        color: "transparent",
      },
    },
    vAxis: {
      textStyle: {
        color: chartTheme.text.secondary,
        fontSize: 11,
        fontName: "Inter, system-ui, sans-serif",
      },
      titleTextStyle: {
        color: chartTheme.text.secondary,
        fontSize: 12,
        fontName: "Inter, system-ui, sans-serif",
      },
      gridlines: {
        color: chartTheme.grid.stroke,
        count: 5,
      },
      minorGridlines: {
        color: "transparent",
      },
    },
    colors: themeColors[theme as keyof typeof themeColors] || themeColors.default,
    tooltip: {
      textStyle: {
        color: chartTheme.text.primary,
        fontSize: 12,
        fontName: "Inter, system-ui, sans-serif",
      },
    },
    ...baseOptions,
  };
}

// Google Line Chart
export function GoogleLineChart({
  data,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = "default",
  curveType = "function",
  pointSize = 4,
  lineWidth = 2,
  options = {},
}: GoogleLineChartProps) {
  const chartOptions = useMemo(
    () =>
      getGoogleChartTheme(theme, {
        curveType,
        pointSize,
        lineWidth,
        interpolateNulls: true,
        ...options,
      }),
    [theme, curveType, pointSize, lineWidth, options]
  );

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
      <Chart
        chartType="LineChart"
        data={data}
        options={chartOptions}
        width="100%"
        height="100%"
        loader={
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        }
      />
    </GlassChart>
  );
}

// Google Bar Chart
export function GoogleBarChart({
  data,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = "default",
  orientation = "vertical",
  stacked = false,
  options = {},
}: GoogleBarChartProps) {
  const chartType = orientation === "horizontal" ? "BarChart" : "ColumnChart";

  const chartOptions = useMemo(
    () =>
      getGoogleChartTheme(theme, {
        isStacked: stacked,
        bar: { groupWidth: "75%" },
        ...options,
      }),
    [theme, stacked, options]
  );

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
      <Chart
        chartType={chartType}
        data={data}
        options={chartOptions}
        width="100%"
        height="100%"
        loader={
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        }
      />
    </GlassChart>
  );
}

// Google Pie Chart
export function GooglePieChart({
  data,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = "default",
  is3D = false,
  pieHole = 0,
  pieSliceText = "percentage",
  options = {},
}: GooglePieChartProps) {
  const chartOptions = useMemo(
    () =>
      getGoogleChartTheme(theme, {
        is3D,
        pieHole,
        pieSliceText,
        pieSliceTextStyle: {
          color: chartTheme.text.primary,
          fontSize: 12,
          fontName: "Inter, system-ui, sans-serif",
        },
        ...options,
      }),
    [theme, is3D, pieHole, pieSliceText, options]
  );

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
      <Chart
        chartType="PieChart"
        data={data}
        options={chartOptions}
        width="100%"
        height="100%"
        loader={
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        }
      />
    </GlassChart>
  );
}

// Google Geo Chart
export function GoogleGeoChart({
  data,
  title,
  description,
  height = 400,
  className,
  loading,
  error,
  theme = "default",
  region = "world",
  displayMode = "regions",
  colorAxis,
  options = {},
}: GoogleGeoChartProps) {
  const chartOptions = useMemo(() => {
    const baseOptions = getGoogleChartTheme(theme, {
      region,
      displayMode,
      colorAxis: colorAxis || {
        colors: generateChartColors(3, theme as any),
      },
      datalessRegionColor: "hsl(var(--color-bg-tertiary-hsl))",
      defaultColor: "hsl(var(--color-bg-secondary-hsl))",
      ...options,
    });

    // Override background for geo charts
    return {
      ...baseOptions,
      backgroundColor: {
        fill: "transparent",
        stroke: chartTheme.grid.stroke,
        strokeWidth: 1,
      },
    };
  }, [theme, region, displayMode, colorAxis, options]);

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
      <Chart
        chartType="GeoChart"
        data={data}
        options={chartOptions}
        width="100%"
        height="100%"
        loader={
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        }
      />
    </GlassChart>
  );
}

// Google Gauge Chart
export function GoogleGaugeChart({
  data,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = "default",
  min = 0,
  max = 100,
  yellowFrom = 60,
  yellowTo = 80,
  redFrom = 80,
  redTo = 100,
  options = {},
}: GoogleGaugeChartProps) {
  const chartOptions = useMemo(() => {
    const baseTheme = getGoogleChartTheme(theme);
    return {
      ...baseTheme,
      min,
      max,
      yellowFrom,
      yellowTo,
      redFrom,
      redTo,
      greenFrom: min,
      greenTo: yellowFrom,
      minorTicks: 5,
      majorTicks: [min, (min + max) / 2, max],
      ...options,
    };
  }, [theme, min, max, yellowFrom, yellowTo, redFrom, redTo, options]);

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
      <Chart
        chartType="Gauge"
        data={data}
        options={chartOptions}
        width="100%"
        height="100%"
        loader={
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        }
      />
    </GlassChart>
  );
}

// Google Area Chart
export function GoogleAreaChart({
  data,
  title,
  description,
  height = 300,
  className,
  loading,
  error,
  theme = "default",
  stacked = false,
  options = {},
}: BaseGoogleChartProps & { stacked?: boolean }) {
  const chartOptions = useMemo(
    () =>
      getGoogleChartTheme(theme, {
        isStacked: stacked,
        areaOpacity: 0.4,
        lineWidth: 2,
        pointSize: 0,
        ...options,
      }),
    [theme, stacked, options]
  );

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
      <Chart
        chartType="AreaChart"
        data={data}
        options={chartOptions}
        width="100%"
        height="100%"
        loader={
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        }
      />
    </GlassChart>
  );
}
