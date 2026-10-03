"use client";

import React from "react";
import { cn } from "~/lib/utils/cn";
import { ArrowUpRight, ArrowDownRight } from "iconoir-react";
import { NumberFlowDisplay } from "~/components/ui/number-flow";

export type MetricThemeVariant = "economy" | "social" | "demographics" | "labor" | "default";

interface MetricModalLayoutProps {
  variant?: MetricThemeVariant;
  className?: string;
  children: React.ReactNode;
}

export function MetricModalLayout({
  // oxlint-disable-next-line eslint/no-unused-vars
  variant = "default",
  className,
  children,
}: MetricModalLayoutProps) {
  return (
    <div className={cn("mt-4 grid w-full grid-cols-1 gap-6 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}

// Helper theme mappings. Economy carries the MyCountry accent; the rest stay neutral so the
// chart series, not the chrome, carry colour.
export function getThemeClasses(variant: MetricThemeVariant) {
  const accent = (token: string) => ({
    chartColor: token,
    gradientStop: `color-mix(in srgb, ${token} 15%, transparent)`,
  });
  switch (variant) {
    case "economy":
      return {
        cardClass: "bg-fill-3",
        textHighlight: "text-yellow",
        ...accent("var(--color-amber-500)"),
      };
    case "social":
    case "demographics":
      return {
        cardClass: "bg-fill-3",
        textHighlight: "text-label-secondary",
        ...accent("var(--chart-2)"),
      };
    case "labor":
      return {
        cardClass: "bg-fill-3",
        textHighlight: "text-label-secondary",
        ...accent("var(--color-blue-500)"),
      };
    default:
      return {
        cardClass: "bg-fill-3",
        textHighlight: "text-label-secondary",
        ...accent("var(--color-tint)"),
      };
  }
}

// 1. Main Area Component
MetricModalLayout.MainArea = function MetricModalMainArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col justify-between space-y-6 lg:col-span-2", className)}>
      {children}
    </div>
  );
};

// 2. Sidebar Component
MetricModalLayout.Sidebar = function MetricModalSidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-col space-y-6 lg:col-span-1", className)}>{children}</div>;
};

// 3. Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  trend?: number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: MetricThemeVariant;
  className?: string;
}

MetricModalLayout.StatCard = function MetricModalStatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  decimalPlaces = 0,
  trend,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const theme = getThemeClasses(variant);
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className={cn("rounded-row relative overflow-hidden p-4", theme.cardClass, className)}>
      <div className="flex items-center justify-between">
        <span className="text-stat-label text-label-secondary">{label}</span>
        <Icon className={cn("h-4 w-4", theme.textHighlight)} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-label text-title-1 tabular-nums">
          {prefix}
          <NumberFlowDisplay value={value} decimalPlaces={decimalPlaces} className="inline" />
          {suffix}
        </span>
        {trend !== undefined && (
          <span
            className={cn(
              "rounded-control-sm text-caption inline-flex items-center gap-0.5 px-2 py-0.5 font-semibold",
              isPositive ? "bg-fill-3 text-green" : "bg-fill-3 text-destructive"
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};
