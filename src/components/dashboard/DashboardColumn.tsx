"use client";

import type { ReactNode } from "react";

interface DashboardColumnProps {
  children: ReactNode;
  heroSection?: ReactNode;
}

/** A plain centred column with an optional hero above it. */
export function DashboardColumn({ children, heroSection }: DashboardColumnProps) {
  return (
    <div className="relative flex min-h-full w-full flex-1 flex-col space-y-0">
      {heroSection && (
        <div className="z-raised relative container mx-auto px-4 pt-4 sm:pt-6">{heroSection}</div>
      )}

      <div className="z-raised relative container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {children}
      </div>
    </div>
  );
}
