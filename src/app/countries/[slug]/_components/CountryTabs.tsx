"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, BookOpen, Activity } from "lucide-react";
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
 * Tier 1 navigation: Factbook / Dossier / Activity.
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
      className="facet-surface facet-refraction w-full rounded-2xl border border-white/10 p-1.5 shadow-sm saturate-180 backdrop-blur-xl"
    >
      <div className="grid w-full grid-cols-3 gap-1.5">
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
                "group relative flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-150 ease-out active:scale-[0.97] sm:text-sm",
                isActive
                  ? "bg-[var(--flag-primary)]/12 text-[var(--flag-primary)] shadow-sm ring-1 ring-[var(--flag-primary)]/30 backdrop-blur-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
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
              <span>{item.label}</span>
              {isActive && (
                <span
                  className="absolute inset-x-4 -bottom-[6px] h-0.5 rounded-full bg-[var(--flag-primary)] opacity-85 shadow-[0_0_8px_var(--flag-primary)] transition-all duration-300"
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
