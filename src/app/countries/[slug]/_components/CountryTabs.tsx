"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, BookOpen, Activity } from "lucide-react";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";

export type TabType = "overview" | "lore" | "activity";

interface CountryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  countrySlug?: string;
}

/**
 * CountryTabs — the prominent page-level top bar for the public country
 * profile. Tier 1 navigation: Factbook / Dossier / Activity.
 *
 * Renders real `<Link>`s to nested routes so tab state is shareable and
 * back/forward works. The active tab is derived from the URL pathname (via the
 * `countrySlug` base path) and the top bar reads the flag palette for theming.
 */
export function CountryTabs({ activeTab, onTabChange, countrySlug }: CountryTabsProps) {
  const pathname = usePathname();

  const base = countrySlug ? `/countries/${countrySlug}` : "";

  const items: { id: TabType; icon: typeof Eye; label: string; href: string }[] = [
    { id: "overview", icon: Eye, label: "Factbook", href: `${base}/factbook` },
    { id: "lore", icon: BookOpen, label: "Dossier", href: `${base}/dossier` },
    { id: "activity", icon: Activity, label: "Activity", href: `${base}/activity` },
  ];

  // Derive the active tier from the pathname so deep links highlight correctly.
  const resolvedActive = React.useMemo<TabType>(() => {
    if (!base || !pathname) return activeTab;
    const rest = pathname.replace(base, "").replace(/^\/+/, "");
    if (rest === "" || rest.startsWith("factbook")) return "overview";
    if (rest.startsWith("dossier")) return "lore";
    if (rest.startsWith("activity")) return "activity";
    return activeTab;
  }, [base, pathname, activeTab]);

  return (
    <nav
      aria-label="Country profile sections"
      className="facet-surface facet-refraction w-full rounded-xl border border-white/5 p-1 shadow-sm"
    >
      <div className="grid w-full grid-cols-3 gap-1">
        {items.map((item) => {
          const isActive = resolvedActive === item.id;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={createUrl(item.href)}
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200 active:scale-[0.98]",
                isActive
                  ? "bg-[var(--flag-primary)]/12 text-[var(--flag-primary)] shadow-sm ring-1 ring-[var(--flag-primary)]/25"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              )}
              style={
                isActive
                  ? {
                      color: "var(--flag-primary)",
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.label}</span>
              {isActive && (
                <span
                  className="absolute inset-x-3 -bottom-[5px] h-0.5 rounded-full bg-[var(--flag-primary)] opacity-70"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
