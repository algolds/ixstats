"use client";

import React from "react";
import { TrendingUp, Briefcase } from "lucide-react";
import { FacetTabs } from "~/components/facet-ui";
import { EconomyTab } from "./EconomyTab";
import { LaborTab } from "./LaborTab";
import type { CardImageType } from "../primitives";
import type { MetricType } from "~/hooks/useMetricDetailsModal";

type SubTab = "economy" | "labor";

interface EconomyLaborTabProps {
  country: any;
  economyData: any;
  countryImageData: any;
  setImageUploadModalAction: (state: { isOpen: boolean; cardType: CardImageType }) => void;
  openMetricModalAction: (metricType: MetricType, countryId: string) => void;
  metricView: any;
  setMetricViewAction: React.Dispatch<React.SetStateAction<any>>;
}

/**
 * EconomyLaborTab — wraps the Economy and Labor sub-views behind an internal
 * segmented toggle. Replaces the former top-level "Labor" tab; both sub-views
 * share the same props and `economyData`. Initial sub-view is seeded from the
 * URL hash (`#labor` opens Labor) so old deep links still resolve.
 */
export function EconomyLaborTab(props: EconomyLaborTabProps) {
  const [subTab, setSubTab] = React.useState<SubTab>(() => {
    if (typeof window !== "undefined" && window.location.hash.replace("#", "") === "labor") {
      return "labor";
    }
    return "economy";
  });

  const handleChange = (value: string) => {
    const next: SubTab = value === "labor" ? "labor" : "economy";
    setSubTab(next);
    // Keep the hash shareable without triggering a full tab change.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "#" + next);
    }
  };

  const tabs = [
    {
      id: "economy",
      icon: TrendingUp,
      label: "Economy",
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
      label: "Labor",
      badge: 0,
      activeIndicatorClassName:
        "bg-[var(--tab-labor-bg)] border-[var(--tab-labor-primary)]/30 text-[var(--tab-labor-primary)]",
      activeTextClassName: "text-[var(--tab-labor-primary)] dark:text-[var(--tab-labor-accent)]",
      activeIconClassName: "text-[var(--tab-labor-icon)] dark:text-[var(--tab-labor-accent)]",
      glowClassName: "bg-[var(--tab-labor-primary)]/20",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto p-0.5">
        <FacetTabs
          tabs={tabs}
          activeTab={subTab}
          onChange={handleChange}
          tone="mycountry"
          size="sm"
          className="facet-surface facet-refraction w-full min-w-fit rounded-xl border border-white/5 p-1 sm:w-auto"
        />
      </div>

      {subTab === "economy" ? <EconomyTab {...props} /> : <LaborTab {...props} />}
    </div>
  );
}
