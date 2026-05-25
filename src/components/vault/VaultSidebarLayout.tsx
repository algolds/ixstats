"use client";

import type { ReactNode } from "react";
import { VaultSidebarNav, type VaultSection } from "./VaultSidebarNav";

interface VaultSidebarLayoutProps {
  children: ReactNode;
  /** Hero section or page header rendered above the grid */
  heroSection?: ReactNode;
  /** Alerts/banners rendered above the main content */
  alerts?: ReactNode;
  /** Controlled mode: active section for sidebar nav */
  activeSection?: VaultSection;
  /** Controlled mode: callback for sidebar nav clicks (instant switching) */
  onNavigate?: (section: VaultSection) => void;
}

export function VaultSidebarLayout({
  children,
  heroSection,
  alerts,
  activeSection,
  onNavigate,
}: VaultSidebarLayoutProps) {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      {heroSection && <div className="container mx-auto px-4 pt-4 sm:pt-6">{heroSection}</div>}

      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Alerts */}
        {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

        {/* Main Layout — icon rail + content */}
        <div className="flex gap-4 sm:gap-6">
          {/* Desktop: Fixed icon rail */}
          <div className="relative z-30 hidden shrink-0 lg:block">
            <div className="sticky top-6">
              <VaultSidebarNav activeSection={activeSection} onNavigate={onNavigate} />
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Mobile: Horizontal nav strip */}
            <div className="mb-4 lg:hidden">
              <VaultSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant="mobile"
              />
            </div>

            <div className="space-y-4 sm:space-y-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
