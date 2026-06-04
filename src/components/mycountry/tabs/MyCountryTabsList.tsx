"use client";

import React from "react";
import { BarChart3, TrendingUp, Briefcase, Building } from "lucide-react";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";

/**
 * The top-level tab strip (At a Glance / Economy / Labor / Government) for the
 * MyCountry tab system, including the "needs setup" badge on the Government tab.
 *
 * Extracted from MyCountryTabSystem during modular decomposition.
 * Behavior preserved exactly.
 *
 * @param govComponentCount Number of configured government components. When 0,
 *                          the Government tab shows a "1" setup badge.
 */
export function MyCountryTabsList({ govComponentCount }: { govComponentCount: number }) {
  const govBadge = govComponentCount === 0 ? 1 : 0; // Needs setup

  const tabs = [
    { value: "overview", icon: BarChart3, label: "At a Glance", shortLabel: "Glance", badge: 0 },
    { value: "economy", icon: TrendingUp, label: "Economy", shortLabel: "Econ", badge: 0 },
    { value: "labor", icon: Briefcase, label: "Labor", shortLabel: "Lab", badge: 0 },
    {
      value: "government",
      icon: Building,
      label: "Government",
      shortLabel: "Gov",
      badge: govBadge,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <TabsList className="grid w-full min-w-fit grid-cols-2 gap-1 sm:grid-cols-4">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={`data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 px-2 text-xs sm:px-3 sm:text-sm ${
              ["economy", "labor", "government"].includes(tab.value)
                ? `tab-trigger-${tab.value}`
                : ""
            }`}
          >
            <tab.icon className="tab-icon h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
            {tab.badge > 0 && (
              <span className="inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] leading-none font-bold text-white">
                {tab.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
