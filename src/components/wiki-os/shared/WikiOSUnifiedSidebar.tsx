// src/components/wiki-os/shared/WikiOSUnifiedSidebar.tsx
// Unified, single-column collapsible sidebar layout with hover handle and keyboard shortcuts.

"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Image as ImageIcon,
  Trophy,
  FileEdit,
  MessageSquare,
  Clock,
  Link2,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronRight,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronDown,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronUp,
  Home,
  Shuffle,
  Bookmark,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useSidebar } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { StashButton } from "~/components/wiki-os/reader/StashButton";
import { ActiveCountryUnifiedWidget } from "./ActiveCountryUnifiedWidget";
import { WikiOSProfileWidget } from "./WikiOSProfileWidget";
import type { TocEntry } from "~/lib/wiki-os/html-transformer";

const NAV_GROUP_1 = [
  { id: "main", href: "/wiki/Main_Page", icon: Home, title: "Main Page" },
  { id: "recent", href: "/wiki/recent-changes", icon: Clock, title: "Recent Changes" },
  { id: "random", href: "/wiki/random", icon: Shuffle, title: "Random" },
];

interface WikiOSUnifiedSidebarProps {
  activeId: string | null;
  onSearchClick: () => void;
  title: string;
  slug: string | null;
  isSignedIn: boolean;
  setActiveModal: (modal: "history" | "backlinks" | null) => void;
  countryData: any;
  isSpecialPage: boolean;
  pathname: string;
  forceCollapsed?: boolean;
  sections?: TocEntry[];
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
}: WikiOSUnifiedSidebarProps) {
  const { isCollapsed: sidebarCollapsed, toggleCollapsed, isHovered } = useSidebar();
  const isCollapsedReal = forceCollapsed || sidebarCollapsed;
  const isExpanded = !isCollapsedReal || (isHovered && !forceCollapsed);

  const isArticlePage = !isSpecialPage && slug;

  // showMore removed in favor of direct expand/lock behavior

  // Keyboard shortcut listener (Ctrl+B / Cmd+B)
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

  const getActiveColorClass = (itemId: string) => {
    switch (itemId) {
      case "search":
      case "backlinks":
        return "text-teal-400 border-teal-500/30 bg-teal-500/10";
      case "main":
      case "edit":
        return "text-blue-400 border-blue-500/30 bg-blue-500/10";
      case "recent":
      case "history":
        return "text-amber-400 border-amber-500/30 bg-amber-500/10";
      case "random":
        return "text-indigo-400 border-indigo-500/30 bg-indigo-500/10";
      case "images":
      case "talk":
        return "text-purple-400 border-purple-500/30 bg-purple-500/10";
      case "lorewards":
        return "text-amber-400 border-amber-500/30 bg-amber-500/10";
      default:
        return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    }
  };

  const renderRow = ({
    id,
    href,
    onClick,
    icon: Icon,
    title,
    glowClass,
    isActive,
    badge,
  }: {
    id: string;
    href?: string;
    onClick?: () => void;
    icon?: any;
    title: string;
    glowClass?: string;
    isActive: boolean;
    badge?: ReactNode;
  }) => {
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

    const content = (
      <>
        {Icon ? (
          <div className={itemClass} title={!isExpanded ? title : undefined}>
            <Icon className="h-4 w-4 shrink-0" />
          </div>
        ) : (
          isExpanded && <div className="flex w-9 shrink-0 items-center justify-center" />
        )}
        <span
          className={cn(
            "flex-1 overflow-hidden text-left text-xs font-medium whitespace-nowrap transition-all duration-300 ease-in-out",
            !isExpanded ? "pointer-events-none w-0 opacity-0" : "w-auto pl-3 opacity-100",
            isActive
              ? cn("font-semibold", activeColorClass.split(" ")[0])
              : "text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]"
          )}
        >
          {title}
        </span>
        {badge && isExpanded && (
          <div className="shrink-0 pl-2 transition-opacity duration-300">{badge}</div>
        )}
      </>
    );

    const wrapperClass = cn(
      "flex w-full items-center px-2.5 py-1 rounded-xl transition-all duration-200 group outline-none",
      isActive ? "bg-white/[0.03]" : "hover:bg-white/5"
    );

    if (href) {
      return (
        <Link key={id} href={href} className={wrapperClass}>
          {content}
        </Link>
      );
    }

    return (
      <button key={id} onClick={onClick} className={wrapperClass} type="button">
        {content}
      </button>
    );
  };

  const getToggleTitle = () => {
    return isCollapsedReal ? "Lock Sidebar" : "Unlock Sidebar";
  };

  const handleToggleClick = () => {
    toggleCollapsed();
  };

  return (
    <div className="wikios-sidebar group/sidebar relative flex h-[calc(100vh-10rem)] w-full flex-col justify-start border-r border-white/5 pr-1.5 pb-2 transition-colors duration-300 select-none hover:border-blue-500/15">
      <div className="flex w-full flex-col gap-1.5">
        {/* Profile widget — signed-in user's linked wiki profile */}
        <WikiOSProfileWidget expanded={isExpanded} />

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
        })}

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Navigation Group */}
        {NAV_GROUP_1.map((item) => {
          let glowClass =
            "border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 rail-glow-blue rail-animate-bounce";
          if (item.id === "recent") {
            glowClass =
              "border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15 rail-glow-amber rail-animate-spin";
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
          });
        })}

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Library Items (Always visible if NOT on article page) */}
        {!isArticlePage && (
          <>
            {renderRow({
              id: "stashes",
              href: withBasePath("/stashes"),
              icon: Bookmark,
              title: "Stashes",
              glowClass:
                "rail-glow-rose rail-animate-pulse border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15",
              isActive: pathname === "/stashes" || pathname.startsWith("/stashes/"),
            })}

            {renderRow({
              id: "images",
              href: withBasePath("/wiki/repository"),
              icon: ImageIcon,
              title: "Repository",
              glowClass:
                "rail-glow-purple rail-animate-wiggle border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15",
              isActive: pathname === "/wiki/repository" || pathname.startsWith("/wiki/repository/"),
            })}

            {renderRow({
              id: "lorewards",
              href: withBasePath("/wiki/lorewards"),
              icon: Trophy,
              title: "Lore Awards",
              glowClass:
                "rail-glow-gold rail-animate-rotate border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15",
              isActive: pathname === "/wiki/lorewards" || pathname.startsWith("/wiki/lorewards/"),
            })}
          </>
        )}

        {/* Page Tools: Dynamically shown on article page (Core/always visible items) */}
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
              })}

            {renderRow({
              id: "talk",
              href: withBasePath(`/wiki/${slug}/talk`),
              icon: MessageSquare,
              title: "Discussion (Talk)",
              glowClass:
                "rail-glow-purple rail-animate-wiggle border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15",
              isActive: activeId === "talk",
            })}

            {/* Stash button */}
            <div className="group flex w-full items-center rounded-xl px-2.5 py-1 transition-all duration-200 hover:bg-white/5">
              <div className="shrink-0">
                <StashButton title={title} isAuthenticated={isSignedIn} isCollapsed={true} />
              </div>
              <span
                className={cn(
                  "flex-1 overflow-hidden text-left text-xs font-medium whitespace-nowrap text-[var(--wikios-text-muted)] transition-all duration-300 ease-in-out group-hover:text-[var(--wikios-text)]",
                  !isExpanded ? "pointer-events-none w-0 opacity-0" : "w-auto pl-3 opacity-100"
                )}
              >
                Stash Page
              </span>
            </div>

            {/* Table of Contents Sections */}
            {isExpanded && sections && sections.length > 0 && (
              <>
                <div className="my-0.5 w-full border-t border-[var(--wikios-border)] opacity-30" />
                <div className="flex max-h-48 scrollbar-thin flex-col gap-1 overflow-y-auto px-3 py-1 text-left">
                  <div className="mb-1 text-[10px] font-bold tracking-wider text-[var(--wikios-text-muted)] uppercase opacity-60">
                    Sections
                  </div>
                  {sections.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => {
                        const el = document.getElementById(sec.id);
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={cn(
                        "block cursor-pointer truncate py-0.5 text-left text-[11px] text-[var(--wikios-text-muted)] transition-colors outline-none hover:text-[var(--wikios-text)]",
                        sec.level === 3
                          ? "pl-2.5 opacity-80"
                          : sec.level === 4
                            ? "pl-5 opacity-60"
                            : "pl-0.5 font-medium"
                      )}
                      type="button"
                    >
                      {sec.text}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Active Country Flag (Above the toggle, animated like Apple would) */}
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
              <ActiveCountryUnifiedWidget country={countryData} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

        {/* Toggle Lock Button (stays still, only visible when expanded/opening) */}
        {isExpanded &&
          renderRow({
            id: "toggle-more",
            onClick: handleToggleClick,
            title: getToggleTitle(),
            glowClass:
              "border-slate-500/20 bg-slate-500/5 text-slate-400 hover:bg-slate-500/15 rail-glow-gray",
            isActive: false,
          })}

        {/* Extra Items (always visible when expanded/opening on article page) */}
        {isExpanded && isArticlePage && (
          <>
            <div className="my-0.5 w-full border-t border-[var(--wikios-border)] opacity-30" />

            {renderRow({
              id: "images",
              href: withBasePath("/wiki/repository"),
              icon: ImageIcon,
              title: "Repository",
              glowClass:
                "rail-glow-purple rail-animate-wiggle border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15",
              isActive: pathname === "/wiki/repository" || pathname.startsWith("/wiki/repository/"),
            })}

            {renderRow({
              id: "lorewards",
              href: withBasePath("/wiki/lorewards"),
              icon: Trophy,
              title: "Lore Awards",
              glowClass:
                "rail-glow-gold rail-animate-rotate border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15",
              isActive: pathname === "/wiki/lorewards" || pathname.startsWith("/wiki/lorewards/"),
            })}

            {renderRow({
              id: "history",
              onClick: () => setActiveModal("history"),
              icon: Clock,
              title: "Revision History",
              glowClass:
                "rail-glow-amber rail-animate-spin border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15",
              isActive: activeId === "history",
            })}

            {renderRow({
              id: "backlinks",
              onClick: () => setActiveModal("backlinks"),
              icon: Link2,
              title: "What Links Here",
              glowClass:
                "rail-glow-teal rail-animate-bounce border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/15",
              isActive: activeId === "backlinks",
            })}
          </>
        )}
      </div>
    </div>
  );
}
