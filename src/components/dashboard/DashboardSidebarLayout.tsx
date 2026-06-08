"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { DashboardPlayerWidget } from "./DashboardPlayerWidget";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { VaultWidget } from "~/components/mycountry/VaultWidget";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

export interface SidebarContextProps {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export const SidebarContext = createContext<SidebarContextProps>({
  isCollapsed: false,
  toggleCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface DashboardSidebarLayoutProps {
  children: ReactNode;
  heroSection?: ReactNode;
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
  alerts?: ReactNode;
  /** Server-rendered Discord badge for the quick links sidebar. */
  discordBadge?: ReactNode;
  sidebarContent?: ReactNode;
  showFloatingExpand?: boolean;
  defaultCollapsed?: boolean;
  disableCollapse?: boolean;
  variant?: "default" | "rail";
}

export function DashboardSidebarLayout({
  children,
  heroSection,
  heroCollapsed,
  onHeroExpand,
  alerts,
  discordBadge,
  sidebarContent,
  showFloatingExpand = true,
  defaultCollapsed = false,
  disableCollapse = true,
  variant = "default",
}: DashboardSidebarLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultCollapsed);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (disableCollapse) {
      setIsSidebarCollapsed(false);
      setIsMounted(true);
      return;
    }
    const stored = localStorage.getItem("ixstats.sidebar.collapsed");
    if (stored === "true") {
      setIsSidebarCollapsed(true);
    } else if (stored === "false") {
      setIsSidebarCollapsed(false);
    }
    setIsMounted(true);
  }, [disableCollapse]);

  const handleToggleSidebar = () => {
    if (disableCollapse) return;
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem("ixstats.sidebar.collapsed", String(next));
  };

  const isCollapsedNow = !disableCollapse && isSidebarCollapsed && isMounted;

  return (
    <SidebarContext.Provider
      value={{ isCollapsed: isCollapsedNow, toggleCollapsed: handleToggleSidebar }}
    >
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
                "relative z-30 hidden shrink-0 transition-all duration-300 ease-in-out lg:block",
                variant === "rail"
                  ? isCollapsedNow
                    ? "-left-6 w-14 opacity-100 xl:-left-12"
                    : "-left-6 w-64 opacity-100 xl:-left-12"
                  : isCollapsedNow
                    ? "pointer-events-none mr-[-24px] w-0 opacity-0"
                    : "w-48 opacity-100"
              )}
              style={{
                width:
                  variant === "rail"
                    ? isCollapsedNow
                      ? "3.5rem"
                      : "16rem"
                    : isCollapsedNow
                      ? "0px"
                      : "12rem",
              }}
            >
              <div
                className={cn(
                  "sticky top-6 space-y-4 transition-all duration-300 ease-in-out",
                  variant === "rail"
                    ? "translate-x-0 opacity-100"
                    : isCollapsedNow
                      ? "translate-x-[-120%] opacity-0"
                      : "translate-x-0 opacity-100"
                )}
              >
                {sidebarContent ? (
                  sidebarContent
                ) : (
                  <>
                    <DashboardPlayerWidget
                      heroCollapsed={heroCollapsed}
                      onHeroExpand={onHeroExpand}
                    />
                    <VaultWidget />
                    <DashboardQuickLinks discordBadge={discordBadge} />
                  </>
                )}

                {!disableCollapse && variant !== "rail" && (
                  <button
                    onClick={handleToggleSidebar}
                    className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-md border border-white/5 bg-white/5 px-3 py-2 text-[10px] font-semibold transition-all hover:bg-white/10 active:scale-[0.98]"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Collapse Sidebar
                  </button>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="relative min-w-0 flex-1">
              {/* Floating Expand button shown only when collapsed in hide mode */}
              {isCollapsedNow && showFloatingExpand && variant !== "rail" && (
                <button
                  onClick={handleToggleSidebar}
                  className="text-muted-foreground hover:text-foreground fixed top-24 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80"
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
    </SidebarContext.Provider>
  );
}
