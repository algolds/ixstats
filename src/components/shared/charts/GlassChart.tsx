"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { chartColorPalette } from "~/lib/builder";

interface GlassChartProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  depth?: "base" | "elevated" | "modal";
  blur?: "light" | "medium" | "heavy";
  height?: number | string;
  loading?: boolean;
  error?: string;
  actions?: React.ReactNode;
  theme?: "default" | "gold" | "blue" | "emerald" | "indigo" | "purple" | "cyan" | "red";
}

export function GlassChart({
  children,
  title,
  description,
  className,
  depth = "base",
  blur = "light",
  height = 300,
  loading = false,
  error,
  actions,
  theme = "default",
}: GlassChartProps) {
  const depthClasses = {
    base: "bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-primary)]",
    elevated:
      "bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border-primary)] shadow-lg",
    modal:
      "bg-[var(--color-bg-secondary)]/70 border border-[var(--color-border-secondary)] shadow-2xl",
  };

  const blurClasses = {
    light: "backdrop-blur-sm",
    medium: "backdrop-blur-md",
    heavy: "backdrop-blur-lg",
  };

  const themeClasses = {
    default: "",
    gold: "border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5",
    blue: "border-blue-400/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/5",
    emerald: "border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5",
    indigo: "border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 to-blue-500/5",
    purple: "border-purple-400/30 bg-gradient-to-br from-purple-500/10 to-violet-500/5",
    cyan: "border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-sky-500/5",
    red: "border-red-400/30 bg-gradient-to-br from-red-500/10 to-rose-500/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "overflow-hidden rounded-lg",
        depthClasses[depth],
        blurClasses[blur],
        themeClasses[theme],
        className
      )}
    >
      {/* Header */}
      {(title || description || actions) && (
        <div className="border-b border-[var(--color-border-primary)]/50 p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {title && (
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
              )}
              {description && (
                <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="relative"
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-4 text-center">
              <motion.div
                className="mx-auto h-8 w-8 rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-sm text-[var(--color-text-muted)]">Loading chart data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-error)]/20">
                <svg
                  className="h-6 w-6 text-[var(--color-error)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-error)]">Chart error</p>
              <p className="text-xs text-[var(--color-text-muted)]">{error}</p>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">{children}</div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Chart theme provider for consistent styling across all chart types
 */
export const chartTheme = {
  colors: chartColorPalette,
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    muted: "var(--color-text-muted)",
  },
  grid: {
    stroke: "var(--color-border-primary)",
    strokeWidth: 1,
    opacity: 0.3,
  },
  tooltip: {
    background: "var(--color-bg-secondary)",
    border: "var(--color-border-primary)",
    text: "var(--color-text-primary)",
  },
  legend: {
    text: "var(--color-text-secondary)",
    fontSize: 12,
  },
};
