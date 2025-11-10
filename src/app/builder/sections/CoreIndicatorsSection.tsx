"use client";

import React, { useMemo } from "react";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Zap } from "lucide-react";
import {
  EnhancedNumberInput,
  EnhancedDial,
  EnhancedBarChart,
  MetricCard,
  SliderWithDirectInput,
} from "../primitives/enhanced";
import { GlassBarChart } from "~/components/charts/RechartsIntegration";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { getBuilderEconomicMetrics } from "~/lib/enhanced-economic-service";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import type { SectionContentProps } from "../types/builder";
import type { CountryStats } from "~/types/ixstats";
import type { EconomyData } from "~/types/economics";

// Help System
import { EconomicsHelpSystem } from "../components/help/GovernmentHelpSystem";
import { EconomicsHelpContent } from "../components/help/EconomicsHelpContent";

interface CoreIndicatorsSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  showAdvanced?: boolean;
  isReadOnly?: boolean; // When true, population/GDP/gdpPerCapita are read-only (calculated values)
  mode?: "create" | "edit"; // Edit mode shows field locks
  fieldLocks?: Record<string, import("../components/enhanced/builderConfig").FieldLockConfig>;
}

export function CoreIndicatorsSection({
  inputs,
  onInputsChange,
  referenceCountry,
  showAdvanced = false,
  isReadOnly = false,
  mode = "create",
  fieldLocks,
}: CoreIndicatorsSectionProps) {
  const isEditMode = mode === "edit";

  // Import field locks if not provided
  const { EDIT_MODE_FIELD_LOCKS } = require("../components/enhanced/builderConfig");
  const locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});

  // Guard against null inputs
  if (!inputs) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading economic data...</p>
        </div>
      </div>
    );
  }

  // Ensure coreIndicators exists with defaults and sanitize any NaN values
  const sanitizeNumber = (value: any, defaultValue: number): number => {
    const numValue = Number(value);
    return !isNaN(numValue) && isFinite(numValue) ? numValue : defaultValue;
  };

  const coreIndicators = inputs.coreIndicators || {
    totalPopulation: 10000000,
    nominalGDP: 250000000000,
    gdpPerCapita: 25000,
    realGDPGrowthRate: 3.0,
    inflationRate: 2.0,
    currencyExchangeRate: 1.0,
  };

  // Sanitize all numeric values in coreIndicators to prevent NaN propagation
  const sanitizedCoreIndicators = {
    totalPopulation: sanitizeNumber(coreIndicators.totalPopulation, 10000000),
    nominalGDP: sanitizeNumber(coreIndicators.nominalGDP, 250000000000),
    gdpPerCapita: sanitizeNumber(coreIndicators.gdpPerCapita, 25000),
    realGDPGrowthRate: sanitizeNumber(coreIndicators.realGDPGrowthRate, 3.0),
    inflationRate: sanitizeNumber(coreIndicators.inflationRate, 2.0),
    currencyExchangeRate: sanitizeNumber(coreIndicators.currencyExchangeRate, 1.0),
  };

  // Calculate economic tier and expected growth rate
  const economicTier = getEconomicTier(sanitizedCoreIndicators.gdpPerCapita);

  const calculateExpectedGrowthRate = (gdpPerCapita: number, population: number): number => {
    // Higher income countries typically have lower growth potential
    // Larger countries also tend to have lower growth rates due to scale
    const incomeFactor = Math.max(0.5, Math.min(8, 8 - gdpPerCapita / 10000));
    const sizeFactor =
      population >= 100000000
        ? 0.8
        : population >= 10000000
          ? 0.9
          : population >= 1000000
            ? 1.0
            : 1.1;

    return Math.round(incomeFactor * sizeFactor * 10) / 10; // Round to 1 decimal
  };

  const expectedGrowthRate = calculateExpectedGrowthRate(
    sanitizedCoreIndicators.gdpPerCapita,
    sanitizedCoreIndicators.totalPopulation
  );

  // Calculate derived metrics for overview cards
  const metrics = useMemo(() => {
    const totalPopulation = sanitizedCoreIndicators.totalPopulation;
    const gdpPerCapita = sanitizedCoreIndicators.gdpPerCapita;
    const realGDPGrowthRate = sanitizedCoreIndicators.realGDPGrowthRate;
    const inflationRate = sanitizedCoreIndicators.inflationRate;
    const nominalGDP = totalPopulation * gdpPerCapita;

    return [
      {
        label: "Total GDP",
        value: nominalGDP,
        unit: "",
        description: "Nominal Gross Domestic Product",
        icon: DollarSign,
        trend:
          realGDPGrowthRate > 2
            ? ("up" as const)
            : realGDPGrowthRate < 0
              ? ("down" as const)
              : ("neutral" as const),
        change: realGDPGrowthRate,
        changeUnit: "%",
      },
      {
        label: "Population",
        value: totalPopulation,
        unit: " people",
        description: "Total population count",
        icon: Users,
        trend: "neutral" as const,
      },
      {
        label: "GDP per Capita",
        value: gdpPerCapita,
        unit: " $",
        description: "Economic output per person",
        icon: Activity,
        trend:
          realGDPGrowthRate > 2
            ? ("up" as const)
            : realGDPGrowthRate < 0
              ? ("down" as const)
              : ("neutral" as const),
        change: realGDPGrowthRate,
        changeUnit: "%",
      },
      {
        label: "Growth Rate",
        value: realGDPGrowthRate,
        unit: "%",
        description: "Annual economic growth",
        icon: TrendingUp,
        trend:
          realGDPGrowthRate > 2
            ? ("up" as const)
            : realGDPGrowthRate < 0
              ? ("down" as const)
              : ("neutral" as const),
        change: realGDPGrowthRate - 2.5, // Assuming 2.5% is global average
        changeUnit: "pp",
      },
    ];
  }, [sanitizedCoreIndicators]);

  // Generate 10-year economic projections
  const generateProjections = (currentGDP: number, growthRate: number, inflationRate: number) => {
    const projections = [];
    let projectedGDP = currentGDP;

    for (let year = 0; year <= 10; year++) {
      const yearLabel = year === 0 ? "Current" : `Year ${year}`;

      projections.push({
        name: yearLabel,
        population: sanitizedCoreIndicators.totalPopulation, // Population stays constant for simplicity
        gdpPerCapita: Math.max(1000, projectedGDP), // Ensure minimum visible value
        growthRate: Math.max(0.1, year === 0 ? growthRate : growthRate * (1 - year * 0.05)), // Slightly declining growth over time
        inflationRate: Math.max(0.1, inflationRate),
        color: year === 0 ? "blue" : year <= 3 ? "emerald" : year <= 7 ? "yellow" : "orange",
      });

      // Apply growth and inflation to next year's GDP
      projectedGDP = projectedGDP * (1 + growthRate / 100) * (1 + inflationRate / 100);
    }

    return projections;
  };

  // Prepare comparison data for charts with guaranteed numeric values
  const comparisonData = referenceCountry
    ? [
        {
          name: inputs.countryName || "Your Custom Country",
          population: sanitizedCoreIndicators.totalPopulation,
          gdpPerCapita: sanitizedCoreIndicators.gdpPerCapita,
          growthRate: sanitizedCoreIndicators.realGDPGrowthRate,
          inflationRate: sanitizedCoreIndicators.inflationRate,
          color: "blue",
        },
        {
          name: `${referenceCountry.name} (Foundation)`,
          population: sanitizeNumber(referenceCountry.population, 331000000),
          gdpPerCapita: sanitizeNumber(referenceCountry.gdpPerCapita, 63544),
          growthRate: sanitizeNumber(referenceCountry.growthRate, 2.3),
          inflationRate: sanitizeNumber(referenceCountry.inflationRate, 3.1),
          color: "emerald",
        },
      ]
    : generateProjections(
        sanitizedCoreIndicators.gdpPerCapita,
        sanitizedCoreIndicators.realGDPGrowthRate,
        sanitizedCoreIndicators.inflationRate
      );

  const formatCurrency = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e12) return `$${(numValue / 1e12).toFixed(1)}T`;
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`;
    return `$${numValue.toLocaleString()}`;
  };

  const formatPopulation = (value: number | string) => {
    // Always show full number with commas for clarity
    return Number(value).toLocaleString();
  };

  const formatPopulationCompact = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(1)}K`;
    return numValue.toLocaleString();
  };

  return (
    <div className="space-y-8">
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} sectionId="core" className="h-full" />
        ))}
      </div>

      {/* Core Economic Controls */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left Column - Population and GDP */}
        <div className="space-y-6">
          <div className="relative">
            {isReadOnly && sanitizedCoreIndicators.totalPopulation === 0 && (
              <Badge variant="destructive" className="absolute -top-2 right-0 z-10">
                ⚠️ Missing Data
              </Badge>
            )}
            <EnhancedNumberInput
              label="Total Population"
              description={
                isReadOnly
                  ? "🔒 Calculated by IxStats engine based on baseline + growth over time (read-only)"
                  : "The total number of people living in your country"
              }
              value={sanitizedCoreIndicators.totalPopulation}
              onChange={(value) => {
                const population = sanitizeNumber(value, sanitizedCoreIndicators.totalPopulation);
                const gdpPerCapita = sanitizeNumber(inputs.coreIndicators?.gdpPerCapita, 25000);
                const clampedPopulation = Math.max(1000, Math.min(2000000000, population));

                onInputsChange({
                  ...inputs,
                  coreIndicators: {
                    ...(inputs.coreIndicators || {}),
                    totalPopulation: clampedPopulation,
                    nominalGDP: clampedPopulation * gdpPerCapita,
                  },
                });
              }}
              min={1000}
              max={2000000000}
              step={100000}
              unit=" people"
              sectionId="core"
              icon={Users}
              format={formatPopulation}
              referenceValue={referenceCountry?.population}
              referenceLabel={referenceCountry?.name}
              showComparison={!!referenceCountry}
              showButtons={!isReadOnly}
              showReset={!isReadOnly}
              resetValue={referenceCountry?.population}
              disabled={isReadOnly}
              helpContent={EconomicsHelpContent.coreIndicators.content}
              helpTitle="Total Population"
            />
          </div>

          <div className="relative">
            {isReadOnly && sanitizedCoreIndicators.gdpPerCapita === 0 && (
              <Badge variant="destructive" className="absolute -top-2 right-0 z-10">
                ⚠️ Missing Data
              </Badge>
            )}
            <EnhancedNumberInput
              label="GDP per Capita"
              description={
                isReadOnly
                  ? "🔒 Calculated by IxStats engine based on baseline + growth over time (read-only)"
                  : "Average economic output per person (annual income proxy)"
              }
              value={sanitizedCoreIndicators.gdpPerCapita}
              onChange={(value) => {
                const gdpPerCapita = sanitizeNumber(value, sanitizedCoreIndicators.gdpPerCapita);
                const population = sanitizeNumber(inputs.coreIndicators?.totalPopulation, 10000000);
                const clampedGdpPerCapita = Math.max(500, Math.min(150000, gdpPerCapita));

                onInputsChange({
                  ...inputs,
                  coreIndicators: {
                    ...(inputs.coreIndicators || {}),
                    gdpPerCapita: clampedGdpPerCapita,
                    nominalGDP: population * clampedGdpPerCapita,
                  },
                });
              }}
              min={500}
              max={150000}
              step={1000}
              unit=""
              sectionId="core"
              icon={DollarSign}
              format={formatCurrency}
              referenceValue={referenceCountry?.gdpPerCapita}
              referenceLabel={referenceCountry?.name}
              showComparison={!!referenceCountry}
              showButtons={!isReadOnly}
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Right Column - Growth and Inflation */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Economic Growth Profile
            </label>
            <p className="text-muted-foreground text-xs">
              Calculated based on your country's economic tier and population size
            </p>
            <div className="bg-card/50 border-border rounded-lg border p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-foreground text-lg font-semibold">{economicTier}</div>
                  <div className="text-muted-foreground text-sm">Economic Development Tier</div>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs font-medium",
                    economicTier === "Advanced" &&
                      "border-green-500/30 bg-green-500/20 text-green-600",
                    economicTier === "Developed" &&
                      "border-blue-500/30 bg-blue-500/20 text-blue-600",
                    economicTier === "Emerging" &&
                      "border-orange-500/30 bg-orange-500/20 text-orange-600",
                    economicTier === "Developing" &&
                      "border-yellow-500/30 bg-yellow-500/20 text-yellow-600"
                  )}
                >
                  {economicTier}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Expected Growth Rate:</span>
                  <div className="text-foreground font-medium">{expectedGrowthRate}%</div>
                </div>
                <div>
                  <span className="text-muted-foreground">GDP per Capita:</span>
                  <div className="text-foreground font-medium">
                    ${sanitizedCoreIndicators.gdpPerCapita.toLocaleString()}
                  </div>
                </div>
              </div>
              {referenceCountry && (
                <div className="border-border mt-3 border-t pt-3">
                  <div className="text-muted-foreground text-xs">
                    vs {referenceCountry.name}: {getEconomicTier(referenceCountry.gdpPerCapita)}{" "}
                    tier
                  </div>
                </div>
              )}
            </div>
          </div>

          <SliderWithDirectInput
            label="Inflation Rate"
            description="Annual percentage increase in general price levels"
            value={sanitizedCoreIndicators.inflationRate}
            onChange={(value) => {
              const inflationRate = sanitizeNumber(value, sanitizedCoreIndicators.inflationRate);
              const clampedInflationRate = Math.max(-5, Math.min(20, inflationRate));

              onInputsChange({
                ...inputs,
                coreIndicators: {
                  ...(inputs.coreIndicators || {}),
                  inflationRate: clampedInflationRate,
                },
              });
            }}
            min={-5}
            max={20}
            step={0.1}
            precision={1}
            unit="%"
            sectionId="core"
            icon={Activity}
            showTicks={true}
            tickCount={6}
            showValue={true}
            showRange={true}
            referenceValue={referenceCountry?.inflationRate}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
            defaultMode="input"
            allowModeToggle={true}
          />
        </div>
      </div>

      {/* Advanced Section */}
      {showAdvanced && (
        <div className="space-y-6 border-t border-blue-200/30 pt-6">
          <h4 className="text-foreground flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="h-5 w-5" />
            {referenceCountry
              ? "Economic Comparison: Custom vs Foundation Country"
              : "Economic Projections: 10-Year Forecast"}
          </h4>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* GDP Comparison Chart */}
            <GlassBarChart
              data={comparisonData.map((item) => ({
                ...item,
                gdpPerCapita: Math.max(1000, item.gdpPerCapita), // Ensure minimum visible value
              }))}
              xKey="name"
              yKey="gdpPerCapita"
              title={referenceCountry ? "GDP per Capita Comparison" : "GDP per Capita Projections"}
              description={
                referenceCountry
                  ? `${inputs.countryName || "Your Custom Country"} vs ${referenceCountry.name}`
                  : "10-year economic projections based on current growth and inflation rates"
              }
              height={300}
              colors={comparisonData.map((item) => {
                const colorMap: Record<string, string> = {
                  blue: "hsl(217, 91%, 60%)",
                  emerald: "hsl(160, 84%, 60%)",
                  yellow: "hsl(45, 93%, 58%)",
                  orange: "hsl(25, 95%, 53%)",
                  purple: "hsl(262, 83%, 58%)",
                };
                return colorMap[item.color] || "hsl(217, 91%, 60%)";
              })}
            />

            {/* Growth & Inflation Chart */}
            <GlassBarChart
              data={comparisonData.map((item) => ({
                ...item,
                growthRate: Math.max(0.1, item.growthRate), // Ensure minimum visible value
                inflationRate: Math.max(0.1, item.inflationRate),
              }))}
              xKey="name"
              yKey={["growthRate", "inflationRate"]}
              title={referenceCountry ? "Growth vs Inflation Rates" : "Growth & Inflation Trends"}
              description={
                referenceCountry
                  ? `${inputs.countryName || "Your Custom Country"} vs ${referenceCountry.name} - Economic Performance Indicators`
                  : "Projected growth and inflation rates over 10 years"
              }
              height={300}
              stacked={false}
              colors={["hsl(217, 91%, 60%)", "hsl(160, 84%, 60%)"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
