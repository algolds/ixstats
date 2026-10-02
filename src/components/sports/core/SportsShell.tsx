"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { getSportCssVars } from "~/lib/sports/theming";
import { SportsSidebarNav, type SportsNavSection, type SportsNavItem } from "./SportsSidebarNav";
import { useSportsFocus } from "./SportsFocusProvider";
import { SportsFocusPanel, SportsFocusSheet } from "./SportsFocusPanel";
import { Card } from "~/components/ui/card";

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
    <div style={sportVars} className={cn("min-h-screen w-full", className)}>
      <div className="mx-auto max-w-[1700px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
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
        <div className="flex flex-col items-start gap-6 lg:flex-row">
          {/* Desktop Left Rail: sticky at --shell-top-offset (80px under the legacy navbar) */}
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="space-y-4 lg:sticky lg:top-(--shell-top-offset)">
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
          <main className="w-full min-w-0 flex-1">
            <Card className="p-4 sm:p-6">{children}</Card>
          </main>

          {/* Desktop Right Rail: Contextual Focus Panel */}
          {focus && (
            <div className="hidden shrink-0 lg:block">
              <div className="lg:sticky lg:top-(--shell-top-offset)">
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
