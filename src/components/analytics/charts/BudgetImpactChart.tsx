/**
 * Budget Impact Chart Component
 *
 * Displays budget impact analysis as a stacked bar chart.
 *
 * @module BudgetImpactChart
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, FileSpreadsheet, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';
import type { BudgetImpact } from '~/lib/analytics-data-transformers';

interface BudgetImpactChartProps {
  data: BudgetImpact[];
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const BudgetImpactChart = React.memo<BudgetImpactChartProps>(({
  data,
  GlassTooltip,
  onExportCSV,
  onExportPDF
}) => {
  return (
    <Card className="glass-surface glass-refraction" id="budget-impact-chart">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Budget Impact Analysis
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
        <CardDescription>Financial impact of policy implementations</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip content={<GlassTooltip />} />
            <Legend />
            <Bar dataKey="impact" fill={DEFAULT_CHART_COLORS[1]} name="Economic Impact" />
            <Bar dataKey="cost" fill={DEFAULT_CHART_COLORS[3]} name="Implementation Cost" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

BudgetImpactChart.displayName = 'BudgetImpactChart';
