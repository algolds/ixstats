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
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  TAX_CHANNELS,
  ACCENT_BG,
  parseRateFromJson,
  deriveSectorWeights,
} from "./taxChannels";

interface FiscalSystemConfig {
  corporateTaxRates?: string | null;
  personalIncomeTaxRates?: string | null;
  salesTaxRate?: number | null;
  exciseTaxRates?: string | null;
  wealthTaxRate?: number | null;
  taxEfficiency?: number | null;
}

interface EconomicProfileConfig {
  exportsGDPPercent?: number | null;
  importsGDPPercent?: number | null;
}

interface SectorConfig {
  name?: string;
  percentage?: number;
  gdpContribution?: number;
}

interface EconomyConfigurationData {
  fiscalSystem?: FiscalSystemConfig | null;
  economicProfile?: EconomicProfileConfig | null;
  sectors?: SectorConfig[] | null;
}

export function FiscalPolicyInsights({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: rawEconConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const econConfig = rawEconConfig as EconomyConfigurationData | undefined;
  const fiscal = econConfig?.fiscalSystem;
  const profile = econConfig?.economicProfile;
  const gdpBase = country?.currentTotalGdp ?? 100_000_000_000;
  const taxEfficiency = fiscal?.taxEfficiency ?? 0.85;

  const rates = useMemo(
    () => ({
      corporate: parseRateFromJson(fiscal?.corporateTaxRates, 21),
      income: parseRateFromJson(fiscal?.personalIncomeTaxRates, 24),
      vat: fiscal?.salesTaxRate ?? 15,
      tariff: parseRateFromJson(fiscal?.exciseTaxRates, 4.5),
      wealth: fiscal?.wealthTaxRate ?? 1.5,
      capGains: parseRateFromJson(fiscal?.exciseTaxRates, 15),
    }),
    [fiscal]
  );

  const sectorWeights = useMemo(
    () =>
      deriveSectorWeights(
        econConfig?.sectors ?? undefined,
        profile?.exportsGDPPercent,
        profile?.importsGDPPercent
      ),
    [econConfig?.sectors, profile?.exportsGDPPercent, profile?.importsGDPPercent]
  );

  const yields = useMemo(() => {
    const result: Record<string, number> = {};
    let total = 0;
    const ratesMap = rates as Record<string, number>;
    for (const ch of TAX_CHANNELS) {
      const rate = ratesMap[ch.key] ?? ch.defaultRate;
      const weight = sectorWeights[ch.key] ?? ch.fallbackWeight;
      const yieldVal = gdpBase * (rate / 100) * weight * taxEfficiency;
      result[ch.key] = yieldVal;
      total += yieldVal;
    }
    result._total = total;
    return result;
  }, [rates, gdpBase, taxEfficiency, sectorWeights]);

  const effectiveTaxBurden = useMemo(() => {
    const totalYield = yields._total ?? 0;
    return gdpBase > 0 ? (totalYield / gdpBase) * 100 : 0;
  }, [yields, gdpBase]);

  const lafferPosition = useMemo(() => {
    if (effectiveTaxBurden < 15) return "below-optimal";
    if (effectiveTaxBurden <= 35) return "optimal";
    return "above-optimal";
  }, [effectiveTaxBurden]);

  const budgetImpact = useMemo(() => {
    const govRevenue = country?.governmentRevenueTotal ?? 0;
    const totalYield = yields._total ?? 0;
    if (govRevenue <= 0) return 0;
    return ((totalYield - govRevenue) / govRevenue) * 100;
  }, [country?.governmentRevenueTotal, yields]);

  const collectionEfficiency = (fiscal?.taxEfficiency ?? 0.85) * 100;

  const revenueComposition = useMemo(() => {
    const total = yields._total || 1;
    return TAX_CHANNELS.map((ch) => ({
      key: ch.key,
      accent: ch.accent,
      pct: ((yields[ch.key] ?? 0) / total) * 100,
    }));
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
            <BarChart3 className="h-4 w-4 shrink-0 text-amber-400" />
            <h4 className="text-foreground text-xs font-extrabold tracking-wider uppercase">
              Tax Burden Analysis
            </h4>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-extrabold text-amber-400">
            Macro Index
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold">
              Effective GDP Tax Burden
            </span>
            <span className="font-mono text-base font-bold text-amber-400 tabular-nums">
              <PercentageFlow value={effectiveTaxBurden} decimalPlaces={1} />
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
                width: `${Math.min((effectiveTaxBurden / 50) * 100, 100)}%`,
              }}
            />
            <div
              className="absolute inset-y-0 border-r border-l border-emerald-400/40 bg-emerald-400/10"
              style={{ left: "30%", width: "20%" }}
            />
          </div>
          <div className="text-muted-foreground/70 flex justify-between font-mono text-[10px]">
            <span>0%</span>
            <span className="font-semibold text-emerald-400">Optimal Zone (15-35%)</span>
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
            <Activity className="h-4 w-4 shrink-0 text-cyan-400" />
            <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Revenue Stream Composition
            </h4>
          </div>
        </div>

        <div className="bg-muted/20 border-border/20 flex h-3.5 overflow-hidden rounded-full border">
          {revenueComposition.map((seg) => (
            <div
              key={seg.key}
              className={cn(
                "transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full",
                ACCENT_BG[seg.accent]
              )}
              style={{ width: `${seg.pct}%` }}
              title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
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
                  <span className="text-muted-foreground truncate text-[11px] font-medium">
                    {ch.shortLabel}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] font-semibold tabular-nums",
                    ch.accentClass
                  )}
                >
                  <PercentageFlow value={seg.pct} decimalPlaces={1} />
                </span>
              </div>
            );
          })}
        </div>
      </FacetCard>

      {/* Fiscal Health */}
      <FacetCard
        depth={1}
        className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Fiscal Health & Telemetry
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <p className="text-muted-foreground text-[9px] font-medium tracking-wider uppercase">
              Efficiency
            </p>
            <p className="mt-0.5 font-mono text-base font-bold text-emerald-400 tabular-nums">
              <PercentageFlow value={collectionEfficiency} decimalPlaces={0} />
            </p>
          </div>
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <p className="text-muted-foreground text-[9px] font-medium tracking-wider uppercase">
              Budget Δ
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono text-base font-bold tabular-nums",
                budgetImpact >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {budgetImpact >= 0 ? (
                <TrendingUp className="-mt-0.5 mr-0.5 inline h-3 w-3" />
              ) : (
                <TrendingDown className="-mt-0.5 mr-0.5 inline h-3 w-3" />
              )}
              <PercentageFlow value={Math.abs(budgetImpact)} decimalPlaces={1} />
            </p>
          </div>
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <p className="text-muted-foreground text-[9px] font-medium tracking-wider uppercase">
              Burden
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-xs font-semibold tabular-nums",
                lafferPosition === "optimal"
                  ? "text-emerald-400"
                  : lafferPosition === "below-optimal"
                    ? "text-amber-400"
                    : "text-red-400"
              )}
            >
              {lafferPosition === "optimal"
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
