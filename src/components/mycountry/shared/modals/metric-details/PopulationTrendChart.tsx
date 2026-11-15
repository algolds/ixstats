"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  Line,
  ComposedChart,
  Bar,
} from "recharts";
import { FACET_AXIS_TICK, FacetChartTooltip } from "~/components/ui/chart";
import { formatPopulation } from "~/lib/utils/format-utils";
import { realmYear } from "~/lib/realms/nation-time";
import type { RealmCalendar } from "~/lib/realms/realm-clock";
import type { PopulationChartDataPoint } from "~/lib/mycountry/population-details";
import type { ChartType } from "./types";

export const POPULATION_COLOR = "var(--color-chart-1)";

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
        strokeWidth={2.5}
        dot={false}
        activeDot={{ r: 4, fill: POPULATION_COLOR, strokeWidth: 0 }}
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
        strokeWidth={2.5}
        name="Population"
      />
    ),
  };

  return (
    <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
      {showsArea && (
        <defs>
          <linearGradient id="popColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={POPULATION_COLOR} stopOpacity={0.2} />
            <stop offset="95%" stopColor={POPULATION_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-separator)" />
      <XAxis
        dataKey="timestamp"
        domain={["dataMin", "dataMax"]}
        type="number"
        scale="time"
        name="Time"
        tickFormatter={(ts) => String(yearOf(ts))}
        tickCount={6}
        axisLine={false}
        tickLine={false}
        tick={FACET_AXIS_TICK}
      />
      <YAxis
        yAxisId="population"
        orientation="left"
        tickFormatter={(value) => formatPopulation(value)}
        axisLine={false}
        tickLine={false}
        tick={FACET_AXIS_TICK}
      />
      {chartType === "composed" && (
        <YAxis
          yAxisId="growth"
          orientation="right"
          axisLine={false}
          tickLine={false}
          tick={FACET_AXIS_TICK}
          tickFormatter={(value) => `${value.toFixed(2)}%`}
        />
      )}
      <Tooltip
        cursor={{ stroke: "var(--color-separator)", strokeWidth: 1 }}
        content={
          <FacetChartTooltip
            labelFormatter={(label) => `Year ${yearOf(label)}`}
            valueFormatter={(val, name) =>
              name === "Population" || name === "population"
                ? formatPopulation(val)
                : `${val.toFixed(3)}%`
            }
          />
        }
      />
      {populationSeries[chartType === "composed" ? "area" : chartType]}
      {chartType === "composed" && (
        <Bar
          yAxisId="growth"
          dataKey="populationGrowthRate"
          fill="var(--color-chart-3)"
          opacity={0.75}
          name="Growth rate"
          radius={[2, 2, 0, 0]}
        />
      )}
    </ComposedChart>
  );
}
