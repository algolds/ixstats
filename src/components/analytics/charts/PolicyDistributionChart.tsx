/**
 * Policy Distribution Chart Component
 *
 * Displays policy category distribution as a pie chart.
 *
 * @module PolicyDistributionChart
 */

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieChartIcon, FileSpreadsheet, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import type { PolicyDistribution } from '~/lib/analytics-data-transformers';

interface PolicyDistributionChartProps {
  data: PolicyDistribution[];
  formatPercent: (value: number) => string;
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const PolicyDistributionChart = React.memo<PolicyDistributionChartProps>(({
  data,
  formatPercent,
  GlassTooltip,
  onExportCSV,
  onExportPDF
}) => {
  return (
    <Card className="glass-surface glass-refraction" id="policy-distribution-chart">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-purple-600" />
            Policy Category Distribution
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
        <CardDescription>Active policies by category</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.name}: ${entry.value}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<GlassTooltip formatter={formatPercent} />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

PolicyDistributionChart.displayName = 'PolicyDistributionChart';
