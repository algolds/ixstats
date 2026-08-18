"use client";

/**
 * Relationship Trends Chart
 *
 * LineChart showing relationship strength trends with top 5 diplomatic
 * partners over the last 30 days.
 *
 * @module RelationshipTrendsChart
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { TrendingUp } from "lucide-react";
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
import type { RelationshipTrendsData } from "~/hooks/useDiplomaticAnalytics";
import { COLORS } from "~/hooks/useDiplomaticAnalytics";

interface RelationshipTrendsChartProps {
  trends: RelationshipTrendsData;
}

export const RelationshipTrendsChart = React.memo<RelationshipTrendsChartProps>(({ trends }) => {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Relationship Strength Trends
        </CardTitle>
        <CardDescription>
          Historical relationship scores with top 5 diplomatic partners (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300} className="sm:h-[350px] lg:h-[400px]">
          <LineChart data={trends.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {trends.countries.map((country, idx) => (
              <Line
                key={country}
                type="monotone"
                dataKey={country}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

RelationshipTrendsChart.displayName = "RelationshipTrendsChart";
