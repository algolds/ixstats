"use client";
// src/components/wiki-os/shared/WikiUtilitiesRibbon.tsx
// Universal macOS-inspired Utilities & Special Navigation Ribbon for non-article wiki pages.

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
import { Button } from "~/components/ui/button";

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
  { id: "recent", label: "Recent changes", href: "/util/recent-changes", icon: Clock },
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
    if (cleanPath === "/wiki" || cleanPath === "/wiki/" || cleanPath === "/wiki/Main_Page")
      return "main";
    if (cleanPath.startsWith("/util/categories") || cleanPath.startsWith("/wiki/categories"))
      return "categories";
    if (cleanPath.startsWith("/util/recent") || cleanPath.startsWith("/wiki/recent"))
      return "recent";
    if (cleanPath.startsWith("/util/repository") || cleanPath.startsWith("/wiki/repository"))
      return "repository";
    if (
      cleanPath === "/util" ||
      cleanPath === "/util/" ||
      cleanPath.startsWith("/util/utilities") ||
      cleanPath.startsWith("/wiki/utilities")
    )
      return "utilities";
    if (cleanPath.startsWith("/util/random") || cleanPath.startsWith("/wiki/random"))
      return "random";
    if (
      cleanPath.startsWith("/util/watchlist") ||
      cleanPath.startsWith("/wiki/watchlist") ||
      cleanPath.startsWith("/stashes")
    )
      return "watchlist";
    if (cleanPath.startsWith("/util/lorewards") || cleanPath.startsWith("/wiki/lorewards"))
      return "lorewards";
    return null;
  };

  const activeTabId = getActiveTabId();

  return (
    <div
      className={cn(
        "border-separator bg-surface rounded-card mb-6 flex flex-col gap-2 border p-2 select-none sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {/* Scrollable Ribbon Tabs */}
      <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto px-0.5 py-0.5">
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
                "rounded-row text-caption relative z-10 flex shrink-0 items-center gap-2 px-3 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                isActive
                  ? "font-semibold text-black"
                  : "text-label-secondary hover:bg-fill-3 hover:text-label"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeUtilityRibbonTab"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                  className="bg-tint rounded-row shadow-card absolute inset-0 -z-10"
                />
              )}
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge && !isActive && (
                <span className="bg-tint/15 py-0.2 text-tint rounded-control-sm text-eyebrow px-1">
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Launch Action Buttons */}
      <div className="border-separator flex shrink-0 items-center gap-2 border-t pt-2 sm:border-t-0 sm:pt-0 sm:pl-2">
        {onSearchClick && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSearchClick}
            title="Spotlight Search (⌘K)"
            className="text-label-secondary"
          >
            <Search className="text-label-secondary h-3.5 w-3.5" />
            <span className="hidden md:inline">Search</span>
            <kbd className="border-separator bg-surface py-0.2 text-label-secondary rounded-control-sm text-footnote hidden border px-1 tabular-nums lg:inline-block">
              ⌘K
            </kbd>
          </Button>
        )}

        {onCreatePageClick && (
          <Button variant="secondary" size="sm" onClick={onCreatePageClick} title="Create new page">
            <Plus className="h-3.5 w-3.5" />
            <span>New page</span>
          </Button>
        )}
      </div>
    </div>
  );
}
