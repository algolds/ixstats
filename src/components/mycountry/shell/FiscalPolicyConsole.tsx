"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Percentage as Percent } from "iconoir-react";
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
  nationalRevenue,
  type FiscalRateUpdate,
} from "./fiscal";
import { economicRelationsOf } from "~/lib/economy/country-relations";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export { FiscalPolicyInsights };

type PendingSave = FiscalRateUpdate & { countryId?: string };

/**
 * Fiscal Policy tab: national tax rate sliders.
 *
 * Saved rates come from the country record (`getByIdWithEconomicData` includes `fiscalSystem`).
 * A tax with no saved rate shows "Not set" and no yield; its slider starts at the channel default
 * so the player has somewhere to begin. Each commit saves only the changed tax, debounced, and a
 * pending save is sent when the console unmounts.
 */
export function FiscalPolicyConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { country } = useCountryData();

  const { fiscalSystem: fiscal } = economicRelationsOf(country);
  const saved = useMemo(() => readSavedRates(fiscal), [fiscal]);
  const [edits, setEdits] = useState<Record<string, number>>({});

  // The nation's one revenue figure, with this session's edits applied to the rates.
  const revenue = useMemo(() => nationalRevenue(country, edits), [country, edits]);
  const { rates, yields } = revenue;

  // Backend persistence (debounced, only the changed taxes)

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
  const pendingRef = useRef<PendingSave>({});
  const mutateRef = useRef(updateMutation.mutate);
  useEffect(() => {
    mutateRef.current = updateMutation.mutate;
  }, [updateMutation.mutate]);
  // Latest exciseTaxRates we know of, so tariff and capital gains saves merge into each other.
  const exciseRef = useRef<string | null | undefined>(fiscal?.exciseTaxRates);
  useEffect(() => {
    if (pendingRef.current.exciseTaxRates === undefined) exciseRef.current = fiscal?.exciseTaxRates;
  }, [fiscal?.exciseTaxRates]);

  // Send whatever is pending now: after the debounce, or when the console unmounts.
  const flush = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    const { countryId: target, ...pending } = pendingRef.current;
    pendingRef.current = {};
    if (target) mutateRef.current({ countryId: target, ...pending });
  }, []);
  useEffect(() => flush, [flush]);

  const persistRate = useCallback(
    (key: string, value: number) => {
      const update = fiscalUpdateForRate(key, value, exciseRef.current);
      if (update.exciseTaxRates !== undefined) exciseRef.current = update.exciseTaxRates;
      pendingRef.current = { ...pendingRef.current, ...update, countryId };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flush, 800);
    },
    [countryId, flush]
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
      <Card className="rounded-card">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 p-4 pb-3">
          <div className="flex items-center gap-2">
            <Percent aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
            <h3 className="text-label text-headline">National tax rate controls</h3>
          </div>
          <div className="text-right">
            <span className="text-label-secondary text-footnote block">Total revenue</span>
            <p className="text-label text-title-3 tabular-nums">
              {revenue.total != null ? (
                <>
                  <CurrencyFlow value={revenue.total} />
                  <span className="text-label-secondary text-caption ml-1">/ yr</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 pb-4">
          <p className="text-label-secondary text-footnote">
            These rates set the revenue every Economy tab shows, the budget included. They do not
            change GDP or growth.
          </p>
          {revenue.basis === "founding" && (
            <p className="text-label-secondary text-footnote">
              No tax rate is saved yet, so revenue shows the founding estimate. Save a rate to
              replace it.
            </p>
          )}
          {revenue.taxEfficiency == null && yields.total != null && (
            <p className="text-label-secondary text-footnote">
              No collection efficiency is recorded, so revenue is shown before collection losses.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TAX_CHANNELS.map((ch) => (
              <TaxRateCard
                key={ch.key}
                channel={ch}
                rate={rates[ch.key] ?? null}
                bracketed={saved[ch.key]?.bracketed ?? false}
                yieldValue={yields.byChannel[ch.key] ?? null}
                totalYield={yields.total}
                onChange={(v) => handleRateChange(ch.key, v)}
                onCommit={(v) => handleRateCommit(ch.key, v)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Revenue Yield Matrix ── */}
      <TaxRevenueProjections yields={yields} />
    </div>
  );
}
