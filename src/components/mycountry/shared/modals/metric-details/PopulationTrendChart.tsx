"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  Line,
  ComposedChart,
  Bar,
} from "recharts";
import { formatPopulation } from "~/lib/utils/format-utils";
import { realmYear } from "~/lib/realms/nation-time";
import type { RealmCalendar } from "~/lib/realms/realm-clock";
import type { PopulationChartDataPoint } from "~/lib/mycountry/population-details";
import { CHART_TOOLTIP_STYLE, type ChartType } from "./types";

export const POPULATION_COLOR = "var(--chart-2)";

function tooltipFormatter(value: unknown, name: unknown): [string, string] {
  if (name === "population") return [formatPopulation(value as number), "Population"];
  if (name === "populationGrowthRate") return [`${(value as number).toFixed(3)}%`, "Growth Rate"];
  return [String(value ?? ""), String(name ?? "")];
}

/** The trend chart in the format picked in the modal header; "composed" adds the growth-rate bars. */
export function PopulationTrendChart({
  data,
  chartType,
  calendar,
}: {
  data: PopulationChartDataPoint[];
  chartType: ChartType;
  calendar: RealmCalendar;
}) {
  const yearOf = (ts: unknown) => realmYear(ts as number, calendar);
  const showsArea = chartType === "area" || chartType === "composed";
  const populationSeries = {
    line: (
      <Line
        yAxisId="population"
        type="monotone"
        dataKey="population"
        stroke={POPULATION_COLOR}
        strokeWidth={3}
        dot={false}
        name="Population"
      />
    ),
    bar: (
      <Bar
        yAxisId="population"
        dataKey="population"
        fill={POPULATION_COLOR}
        radius={[4, 4, 0, 0]}
        name="Population"
      />
    ),
    area: (
      <Area
        yAxisId="population"
        type="monotone"
        dataKey="population"
        stroke={POPULATION_COLOR}
        fillOpacity={1}
        fill="url(#popColor)"
        strokeWidth={3}
        name="Population"
      />
    ),
  };

  return (
    <ComposedChart data={data}>
      {showsArea && (
        <defs>
          <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={POPULATION_COLOR} stopOpacity={0.25} />
            <stop offset="95%" stopColor={POPULATION_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" />
      <XAxis
        dataKey="timestamp"
        domain={["dataMin", "dataMax"]}
        type="number"
        scale="time"
        name="Time"
        tickFormatter={(ts) => String(yearOf(ts))}
        tickCount={6}
        stroke="var(--color-label-secondary)"
      />
      <YAxis
        yAxisId="population"
        orientation="left"
        tickFormatter={(value) => formatPopulation(value)}
        stroke="var(--color-label-secondary)"
      />
      {chartType === "composed" && (
        <YAxis
          yAxisId="growth"
          orientation="right"
          stroke="var(--color-label-secondary)"
          tickFormatter={(value) => `${value.toFixed(2)}%`}
        />
      )}
      <Tooltip
        contentStyle={CHART_TOOLTIP_STYLE}
        formatter={tooltipFormatter}
        labelFormatter={(label) => `Year ${yearOf(label)}`}
      />
      <Legend wrapperStyle={{ fontSize: "11px", opacity: 0.8 }} />
      {populationSeries[chartType === "composed" ? "area" : chartType]}
      {chartType === "composed" && (
        <Bar
          yAxisId="growth"
          dataKey="populationGrowthRate"
          fill="var(--chart-3)"
          opacity={0.4}
          name="Growth Rate"
          radius={[2, 2, 0, 0]}
        />
      )}
    </ComposedChart>
  );
}
