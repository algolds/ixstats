/**
 * Embassy Network Chart Component
 *
 * Displays embassy network growth as an area chart.
 *
 * @module EmbassyNetworkChart
 */

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { DEFAULT_CHART_COLORS } from '~/lib/chart-colors';
import type { EconomicChartDataPoint } from '~/lib/analytics-data-transformers';

interface EmbassyNetworkChartProps {
  data: Array<EconomicChartDataPoint & { embassies: number }>;
  GlassTooltip: React.ComponentType<any>;
}

export const EmbassyNetworkChart = React.memo<EmbassyNetworkChartProps>(({
  data,
  GlassTooltip
}) => {
  return (
    <Card className="glass-surface glass-refraction">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5 text-orange-600" />
          Embassy Network Growth
        </CardTitle>
        <CardDescription>Expansion of diplomatic presence</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="embassyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={DEFAULT_CHART_COLORS[3]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={DEFAULT_CHART_COLORS[3]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip content={<GlassTooltip />} />
            <Area type="monotone" dataKey="embassies" stroke={DEFAULT_CHART_COLORS[3]} fill="url(#embassyGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

EmbassyNetworkChart.displayName = 'EmbassyNetworkChart';
