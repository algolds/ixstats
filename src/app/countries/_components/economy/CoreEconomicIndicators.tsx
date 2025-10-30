"use client";

import React, { useState } from "react";
import { DollarSign, Users, Globe, BarChart3, Info } from "lucide-react";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { formatCurrency, formatPopulation, formatPercentage } from "./utils";
import { getTierStyle } from "~/lib/theme-utils";

export interface CoreEconomicIndicators {
  totalPopulation: number;
  nominalGDP: number;
  gdpPerCapita: number;
  realGDPGrowthRate: number;
  inflationRate: number;
  currencyExchangeRate: number;
  giniCoefficient?: number;
}

export interface RealCountryData {
  name: string;
  population: number;
  gdpPerCapita: number;
  taxRevenuePercent: number;
  unemploymentRate: number;
}

interface CoreEconomicIndicatorsProps {
  indicators: CoreEconomicIndicators;
  referenceCountry?: RealCountryData;
  /** SERVER ACTION */
  onIndicatorsChangeAction: (i: CoreEconomicIndicators) => void;
  isReadOnly?: boolean;
  showComparison?: boolean;
}

function getEconomicTier(gdp: number): string {
  if (gdp >= 65000) return "Extravagant";
  if (gdp >= 55000) return "Very Strong";
  if (gdp >= 45000) return "Strong";
  if (gdp >= 35000) return "Healthy";
  if (gdp >= 25000) return "Developed";
  if (gdp >= 10000) return "Developing";
  return "Impoverished";
}

function computeHealth(g: number, i: number) {
  if (g > 0.04 && i < 0.03) return { label: "Excellent", color: "text-green-600" };
  if (g > 0.02 && i < 0.05) return { label: "Good", color: "text-blue-600" };
  if (g > 0 && i < 0.08) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Concerning", color: "text-red-600" };
}

export function CoreEconomicIndicators({
  indicators,
  referenceCountry,
  onIndicatorsChangeAction,
  isReadOnly = false,
  showComparison = true,
}: CoreEconomicIndicatorsProps) {
  const [view, setView] = useState<"overview" | "detailed">("overview");
  const tier = getEconomicTier(indicators.gdpPerCapita);
  const tierStyle = getTierStyle(tier);
  const health = computeHealth(indicators.realGDPGrowthRate, indicators.inflationRate);

  function handleField<K extends keyof CoreEconomicIndicators>(field: K, value: number) {
    const next = { ...indicators, [field]: value };
    if (field === "totalPopulation" || field === "nominalGDP") {
      next.gdpPerCapita = next.nominalGDP / next.totalPopulation;
    } else if (field === "gdpPerCapita") {
      next.nominalGDP = next.gdpPerCapita * next.totalPopulation;
    }
    onIndicatorsChangeAction(next);
  }

  const comparison = referenceCountry
    ? [
        {
          label: "GDP per Capita",
          user: indicators.gdpPerCapita,
          ref: referenceCountry.gdpPerCapita,
          fmt: formatCurrency,
          Icon: DollarSign,
        },
        {
          label: "Population",
          user: indicators.totalPopulation,
          ref: referenceCountry.population,
          fmt: formatPopulation,
          Icon: Users,
        },
        {
          label: "Total GDP",
          user: indicators.nominalGDP,
          ref: referenceCountry.population * referenceCountry.gdpPerCapita,
          fmt: formatCurrency,
          Icon: Globe,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="text-primary h-5 w-5" />
            Core Economic Indicators
          </h3>
          <p className="text-muted-foreground text-sm">Fundamental metrics and performance</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overview Comparison */}
      <TabsContent value="overview" className="space-y-4">
        {showComparison && referenceCountry && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {comparison.map(({ label, user, ref, fmt, Icon }) => {
              const diff = ((user - ref) / ref) * 100;
              const positive = diff >= 0;
              return (
                <GlassCard key={label} variant="glass">
                  <div className="flex items-center justify-between pb-2">
                    <h4 className="text-sm font-medium">{label}</h4>
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{fmt(user)}</div>
                    {label === "GDP per Capita" && (
                      <Badge className={tierStyle.className}>{tier}</Badge>
                    )}
                    <div className="text-muted-foreground text-xs">Ref: {fmt(ref)}</div>
                    <div
                      className={`text-xs font-medium ${
                        positive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {diff.toFixed(1)}%
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* Detailed Inputs */}
      <TabsContent value="detailed" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Population & Output */}
          <GlassCard variant="glass">
            <div className="flex items-center gap-2 pb-2">
              <Users className="text-primary h-4 w-4" />
              <h4 className="text-sm font-medium">Population & Output</h4>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="pop">Total Population</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">
                    {formatPopulation(indicators.totalPopulation)}
                  </div>
                ) : (
                  <Input
                    id="pop"
                    type="number"
                    value={indicators.totalPopulation}
                    onChange={(e) => handleField("totalPopulation", +e.target.value || 0)}
                    step={1000}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="gpc">GDP per Capita ($)</Label>
                {isReadOnly ? (
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">
                      {formatCurrency(indicators.gdpPerCapita)}
                    </div>
                    <Badge className={tierStyle.className}>{tier}</Badge>
                  </div>
                ) : (
                  <Input
                    id="gpc"
                    type="number"
                    value={indicators.gdpPerCapita}
                    onChange={(e) => handleField("gdpPerCapita", +e.target.value || 0)}
                    step={100}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="ngdp">Nominal GDP ($)</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">{formatCurrency(indicators.nominalGDP)}</div>
                ) : (
                  <Input
                    id="ngdp"
                    type="number"
                    value={indicators.nominalGDP}
                    onChange={(e) => handleField("nominalGDP", +e.target.value || 0)}
                    step={1_000_000}
                  />
                )}
              </div>
            </div>
          </GlassCard>

          {/* Growth & Stability */}
          <GlassCard variant="glass">
            <div className="flex items-center gap-2 pb-2">
              <BarChart3 className="text-primary h-4 w-4" />
              <h4 className="text-sm font-medium">Growth & Stability</h4>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="growth">Real GDP Growth</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">
                    {formatPercentage(indicators.realGDPGrowthRate * 100)}
                  </div>
                ) : (
                  <>
                    <Slider
                      id="growth"
                      value={[indicators.realGDPGrowthRate * 100]}
                      onValueChange={(vals) => {
                        const v = vals?.[0] ?? 0;
                        handleField("realGDPGrowthRate", v / 100);
                      }}
                      min={-5}
                      max={10}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>-5%</span>
                      <span className="font-medium">
                        {formatPercentage(indicators.realGDPGrowthRate * 100)}
                      </span>
                      <span>10%</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                <Label htmlFor="inflation">Inflation Rate</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">
                    {formatPercentage(indicators.inflationRate * 100)}
                  </div>
                ) : (
                  <>
                    <Slider
                      id="inflation"
                      value={[indicators.inflationRate * 100]}
                      onValueChange={(vals) => {
                        const v = vals?.[0] ?? 0;
                        handleField("inflationRate", v / 100);
                      }}
                      min={0}
                      max={15}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>0%</span>
                      <span className="font-medium">
                        {formatPercentage(indicators.inflationRate * 100)}
                      </span>
                      <span>15%</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                <Label htmlFor="fx">Exchange Rate (USD=1)</Label>
                {isReadOnly ? (
                  <div className="text-2xl font-bold">
                    {indicators.currencyExchangeRate.toFixed(2)}
                  </div>
                ) : (
                  <Input
                    id="fx"
                    type="number"
                    value={indicators.currencyExchangeRate}
                    onChange={(e) => handleField("currencyExchangeRate", +e.target.value || 1)}
                    step={0.01}
                    min={0.01}
                  />
                )}
              </div>
            </div>
          </GlassCard>
        </div>
      </TabsContent>

      {/* Health Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">
            Economic Health: <span className={health.color}>{health.label}</span>
          </div>
          <p className="text-sm">
            Based on {formatPercentage(indicators.realGDPGrowthRate * 100)} growth &
            {formatPercentage(indicators.inflationRate * 100)} inflation.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
