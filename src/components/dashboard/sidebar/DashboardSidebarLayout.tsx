"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

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
  alerts?: ReactNode;
  /** A collapsible rail beside the content. Without it the layout is a plain centred column. */
  sidebarContent?: ReactNode;
  defaultCollapsed?: boolean;
  disableCollapse?: boolean;
  expandedWidthClassName?: string;
  expandedWidthStyle?: string;
  disableGlobalHover?: boolean;
}

const STORAGE_KEY = "ixstats.sidebar.collapsed";

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

/** Width classes and inline width for the rail column, by collapse state. */
function railColumn(
  narrow: boolean,
  widthClass: string | undefined,
  widthStyle: string | undefined
) {
  const expandedClass = widthClass ?? "w-64";
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
  plain: { hero: "container", body: "container px-4" },
};

/** Symmetrical right balancer: keeps the page centred as the rail opens and closes. */
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
  alerts,
  sidebarContent,
  defaultCollapsed = false,
  disableCollapse = true,
  expandedWidthClassName,
  expandedWidthStyle,
  disableGlobalHover = false,
}: DashboardSidebarLayoutProps) {
  const rail = sidebarContent != null;
  const [isHovered, setIsHovered] = useState(false);
  const { collapsed: isCollapsedNow, toggle: handleToggleSidebar } = useCollapsedState(
    disableCollapse,
    defaultCollapsed
  );
  const isHoverActive = isCollapsedNow && isHovered;

  const narrow = isCollapsedNow && !isHoverActive;
  const column = railColumn(narrow, expandedWidthClassName, expandedWidthStyle);
  const layout = rail ? LAYOUT.rail : LAYOUT.plain;

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
            {rail && (
              <div
                onMouseEnter={disableGlobalHover ? undefined : () => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={cn(
                  "z-sticky relative hidden shrink-0 transition-[width,opacity] duration-300 ease-out lg:block",
                  column.className
                )}
                style={{ width: column.width }}
              >
                <div className="sticky top-(--shell-top-offset) space-y-4">{sidebarContent}</div>
              </div>
            )}

            <div className="relative min-w-0 flex-1">{children}</div>

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
