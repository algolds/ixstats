"use client";

import type { ReactNode } from "react";
import { DashboardPlayerWidget } from "./DashboardPlayerWidget";
import { useUserCountry } from "~/hooks/useUserCountry";

interface DashboardSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  alerts?: ReactNode;
}

export function DashboardSidebarLayout({
  children,
  heroSection,
  alerts,
}: DashboardSidebarLayoutProps) {
  const { userProfile } = useUserCountry();
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

        {/* Main Layout — icon rail + content */}
        <div className="flex gap-4 sm:gap-6">
          {/* Desktop: Fixed icon rail */}
          <div className="relative z-30 hidden flex-shrink-0 lg:block">
            <div className="sticky top-6 space-y-3">
              <DashboardPlayerWidget />
            </div>
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
