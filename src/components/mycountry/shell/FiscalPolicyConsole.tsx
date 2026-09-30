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
  readSavedRates,
  fiscalUpdateForRate,
  computeTaxYields,
  deriveSectorWeights,
  type FiscalRateUpdate,
  type TaxChannel,
} from "./fiscal";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { economicRelationsOf, finiteOrNull } from "~/lib/economy/country-relations";

export { TAX_CHANNELS, FiscalPolicyInsights };
export type { TaxChannel };

/**
 * Fiscal Policy tab — national tax rate sliders.
 *
 * Saved rates come from the country record (`getByIdWithEconomicData` includes `fiscalSystem`).
 * A tax with no saved rate shows "Not set" and no yield; its slider starts at the channel default
 * so the player has somewhere to begin. Each commit saves only the changed tax.
 */
export function FiscalPolicyConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { country } = useCountryData();

  const { economicProfile: profile, fiscalSystem: fiscal } = economicRelationsOf(country);
  const gdp = finiteOrNull(country?.currentTotalGdp);
  const taxEfficiency = finiteOrNull(fiscal?.taxEfficiency);

  // ---------------------------------------------------------------------------
  // Rates — the saved fiscal system, overridden by this session's edits
  // ---------------------------------------------------------------------------

  const saved = useMemo(() => readSavedRates(fiscal), [fiscal]);
  const [edits, setEdits] = useState<Record<string, number>>({});

  // The effective rate per channel: this session's edit, else the saved rate, else not set.
  const rates = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const ch of TAX_CHANNELS) result[ch.key] = edits[ch.key] ?? saved[ch.key]?.rate ?? null;
    return result;
  }, [edits, saved]);

  // ---------------------------------------------------------------------------
  // Sector-derived revenue weights and projected yields
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Backend persistence (debounced, only the changed taxes)
  // ---------------------------------------------------------------------------

  const updateMutation = api.economics.updateFiscalSystem.useMutation({
    onSuccess: () => {
      // Other Economy tabs read the saved tariff and rates from the country record.
      void utils.countries.getByIdWithEconomicData.invalidate();
    },
    onError: (err: { message?: string }) => {
      notify.error(`Failed to save tax rates: ${err?.message ?? "Unknown error"}`);
    },
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<FiscalRateUpdate>({});
  // Latest exciseTaxRates we know of, so tariff and capital gains saves merge into each other.
  const exciseRef = useRef<string | null | undefined>(fiscal?.exciseTaxRates);
  useEffect(() => {
    if (pendingRef.current.exciseTaxRates === undefined) exciseRef.current = fiscal?.exciseTaxRates;
  }, [fiscal?.exciseTaxRates]);

  const persistRate = useCallback(
    (key: string, value: number) => {
      const update = fiscalUpdateForRate(key, value, exciseRef.current);
      if (update.exciseTaxRates !== undefined) exciseRef.current = update.exciseTaxRates;
      pendingRef.current = { ...pendingRef.current, ...update };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const pending = pendingRef.current;
        pendingRef.current = {};
        updateMutation.mutate({ countryId, ...pending });
      }, 800);
    },
    [countryId, updateMutation]
  );

  // Slider change handler
  const handleRateChange = useCallback((key: string, value: number) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Slider commit handler (fires on drag end or when the card is re-locked)
  const handleRateCommit = useCallback(
    (key: string, value: number) => {
      setEdits((prev) => ({ ...prev, [key]: value }));
      persistRate(key, value);
    },
    [persistRate]
  );

  return (
    <div className="space-y-4">
      {/* ── Section 1: Tax Rate Control Grid ── */}
      <FacetCard depth={1} className="bg-card/30 space-y-4 p-4 backdrop-blur-md">
        <div className="border-border/20 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-foreground text-sm font-bold">National Tax Rate Controls</h4>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Total Revenue:
            </span>
            <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-sm font-bold tracking-tight text-emerald-600 tabular-nums shadow-md shadow-emerald-500/10 sm:text-base dark:text-emerald-400">
              {yields.total != null ? (
                <>
                  <CurrencyFlow
                    value={yields.total}
                    className="font-bold text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="ml-1 text-xs font-semibold text-emerald-400/70">/ yr</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        </div>

        {taxEfficiency == null && yields.total != null && (
          <p className="text-muted-foreground text-xs">
            No collection efficiency is recorded, so revenue is shown before collection losses.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TAX_CHANNELS.map((ch) => (
            <TaxRateCard
              key={ch.key}
              channel={ch}
              rate={rates[ch.key]}
              bracketed={saved[ch.key]?.bracketed ?? false}
              yieldValue={yields.byChannel[ch.key] ?? null}
              totalYield={yields.total}
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
