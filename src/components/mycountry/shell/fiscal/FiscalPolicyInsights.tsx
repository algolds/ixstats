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
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { economyFiguresOf } from "~/lib/economy/country-relations";
import { allocatedInEffect } from "~/components/mycountry/domains/government/budget/budgetSummaries";
import { useNationClock } from "~/hooks/useNationClock";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { fiscalBalancePercent } from "~/components/mycountry/domains/government/budget/budgetTypes";
import { TAX_CHANNELS, ACCENT_BG } from "~/lib/economy/tax-channels";
import { nationalRevenue } from "~/lib/economy/national-revenue";
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
  const { currentTotalGdp: gdp } = economyFiguresOf(country);
  const { total, basis, yields, taxEfficiency } = nationalRevenue(country);

  const effectiveTaxBurden = total != null && gdp != null && gdp > 0 ? (total / gdp) * 100 : null;

  const revenueComposition =
    basis !== "rates" || total == null || total <= 0
      ? []
      : TAX_CHANNELS.map((ch) => {
          const value = yields.byChannel[ch.key];
          return { ch, pct: value != null ? (value / total) * 100 : null };
        });

  return {
    total,
    effectiveTaxBurden,
    lafferPosition: lafferPositionOf(effectiveTaxBurden),
    collectionEfficiency: taxEfficiency != null ? taxEfficiency * 100 : null,
    revenueComposition,
  };
}

/**
 * Revenue left after the budget in effect allocates, as a percent of revenue (the National budget
 * tab's fiscal balance). Null for a visitor (the budget is the owner's), without revenue, or while
 * the nation's clock (its budget year) loads.
 */
function useFiscalBalance(countryId: string, revenue: number | null): number | null {
  const { data: government } = api.government.getFullByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const clock = useNationClock();
  const allocated = clock
    ? allocatedInEffect(government?.budgetAllocations ?? [], currentBudgetYear(clock.now()))
    : null;
  return revenue != null && allocated != null ? fiscalBalancePercent(revenue, allocated) : null;
}

/** Fiscal Policy sidebar — reads the saved rates from the country record; "—" where unknown. */
export function FiscalPolicyInsights({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { total, effectiveTaxBurden, lafferPosition, collectionEfficiency, revenueComposition } =
    deriveFiscalInsights(country);
  const balance = useFiscalBalance(countryId, total);
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
            <span className="text-label-secondary text-footnote block">Efficiency</span>
            <p className="text-label text-title-3 mt-0.5 tabular-nums">
              {percentFlow(collectionEfficiency, 0)}
            </p>
          </RailRow>
          <RailRow className="p-2">
            <span
              className="text-label-secondary text-footnote block"
              title="Revenue left after the budget's allocations, as a share of revenue. Below zero is a deficit."
            >
              Balance
            </span>
            <p
              className={cn(
                "text-title-3 mt-0.5 tabular-nums",
                balance == null
                  ? "text-label"
                  : balance >= 0
                    ? STATUS_TEXT.success
                    : STATUS_TEXT.critical
              )}
            >
              {balance != null && (
                <>
                  {balance >= 0 ? (
                    <TrendingUp aria-hidden="true" className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  ) : (
                    <TrendingDown aria-hidden="true" className="-mt-0.5 mr-0.5 inline h-3 w-3" />
                  )}
                </>
              )}
              {percentFlow(balance, 1)}
            </p>
          </RailRow>
          <RailRow className="p-2">
            <span className="text-label-secondary text-footnote block">Burden</span>
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
