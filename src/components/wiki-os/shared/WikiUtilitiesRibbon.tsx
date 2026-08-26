// src/components/wiki-os/shared/WikiUtilitiesRibbon.tsx
// Universal macOS-inspired Utilities & Special Navigation Ribbon for non-article wiki pages.
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Folder,
  Clock,
  Shuffle,
  MediaImage as ImageIcon,
  Wrench,
  Bookmark,
  Search,
  Plus,
  Spark,
} from "iconoir-react";
import { motion } from "motion/react";
import { withBasePath, stripBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

interface WikiUtilitiesRibbonProps {
  onSearchClick?: () => void;
  onCreatePageClick?: () => void;
  className?: string;
}

interface UtilityTab {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const UTILITY_TABS: UtilityTab[] = [
  { id: "main", label: "Hub", href: "/wiki", icon: Home },
  { id: "categories", label: "Categories", href: "/util/categories", icon: Folder },
  { id: "recent", label: "Recent Changes", href: "/util/recent-changes", icon: Clock },
  { id: "repository", label: "Repository", href: "/util/repository", icon: ImageIcon },
  { id: "utilities", label: "Utilities", href: "/util", icon: Wrench, badge: "Deck" },
  { id: "random", label: "Random", href: "/util/random", icon: Shuffle },
  { id: "watchlist", label: "Watchlist", href: "/util/watchlist", icon: Bookmark },
  { id: "lorewards", label: "Lorewards", href: "/util/lorewards", icon: Spark },
];

export function WikiUtilitiesRibbon({
  onSearchClick,
  onCreatePageClick,
  className,
}: WikiUtilitiesRibbonProps) {
  const pathname = usePathname();
  const cleanPath = stripBasePath(pathname);

  const getActiveTabId = () => {
    if (cleanPath === "/wiki" || cleanPath === "/wiki/" || cleanPath === "/wiki/Main_Page") return "main";
    if (cleanPath.startsWith("/util/categories") || cleanPath.startsWith("/wiki/categories")) return "categories";
    if (cleanPath.startsWith("/util/recent") || cleanPath.startsWith("/wiki/recent")) return "recent";
    if (cleanPath.startsWith("/util/repository") || cleanPath.startsWith("/wiki/repository")) return "repository";
    if (cleanPath === "/util" || cleanPath === "/util/" || cleanPath.startsWith("/util/utilities") || cleanPath.startsWith("/wiki/utilities")) return "utilities";
    if (cleanPath.startsWith("/util/random") || cleanPath.startsWith("/wiki/random")) return "random";
    if (cleanPath.startsWith("/util/watchlist") || cleanPath.startsWith("/wiki/watchlist") || cleanPath.startsWith("/stashes")) return "watchlist";
    if (cleanPath.startsWith("/util/lorewards") || cleanPath.startsWith("/wiki/lorewards")) return "lorewards";
    return null;
  };

  const activeTabId = getActiveTabId();

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-2.5 rounded-2xl border border-border/50 bg-card/60 p-1.5 backdrop-blur-xl shadow-xs sm:flex-row sm:items-center sm:justify-between select-none",
        className
      )}
    >
      {/* Scrollable Ribbon Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5 flex-1">
        {UTILITY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabId === tab.id;

          return (
            <Link
              key={tab.id}
              href={withBasePath(tab.href)}
              data-cuelume-press="soft"
              data-cuelume-hover="tick"
              className={cn(
                "relative z-10 flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98]",
                isActive
                  ? "text-black dark:text-black font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeUtilityRibbonTab"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                  className="absolute inset-0 -z-10 rounded-xl bg-wiki shadow-sm"
                />
              )}
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge && !isActive && (
                <span className="rounded-md bg-wiki/15 px-1 py-0.2 text-[9px] font-bold text-wiki uppercase tracking-wider">
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Launch Action Buttons */}
      <div className="flex items-center gap-1.5 border-t border-border/30 pt-1.5 sm:border-t-0 sm:pt-0 sm:pl-2 shrink-0">
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            data-cuelume-press="tap"
            data-cuelume-hover="tick"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-[0.98] transition-all cursor-pointer"
            title="Spotlight Search (⌘K)"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden lg:inline-block rounded border border-border/40 bg-background/50 px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}

        {onCreatePageClick && (
          <button
            type="button"
            onClick={onCreatePageClick}
            data-cuelume-press="tap"
            data-cuelume-hover="tick"
            className="inline-flex items-center gap-1 rounded-xl bg-wiki/15 border border-wiki/30 px-2.5 py-1.5 text-xs font-bold text-wiki hover:bg-wiki/25 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            title="Create New Page"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Page</span>
          </button>
        )}
      </div>
    </div>
  );
}
