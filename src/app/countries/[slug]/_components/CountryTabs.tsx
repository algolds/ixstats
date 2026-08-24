"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, OpenBook as BookOpen, Activity, Trophy, ChatBubble as MessageSquare } from "iconoir-react";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/utils";
import type { ProfileTabType } from "../_types";

export type TabType = ProfileTabType;

interface CountryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  countrySlug?: string;
}

interface NavItem {
  id: TabType;
  icon: typeof Eye;
  label: string;
  href: string;
}

/**
 * CountryTabs — prominent page-level top bar for the public country profile.
 * Tier 1 navigation: Factbook / Dossier / Wiki & Accolades / Community / Activity.
 *
 * Employs Apple Design physical motion (active scale press, fluid indicator,
 * depth refraction) and strict type inference for tab items.
 */
export function CountryTabs({ activeTab, onTabChange, countrySlug }: CountryTabsProps) {
  const pathname = usePathname();

  const base = countrySlug ? `/countries/${countrySlug}` : "";

  const items: NavItem[] = [
    { id: "overview", icon: Eye, label: "Factbook", href: `${base}/factbook` },
    { id: "lore", icon: BookOpen, label: "Dossier", href: `${base}/dossier` },
    { id: "wiki", icon: Trophy, label: "Wiki & Accolades", href: `${base}/wiki` },
    { id: "forum", icon: MessageSquare, label: "Community", href: `${base}/forum` },
    { id: "activity", icon: Activity, label: "Activity", href: `${base}/activity` },
  ];

  // Derive the active tier from the pathname so deep links highlight correctly.
  const resolvedActive = React.useMemo<TabType>(() => {
    if (!base || !pathname) return activeTab;
    const rest = pathname.replace(base, "").replace(/^\/+/, "");
    if (rest === "" || rest.startsWith("factbook")) return "overview";
    if (rest.startsWith("dossier")) return "lore";
    if (rest.startsWith("wiki")) return "wiki";
    if (rest.startsWith("forum")) return "forum";
    if (rest.startsWith("activity")) return "activity";
    return activeTab;
  }, [base, pathname, activeTab]);

  return (
    <nav
      aria-label="Country profile sections"
      className="facet-surface facet-refraction flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-black/8 dark:border-white/10 bg-white/70 dark:bg-stone-900/70 p-1.5 shadow-md saturate-180 backdrop-blur-2xl scrollbar-none"
    >
      {items.map((item) => {
        const isActive = resolvedActive === item.id;
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={createUrl(item.href)}
            onClick={() => onTabChange(item.id)}
            aria-current={isActive ? "page" : undefined}
            data-cuelume-press="soft"
            className={cn(
              "group relative flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all duration-150 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
              isActive
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950 shadow-sm"
                : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
