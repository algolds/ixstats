"use client";

import React, { useMemo } from "react";
import {
  Bank as Landmark,
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  ShieldCheck,
  StatsReport as BarChart3,
  Activity,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { PercentageFlow } from "~/components/ui/number-flow";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { cn } from "~/lib/utils";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { economicRelationsOf, finiteOrNull } from "~/lib/economy/country-relations";
import {
  TAX_CHANNELS,
  ACCENT_BG,
  readSavedRates,
  computeTaxYields,
  deriveSectorWeights,
} from "./taxChannels";
import { Eyebrow } from "~/components/ui/eyebrow";

/** Fiscal Policy sidebar — reads the saved rates from the country record; "—" where unknown. */
export function FiscalPolicyInsights({ countryId: _countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { economicProfile: profile, fiscalSystem: fiscal } = economicRelationsOf(country);
  const gdp = finiteOrNull(country?.currentTotalGdp);
  const taxEfficiency = finiteOrNull(fiscal?.taxEfficiency);

  const rates = useMemo(() => {
    const saved = readSavedRates(fiscal);
    const result: Record<string, number | null> = {};
    for (const ch of TAX_CHANNELS) result[ch.key] = saved[ch.key]?.rate ?? null;
    return result;
  }, [fiscal]);

  const sectorWeights = useMemo(
    () =>
      deriveSectorWeights(
        parseSectorBreakdown(profile?.sectorBreakdown).map((s) => ({
          name: s.name,
          percentage: s.share,
        })),
        profile?.exportsGDPPercent,
        profile?.importsGDPPercent
      ),
    [profile?.sectorBreakdown, profile?.exportsGDPPercent, profile?.importsGDPPercent]
  );

  const yields = useMemo(
    () => computeTaxYields(rates, gdp, taxEfficiency, sectorWeights),
    [rates, gdp, taxEfficiency, sectorWeights]
  );

  const effectiveTaxBurden =
    yields.total != null && gdp != null && gdp > 0 ? (yields.total / gdp) * 100 : null;

  const lafferPosition =
    effectiveTaxBurden == null
      ? null
      : effectiveTaxBurden < 15
        ? "below-optimal"
        : effectiveTaxBurden <= 35
          ? "optimal"
          : "above-optimal";

  const govRevenue = finiteOrNull(country?.governmentRevenueTotal);
  const budgetImpact =
    govRevenue != null && govRevenue > 0 && yields.total != null
      ? ((yields.total - govRevenue) / govRevenue) * 100
      : null;

  const collectionEfficiency = taxEfficiency != null ? taxEfficiency * 100 : null;

  const revenueComposition = useMemo(() => {
    const total = yields.total;
    if (total == null || total <= 0) return [];
    return TAX_CHANNELS.map((ch) => {
      const value = yields.byChannel[ch.key];
      return { key: ch.key, accent: ch.accent, pct: value != null ? (value / total) * 100 : null };
    });
  }, [yields]);

  return (
    <div className="space-y-4">
      {/* Tax Burden Analysis */}
      <FacetCard
        depth={1}
        className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <h4 className="text-foreground text-xs font-extrabold tracking-wider uppercase">
              Tax Burden Analysis
            </h4>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
            Macro Index
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold">
              Effective GDP Tax Burden
            </span>
            <span className="font-mono text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
              {effectiveTaxBurden != null ? (
                <PercentageFlow value={effectiveTaxBurden} decimalPlaces={1} />
              ) : (
                "—"
              )}
            </span>
          </div>

          <div className="bg-muted/30 border-border/20 relative h-2.5 overflow-hidden rounded-full border">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
                lafferPosition === "optimal"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : lafferPosition === "below-optimal"
                    ? "bg-gradient-to-r from-amber-500 to-amber-400"
                    : "bg-gradient-to-r from-red-500 to-red-400"
              )}
              style={{
                width: `${Math.min(((effectiveTaxBurden ?? 0) / 50) * 100, 100)}%`,
              }}
            />
            <div
              className="absolute inset-y-0 border-r border-l border-emerald-400/40 bg-emerald-400/10"
              style={{ left: "30%", width: "20%" }}
            />
          </div>
          <div className="text-muted-foreground/70 flex justify-between font-mono text-xs">
            <span>0%</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Optimal Zone (15-35%)
            </span>
            <span>50%+</span>
          </div>
        </div>
      </FacetCard>

      {/* Revenue Composition */}
      <FacetCard
        depth={1}
        className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Revenue Stream Composition
            </h4>
          </div>
        </div>

        {revenueComposition.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No revenue projection yet — set your tax rates in National Tax Rate Controls.
          </p>
        ) : (
          <>
            <div className="bg-muted/20 border-border/20 flex h-3.5 overflow-hidden rounded-full border">
              {revenueComposition.map((seg) => (
                <div
                  key={seg.key}
                  className={cn(
                    "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 ease-out first:rounded-l-full last:rounded-r-full",
                    ACCENT_BG[seg.accent]
                  )}
                  style={{ width: `${seg.pct ?? 0}%` }}
                  title={`${seg.key}: ${seg.pct != null ? `${seg.pct.toFixed(1)}%` : "not set"}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {revenueComposition.map((seg) => {
                const ch = TAX_CHANNELS.find((c) => c.key === seg.key)!;
                return (
                  <div
                    key={seg.key}
                    className="border-border/20 bg-muted/15 flex items-center justify-between rounded-lg border px-2 py-1"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_BG[seg.accent])} />
                      <span className="text-muted-foreground truncate text-xs font-medium">
                        {ch.shortLabel}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xs font-semibold tabular-nums",
                        ch.accentClass
                      )}
                    >
                      {seg.pct != null ? <PercentageFlow value={seg.pct} decimalPlaces={1} /> : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </FacetCard>

      {/* Fiscal Health */}
      <FacetCard
        depth={1}
        className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Fiscal Health & Telemetry
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <Eyebrow className="block">Efficiency</Eyebrow>
            <p className="mt-0.5 font-mono text-base font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
              {collectionEfficiency != null ? (
                <PercentageFlow value={collectionEfficiency} decimalPlaces={0} />
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <Eyebrow className="block">Budget Δ</Eyebrow>
            <p
              className={cn(
                "mt-0.5 font-mono text-base font-bold tabular-nums",
                budgetImpact == null
                  ? "text-foreground"
                  : budgetImpact >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
              )}
            >
              {budgetImpact == null ? (
                "—"
              ) : (
                <>
                  {budgetImpact >= 0 ? (
                    <TrendingUp className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  ) : (
                    <TrendingDown className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  )}
                  <PercentageFlow value={Math.abs(budgetImpact)} decimalPlaces={1} />
                </>
              )}
            </p>
          </div>
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <Eyebrow className="block">Burden</Eyebrow>
            <p
              className={cn(
                "mt-1 font-mono text-xs font-semibold tabular-nums",
                lafferPosition === "optimal"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : lafferPosition === "below-optimal"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              )}
            >
              {lafferPosition == null
                ? "—"
                : lafferPosition === "optimal"
                  ? "Optimal"
                  : lafferPosition === "below-optimal"
                    ? "Low"
                    : "Severe"}
            </p>
          </div>
        </div>
      </FacetCard>
    </div>
  );
}
