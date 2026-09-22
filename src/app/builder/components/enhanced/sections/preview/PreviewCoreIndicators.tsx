"use client";

import React, { memo } from "react";
import {
  Globe,
  Group as Users,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  StatsReport as BarChart3,
} from "iconoir-react";
import { formatCurrency } from "~/lib/utils";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";

interface PreviewCoreIndicatorsProps {
  coreIndicators: EconomicInputs["coreIndicators"] | null | undefined;
  currency?: string;
}

interface IndicatorItem {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  subValue?: string;
  label: string;
}

function formatCompactPopulation(pop?: number | null): string {
  if (pop === null || pop === undefined || Number.isNaN(pop)) return "N/A";
  if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)}B`;
  if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
  if (pop >= 1e3) return `${(pop / 1e3).toFixed(1)}K`;
  return pop.toLocaleString("en-US");
}

function extractCurrencySymbol(curr: string): string {
  const match = curr.match(/\(([^)]+)\)/);
  if (match && match[1]) return match[1].trim();
  return curr.length <= 4 ? curr.trim() : "$";
}

export const PreviewCoreIndicators = memo(function PreviewCoreIndicators({
  coreIndicators,
  currency = "USD",
}: PreviewCoreIndicatorsProps) {
  if (!coreIndicators) {
    return (
      <div className="py-8 text-center">
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">No economic indicators configured</p>
      </div>
    );
  }

  const symbol = extractCurrencySymbol(currency);
  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currency);

  const items: IndicatorItem[] = [
    {
      icon: Users,
      value: formatCompactPopulation(coreIndicators.totalPopulation),
      subValue:
        coreIndicators.totalPopulation && coreIndicators.totalPopulation >= 1e6
          ? `${coreIndicators.totalPopulation.toLocaleString()}`
          : undefined,
      label: "Population",
    },
    {
      icon: DollarSign,
      value: coreIndicators.nominalGDP ? formatCurrencyLocal(coreIndicators.nominalGDP) : "N/A",
      subValue:
        coreIndicators.nominalGDP && coreIndicators.nominalGDP >= 1e6
          ? `${symbol} ${coreIndicators.nominalGDP.toLocaleString()}`
          : undefined,
      label: "Nominal GDP",
    },
    {
      icon: TrendingUp,
      value: coreIndicators.gdpPerCapita
        ? `${symbol} ${Math.round(coreIndicators.gdpPerCapita).toLocaleString()}`
        : "N/A",
      label: "GDP per Capita",
    },
    {
      icon: BarChart3,
      value:
        coreIndicators.realGDPGrowthRate !== undefined
          ? `${coreIndicators.realGDPGrowthRate > 0 ? "+" : ""}${coreIndicators.realGDPGrowthRate}%`
          : "N/A",
      label: "GDP Growth",
    },
    {
      icon: TrendingUp,
      value:
        coreIndicators.inflationRate !== undefined ? `${coreIndicators.inflationRate}%` : "N/A",
      label: "Inflation",
    },
    {
      icon: Globe,
      value: coreIndicators.currencyExchangeRate?.toString() || "1.00",
      subValue: `${symbol} / USD`,
      label: "Exchange Rate",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded-xl border border-border/40 bg-card/40 p-3 text-center backdrop-blur-md transition-colors hover:border-border/60 hover:bg-card/60"
            title={item.subValue ? `${item.label}: ${item.subValue}` : item.label}
          >
            <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="max-w-full truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
              {item.value}
            </div>
            <div className="max-w-full truncate text-[11px] font-medium text-muted-foreground">
              {item.label}
            </div>
            {item.subValue && (
              <div className="mt-0.5 max-w-full truncate font-mono text-[10px] text-muted-foreground/70">
                {item.subValue}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

PreviewCoreIndicators.displayName = "PreviewCoreIndicators";
