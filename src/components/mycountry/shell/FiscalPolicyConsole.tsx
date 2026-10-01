"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Percentage as Percent } from "iconoir-react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
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
      {/* ── Section 1: Tax rate controls (opaque: it also renders inside the drill sheet) ── */}
      <FacetCard className="rounded-card">
        <FacetCardHeader className="flex-row flex-wrap items-center justify-between gap-3 p-4 pb-3">
          <div className="flex items-center gap-2">
            <Percent aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
            <h3 className="text-label text-headline">National Tax Rate Controls</h3>
          </div>
          <div className="text-right">
            <Eyebrow className="block">Total revenue</Eyebrow>
            <p className="text-label text-title-3 tabular-nums">
              {yields.total != null ? (
                <>
                  <CurrencyFlow value={yields.total} />
                  <span className="text-label-secondary text-caption ml-1">/ yr</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </FacetCardHeader>

        <FacetCardContent className="space-y-3 px-4 pb-4">
          {taxEfficiency == null && yields.total != null && (
            <p className="text-label-secondary text-footnote">
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
        </FacetCardContent>
      </FacetCard>

      {/* ── Section 2: Revenue Yield Matrix ── */}
      <TaxRevenueProjections yields={yields} />
    </div>
  );
}
