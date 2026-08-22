"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { EnhancedBarChart as EnhancedBarChartComponent } from "./EnhancedBarChart";
import type { EnhancedPieChart as EnhancedPieChartComponent } from "./EnhancedPieChart";

const ChartSkeleton = () => (
  <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-xl bg-black/5 dark:bg-white/5">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
  </div>
);

export const DynamicEnhancedBarChart = dynamic<ComponentProps<typeof EnhancedBarChartComponent>>(
  () => import("./EnhancedBarChart").then((mod) => mod.EnhancedBarChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

export const DynamicEnhancedPieChart = dynamic<ComponentProps<typeof EnhancedPieChartComponent>>(
  () => import("./EnhancedPieChart").then((mod) => mod.EnhancedPieChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);
