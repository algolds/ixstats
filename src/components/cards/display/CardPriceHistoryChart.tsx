"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Coins } from "iconoir-react";

interface CardPriceHistoryChartProps {
  cardId: string;
}

export const CardPriceHistoryChart: React.FC<CardPriceHistoryChartProps> = ({ cardId }) => {
  const { data: history, isLoading } = api.cardMarket.getCardValueHistory.useQuery({ cardId });

  const chartData = useMemo(() => {
    if (!history) return [];
    return history.map((item) => ({
      date: new Date(item.recordedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: item.value,
    }));
  }, [history]);

  if (isLoading) {
    return (
      <div className="flex h-48 w-full flex-col justify-between p-2">
        <Skeleton className="bg-fill-4 h-full w-full rounded" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="rounded-control border-separator flex h-48 w-full flex-col items-center justify-center border border-dashed">
        <Coins className="text-label-secondary h-8 w-8 opacity-40" />
        <span className="text-label-secondary text-footnote mt-2">No price history available</span>
      </div>
    );
  }

  return (
    <div className="h-48 w-full pr-4 select-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-separator)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--color-label-secondary)"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="var(--color-label-secondary)"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}`}
            dx={-8}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-separator)",
              borderRadius: "var(--radius-control-sm)",
              boxShadow: "var(--shadow-floating)",
            }}
            labelStyle={{
              color: "var(--color-label-secondary)",
              fontSize: "10px",
              fontWeight: 600,
            }}
            itemStyle={{ color: "var(--color-label)", fontSize: "11px", fontWeight: 600 }}
            formatter={(value) => [`${value} Credits`, "Value"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-warning)"
            strokeWidth={2}
            dot={{
              r: 3,
              stroke: "var(--color-warning)",
              strokeWidth: 1,
              fill: "var(--color-surface-elevated)",
            }}
            activeDot={{
              r: 5,
              stroke: "var(--color-surface-elevated)",
              strokeWidth: 2,
              fill: "var(--color-warning)",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
