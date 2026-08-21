"use client";

import React, { useMemo } from "react";
import { BarChart3, Users, DollarSign, Activity, Percent } from "lucide-react";
import { SliderWithDirectInput } from "../primitives/enhanced";
import { GlassBarChart } from "~/components/ui/charts/RechartsIntegration";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { EconomicInputs, RealCountryData } from "../lib/economy-data-service";
import { getEconomicTier } from "../lib/economy-data-service";
import type { SectionContentProps } from "../types/builder";
import { EDIT_MODE_FIELD_LOCKS } from "../components/enhanced/builderConfig";
import { CutoutCard, CutoutCardContent } from "~/components/ui/cutout-card";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { GlassCard, GlassCardContent } from "../components/glass/GlassCard";
import { Switch } from "~/components/ui/switch";
import { getPopulationTierFromPopulation } from "~/types/ixstats";
import { useBuilderFilter } from "../components/builder-filter-context";
import { InlineHelpIcon } from "~/components/ui/help-icon";

interface CoreIndicatorsSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  showAdvanced?: boolean;
  isReadOnly?: boolean;
  mode?: "create" | "edit";
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
  const locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});
  const { viewMode } = useBuilderFilter();

  // Safe defaults
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

  const sanitizeNumber = (value: any, defaultValue: number): number => {
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
  const [isTaxCustom, setIsTaxCustom] = React.useState(() => {
    const currentTax = inputs.fiscalSystem?.taxRevenueGDPPercent;
    return currentTax !== undefined && Math.abs(currentTax - defaultTaxRate) > 0.01;
  });

  React.useEffect(() => {
    const currentTax = inputs.fiscalSystem?.taxRevenueGDPPercent;
    const isCustom = currentTax !== undefined && Math.abs(currentTax - defaultTaxRate) > 0.01;
    setIsTaxCustom(isCustom);
  }, [inputs.fiscalSystem?.taxRevenueGDPPercent, defaultTaxRate]);

  const calculateExpectedGrowthRate = (gdpPerCapita: number, population: number): number => {
    const incomeFactor = Math.max(0.5, Math.min(8, 8 - gdpPerCapita / 10000));
    const sizeFactor =
      population >= 100000000
        ? 0.8
        : population >= 10000000
          ? 0.9
          : population >= 1000000
            ? 1.0
            : 1.1;
    return Math.round(incomeFactor * sizeFactor * 10) / 10;
  };

  const expectedGrowthRate = calculateExpectedGrowthRate(
    sanitizedCoreIndicators.gdpPerCapita,
    sanitizedCoreIndicators.totalPopulation
  );

  const formatCurrency = (value: number | string) => {
    const numValue = Number(value);
    if (numValue >= 1e12) return `$${(numValue / 1e12).toFixed(1)}T`;
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`;
    return `$${numValue.toLocaleString()}`;
  };

  // ─── Render Create Mode (Simplified) ───
  if (!isEditMode) {
    const computedGDP =
      sanitizedCoreIndicators.totalPopulation * sanitizedCoreIndicators.gdpPerCapita;
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sliders Card (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          <GlassCard depth="base" className="border-border/40">
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                <Users className="h-5 w-5 text-amber-400" />
                Target Population Scale
                <InlineHelpIcon
                  title="Target Population Scale"
                  content="Set the total number of citizens in your nation. A higher population expands your workforce and tax base but increases demand for infrastructure and services."
                />
              </h3>
            </div>
            <GlassCardContent className="space-y-4 p-6">
              <SliderWithDirectInput
                label=""
                description="Set the initial population scale of your sovereign nation."
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
              />
              <div className="border-border/20 text-muted-foreground flex justify-between border-t pt-3 text-[10px]">
                <span>Min: 100K</span>
                <span>Selected: {sanitizedCoreIndicators.totalPopulation.toLocaleString()}</span>
                <span>Max: 150M</span>
              </div>
            </GlassCardContent>
          </GlassCard>

          <GlassCard depth="base" className="border-border/40">
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                <DollarSign className="h-5 w-5 text-amber-400" />
                Initial GDP per Capita Strength
                <InlineHelpIcon
                  title="GDP per Capita"
                  content="The average economic production per citizen, representing the wealth and productivity standard of your nation. Higher values mean a wealthier base."
                />
              </h3>
            </div>
            <GlassCardContent className="space-y-4 p-6">
              <SliderWithDirectInput
                label=""
                description="Average economic production per citizen (economic strength standard)."
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
                  });
                }}
                min={1000}
                max={100000}
                step={500}
                unit=" USD"
                sectionId="core"
                showValue={true}
                defaultMode="slider"
                allowModeToggle={true}
              />
              <div className="border-border/20 text-muted-foreground flex justify-between border-t pt-3 text-[10px]">
                <span>Min: $1,000</span>
                <span>Expected Tier: {economicTier}</span>
                <span>Max: $100,000</span>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Tax Revenue Projection Card */}
          {viewMode === "expert" ? (
            <GlassCard depth="base" className="border-border/40">
              <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                  <Percent className="h-5 w-5 text-amber-400" />
                  Tax Revenue Projection
                  <InlineHelpIcon
                    title="Tax Revenue Projection"
                    content="The percentage of GDP collected as tax revenue by the government. The default flat tax rate is inherited from your foundation country's baseline."
                  />
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Customize</span>
                  <Switch
                    checked={isTaxCustom}
                    onCheckedChange={(checked) => {
                      setIsTaxCustom(checked);
                      if (!checked) {
                        onInputsChange({
                          ...safeInputs,
                          fiscalSystem: {
                            ...(safeInputs.fiscalSystem || {}),
                            taxRevenueGDPPercent: defaultTaxRate,
                            governmentRevenueTotal:
                              (sanitizedCoreIndicators.totalPopulation *
                                sanitizedCoreIndicators.gdpPerCapita *
                                defaultTaxRate) /
                              100,
                            taxRevenuePerCapita:
                              (sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
                          },
                        });
                      }
                    }}
                  />
                </div>
              </div>
              <GlassCardContent className="space-y-4 p-6">
                {isTaxCustom ? (
                  <>
                    <SliderWithDirectInput
                      label=""
                      description="Target tax revenue as a percentage of gross domestic product."
                      value={inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20}
                      onChange={(value) => {
                        const taxRate = sanitizeNumber(
                          value,
                          inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20
                        );
                        const clamped = Math.max(5, Math.min(50, taxRate));
                        onInputsChange({
                          ...safeInputs,
                          fiscalSystem: {
                            ...(safeInputs.fiscalSystem || {}),
                            taxRevenueGDPPercent: clamped,
                            governmentRevenueTotal:
                              (sanitizedCoreIndicators.totalPopulation *
                                sanitizedCoreIndicators.gdpPerCapita *
                                clamped) /
                              100,
                            taxRevenuePerCapita:
                              (sanitizedCoreIndicators.gdpPerCapita * clamped) / 100,
                          },
                        });
                      }}
                      min={5}
                      max={50}
                      step={0.5}
                      unit="%"
                      sectionId="core"
                      showValue={true}
                      defaultMode="slider"
                      allowModeToggle={true}
                    />
                    <div className="border-border/20 text-muted-foreground flex justify-between border-t pt-3 text-[10px]">
                      <span>Min: 5%</span>
                      <span>
                        Selected: {(inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20).toFixed(1)}%
                      </span>
                      <span>Max: 50%</span>
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-muted-foreground text-xs leading-normal">
                      Using default flat tax revenue projection of{" "}
                      <strong className="text-foreground">{defaultTaxRate.toFixed(1)}%</strong> of
                      GDP.
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Toggle Customize to adjust target tax revenue rates.
                    </p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          ) : (
            <GlassCard depth="base" className="border-border/40">
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                  <Percent className="h-5 w-5 text-amber-400" />
                  Average Tax Rate
                  <InlineHelpIcon
                    title="Average Tax Rate"
                    content="The percentage of GDP collected by the government. Higher tax rates fund public services but can limit private economic growth."
                  />
                </h3>
              </div>
              <GlassCardContent className="space-y-4 p-6">
                <SliderWithDirectInput
                  label=""
                  description="Average rate of tax collected from the national economy."
                  value={inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20}
                  onChange={(value) => {
                    const taxRate = sanitizeNumber(
                      value,
                      inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20
                    );
                    const clamped = Math.max(5, Math.min(50, taxRate));
                    onInputsChange({
                      ...safeInputs,
                      fiscalSystem: {
                        ...(safeInputs.fiscalSystem || {}),
                        taxRevenueGDPPercent: clamped,
                        governmentRevenueTotal:
                          (sanitizedCoreIndicators.totalPopulation *
                            sanitizedCoreIndicators.gdpPerCapita *
                            clamped) /
                          100,
                        taxRevenuePerCapita: (sanitizedCoreIndicators.gdpPerCapita * clamped) / 100,
                      },
                    });
                  }}
                  min={5}
                  max={50}
                  step={0.5}
                  unit="%"
                  sectionId="core"
                  showValue={true}
                  defaultMode="slider"
                  allowModeToggle={true}
                />
                <div className="border-border/20 text-muted-foreground flex justify-between border-t pt-3 text-[10px]">
                  <span>Min: 5%</span>
                  <span>
                    Selected: {(inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20).toFixed(1)}%
                  </span>
                  <span>Max: 50%</span>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}
        </div>

        {/* Emergent Outcome Card (1/3 width) */}
        <div className="lg:col-span-1">
          <GlassCard
            depth="elevated"
            className="border-border/40 flex h-full flex-col justify-between"
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                <Activity className="h-5 w-5 text-indigo-400" />
                Economic Profile
              </h3>
            </div>
            <GlassCardContent className="flex flex-1 flex-col justify-center space-y-6 p-6">
              <div>
                <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Emergent Economic Output
                </h4>
                <div className="mt-1 text-3xl font-black text-amber-400">
                  <NumberFlowDisplay value={computedGDP} format="currency" decimalPlaces={0} />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Computed dynamically as Population × GDP per Capita
                </p>
              </div>

              <div className="border-border/20 border-t pt-6">
                <div className="mb-2 flex flex-wrap gap-4">
                  <div>
                    <h4 className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                      Economic Classification
                    </h4>
                    <Badge
                      variant="secondary"
                      className="border-yellow-400/50 bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-800 dark:text-yellow-200"
                    >
                      {economicTier}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                      Population Tier
                    </h4>
                    <Badge
                      variant="secondary"
                      className="border-blue-400/50 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-800 dark:text-blue-200"
                    >
                      Tier {populationTier}
                    </Badge>
                  </div>
                </div>
                <p className="text-muted-foreground mt-2 text-xs leading-normal">
                  Your nation's baseline classification defines default tax yields, infrastructure
                  capacity, and starting trade levels.
                </p>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ─── Render Edit Mode (Advanced with circular dials and locks) ───
  return (
    <div className="space-y-8">
      {/* Locked Indicators Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Population Lock Card */}
        <GlassCard depth="base" className="border-border/40 relative overflow-hidden">
          <GlassCardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div className="bg-muted/30 text-muted-foreground rounded-lg p-2">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-foreground flex items-center gap-1.5 text-2xl font-bold">
                {sanitizedCoreIndicators.totalPopulation.toLocaleString()}
                <InlineHelpIcon
                  title="Population Scale"
                  content="Your nation's current citizen count. Drives labor force calculations and domestic service requirements."
                />
              </div>
              <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Population (Tier {populationTier})
              </div>
              <p className="text-muted-foreground/80 mt-1 text-[9px] leading-normal">
                {locks.totalPopulation?.reason ||
                  "Calculated dynamically based on baseline + growth rate."}
              </p>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* GDP per Capita Lock Card */}
        <GlassCard depth="base" className="border-border/40 relative overflow-hidden">
          <GlassCardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div className="bg-muted/30 text-muted-foreground rounded-lg p-2">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-foreground flex items-center gap-1.5 text-2xl font-bold">
                ${sanitizedCoreIndicators.gdpPerCapita.toLocaleString()}
                <InlineHelpIcon
                  title="GDP per Capita"
                  content="Average economic production value per citizen. A general proxy for quality of life and development level."
                />
              </div>
              <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                GDP per Capita ({economicTier})
              </div>
              <p className="text-muted-foreground/80 mt-1 text-[9px] leading-normal">
                {locks.gdpPerCapita?.reason ||
                  "Influenced by economic component synergy and tax policies."}
              </p>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Nominal GDP Lock Card */}
        <GlassCard depth="base" className="border-border/40 relative overflow-hidden">
          <GlassCardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div className="bg-muted/30 text-muted-foreground rounded-lg p-2">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-foreground flex items-center gap-1.5 text-2xl font-bold">
                {formatCurrency(sanitizedCoreIndicators.nominalGDP)}
                <InlineHelpIcon
                  title="Nominal GDP"
                  content="Total gross economic production. Formed strictly by multiplying Population by GDP per Capita."
                />
              </div>
              <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Nominal GDP
              </div>
              <p className="text-muted-foreground/80 mt-1 text-[9px] leading-normal">
                {locks.nominalGDP?.reason || "Calculated as population × GDP per capita."}
              </p>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
