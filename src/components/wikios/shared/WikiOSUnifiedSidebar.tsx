// src/components/wikios/shared/WikiOSUnifiedSidebar.tsx
// Unified, single-column collapsible sidebar layout with hover handle and keyboard shortcuts.

"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import {
  Search,
  Bookmark,
  BookOpen,
  Image as ImageIcon,
  Trophy,
  FileEdit,
  MessageSquare,
  Clock,
  Link2,
  ChevronRight,
  ChevronLeft,
  Home,
  Shuffle,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useSidebar } from "~/components/dashboard/DashboardSidebarLayout";
import { StashButton } from "~/components/wikios/reader/StashButton";
import { ActiveCountryUnifiedWidget } from "./ActiveCountryUnifiedWidget";

const NAV_GROUP_1 = [
  { id: "main", href: "/w/Main_Page", icon: Home, title: "Main Page" },
  { id: "recent", href: "/w/special/recent-changes", icon: Clock, title: "Recent Changes" },
  { id: "random", href: "/w/special/random", icon: Shuffle, title: "Random" },
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
}: WikiOSUnifiedSidebarProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar();

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
    icon: any;
    title: string;
    glowClass?: string;
    isActive: boolean;
    badge?: ReactNode;
  }) => {
    const itemClass = cn(
      "flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-md active:scale-95 shrink-0",
      isActive
        ? "border-blue-500/30 bg-blue-500/10 text-blue-400 font-semibold"
        : cn(
            "border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-muted)] hover:scale-105 hover:text-[var(--wikios-text)]",
            glowClass
          )
    );

    const content = (
      <>
        <div className={itemClass} title={isCollapsed ? title : undefined}>
          <Icon className="h-4 w-4 shrink-0" />
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden text-left flex-1",
            isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100 pl-3",
            isActive
              ? "text-blue-400 font-semibold"
              : "text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]"
          )}
        >
          {title}
        </span>
        {badge && !isCollapsed && (
          <div className="shrink-0 transition-opacity duration-300 pl-2">{badge}</div>
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

  return (
    <div className="wikios-sidebar relative flex h-[calc(100vh-10rem)] w-full flex-col justify-start select-none group/sidebar border-r border-white/5 hover:border-blue-500/15 transition-colors duration-300 pr-1.5 pb-2">
      <div className="flex flex-col gap-1.5 w-full">
        {/* Search */}
        {renderRow({
          id: "search",
          onClick: onSearchClick,
          icon: Search,
          title: "Search Wiki",
          glowClass: "border-teal-500/20 bg-teal-500/5 text-teal-400 hover:bg-teal-500/15 rail-glow-teal rail-animate-spin",
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

        {/* Library Items */}
        {renderRow({
          id: "stashes",
          href: withBasePath("/stashes"),
          icon: Bookmark,
          title: "Stashes",
          glowClass: "rail-glow-rose rail-animate-pulse border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/15",
          isActive: pathname === "/stashes" || pathname.startsWith("/stashes/"),
        })}

        {renderRow({
          id: "blurbs",
          href: withBasePath("/blurbs"),
          icon: BookOpen,
          title: "Blurbs",
          glowClass: "rail-glow-green rail-animate-bounce border-green-500/20 bg-green-500/5 text-green-400 hover:bg-green-500/15",
          isActive: pathname.startsWith("/blurbs"),
        })}

        {renderRow({
          id: "images",
          href: withBasePath("/w/repository"),
          icon: ImageIcon,
          title: "Repository",
          glowClass: "rail-glow-purple rail-animate-wiggle border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15",
          isActive: pathname === "/w/repository" || pathname.startsWith("/w/repository/"),
        })}

        {renderRow({
          id: "lorewards",
          href: withBasePath("/w/special/lorewards"),
          icon: Trophy,
          title: "Lorewards",
          glowClass: "rail-glow-gold rail-animate-rotate border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15",
          isActive: pathname === "/w/special/lorewards" || pathname.startsWith("/w/special/lorewards/"),
        })}

        {/* Page Tools: Dynamically shown on article page */}
        {!isSpecialPage && slug && (
          <>
            <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />

            {isSignedIn &&
              renderRow({
                id: "edit",
                href: withBasePath(`/w/${slug}/edit`),
                icon: FileEdit,
                title: "Edit Article",
                glowClass: "rail-glow-blue rail-animate-bounce border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15",
                isActive: activeId === "edit",
              })}

            {renderRow({
              id: "talk",
              href: withBasePath(`/w/${slug}/talk`),
              icon: MessageSquare,
              title: "Discussion (Talk)",
              glowClass: "rail-glow-purple rail-animate-wiggle border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15",
              isActive: activeId === "talk",
            })}

            {renderRow({
              id: "history",
              onClick: () => setActiveModal("history"),
              icon: Clock,
              title: "Revision History",
              glowClass: "rail-glow-amber rail-animate-spin border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/15",
              isActive: activeId === "history",
            })}

            {renderRow({
              id: "backlinks",
              onClick: () => setActiveModal("backlinks"),
              icon: Link2,
              title: "What Links Here",
              glowClass: "rail-glow-teal rail-animate-bounce border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/15",
              isActive: activeId === "backlinks",
            })}

            {/* Stash button */}
            <div className="flex w-full items-center px-2.5 py-1 rounded-xl hover:bg-white/5 transition-all duration-200 group">
              <div className="shrink-0">
                <StashButton title={title} isAuthenticated={isSignedIn} isCollapsed={true} />
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden text-left flex-1 text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]",
                  isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100 pl-3"
                )}
              >
                Stash Page
              </span>
            </div>
          </>
        )}

        {/* Active Country Flag */}
        {countryData && (
          <>
            <div className="my-0.5 w-full border-t border-[var(--wikios-border)]" />
            <ActiveCountryUnifiedWidget country={countryData} />
          </>
        )}
      </div>

      {/* Floating Border Toggle Handle */}
      <button
        onClick={toggleCollapsed}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -right-[14px] z-45",
          "flex h-7 w-7 items-center justify-center rounded-full border border-[var(--wikios-border)] bg-[var(--wikios-surface)]/95 shadow-md",
          "text-[var(--wikios-text-muted)] hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200 active:scale-95",
          "opacity-30 group-hover/sidebar:opacity-100 cursor-pointer"
        )}
        title={isCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
        type="button"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/sidebar:translate-x-0.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover/sidebar:-translate-x-0.5" />
        )}
      </button>
    </div>
  );
}
