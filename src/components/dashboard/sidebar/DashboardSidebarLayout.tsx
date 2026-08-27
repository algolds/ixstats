"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { DashboardPlayerWidget } from "./DashboardPlayerWidget";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { VaultWidget } from "~/components/mycountry/shell/VaultWidget";
import { NavArrowLeft as ChevronLeft, NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface SidebarContextProps {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  isHovered?: boolean;
  setIsHovered?: (hovered: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextProps>({
  isCollapsed: false,
  toggleCollapsed: () => {},
  isHovered: false,
  setIsHovered: () => {},
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
  expandedWidthClassName?: string;
  expandedWidthStyle?: string;
  disableGlobalHover?: boolean;
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
  expandedWidthClassName,
  expandedWidthStyle,
  disableGlobalHover = false,
}: DashboardSidebarLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultCollapsed);
  const [isMounted, setIsMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveredDelayed, setIsHoveredDelayed] = useState(false);

  useEffect(() => {
    let timer: any = null;
    if (isHovered) {
      if (variant === "rail") {
        // oxlint-disable-next-line
        setIsHoveredDelayed(true);
      } else {
        timer = setTimeout(() => {
          setIsHoveredDelayed(true);
        }, 250);
      }
    } else {
      setIsHoveredDelayed(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isHovered, variant]);

  useEffect(() => {
    if (disableCollapse) {
      // oxlint-disable-next-line
      setIsSidebarCollapsed(false);
      setIsMounted(true);
    } else {
      const stored = localStorage.getItem("ixstats.sidebar.collapsed");
      if (stored === "true") {
        setIsSidebarCollapsed(true);
      } else if (stored === "false") {
        setIsSidebarCollapsed(false);
      }
      setIsMounted(true);
    }
  }, [disableCollapse]);

  const handleToggleSidebar = () => {
    if (disableCollapse) return;
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem("ixstats.sidebar.collapsed", String(next));
  };

  const isCollapsedNow = !disableCollapse && isSidebarCollapsed && isMounted;
  const isHoverActive = isCollapsedNow && isHoveredDelayed;

  const defaultExpandedWidthClass = variant === "rail" ? "w-64" : "w-48";
  const defaultExpandedWidthStyle = variant === "rail" ? "16rem" : "12rem";

  const resolvedExpandedWidthClass = expandedWidthClassName ?? defaultExpandedWidthClass;
  const resolvedExpandedWidthStyle = expandedWidthStyle ?? defaultExpandedWidthStyle;

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed: isCollapsedNow,
        toggleCollapsed: handleToggleSidebar,
        isHovered: isHoverActive,
        setIsHovered,
      }}
    >
      <div className="relative flex min-h-full w-full flex-1 flex-col space-y-0">
        {/* Hero Section */}
        {heroSection && (
          <div
            className={cn(
              "relative z-10 mx-auto px-4 pt-4 sm:pt-6",
              variant === "rail" ? "w-full max-w-[1800px] lg:px-8 xl:px-12" : "container"
            )}
          >
            {heroSection}
          </div>
        )}

        <div
          className={cn(
            "relative z-10 mx-auto py-4 sm:py-6 md:py-8",
            variant === "rail"
              ? "w-full max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-12"
              : "container px-4"
          )}
        >
          {/* Alerts */}
          {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

          {/* Main Layout — icon rail + content */}
          <div className="flex gap-4 sm:gap-6">
            {/* Desktop: Fixed icon rail */}
            <div
              onMouseEnter={disableGlobalHover ? undefined : () => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={cn(
                "relative z-30 hidden shrink-0 transition-[width,opacity] duration-300 ease-out lg:block",
                variant === "rail"
                  ? isCollapsedNow && !isHoverActive
                    ? "-left-6 w-14 opacity-100 xl:-left-12"
                    : cn("-left-6 opacity-100 xl:-left-12", resolvedExpandedWidthClass)
                  : isCollapsedNow
                    ? "pointer-events-none mr-[-24px] w-0 opacity-0"
                    : "w-48 opacity-100"
              )}
              style={{
                width:
                  variant === "rail"
                    ? isCollapsedNow && !isHoverActive
                      ? "3.5rem"
                      : resolvedExpandedWidthStyle
                    : isCollapsedNow
                      ? "0px"
                      : "12rem",
              }}
            >
              <div
                className={cn(
                  "sticky top-20 space-y-3.5 transition-[transform,opacity] duration-300 ease-out",
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
                    className="text-muted-foreground hover:text-foreground border-border bg-muted/30 hover:bg-muted/60 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-medium tracking-tight shadow-xs backdrop-blur-md transition-all duration-150 active:scale-[0.97]"
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
                  className="text-muted-foreground hover:text-foreground border-border bg-card/90 hover:bg-card fixed top-24 left-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border shadow-xl backdrop-blur-xl transition-all duration-150 hover:scale-105 active:scale-[0.95]"
                  title="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {children}
            </div>

            {/* Symmetrical Right Balancer (Rail Mode) — ensures centered page alignment on sidebar lock/unlock */}
            {variant === "rail" && (
              <div
                aria-hidden="true"
                className={cn(
                  "relative z-10 hidden shrink-0 pointer-events-none transition-[width] duration-300 ease-out lg:block",
                  isCollapsedNow && !isHoverActive
                    ? "-right-6 w-14 opacity-0 xl:-right-12"
                    : cn("-right-6 opacity-0 xl:-right-12", resolvedExpandedWidthClass)
                )}
                style={{
                  width:
                    isCollapsedNow && !isHoverActive
                      ? "3.5rem"
                      : resolvedExpandedWidthStyle,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
