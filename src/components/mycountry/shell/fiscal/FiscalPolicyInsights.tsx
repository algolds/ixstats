"use client";

import React from "react";
import {
  StatUp as TrendingUp,
  StatDown as TrendingDown,
  ShieldCheck,
  StatsReport as BarChart3,
  Activity,
} from "iconoir-react";
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
import { RailCard, RailRow, STATUS_FILL, STATUS_TEXT } from "../rails/shared";

type LafferPosition = "below-optimal" | "optimal" | "above-optimal";

/** How the effective tax burden reads against the 15–35% optimal zone. */
const LAFFER: Record<LafferPosition, { fill: string; text: string; label: string }> = {
  "below-optimal": { fill: STATUS_FILL.warning, text: STATUS_TEXT.warning, label: "Low" },
  optimal: { fill: STATUS_FILL.success, text: STATUS_TEXT.success, label: "Optimal" },
  "above-optimal": { fill: STATUS_FILL.critical, text: STATUS_TEXT.critical, label: "Severe" },
};

function lafferPositionOf(burden: number | null): LafferPosition | null {
  if (burden == null) return null;
  return burden < 15 ? "below-optimal" : burden <= 35 ? "optimal" : "above-optimal";
}

const percentFlow = (value: number | null, decimalPlaces: number) =>
  value != null ? <PercentageFlow value={value} decimalPlaces={decimalPlaces} /> : "—";

type Country = ReturnType<typeof useCountryData>["country"];

function deriveFiscalInsights(country: Country) {
  const { economicProfile: profile, fiscalSystem: fiscal } = economicRelationsOf(country);
  const gdp = finiteOrNull(country?.currentTotalGdp);
  const taxEfficiency = finiteOrNull(fiscal?.taxEfficiency);

  const saved = readSavedRates(fiscal);
  const rates: Record<string, number | null> = {};
  for (const ch of TAX_CHANNELS) rates[ch.key] = saved[ch.key]?.rate ?? null;

  const sectorWeights = deriveSectorWeights(
    parseSectorBreakdown(profile?.sectorBreakdown).map((s) => ({
      name: s.name,
      percentage: s.share,
    })),
    profile?.exportsGDPPercent,
    profile?.importsGDPPercent
  );
  const yields = computeTaxYields(rates, gdp, taxEfficiency, sectorWeights);
  const total = yields.total;

  const effectiveTaxBurden = total != null && gdp != null && gdp > 0 ? (total / gdp) * 100 : null;
  const govRevenue = finiteOrNull(country?.governmentRevenueTotal);
  const budgetImpact =
    govRevenue != null && govRevenue > 0 && total != null
      ? ((total - govRevenue) / govRevenue) * 100
      : null;

  const revenueComposition =
    total == null || total <= 0
      ? []
      : TAX_CHANNELS.map((ch) => {
          const value = yields.byChannel[ch.key];
          return { ch, pct: value != null ? (value / total) * 100 : null };
        });

  return {
    effectiveTaxBurden,
    lafferPosition: lafferPositionOf(effectiveTaxBurden),
    budgetImpact,
    collectionEfficiency: taxEfficiency != null ? taxEfficiency * 100 : null,
    revenueComposition,
  };
}

/** Fiscal Policy sidebar — reads the saved rates from the country record; "—" where unknown. */
export function FiscalPolicyInsights({ countryId: _countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const {
    effectiveTaxBurden,
    lafferPosition,
    budgetImpact,
    collectionEfficiency,
    revenueComposition,
  } = deriveFiscalInsights(country);
  const laffer = LAFFER[lafferPosition ?? "above-optimal"];

  return (
    <div className="space-y-6">
      <RailCard title="Tax burden" icon={BarChart3} contentClassName="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label-secondary text-footnote">Effective GDP tax burden</span>
          <span className="text-label text-title-3 tabular-nums">
            {percentFlow(effectiveTaxBurden, 1)}
          </span>
        </div>

        <div className="bg-fill-3 relative h-2.5 overflow-hidden rounded-full">
          {/* Optimal zone band (15–35% on a 0–50% scale) */}
          <div
            aria-hidden="true"
            className="border-green/40 bg-green/10 absolute inset-y-0 border-x"
            style={{ left: "30%", width: "40%" }}
          />
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", laffer.fill)}
            style={{ width: `${Math.min(((effectiveTaxBurden ?? 0) / 50) * 100, 100)}%` }}
          />
        </div>
        <div className="text-label-secondary text-footnote flex justify-between tabular-nums">
          <span>0%</span>
          <span>Optimal zone 15–35%</span>
          <span>50%+</span>
        </div>
      </RailCard>

      <RailCard title="Revenue composition" icon={Activity} contentClassName="space-y-3">
        {revenueComposition.length === 0 ? (
          <p className="text-label-secondary text-footnote">
            No revenue projection yet. Set your tax rates in the national tax rate controls.
          </p>
        ) : (
          <>
            <div
              className="bg-fill-3 flex h-3 overflow-hidden rounded-full"
              role="img"
              aria-label="Share of revenue by tax"
            >
              {revenueComposition.map(({ ch, pct }) => (
                <div
                  key={ch.key}
                  className={ACCENT_BG[ch.accent]}
                  style={{ width: `${pct ?? 0}%` }}
                  title={`${ch.key}: ${pct != null ? `${pct.toFixed(1)}%` : "not set"}`}
                />
              ))}
            </div>

            <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
              {revenueComposition.map(({ ch, pct }) => (
                <li key={ch.key} className="text-footnote flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn("h-2 w-2 shrink-0 rounded-full", ACCENT_BG[ch.accent])}
                    />
                    <span className="text-label-secondary truncate">{ch.shortLabel}</span>
                  </div>
                  <span className="text-label shrink-0 font-medium tabular-nums">
                    {percentFlow(pct, 1)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </RailCard>

      <RailCard title="Fiscal health" icon={ShieldCheck}>
        <div className="grid grid-cols-3 gap-2">
          <RailRow className="p-2">
            <span className="text-stat-label text-label-secondary block">Efficiency</span>
            <p className="text-label text-title-3 mt-0.5 tabular-nums">
              {percentFlow(collectionEfficiency, 0)}
            </p>
          </RailRow>
          <RailRow className="p-2">
            <span className="text-stat-label text-label-secondary block">Budget Δ</span>
            <p
              className={cn(
                "text-title-3 mt-0.5 tabular-nums",
                budgetImpact == null
                  ? "text-label"
                  : budgetImpact >= 0
                    ? STATUS_TEXT.success
                    : STATUS_TEXT.critical
              )}
            >
              {budgetImpact != null && (
                <>
                  {budgetImpact >= 0 ? (
                    <TrendingUp aria-hidden="true" className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  ) : (
                    <TrendingDown aria-hidden="true" className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  )}
                </>
              )}
              {percentFlow(budgetImpact != null ? Math.abs(budgetImpact) : null, 1)}
            </p>
          </RailRow>
          <RailRow className="p-2">
            <span className="text-stat-label text-label-secondary block">Burden</span>
            <p
              className={cn(
                "text-headline mt-0.5",
                lafferPosition == null ? "text-label" : laffer.text
              )}
            >
              {lafferPosition == null ? "—" : laffer.label}
            </p>
          </RailRow>
        </div>
      </RailCard>
    </div>
  );
}
