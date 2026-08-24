"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface FacetMetricTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * FacetMetricTile — Canonical Apple-grade metric tile for the unified IxnayID profile system.
 * Features tactile `:active` physical feedback, micro-typography, and subtle color-mix refraction.
 */
export function FacetMetricTile({
  label,
  value,
  subtext,
  icon,
  accentColor = "var(--primary, #3b82f6)",
  trend,
  trendValue,
  onClick,
  className,
}: FacetMetricTileProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      data-cuelume-press={isClickable ? "soft" : undefined}
      className={cn(
        "facet-surface group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/8 dark:border-white/10 bg-white/60 dark:bg-stone-900/60 p-4 shadow-sm backdrop-blur-xl transition-all duration-150 ease-out select-none",
        isClickable &&
          "cursor-pointer hover:border-black/15 dark:hover:border-white/20 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
        className
      )}
      style={{
        boxShadow: `0 0 0 1px color-mix(in srgb, ${accentColor} 12%, transparent)`,
      }}
    >
      {/* Top ambient color wash */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-25"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header Row */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {label}
        </span>
        {icon && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-sm transition-transform duration-200 group-hover:scale-110"
            style={{ color: accentColor }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="relative z-10 mt-3 flex items-baseline justify-between gap-2">
        <div className="text-xl font-black tracking-tight text-stone-950 dark:text-white">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {trendValue && (
          <span
            className={cn(
              "text-[10px] font-extrabold font-mono",
              trend === "up" && "text-emerald-500",
              trend === "down" && "text-rose-500",
              trend === "neutral" && "text-stone-400"
            )}
          >
            {trend === "up" ? "↑ " : trend === "down" ? "↓ " : ""}
            {trendValue}
          </span>
        )}
      </div>

      {/* Subtext Footer */}
      {subtext && (
        <p className="relative z-10 mt-1 text-[11px] font-medium text-stone-500 dark:text-stone-400 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}
