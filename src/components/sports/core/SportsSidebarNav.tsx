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
  { id: "overview", label: "Overview", icon: Activity, description: "Competition pulse & matchday" },
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
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight, description: "Escrow market & bids" },
  { id: "management", label: "Management", icon: Shield, description: "Finances & operations" },
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
      <nav className={cn("facet-hierarchy-child border-border/40 bg-card/60 overflow-hidden rounded-xl border p-1.5 backdrop-blur-md", className)}>
        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {filteredItems.map((item) => {
            const isActive = item.id === activeSection;
            const Icon = item.icon;
            const noteCount = notifications?.[item.id] ?? 0;

            const buttonClass = cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer outline-none select-none",
              isActive
                ? "bg-foreground text-background shadow-md font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              "active:scale-[0.98]"
            );

            const content = (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                {noteCount > 0 && !isActive && (
                  <span className="ring-background absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2" />
                )}
              </>
            );

            if (isControlled) {
              return (
                <button
                  key={item.id}
                  type="button"
                  data-cuelume-press="subtle"
                  onClick={() => onNavigate?.(item.id)}
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
    <nav className={cn("facet-hierarchy-child border-border/40 bg-card/60 flex flex-col gap-1 rounded-2xl border p-2 backdrop-blur-md", className)}>
      {filteredItems.map((item) => {
        const isActive = item.id === activeSection;
        const Icon = item.icon;
        const noteCount = notifications?.[item.id] ?? 0;

        const buttonClass = cn(
          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all duration-150 cursor-pointer outline-none select-none",
          isActive
            ? "bg-foreground text-background shadow-sm font-bold"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          "active:scale-[0.98]"
        );

        const content = (
          <>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-background/20 text-background"
                  : "bg-muted/30 text-muted-foreground group-hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
            </div>

            {variant === "expanded" && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {noteCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-400">
                      {noteCount}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p
                    className={cn(
                      "truncate text-[11px] font-normal",
                      isActive ? "text-background/70" : "text-muted-foreground/60"
                    )}
                  >
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
              data-cuelume-press="subtle"
              onClick={() => onNavigate?.(item.id)}
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
