"use client";

import React from "react";
import { Group as Users, StatsReport as BarChart3, Dollar as DollarSign } from "iconoir-react";
import { SliderWithDirectInput } from "../../../primitives/enhanced";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { getPopulationTierFromPopulation } from "~/types/ixstats";
import type { EconomicInputs, RealCountryData } from "~/app/builder/lib/economy-data-service";
import { getEconomicTier } from "~/app/builder/lib/economy-data-service";
import { Card, CardContent } from "~/components/ui/card";

interface BasicInfoCoreIndicatorsProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
}

export const BasicInfoCoreIndicators = React.memo(function BasicInfoCoreIndicators({
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
    <Card>
      <div className="border-separator border-b px-6 py-4">
        <h3 className="text-label text-headline flex items-center gap-2">
          <BarChart3 className="text-green h-5 w-5" />
          Core Stats
        </h3>
      </div>
      <CardContent className="space-y-6 p-6">
        {/* 1. Starting Population */}
        <div className="space-y-2">
          <SliderWithDirectInput
            label="Starting Population"
            description="Initial baseline population of your country"
            icon={Users}
            value={sanitizedCoreIndicators.totalPopulation}
            onChange={(value) => {
              const population = sanitizeNumber(value, sanitizedCoreIndicators.totalPopulation);
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
                  governmentRevenueTotal:
                    (clamped * sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
                  taxRevenuePerCapita:
                    (sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
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
            labelClassName="text-headline text-label"
            valueClassName="text-headline text-label"
          />
          <div className="text-label-secondary text-footnote flex items-center justify-between pt-0.5">
            <span className="text-footnote font-mono opacity-75">100K min</span>
            <Badge variant="success">Tier {populationTier}</Badge>
            <span className="text-footnote font-mono opacity-75">150M max</span>
          </div>
        </div>

        {/* 2. GDP per Capita */}
        <div className="border-separator space-y-2 border-t pt-5">
          <SliderWithDirectInput
            label="GDP per Capita"
            description="Average economic productivity and standard of living per citizen"
            icon={DollarSign}
            value={sanitizedCoreIndicators.gdpPerCapita}
            onChange={(value) => {
              const gdpPerCapita = sanitizeNumber(value, sanitizedCoreIndicators.gdpPerCapita);
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
                  governmentRevenueTotal:
                    (sanitizedCoreIndicators.totalPopulation * clamped * defaultTaxRate) / 100,
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
            labelClassName="text-headline text-label"
            valueClassName="text-headline text-green border-green/30"
          />
          <div className="text-label-secondary text-footnote flex items-center justify-between pt-0.5">
            <span className="text-footnote font-mono opacity-75">$1,000 min</span>
            <Badge variant="success">{economicTier}</Badge>
            <span className="text-footnote font-mono opacity-75">$100,000 max</span>
          </div>
        </div>

        {/* 3. Emergent Scale Dashboard */}
        <div className="rounded-row border-green/20 bg-green/[0.03] space-y-4 border p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-label-secondary text-eyebrow">Total Nominal GDP</h4>
              <div className="text-title-2 text-green mt-1 tabular-nums">
                <NumberFlowDisplay value={computedGDP} format="currency" decimalPlaces={0} />
              </div>
              <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                Population × GDP per Capita
              </p>
            </div>

            <div>
              <h4 className="text-label-secondary text-eyebrow">Est. Base Revenue</h4>
              <div className="text-title-2 text-yellow mt-1 tabular-nums">
                <NumberFlowDisplay
                  value={estimatedBaseRevenue}
                  format="currency"
                  decimalPlaces={0}
                />
              </div>
              <p className="text-label-secondary text-footnote mt-0.5 leading-tight">
                ~{defaultTaxRate.toFixed(0)}% base flat projection
              </p>
            </div>
          </div>

          <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div>
              <h4 className="text-label-secondary text-eyebrow mb-1">Economic Classification</h4>
              <Badge variant="success">{economicTier}</Badge>
            </div>
            <div>
              <h4 className="text-label-secondary text-eyebrow mb-1">Population Tier</h4>
              <Badge
                variant="secondary"
                className="border-teal/30 bg-teal/10 text-caption text-teal px-3 py-0.5 font-semibold"
              >
                Tier {populationTier}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
