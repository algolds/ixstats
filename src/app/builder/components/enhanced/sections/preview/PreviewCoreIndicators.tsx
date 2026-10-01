"use client";

import React, { memo } from "react";
import {
  Globe,
  Group as Users,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  StatsReport as BarChart3,
} from "iconoir-react";
import { formatCompactNumber, formatCurrency } from "~/lib/utils";
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
        <BarChart3 className="text-label-tertiary mx-auto mb-3 h-10 w-10" />
        <p className="text-body text-label-secondary">No economic indicators configured</p>
      </div>
    );
  }

  const symbol = extractCurrencySymbol(currency);
  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currency);

  const items: IndicatorItem[] = [
    {
      icon: Users,
      value: formatCompactNumber(coreIndicators.totalPopulation),
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
            className="rounded-row border-separator bg-surface hover:border-separator hover:bg-surface flex flex-col items-center justify-center border p-3 text-center transition-colors"
            title={item.subValue ? `${item.label}: ${item.subValue}` : item.label}
          >
            <div className="rounded-control bg-tint-fill text-tint mb-2 flex h-7 w-7 items-center justify-center">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="text-headline text-label sm:text-title-3 max-w-full truncate">
              {item.value}
            </div>
            <div className="text-caption text-label-secondary max-w-full truncate">
              {item.label}
            </div>
            {item.subValue && (
              <div className="text-footnote text-label-secondary mt-0.5 max-w-full truncate font-mono">
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
