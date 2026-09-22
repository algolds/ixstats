"use client";

import React from "react";
import {
  Group as Users,
  StatsReport as BarChart3,
  Dollar as DollarSign,
} from "iconoir-react";
import { SliderWithDirectInput } from "../../../primitives/enhanced";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { getPopulationTierFromPopulation } from "~/types/ixstats";
import type {
  EconomicInputs,
  RealCountryData,
} from "~/app/builder/lib/economy-data-service";
import { getEconomicTier } from "~/app/builder/lib/economy-data-service";

interface BasicInfoCoreIndicatorsProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
}

export const BasicInfoCoreIndicators = React.memo(
  function BasicInfoCoreIndicators({
    inputs,
    onInputsChange,
    referenceCountry,
  }: BasicInfoCoreIndicatorsProps) {
    const safeInputs = inputs || {
      coreIndicators: {
        totalPopulation: 10000000,
        nominalGDP: 250000000000,
        gdpPerCapita: 25000,
        realGDPGrowthRate: 3.0,
        inflationRate: 2.0,
        currencyExchangeRate: 1.0,
      },
    };

    const coreIndicators = safeInputs.coreIndicators || {
      totalPopulation: 10000000,
      nominalGDP: 250000000000,
      gdpPerCapita: 25000,
      realGDPGrowthRate: 3.0,
      inflationRate: 2.0,
      currencyExchangeRate: 1.0,
    };

    const sanitizeNumber = (value: number | string | undefined, defaultValue: number): number => {
      const numValue = Number(value);
      return !isNaN(numValue) && isFinite(numValue) ? numValue : defaultValue;
    };

    const sanitizedCoreIndicators = {
      totalPopulation: sanitizeNumber(coreIndicators.totalPopulation, 10000000),
      nominalGDP: sanitizeNumber(coreIndicators.nominalGDP, 250000000000),
      gdpPerCapita: sanitizeNumber(coreIndicators.gdpPerCapita, 25000),
      realGDPGrowthRate: sanitizeNumber(coreIndicators.realGDPGrowthRate, 3.0),
      inflationRate: sanitizeNumber(coreIndicators.inflationRate, 2.0),
      currencyExchangeRate: sanitizeNumber(coreIndicators.currencyExchangeRate, 1.0),
    };

    const economicTier = getEconomicTier(sanitizedCoreIndicators.gdpPerCapita);
    const populationTier = getPopulationTierFromPopulation(sanitizedCoreIndicators.totalPopulation);

    const defaultTaxRate = referenceCountry?.taxRevenuePercent || 20;
    const computedGDP =
      sanitizedCoreIndicators.totalPopulation * sanitizedCoreIndicators.gdpPerCapita;
    const estimatedBaseRevenue = computedGDP * (defaultTaxRate / 100);

    return (
      <FacetCard
        depth="base"
        theme="emerald"
        className="border-emerald-500/20"
        texture="chevron"
        textureOpacity={0.06}
      >
        <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            Core Stats
          </h3>
        </div>
        <FacetCardContent className="space-y-6 p-6">
          {/* 1. Starting Population */}
          <div className="space-y-2">
            <SliderWithDirectInput
              label="Starting Population"
              description="Initial baseline population of your country"
              icon={Users}
              value={sanitizedCoreIndicators.totalPopulation}
              onChange={(value) => {
                const population = sanitizeNumber(
                  value,
                  sanitizedCoreIndicators.totalPopulation
                );
                const clamped = Math.max(100000, Math.min(200000000, population));
                onInputsChange({
                  ...safeInputs,
                  coreIndicators: {
                    ...coreIndicators,
                    totalPopulation: clamped,
                    nominalGDP: clamped * sanitizedCoreIndicators.gdpPerCapita,
                  },
                  fiscalSystem: {
                    ...(safeInputs.fiscalSystem || {}),
                    taxRevenueGDPPercent: defaultTaxRate,
                    governmentRevenueTotal: (clamped * sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
                    taxRevenuePerCapita: (sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
                  },
                });
              }}
              min={100000}
              max={150000000}
              step={100000}
              unit=" citizens"
              precision={0}
              sectionId="core"
              showValue={true}
              defaultMode="slider"
              allowModeToggle={true}
              labelClassName="text-sm font-semibold text-foreground"
              valueClassName="text-base font-bold text-foreground"
            />
            <div className="text-muted-foreground flex items-center justify-between text-xs pt-0.5">
              <span className="font-mono text-[11px] opacity-75">100K min</span>
              <Badge
                variant="secondary"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Tier {populationTier}
              </Badge>
              <span className="font-mono text-[11px] opacity-75">150M max</span>
            </div>
          </div>

          {/* 2. GDP per Capita */}
          <div className="space-y-2 border-t border-border/20 pt-5">
            <SliderWithDirectInput
              label="GDP per Capita"
              description="Average economic productivity and standard of living per citizen"
              icon={DollarSign}
              value={sanitizedCoreIndicators.gdpPerCapita}
              onChange={(value) => {
                const gdpPerCapita = sanitizeNumber(
                  value,
                  sanitizedCoreIndicators.gdpPerCapita
                );
                const clamped = Math.max(1000, Math.min(100000, gdpPerCapita));
                onInputsChange({
                  ...safeInputs,
                  coreIndicators: {
                    ...coreIndicators,
                    gdpPerCapita: clamped,
                    nominalGDP: sanitizedCoreIndicators.totalPopulation * clamped,
                  },
                  fiscalSystem: {
                    ...(safeInputs.fiscalSystem || {}),
                    taxRevenueGDPPercent: defaultTaxRate,
                    governmentRevenueTotal: (sanitizedCoreIndicators.totalPopulation * clamped * defaultTaxRate) / 100,
                    taxRevenuePerCapita: (clamped * defaultTaxRate) / 100,
                  },
                });
              }}
              min={1000}
              max={100000}
              step={500}
              unit=" USD"
              precision={0}
              sectionId="core"
              showValue={true}
              defaultMode="slider"
              allowModeToggle={true}
              labelClassName="text-sm font-semibold text-foreground"
              valueClassName="text-base font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            />
            <div className="text-muted-foreground flex items-center justify-between text-xs pt-0.5">
              <span className="font-mono text-[11px] opacity-75">$1,000 min</span>
              <Badge
                variant="secondary"
                className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {economicTier}
              </Badge>
              <span className="font-mono text-[11px] opacity-75">$100,000 max</span>
            </div>
          </div>

          {/* 3. Emergent Scale Dashboard */}
          <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 backdrop-blur-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Total Nominal GDP
                </h5>
                <div className="mt-1 text-xl font-bold tabular-nums text-emerald-500 dark:text-emerald-400">
                  <NumberFlowDisplay
                    value={computedGDP}
                    format="currency"
                    decimalPlaces={0}
                  />
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs leading-tight">
                  Population × GDP per Capita
                </p>
              </div>

              <div>
                <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Est. Base Revenue
                </h5>
                <div className="mt-1 text-xl font-bold tabular-nums text-amber-500 dark:text-amber-400">
                  <NumberFlowDisplay
                    value={estimatedBaseRevenue}
                    format="currency"
                    decimalPlaces={0}
                  />
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs leading-tight">
                  ~{defaultTaxRate.toFixed(0)}% base flat projection
                </p>
              </div>
            </div>

            <div className="border-border/20 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div>
                <h5 className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                  Economic Classification
                </h5>
                <Badge
                  variant="secondary"
                  className="border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300"
                >
                  {economicTier}
                </Badge>
              </div>
              <div>
                <h5 className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                  Population Tier
                </h5>
                <Badge
                  variant="secondary"
                  className="border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-600 dark:text-teal-300"
                >
                  Tier {populationTier}
                </Badge>
              </div>
            </div>
          </div>

        </FacetCardContent>
      </FacetCard>
    );
  }
);
