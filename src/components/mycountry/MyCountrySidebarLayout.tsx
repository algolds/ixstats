"use client";

import type { ReactNode } from "react";
import { MyCountrySidebarNav, type MyCountrySection } from "./MyCountrySidebarNav";

interface MyCountrySidebarLayoutProps {
  children: ReactNode;
  /** Hero section or page header rendered above the grid */
  heroSection?: ReactNode;
  /** Alerts/banners rendered above the main content */
  alerts?: ReactNode;
  /** Extra content rendered below the nav in the sidebar column (desktop only) */
  sidebarExtra?: ReactNode;
  /** Controlled mode: active section for sidebar nav */
  activeSection?: MyCountrySection;
  /** Controlled mode: callback for sidebar nav clicks (instant switching) */
  onNavigate?: (section: MyCountrySection) => void;
  /** Notification counts per section for sidebar nav indicators */
  notifications?: Partial<Record<string, number>>;
}

export function MyCountrySidebarLayout({
  children,
  heroSection,
  alerts,
  sidebarExtra,
  activeSection,
  onNavigate,
  notifications,
}: MyCountrySidebarLayoutProps) {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-3 pt-3 sm:px-4 sm:pt-4">
          {heroSection}
        </div>
      )}

      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        {/* Alerts */}
        {alerts && <div className="mb-3 space-y-2 sm:mb-4">{alerts}</div>}

        {/* Main Layout — icon rail + content */}
        <div className="flex gap-3 sm:gap-4">
          {/* Desktop: Fixed sidebar column — icon rail (or expanded with labels when sidebarExtra is present) */}
          <div className={`relative z-30 hidden flex-shrink-0 lg:block ${sidebarExtra ? "w-56" : ""}`}>
            <div className="sticky top-6 space-y-3">
              <MyCountrySidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant={sidebarExtra ? "expanded" : "desktop"}
                notifications={notifications}
              />
              {sidebarExtra}
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Mobile: Horizontal nav strip */}
            <div className="mb-3 lg:hidden">
              <MyCountrySidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant="mobile"
                notifications={notifications}
              />
            </div>

            <div className="space-y-3 sm:space-y-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
