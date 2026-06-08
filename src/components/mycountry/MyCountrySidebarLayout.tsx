"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
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

const SECTION_THEMES: Record<
  MyCountrySection,
  {
    borderClass: string;
    shadowClass: string;
  }
> = {
  overview: {
    borderClass: "border-t-slate-400/40",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(148,163,184,0.15)]",
  },
  executive: {
    borderClass: "border-t-amber-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(245,158,11,0.2)]",
  },
  diplomacy: {
    borderClass: "border-t-cyan-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(6,182,212,0.2)]",
  },
  politics: {
    borderClass: "border-t-indigo-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(99,102,241,0.2)]",
  },
  intelligence: {
    borderClass: "border-t-blue-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(59,130,246,0.2)]",
  },
  defense: {
    borderClass: "border-t-red-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(239,68,68,0.2)]",
  },
  "map-editor": {
    borderClass: "border-t-emerald-500",
    shadowClass: "shadow-[0_-8px_25px_-8px_rgba(16,185,129,0.2)]",
  },
};

export function MyCountrySidebarLayout({
  children,
  heroSection,
  alerts,
  sidebarExtra,
  activeSection,
  onNavigate,
  notifications,
}: MyCountrySidebarLayoutProps) {
  const currentSection = activeSection ?? "overview";
  const theme = SECTION_THEMES[currentSection] || SECTION_THEMES.overview;

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-3 pt-3 sm:px-4 sm:pt-4">{heroSection}</div>
      )}

      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        {/* Alerts */}
        {alerts && <div className="mb-3 space-y-2 sm:mb-4">{alerts}</div>}

        {/* Main Layout — icon rail + content */}
        <div className="flex gap-3 sm:gap-4">
          {/* Desktop: Fixed sidebar column — icon rail (or expanded with labels when sidebarExtra is present) */}
          <div className={`relative z-30 hidden shrink-0 lg:block ${sidebarExtra ? "w-56" : ""}`}>
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

            {/* Content panel with thin glowing top border & shadow theme */}
            <div
              className={cn(
                "rounded-t-xl border-t-2 pt-2 transition-all duration-500 ease-in-out",
                theme.borderClass,
                theme.shadowClass
              )}
            >
              <div className="space-y-3 sm:space-y-4">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
