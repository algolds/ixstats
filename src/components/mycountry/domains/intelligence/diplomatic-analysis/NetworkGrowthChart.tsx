"use client";

/**
 * Network Growth Chart
 *
 * AreaChart with gradient fills showing growth in embassies,
 * relationships, and total influence over the last 30 days.
 *
 * @module NetworkGrowthChart
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { NetworkGrowthEntry } from "~/hooks/useDiplomaticAnalytics";

interface NetworkGrowthChartProps {
  data: NetworkGrowthEntry[];
}

export const NetworkGrowthChart = React.memo<NetworkGrowthChartProps>(({ data }) => {
  return (
    <Card className="glass-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-600" />
          Network Power Growth
        </CardTitle>
        <CardDescription>Diplomatic influence and network expansion over time</CardDescription>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300} className="sm:h-[350px] lg:h-[400px]">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorEmbassies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorRelationships" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorInfluence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
              <YAxis className="text-xs" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Area
                type="monotone"
                dataKey="embassies"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorEmbassies)"
                name="Embassies"
              />
              <Area
                type="monotone"
                dataKey="relationships"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorRelationships)"
                name="Relationships"
              />
              <Area
                type="monotone"
                dataKey="influence"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorInfluence)"
                name="Total Influence"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex min-h-[300px] items-center justify-center">
            <div className="space-y-2 text-center">
              <Activity className="mx-auto h-12 w-12 opacity-50" />
              <p>Your diplomatic network is still forming.</p>
              <p className="text-xs">
                Establish embassies and relationships to see growth trends over time.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

NetworkGrowthChart.displayName = "NetworkGrowthChart";
