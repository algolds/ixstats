"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { DashboardPlayerWidget } from "./DashboardPlayerWidget";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { VaultWidget } from "~/components/mycountry/shell/VaultWidget";
import { NavArrowLeft as ChevronLeft, NavArrowRight as ChevronRight } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface SidebarContextProps {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  isHovered?: boolean;
  setIsHovered?: (hovered: boolean) => void;
}

const SidebarContext = createContext<SidebarContextProps>({
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

const STORAGE_KEY = "ixstats.sidebar.collapsed";

/** Hover state that opens the collapsed rail: instantly for the rail variant, after 250ms otherwise. */
function useDelayedHover(isHovered: boolean, instant: boolean) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!isHovered || instant) {
      // oxlint-disable-next-line
      setDelayed(isHovered);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), 250);
    return () => clearTimeout(timer);
  }, [isHovered, instant]);
  return delayed;
}

/** Collapse state, remembered in localStorage unless collapsing is disabled. */
function useCollapsedState(disableCollapse: boolean, defaultCollapsed: boolean) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const stored = disableCollapse ? null : localStorage.getItem(STORAGE_KEY);
    // oxlint-disable-next-line
    if (disableCollapse) setCollapsed(false);
    else if (stored === "true" || stored === "false") setCollapsed(stored === "true");
    setIsMounted(true);
  }, [disableCollapse]);

  const toggle = () => {
    if (disableCollapse) return;
    setCollapsed(!collapsed);
    localStorage.setItem(STORAGE_KEY, String(!collapsed));
  };
  return { collapsed: !disableCollapse && collapsed && isMounted, toggle };
}

/** Width classes and inline width for the rail column, by variant and collapse state. */
function railColumn(
  rail: boolean,
  narrow: boolean,
  widthClass: string | undefined,
  widthStyle: string | undefined
) {
  const expandedClass = widthClass ?? (rail ? "w-64" : "w-48");
  if (!rail) {
    return narrow
      ? { expandedClass, className: "pointer-events-none mr-[-24px] w-0 opacity-0", width: "0px" }
      : { expandedClass, className: "w-48 opacity-100", width: "12rem" };
  }
  return narrow
    ? { expandedClass, className: "-left-6 w-14 opacity-100 xl:-left-12", width: "3.5rem" }
    : {
        expandedClass,
        className: cn("-left-6 opacity-100 xl:-left-12", expandedClass),
        width: widthStyle ?? "16rem",
      };
}

const LAYOUT = {
  rail: {
    hero: "w-full max-w-[1800px] lg:px-8 xl:px-12",
    body: "w-full max-w-[1800px] px-4 sm:px-6 lg:px-8 xl:px-12",
  },
  default: { hero: "container", body: "container px-4" },
};

function RailBalancer({
  narrow,
  expandedClass,
  width,
}: {
  narrow: boolean;
  expandedClass: string;
  width: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "z-raised pointer-events-none relative hidden shrink-0 transition-[width] duration-300 ease-out lg:block",
        narrow
          ? "-right-6 w-14 opacity-0 xl:-right-12"
          : cn("-right-6 opacity-0 xl:-right-12", expandedClass)
      )}
      style={{ width }}
    />
  );
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
  const rail = variant === "rail";
  const [isHovered, setIsHovered] = useState(false);
  const isHoveredDelayed = useDelayedHover(isHovered, rail);
  const { collapsed: isCollapsedNow, toggle: handleToggleSidebar } = useCollapsedState(
    disableCollapse,
    defaultCollapsed
  );
  const isHoverActive = isCollapsedNow && isHoveredDelayed;

  const narrow = isCollapsedNow && !isHoverActive;
  const column = railColumn(rail, narrow, expandedWidthClassName, expandedWidthStyle);
  const layout = rail ? LAYOUT.rail : LAYOUT.default;
  const defaultHidden = !rail && isCollapsedNow;

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
        {heroSection && (
          <div className={cn("z-raised relative mx-auto px-4 pt-4 sm:pt-6", layout.hero)}>
            {heroSection}
          </div>
        )}

        <div className={cn("z-raised relative mx-auto py-4 sm:py-6 md:py-8", layout.body)}>
          {alerts && <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>}

          <div className="flex gap-4 sm:gap-6">
            <div
              onMouseEnter={disableGlobalHover ? undefined : () => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={cn(
                "z-sticky relative hidden shrink-0 transition-[width,opacity] duration-300 ease-out lg:block",
                column.className
              )}
              style={{ width: column.width }}
            >
              <div
                className={cn(
                  "sticky top-(--shell-top-offset) space-y-4 transition-[transform,opacity] duration-300 ease-out",
                  defaultHidden ? "translate-x-[-120%] opacity-0" : "translate-x-0 opacity-100"
                )}
              >
                {sidebarContent || (
                  <>
                    <DashboardPlayerWidget
                      heroCollapsed={heroCollapsed}
                      onHeroExpand={onHeroExpand}
                    />
                    <VaultWidget />
                    <DashboardQuickLinks discordBadge={discordBadge} />
                  </>
                )}

                {!disableCollapse && !rail && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleSidebar}
                    className="w-full"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft />
                    Collapse sidebar
                  </Button>
                )}
              </div>
            </div>

            <div className="relative min-w-0 flex-1">
              {isCollapsedNow && showFloatingExpand && !rail && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleToggleSidebar}
                  className="facet-chrome z-chrome shadow-floating fixed top-[calc(var(--shell-top-offset)+1rem)] left-[calc(var(--shell-sidebar-width)+1rem)] rounded-full"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <ChevronRight />
                </Button>
              )}
              {children}
            </div>

            {/* Symmetrical right balancer (rail mode): keeps the page centred as the rail opens and closes. */}
            {rail && (
              <RailBalancer
                narrow={narrow}
                expandedClass={column.expandedClass}
                width={column.width}
              />
            )}
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
