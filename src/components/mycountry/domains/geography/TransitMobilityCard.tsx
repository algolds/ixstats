"use client";

import React, { memo } from "react";
import Link from "next/link";
import {
  PathArrow as RouteIcon,
  Dashboard as Gauge,
  Clock,
  Train,
  Car,
  DeliveryTruck as Ship,
  Airplane as Plane,
  ArrowUpRight,
  Shield,
  SystemRestart as Loader2,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";

interface TransitMobilityCardProps {
  countryId: string;
  countryName?: string;
}

const MODAL_ICONS: Record<string, typeof Train> = {
  high_speed_rail: Train,
  rail: Train,
  freight_rail: Train,
  commuter_rail: Train,
  motorway: Car,
  highway: Car,
  trunk: Car,
  road: Car,
  shipping_lane: Ship,
  canal: Ship,
  ferry: Ship,
  air_corridor: Plane,
};

const RATING_THEMES = {
  world_class: {
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  advanced: {
    text: "text-cyan-400",
    dot: "bg-cyan-400",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
  developing: {
    text: "text-amber-400",
    dot: "bg-amber-400",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  underdeveloped: {
    text: "text-red-400",
    dot: "bg-red-400",
    badge: "border-red-500/30 bg-red-500/10 text-red-400",
  },
} as const;

const CONDITION_TEXT_THEMES = {
  optimal: "text-emerald-400",
  adequate: "text-cyan-400",
  deteriorating: "text-amber-400",
  failing: "text-red-400",
} as const;

export const TransitMobilityCard = memo(function TransitMobilityCard({
  countryId,
  countryName: _countryName,
}: TransitMobilityCardProps) {
  const { data: profile, isLoading } = api.transport.getNationalMobilityProfile.useQuery(
    { countryId },
    { staleTime: 30_000, enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <div className="bg-card/40 border-border/40 flex h-48 items-center justify-center rounded-2xl border p-6 backdrop-blur-md">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!profile || profile.totalOperationalKm === 0) {
    return (
      <div className="bg-card/40 border-border/40 relative overflow-hidden rounded-2xl border p-5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon className="text-primary h-4 w-4" />
            <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
              National Transit & Mobility
            </h3>
          </div>
          <Link
            href="/mycountry/editor"
            onClick={() => soundEffects.press()}
            className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-semibold transition active:scale-[0.98]"
          >
            <span>Open Map Editor</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          No operational transport routes mapped. Build highways, railways, or shipping lanes in
          the Map Editor to establish national transit connectivity and unlock GDP dividends.
        </p>
      </div>
    );
  }

  const { tami, degradation, modalSummary, topCorridors, totalOperationalKm } = profile;
  const ratingTheme = RATING_THEMES[tami.rating] ?? RATING_THEMES.underdeveloped;
  const conditionTextClass = CONDITION_TEXT_THEMES[degradation.condition] ?? CONDITION_TEXT_THEMES.adequate;

  return (
    <div className="bg-card/30 border-border/40 relative overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-white/20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20">
            <RouteIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
              Transit Accessibility & Mobility (TAMI)
            </h3>
            <span className="text-muted-foreground text-[10px]">
              Spatial velocity and intercity transit efficiency
            </span>
          </div>
        </div>

        <Link
          href="/mycountry/editor"
          onClick={() => soundEffects.press()}
          className="group text-foreground/80 hover:text-foreground flex items-center gap-1 text-xs font-medium transition active:scale-[0.98]"
        >
          <span>Map Editor Transit</span>
          <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
        </Link>
      </div>

      {/* Main Grid: TAMI Score + Core Metrics */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* TAMI Circular Index Dial */}
        <div className="bg-background/40 border-border/30 flex flex-col justify-between rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Mobility Score
          </span>
          <div className="my-2 flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-3xl font-extrabold tabular-nums tracking-tight",
                ratingTheme.text
              )}
            >
              {tami.tamiScore}
            </span>
            <span className="text-muted-foreground text-xs font-medium">/ 100</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", ratingTheme.dot)} />
            <span className="text-[11px] font-semibold text-foreground">
              {tami.ratingLabel}
            </span>
          </div>
        </div>

        {/* Network Weighted Velocity */}
        <div className="bg-background/40 border-border/30 flex flex-col justify-between rounded-xl border p-3.5">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Gauge className="h-3 w-3" /> Average Network Speed
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span className="text-foreground font-mono text-3xl font-extrabold tabular-nums tracking-tight">
              {modalSummary.overallWeightedSpeedKmh}
            </span>
            <span className="text-muted-foreground text-xs font-medium">km/h</span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between text-[11px]">
            <span>Total Network</span>
            <span className="font-mono font-medium text-foreground tabular-nums">
              {totalOperationalKm.toLocaleString()} km
            </span>
          </div>
        </div>

        {/* Infrastructure Condition & Factor */}
        <div className="bg-background/40 border-border/30 flex flex-col justify-between rounded-xl border p-3.5">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Shield className="h-3 w-3" /> Maintenance Health
          </span>
          <div className="my-2 flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-3xl font-extrabold tabular-nums tracking-tight",
                conditionTextClass
              )}
            >
              {(degradation.speedDegradationFactor * 100).toFixed(0)}%
            </span>
            <span className="text-muted-foreground text-xs font-medium">speed retention</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Condition</span>
            <span className={cn("font-semibold capitalize", conditionTextClass)}>
              {degradation.conditionLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Modal Velocities Spectrum */}
      {Object.keys(modalSummary.modalGroups).length > 0 && (
        <div className="mt-4 space-y-2">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Modal Velocities & Network Extent
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(modalSummary.modalGroups).map(([key, group]) => {
              const Icon = MODAL_ICONS[key] ?? RouteIcon;
              return (
                <div
                  key={key}
                  className="bg-background/30 border-border/30 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {group.label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                    {group.avgSpeedKmh} <span className="text-muted-foreground text-[9px]">km/h</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Travel Corridors */}
      {topCorridors.length > 0 && (
        <div className="mt-4 space-y-2">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Primary Intercity Travel Corridors
          </span>
          <div className="border-border/30 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border bg-background/20 p-2">
            {topCorridors.map((c) => (
              <div
                key={c.id}
                className="bg-card/40 border-border/20 flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition hover:bg-card/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-foreground">{c.name}</div>
                  <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                    <span className="capitalize">{c.routeType.replace("_", " ")}</span>
                    <span className="font-mono tabular-nums">• {c.lengthKm} km</span>
                    <span className="font-mono tabular-nums">• {c.effectiveSpeedKmh} km/h</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-3">
                  <Clock className="text-primary h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono text-xs font-bold tabular-nums text-primary">
                    {c.formattedTravelTime}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
