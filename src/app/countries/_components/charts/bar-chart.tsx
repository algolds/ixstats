// src/app/countries/_components/charts/bar-chart.tsx
import * as React from "react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatNumber } from "~/lib/format";
import { IxTime } from "~/lib/ixtime";
import type { FormattedChartDataPoint } from "~/lib/chart-data-formatter";

interface BarChartProps {
  data: FormattedChartDataPoint[];
  title: string;
  description?: string;
  dataKeys: Array<{
    key: keyof FormattedChartDataPoint;
    name: string;
    color: string;
    formatter?: (value: number) => string;
    type?: 'historical' | 'forecast';
  }>;
  xAxisDataKey?: keyof FormattedChartDataPoint;
  height?: number;
  stacked?: boolean;
  showReferenceLines?: boolean;
  currentTime?: number;
}

export function BarChart({
  data,
  title,
  description,
  dataKeys,
  xAxisDataKey = "period",
  height = 350,
  stacked = false,
  showReferenceLines = true,
  currentTime
}: BarChartProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey={xAxisDataKey as string} 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatNumber(value, false, 0, true)}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                const dataKey = dataKeys.find(k => k.name === name);
                if (dataKey?.formatter) {
                  return [dataKey.formatter(value), name];
                }
                return [formatNumber(value, false, 2, false), name];
              }}
              labelFormatter={(label) => `Year: ${label}`}
            />
            <Legend />
            
            {showReferenceLines && currentTime && (
              <ReferenceLine 
                x={IxTime.getCurrentGameYear(currentTime).toString()} 
                stroke="#888" 
                strokeWidth={1} 
                strokeDasharray="3 3" 
                label={{ value: 'Current', position: 'insideTopRight', fill: '#888', fontSize: 12 }}
              />
            )}
            
            {showReferenceLines && (
              <ReferenceLine 
                x="2028" 
                stroke="#888" 
                strokeWidth={1} 
                strokeDasharray="3 3" 
                label={{ value: 'Epoch', position: 'insideTopRight', fill: '#888', fontSize: 12 }}
              />
            )}
            
            {dataKeys.map((dataKey, index) => (
              <Bar
                key={index}
                dataKey={dataKey.key as string}
                name={dataKey.name}
                fill={dataKey.color}
                fillOpacity={dataKey.type === 'forecast' ? 0.6 : 1}
                strokeDasharray={dataKey.type === 'forecast' ? "5 5" : undefined}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
