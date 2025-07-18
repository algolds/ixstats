import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import React from 'react';

interface HistoricalTrendsProps {
  title: string;
  data: any[];
  config: Record<string, { color: string; label: string }>;
  leftKeys?: string[]; // keys to plot on left Y axis
  rightKeys?: string[]; // keys to plot on right Y axis
  leftLabelColor?: string;
  rightLabelColor?: string;
  cardClassName?: string;
  titleClassName?: string;
}

export function HistoricalTrends({
  title,
  data,
  config,
  leftKeys = [],
  rightKeys = [],
  leftLabelColor = '#f59e42',
  rightLabelColor = '#10b981',
  cardClassName = '',
  titleClassName = '',
}: HistoricalTrendsProps) {
  return (
    <Card className={`bg-black/20 border border-orange-500/20 ${cardClassName}`}>
      <CardHeader>
        <CardTitle className={`text-xl text-orange-200 ${titleClassName}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 1 ? (
          <ChartContainer config={config}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: leftLabelColor }} />
                <YAxis yAxisId="left" tick={{ fill: leftLabelColor }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: rightLabelColor }} />
                <Tooltip />
                <Legend />
                {leftKeys.map((key) => (
                  <Line
                    key={key}
                    yAxisId="left"
                    type="monotone"
                    dataKey={key}
                    stroke={config[key]?.color || leftLabelColor}
                    name={config[key]?.label || key}
                    dot={false}
                  />
                ))}
                {rightKeys.map((key) => (
                  <Line
                    key={key}
                    yAxisId="right"
                    type="monotone"
                    dataKey={key}
                    stroke={config[key]?.color || rightLabelColor}
                    name={config[key]?.label || key}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="text-gray-400">Not enough historical data for chart.</div>
        )}
      </CardContent>
    </Card>
  );
} 