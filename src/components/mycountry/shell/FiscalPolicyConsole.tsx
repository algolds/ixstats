"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Percentage as Percent } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { CurrencyFlow } from "~/components/ui/number-flow";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  TAX_CHANNELS,
  TaxRateCard,
  TaxRevenueProjections,
  FiscalPolicyInsights,
  parseRateFromJson,
  deriveSectorWeights,
  type TaxChannel,
} from "./fiscal";

export { TAX_CHANNELS, FiscalPolicyInsights };
export type { TaxChannel };

interface FiscalSystemData {
  corporateTaxRates?: string | null;
  personalIncomeTaxRates?: string | null;
  salesTaxRate?: number | null;
  exciseTaxRates?: string | null;
  wealthTaxRate?: number | null;
  taxEfficiency?: number | null;
}

interface EconomicProfileData {
  exportsGDPPercent?: number | null;
  importsGDPPercent?: number | null;
}

interface SectorItem {
  name?: string;
  percentage?: number;
  gdpContribution?: number;
}

interface EconomyConfigurationPayload {
  fiscalSystem?: FiscalSystemData | null;
  economicProfile?: EconomicProfileData | null;
  sectors?: SectorItem[] | null;
}

export function FiscalPolicyConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const { country } = useCountryData();

  // Fetch economy config (includes fiscalSystem, economicProfile, etc.)
  const { data: rawEconConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const econConfig = rawEconConfig as EconomyConfigurationPayload | undefined;
  const fiscal = econConfig?.fiscalSystem;
  const profile = econConfig?.economicProfile;
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
      capGains: parseRateFromJson(fiscal.exciseTaxRates, 15),
    });
  }, [fiscal]);

  // ---------------------------------------------------------------------------
  // Sector-derived revenue weights
  // ---------------------------------------------------------------------------

  const sectorWeights = useMemo(
    () =>
      deriveSectorWeights(
        econConfig?.sectors ?? undefined,
        profile?.exportsGDPPercent,
        profile?.importsGDPPercent
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

  const updateMutation = api.economics.updateFiscalSystem.useMutation({
    onError: (err: { message?: string }) => {
      notify.error(`Failed to save tax rates: ${err?.message ?? "Unknown error"}`);
    },
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistRates = useCallback(
    (newRates: Record<string, number>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateMutation.mutate({
          countryId,
          corporateTaxRates: JSON.stringify({ corporateRate: newRates.corporate ?? 21 }),
          personalIncomeTaxRates: JSON.stringify({ incomeRate: newRates.income ?? 24 }),
          salesTaxRate: newRates.vat ?? 15,
          exciseTaxRates: JSON.stringify({
            tariffRate: newRates.tariff ?? 4.5,
            capitalGainsRate: newRates.capGains ?? 15,
          }),
          wealthTaxRate: newRates.wealth ?? 1.5,
          taxEfficiency: fiscal?.taxEfficiency ?? 0.85,
        });
      }, 800);
    },
    [countryId, updateMutation, fiscal]
  );

  // Slider change handler
  const handleRateChange = useCallback((key: string, value: number) => {
    setRates((prev) => ({ ...prev, [key]: value }));
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
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Total Revenue:
            </span>
            <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-sm font-bold tracking-tight text-emerald-400 tabular-nums shadow-md shadow-emerald-500/10 sm:text-base">
              <CurrencyFlow value={yields._total ?? 0} className="font-bold text-emerald-400" />
              <span className="ml-1 text-xs font-semibold text-emerald-400/70">/ yr</span>
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
      <TaxRevenueProjections yields={yields} />
    </div>
  );
}
