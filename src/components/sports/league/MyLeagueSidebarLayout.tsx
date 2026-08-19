"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { MyLeagueSidebarNav, type MyLeagueSection } from "./MyLeagueSidebarNav";

interface MyLeagueSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  alerts?: ReactNode;
  sidebarExtra?: ReactNode;
  activeSection: MyLeagueSection;
  onNavigate: (section: MyLeagueSection) => void;
  notifications?: Partial<Record<MyLeagueSection, number>>;
  teamColor?: string;
}

const SECTION_THEMES: Record<
  MyLeagueSection,
  {
    borderClass: string;
    shadowClass: string;
  }
> = {
  overview: {
    borderClass: "border-t-slate-400/40",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(148,163,184,0.15)]",
  },
  roster: {
    borderClass: "border-t-blue-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(59,130,246,0.2)]",
  },
  tactics: {
    borderClass: "border-t-red-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(239,68,68,0.2)]",
  },
  transfers: {
    borderClass: "border-t-cyan-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(6,182,212,0.2)]",
  },
  management: {
    borderClass: "border-t-amber-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(245,158,11,0.2)]",
  },
};

export function MyLeagueSidebarLayout({
  children,
  heroSection,
  alerts,
  sidebarExtra,
  activeSection,
  onNavigate,
  notifications,
  teamColor,
}: MyLeagueSidebarLayoutProps) {
  const theme = SECTION_THEMES[activeSection] || SECTION_THEMES.overview;

  const borderStyle: React.CSSProperties = teamColor
    ? {
        borderTopColor: teamColor,
        boxShadow: `0 -8px 25px -8px ${teamColor}33`,
      }
    : {};

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
            className={cn("relative z-35 hidden shrink-0 lg:block", sidebarExtra ? "w-56" : "w-12")}
          >
            <div className="sticky top-6 space-y-3">
              <MyLeagueSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant={sidebarExtra ? "expanded" : "desktop"}
                notifications={notifications}
                teamColor={teamColor}
              />
              {sidebarExtra}
            </div>
          </div>

          {/* Core Content Pane */}
          <div className="min-w-0 flex-1">
            {/* Mobile Viewports: horizontal navigator tabs */}
            <div className="mb-3 lg:hidden">
              <MyLeagueSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant="mobile"
                notifications={notifications}
                teamColor={teamColor}
              />
            </div>

            {/* Facet Container Frame */}
            <div
              className={cn(
                "rounded-t-xl border-t-2 pt-2 transition-all duration-500 ease-in-out",
                !teamColor && theme.borderClass,
                !teamColor && theme.shadowClass
              )}
              style={borderStyle}
            >
              <div className="space-y-3 sm:space-y-4">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
