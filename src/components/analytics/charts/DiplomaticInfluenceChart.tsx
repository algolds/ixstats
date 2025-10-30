/**
 * Diplomatic Influence Chart Component
 *
 * Displays diplomatic influence over time as a line chart.
 *
 * @module DiplomaticInfluenceChart
 */

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Globe, FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { DEFAULT_CHART_COLORS } from "~/lib/chart-colors";
import type { EconomicChartDataPoint } from "~/lib/analytics-data-transformers";

interface DiplomaticInfluenceChartProps {
  data: Array<EconomicChartDataPoint & { influence: number }>;
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const DiplomaticInfluenceChart = React.memo<DiplomaticInfluenceChartProps>(
  ({ data, GlassTooltip, onExportCSV, onExportPDF }) => {
    return (
      <Card className="glass-surface glass-refraction" id="diplomatic-influence-chart">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              Diplomatic Influence Over Time
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
          <CardDescription>Global standing and relationship strength</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip content={<GlassTooltip />} />
              <Line
                type="monotone"
                dataKey="influence"
                stroke={DEFAULT_CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ fill: DEFAULT_CHART_COLORS[0], r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }
);

DiplomaticInfluenceChart.displayName = "DiplomaticInfluenceChart";
