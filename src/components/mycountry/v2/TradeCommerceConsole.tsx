"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Globe2,
  Ship,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Percent,
  Lock,
  Unlock,
  Building2,
  Handshake,
  FileCheck,
  Scale,
  Activity,
  ArrowUpRight,
  Plus,
  Trash2,
  SlidersHorizontal,
  X,
  Check,
  RotateCcw,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { Slider } from "~/components/ui/slider";
import { CurrencyFlow, PercentageFlow } from "~/components/ui/number-flow";
import { useCountryData } from "../primitives";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useNotify } from "~/hooks/useNotify";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type AccentColor = "emerald" | "cyan" | "amber" | "purple" | "rose" | "teal";

export interface CustomSector {
  id: string;
  key: string;
  label: string;
  shortLabel: string;
  defaultTariff: number;
  min: number;
  max: number;
  step: number;
  accent: AccentColor;
  defaultShare: number; // % of total exports
}

const DEFAULT_SECTORS: CustomSector[] = [
  {
    id: "sec-hitech",
    key: "hitech",
    label: "High-Tech & Semiconductors",
    shortLabel: "High-Tech",
    defaultTariff: 2.5,
    min: 0,
    max: 30,
    step: 0.5,
    accent: "emerald",
    defaultShare: 35.4,
  },
  {
    id: "sec-machinery",
    key: "machinery",
    label: "Industrial Machinery & Capital Goods",
    shortLabel: "Machinery",
    defaultTariff: 4.0,
    min: 0,
    max: 35,
    step: 0.5,
    accent: "cyan",
    defaultShare: 28.2,
  },
  {
    id: "sec-energy",
    key: "energy",
    label: "Energy & Mineral Resources",
    shortLabel: "Energy",
    defaultTariff: 3.0,
    min: 0,
    max: 40,
    step: 0.5,
    accent: "amber",
    defaultShare: 21.8,
  },
  {
    id: "sec-agri",
    key: "agriculture",
    label: "Agricultural & Food Goods",
    shortLabel: "Agri-Food",
    defaultTariff: 6.5,
    min: 0,
    max: 50,
    step: 0.5,
    accent: "purple",
    defaultShare: 14.6,
  },
];

const ACCENT_BORDER: Record<AccentColor, string> = {
  emerald: "border-emerald-500/30",
  cyan: "border-cyan-500/30",
  amber: "border-amber-500/30",
  purple: "border-purple-500/30",
  rose: "border-rose-500/30",
  teal: "border-teal-500/30",
};

const ACCENT_BG: Record<AccentColor, string> = {
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  rose: "bg-rose-500",
  teal: "bg-teal-500",
};

const ACCENT_TEXT: Record<AccentColor, string> = {
  emerald: "text-emerald-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  purple: "text-purple-400",
  rose: "text-rose-400",
  teal: "text-teal-400",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

function parseSectorBreakdownJson(raw: string | null | undefined): CustomSector[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const accents: AccentColor[] = ["emerald", "cyan", "amber", "purple", "rose", "teal"];
      return parsed.map((item: any, idx: number) => {
        const label = item.name ?? item.label ?? `Sector ${idx + 1}`;
        const shortLabel = item.shortName ?? item.shortLabel ?? label.slice(0, 12);
        const defaultShare = item.percentage ?? item.gdpContribution ?? item.defaultShare ?? 25;
        const defaultTariff = item.tariffRate ?? item.defaultTariff ?? 4.0;
        const accent = item.accent ?? accents[idx % accents.length];

        return {
          id: item.id ?? `custom-sec-${idx}-${Date.now()}`,
          key: item.key ?? label.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          label,
          shortLabel,
          defaultTariff: Number(defaultTariff) || 4.0,
          min: 0,
          max: 50,
          step: 0.5,
          accent,
          defaultShare: Number(defaultShare) || 10,
        };
      });
    }
  } catch {
    // not valid JSON
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main Component: TradeCommerceConsole
// ---------------------------------------------------------------------------

export function TradeCommerceConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const { country } = useCountryData();
  const utils = api.useUtils();

  const [isManageOpen, setIsManageOpen] = useState(false);

  // Fetch economy configuration, diplomatic relationships, and country select list
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );

  const { data: diplomaticRelations } = api.diplomacy.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );

  const { data: selectCountries } = api.countries.getSelectList.useQuery(
    { limit: 12 },
    { staleTime: 60_000 },
  );

  const profile = econConfig?.economicProfile;
  const fiscal = econConfig?.fiscalSystem;
  const gdpBase = country?.currentTotalGdp ?? 100_000_000_000;

  // Derive Exports, Imports, and Openness
  const exportsPct = profile?.exportsGDPPercent ?? 25.5;
  const importsPct = profile?.importsGDPPercent ?? 23.1;
  const totalExports = (gdpBase * exportsPct) / 100;
  const totalImports = (gdpBase * importsPct) / 100;
  const annualTradeVolume = totalExports + totalImports;
  const tradeBalance = totalExports - totalImports;

  // ---------------------------------------------------------------------------
  // Custom Sectors State (Synced from DB, configurable inline)
  // ---------------------------------------------------------------------------

  const [sectors, setSectors] = useState<CustomSector[]>(DEFAULT_SECTORS);

  useEffect(() => {
    const parsed = parseSectorBreakdownJson(profile?.sectorBreakdown);
    if (parsed && parsed.length > 0) {
      setSectors(parsed);
    }
  }, [profile?.sectorBreakdown]);

  // ---------------------------------------------------------------------------
  // Sector Tariff State & Persistence
  // ---------------------------------------------------------------------------

  const [tariffs, setTariffs] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const sec of DEFAULT_SECTORS) init[sec.key] = sec.defaultTariff;
    return init;
  });

  // Sync tariff rates from DB if saved
  const hasInitTariffs = useRef(false);
  useEffect(() => {
    if (!fiscal?.exciseTaxRates || hasInitTariffs.current) return;
    hasInitTariffs.current = true;
    try {
      const parsed = JSON.parse(fiscal.exciseTaxRates);
      if (parsed?.sectorTariffs) {
        setTariffs((prev) => ({ ...prev, ...parsed.sectorTariffs }));
      }
    } catch {
      // not JSON string
    }
  }, [fiscal?.exciseTaxRates]);

  const updateCountryMutation = api.countries.management.update.useMutation({
    onError: (err) => {
      notify.error(`Failed to save tariff rates: ${err.message}`);
    },
  });

  const updateProfileMutation = api.economics.updateEconomicProfile.useMutation({
    onSuccess: () => {
      notify.success("Economic sectors updated & saved!");
      void utils.economics.getEconomyConfiguration.invalidate({ countryId });
    },
    onError: (err) => {
      notify.error(`Failed to update sectors: ${err.message}`);
    },
  });

  const saveTariffsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistTariffs = useCallback(
    (newTariffs: Record<string, number>) => {
      if (saveTariffsTimeoutRef.current) clearTimeout(saveTariffsTimeoutRef.current);
      saveTariffsTimeoutRef.current = setTimeout(() => {
        const weighted = sectors.reduce((sum, sec) => {
          const t = newTariffs[sec.key] ?? sec.defaultTariff;
          return sum + t * (sec.defaultShare / 100);
        }, 0);

        updateCountryMutation.mutate({
          countryId,
          data: {
            fiscalSystem: {
              salesTaxRate: fiscal?.salesTaxRate ?? 15,
              exciseTaxRates: JSON.stringify({
                weightedTariff: weighted,
                sectorTariffs: newTariffs,
              }),
            },
          },
        });
      }, 800);
    },
    [countryId, fiscal?.salesTaxRate, sectors, updateCountryMutation],
  );

  const handleTariffChange = useCallback((key: string, value: number) => {
    setTariffs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTariffCommit = useCallback(
    (key: string, value: number) => {
      const next = { ...tariffs, [key]: value };
      setTariffs(next);
      persistTariffs(next);
    },
    [tariffs, persistTariffs],
  );

  // Weighted average tariff rate across active custom commodity sectors
  const weightedTariff = useMemo(() => {
    const totalShare = sectors.reduce((sum, s) => sum + s.defaultShare, 0) || 100;
    return sectors.reduce((sum, sec) => {
      const rate = tariffs[sec.key] ?? sec.defaultTariff;
      return sum + rate * (sec.defaultShare / totalShare);
    }, 0);
  }, [tariffs, sectors]);

  // Projected annual tariff/customs revenue yield
  const estimatedCustomsYield = useMemo(() => {
    const taxEfficiency = fiscal?.taxEfficiency ?? 0.85;
    return totalImports * (weightedTariff / 100) * taxEfficiency;
  }, [totalImports, weightedTariff, fiscal?.taxEfficiency]);

  // ---------------------------------------------------------------------------
  // Save Custom Sectors Handler
  // ---------------------------------------------------------------------------

  const handleSaveSectors = (newSectors: CustomSector[]) => {
    setSectors(newSectors);
    setIsManageOpen(false);

    // Format for DB profile.sectorBreakdown
    const payload = newSectors.map((s) => ({
      id: s.id,
      key: s.key,
      name: s.label,
      shortName: s.shortLabel,
      percentage: s.defaultShare,
      tariffRate: tariffs[s.key] ?? s.defaultTariff,
      accent: s.accent,
    }));

    updateProfileMutation.mutate({
      countryId,
      sectorBreakdown: JSON.stringify(payload),
    });
  };

  // ---------------------------------------------------------------------------
  // Diplomatic Trade Partners Processing
  // ---------------------------------------------------------------------------

  const tradePartners = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      flagUrl: string | null;
      relationship: string;
      strength: number;
      volume: number;
      balance: number;
    }> = [];

    if (diplomaticRelations && diplomaticRelations.length > 0) {
      diplomaticRelations.forEach((rel) => {
        const name = rel.targetCountryName || rel.targetCountry;
        const flagUrl = rel.targetCountryFlag || rel.flagUrl;
        const vol = rel.tradeVolume > 0 ? rel.tradeVolume : annualTradeVolume * (rel.strength / 350);
        const relMult =
          rel.relationship === "ALLIED"
            ? 0.2
            : rel.relationship === "FRIENDLY"
              ? 0.1
              : rel.relationship === "NEUTRAL"
                ? 0.02
                : -0.08;

        list.push({
          id: rel.id,
          name,
          flagUrl: flagUrl ?? null,
          relationship: rel.relationship ?? "Friendly",
          strength: rel.strength ?? 75,
          volume: vol,
          balance: vol * relMult,
        });
      });
    }

    if (list.length < 4 && selectCountries && selectCountries.length > 0) {
      const otherCountries = selectCountries.filter((c) => c.id !== countryId);
      const needed = 4 - list.length;

      otherCountries.slice(0, needed).forEach((c, idx) => {
        const baseShare = 0.22 - idx * 0.04;
        const vol = annualTradeVolume * baseShare;
        list.push({
          id: `partner-select-${c.id}`,
          name: c.name,
          flagUrl: c.flag ?? null,
          relationship: c.economicTier ? `${c.economicTier} Partner` : "Bilateral Partner",
          strength: 80 - idx * 5,
          volume: vol,
          balance: vol * (0.05 + idx * 0.02),
        });
      });
    }

    return list;
  }, [diplomaticRelations, selectCountries, countryId, annualTradeVolume]);

  return (
    <div className="space-y-4">
      {/* ── Section 1: Customs & Sector Tariff Controls Grid ── */}
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-foreground">Customs & Sector Tariff Rate Controls</h4>
          </div>

          <div className="flex items-center gap-3">
            {/* Manage Sectors Button */}
            <button
              type="button"
              onClick={() => setIsManageOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Manage Sectors & Commodities</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Est. Customs Yield:
              </span>
              <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-sm sm:text-base font-black font-mono text-cyan-400 shadow-md shadow-cyan-500/10 tracking-tight">
                <CurrencyFlow value={estimatedCustomsYield} className="text-cyan-400 font-black" />
                <span className="text-cyan-400/70 text-xs font-bold ml-1">/ yr</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Sector Tariff Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sectors.map((sec) => (
            <TariffRateCard
              key={sec.key}
              sector={sec}
              tariff={tariffs[sec.key] ?? sec.defaultTariff}
              totalImports={totalImports}
              onChange={(v) => handleTariffChange(sec.key, v)}
              onCommit={(v) => handleTariffCommit(sec.key, v)}
            />
          ))}
        </div>
      </FacetCard>

      {/* ── Section 2: Bilateral Trade Partner Matrix ── */}
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-xl border border-border/30 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-border/20 pb-2">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-emerald-400 shrink-0" />
            <h4 className="text-xs font-extrabold text-foreground tracking-wider uppercase">
              Bilateral Trade Partner Matrix
            </h4>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 font-mono">
            {tradePartners.length} Active Partners
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tradePartners.slice(0, 3).map((partner) => (
            <div
              key={partner.id}
              className="rounded-xl border border-border/30 bg-muted/15 p-3 space-y-2 backdrop-blur-md hover:border-border/60 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <UnifiedCountryFlag
                    flagUrl={partner.flagUrl}
                    countryName={partner.name}
                    className="h-4 w-6 rounded-xs object-cover border border-white/20 shrink-0"
                  />
                  <p className="text-xs font-bold text-foreground truncate">{partner.name}</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                  {partner.strength}% Trust
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/10">
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Annual Volume</span>
                <span className="font-mono font-black text-foreground">
                  <CurrencyFlow value={partner.volume} decimalPlaces={1} />
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Bilateral Balance</span>
                <span
                  className={cn(
                    "font-mono font-bold text-[11px]",
                    partner.balance >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {partner.balance >= 0 ? "+" : "-"}
                  <CurrencyFlow value={Math.abs(partner.balance)} decimalPlaces={1} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </FacetCard>

      {/* ── Section 3: Dynamic Commodity Export Breakdown & Customs Status ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-xl border border-border/30 shadow-lg space-y-3">
          <div className="border-b border-border/20 pb-2 flex justify-between items-center">
            <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
              Top Export Commodities ({sectors.length} Sectors)
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground font-semibold">
              Total Exports: ${formatCompact(totalExports)}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {sectors.map((sec) => {
              const exportVal = totalExports * (sec.defaultShare / 100);
              const accentCls = ACCENT_TEXT[sec.accent] ?? "text-emerald-400";
              return (
                <div
                  key={sec.key}
                  className="flex items-center justify-between rounded-lg bg-muted/15 border border-border/20 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", ACCENT_BG[sec.accent])} />
                    <div>
                      <p className="font-bold text-foreground">{sec.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Tariff Rate: {tariffs[sec.key] ?? sec.defaultTariff}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("font-mono font-black text-sm", accentCls)}>
                      <PercentageFlow value={sec.defaultShare} decimalPlaces={1} />
                    </span>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      (<CurrencyFlow value={exportVal} decimalPlaces={1} />)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FacetCard>

        <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-xl border border-border/30 shadow-lg space-y-3">
          <div className="border-b border-border/20 pb-2 flex justify-between items-center">
            <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
              Customs Controls & Trade Blocs
            </h4>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Active Commerce
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-muted/15 border border-border/20 p-2.5">
              <span className="font-semibold text-muted-foreground">Weighted Tariff Rate</span>
              <span className="font-mono font-black text-purple-400">
                <PercentageFlow value={weightedTariff} decimalPlaces={2} />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/15 border border-border/20 p-2.5">
              <span className="font-semibold text-muted-foreground">Most-Favored-Nation (MFN) Status</span>
              <span className="font-bold text-emerald-400">Active Global MFN</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/15 border border-border/20 p-2.5">
              <span className="font-semibold text-muted-foreground">Customs Clearance Time</span>
              <span className="font-mono font-bold text-cyan-400">1.4 Days Avg</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/15 border border-border/20 p-2.5">
              <span className="font-semibold text-muted-foreground">Regional Trade Deals</span>
              <span className="font-mono font-bold text-amber-400">3 Bilateral Blocs</span>
            </div>
          </div>
        </FacetCard>
      </div>

      {/* ── Manage Sectors & Commodities Modal ── */}
      {isManageOpen && (
        <ManageSectorsModal
          initialSectors={sectors}
          onClose={() => setIsManageOpen(false)}
          onSave={handleSaveSectors}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported Component: TradeCommerceInsights (for right sidebar)
// ---------------------------------------------------------------------------

export function TradeCommerceInsights({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 },
  );

  const profile = econConfig?.economicProfile;
  const gdpBase = country?.currentTotalGdp ?? 100_000_000_000;

  const exportsPct = profile?.exportsGDPPercent ?? 25.5;
  const importsPct = profile?.importsGDPPercent ?? 23.1;
  const totalExports = (gdpBase * exportsPct) / 100;
  const totalImports = (gdpBase * importsPct) / 100;
  const annualTradeVolume = totalExports + totalImports;
  const tradeBalance = totalExports - totalImports;
  const opennessIndex = exportsPct + importsPct;

  return (
    <div className="space-y-4">
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-xl border border-border/30 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-border/20 pb-2">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <h4 className="text-xs font-extrabold text-foreground tracking-wider uppercase">
              Trade Openness & Balance
            </h4>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-extrabold font-mono",
              tradeBalance >= 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-400",
            )}
          >
            {tradeBalance >= 0 ? "Surplus" : "Deficit"}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Trade Openness Index</span>
            <span className="font-mono text-base font-black text-cyan-400">
              <PercentageFlow value={opennessIndex} decimalPlaces={1} />
            </span>
          </div>

          {/* Dual Split Bar: Exports vs Imports */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/20 border border-border/20">
            <div
              className="bg-emerald-500 transition-all duration-500 ease-out h-full"
              style={{ width: `${Math.min((totalExports / (annualTradeVolume || 1)) * 100, 100)}%` }}
              title={`Exports: ${((totalExports / (annualTradeVolume || 1)) * 100).toFixed(1)}%`}
            />
            <div
              className="bg-cyan-500 transition-all duration-500 ease-out h-full"
              style={{ width: `${Math.min((totalImports / (annualTradeVolume || 1)) * 100, 100)}%` }}
              title={`Imports: ${((totalImports / (annualTradeVolume || 1)) * 100).toFixed(1)}%`}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-400 font-bold">
                Exports: <CurrencyFlow value={totalExports} decimalPlaces={1} />
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />
              <span className="text-cyan-400 font-bold">
                Imports: <CurrencyFlow value={totalImports} decimalPlaces={1} />
              </span>
            </div>
          </div>
        </div>
      </FacetCard>

      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-xl border border-border/30 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-border/20 pb-2">
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-amber-400 shrink-0" />
            <h4 className="text-xs font-extrabold text-foreground tracking-wider uppercase">
              Commercial Telemetry
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/20 bg-muted/15 p-2 text-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Trade Volume</p>
            <p className="text-sm font-black font-mono text-foreground mt-0.5">
              <CurrencyFlow value={annualTradeVolume} decimalPlaces={1} />
            </p>
          </div>

          <div className="rounded-xl border border-border/20 bg-muted/15 p-2 text-center">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Net Balance</p>
            <p
              className={cn(
                "text-sm font-black font-mono mt-0.5",
                tradeBalance >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {tradeBalance >= 0 ? "+" : "-"}
              <CurrencyFlow value={Math.abs(tradeBalance)} decimalPlaces={1} />
            </p>
          </div>
        </div>
      </FacetCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Tariff Rate Slider Card (with Lock toggle)
// ---------------------------------------------------------------------------

function TariffRateCard({
  sector,
  tariff,
  totalImports,
  onChange,
  onCommit,
}: {
  sector: CustomSector;
  tariff: number;
  totalImports: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [isLocked, setIsLocked] = useState(true);

  const estimatedYield = totalImports * (sector.defaultShare / 100) * (tariff / 100);

  const handleToggleLock = () => {
    if (!isLocked) {
      onCommit(tariff);
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  };

  const accentCls = ACCENT_TEXT[sector.accent] ?? "text-cyan-400";
  const bgCls = ACCENT_BG[sector.accent] ?? "bg-cyan-500";
  const borderCls = ACCENT_BORDER[sector.accent] ?? "border-cyan-500/30";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-muted/10 p-3 space-y-2.5 backdrop-blur-md transition-all duration-200 shadow-sm",
        isLocked
          ? borderCls
          : "border-amber-500/50 bg-amber-500/[0.03] ring-1 ring-amber-500/30",
      )}
    >
      {/* Header: lock toggle + label + rate */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleToggleLock}
            title={isLocked ? "Locked (Saved) — click to edit tariff" : "Editing — click to save & lock tariff"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md border transition-all duration-200 cursor-pointer active:scale-95 select-none shrink-0",
              isLocked
                ? "border-border/40 bg-muted/30 text-muted-foreground/70 hover:border-border/70 hover:text-foreground"
                : "border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-xs shadow-amber-500/30 animate-pulse",
            )}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <span className="text-[11px] font-bold text-muted-foreground truncate">{sector.shortLabel}</span>
        </div>

        <span className={cn("text-base font-black font-mono tabular-nums shrink-0", accentCls)}>
          <PercentageFlow value={tariff} decimalPlaces={1} />
        </span>
      </div>

      {/* Radix Slider */}
      <div className={cn("relative transition-opacity duration-200", isLocked && "opacity-50 pointer-events-none")}>
        <Slider
          min={sector.min}
          max={sector.max}
          step={sector.step}
          value={[tariff]}
          disabled={isLocked}
          onValueChange={([v]) => v !== undefined && onChange(v)}
          onValueCommit={([v]) => v !== undefined && onCommit(v)}
          className={cn(
            "w-full",
            `[&_[data-slot=slider-range]]:${bgCls}`,
          )}
        />
      </div>

      {/* Yield preview */}
      <div className="flex items-center justify-between text-[10px] pt-0.5">
        <span className="text-muted-foreground font-medium">Customs Yield</span>
        <span className={cn("font-bold font-mono", accentCls)}>
          <CurrencyFlow value={estimatedYield} decimalPlaces={1} className={accentCls} />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Manage Sectors & Commodities Modal
// ---------------------------------------------------------------------------

function ManageSectorsModal({
  initialSectors,
  onClose,
  onSave,
}: {
  initialSectors: CustomSector[];
  onClose: () => void;
  onSave: (sectors: CustomSector[]) => void;
}) {
  const [items, setItems] = useState<CustomSector[]>(initialSectors);

  const totalShare = useMemo(() => {
    return items.reduce((sum, s) => sum + (Number(s.defaultShare) || 0), 0);
  }, [items]);

  const accentsList: AccentColor[] = ["emerald", "cyan", "amber", "purple", "rose", "teal"];

  const handleUpdate = (id: string, updates: Partial<CustomSector>) => {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleAdd = () => {
    const idx = items.length + 1;
    const newSec: CustomSector = {
      id: `custom-sec-${Date.now()}`,
      key: `custom-sector-${idx}`,
      label: `New Commodity Sector ${idx}`,
      shortLabel: `Sector ${idx}`,
      defaultTariff: 4.0,
      min: 0,
      max: 50,
      step: 0.5,
      accent: accentsList[(idx - 1) % accentsList.length],
      defaultShare: 10,
    };
    setItems((prev) => [...prev, newSec]);
  };

  const handleDelete = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const handleNormalize = () => {
    if (totalShare <= 0) return;
    setItems((prev) =>
      prev.map((s) => ({
        ...s,
        defaultShare: Math.round(((s.defaultShare / totalShare) * 100) * 10) / 10,
      })),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <FacetCard depth={2} className="w-full max-w-2xl bg-card/95 p-5 border border-border/40 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-extrabold text-foreground">Manage Economic Sectors & Commodities</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Share Total Banner */}
        <div className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 px-3.5 py-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-muted-foreground">Export Share Distribution:</span>
            <span
              className={cn(
                "font-mono font-black text-sm",
                Math.abs(totalShare - 100) < 0.5 ? "text-emerald-400" : "text-amber-400",
              )}
            >
              {totalShare.toFixed(1)}% / 100%
            </span>
          </div>
          <button
            type="button"
            onClick={handleNormalize}
            className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Balance to 100%</span>
          </button>
        </div>

        {/* Sector Edit List */}
        <div className="space-y-3 overflow-y-auto pr-1 flex-1 text-xs">
          {items.map((sec) => (
            <div
              key={sec.id}
              className="rounded-xl border border-border/30 bg-muted/15 p-3 space-y-2.5 backdrop-blur-md"
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-center">
                {/* Sector Name */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Sector Name</label>
                  <input
                    type="text"
                    value={sec.label}
                    onChange={(e) => handleUpdate(sec.id, { label: e.target.value, shortLabel: e.target.value.slice(0, 14) })}
                    className="w-full rounded-lg border border-border/30 bg-background/50 px-2.5 py-1.5 font-bold text-foreground focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Export Share % */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Export Share %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={0.5}
                    value={sec.defaultShare}
                    onChange={(e) => handleUpdate(sec.id, { defaultShare: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-border/30 bg-background/50 px-2.5 py-1.5 font-mono font-bold text-foreground focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Accent Color Picker */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Accent Color</label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {accentsList.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleUpdate(sec.id, { accent: c })}
                        className={cn(
                          "h-5 w-5 rounded-full border transition-all cursor-pointer",
                          ACCENT_BG[c],
                          sec.accent === c ? "border-white scale-110 shadow-sm" : "border-transparent opacity-60 hover:opacity-100",
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Delete Button */}
                <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleDelete(sec.id)}
                    disabled={items.length <= 1}
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/20 pt-3 shrink-0">
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>Add Custom Commodity Sector</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(items)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-1.5 text-xs font-bold text-cyan-400 hover:bg-cyan-500/30 transition-all cursor-pointer active:scale-95"
            >
              <Check className="h-4 w-4" />
              <span>Save & Apply to Country</span>
            </button>
          </div>
        </div>
      </FacetCard>
    </div>
  );
}
