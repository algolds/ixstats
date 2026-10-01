"use client";

import React from "react";
import type { RevenueSourceInput } from "~/types/government";
import { formatNumber } from "~/lib/utils/format-utils";
import { Eyebrow } from "~/components/ui/eyebrow";
import { revenueCategories, revenueCategoryIcons } from "./revenueConstants";

interface RevenueSummaryKpisProps {
  data: RevenueSourceInput[];
  totalCalculated: number;
}

export function RevenueSummaryKpis({ data, totalCalculated }: RevenueSummaryKpisProps) {
  const categoryStats = revenueCategories
    .map((category) => {
      const categoryData = data.filter((item) => item.category === category);
      const amount = categoryData.reduce((sum, item) => sum + item.revenueAmount, 0);
      const percent = totalCalculated > 0 ? (amount / totalCalculated) * 100 : 0;
      return { category, amount, percent, count: categoryData.length };
    })
    .filter((stat) => stat.count > 0);

  const kpis = [
    { label: "Total revenue", value: formatNumber(totalCalculated) },
    { label: "Tax sources", value: data.filter((r) => r.category.includes("Tax")).length },
    { label: "Non-tax sources", value: data.filter((r) => !r.category.includes("Tax")).length },
    {
      label: "Avg per channel",
      value: data.length > 0 ? formatNumber(totalCalculated / data.length) : "0",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Revenue KPI summary */}
      <dl className="border-separator divide-separator rounded-control grid grid-cols-2 divide-y border md:grid-cols-4 md:divide-x md:divide-y-0">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="p-4 text-center">
            <dd className="text-label text-title-2 tabular-nums">{kpi.value}</dd>
            <dt className="mt-1">
              <Eyebrow>{kpi.label}</Eyebrow>
            </dt>
          </div>
        ))}
      </dl>

      {/* Category breakdown */}
      {categoryStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-label text-headline">Revenue shares by category</h3>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {categoryStats.map((stat) => {
              const Icon = revenueCategoryIcons[stat.category];
              return (
                <li
                  key={stat.category}
                  className="border-separator rounded-control flex items-center justify-between border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
                    <div>
                      <div className="text-label text-caption font-semibold">{stat.category}</div>
                      <div className="text-label-secondary text-footnote">
                        {stat.count} active channels
                      </div>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-label text-caption font-semibold">
                      {formatNumber(stat.amount)}
                    </div>
                    <div className="text-label-secondary text-footnote">
                      {stat.percent.toFixed(1)}%
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
