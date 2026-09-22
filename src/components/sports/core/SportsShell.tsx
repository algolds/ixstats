"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { getSportCssVars } from "~/lib/sports/theming";
import { SportsSidebarNav, type SportsNavSection, type SportsNavItem } from "./SportsSidebarNav";
import { useSportsFocus } from "./SportsFocusProvider";
import { SportsFocusPanel, SportsFocusSheet } from "./SportsFocusPanel";

export interface SportsShellProps {
  children: React.ReactNode;
  activeSection: SportsNavSection;
  onNavigate?: (section: SportsNavSection) => void;
  commandBar?: React.ReactNode;
  heroSection?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
  navItems?: SportsNavItem[];
  mode?: "league" | "club";
  sportPreset?: string;
  visibleSections?: SportsNavSection[];
  notifications?: Partial<Record<SportsNavSection, number>>;
  className?: string;
}

export function SportsShell({
  children,
  activeSection,
  onNavigate,
  commandBar,
  heroSection,
  sidebarExtra,
  navItems,
  mode = "league",
  sportPreset,
  visibleSections,
  notifications,
  className,
}: SportsShellProps) {
  const sportVars = getSportCssVars(sportPreset);
  const { focus } = useSportsFocus();

  return (
    <div
      style={sportVars}
      className={cn("min-h-screen w-full transition-colors duration-300", className)}
    >
      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-4">
        {/* Top Command Bar */}
        {commandBar}

        {/* Hero Section (Optional HUD banner) */}
        {heroSection}

        {/* Mobile Section Navigator */}
        <div className="lg:hidden">
          <SportsSidebarNav
            activeSection={activeSection}
            onNavigate={onNavigate}
            items={navItems}
            mode={mode}
            variant="mobile"
            sportPreset={sportPreset}
            visibleSections={visibleSections}
            notifications={notifications}
          />
        </div>

        {/* Main Content Layout with optional docked Focus Rail */}
        <div className="flex flex-col gap-6 lg:flex-row items-start">
          {/* Desktop Left Rail: lg:sticky lg:top-20 (80px) for 16px buffer beneath floating navbar */}
          <aside className="hidden lg:block w-60 shrink-0">
            <div className="lg:sticky lg:top-20 space-y-4">
              <SportsSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                items={navItems}
                mode={mode}
                variant="expanded"
                sportPreset={sportPreset}
                visibleSections={visibleSections}
                notifications={notifications}
              />
              {sidebarExtra}
            </div>
          </aside>

          {/* Main Content Workspace */}
          <main className="min-w-0 flex-1 w-full">
            <div className="facet-hierarchy-parent rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-6 shadow-lg backdrop-blur-xl transition-all duration-300">
              {children}
            </div>
          </main>

          {/* Desktop Right Rail: Contextual Focus Panel */}
          {focus && (
            <div className="hidden lg:block shrink-0">
              <div className="lg:sticky lg:top-20">
                <SportsFocusPanel sportPreset={sportPreset} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Focus Sheet (Fallback for <1024px touch viewports) */}
      <div className="lg:hidden">
        <SportsFocusSheet sportPreset={sportPreset} />
      </div>
    </div>
  );
}

