"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { BuilderSection } from "../lib/builder-theme";
import { BuilderPreviewWidget } from "./BuilderPreviewWidget";
import { BuilderSectionNavWidget } from "./BuilderSectionNavWidget";
import { BuilderHelpWidget } from "./BuilderHelpWidget";

interface BuilderSidebarLayoutProps {
  children: ReactNode;
  /** Hero section rendered above the grid */
  heroSection?: ReactNode;
  /** Alerts/banners rendered above main content */
  alerts?: ReactNode;
  /** Active builder section */
  activeSection: BuilderSection;
  /** Callback for sidebar nav clicks */
  onNavigate: (section: BuilderSection) => void;
  /** Which steps have been completed */
  completedSteps?: Set<BuilderSection>;
  /** Which steps can be accessed */
  accessibleSteps?: Set<BuilderSection>;
  /** Builder mode: 'create' or 'edit' */
  mode?: "create" | "edit";
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
}

export function BuilderSidebarLayout({
  children,
  heroSection,
  alerts,
  activeSection,
  onNavigate,
  completedSteps,
  accessibleSteps,
  mode = "create",
  heroCollapsed,
  onHeroExpand,
}: BuilderSidebarLayoutProps) {
  return (
    <div className="flex flex-col" data-builder-content>
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-4 pt-[6vh] lg:pt-[8vh]">{heroSection}</div>
      )}

      {/* Alerts */}
      {alerts && (
        <div className="container mx-auto px-4 pt-4 sm:pt-6">
          <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>
        </div>
      )}

      {/* Main Layout */}
      <div className={cn("container mx-auto flex gap-4 px-4 pb-4 sm:gap-6 sm:pb-6", !heroSection && "pt-16 lg:pt-20")}>
        {/* Desktop Sidebar Nav (CutoutCard widgets) */}
        <div className="relative z-30 hidden shrink-0 lg:block">
          <div className="space-y-4">
            {activeSection !== "import" && (
              <BuilderPreviewWidget
                heroCollapsed={heroCollapsed}
                onHeroExpand={onHeroExpand}
                activeSection={activeSection}
              />
            )}
            <BuilderSectionNavWidget activeSection={activeSection} />
            {activeSection === "import" ? (
              <div id="import-sidebar-portal" className="space-y-4" />
            ) : (
              <BuilderHelpWidget activeSection={activeSection} />
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          <div className="space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
