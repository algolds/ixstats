"use client";

import React from "react";
import {
  StatUp as TrendingUp,
  Globe,
  StatsReport as BarChart3,
  SystemRestart as Loader2,
  Group as Users,
  Suitcase as Briefcase,
  Activity,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { formatCompact } from "~/lib/format/compact";
import { api } from "~/trpc/react";
import { GlassLineChart, GlassBarChart, GlassPieChart } from "~/components/shared/charts";

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

/** Inset data panel inside a post: icon + title, a meta caption, the chart and a footer row. */
function DataCardFrame({
  icon,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-secondary rounded-row border-separator overflow-hidden border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-headline text-label flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
          {icon}
          {title}
        </span>
        <span className="text-footnote text-label-secondary">{meta}</span>
      </div>
      {children}
    </div>
  );
}

function DataCardFooter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-separator text-footnote text-label-secondary mt-2 flex items-center justify-between border-t pt-2">
      <span>{label}</span>
      {children}
    </div>
  );
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
      <div className="bg-surface-secondary rounded-row flex h-36 w-full items-center justify-center">
        <Loader2 className="text-label-secondary size-5 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  // Extract data from props or tRPC queries
  const economicData = preloadedData?.economicData ?? economicQuery.data;
  let rawHistory = preloadedData?.gdpHistoryData ?? historyQuery.data ?? [];
  const relations = preloadedData?.diplomaticData ?? diplomaticQuery.data ?? [];
  const trade = preloadedData?.tradeData ?? tradeQuery.data;
  const vitality = preloadedData?.vitalityData ?? vitalityQuery.data;

  const formatMoney = (val: number) => `$${formatCompact(val)}`;

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
      <DataCardFrame icon={<TrendingUp className="text-blue" />} title={title} meta="GDP Growth">
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

        <DataCardFooter label="Recent trajectory">
          <span className="text-label font-semibold tabular-nums">
            Current: {formatMoney(currentGdp)}
          </span>
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  // 2. Diplomatic Relations Map
  if (type === "diplomatic_map") {
    const activeRelations =
      relations.length > 0
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
      <DataCardFrame
        icon={<Globe className="text-teal" />}
        title={title}
        meta={`${relations.length || 3} Connections`}
      >
        <div className="h-[125px] w-full">
          <GlassBarChart
            data={chartData}
            xKey="name"
            yKey="strength"
            height={125}
            theme="cyan"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <DataCardFooter label="Global network">
          <span className="text-label font-semibold tabular-nums">
            Top {activeRelations.length} Relations
          </span>
        </DataCardFooter>
      </DataCardFrame>
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
      <DataCardFrame
        icon={<BarChart3 className="text-orange" />}
        title={title}
        meta="Flow dynamics"
      >
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

        <DataCardFooter label="Net balance">
          <span
            className={cn(
              "font-semibold tabular-nums",
              netTrade >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {netTrade >= 0 ? "Surplus" : "Deficit"}: {formatMoney(Math.abs(netTrade))}
          </span>
        </DataCardFooter>
      </DataCardFrame>
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
      <DataCardFrame
        icon={<TrendingUp className="text-green" />}
        title={title}
        meta="Macro indicators"
      >
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

        <DataCardFooter label="Current total GDP">
          <span className="text-label font-semibold tabular-nums">{formatMoney(gdpVal)}</span>
        </DataCardFooter>
      </DataCardFrame>
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
      <DataCardFrame icon={<Users className="text-teal" />} title={title} meta="Demographic split">
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

        <DataCardFooter label="Population total">
          <span className="text-label font-semibold tabular-nums">{popVal.toLocaleString()}</span>
        </DataCardFooter>
      </DataCardFrame>
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
      <DataCardFrame
        icon={<BarChart3 className="text-yellow" />}
        title={title}
        meta="Fiscal Profile (% of GDP)"
      >
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

        <DataCardFooter label="Debt profile">
          <span
            className={cn(
              "font-semibold",
              activeEcon.totalDebtGDPRatio > 80 ? "text-destructive" : "text-success"
            )}
          >
            Debt/GDP: {activeEcon.totalDebtGDPRatio || 55}%
          </span>
        </DataCardFooter>
      </DataCardFrame>
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
      <DataCardFrame icon={<Briefcase className="text-teal" />} title={title} meta="Labor dynamics">
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

        <DataCardFooter label="Average annual income">
          <span className="text-label font-semibold tabular-nums">
            ${(activeEcon.averageAnnualIncome || 35000).toLocaleString()}
          </span>
        </DataCardFooter>
      </DataCardFrame>
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
      <DataCardFrame
        icon={<Activity className="text-red" />}
        title={title}
        meta="Vitality indicators"
      >
        <div className="h-[125px] w-full">
          <GlassBarChart
            data={chartData}
            xKey="name"
            yKey="score"
            height={125}
            theme="red"
            hideLegend={true}
            hideGrid={true}
            hideYAxis={true}
          />
        </div>

        <DataCardFooter label="Overall health status">
          <span className="text-success font-semibold">Active</span>
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  return null;
}
