"use client";

import { type ReactNode, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(false);

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
          {/* Desktop: Collapsible sidebar */}
          <div
            className={`relative z-30 hidden flex-shrink-0 transition-all duration-300 ease-in-out lg:block ${
              collapsed ? "w-0 overflow-hidden opacity-0" : "w-56"
            }`}
          >
            <div className="sticky top-6 w-56 space-y-3">
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

            {/* Desktop: Collapse toggle */}
            <div className="mb-3 hidden lg:block">
              <button
                onClick={() => setCollapsed((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={collapsed ? "Show sidebar" : "Hide sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                )}
                <span>{collapsed ? "Show sidebar" : "Hide sidebar"}</span>
              </button>
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
