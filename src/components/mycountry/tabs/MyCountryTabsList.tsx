"use client";

import React from "react";
import { BarChart3, TrendingUp, Building, MapPin, History } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { FacetTabs } from "~/components/facet-ui";
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

  if (variant === "underline") {
    return (
      <div className="relative flex items-center gap-1 sm:gap-2 border-b border-white/10 pb-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none">
        {resolvedTabs.map((tab) => {
          const isActive = resolvedActiveTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleChange(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-[0.97]",
                isActive
                  ? tab.activeTextClassName || "text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? tab.activeIconClassName || "text-foreground" : "text-muted-foreground"
                )}
              />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    "ml-1 flex scale-95 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] leading-none font-bold",
                    isActive
                      ? "bg-foreground text-background"
                      : "bg-black/10 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="factbookUnderline"
                  className={cn(
                    "absolute bottom-0 inset-x-2 h-0.5 rounded-full shadow-sm",
                    tab.id === "overview" && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
                    tab.id === "economy" && "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]",
                    tab.id === "labor" && "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]",
                    tab.id === "government" && "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]",
                    tab.id === "geography" && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  )}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-0.5">
      <FacetTabs
        tabs={resolvedTabs}
        activeTab={resolvedActiveTab}
        onChange={handleChange}
        tone="mycountry"
        size="sm"
        className={cn(
          "w-full min-w-fit rounded-xl p-1 transition-all duration-200",
          variant === "rail"
            ? "border-0 bg-black/10 dark:bg-white/[0.03] shadow-none backdrop-blur-md"
            : "facet-surface facet-refraction border border-white/5"
        )}
      />
    </div>
  );
}
