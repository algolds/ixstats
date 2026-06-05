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
import { Coins } from "lucide-react";

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
        <Skeleton className="h-full w-full rounded bg-white/5" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex h-48 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-white/10">
        <Coins className="h-8 w-8 text-slate-400 opacity-40" />
        <span className="text-slate-450 mt-2 text-xs dark:text-white/40">
          No price history available
        </span>
      </div>
    );
  }

  return (
    <div className="h-48 w-full pr-4 select-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}`}
            dx={-8}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
            }}
            labelStyle={{ color: "#94a3b8", fontSize: "10px", fontWeight: "bold" }}
            itemStyle={{ color: "#38bdf8", fontSize: "11px", fontWeight: "black" }}
            formatter={(value) => [`${value} IxC`, "Value"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, stroke: "#f59e0b", strokeWidth: 1, fill: "#0f172a" }}
            activeDot={{ r: 5, stroke: "#fbbf24", strokeWidth: 2, fill: "#f59e0b" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
