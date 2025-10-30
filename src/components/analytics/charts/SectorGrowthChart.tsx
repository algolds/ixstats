/**
 * Sector Growth Chart Component
 *
 * Displays sector growth rates as a vertical bar chart.
 *
 * @module SectorGrowthChart
 */

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import type { SectorPerformance } from "~/lib/analytics-data-transformers";

interface SectorGrowthChartProps {
  data: SectorPerformance[];
  formatPercent: (value: number) => string;
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const SectorGrowthChart = React.memo<SectorGrowthChartProps>(
  ({ data, formatPercent, GlassTooltip, onExportCSV, onExportPDF }) => {
    return (
      <Card className="glass-surface glass-refraction" id="sector-growth-chart">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Sector Growth Rates
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
          <CardDescription>Annual growth percentage by sector</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis
                dataKey="sector"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={formatPercent} />
              <Tooltip content={<GlassTooltip formatter={formatPercent} />} />
              <Bar dataKey="growth" fill={DEFAULT_CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }
);

SectorGrowthChart.displayName = "SectorGrowthChart";
