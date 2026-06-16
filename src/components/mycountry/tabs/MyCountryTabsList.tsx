"use client";

import React from "react";
import { BarChart3, TrendingUp, Briefcase, Building, MapPin } from "lucide-react";
import { FacetTabs } from "~/components/facet-ui";

/**
 * The top-level tab strip (At a Glance / Economy / Labor / Government) for the
 * MyCountry tab system, using the shared FacetTabs component to support Apple-Switch
 * sliding animations, spring-physics dragging, and relative sheens.
 *
 * @param activeTab Current active tab id.
 * @param onChange Callback triggered on tab change.
 * @param govComponentCount Number of configured government components. When 0,
 *                          the Government tab shows a "1" setup badge.
 */
export function MyCountryTabsList({
  activeTab,
  onChangeAction,
  govComponentCount,
}: {
  activeTab: string;
  onChangeAction: (value: string) => void;
  govComponentCount: number;
}) {
  const govBadge = govComponentCount === 0 ? 1 : 0; // Needs setup

  const tabs = [
    {
      id: "overview",
      icon: BarChart3,
      label: (
        <>
          <span className="hidden sm:inline">At a Glance</span>
          <span className="sm:hidden">Glance</span>
        </>
      ),
      badge: 0,
      activeIndicatorClassName:
        "bg-[var(--tab-executive-bg)] border-[var(--tab-executive-primary)]/30 text-[var(--tab-executive-primary)]",
      activeTextClassName:
        "text-[var(--tab-executive-primary)] dark:text-[var(--tab-executive-accent)]",
      activeIconClassName:
        "text-[var(--tab-executive-icon)] dark:text-[var(--tab-executive-accent)]",
      glowClassName: "bg-[var(--tab-executive-primary)]/20",
    },
    {
      id: "economy",
      icon: TrendingUp,
      label: (
        <>
          <span className="hidden sm:inline">Economy</span>
          <span className="sm:hidden">Econ</span>
        </>
      ),
      badge: 0,
      activeIndicatorClassName:
        "bg-[var(--tab-economy-bg)] border-[var(--tab-economy-primary)]/30 text-[var(--tab-economy-primary)]",
      activeTextClassName:
        "text-[var(--tab-economy-primary)] dark:text-[var(--tab-economy-accent)]",
      activeIconClassName: "text-[var(--tab-economy-icon)] dark:text-[var(--tab-economy-accent)]",
      glowClassName: "bg-[var(--tab-economy-primary)]/20",
    },
    {
      id: "labor",
      icon: Briefcase,
      label: (
        <>
          <span className="hidden sm:inline">Labor</span>
          <span className="sm:hidden">Lab</span>
        </>
      ),
      badge: 0,
      activeIndicatorClassName:
        "bg-[var(--tab-labor-bg)] border-[var(--tab-labor-primary)]/30 text-[var(--tab-labor-primary)]",
      activeTextClassName: "text-[var(--tab-labor-primary)] dark:text-[var(--tab-labor-accent)]",
      activeIconClassName: "text-[var(--tab-labor-icon)] dark:text-[var(--tab-labor-accent)]",
      glowClassName: "bg-[var(--tab-labor-primary)]/20",
    },
    {
      id: "government",
      icon: Building,
      label: (
        <>
          <span className="hidden sm:inline">Government</span>
          <span className="sm:hidden">Gov</span>
        </>
      ),
      badge: govBadge,
      activeIndicatorClassName:
        "bg-[var(--tab-government-bg)] border-[var(--tab-government-primary)]/30 text-[var(--tab-government-primary)]",
      activeTextClassName:
        "text-[var(--tab-government-primary)] dark:text-[var(--tab-government-accent)]",
      activeIconClassName:
        "text-[var(--tab-government-icon)] dark:text-[var(--tab-government-accent)]",
      glowClassName: "bg-[var(--tab-government-primary)]/20",
    },
    {
      id: "geography",
      icon: MapPin,
      label: (
        <>
          <span className="hidden sm:inline">Geography</span>
          <span className="sm:hidden">Geo</span>
        </>
      ),
      badge: 0,
      activeIndicatorClassName: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
      activeTextClassName: "text-emerald-600 dark:text-emerald-400",
      activeIconClassName: "text-emerald-500 dark:text-emerald-400",
      glowClassName: "bg-emerald-500/20",
    },
  ];

  return (
    <div className="overflow-x-auto p-0.5">
      <FacetTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={onChangeAction}
        tone="mycountry"
        size="md"
        className="facet-surface facet-refraction w-full min-w-fit rounded-xl border border-white/5 p-1"
      />
    </div>
  );
}
