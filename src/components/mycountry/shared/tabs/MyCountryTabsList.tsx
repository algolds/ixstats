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
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

/**
 * The top-level tab strip (At a Glance / Economy / Labor / Government /
 * Geography) for the MyCountry tab system, using the shared SegmentedControl
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
      value: "overview",
      icon: <BarChart3 />,
      label: (
        <>
          <span className="hidden sm:inline">At a Glance</span>
          <span className="sm:hidden">Glance</span>
        </>
      ),
    },
    {
      value: "economy",
      icon: <TrendingUp />,
      label: (
        <>
          <span className="hidden sm:inline">Economy</span>
          <span className="sm:hidden">Econ</span>
        </>
      ),
    },
    {
      value: "labor",
      icon: <History />,
      label: (
        <>
          <span className="hidden sm:inline">Labor</span>
          <span className="sm:hidden">Labor</span>
        </>
      ),
    },
    {
      value: "government",
      icon: <Building />,
      label: (
        <>
          <span className="hidden sm:inline">Government</span>
          <span className="sm:hidden">Gov</span>
        </>
      ),
      badge: govBadge || undefined,
    },
    {
      value: "geography",
      icon: <MapPin />,
      label: (
        <>
          <span className="hidden sm:inline">Geography</span>
          <span className="sm:hidden">Geo</span>
        </>
      ),
    },
  ];

  const resolvedTabs = v2 ? tabs.filter((t) => t.value !== "overview") : tabs;

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
      <div className="border-separator relative flex [scrollbar-width:none] items-center gap-1 overflow-x-auto overflow-y-hidden border-b pb-0.5 select-none [-ms-overflow-style:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
        {resolvedTabs.map((tab) => {
          const isActive = resolvedActiveTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => handleChange(tab.id)}
              className={cn(
                "focus-visible:ring-tint rounded-control text-caption sm:text-body relative flex min-h-9 items-center gap-2 px-3 py-2 transition-[color,background-color,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]",
                isActive
                  ? "text-label font-semibold"
                  : "text-label-secondary hover:text-label hover:bg-fill-3"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", isActive ? "text-tint" : "text-label-secondary")}
              />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    "rounded-control-sm text-caption ml-1 flex items-center justify-center px-2 py-0.5 leading-none font-semibold tabular-nums",
                    isActive ? "bg-label text-background" : "bg-fill-3 text-label-secondary"
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="factbookUnderline"
                  className="bg-yellow absolute inset-x-2 bottom-0 h-0.5 rounded-full"
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
      <SegmentedControl
        options={resolvedTabs}
        value={resolvedActiveTab}
        onValueChange={handleChange}
        size="sm"
        className={cn(
          "rounded-row w-full min-w-fit p-1",
          variant === "rail"
            ? "bg-fill-3 border-0 shadow-none"
            : "bg-fill-3 border-separator border"
        )}
        asTabs
      />
    </div>
  );
}
