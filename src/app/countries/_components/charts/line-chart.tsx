// src/components/charts/line-chart.tsx
import * as React from "react";
import { Line, LineChart as RechartsLineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatNumber } from "~/lib/format";
import type { FormattedChartDataPoint } from "~/lib/chart-data-formatter";

interface LineChartProps {
  data: FormattedChartDataPoint[];
  title: string;
  description?: string;
  dataKeys: Array<{
    key: keyof FormattedChartDataPoint;
    name: string;
    color: string;
    formatter?: (value: number) => string;
  }>;
  xAxisDataKey?: keyof FormattedChartDataPoint;
  height?: number;
}

export function LineChart({
  data,
  title,
  description,
  dataKeys,
  xAxisDataKey = "period",
  height = 350
}: LineChartProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart
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
            {dataKeys.map((dataKey, index) => (
              <Line
                key={index}
                type="monotone"
                dataKey={dataKey.key as string}
                name={dataKey.name}
                stroke={dataKey.color}
                activeDot={{ r: 8 }}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
