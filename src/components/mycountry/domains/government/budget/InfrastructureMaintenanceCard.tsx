"use client";

import React, { memo } from "react";
import {
  Shield,
  Dashboard as Gauge,
  Coins,
  KeyCommand as Command,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  SystemRestart as Loader2,
  ArrowUpRight,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";

const CONDITION_THEMES = {
  optimal: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
    bar: "bg-emerald-400",
  },
  adequate: {
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    dot: "bg-cyan-400",
    text: "text-cyan-400",
    bar: "bg-cyan-400",
  },
  deteriorating: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dot: "bg-amber-400",
    text: "text-amber-400",
    bar: "bg-amber-400",
  },
  failing: {
    badge: "border-red-500/30 bg-red-500/10 text-red-400",
    dot: "bg-red-400",
    text: "text-red-400",
    bar: "bg-red-400",
  },
} as const;

export interface InfrastructureMaintenanceCardProps {
  countryId: string;
  onDeclareDirective?: (directiveGoal: string) => void;
}

export const InfrastructureMaintenanceCard = memo(function InfrastructureMaintenanceCard({
  countryId,
  onDeclareDirective,
}: InfrastructureMaintenanceCardProps) {
  const { data: profile, isLoading } = api.transport.getNationalMobilityProfile.useQuery(
    { countryId },
    { staleTime: 30_000, enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <div className="bg-card/40 border-border/40 flex h-40 items-center justify-center rounded-2xl border p-6 backdrop-blur-md">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!profile || profile.totalOperationalKm === 0) {
    return null;
  }

  const { degradation, totalOperationalKm } = profile;
  const fundingPercent = Math.min(150, Math.round(degradation.fundingRatio * 100));

  const isCritical = degradation.condition === "failing" || degradation.condition === "deteriorating";
  const theme = CONDITION_THEMES[degradation.condition] ?? CONDITION_THEMES.adequate;

  return (
    <div
      className={cn(
        "bg-card/40 border-border/40 relative overflow-hidden rounded-2xl border p-5 backdrop-blur-md transition-all duration-200",
        isCritical ? "border-amber-500/30" : "hover:border-white/20"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              isCritical
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            )}
          >
            {isCritical ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
          </div>
          <div>
            <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
              Infrastructure Maintenance & Speed Retention
            </h3>
            <span className="text-muted-foreground text-[10px]">
              Physical network condition across {totalOperationalKm.toLocaleString()} operational kilometers
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
              theme.badge
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", theme.dot)}
            />
            {degradation.conditionLabel} Condition
          </span>
        </div>
      </div>

      {/* Progress & Budget Ratio */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Coins className="h-3 w-3" /> Budgeted vs. Required Annual Maintenance
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-foreground">
            {degradation.budgetedMaintenance.toFixed(3)}B / {degradation.requiredMaintenance.toFixed(3)}B
            <span className="text-muted-foreground ml-1.5 font-normal">
              ({fundingPercent}% funded)
            </span>
          </span>
        </div>

        <div className="bg-muted/40 h-2 w-full overflow-hidden rounded-full border border-border/20">
          <div
            className={cn("h-full rounded-full transition-all duration-500", theme.bar)}
            style={{
              width: `${Math.min(100, fundingPercent)}%`,
            }}
          />
        </div>
      </div>

      {/* 3-Metric Impact Row */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Speed Retention Factor */}
        <div className="bg-background/40 border-border/30 rounded-xl border p-3">
          <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
            <Gauge className="h-3 w-3" /> Network Speed Factor
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={cn("font-mono text-xl font-bold tabular-nums", theme.text)}
            >
              {degradation.speedDegradationFactor.toFixed(2)}×
            </span>
            {degradation.speedPenaltyPercent > 0 && (
              <span className="text-destructive font-mono text-xs tabular-nums">
                (-{degradation.speedPenaltyPercent}%)
              </span>
            )}
          </div>
          <span className="text-muted-foreground mt-0.5 block text-[10px]">
            {degradation.speedPenaltyPercent === 0
              ? "Full design velocity"
              : "Transit delay penalty"}
          </span>
        </div>

        {/* GDP Modifier Delta */}
        <div className="bg-background/40 border-border/30 rounded-xl border p-3">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            GDP Modifier Impact
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums",
                degradation.gdpModifierDelta >= 0 ? "text-emerald-400" : "text-destructive"
              )}
            >
              {degradation.gdpModifierDelta >= 0 ? "+" : ""}
              {(degradation.gdpModifierDelta * 100).toFixed(2)}%
            </span>
          </div>
          <span className="text-muted-foreground mt-0.5 block text-[10px]">
            Annual growth dividend
          </span>
        </div>

        {/* Trade Modifier Delta */}
        <div className="bg-background/40 border-border/30 rounded-xl border p-3">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Trade Efficiency
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums",
                degradation.tradeModifierDelta >= 0 ? "text-emerald-400" : "text-destructive"
              )}
            >
              {degradation.tradeModifierDelta >= 0 ? "+" : ""}
              {(degradation.tradeModifierDelta * 100).toFixed(2)}%
            </span>
          </div>
          <span className="text-muted-foreground mt-0.5 block text-[10px]">
            Supply-chain throughput
          </span>
        </div>
      </div>

      {/* Description & Action Callout */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/30 px-3 py-2.5 text-xs">
        <p className="text-muted-foreground max-w-xl text-[11px] leading-relaxed">
          {degradation.description}
        </p>

        {onDeclareDirective && (
          <button
            type="button"
            data-cuelume-press="soft"
            onClick={() => {
              soundEffects.press();
              onDeclareDirective("Emergency Transport Infrastructure Rehabilitation");
            }}
            className="group flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition-all hover:bg-primary/20 active:scale-[0.98]"
          >
            <Command className="h-3 w-3" />
            <span>Rehabilitation Directive</span>
            <ArrowUpRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  );
});
