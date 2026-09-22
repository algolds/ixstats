"use client";

import React from "react";
import { motion } from "motion/react";
import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  Activity,
  Globe,
  Sparks as Sparkles,
  Shield,
  Coins,
  Group as Users,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { smartNormalizeGrowthRate } from "~/lib/statecraft/growth-calculations";

interface CountryPulseBannerProps {
  country: {
    name: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    adjustedGdpGrowth?: number | null;
    realGDPGrowthRate?: number | null;
    populationGrowthRate?: number | null;
    economicTier?: string | null;
    populationTier?: string | null;
    stabilityIndex?: number | null;
  };
  className?: string;
}

export function CountryPulseBanner({ country, className }: CountryPulseBannerProps) {
  const gdpGrowth = smartNormalizeGrowthRate(
    country.realGDPGrowthRate || country.adjustedGdpGrowth,
    0.024
  );
  const popGrowth = smartNormalizeGrowthRate(country.populationGrowthRate, 0.009);
  const stability = country.stabilityIndex ?? 84;

  // Determine pulse headline narrative
  const pulseStatus = (() => {
    if (gdpGrowth > 0.03 && popGrowth >= 0) {
      return {
        label: "RAPID EXPANSION",
        badge: "Accelerated Growth",
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        indicator: "bg-emerald-500",
        description: "Experiencing accelerated economic throughput and structural expansion.",
      };
    }
    if (gdpGrowth >= 0 && stability >= 75) {
      return {
        label: "STABLE & PROSPEROUS",
        badge: "High Stability",
        color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
        indicator: "bg-blue-500",
        description: "Maintaining sustained fiscal balance, strong institutions, and social cohesion.",
      };
    }
    if (gdpGrowth < 0) {
      return {
        label: "ECONOMIC HEADWINDS",
        badge: "Fiscal Contraction",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        indicator: "bg-amber-500",
        description: "Navigating macroeconomic adjustment, inflation control, and trade realignment.",
      };
    }
    return {
      label: "CONSOLIDATING",
      badge: "Steady State",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
      indicator: "bg-purple-500",
      description: "Steady institutional performance with balanced domestic indicators.",
    };
  })();

  return (
    <div
      className={cn(
        "facet-surface facet-refraction relative overflow-hidden rounded-2xl border border-white/10 p-4 shadow-lg backdrop-blur-xl",
        className
      )}
    >
      {/* Background ambient gradient wash */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[var(--flag-primary)]/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Narrative status */}
        <div className="flex items-start gap-3.5">
          <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-[var(--flag-primary)]" />
            <span
              className={cn(
                "absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-background",
                pulseStatus.indicator
              )}
            >
              <span
                className={cn(
                  "h-full w-full animate-ping rounded-full opacity-75",
                  pulseStatus.indicator
                )}
              />
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-muted-foreground">
                National Pulse
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  pulseStatus.color
                )}
              >
                {pulseStatus.label}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {country.name} is {pulseStatus.label.toLowerCase()} — {pulseStatus.description}
            </p>
          </div>
        </div>

        {/* Right: Key Telemetry Deltas */}
        <div className="flex flex-wrap items-center gap-3 pt-2 lg:pt-0">
          {/* GDP Growth */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Real GDP
              </p>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-foreground">
                  {gdpGrowth >= 0 ? `+${gdpGrowth.toFixed(1)}%` : `${gdpGrowth.toFixed(1)}%`}
                </span>
                {gdpGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
              </div>
            </div>
          </div>

          {/* Population Growth */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Population
              </p>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-foreground">
                  {popGrowth >= 0 ? `+${popGrowth.toFixed(1)}%` : `${popGrowth.toFixed(1)}%`}
                </span>
                <TrendingUp className="h-3 w-3 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Stability Rating */}
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Stability
              </p>
              <span className="text-xs font-bold text-foreground">{stability}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
