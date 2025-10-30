/**
 * Projection Chart Component
 *
 * Displays GDP projections with multiple scenario lines.
 *
 * @module ProjectionChart
 */

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import type { ProjectionDataPoint } from "~/lib/analytics-data-transformers";
import type { Scenario, DateRange } from "~/hooks/useAnalyticsDashboard";

interface ProjectionChartProps {
  data: ProjectionDataPoint[];
  selectedScenarios: Scenario[];
  dateRange: DateRange;
  formatCurrency: (value: number) => string;
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const ProjectionChart = React.memo<ProjectionChartProps>(
  ({
    data,
    selectedScenarios,
    dateRange,
    formatCurrency,
    GlassTooltip,
    onExportCSV,
    onExportPDF,
  }) => {
    const timeframeLabel =
      dateRange === "6months"
        ? "6 months"
        : dateRange === "2years"
          ? "2 years"
          : dateRange === "5years"
            ? "5 years"
            : "1 year";

    return (
      <Card className="glass-surface glass-refraction" id="gdp-projections-chart">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              GDP Per Capita Projections
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
          <CardDescription>Projected growth over {timeframeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={formatCurrency} />
              <Tooltip content={<GlassTooltip formatter={formatCurrency} />} />
              <Legend />
              {selectedScenarios.includes("optimistic") && (
                <Line
                  type="monotone"
                  dataKey="optimistic"
                  stroke={DEFAULT_CHART_COLORS[1]}
                  strokeWidth={2}
                  name="Optimistic"
                  strokeDasharray="5 5"
                />
              )}
              {selectedScenarios.includes("realistic") && (
                <Line
                  type="monotone"
                  dataKey="realistic"
                  stroke={DEFAULT_CHART_COLORS[0]}
                  strokeWidth={3}
                  name="Realistic"
                />
              )}
              {selectedScenarios.includes("pessimistic") && (
                <Line
                  type="monotone"
                  dataKey="pessimistic"
                  stroke={DEFAULT_CHART_COLORS[3]}
                  strokeWidth={2}
                  name="Pessimistic"
                  strokeDasharray="5 5"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }
);

ProjectionChart.displayName = "ProjectionChart";
