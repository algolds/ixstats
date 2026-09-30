"use client";

import React from "react";
import {
  StatsReport as BarChart3,
  StatUp as TrendingUp,
  Building,
  MapPin,
  ClockRotateRight as History,
} from "iconoir-react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { FacetTabs } from "~/components/ui/facet";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/utils";

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
  variant = "boxed",
}: {
  activeTab: string;
  onChangeAction: (value: string) => void;
  govComponentCount: number;
  v2?: boolean;
  baseHref?: string;
  showGovSetupBadge?: boolean;
  variant?: "boxed" | "rail" | "underline";
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

  if (variant === "underline") {
    return (
      <div className="border-border relative flex [scrollbar-width:none] items-center gap-1 overflow-x-auto overflow-y-hidden border-b pb-0.5 select-none [-ms-overflow-style:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
        {resolvedTabs.map((tab) => {
          const isActive = resolvedActiveTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              data-cuelume-press="page"
              data-cuelume-hover="tick"
              onClick={() => handleChange(tab.id)}
              className={cn(
                "focus-visible:ring-ring relative flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-[color,background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98] sm:text-sm",
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-amber-500" : "text-muted-foreground"
                )}
              />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    "ml-1 flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs leading-none font-semibold tabular-nums",
                    isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="factbookUnderline"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-500"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="[scrollbar-width:none] overflow-x-auto p-0.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <FacetTabs
        tabs={resolvedTabs}
        activeTab={resolvedActiveTab}
        onChange={handleChange}
        tone="mycountry"
        size="sm"
        className={cn(
          "w-full min-w-fit rounded-xl p-1",
          variant === "rail"
            ? "bg-muted/50 border-0 shadow-none"
            : "bg-muted/50 border-border border"
        )}
      />
    </div>
  );
}
