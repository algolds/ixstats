"use client";

import React from "react";
import type { RevenueSourceInput } from "~/types/government";
import {
  revenueCategories,
  revenueCategoryIcons,
  revenueCategoryColors,
} from "./revenueConstants";

interface RevenueSummaryKpisProps {
  data: RevenueSourceInput[];
  totalCalculated: number;
}

function formatNumber(num: number) {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

export function RevenueSummaryKpis({ data, totalCalculated }: RevenueSummaryKpisProps) {
  const getCategoryStats = () => {
    const stats = revenueCategories.map((category) => {
      const categoryData = data.filter((item) => item.category === category);
      const amount = categoryData.reduce((sum, item) => sum + item.revenueAmount, 0);
      const percent = totalCalculated > 0 ? (amount / totalCalculated) * 100 : 0;
      return {
        category,
        amount,
        percent,
        count: categoryData.length,
      };
    });

    return stats.filter((stat) => stat.count > 0);
  };

  const categoryStats = getCategoryStats();

  return (
    <div className="space-y-6">
      {/* Revenue KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-white/5 dark:bg-zinc-950/40">
          <div className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {formatNumber(totalCalculated)}
          </div>
          <div className="mt-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Total Revenue
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-white/5 dark:bg-zinc-950/40">
          <div className="text-xl font-extrabold tracking-tight text-emerald-500 dark:text-emerald-400">
            {data.filter((r) => r.category.includes("Tax")).length}
          </div>
          <div className="mt-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Tax Sources
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-white/5 dark:bg-zinc-950/40">
          <div className="text-xl font-extrabold tracking-tight text-cyan-500 dark:text-cyan-400">
            {data.filter((r) => !r.category.includes("Tax")).length}
          </div>
          <div className="mt-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Non-Tax Sources
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-white/5 dark:bg-zinc-950/40">
          <div className="text-xl font-extrabold tracking-tight text-indigo-500 dark:text-indigo-400">
            {data.length > 0 ? formatNumber(totalCalculated / data.length) : "0"}
          </div>
          <div className="mt-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Avg per Channel
          </div>
        </div>
      </div>

      {/* Category Breakdown list */}
      {categoryStats.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Revenue Shares by Category
          </h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {categoryStats.map((stat) => {
              const Icon = revenueCategoryIcons[stat.category];
              const color = revenueCategoryColors[stat.category];
              return (
                <div
                  key={stat.category}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/5 dark:bg-zinc-950/20"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 dark:border-white/5 dark:bg-zinc-900">
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-white">
                        {stat.category}
                      </div>
                      <div className="text-[9px] font-semibold text-zinc-500 uppercase">
                        {stat.count} active channels
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-300">
                      {formatNumber(stat.amount)}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500">
                      {stat.percent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
