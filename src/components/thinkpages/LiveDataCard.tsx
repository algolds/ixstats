"use client";

import type { ComponentProps, ReactNode } from "react";
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

type Maybe = number | null | undefined;

const isRecorded = (v: Maybe): v is number => typeof v === "number" && Number.isFinite(v);

/** Chart rows for the recorded values only; an unrecorded metric gets no bar. */
function recordedRows(entries: [string, Maybe][]): { name: string; value: number }[] {
  return entries.flatMap(([name, value]) => (isRecorded(value) ? [{ name, value }] : []));
}

const NotRecorded = () => <span aria-label="Not recorded">—</span>;

const money = (val: Maybe) => (isRecorded(val) ? `$${formatCompact(val)}` : <NotRecorded />);

const Strong = ({ children }: { children: ReactNode }) => (
  <span className="text-label font-semibold tabular-nums">{children}</span>
);

type ChartTheme = ComponentProps<typeof GlassBarChart>["theme"];
type ChartRows = Record<string, unknown>[];

const barChart = (data: ChartRows, yKey: string, theme: ChartTheme) =>
  data.length > 0 && (
    <GlassBarChart
      data={data}
      xKey="name"
      yKey={yKey}
      height={125}
      theme={theme}
      hideLegend={true}
      hideGrid={true}
      hideYAxis={true}
    />
  );

const pieChart = (data: ChartRows, theme: ChartTheme) =>
  data.length > 0 && (
    <GlassPieChart
      data={data}
      dataKey="value"
      nameKey="name"
      innerRadius={15}
      outerRadius={38}
      height={125}
      theme={theme}
      hideLegend={true}
    />
  );

/** What a card type shows: header icon + meta caption, the chart (falsy when nothing is recorded) and a footer row. */
interface CardSpec {
  icon: ReactNode;
  meta: ReactNode;
  chart: ReactNode;
  footerLabel: string;
  footer: ReactNode;
}

interface CardData {
  economic: any;
  history: any[];
  relations: any[];
  trade: any;
  vitality: any;
}

const CARD_BUILDERS: Record<LiveDataCardProps["type"], (d: CardData) => CardSpec> = {
  economic_chart: ({ economic, history }) => {
    const rows =
      history.length === 0 && economic?.historical
        ? economic.historical.map((h: any) => ({
            ixTimeTimestamp: new Date(h.year, 0, 1),
            totalGdp: h.gdp,
            population: h.population,
          }))
        : history;
    const points = rows
      .filter((h: any) => h.ixTimeTimestamp && isRecorded(h.totalGdp))
      .slice(-6)
      .map((h: any) => ({
        year: new Date(h.ixTimeTimestamp).getFullYear().toString(),
        gdp: Number((h.totalGdp / 1e12).toFixed(3)), // GDP in Trillions
      }));

    return {
      icon: <TrendingUp className="text-blue" />,
      meta: "GDP Growth",
      chart: points.length > 0 && (
        <GlassLineChart
          data={points}
          xKey="year"
          yKey="gdp"
          area={true}
          height={125}
          theme="blue"
          hideLegend={true}
          hideGrid={true}
          hideYAxis={true}
        />
      ),
      footerLabel: "Recent trajectory",
      footer: <Strong>Current: {money(rows.at(-1)?.totalGdp)}</Strong>,
    };
  },

  diplomatic_map: ({ relations }) => {
    const active = relations.slice(0, 5);
    const data = active
      .filter((rel: any) => isRecorded(rel.strength))
      .map((rel: any) => ({ name: rel.targetCountryName, strength: rel.strength }));
    return {
      icon: <Globe className="text-teal" />,
      meta: `${relations.length} Connections`,
      chart: barChart(data, "strength", "cyan"),
      footerLabel: "Global network",
      footer: <Strong>Top {active.length} Relations</Strong>,
    };
  },

  trade_flow: ({ trade }) => {
    const net = trade ? trade.exports - trade.imports : undefined;
    return {
      icon: <BarChart3 className="text-orange" />,
      meta: "Flow dynamics",
      chart:
        trade &&
        pieChart(
          [
            { name: "Exports", value: trade.exports },
            { name: "Imports", value: trade.imports },
          ],
          "gold"
        ),
      footerLabel: "Net balance",
      footer:
        net === undefined ? (
          <NotRecorded />
        ) : (
          <span
            className={cn(
              "font-semibold tabular-nums",
              net >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {net >= 0 ? "Surplus" : "Deficit"}: {money(Math.abs(net))}
          </span>
        ),
    };
  },

  gdp_growth: ({ economic }) => {
    const growth = economic?.calculatedStats?.gdpGrowth ?? economic?.gdpGrowth;
    const data = recordedRows([
      ["Growth Rate (%)", isRecorded(growth) ? Number((growth * 100).toFixed(1)) : undefined],
    ]);
    return {
      icon: <TrendingUp className="text-green" />,
      meta: "Macro indicators",
      chart: barChart(data, "value", "emerald"),
      footerLabel: "Current total GDP",
      footer: <Strong>{money(economic?.currentTotalGdp ?? economic?.gdp)}</Strong>,
    };
  },

  demographics: ({ economic }) => {
    const data = recordedRows([
      ["Urban (%)", economic?.urbanPopulationPercent],
      ["Rural (%)", economic?.ruralPopulationPercent],
    ]);
    const population = economic?.currentPopulation ?? economic?.population;
    return {
      icon: <Users className="text-teal" />,
      meta: "Demographic split",
      chart: pieChart(data, "emerald"),
      footerLabel: "Population total",
      footer: (
        <Strong>{isRecorded(population) ? population.toLocaleString() : <NotRecorded />}</Strong>
      ),
    };
  },

  budget_debt: ({ economic }) => {
    const debtRatio: Maybe = economic?.totalDebtGDPRatio;
    const data = recordedRows([
      ["Tax Revenue", economic?.taxRevenueGDPPercent],
      ["Spending", economic?.governmentBudgetGDPPercent],
      ["Total Debt", debtRatio],
    ]).map(({ name, value }) => ({ name, percent: value }));
    return {
      icon: <BarChart3 className="text-yellow" />,
      meta: "Fiscal Profile (% of GDP)",
      chart: barChart(data, "percent", "gold"),
      footerLabel: "Debt profile",
      footer: isRecorded(debtRatio) ? (
        <span className={cn("font-semibold", debtRatio > 80 ? "text-destructive" : "text-success")}>
          Debt/GDP: {debtRatio}%
        </span>
      ) : (
        <NotRecorded />
      ),
    };
  },

  labor_market: ({ economic }) => {
    const data = recordedRows([
      ["Unemployment (%)", economic?.unemploymentRate],
      ["Gini Index", economic?.incomeInequalityGini],
      ["Labor Part. (%)", economic?.laborForceParticipationRate],
    ]);
    const income: Maybe = economic?.averageAnnualIncome;
    return {
      icon: <Briefcase className="text-teal" />,
      meta: "Labor dynamics",
      chart: barChart(data, "value", "blue"),
      footerLabel: "Average annual income",
      footer: (
        <Strong>{isRecorded(income) ? `$${income.toLocaleString()}` : <NotRecorded />}</Strong>
      ),
    };
  },

  national_vitality: ({ vitality }) => {
    const data = recordedRows([
      ["Economy", vitality?.economicVitality],
      ["Wellbeing", vitality?.populationWellbeing],
      ["Diplomatic", vitality?.diplomaticStanding],
      ["Government", vitality?.governmentalEfficiency],
    ]).map(({ name, value }) => ({ name, score: value }));
    const overall = data.length
      ? Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length)
      : undefined;
    return {
      icon: <Activity className="text-red" />,
      meta: "Vitality indicators",
      chart: barChart(data, "score", "red"),
      footerLabel: "Overall score",
      footer: <Strong>{overall === undefined ? <NotRecorded /> : overall}</Strong>,
    };
  },
};

const ECONOMIC_TYPES = new Set<LiveDataCardProps["type"]>([
  "gdp_growth",
  "demographics",
  "budget_debt",
  "economic_chart",
  "labor_market",
]);

/** Resolves the card's data from preloaded props, else from only the queries its type needs. */
function useCardData(
  type: LiveDataCardProps["type"],
  countryId: string,
  preloadedData: LiveDataCardProps["preloadedData"]
): CardData | undefined {
  const canQuery = !preloadedData && !!countryId;
  const options = (enabled: boolean) => ({ enabled: canQuery && enabled, staleTime: 5 * 60_000 });

  const economic = api.countries.getByIdWithEconomicData.useQuery(
    { id: countryId },
    options(ECONOMIC_TYPES.has(type))
  );
  const history = api.historical.getCountryHistory.useQuery(
    { countryId, limit: 10 },
    options(type === "economic_chart")
  );
  const relations = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    options(type === "diplomatic_map")
  );
  const trade = api.countries.getTradeData.useQuery({ countryId }, options(type === "trade_flow"));
  const vitality = api.countries.getActivityRingsData.useQuery(
    { countryId },
    options(type === "national_vitality")
  );

  if (!preloadedData && [economic, history, relations, trade, vitality].some((q) => q.isLoading)) {
    return undefined;
  }
  return {
    economic: preloadedData?.economicData ?? economic.data,
    history: preloadedData?.gdpHistoryData ?? history.data ?? [],
    relations: preloadedData?.diplomaticData ?? relations.data ?? [],
    trade: preloadedData?.tradeData ?? trade.data,
    vitality: preloadedData?.vitalityData ?? vitality.data,
  };
}

export function LiveDataCard({ type, title, countryId, preloadedData }: LiveDataCardProps) {
  const data = useCardData(type, countryId, preloadedData);

  if (!data) {
    return (
      <div className="bg-surface-secondary rounded-row flex h-36 w-full items-center justify-center">
        <Loader2 className="text-label-secondary size-5 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  const { icon, meta, chart, footerLabel, footer } = CARD_BUILDERS[type](data);

  return (
    <div className="bg-surface-secondary rounded-row border-separator overflow-hidden border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-headline text-label flex items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
          {icon}
          {title}
        </span>
        <span className="text-footnote text-label-secondary">{meta}</span>
      </div>
      {chart ? (
        <div className="h-[125px] w-full">{chart}</div>
      ) : (
        <div className="text-footnote text-label-secondary flex h-[125px] w-full items-center justify-center">
          No recorded data
        </div>
      )}
      <div className="border-separator text-footnote text-label-secondary mt-2 flex items-center justify-between border-t pt-2">
        <span>{footerLabel}</span>
        {footer}
      </div>
    </div>
  );
}
