/**
 * Sector Performance Chart Component
 *
 * Displays economic sector performance as a horizontal bar chart.
 *
 * @module SectorPerformanceChart
 */

import React from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieChartIcon, FileSpreadsheet, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';
import type { SectorPerformance } from '~/lib/analytics-data-transformers';

interface SectorPerformanceChartProps {
  data: SectorPerformance[];
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const SectorPerformanceChart = React.memo<SectorPerformanceChartProps>(({
  data,
  GlassTooltip,
  onExportCSV,
  onExportPDF
}) => {
  return (
    <Card className="glass-surface glass-refraction" id="sector-performance-chart">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-blue-600" />
            Sector Performance Breakdown
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportCSV}
              title="Export to CSV"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExportPDF}
              title="Export to PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>GDP contribution by economic sector</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis type="category" dataKey="sector" tick={{ fill: '#6b7280', fontSize: 12 }} width={100} />
            <Tooltip content={<GlassTooltip />} />
            <Bar dataKey="performance" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

SectorPerformanceChart.displayName = 'SectorPerformanceChart';
