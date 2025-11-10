// src/components/economy/historical-charts/TimeSeriesChart.tsx
/**
 * Time Series Chart Component
 *
 * Displays economic metric over time with event markers
 */

import React from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { LineChart } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import type { ChartDataPoint, EventMarker } from "~/lib/historical-economic-data-transformers";

interface TimeSeriesChartProps {
  chartData: ChartDataPoint[];
  eventMarkers: EventMarker[];
  selectedMetric: "gdp" | "population" | "unemployment";
  formatMetricValue: (value: number) => string;
  getMetricColor: () => string;
}

export const TimeSeriesChart = React.memo(function TimeSeriesChart({
  chartData,
  eventMarkers,
  selectedMetric,
  formatMetricValue,
  getMetricColor,
}: TimeSeriesChartProps) {
  const metricLabel =
    selectedMetric === "gdp"
      ? "GDP per Capita"
      : selectedMetric === "population"
        ? "Population"
        : "Unemployment Rate";

  const dataKey =
    selectedMetric === "gdp"
      ? "gdpPerCapita"
      : selectedMetric === "population"
        ? "population"
        : "unemploymentRate";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5" />
          {metricLabel} Over Time
        </CardTitle>
        <CardDescription>
          Economic trend with event markers • {chartData.length} data points
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 sm:h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="uniqueKey"
                tickFormatter={(value) => {
                  const gameYear = value.split("-")[0];
                  return `${gameYear}`;
                }}
                tick={{ fontSize: 10 }}
              />
              <YAxis tickFormatter={formatMetricValue} tick={{ fontSize: 10 }} />
              <RechartsTooltip
                labelFormatter={(value) => `Year ${value}`}
                formatter={(value: number) => [formatMetricValue(value), metricLabel]}
                contentStyle={{ fontSize: "12px" }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={getMetricColor()}
                strokeWidth={2}
                dot={{ fill: getMetricColor(), strokeWidth: 2, r: 3 }}
              />
              <Bar dataKey="eventsCount" fill="rgba(239, 68, 68, 0.3)" yAxisId="right" />

              {eventMarkers.slice(0, 10).map((marker, index) => (
                <ReferenceLine
                  key={index}
                  x={IxTime.getCurrentGameYear(marker.timestamp)}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeOpacity={0.7}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {eventMarkers.length > 0 && (
          <div className="bg-muted/50 mt-4 rounded-lg p-3">
            <h6 className="mb-2 text-sm font-medium">Recent Events in Timeline:</h6>
            <div className="flex flex-wrap gap-2">
              {eventMarkers.slice(0, 6).map((marker, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {IxTime.getCurrentGameYear(marker.timestamp)}: {marker.event.title}
                </Badge>
              ))}
              {eventMarkers.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{eventMarkers.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
