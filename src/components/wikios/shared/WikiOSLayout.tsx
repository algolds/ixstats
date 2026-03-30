// src/components/wikios/shared/WikiOSLayout.tsx
// WikiOS content wrapper with icon rail sidebar matching IxStats design.
// Icon rail on desktop, horizontal pills on mobile.

"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Clock,
  Shuffle,
  Search,
  FileEdit,
  Bookmark,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { LorewardsIcon } from "~/components/wikios/shared/LorewardsIcon";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { stripBasePath } from "~/lib/base-path";
import { useWikiOSShortcuts } from "~/components/wikios/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

interface WikiNavItem {
  id: string;
  href: string;
  icon: typeof Home;
  title: string;
  /** Only show when on an article page */
  contextual?: boolean;
}

const NAV_ITEMS: WikiNavItem[] = [
  { id: "main", href: "/w/Main_Page", icon: Home, title: "Main Page" },
  { id: "recent", href: "/wiki-special/recent-changes", icon: Clock, title: "Recent Changes" },
  { id: "stashes", href: "/wiki-special/stashes", icon: Bookmark, title: "Stashes" },
  { id: "images", href: "/wiki-special/images", icon: ImageIcon, title: "Images" },
  { id: "random", href: "/wiki-special/random", icon: Shuffle, title: "Random" },
  { id: "search", href: "/wiki-special/search", icon: Search, title: "Search" },
];

const CONTEXTUAL_ITEMS: WikiNavItem[] = [
  { id: "edit", href: "", icon: FileEdit, title: "Edit", contextual: true },
  { id: "talk", href: "", icon: MessageSquare, title: "Talk", contextual: true },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface WikiOSLayoutProps {
  title?: string;
  children: ReactNode;
}

export function WikiOSLayout({ title, children }: WikiOSLayoutProps) {
  useWikiOSShortcuts();
  const { articleTitle } = useWikiContext();
  const pathname = usePathname();

  // Build contextual hrefs based on current article
  const slug = articleTitle
    ? encodeURIComponent(articleTitle.replace(/ /g, "_"))
    : null;

  const contextualItems = slug
    ? CONTEXTUAL_ITEMS.map((item) => {
        switch (item.id) {
          case "edit":
            return { ...item, href: `/w/${slug}/edit` };
          case "talk":
            return { ...item, href: `/w/${slug}/talk` };
          default:
            return item;
        }
      })
    : [];

  const getActiveId = () => {
    const p = stripBasePath(pathname);
    if (p.includes("/talk")) return "talk";
    if (p.includes("/edit")) return "edit";
    if (p.includes("/wiki-special/recent")) return "recent";
    if (p.includes("/wiki-special/lorewards")) return "lorewards";
    if (p.includes("/wiki-special/stashes")) return "stashes";
    if (p.includes("/wiki-special/images")) return "images";
    if (p.includes("/wiki-special/watchlist")) return "stashes";
    if (p.includes("/wiki-special/random")) return "random";
    if (p.includes("/wiki-special/search")) return "search";
    if (p.includes("/wiki-special/history")) return "history";
    if (p === "/w/Main_Page") return "main";
    return null;
  };

  const activeId = getActiveId();

  return (
    <div className="wikios-shell">
      {/* Mobile: horizontal pill bar */}
      <nav className="wikios-mobile-nav lg:hidden">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          <MobilePill item={NAV_ITEMS[0]!} isActive={activeId === "main"} />
          <MobilePill item={NAV_ITEMS[1]!} isActive={activeId === "recent"} />
          <LorewardsMobilePill isActive={activeId === "lorewards"} />
          {NAV_ITEMS.slice(2).map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          {contextualItems.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
        </div>
      </nav>

      <div className="flex">
        {/* Desktop: icon rail */}
        <aside className="wikios-icon-rail hidden lg:flex">
          <nav className="flex flex-col gap-1">
            <RailIcon item={NAV_ITEMS[0]!} isActive={activeId === "main"} />
            <RailIcon item={NAV_ITEMS[1]!} isActive={activeId === "recent"} />
            <LorewardsRailIcon isActive={activeId === "lorewards"} />
            {NAV_ITEMS.slice(2).map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            {contextualItems.length > 0 && (
              <>
                <div className="mx-auto my-1.5 h-px w-6 bg-border/50" />
                {contextualItems.map((item) => (
                  <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
                ))}
              </>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main className="wikios-content min-w-0 flex-1">
          {title && (
            <h1 className="wikios-article-title">{title.replace(/_/g, " ")}</h1>
          )}
          {children}
        </main>
      </div>

      <footer className="wikios-main-footer">
        Powered by <strong>WikiOS</strong> v0.1-alpha
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rail icon (desktop)
// ---------------------------------------------------------------------------

function RailIcon({ item, isActive }: { item: WikiNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={withBasePath(item.href)}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
        isActive
          ? "bg-blue-500/15 text-blue-400"
          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      )}
      title={item.title}
    >
      <Icon className="h-[18px] w-[18px]" />
      {/* Tooltip label */}
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {item.title}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Mobile pill
// ---------------------------------------------------------------------------

function MobilePill({ item, isActive }: { item: WikiNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={withBasePath(item.href)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
        isActive
          ? "bg-blue-500/15 text-blue-400 shadow-sm"
          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="whitespace-nowrap">{item.title}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Lorewards custom icon — animated SVG on hover
// ---------------------------------------------------------------------------

function LorewardsRailIcon({ isActive }: { isActive: boolean }) {
  return (
    <Link
      href={withBasePath("/wiki-special/lorewards")}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
        isActive
          ? "bg-amber-500/15 text-amber-400"
          : "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-300"
      )}
      title="Lorewards"
    >
      <LorewardsIcon size={18} />
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        Lorewards
      </span>
    </Link>
  );
}

function LorewardsMobilePill({ isActive }: { isActive: boolean }) {
  return (
    <Link
      href={withBasePath("/wiki-special/lorewards")}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
        isActive
          ? "bg-amber-500/15 text-amber-400 shadow-sm"
          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      )}
    >
      <LorewardsIcon size={14} />
      <span className="whitespace-nowrap">Lorewards</span>
    </Link>
  );
}
