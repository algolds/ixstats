"use client";

/**
 * ComparativeAnalysisChart
 *
 * BarChart comparing the current country vs similar nations by GDP per capita.
 * Shows tax burden, government spending, and efficiency score.
 *
 * @module ComparativeAnalysisChart
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { StatsReport as BarChart3 } from "iconoir-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ComparativeCountryData } from "~/hooks/usePolicyAnalytics";

interface ComparativeAnalysisChartProps {
  comparativeData: ComparativeCountryData[] | null;
}

export const ComparativeAnalysisChart = React.memo(function ComparativeAnalysisChart({
  comparativeData,
}: ComparativeAnalysisChartProps) {
  return (
    <Card className="facet-hierarchy-child">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Comparative Policy Analysis
        </CardTitle>
        <CardDescription>Your country vs. similar nations (by GDP per capita)</CardDescription>
      </CardHeader>
      <CardContent>
        {comparativeData && comparativeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300} className="sm:h-[350px] lg:h-[400px]">
            <BarChart data={comparativeData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                className="text-xs"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
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
              <Bar dataKey="taxBurden" fill="#3b82f6" name="Tax Burden (% GDP)" />
              <Bar dataKey="govSpending" fill="#10b981" name="Gov Spending (% GDP)" />
              <Bar dataKey="efficiency" fill="#8b5cf6" name="Efficiency Score" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground py-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No comparative data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
