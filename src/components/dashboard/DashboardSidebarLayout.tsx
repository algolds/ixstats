"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { DashboardPlayerWidget } from "./DashboardPlayerWidget";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { VaultWidget } from "~/components/mycountry/VaultWidget";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface DashboardSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
  alerts?: ReactNode;
  /** Server-rendered Discord badge for the quick links sidebar. */
  discordBadge?: ReactNode;
  sidebarContent?: ReactNode;
}

export function DashboardSidebarLayout({
  children,
  heroSection,
  heroCollapsed,
  onHeroExpand,
  alerts,
  discordBadge,
  sidebarContent,
}: DashboardSidebarLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ixstats.sidebar.collapsed");
    if (stored === "true") {
      setIsSidebarCollapsed(true);
    }
    setIsMounted(true);
  }, []);

  const handleToggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem("ixstats.sidebar.collapsed", String(next));
  };

  return (
    <div className="relative min-h-screen space-y-0">
      {/* Hero Section */}
      {heroSection && (
        <div className="relative z-10 container mx-auto px-4 pt-4 sm:pt-6">{heroSection}</div>
      )}

      <div className="relative z-10 container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Alerts */}
        {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

        {/* Main Layout — icon rail + content */}
        <div className="flex gap-4 sm:gap-6">
          {/* Desktop: Fixed icon rail */}
          <div
            className={cn(
              "relative z-30 hidden shrink-0 lg:block transition-all duration-300 ease-in-out",
              isSidebarCollapsed && isMounted ? "w-0 opacity-0 pointer-events-none mr-[-24px]" : "w-48 opacity-100"
            )}
            style={{
              width: isSidebarCollapsed && isMounted ? "0px" : "12rem",
            }}
          >
            <div
              className={cn(
                "sticky top-6 space-y-4 transition-all duration-300 ease-in-out",
                isSidebarCollapsed && isMounted ? "translate-x-[-120%] opacity-0" : "translate-x-0 opacity-100"
              )}
            >
              {sidebarContent ? (
                sidebarContent
              ) : (
                <>
                  <DashboardPlayerWidget heroCollapsed={heroCollapsed} onHeroExpand={onHeroExpand} />
                  <VaultWidget />
                  <DashboardQuickLinks discordBadge={discordBadge} />
                </>
              )}

              <button
                onClick={handleToggleSidebar}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 border border-white/5 rounded-md transition-all active:scale-[0.98]"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Collapse Sidebar
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative min-w-0 flex-1">
            {/* Floating Expand button shown only when collapsed */}
            {isSidebarCollapsed && isMounted && (
              <button
                onClick={handleToggleSidebar}
                className="fixed left-4 top-24 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 text-muted-foreground backdrop-blur-md transition-all hover:scale-105 hover:text-foreground hover:bg-black/80 shadow-lg"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
