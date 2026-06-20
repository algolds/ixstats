"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { LeagueSidebarNav, type LeagueSection } from "./LeagueSidebarNav";

interface LeagueSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  alerts?: ReactNode;
  sidebarExtra?: ReactNode;
  activeSection: LeagueSection;
  onNavigate: (section: LeagueSection) => void;
  notifications?: Partial<Record<LeagueSection, number>>;
  visibleSections?: LeagueSection[];
  sportAccent?: string;
  sportHighlight?: string;
}

const SECTION_THEMES: Record<
  LeagueSection,
  {
    borderClass: string;
    shadowClass: string;
  }
> = {
  overview: {
    borderClass: "border-t-slate-400/40",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(148,163,184,0.15)]",
  },
  standings: {
    borderClass: "border-t-blue-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(59,130,246,0.2)]",
  },
  schedule: {
    borderClass: "border-t-cyan-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(6,182,212,0.2)]",
  },
  bracket: {
    borderClass: "border-t-red-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(239,68,68,0.2)]",
  },
  races: {
    borderClass: "border-t-orange-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(249,115,22,0.2)]",
  },
  draft: {
    borderClass: "border-t-emerald-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(16,185,129,0.2)]",
  },
  sim: {
    borderClass: "border-t-purple-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(168,85,247,0.2)]",
  },
  teams: {
    borderClass: "border-t-amber-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(245,158,11,0.2)]",
  },
  history: {
    borderClass: "border-t-violet-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(139,92,246,0.2)]",
  },
};

function sportAccentShadow(accent: string | undefined): string {
  if (!accent) return "";
  return `0_-8px_25px_-8px_hsl(var(--myleague-accent)/0.2)`;
}

export function LeagueSidebarLayout({
  children,
  heroSection,
  alerts,
  sidebarExtra,
  activeSection,
  onNavigate,
  notifications,
  visibleSections,
  sportAccent,
  sportHighlight,
}: LeagueSidebarLayoutProps) {
  const theme = SECTION_THEMES[activeSection] ?? SECTION_THEMES.overview;

  const contentFrameStyle = {
    "--myleague-accent": sportAccent ?? "",
    "--myleague-highlight": sportHighlight ?? "",
  } as React.CSSProperties;

  const sportShadowStyle: React.CSSProperties = sportAccent
    ? { boxShadow: `0 -8px 25px -8px hsl(${sportAccent} / 0.2)` }
    : {};

  const hasSidebarExtra = !!sidebarExtra;

  return (
    <div className="space-y-0">
      {/* Hero Header */}
      {heroSection && (
        <div className="container mx-auto px-3 pt-3 sm:px-4 sm:pt-4">{heroSection}</div>
      )}

      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        {/* Banners / Alerts */}
        {alerts && <div className="mb-3 space-y-2 sm:mb-4">{alerts}</div>}

        {/* Core Layout Grid */}
        <div className="flex gap-3 sm:gap-4">
          {/* Desktop Sidebar Column */}
          <div
            className={cn(
              "relative z-35 hidden shrink-0 lg:block",
              hasSidebarExtra ? "w-72" : "w-12"
            )}
          >
            <div className="sticky top-6 space-y-3">
              <LeagueSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant={hasSidebarExtra ? "expanded" : "desktop"}
                notifications={notifications}
                visibleSections={visibleSections}
                sportAccent={sportAccent}
                sportHighlight={sportHighlight}
              />
              {sidebarExtra}
            </div>
          </div>

          {/* Core Content Pane */}
          <div className="min-w-0 flex-1">
            {/* Mobile Viewports: horizontal navigator tabs */}
            <div className="mb-3 lg:hidden">
              <LeagueSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant="mobile"
                notifications={notifications}
                visibleSections={visibleSections}
                sportAccent={sportAccent}
                sportHighlight={sportHighlight}
              />
            </div>

            {/* Facet Container Frame */}
            <div
              className={cn(
                "rounded-t-xl border-t-2 pt-2 transition-all duration-500 ease-in-out",
                sportAccent ? "" : theme.borderClass,
                theme.shadowClass
              )}
              style={{
                ...contentFrameStyle,
                ...sportShadowStyle,
                borderTopColor: sportAccent ? `hsl(${sportAccent})` : undefined,
              }}
            >
              <div className="space-y-3 sm:space-y-4">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
