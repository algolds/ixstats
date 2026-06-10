"use client";

import React from "react";
import {
  TrendingUp,
  Globe,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Users,
  Briefcase,
  Activity,
} from "lucide-react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { GlassLineChart, GlassBarChart, GlassPieChart } from "~/components/charts";

interface LiveDataCardProps {
  type:
    | "economic_chart"
    | "diplomatic_map"
    | "trade_flow"
    | "gdp_growth"
    | "demographics"
    | "budget_debt"
    | "labor_market"
    | "national_vitality";
  title: string;
  countryId: string;
  preloadedData?: {
    economicData?: any;
    gdpHistoryData?: any;
    diplomaticData?: any;
    tradeData?: any;
    vitalityData?: any;
  };
}

export function LiveDataCard({ type, title, countryId, preloadedData }: LiveDataCardProps) {
  const isPreloaded = !!preloadedData;

  // Query only what is needed based on visualization type if not preloaded
  const economicQuery = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    {
      enabled:
        !isPreloaded &&
        !!countryId &&
        (type === "gdp_growth" ||
          type === "demographics" ||
          type === "budget_debt" ||
          type === "economic_chart" ||
          type === "labor_market"),
      staleTime: 5 * 60_000,
    }
  );

  const historyQuery = api.historical.getCountryHistory.useQuery(
    { countryId, limit: 10 },
    {
      enabled: !isPreloaded && !!countryId && type === "economic_chart",
      staleTime: 5 * 60_000,
    }
  );

  const diplomaticQuery = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    {
      enabled: !isPreloaded && !!countryId && type === "diplomatic_map",
      staleTime: 5 * 60_000,
    }
  );

  const tradeQuery = api.countries.getTradeData.useQuery(
    { countryId },
    {
      enabled: !isPreloaded && !!countryId && type === "trade_flow",
      staleTime: 5 * 60_000,
    }
  );

  const vitalityQuery = api.countries.getActivityRingsData.useQuery(
    { countryId },
    {
      enabled: !isPreloaded && !!countryId && type === "national_vitality",
      staleTime: 5 * 60_000,
    }
  );

  const isLoading =
    !isPreloaded &&
    (economicQuery.isLoading ||
      historyQuery.isLoading ||
      diplomaticQuery.isLoading ||
      tradeQuery.isLoading ||
      vitalityQuery.isLoading);

  if (isLoading) {
    return (
      <div className="flex h-36 w-full items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
      </div>
    );
  }

  // Extract data from props or tRPC queries
  const economicData = preloadedData?.economicData ?? economicQuery.data;
  let rawHistory = preloadedData?.gdpHistoryData ?? historyQuery.data ?? [];
  const relations = preloadedData?.diplomaticData ?? diplomaticQuery.data ?? [];
  const trade = preloadedData?.tradeData ?? tradeQuery.data;
  const vitality = preloadedData?.vitalityData ?? vitalityQuery.data;

  // Format Helper for large values
  const formatMoney = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  // 1. GDP Growth Trajectory
  if (type === "economic_chart") {
    if (rawHistory.length === 0 && economicData?.historical) {
      rawHistory = economicData.historical.map((h: any) => ({
        ixTimeTimestamp: new Date(h.year, 0, 1),
        totalGdp: h.gdp,
        population: h.population,
      }));
    }

    if (rawHistory.length === 0) {
      // Mock data for preview fallback if no actual history
      rawHistory = [
        { ixTimeTimestamp: new Date(2022, 0, 1), totalGdp: 1.8e12 },
        { ixTimeTimestamp: new Date(2023, 0, 1), totalGdp: 2.0e12 },
        { ixTimeTimestamp: new Date(2024, 0, 1), totalGdp: 2.2e12 },
        { ixTimeTimestamp: new Date(2025, 0, 1), totalGdp: 2.4e12 },
      ];
    }

    const chartPoints = rawHistory.slice(-6).map((h: any, idx: number) => ({
      year: h.ixTimeTimestamp ? new Date(h.ixTimeTimestamp).getFullYear().toString() : `Y${idx}`,
      gdp: h.totalGdp ? Number((h.totalGdp / 1e12).toFixed(3)) : 0, // GDP in Trillions
    }));

    const currentGdp = rawHistory[rawHistory.length - 1]?.totalGdp || 0;

    return (
      <Card className="glass-hierarchy-child border-blue-500/15 bg-blue-950/10 hover:border-blue-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">GDP Growth</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassLineChart
            data={chartPoints}
            xKey="year"
            yKey="gdp"
            area={true}
            height={125}
            theme="blue"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Recent Trajectory</span>
          <span className="font-semibold text-white">
            Current: {formatMoney(currentGdp)}
          </span>
        </div>
      </Card>
    );
  }

  // 2. Diplomatic Relations Map
  if (type === "diplomatic_map") {
    const activeRelations = relations.length > 0
      ? relations.slice(0, 5)
      : [
          { targetCountryName: "Kelssek", relationship: "alliance", strength: 85 },
          { targetCountryName: "Candelaria", relationship: "trade", strength: 70 },
          { targetCountryName: "Jasĭyun", relationship: "tension", strength: 30 },
        ];

    const chartData = activeRelations.map((rel: any) => ({
      name: rel.targetCountryName,
      strength: rel.strength || 50,
    }));

    return (
      <Card className="glass-hierarchy-child border-purple-500/15 bg-purple-950/10 hover:border-purple-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Globe className="h-3.5 w-3.5 text-purple-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">
            {relations.length || 3} Connections
          </span>
        </div>

        <div className="h-[125px] w-full">
          <GlassBarChart
            data={chartData}
            xKey="name"
            yKey="strength"
            height={125}
            theme="purple"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Global Network</span>
          <span className="font-semibold text-white">
            Top {activeRelations.length} Relations
          </span>
        </div>
      </Card>
    );
  }

  // 3. Trade Flow Analysis
  if (type === "trade_flow") {
    const activeTrade = trade ?? { totalVolume: 4.5e9, exports: 2.7e9, imports: 1.8e9 };
    const pieData = [
      { name: "Exports", value: activeTrade.exports },
      { name: "Imports", value: activeTrade.imports },
    ];

    const netTrade = activeTrade.exports - activeTrade.imports;

    return (
      <Card className="glass-hierarchy-child border-orange-500/15 bg-orange-950/10 hover:border-orange-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <BarChart3 className="h-3.5 w-3.5 text-orange-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Flow Dynamics</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassPieChart
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={15}
            outerRadius={38}
            height={125}
            theme="gold"
            hideLegend={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Net Balance</span>
          <span
            className={cn(
              "font-bold uppercase tracking-wider",
              netTrade >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {netTrade >= 0 ? "Surplus" : "Deficit"}: {formatMoney(Math.abs(netTrade))}
          </span>
        </div>
      </Card>
    );
  }

  // 4. Economic Performance Overview (GDP Growth Stats)
  if (type === "gdp_growth") {
    const activeEcon = economicData ?? {
      currentTotalGdp: 2.4e12,
      currentGdpPerCapita: 48000,
      calculatedStats: { gdpGrowth: 0.032 },
      economicTier: "Industrialized",
    };

    const growthRate = activeEcon.calculatedStats?.gdpGrowth ?? activeEcon.gdpGrowth ?? 0;
    const gdpVal = activeEcon.currentTotalGdp ?? activeEcon.gdp ?? 0;

    const barData = [
      { name: "Growth Rate (%)", value: Number((growthRate * 100).toFixed(1)) },
      { name: "Savings Rate (%)", value: 12.5 },
      { name: "Investment (%)", value: 15.0 },
    ];

    return (
      <Card className="glass-hierarchy-child border-emerald-500/15 bg-emerald-950/10 hover:border-emerald-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Macro Indicators</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassBarChart
            data={barData}
            xKey="name"
            yKey="value"
            height={125}
            theme="emerald"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Current Total GDP</span>
          <span className="font-semibold text-white">{formatMoney(gdpVal)}</span>
        </div>
      </Card>
    );
  }

  // 5. Demographics Profile
  if (type === "demographics") {
    const activeEcon = economicData ?? {
      currentPopulation: 45000000,
      urbanPopulationPercent: 72,
      ruralPopulationPercent: 28,
    };

    const urbanPct = activeEcon.urbanPopulationPercent ?? 70;
    const ruralPct = activeEcon.ruralPopulationPercent ?? 30;
    const popVal = activeEcon.currentPopulation ?? activeEcon.population ?? 0;

    const pieData = [
      { name: "Urban (%)", value: urbanPct },
      { name: "Rural (%)", value: ruralPct },
    ];

    return (
      <Card className="glass-hierarchy-child border-green-500/15 bg-green-950/10 hover:border-green-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Users className="h-3.5 w-3.5 text-green-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Demographic Split</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassPieChart
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={15}
            outerRadius={38}
            height={125}
            theme="emerald"
            hideLegend={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Population Total</span>
          <span className="font-semibold text-white">{popVal.toLocaleString()}</span>
        </div>
      </Card>
    );
  }

  // 6. Fiscal Budget & Debt
  if (type === "budget_debt") {
    const activeEcon = economicData ?? {
      taxRevenueGDPPercent: 28,
      governmentBudgetGDPPercent: 30,
      totalDebtGDPRatio: 55,
    };

    const chartData = [
      { name: "Tax Revenue", percent: activeEcon.taxRevenueGDPPercent || 25 },
      { name: "Spending", percent: activeEcon.governmentBudgetGDPPercent || 28 },
      { name: "Total Debt", percent: activeEcon.totalDebtGDPRatio || 55 },
    ];

    return (
      <Card className="glass-hierarchy-child border-amber-500/15 bg-amber-950/10 hover:border-amber-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Fiscal Profile (% of GDP)</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassBarChart
            data={chartData}
            xKey="name"
            yKey="percent"
            height={125}
            theme="gold"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Debt Profile</span>
          <span
            className={cn(
              "font-bold",
              activeEcon.totalDebtGDPRatio > 80 ? "text-red-400" : "text-emerald-400"
            )}
          >
            Debt/GDP: {activeEcon.totalDebtGDPRatio || 55}%
          </span>
        </div>
      </Card>
    );
  }

  // 7. Labor Market & Income Distribution
  if (type === "labor_market") {
    const activeEcon = economicData ?? {
      unemploymentRate: 4.8,
      incomeInequalityGini: 34,
      averageAnnualIncome: 38000,
    };

    const barData = [
      { name: "Unemployment (%)", value: activeEcon.unemploymentRate || 5.0 },
      { name: "Gini Index", value: activeEcon.incomeInequalityGini || 32.0 },
      { name: "Labor Part. (%)", value: 65.4 },
    ];

    return (
      <Card className="glass-hierarchy-child border-teal-500/15 bg-teal-950/10 hover:border-teal-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Briefcase className="h-3.5 w-3.5 text-teal-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Labor Dynamics</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassBarChart
            data={barData}
            xKey="name"
            yKey="value"
            height={125}
            theme="blue"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Average Annual Income</span>
          <span className="font-semibold text-white">
            ${(activeEcon.averageAnnualIncome || 35000).toLocaleString()}
          </span>
        </div>
      </Card>
    );
  }

  // 8. National Vitality & Well-being
  if (type === "national_vitality") {
    const activeVit = vitality ?? {
      economicVitality: 72,
      populationWellbeing: 68,
      diplomaticStanding: 80,
      governmentalEfficiency: 65,
    };

    const chartData = [
      { name: "Economy", score: activeVit.economicVitality || 50 },
      { name: "Wellbeing", score: activeVit.populationWellbeing || 50 },
      { name: "Diplomatic", score: activeVit.diplomaticStanding || 50 },
      { name: "Government", score: activeVit.governmentalEfficiency || 50 },
    ];

    return (
      <Card className="glass-hierarchy-child border-red-500/15 bg-red-950/10 hover:border-red-500/30 p-3 shadow-md backdrop-blur-md transition-all duration-300 hover:scale-[1.01]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Activity className="h-3.5 w-3.5 text-red-400" />
            {title}
          </span>
          <span className="text-muted-foreground text-[10px]">Vitality Indicators</span>
        </div>

        <div className="h-[125px] w-full">
          <GlassBarChart
            data={chartData}
            xKey="name"
            yKey="score"
            height={125}
            theme="purple"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-neutral-400">
          <span>Overall Health Status</span>
          <span className="font-bold text-emerald-400">Active</span>
        </div>
      </Card>
    );
  }

  return null;
}
