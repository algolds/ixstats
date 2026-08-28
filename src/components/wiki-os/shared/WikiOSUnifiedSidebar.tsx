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
import { soundEffects } from "~/lib/sound/cuelume";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";

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
      soundEffects.press();
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
      soundEffects.release();
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
      "wikios-sidebar-icon-box flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-md active:scale-95 shrink-0",
      isActive
        ? cn("font-semibold", activeColorClass)
        : cn(
            "border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]",
            glowClass
          )
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
            "flex-1 overflow-hidden text-left text-xs font-medium whitespace-nowrap transition-all duration-300 ease-in-out",
            !isRowExpanded ? "pointer-events-none w-0 opacity-0" : "w-auto pl-3 opacity-100",
            isActive
              ? id === "margin"
                ? "font-bold text-[var(--wikios-text)]"
                : cn("font-semibold", activeColorClass.split(" ")[0])
              : "text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]"
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
      "flex items-center px-2.5 py-1 rounded-xl transition-all duration-300 ease-in-out group outline-none relative",
      isLocalHoverExpanded
        ? "w-max z-50 border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] shadow-lg backdrop-blur-md pr-4"
        : "w-full border-transparent bg-transparent hover:bg-foreground/5",
      isActive ? "bg-foreground/[0.02]" : ""
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
      className="wikios-sidebar group/sidebar relative flex h-[calc(100vh-10rem)] w-full flex-col justify-start border-r border-white/5 pr-1.5 pb-2 transition-colors duration-300 select-none hover:border-blue-500/15"
    >
      <div className="flex w-full flex-col gap-1.5">
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

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Search */}
        {renderRow({
          id: "search",
          onClick: onSearchClick,
          icon: Search,
          title: "Search Wiki",
          glowClass:
            "border-teal-500/20 bg-teal-500/5 text-teal-400 hover:bg-teal-500/15 rail-glow-teal rail-animate-spin",
          isActive: activeId === "search",
          badge: (
            <kbd className="text-muted-foreground/60 rounded border border-white/5 bg-white/5 px-1 text-[8px]">
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
            "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 rail-glow-green rail-animate-pulse",
          isActive: activeId === "create-page",
          index: rowIndex++,
        })}

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Navigation Group (Categories/Utilities hidden on article pages) */}
        {NAV_GROUP_1.filter((item) => !(isArticlePage && item.id === "categories")).map((item) => {
          let glowClass =
            "border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 rail-glow-blue rail-animate-bounce";
          if (item.id === "categories") {
            glowClass =
              "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 rail-glow-green";
          } else if (item.id === "recent") {
            glowClass =
              "border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15 rail-glow-amber rail-animate-spin";
          } else if (item.id === "utilities") {
            glowClass = "border-wiki/30 bg-wiki/10 text-wiki hover:bg-wiki/20 rail-glow-di";
          } else if (item.id === "random") {
            glowClass =
              "border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/15 rail-glow-di rail-animate-wiggle";
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
        })}

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Library Group (Permanently anchored across all views with Dynamic In-Page Stashing) */}
        {renderRow({
          id: "stashes",
          href: withBasePath("/stashes"),
          icon: isArticlePage && isCurrentPageStashed ? BookmarkCheck : Bookmark,
          title: "Stashes",
          glowClass:
            isArticlePage && isCurrentPageStashed
              ? "rail-glow-rose rail-animate-pulse border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
              : "rail-glow-rose rail-animate-pulse border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15",
          isActive: pathname === "/stashes" || pathname.startsWith("/stashes/"),
          badge:
            isArticlePage && isSignedIn ? (
              <button
                type="button"
                onClick={handleToggleCurrentPageStash}
                className={cn(
                  "cursor-pointer rounded-md p-1 shadow-xs transition-all active:scale-90",
                  isCurrentPageStashed
                    ? "border border-rose-500/40 bg-rose-500/25 text-rose-300 hover:bg-rose-500/35"
                    : "border border-white/10 bg-white/5 text-[var(--wikios-text-dim)] hover:bg-white/10 hover:text-rose-400"
                )}
                title={
                  isCurrentPageStashed
                    ? "Remove current article from Stash"
                    : "Quick save current article to Stash"
                }
              >
                {isCurrentPageStashed ? (
                  <Check className="h-3 w-3 text-rose-300" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </button>
            ) : undefined,
          index: rowIndex++,
        })}

        {renderRow({
          id: "images",
          href: withBasePath("/util/repository"),
          icon: ImageIcon,
          title: "Repository",
          glowClass:
            "rail-glow-purple rail-animate-wiggle border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15",
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
            glowClass: "rail-glow-di border-wiki/30 bg-wiki/10 text-wiki hover:bg-wiki/20",
            isActive:
              pathname === "/util" ||
              pathname.startsWith("/util") ||
              pathname.startsWith("/wiki/utilities"),
            index: rowIndex++,
          })}

        {/* Page Tools: Dynamically shown on article page */}
        {isArticlePage && (
          <>
            <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

            {isSignedIn &&
              renderRow({
                id: "edit",
                href: withBasePath(`/wiki/${slug}/edit`),
                icon: FileEdit,
                title: "Edit Article",
                glowClass:
                  "rail-glow-blue rail-animate-bounce border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15",
                isActive: activeId === "edit",
                index: rowIndex++,
              })}

            {renderRow({
              id: "margin",
              onClick: () => toggleMargin(),
              icon: Highlighter,
              title: isMarginOpen ? "Hide Margin" : "Show Margin",
              glowClass:
                "rail-glow-highlighter rail-animate-wiggle border-yellow-400/50 bg-margin-accent/15 text-[var(--wikios-text)] hover:bg-margin-accent/25",
              isActive: isMarginOpen || activeId === "margin",
              badge: (
                <kbd className="text-muted-foreground/60 rounded border border-white/5 bg-white/5 px-1 font-mono text-[8px]">
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
                          "group relative flex cursor-pointer items-center rounded-xl px-2.5 py-1.5 transition-all duration-200 ease-in-out",
                          isMoreHovered
                            ? "z-50 w-max border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] pr-4 shadow-lg backdrop-blur-md"
                            : "hover:bg-foreground/5 w-full border-transparent bg-transparent"
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--wikios-text-muted)] shadow-xs transition-colors group-hover:bg-white/10 group-hover:text-[var(--wikios-text)]">
                          <MoreHorizontal className="h-4.5 w-4.5" />
                        </div>
                        <span
                          className={cn(
                            "flex-1 overflow-hidden text-left text-xs font-medium whitespace-nowrap text-[var(--wikios-text-muted)] transition-all duration-200 ease-in-out group-hover:text-[var(--wikios-text)]",
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
                      className="z-[100050] w-56 rounded-2xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 p-1.5 text-[var(--wikios-text)] shadow-2xl backdrop-blur-2xl"
                    >
                      <div className="mb-1 border-b border-[var(--wikios-border)] px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                        Page Tools
                      </div>
                      <DropdownMenuItem
                        onClick={() => setActiveModal("history")}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors hover:bg-[var(--wikios-border)]/50 focus:bg-[var(--wikios-border)]/50"
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--wikios-text)]">
                            Revision History
                          </div>
                          <div className="truncate text-[10px] text-[var(--wikios-text-dim)]">
                            Past edits & revisions
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setActiveModal("backlinks")}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors hover:bg-[var(--wikios-border)]/50 focus:bg-[var(--wikios-border)]/50"
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--wikios-text)]">
                            What Links Here
                          </div>
                          <div className="truncate text-[10px] text-[var(--wikios-text-dim)]">
                            Inbound wiki backlinks
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={withBasePath("/util")}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors hover:bg-[var(--wikios-border)]/50 focus:bg-[var(--wikios-border)]/50"
                        >
                          <Wrench className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--wikios-text)]">
                              Utilities & Special Hub
                            </div>
                            <div className="truncate text-[10px] text-[var(--wikios-text-dim)]">
                              Diagnostics, tools & special pages
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-[var(--wikios-border)]" />
                      <DropdownMenuItem
                        onClick={() => {
                          if (typeof window !== "undefined") window.print();
                        }}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors hover:bg-[var(--wikios-border)]/50 focus:bg-[var(--wikios-border)]/50"
                      >
                        <Printer className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--wikios-text)]">
                            Print / Clean View
                          </div>
                          <div className="truncate text-[10px] text-[var(--wikios-text-dim)]">
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
              <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />
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

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Toggle Lock Button */}
        {renderRow({
          id: "toggle-more",
          onClick: handleToggleClick,
          icon: isCollapsedReal ? PanelLeftOpen : PanelLeftClose,
          title: getToggleTitle(),
          glowClass:
            "border-slate-500/20 bg-slate-500/5 text-slate-400 hover:bg-slate-500/15 rail-glow-gray",
          isActive: false,
          index: rowIndex++,
        })}
      </div>
    </div>
  );
}
