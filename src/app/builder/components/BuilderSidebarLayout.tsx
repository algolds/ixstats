"use client";

import type { ReactNode } from "react";
import type { BuilderSection } from "../lib/builder-theme";

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
}

export function BuilderSidebarLayout({
  children,
  heroSection,
  alerts,
}: BuilderSidebarLayoutProps) {
  return (
    <div className="space-y-0" data-builder-content>
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-3 pt-3 sm:px-4 sm:pt-4">
          {heroSection}
        </div>
      )}

      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        {/* Alerts */}
        {alerts && <div className="mb-3 space-y-2 sm:mb-4">{alerts}</div>}

        {/* Main Layout */}
        <div className="flex gap-3 sm:gap-4">
          {/* Main Content */}
          <div className="min-w-0 flex-1">
            <div className="space-y-3 sm:space-y-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
