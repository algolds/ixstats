"use client";

import React from "react";
import { BarChart3, TrendingUp, Building, MapPin, History } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FacetTabs } from "~/components/facet-ui";
import { createUrl } from "~/lib/url-utils";

/**
 * The top-level tab strip (At a Glance / Economy / Labor / Government /
 * Geography) for the MyCountry tab system, using the shared FacetTabs
 * component to support Apple-Switch sliding animations, spring-physics
 * dragging, and relative sheens.
 *
 * Two modes:
 * - `baseHref` set (public country profile): tabs are derived from the URL
 *   pathname and clicking navigates to `<baseHref>/<id>`.
 * - `baseHref` unset (/mycountry): tabs are driven by local state via
 *   `onChangeAction`.
 *
 * @param activeTab Current active tab id.
 * @param onChangeAction Callback triggered on tab change.
 * @param govComponentCount Number of configured government components. When 0,
 *                          the Government tab shows a "1" setup badge.
 * @param baseHref Optional route prefix; when present, the tab strip becomes
 *                 link-based and the active tab is inferred from the pathname.
 */
export function MyCountryTabsList({
  activeTab,
  onChangeAction,
  govComponentCount,
  v2 = false,
  baseHref,
  showGovSetupBadge = true,
}: {
  activeTab: string;
  onChangeAction: (value: string) => void;
  govComponentCount: number;
  v2?: boolean;
  baseHref?: string;
  showGovSetupBadge?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const govBadge = showGovSetupBadge && govComponentCount === 0 ? 1 : 0; // Needs setup

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
      icon: History,
      label: (
        <>
          <span className="hidden sm:inline">Labor</span>
          <span className="sm:hidden">Labor</span>
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

  const resolvedTabs = v2 ? tabs.filter((t) => t.id !== "overview") : tabs;

  const handleChange = (value: string) => {
    if (baseHref) {
      // `overview` is the factbook index itself (`<baseHref>`, not `/overview`).
      const href = value === "overview" ? baseHref : `${baseHref}/${value}`;
      router.push(createUrl(href));
      onChangeAction(value);
      return;
    }
    onChangeAction(value);
  };

  // In link mode, the active tab is derived from the pathname segment after
  // `baseHref`, falling back to the passed `activeTab`.
  const resolvedActiveTab = React.useMemo(() => {
    if (!baseHref) return activeTab;
    const baseParts = baseHref.replace(/\/+$/, "").split("/");
    const pathParts = (pathname || "").split("/").filter(Boolean);
    if (pathParts.length > baseParts.length) {
      return pathParts[baseParts.length]!;
    }
    return activeTab;
  }, [baseHref, pathname, activeTab]);

  return (
    <div className="overflow-x-auto p-0.5">
      <FacetTabs
        tabs={resolvedTabs}
        activeTab={resolvedActiveTab}
        onChange={handleChange}
        tone="mycountry"
        size="sm"
        className="facet-surface facet-refraction w-full min-w-fit rounded-xl border border-white/5 p-1"
      />
    </div>
  );
}
