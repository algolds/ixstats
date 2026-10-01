"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Trophy,
  Calendar,
  Shield,
  Clock,
  Group as Users,
  ArrowSeparate as ArrowLeftRight,
  Settings,
  Activity,
  Star,
  WhiteFlag as Flag,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { getSportTheme } from "~/lib/sports/theming";

export type SportsNavSection =
  // Competition / League Sections
  | "overview"
  | "standings"
  | "schedule"
  | "bracket"
  | "races"
  | "draft"
  | "teams"
  | "history"
  // Organization / Club Sections
  | "roster"
  | "tactics"
  | "transfers"
  | "management";

export interface SportsNavItem {
  id: SportsNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export const LEAGUE_NAV_ITEMS: SportsNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Activity,
    description: "Competition pulse & matchday",
  },
  { id: "standings", label: "Standings", icon: Trophy, description: "League tables & form" },
  { id: "schedule", label: "Schedule", icon: Calendar, description: "Match calendar & fixtures" },
  { id: "bracket", label: "Bracket", icon: Shield, description: "Tournament knockout tree" },
  { id: "races", label: "Races", icon: Flag, description: "Grand Prix calendar" },
  { id: "draft", label: "Draft", icon: Star, description: "Rookie selections & pool" },
  { id: "teams", label: "Franchises", icon: Users, description: "Participating clubs" },
  { id: "history", label: "History", icon: Clock, description: "Almanac & past seasons" },
];

export const CLUB_NAV_ITEMS: SportsNavItem[] = [
  { id: "overview", label: "Dashboard", icon: Activity, description: "Next match & squad summary" },
  { id: "roster", label: "Roster", icon: Users, description: "Athletes & depth chart" },
  { id: "tactics", label: "Tactics", icon: Settings, description: "Formation & strategy" },
  {
    id: "transfers",
    label: "Transfers",
    icon: ArrowLeftRight,
    description: "Escrow market & bids",
  },
  { id: "management", label: "Management", icon: Shield, description: "Finances & operations" },
  { id: "history", label: "History", icon: Clock, description: "Titles & past seasons" },
];

export interface SportsSidebarNavProps {
  activeSection: SportsNavSection;
  onNavigate?: (section: SportsNavSection) => void;
  items?: SportsNavItem[];
  mode?: "league" | "club";
  variant?: "expanded" | "desktop" | "mobile";
  visibleSections?: SportsNavSection[];
  sportPreset?: string;
  notifications?: Partial<Record<SportsNavSection, number>>;
  className?: string;
}

export function SportsSidebarNav({
  activeSection,
  onNavigate,
  items,
  mode = "league",
  variant = "expanded",
  visibleSections,
  sportPreset,
  notifications,
  className,
}: SportsSidebarNavProps) {
  const pathname = usePathname();
  const defaultItems = mode === "club" ? CLUB_NAV_ITEMS : LEAGUE_NAV_ITEMS;
  const allItems = items ?? defaultItems;

  const filteredItems = visibleSections
    ? allItems.filter((item) => visibleSections.includes(item.id))
    : allItems;

  const sportTheme = getSportTheme(sportPreset);
  const isControlled = !!onNavigate;

  /* ── Mobile: horizontal pill bar ── */
  if (variant === "mobile") {
    return (
      <nav
        className={cn(
          "bg-surface border-separator rounded-row overflow-hidden border p-1",
          className
        )}
      >
        <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
          {filteredItems.map((item) => {
            const isActive = item.id === activeSection;
            const Icon = item.icon;
            const noteCount = notifications?.[item.id] ?? 0;

            const buttonClass = cn(
              "focus-visible:outline-tint text-footnote relative flex shrink-0 cursor-pointer items-center gap-2 rounded-control px-3 py-2 font-medium transition-colors duration-fast outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2",
              isActive
                ? "bg-tint-fill text-tint"
                : "text-label-secondary hover:bg-fill-3 hover:text-label"
            );

            const content = (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                {noteCount > 0 && !isActive && (
                  <span
                    className="ring-surface bg-yellow absolute top-1 right-1 size-2 rounded-full ring-2"
                    aria-label="New activity"
                  />
                )}
              </>
            );

            if (isControlled) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={buttonClass}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link key={item.id} href={`${pathname}?section=${item.id}`} className={buttonClass}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  /* ── Desktop: Expanded or Icon Rail ── */
  return (
    <nav
      className={cn(
        "bg-surface border-separator rounded-card flex flex-col gap-1 border p-2",
        className
      )}
    >
      {filteredItems.map((item) => {
        const isActive = item.id === activeSection;
        const Icon = item.icon;
        const noteCount = notifications?.[item.id] ?? 0;

        const buttonClass = cn(
          "group focus-visible:outline-tint text-body relative flex w-full cursor-pointer items-center gap-3 rounded-row px-3 py-2 text-left font-medium transition-colors duration-fast outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2",
          isActive ? "bg-tint-fill text-tint" : "text-label hover:bg-fill-3"
        );

        const content = (
          <>
            <div
              className={cn(
                "rounded-control-sm flex size-7 shrink-0 items-center justify-center transition-colors",
                isActive ? "bg-tint text-on-tint" : "bg-fill-3 text-label-secondary"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
            </div>

            {variant === "expanded" && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {noteCount > 0 && (
                    <span className="text-caption bg-yellow/15 text-yellow rounded-full px-2 tabular-nums">
                      {noteCount}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={cn("text-footnote truncate font-normal", "text-label-secondary")}>
                    {item.description}
                  </p>
                )}
              </div>
            )}
          </>
        );

        if (isControlled) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={buttonClass}
              title={item.label}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.id}
            href={`${pathname}?section=${item.id}`}
            className={buttonClass}
            title={item.label}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
