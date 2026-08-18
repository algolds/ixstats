"use client";

/**
 * Influence Distribution Chart
 *
 * Side-by-side PieChart and breakdown list showing diplomatic influence
 * bucketed by relationship status (allied, friendly, neutral, etc.).
 *
 * @module InfluenceDistributionChart
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { InfluenceEntry } from "~/hooks/useDiplomaticAnalytics";
import { COLORS, STATUS_COLORS } from "~/hooks/useDiplomaticAnalytics";

interface InfluenceDistributionChartProps {
  data: InfluenceEntry[];
}

export const InfluenceDistributionChart = React.memo<InfluenceDistributionChartProps>(
  ({ data }) => {
    return (
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-orange-600" />
            Influence Distribution by Relationship Status
          </CardTitle>
          <CardDescription>
            Breakdown of diplomatic influence across relationship categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ResponsiveContainer width="100%" height={250} className="sm:h-[300px] lg:h-[350px]">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    className="sm:outerRadius-[100px] lg:outerRadius-[120px]"
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-4">
                <h4 className="font-semibold">Distribution Breakdown</h4>
                {data.map((item) => (
                  <div
                    key={item.name}
                    className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLORS[item.name] || "#6b7280",
                        }}
                      />
                      <div>
                        <p className="font-medium capitalize">{item.name}</p>
                        <p className="text-muted-foreground text-sm">{item.count} countries</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.value.toFixed(0)}</p>
                      <p className="text-muted-foreground text-xs">influence points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-[250px] items-center justify-center">
              <div className="space-y-2 text-center">
                <PieChartIcon className="mx-auto h-12 w-12 opacity-50" />
                <p>No influence distribution yet.</p>
                <p className="text-xs">
                  Build relationships across nations to see how your diplomatic influence spreads.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

InfluenceDistributionChart.displayName = "InfluenceDistributionChart";
