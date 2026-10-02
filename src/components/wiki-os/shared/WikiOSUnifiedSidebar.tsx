"use client";
// src/components/wiki-os/shared/WikiOSUnifiedSidebar.tsx
// Unified, single-column collapsible sidebar layout with hover handle and keyboard shortcuts.

import { useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue } from "motion/react";
import {
  Search,
  MediaImage as ImageIcon,
  EditPencil as FileEdit,
  DesignPencil as Highlighter,
  Clock,
  Link as Link2,
  Home,
  Shuffle,
  Bookmark,
  Bookmark as BookmarkCheck,
  Check,
  Plus,
  SidebarCollapse as PanelLeftClose,
  SidebarExpand as PanelLeftOpen,
  MoreHoriz as MoreHorizontal,
  Printer,
  Wrench,
  Folder,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useSidebar } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { ActiveCountryUnifiedWidget, type ActiveCountryData } from "./ActiveCountryUnifiedWidget";
import { WikiOSProfileWidget } from "./WikiOSProfileWidget";
import { FisheyeRailItem, getActiveColorClass } from "./FisheyeRailItem";
import { useWikiContext } from "./WikiContext";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";
import { Button } from "~/components/ui/button";

const NAV_GROUP_1 = [
  { id: "main", href: "/wiki/Main_Page", icon: Home, title: "Main Page" },
  { id: "categories", href: "/util/categories", icon: Folder, title: "Categories" },
  { id: "recent", href: "/util/recent-changes", icon: Clock, title: "Recent Changes" },
  { id: "random", href: "/util/random", icon: Shuffle, title: "Random" },
];

interface WikiOSUnifiedSidebarProps {
  activeId: string | null;
  onSearchClick: () => void;
  title: string;
  slug: string | null;
  isSignedIn: boolean;
  setActiveModal: (modal: "history" | "backlinks" | "margin" | null) => void;
  countryData: ActiveCountryData | null | undefined;
  isSpecialPage: boolean;
  pathname: string;
  forceCollapsed?: boolean;
  // Deprecated: TOC now in right rail — prop kept for parity but ignored
  sections?: TocEntry[];
  onCreatePageClick?: () => void;
}

export function WikiOSUnifiedSidebar({
  activeId,
  onSearchClick,
  title,
  slug,
  isSignedIn,
  setActiveModal,
  countryData,
  isSpecialPage,
  pathname,
  forceCollapsed = false,
  sections,
  onCreatePageClick,
}: WikiOSUnifiedSidebarProps) {
  const { isCollapsed: sidebarCollapsed, toggleCollapsed, isHovered } = useSidebar();
  const { isMarginOpen, toggleMargin } = useWikiContext();
  const isCollapsedReal = forceCollapsed || sidebarCollapsed;
  const isExpanded = !isCollapsedReal || (!!isHovered && !forceCollapsed);

  const notify = useNotify();
  const utils = api.useUtils();

  const isArticlePage =
    !isSpecialPage &&
    pathname.startsWith("/wiki/") &&
    pathname !== "/wiki/Main_Page" &&
    pathname !== "/wiki/recent-changes" &&
    pathname !== "/wiki/random" &&
    pathname !== "/wiki/repository" &&
    pathname !== "/wiki/search";

  // Dynamic in-page stash query for current article
  const stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: isSignedIn && isArticlePage && !!title, retry: false }
  );
  const isCurrentPageStashed = stashQuery.data?.stashed ?? false;

  const stashMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => {
      notify.success(`Saved "${title.replace(/_/g, " ")}" to Stash`);
      utils.wikios.isStashed.invalidate({ pageTitle: title });
      utils.wikios.getStashes.invalidate();
      utils.wikios.getArticleMarginData.invalidate({ articleTitle: title });
    },
    onError: (err) => {
      notify.error(err.message || "Failed to stash article");
    },
  });

  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => {
      notify.success(`Removed "${title.replace(/_/g, " ")}" from Stash`);
      utils.wikios.isStashed.invalidate({ pageTitle: title });
      utils.wikios.getStashes.invalidate();
      utils.wikios.getArticleMarginData.invalidate({ articleTitle: title });
    },
    onError: (err) => {
      notify.error(err.message || "Failed to unstash article");
    },
  });

  const handleToggleCurrentPageStash = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      notify.info("Please sign in to save articles to Stash");
      return;
    }
    if (stashMutation.isPending || unstashMutation.isPending) return;
    if (isCurrentPageStashed) {
      unstashMutation.mutate({ pageTitle: title });
    } else {
      stashMutation.mutate({ pageTitle: title });
    }
  };

  const mouseY = useMotionValue(Infinity);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isExpanded) {
      mouseY.set(e.clientY);
    } else {
      mouseY.set(Infinity);
    }
  };

  const handleMouseLeave = () => {
    mouseY.set(Infinity);
    setHoveredIndex(null);
  };

  const getTransitionStyle = (index: number) => {
    if (!isExpanded) {
      return {
        transitionDuration: "150ms",
        transitionDelay: "0ms",
      };
    }
    return {
      transitionDuration: "300ms",
      transitionDelay: hoveredIndex !== null ? `${Math.abs(index - hoveredIndex) * 45}ms` : "0ms",
    };
  };

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapsed]);

  const renderRow = ({
    id,
    href,
    onClick,
    icon: Icon,
    title,
    glowClass,
    isActive,
    badge,
    index,
  }: {
    id: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    glowClass?: string;
    isActive: boolean;
    badge?: ReactNode;
    index: number;
  }) => {
    const isRowExpanded = isExpanded || hoveredIndex === index;
    const isLocalHoverExpanded = !isExpanded && hoveredIndex === index;

    const activeColorClass = getActiveColorClass(id);
    const itemClass = cn(
      "wikios-sidebar-icon-box flex h-9 w-9 items-center justify-center rounded-row border transition-[color,background-color,border-color,box-shadow,opacity,transform] shadow-card active:scale-[0.98] shrink-0",
      isActive
        ? cn("font-semibold", activeColorClass)
        : cn("border-separator bg-fill-4 text-label-secondary hover:text-label", glowClass)
    );

    const transitionStyle = getTransitionStyle(index);

    const content = (
      <>
        {Icon ? (
          <div className={itemClass}>
            <Icon className="h-4 w-4 shrink-0" />
          </div>
        ) : (
          isRowExpanded && <div className="flex w-9 shrink-0 items-center justify-center" />
        )}
        <span
          className={cn(
            "text-caption flex-1 overflow-hidden text-left whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-in-out",
            !isRowExpanded ? "pointer-events-none w-0 opacity-0" : "w-auto pl-3 opacity-100",
            isActive
              ? id === "margin"
                ? "text-label font-semibold"
                : cn("font-semibold", activeColorClass.split(" ")[0])
              : "text-label-secondary group-hover:text-label"
          )}
          style={transitionStyle}
        >
          {title}
        </span>
        {badge && isRowExpanded && (
          <div className="shrink-0 pl-2 transition-opacity duration-300">{badge}</div>
        )}
      </>
    );

    const wrapperClass = cn(
      "flex items-center px-3 py-1 rounded-row transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-in-out group outline-none relative",
      isLocalHoverExpanded
        ? "w-max z-50 border border-separator bg-surface shadow-floating pr-4"
        : "w-full border-transparent bg-transparent hover:bg-fill-4",
      isActive ? "bg-fill-4" : ""
    );

    if (href) {
      return (
        <FisheyeRailItem
          key={id}
          id={id}
          mouseY={mouseY}
          isExpanded={isRowExpanded}
          title={title}
          index={index}
          onHover={setHoveredIndex}
        >
          <Link href={href} className={wrapperClass}>
            {content}
          </Link>
        </FisheyeRailItem>
      );
    }

    return (
      <FisheyeRailItem
        key={id}
        id={id}
        mouseY={mouseY}
        isExpanded={isRowExpanded}
        title={title}
        index={index}
        onHover={setHoveredIndex}
      >
        <button onClick={onClick} className={wrapperClass} type="button">
          {content}
        </button>
      </FisheyeRailItem>
    );
  };

  const getToggleTitle = () => {
    return isCollapsedReal ? "Lock Sidebar" : "Unlock Sidebar";
  };

  const handleToggleClick = () => {
    toggleCollapsed();
  };

  let rowIndex = 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="wikios-sidebar group/sidebar border-separator hover:border-tint/15 relative flex h-[calc(100vh-10rem)] w-full flex-col justify-start border-r pr-2 pb-2 transition-colors duration-300 select-none"
    >
      <div className="flex w-full flex-col gap-2">
        {/* Profile widget */}
        {(() => {
          const profileIndex = rowIndex++;
          const isProfileHovered = !isExpanded && hoveredIndex === profileIndex;
          return (
            <FisheyeRailItem
              id="lorewards"
              mouseY={mouseY}
              isExpanded={isExpanded || isProfileHovered}
              title="Wiki Profile"
              index={profileIndex}
              onHover={setHoveredIndex}
            >
              <WikiOSProfileWidget expanded={isExpanded} isLocalHoverExpanded={isProfileHovered} />
            </FisheyeRailItem>
          );
        })()}

        <div className="border-separator my-0.5 w-full border-t" />

        {/* Search */}
        {renderRow({
          id: "search",
          onClick: onSearchClick,
          icon: Search,
          title: "Search Wiki",
          glowClass: "border-teal/20 bg-teal/5 text-teal hover:bg-teal/15",
          isActive: activeId === "search",
          badge: (
            <kbd className="text-label-secondary rounded-control-sm border-separator bg-fill-4 text-footnote border px-1">
              ⌘K
            </kbd>
          ),
          index: rowIndex++,
        })}

        {renderRow({
          id: "create-page",
          onClick: onCreatePageClick,
          icon: Plus,
          title: "Create New Page",
          glowClass:
            "border-green/20 bg-green/5 text-green hover:bg-green/15 rail-glow-green rail-animate-pulse",
          isActive: activeId === "create-page",
          index: rowIndex++,
        })}

        {/* Navigation + Library groups: hidden under the new shell, where the AppSidebar / TabBar
            list the same destinations (app-sections.ts → Wiki). Search, create and page tools stay. */}
        <div data-app-subnav="" className="contents">
          <div className="border-separator my-0.5 w-full border-t" />

          {/* Navigation Group (Categories/Utilities hidden on article pages) */}
          {NAV_GROUP_1.filter((item) => !(isArticlePage && item.id === "categories")).map(
            (item) => {
              let glowClass =
                "border-tint/20 bg-tint/5 text-tint hover:bg-tint/15 rail-glow-blue rail-animate-bounce";
              if (item.id === "categories") {
                glowClass =
                  "border-green/20 bg-green/5 text-green hover:bg-green/15 rail-glow-green";
              } else if (item.id === "recent") {
                glowClass =
                  "border-yellow/20 bg-yellow/5 text-yellow hover:bg-yellow/15 rail-glow-amber rail-animate-spin";
              } else if (item.id === "utilities") {
                glowClass = "border-tint/30 bg-tint/10 text-tint hover:bg-tint/20 rail-glow-di";
              } else if (item.id === "random") {
                glowClass =
                  "border-indigo/20 bg-indigo/5 text-indigo hover:bg-indigo/15 rail-glow-di rail-animate-wiggle";
              }

              return renderRow({
                id: item.id,
                href: withBasePath(item.href),
                icon: item.icon,
                title: item.title,
                glowClass,
                isActive: activeId === item.id,
                index: rowIndex++,
              });
            }
          )}

          <div className="border-separator my-0.5 w-full border-t" />

          {/* Library Group (Permanently anchored across all views with Dynamic In-Page Stashing) */}
          {renderRow({
            id: "stashes",
            href: withBasePath("/stashes"),
            icon: isArticlePage && isCurrentPageStashed ? BookmarkCheck : Bookmark,
            title: "Stashes",
            glowClass:
              isArticlePage && isCurrentPageStashed
                ? "rail-glow-rose rail-animate-pulse border-red/40 bg-red/15 text-red hover:bg-red/25"
                : "rail-glow-rose rail-animate-pulse border-red/20 bg-red/5 text-red hover:bg-red/15",
            isActive: pathname === "/stashes" || pathname.startsWith("/stashes/"),
            badge:
              isArticlePage && isSignedIn ? (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-pressed={isCurrentPageStashed}
                  aria-label="Stash current article"
                  onClick={handleToggleCurrentPageStash}
                  className={cn(
                    "size-6",
                    isCurrentPageStashed
                      ? "border-red/40 bg-red/25 text-red hover:bg-red/35"
                      : "bg-fill-4 text-label-secondary hover:text-red"
                  )}
                  title={
                    isCurrentPageStashed
                      ? "Remove current article from Stash"
                      : "Quick save current article to Stash"
                  }
                >
                  {isCurrentPageStashed ? (
                    <Check className="text-red h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
              ) : undefined,
            index: rowIndex++,
          })}

          {renderRow({
            id: "images",
            href: withBasePath("/util/repository"),
            icon: ImageIcon,
            title: "Repository",
            glowClass: "border-indigo/20 bg-indigo/5 text-indigo hover:bg-indigo/15",
            isActive:
              pathname === "/util/repository" ||
              pathname.startsWith("/util/repository/") ||
              pathname.startsWith("/wiki/repository/"),
            index: rowIndex++,
          })}

          {!isArticlePage &&
            renderRow({
              id: "utilities",
              href: withBasePath("/util"),
              icon: Wrench,
              title: "Utilities",
              glowClass: "rail-glow-di border-tint/30 bg-tint/10 text-tint hover:bg-tint/20",
              isActive:
                pathname === "/util" ||
                pathname.startsWith("/util") ||
                pathname.startsWith("/wiki/utilities"),
              index: rowIndex++,
            })}
        </div>

        {/* Page Tools: Dynamically shown on article page */}
        {isArticlePage && (
          <>
            <div className="border-separator my-0.5 w-full border-t" />

            {isSignedIn &&
              renderRow({
                id: "edit",
                href: withBasePath(`/wiki/${slug}/edit`),
                icon: FileEdit,
                title: "Edit Article",
                glowClass:
                  "rail-glow-blue rail-animate-bounce border-tint/20 bg-tint/5 text-tint hover:bg-tint/15",
                isActive: activeId === "edit",
                index: rowIndex++,
              })}

            {renderRow({
              id: "margin",
              onClick: () => toggleMargin(),
              icon: Highlighter,
              title: isMarginOpen ? "Hide Margin" : "Show Margin",
              glowClass:
                "rail-glow-highlighter rail-animate-wiggle border-yellow/50 bg-margin-accent/15 text-label hover:bg-margin-accent/25",
              isActive: isMarginOpen || activeId === "margin",
              badge: (
                <kbd className="text-label-secondary rounded-control-sm border-separator bg-fill-4 text-footnote border px-1 tabular-nums">
                  T
                </kbd>
              ),
              index: rowIndex++,
            })}

            {/* Consolidated More Page Tools Popover */}
            {(() => {
              const moreToolsIndex = rowIndex++;
              const transitionStyle = getTransitionStyle(moreToolsIndex);
              const isMoreExpanded = isExpanded || hoveredIndex === moreToolsIndex;
              const isMoreHovered = !isExpanded && hoveredIndex === moreToolsIndex;

              return (
                <FisheyeRailItem
                  id="more-tools"
                  mouseY={mouseY}
                  isExpanded={isMoreExpanded}
                  title="More Page Tools"
                  index={moreToolsIndex}
                  onHover={setHoveredIndex}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "group rounded-row relative flex cursor-pointer items-center px-3 py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-in-out",
                          isMoreHovered
                            ? "border-separator bg-surface shadow-floating z-50 w-max border pr-4"
                            : "hover:bg-fill-4 w-full border-transparent bg-transparent"
                        )}
                      >
                        <div className="rounded-row border-separator bg-fill-4 text-label-secondary group-hover:bg-fill-4 group-hover:text-label flex h-9 w-9 shrink-0 items-center justify-center border transition-colors">
                          <MoreHorizontal className="size-4.5" />
                        </div>
                        <span
                          className={cn(
                            "text-caption text-label-secondary group-hover:text-label flex-1 overflow-hidden text-left whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 ease-in-out",
                            !isMoreExpanded
                              ? "pointer-events-none w-0 opacity-0"
                              : "w-auto pl-3 opacity-100"
                          )}
                          style={transitionStyle}
                        >
                          More Tools
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      sideOffset={12}
                      className="text-label w-56 p-2"
                    >
                      <div className="border-separator text-eyebrow text-label-secondary mb-1 border-b px-3 py-1">
                        Page Tools
                      </div>
                      <DropdownMenuItem
                        onClick={() => setActiveModal("history")}
                        className="rounded-row text-caption hover:bg-fill-3 focus:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
                      >
                        <Clock className="text-yellow h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-label font-semibold">Revision History</div>
                          <div className="text-footnote text-label-secondary truncate">
                            Past edits & revisions
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setActiveModal("backlinks")}
                        className="rounded-row text-caption hover:bg-fill-3 focus:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
                      >
                        <Link2 className="text-teal h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-label font-semibold">What Links Here</div>
                          <div className="text-footnote text-label-secondary truncate">
                            Inbound wiki backlinks
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={withBasePath("/util")}
                          className="rounded-row text-caption hover:bg-fill-3 focus:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
                        >
                          <Wrench className="text-teal h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-label font-semibold">Utilities & Special Hub</div>
                            <div className="text-footnote text-label-secondary truncate">
                              Diagnostics, tools & special pages
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-fill-3 my-1" />
                      <DropdownMenuItem
                        onClick={() => {
                          if (typeof window !== "undefined") window.print();
                        }}
                        className="rounded-row text-caption hover:bg-fill-3 focus:bg-fill-3 flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
                      >
                        <Printer className="text-green h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-label font-semibold">Print / Clean View</div>
                          <div className="text-footnote text-label-secondary truncate">
                            Export clean page
                          </div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FisheyeRailItem>
              );
            })()}

            {/* TOC now lives in WikiArticleRightRail (mirrored right rail) — left sidebar no longer renders Sections */}
          </>
        )}

        {/* Active Country WhiteFlag */}
        <AnimatePresence initial={false}>
          {countryData && (
            <motion.div
              key={countryData.id || countryData.name}
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: "auto", opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="border-separator my-0.5 w-full border-t" />
              {(() => {
                const currentCountryIndex = rowIndex++;
                const isCountryHovered = !isExpanded && hoveredIndex === currentCountryIndex;
                return (
                  <FisheyeRailItem
                    id="lorewards"
                    mouseY={mouseY}
                    isExpanded={isExpanded || isCountryHovered}
                    title={countryData?.name || "Active Country"}
                    index={currentCountryIndex}
                    onHover={setHoveredIndex}
                  >
                    <ActiveCountryUnifiedWidget
                      country={countryData}
                      transitionStyle={getTransitionStyle(currentCountryIndex)}
                      isLocalHoverExpanded={isCountryHovered}
                    />
                  </FisheyeRailItem>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="border-separator my-0.5 w-full border-t" />

        {/* Toggle Lock Button */}
        {renderRow({
          id: "toggle-more",
          onClick: handleToggleClick,
          icon: isCollapsedReal ? PanelLeftOpen : PanelLeftClose,
          title: getToggleTitle(),
          glowClass:
            "border-separator bg-fill-4 text-label-secondary hover:bg-fill-3 rail-glow-gray",
          isActive: false,
          index: rowIndex++,
        })}
      </div>
    </div>
  );
}
