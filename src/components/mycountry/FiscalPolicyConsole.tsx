"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Percent,
  Landmark,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  BarChart3,
  Activity,
  Lock,
  Unlock,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Slider } from "~/components/ui/slider";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { useCountryData } from "./primitives";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useNotify } from "~/hooks/useNotify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaxChannel {
  key: string;
  label: string;
  shortLabel: string;
  /** DB field on FiscalSystem (if direct Float), or JSON key inside a serialised field */
  dbField: string;
  /** Fallback if DB has no data */
  defaultRate: number;
  min: number;
  max: number;
  step: number;
  accent: string; // tailwind color token (e.g. "emerald")
  accentClass: string;
  /** GDP-fraction base weight — overridden by real sector data when available */
  fallbackWeight: number;
}

const TAX_CHANNELS: TaxChannel[] = [
  {
    key: "corporate",
    label: "Corporate Tax",
    shortLabel: "Corp",
    dbField: "corporateTaxRates",
    defaultRate: 21,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "emerald",
    accentClass: "text-emerald-400",
    fallbackWeight: 0.12,
  },
  {
    key: "income",
    label: "Income Tax",
    shortLabel: "Income",
    dbField: "personalIncomeTaxRates",
    defaultRate: 24,
    min: 0,
    max: 60,
    step: 0.5,
    accent: "cyan",
    accentClass: "text-cyan-400",
    fallbackWeight: 0.18,
  },
  {
    key: "vat",
    label: "VAT / Sales Tax",
    shortLabel: "VAT",
    dbField: "salesTaxRate",
    defaultRate: 15,
    min: 0,
    max: 30,
    step: 0.5,
    accent: "amber",
    accentClass: "text-amber-400",
    fallbackWeight: 0.15,
  },
  {
    key: "tariff",
    label: "Tariff Rate",
    shortLabel: "Tariff",
    dbField: "exciseTaxRates",
    defaultRate: 4.5,
    min: 0,
    max: 25,
    step: 0.5,
    accent: "purple",
    accentClass: "text-purple-400",
    fallbackWeight: 0.05,
  },
  {
    key: "wealth",
    label: "Wealth Tax",
    shortLabel: "Wealth",
    dbField: "wealthTaxRate",
    defaultRate: 1.5,
    min: 0,
    max: 10,
    step: 0.1,
    accent: "teal",
    accentClass: "text-teal-400",
    fallbackWeight: 0.03,
  },
  {
    key: "capGains",
    label: "Capital Gains Tax",
    shortLabel: "Cap Gains",
    dbField: "capitalGainsTax",
    defaultRate: 15,
    min: 0,
    max: 40,
    step: 0.5,
    accent: "rose",
    accentClass: "text-rose-400",
    fallbackWeight: 0.07,
  },
];

// Accent color maps for dynamic Tailwind classes
const ACCENT_BORDER: Record<string, string> = {
  emerald: "border-emerald-500/30",
  cyan: "border-cyan-500/30",
  amber: "border-amber-500/30",
  purple: "border-purple-500/30",
  teal: "border-teal-500/30",
  rose: "border-rose-500/30",
};
const ACCENT_BG: Record<string, string> = {
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  teal: "bg-teal-500",
  rose: "bg-rose-500",
};
const ACCENT_BG_FAINT: Record<string, string> = {
  emerald: "bg-emerald-500/10",
  cyan: "bg-cyan-500/10",
  amber: "bg-amber-500/10",
  purple: "bg-purple-500/10",
  teal: "bg-teal-500/10",
  rose: "bg-rose-500/10",
};
const SLIDER_RANGE_COLOR: Record<string, string> = {
  emerald: "[&_[data-slot=slider-range]]:bg-emerald-500",
  cyan: "[&_[data-slot=slider-range]]:bg-cyan-500",
  amber: "[&_[data-slot=slider-range]]:bg-amber-500",
  purple: "[&_[data-slot=slider-range]]:bg-purple-500",
  teal: "[&_[data-slot=slider-range]]:bg-teal-500",
  rose: "[&_[data-slot=slider-range]]:bg-rose-500",
};
const SLIDER_THUMB_COLOR: Record<string, string> = {
  emerald: "[&_[data-slot=slider-thumb]]:border-emerald-500",
  cyan: "[&_[data-slot=slider-thumb]]:border-cyan-500",
  amber: "[&_[data-slot=slider-thumb]]:border-amber-500",
  purple: "[&_[data-slot=slider-thumb]]:border-purple-500",
  teal: "[&_[data-slot=slider-thumb]]:border-teal-500",
  rose: "[&_[data-slot=slider-thumb]]:border-rose-500",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a JSON-stringified field (personalIncomeTaxRates, corporateTaxRates, exciseTaxRates) to extract a top-level rate number. */
function parseRateFromJson(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    // Could be a number, string-number, or object with a "rate" or "baseRate" key, or an array
    if (typeof parsed === "number") return parsed;
    if (typeof parsed === "string" && !isNaN(Number(parsed))) return Number(parsed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Take the top bracket rate or first entry
      const first = parsed[0];
      return first?.rate ?? first?.baseRate ?? first?.value ?? fallback;
    }
    if (parsed && typeof parsed === "object") {
      return parsed.rate ?? parsed.baseRate ?? parsed.value ?? fallback;
    }
  } catch {
    // not JSON, try direct number parse
    const n = Number(raw);
    if (!isNaN(n)) return n;
  }
  return fallback;
}

/** Derive revenue sector weights from actual sector breakdown data.
 *  Maps the standard tax channels to sector-proportional GDP fractions. */
function deriveSectorWeights(
  sectors: Array<{ name?: string; percentage?: number; gdpContribution?: number }> | undefined,
  exportsGdpPct: number | null | undefined,
  importsGdpPct: number | null | undefined
): Record<string, number> {
  const weights: Record<string, number> = {};

  if (!sectors || sectors.length === 0) {
    // Fall back to hardcoded defaults
    for (const ch of TAX_CHANNELS) weights[ch.key] = ch.fallbackWeight;
    return weights;
  }

  // Sum total sector percentages for normalization
  const totalPct = sectors.reduce((sum, s) => sum + (s.percentage ?? s.gdpContribution ?? 0), 0);
  const norm = totalPct > 0 ? totalPct / 100 : 1;

  // Classify sectors into primary/secondary/tertiary for weighting
  let primaryPct = 0; // agriculture, mining, extraction
  let secondaryPct = 0; // manufacturing, construction, industry
  let tertiaryPct = 0; // services, finance, tech, retail

  for (const s of sectors) {
    const pct = (s.percentage ?? s.gdpContribution ?? 0) / norm;
    const name = (s.name ?? "").toLowerCase();
    if (
      name.includes("agri") ||
      name.includes("mining") ||
      name.includes("extract") ||
      name.includes("fish") ||
      name.includes("forestry") ||
      name.includes("primary")
    ) {
      primaryPct += pct;
    } else if (
      name.includes("manufactur") ||
      name.includes("construct") ||
      name.includes("industr") ||
      name.includes("secondary") ||
      name.includes("energy") ||
      name.includes("utilit")
    ) {
      secondaryPct += pct;
    } else {
      tertiaryPct += pct;
    }
  }

  // Ensure they sum to 100
  const sectorTotal = primaryPct + secondaryPct + tertiaryPct;
  if (sectorTotal > 0) {
    primaryPct = (primaryPct / sectorTotal) * 100;
    secondaryPct = (secondaryPct / sectorTotal) * 100;
    tertiaryPct = (tertiaryPct / sectorTotal) * 100;
  } else {
    primaryPct = 10;
    secondaryPct = 30;
    tertiaryPct = 60;
  }

  // Corporate tax revenue correlates with corporate profit share (secondary + tertiary heavy)
  weights.corporate = (secondaryPct * 0.15 + tertiaryPct * 0.12) / 100;

  // Income tax base is workforce in services + industry (tertiary-heavy economies have higher income tax yield)
  weights.income = (tertiaryPct * 0.25 + secondaryPct * 0.15 + primaryPct * 0.05) / 100;

  // VAT tracks consumption (higher in service-heavy economies)
  weights.vat = (tertiaryPct * 0.2 + secondaryPct * 0.12 + primaryPct * 0.05) / 100;

  // Tariff rate ties to trade openness
  const tradeOpenness = ((exportsGdpPct ?? 30) + (importsGdpPct ?? 30)) / 200; // 0-1 scale
  weights.tariff = Math.max(0.02, tradeOpenness * 0.1);

  // Wealth tax (small, tied to financial sector size in tertiary)
  weights.wealth = Math.max(0.01, (tertiaryPct * 0.05) / 100);

  // Capital gains (financial markets, tertiary-heavy)
  weights.capGains = Math.max(0.02, (tertiaryPct * 0.1) / 100);

  return weights;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FiscalPolicyConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const { country } = useCountryData();

  // Fetch economy config (includes fiscalSystem, economicProfile, etc.)
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const fiscal = (econConfig as any)?.fiscalSystem;
  const profile = (econConfig as any)?.economicProfile;
  const gdpBase = country?.currentTotalGdp ?? 100_000_000_000;
  const taxEfficiency = fiscal?.taxEfficiency ?? 0.85;

  // ---------------------------------------------------------------------------
  // Slider state — initialized from DB, persisted on commit
  // ---------------------------------------------------------------------------

  const [rates, setRates] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const ch of TAX_CHANNELS) init[ch.key] = ch.defaultRate;
    return init;
  });

  // Sync from DB data once it arrives
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!fiscal || hasInitialized.current) return;
    hasInitialized.current = true;

    setRates({
      corporate: parseRateFromJson(fiscal.corporateTaxRates, 21),
      income: parseRateFromJson(fiscal.personalIncomeTaxRates, 24),
      vat: fiscal.salesTaxRate ?? 15,
      tariff: parseRateFromJson(fiscal.exciseTaxRates, 4.5),
      wealth: fiscal.wealthTaxRate ?? 1.5,
      capGains: parseRateFromJson(fiscal.exciseTaxRates, 15), // stored alongside excise
    });
  }, [fiscal]);

  // ---------------------------------------------------------------------------
  // Sector-derived revenue weights
  // ---------------------------------------------------------------------------

  const sectorWeights = useMemo(
    () =>
      deriveSectorWeights(
        econConfig?.sectors as any,
        profile?.exportsGDPPercent ?? (econConfig as any)?.economicProfile?.exportsGDPPercent,
        profile?.importsGDPPercent ?? (econConfig as any)?.economicProfile?.importsGDPPercent
      ),
    [econConfig?.sectors, profile?.exportsGDPPercent, profile?.importsGDPPercent]
  );

  // ---------------------------------------------------------------------------
  // Revenue yield calculations
  // ---------------------------------------------------------------------------

  const yields = useMemo(() => {
    const result: Record<string, number> = {};
    let total = 0;
    for (const ch of TAX_CHANNELS) {
      const rate = rates[ch.key] ?? ch.defaultRate;
      const weight = sectorWeights[ch.key] ?? ch.fallbackWeight;
      const yieldVal = gdpBase * (rate / 100) * weight * taxEfficiency;
      result[ch.key] = yieldVal;
      total += yieldVal;
    }
    result._total = total;
    return result;
  }, [rates, gdpBase, taxEfficiency, sectorWeights]);

  // ---------------------------------------------------------------------------
  // Backend persistence (debounced)
  // ---------------------------------------------------------------------------

  const updateMutation = api.countries.update.useMutation({
    onError: (err: any) => {
      notify.error(`Failed to save tax rates: ${err?.message ?? "Unknown error"}`);
    },
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistRates = useCallback(
    (newRates: Record<string, number>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateMutation.mutate({
          id: countryId,
          fiscalSystem: {
            corporateTaxRates: JSON.stringify({ corporateRate: newRates.corporate ?? 21 }),
            personalIncomeTaxRates: JSON.stringify({ incomeRate: newRates.income ?? 24 }),
            salesTaxRate: newRates.vat ?? 15,
            exciseTaxRates: JSON.stringify({
              tariffRate: newRates.tariff ?? 4.5,
              capitalGainsRate: newRates.capGains ?? 15,
            }),
            wealthTaxRate: newRates.wealth ?? 1.5,
            taxEfficiency: fiscal?.taxEfficiency ?? 0.85,
          },
        } as any);
      }, 800);
    },
    [countryId, taxEfficiency, updateMutation, fiscal]
  );

  // Slider change handler
  const handleRateChange = useCallback((key: string, value: number) => {
    setRates((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
  }, []);

  // Slider commit handler (fires on drag end)
  const handleRateCommit = useCallback(
    (key: string, value: number) => {
      const newRates = { ...rates, [key]: value };
      setRates(newRates);
      persistRates(newRates);
    },
    [rates, persistRates]
  );

  // ---------------------------------------------------------------------------
  // Insights calculations
  // ---------------------------------------------------------------------------

  const effectiveTaxBurden = useMemo(() => {
    const totalYield = yields._total ?? 0;
    return gdpBase > 0 ? (totalYield / gdpBase) * 100 : 0;
  }, [yields, gdpBase]);

  // Laffer curve position — simple heuristic: optimal is ~25-35% effective rate
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

  // Revenue composition percentages
  const revenueComposition = useMemo(() => {
    const total = yields._total || 1;
    return TAX_CHANNELS.map((ch) => ({
      key: ch.key,
      accent: ch.accent,
      pct: ((yields[ch.key] ?? 0) / total) * 100,
    }));
  }, [yields]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ── Section 1: Tax Rate Control Grid ── */}
      <FacetCard depth={1} className="bg-card/30 space-y-4 p-4 backdrop-blur-md">
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-emerald-400" />
            <h4 className="text-foreground text-sm font-bold">National Tax Rate Controls</h4>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Total Revenue:
            </span>
            <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-sm font-black tracking-tight text-emerald-400 shadow-md shadow-emerald-500/10 sm:text-base">
              <CurrencyFlow value={yields._total ?? 0} className="font-black text-emerald-400" />
              <span className="ml-1 text-xs font-bold text-emerald-400/70">/ yr</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TAX_CHANNELS.map((ch) => (
            <TaxRateCard
              key={ch.key}
              channel={ch}
              rate={rates[ch.key] ?? ch.defaultRate}
              yieldValue={yields[ch.key] ?? 0}
              totalYield={yields._total ?? 1}
              onChange={(v) => handleRateChange(ch.key, v)}
              onCommit={(v) => handleRateCommit(ch.key, v)}
            />
          ))}
        </div>
      </FacetCard>

      {/* ── Section 2: Revenue Yield Matrix ── */}
      <FacetCard
        depth={1}
        className="bg-card/30 border-border/30 space-y-3 border p-4 shadow-lg backdrop-blur-xl"
      >
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 shrink-0 text-emerald-400" />
            <h4 className="text-foreground text-xs font-extrabold">Tax Revenue Projections</h4>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 md:grid-cols-6">
          {TAX_CHANNELS.map((ch) => (
            <div
              key={ch.key}
              className={cn(
                "border-border/20 bg-muted/15 space-y-1 rounded-xl border p-2.5 backdrop-blur-md",
                ACCENT_BORDER[ch.accent] ?? "border-border/20"
              )}
            >
              <p className="text-muted-foreground text-[10px] font-bold uppercase">
                {ch.shortLabel} Yield
              </p>
              <p className={cn("font-mono text-base font-black", ch.accentClass)}>
                <CurrencyFlow value={yields[ch.key] ?? 0} decimalPlaces={2} />
              </p>
              <p className="text-muted-foreground font-mono text-[10px]">
                <PercentageFlow
                  value={((yields[ch.key] ?? 0) / (yields._total || 1)) * 100}
                  decimalPlaces={1}
                  className="text-muted-foreground"
                />{" "}
                of total
              </p>
            </div>
          ))}
        </div>
      </FacetCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported Component: Fiscal Policy Insights (for right sidebar)
// ---------------------------------------------------------------------------

export function FiscalPolicyInsights({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const fiscal = (econConfig as any)?.fiscalSystem;
  const profile = (econConfig as any)?.economicProfile;
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
        econConfig?.sectors as any,
        profile?.exportsGDPPercent ?? (econConfig as any)?.economicProfile?.exportsGDPPercent,
        profile?.importsGDPPercent ?? (econConfig as any)?.economicProfile?.importsGDPPercent
      ),
    [econConfig?.sectors, profile?.exportsGDPPercent, profile?.importsGDPPercent]
  );

  const yields = useMemo(() => {
    const result: Record<string, number> = {};
    let total = 0;
    for (const ch of TAX_CHANNELS) {
      const rate = (rates as any)[ch.key] ?? ch.defaultRate;
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
            <span className="font-mono text-base font-black text-amber-400">
              <PercentageFlow value={effectiveTaxBurden} decimalPlaces={1} />
            </span>
          </div>

          <div className="bg-muted/30 border-border/20 relative h-2.5 overflow-hidden rounded-full border">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min((effectiveTaxBurden / 50) * 100, 100)}%`,
                background:
                  lafferPosition === "optimal"
                    ? "linear-gradient(90deg, #10b981, #34d399)"
                    : lafferPosition === "below-optimal"
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)",
              }}
            />
            <div
              className="absolute inset-y-0 border-r border-l border-emerald-400/40 bg-emerald-400/10"
              style={{ left: "30%", width: "20%" }}
            />
          </div>
          <div className="text-muted-foreground/70 flex justify-between font-mono text-[10px]">
            <span>0%</span>
            <span className="font-extrabold text-emerald-400">Optimal Zone (15-35%)</span>
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
            <h4 className="text-foreground text-xs font-extrabold tracking-wider uppercase">
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
                  <span className="text-muted-foreground truncate text-[11px] font-semibold">
                    {ch.shortLabel}
                  </span>
                </div>
                <span className={cn("shrink-0 font-mono text-[11px] font-black", ch.accentClass)}>
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
            <h4 className="text-foreground text-xs font-extrabold tracking-wider uppercase">
              Fiscal Health & Telemetry
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <p className="text-muted-foreground text-[9px] font-bold uppercase">Efficiency</p>
            <p className="mt-0.5 font-mono text-base font-black text-emerald-400">
              <PercentageFlow value={collectionEfficiency} decimalPlaces={0} />
            </p>
          </div>
          <div className="border-border/20 bg-muted/15 rounded-xl border p-2 text-center">
            <p className="text-muted-foreground text-[9px] font-bold uppercase">Budget Δ</p>
            <p
              className={cn(
                "mt-0.5 font-mono text-base font-black",
                budgetImpact >= 0 ? "text-emerald-400" : "text-rose-400"
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
            <p className="text-muted-foreground text-[9px] font-bold uppercase">Burden</p>
            <p
              className={cn(
                "mt-1 font-mono text-xs font-black",
                lafferPosition === "optimal"
                  ? "text-emerald-400"
                  : lafferPosition === "below-optimal"
                    ? "text-amber-400"
                    : "text-rose-400"
              )}
            >
              {lafferPosition === "optimal"
                ? "Optimal"
                : lafferPosition === "below-optimal"
                  ? "Low"
                  : "High"}
            </p>
          </div>
        </div>
      </FacetCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Tax Rate Slider Card
// ---------------------------------------------------------------------------

function TaxRateCard({
  channel,
  rate,
  yieldValue,
  totalYield,
  onChange,
  onCommit,
}: {
  channel: TaxChannel;
  rate: number;
  yieldValue: number;
  totalYield: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [isLocked, setIsLocked] = useState(true);
  const contributionPct = totalYield > 0 ? (yieldValue / totalYield) * 100 : 0;

  const handleToggleLock = () => {
    if (!isLocked) {
      // Locking saves the value to backend
      onCommit(rate);
      setIsLocked(true);
    } else {
      // Unlock for editing
      setIsLocked(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-muted/10 relative space-y-2.5 rounded-xl border p-3 shadow-sm backdrop-blur-md transition-all duration-200",
        isLocked
          ? (ACCENT_BORDER[channel.accent] ?? "border-border/30")
          : "border-amber-500/50 bg-amber-500/[0.03] ring-1 ring-amber-500/30"
      )}
    >
      {/* Header: lock toggle + label + rate */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleLock}
            title={
              isLocked
                ? "Locked (Saved) — click to edit rate"
                : "Editing — click to save & lock rate"
            }
            className={cn(
              "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border transition-all duration-200 select-none active:scale-95",
              isLocked
                ? "border-border/40 bg-muted/30 text-muted-foreground/70 hover:border-border/70 hover:text-foreground"
                : "animate-pulse border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-xs shadow-amber-500/30"
            )}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <span className="text-muted-foreground text-[11px] font-bold">{channel.label}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isLocked && (
            <span className="animate-pulse text-[9px] font-bold tracking-wider text-amber-400 uppercase">
              Editing
            </span>
          )}
          <span className={cn("font-mono text-base font-black tabular-nums", channel.accentClass)}>
            <PercentageFlow value={rate} decimalPlaces={1} />
          </span>
        </div>
      </div>

      {/* Radix Slider */}
      <div
        className={cn(
          "relative transition-opacity duration-200",
          isLocked && "pointer-events-none opacity-50"
        )}
      >
        <Slider
          min={channel.min}
          max={channel.max}
          step={channel.step}
          value={[rate]}
          disabled={isLocked}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          onValueCommit={([v]) => v !== undefined && onCommit(v)}
          className={cn(
            "w-full",
            SLIDER_RANGE_COLOR[channel.accent],
            SLIDER_THUMB_COLOR[channel.accent]
          )}
        />
      </div>

      {/* Internal Weight Progress Bar */}
      <div className="bg-muted/20 h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full transition-all duration-500 ease-out", ACCENT_BG[channel.accent])}
          style={{ width: `${Math.min(contributionPct, 100)}%` }}
        />
      </div>

      {/* Yield preview */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">Yield Contribution</span>
        <span className={cn("font-mono font-bold", channel.accentClass)}>
          <CurrencyFlow value={yieldValue} decimalPlaces={1} className={channel.accentClass} />
        </span>
      </div>
    </div>
  );
}

// Memoize the card to avoid unnecessary re-renders when sibling sliders move
const _MemoTaxRateCard = React.memo(TaxRateCard);
