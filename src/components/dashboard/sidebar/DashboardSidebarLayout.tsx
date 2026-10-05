"use client";

import type { ReactNode } from "react";

interface DashboardSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  alerts?: ReactNode;
}

/** A plain centred column with an optional hero above it and alerts over the content. */
export function DashboardSidebarLayout({
  children,
  heroSection,
  alerts,
}: DashboardSidebarLayoutProps) {
  return (
    <div className="relative flex min-h-full w-full flex-1 flex-col space-y-0">
      {heroSection && (
        <div className="z-raised relative container mx-auto px-4 pt-4 sm:pt-6">{heroSection}</div>
      )}

      <div className="z-raised relative container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

        <div className="flex gap-4 sm:gap-6">
          <div className="relative min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
