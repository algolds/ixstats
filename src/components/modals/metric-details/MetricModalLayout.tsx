"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { NumberFlowDisplay } from "~/components/ui/number-flow";

export type MetricThemeVariant = "economy" | "social" | "demographics" | "labor" | "default";

interface MetricModalLayoutProps {
  variant?: MetricThemeVariant;
  className?: string;
  children: React.ReactNode;
}

export function MetricModalLayout({ variant = "default", className, children }: MetricModalLayoutProps) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6 w-full mt-4", className)}>
      {children}
    </div>
  );
}

// Helper theme mappings
export function getThemeClasses(variant: MetricThemeVariant) {
  switch (variant) {
    case "economy":
      return {
        cardClass: "facet-mycountry border-yellow-500/20 bg-yellow-500/5",
        textHighlight: "text-amber-500",
        chartColor: "#fbbf24",
        gradientStop: "rgba(251, 191, 36, 0.15)",
      };
    case "social":
    case "demographics":
      return {
        cardClass: "facet-global border-cyan-500/20 bg-cyan-500/5",
        textHighlight: "text-cyan-500",
        chartColor: "#06b6d4",
        gradientStop: "rgba(6, 182, 212, 0.15)",
      };
    case "labor":
      return {
        cardClass: "facet-global border-blue-500/20 bg-blue-500/5",
        textHighlight: "text-blue-500",
        chartColor: "#3b82f6",
        gradientStop: "rgba(59, 130, 246, 0.15)",
      };
    default:
      return {
        cardClass: "facet-surface border-white/5 bg-white/5",
        textHighlight: "text-primary",
        chartColor: "var(--color-primary)",
        gradientStop: "rgba(255, 255, 255, 0.1)",
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
    <div className={cn("lg:col-span-2 space-y-6 flex flex-col justify-between", className)}>
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
  return (
    <div className={cn("lg:col-span-1 space-y-6 flex flex-col", className)}>
      {children}
    </div>
  );
};

// 3. Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  trend?: number;
  icon: LucideIcon;
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
    <div
      className={cn(
        "facet-refraction p-4 rounded-xl border relative overflow-hidden",
        theme.cardClass,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn("h-4 w-4", theme.textHighlight)} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">
          {prefix}
          <NumberFlowDisplay value={value} decimalPlaces={decimalPlaces} className="inline" />
          {suffix}
        </span>
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md",
              isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
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
