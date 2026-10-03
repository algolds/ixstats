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

type Maybe = number | null | undefined;

const isRecorded = (v: Maybe): v is number => typeof v === "number" && Number.isFinite(v);

/** Chart rows for the recorded values only; an unrecorded metric gets no bar. */
function recordedRows(entries: [string, Maybe][]): { name: string; value: number }[] {
  return entries.flatMap(([name, value]) => (isRecorded(value) ? [{ name, value }] : []));
}

const NotRecorded = () => <span aria-label="Not recorded">—</span>;

function NoRecordedData() {
  return (
    <div className="text-footnote text-label-secondary flex h-[125px] w-full items-center justify-center">
      No recorded data
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

  const formatMoney = (val: Maybe) =>
    isRecorded(val) ? `$${formatCompact(val)}` : <NotRecorded />;

  // 1. GDP Growth Trajectory
  if (type === "economic_chart") {
    if (rawHistory.length === 0 && economicData?.historical) {
      rawHistory = economicData.historical.map((h: any) => ({
        ixTimeTimestamp: new Date(h.year, 0, 1),
        totalGdp: h.gdp,
        population: h.population,
      }));
    }

    const chartPoints = rawHistory
      .filter((h: any) => h.ixTimeTimestamp && isRecorded(h.totalGdp))
      .slice(-6)
      .map((h: any) => ({
        year: new Date(h.ixTimeTimestamp).getFullYear().toString(),
        gdp: Number((h.totalGdp / 1e12).toFixed(3)), // GDP in Trillions
      }));

    const currentGdp = rawHistory[rawHistory.length - 1]?.totalGdp;

    return (
      <DataCardFrame icon={<TrendingUp className="text-blue" />} title={title} meta="GDP Growth">
        {chartPoints.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

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
    const activeRelations = relations.slice(0, 5);

    const chartData = activeRelations
      .filter((rel: any) => isRecorded(rel.strength))
      .map((rel: any) => ({
        name: rel.targetCountryName,
        strength: rel.strength,
      }));

    return (
      <DataCardFrame
        icon={<Globe className="text-teal" />}
        title={title}
        meta={`${relations.length} Connections`}
      >
        {chartData.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

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
    const netTrade = trade ? trade.exports - trade.imports : undefined;

    return (
      <DataCardFrame
        icon={<BarChart3 className="text-orange" />}
        title={title}
        meta="Flow dynamics"
      >
        {trade ? (
          <div className="h-[125px] w-full">
            <GlassPieChart
              data={[
                { name: "Exports", value: trade.exports },
                { name: "Imports", value: trade.imports },
              ]}
              dataKey="value"
              nameKey="name"
              innerRadius={15}
              outerRadius={38}
              height={125}
              theme="gold"
              hideLegend={true}
            />
          </div>
        ) : (
          <NoRecordedData />
        )}

        <DataCardFooter label="Net balance">
          {netTrade === undefined ? (
            <NotRecorded />
          ) : (
            <span
              className={cn(
                "font-semibold tabular-nums",
                netTrade >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {netTrade >= 0 ? "Surplus" : "Deficit"}: {formatMoney(Math.abs(netTrade))}
            </span>
          )}
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  // 4. Economic Performance Overview (GDP Growth Stats)
  if (type === "gdp_growth") {
    const growthRate = economicData?.calculatedStats?.gdpGrowth ?? economicData?.gdpGrowth;
    const gdpVal = economicData?.currentTotalGdp ?? economicData?.gdp;

    const barData = recordedRows([
      [
        "Growth Rate (%)",
        isRecorded(growthRate) ? Number((growthRate * 100).toFixed(1)) : undefined,
      ],
    ]);

    return (
      <DataCardFrame
        icon={<TrendingUp className="text-green" />}
        title={title}
        meta="Macro indicators"
      >
        {barData.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

        <DataCardFooter label="Current total GDP">
          <span className="text-label font-semibold tabular-nums">{formatMoney(gdpVal)}</span>
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  // 5. Demographics Profile
  if (type === "demographics") {
    const pieData = recordedRows([
      ["Urban (%)", economicData?.urbanPopulationPercent],
      ["Rural (%)", economicData?.ruralPopulationPercent],
    ]);
    const popVal = economicData?.currentPopulation ?? economicData?.population;

    return (
      <DataCardFrame icon={<Users className="text-teal" />} title={title} meta="Demographic split">
        {pieData.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

        <DataCardFooter label="Population total">
          <span className="text-label font-semibold tabular-nums">
            {isRecorded(popVal) ? popVal.toLocaleString() : <NotRecorded />}
          </span>
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  // 6. Fiscal Budget & Debt
  if (type === "budget_debt") {
    const debtRatio: Maybe = economicData?.totalDebtGDPRatio;
    const chartData = recordedRows([
      ["Tax Revenue", economicData?.taxRevenueGDPPercent],
      ["Spending", economicData?.governmentBudgetGDPPercent],
      ["Total Debt", debtRatio],
    ]).map(({ name, value }) => ({ name, percent: value }));

    return (
      <DataCardFrame
        icon={<BarChart3 className="text-yellow" />}
        title={title}
        meta="Fiscal Profile (% of GDP)"
      >
        {chartData.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

        <DataCardFooter label="Debt profile">
          {isRecorded(debtRatio) ? (
            <span
              className={cn("font-semibold", debtRatio > 80 ? "text-destructive" : "text-success")}
            >
              Debt/GDP: {debtRatio}%
            </span>
          ) : (
            <NotRecorded />
          )}
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  // 7. Labor Market & Income Distribution
  if (type === "labor_market") {
    const barData = recordedRows([
      ["Unemployment (%)", economicData?.unemploymentRate],
      ["Gini Index", economicData?.incomeInequalityGini],
      ["Labor Part. (%)", economicData?.laborForceParticipationRate],
    ]);
    const income: Maybe = economicData?.averageAnnualIncome;

    return (
      <DataCardFrame icon={<Briefcase className="text-teal" />} title={title} meta="Labor dynamics">
        {barData.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

        <DataCardFooter label="Average annual income">
          <span className="text-label font-semibold tabular-nums">
            {isRecorded(income) ? `$${income.toLocaleString()}` : <NotRecorded />}
          </span>
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  // 8. National Vitality & Well-being
  if (type === "national_vitality") {
    const chartData = recordedRows([
      ["Economy", vitality?.economicVitality],
      ["Wellbeing", vitality?.populationWellbeing],
      ["Diplomatic", vitality?.diplomaticStanding],
      ["Government", vitality?.governmentalEfficiency],
    ]).map(({ name, value }) => ({ name, score: value }));

    const overall = chartData.length
      ? Math.round(chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length)
      : undefined;

    return (
      <DataCardFrame
        icon={<Activity className="text-red" />}
        title={title}
        meta="Vitality indicators"
      >
        {chartData.length === 0 ? (
          <NoRecordedData />
        ) : (
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
        )}

        <DataCardFooter label="Overall score">
          <span className="text-label font-semibold tabular-nums">
            {overall === undefined ? <NotRecorded /> : overall}
          </span>
        </DataCardFooter>
      </DataCardFrame>
    );
  }

  return null;
}
