/**
 * Economic Overview Chart Component
 *
 * Displays GDP per capita trend as an area chart with gradient fill.
 *
 * @module EconomicOverviewChart
 */

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { LineChart as LineChartIcon, FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import type { EconomicChartDataPoint } from "~/lib/analytics-data-transformers";

interface EconomicOverviewChartProps {
  data: EconomicChartDataPoint[];
  formatCurrency: (value: number) => string;
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const EconomicOverviewChart = React.memo<EconomicOverviewChartProps>(
  ({ data, formatCurrency, GlassTooltip, onExportCSV, onExportPDF }) => {
    return (
      <Card className="glass-surface glass-refraction" id="gdp-trend-chart">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-blue-600" />
              GDP Per Capita Trend
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onExportCSV} title="Export to CSV">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onExportPDF} title="Export to PDF">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription>Last {data.length} data points</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[280px] lg:h-[300px]">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DEFAULT_CHART_COLORS[0]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={DEFAULT_CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={formatCurrency} />
              <Tooltip content={<GlassTooltip formatter={formatCurrency} />} />
              <Area
                type="monotone"
                dataKey="gdpPerCapita"
                stroke={DEFAULT_CHART_COLORS[0]}
                fill="url(#gdpGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }
);

EconomicOverviewChart.displayName = "EconomicOverviewChart";
