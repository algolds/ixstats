"use client";

import type { ReactNode } from "react";
import { ThinkPagesSidebarNav, type ThinkPagesSection } from "./ThinkPagesSidebarNav";
import { ThinkPagesStatusWidget } from "./ThinkPagesStatusWidget";

interface ThinkPagesSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  alerts?: ReactNode;
  activeSection?: ThinkPagesSection;
  onNavigate?: (section: ThinkPagesSection) => void;
  /** Country ID for the status widget */
  countryId?: string;
  /** Whether user is authenticated */
  isAuthenticated?: boolean;
  /** Callback to open global settings */
  onOpenSettings?: () => void;
}

export function ThinkPagesSidebarLayout({
  children,
  heroSection,
  alerts,
  activeSection,
  onNavigate,
  countryId,
  isAuthenticated,
  onOpenSettings,
}: ThinkPagesSidebarLayoutProps) {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-4 pt-4 sm:pt-6">
          {heroSection}
        </div>
      )}

      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Alerts */}
        {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

        {/* Main Layout — sidebar + content */}
        <div className="flex gap-4 sm:gap-6">
          {/* Desktop: Fixed sidebar */}
          <div className="relative z-30 hidden flex-shrink-0 lg:block">
            <div className="sticky top-6 space-y-3">
              <ThinkPagesSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
              />
              <ThinkPagesStatusWidget
                countryId={countryId}
                isAuthenticated={isAuthenticated}
                onOpenSettings={onOpenSettings}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Mobile: Horizontal nav strip */}
            <div className="mb-4 lg:hidden">
              <ThinkPagesSidebarNav
                activeSection={activeSection}
                onNavigate={onNavigate}
                variant="mobile"
              />
            </div>

            <div className="space-y-4 sm:space-y-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
