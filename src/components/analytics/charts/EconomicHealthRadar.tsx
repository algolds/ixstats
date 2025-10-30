/**
 * Economic Health Radar Chart Component
 *
 * Displays multi-dimensional economic health indicators on a radar chart.
 *
 * @module EconomicHealthRadar
 */

import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, FileSpreadsheet, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';
import type { EconomicHealthIndicator } from '~/lib/analytics-data-transformers';

interface EconomicHealthRadarProps {
  data: EconomicHealthIndicator[];
  formatPercent: (value: number) => string;
  GlassTooltip: React.ComponentType<any>;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const EconomicHealthRadar = React.memo<EconomicHealthRadarProps>(({
  data,
  formatPercent,
  GlassTooltip,
  onExportCSV,
  onExportPDF
}) => {
  return (
    <Card className="glass-surface glass-refraction" id="economic-health-chart">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            Economic Health Indicators
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
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="indicator" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#6b7280' }} />
            <Radar name="Health Score" dataKey="value" stroke={DEFAULT_CHART_COLORS[2]} fill={DEFAULT_CHART_COLORS[2]} fillOpacity={0.5} />
            <Tooltip content={<GlassTooltip formatter={formatPercent} />} />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

EconomicHealthRadar.displayName = 'EconomicHealthRadar';
