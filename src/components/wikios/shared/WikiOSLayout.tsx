// src/components/wikios/shared/WikiOSLayout.tsx
// WikiOS content wrapper with icon rail sidebar matching IxStats design.
// Icon rail on desktop, horizontal pills on mobile.
// Search modal accessible from sidebar on all pages.

"use client";

import { type ReactNode, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Clock,
  Shuffle,
  Search,
  FileEdit,
  Bookmark,
  BookOpen,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { LorewardsIcon } from "~/components/wikios/shared/LorewardsIcon";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { stripBasePath } from "~/lib/base-path";
import { useWikiOSShortcuts } from "~/components/wikios/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { api } from "~/trpc/react";

// ---------------------------------------------------------------------------
// Nav items (Search removed — handled by modal)
// ---------------------------------------------------------------------------

interface WikiNavItem {
  id: string;
  href: string;
  icon: typeof Home;
  title: string;
  contextual?: boolean;
}

// Groups: browse | community | media
const NAV_GROUP_1: WikiNavItem[] = [
  { id: "main", href: "/w/Main_Page", icon: Home, title: "Main Page" },
  { id: "recent", href: "/w/special/recent-changes", icon: Clock, title: "Recent Changes" },
  { id: "random", href: "/w/special/random", icon: Shuffle, title: "Random" },
];

// Lorewards goes here (custom icon, inserted manually)

const NAV_GROUP_2: WikiNavItem[] = [
  { id: "stashes", href: "/w/special/stashes", icon: Bookmark, title: "Stashes" },
  { id: "blurbs", href: "/blurbs", icon: BookOpen, title: "Blurbs" },
];

const NAV_GROUP_3: WikiNavItem[] = [
  { id: "images", href: "/w/special/images", icon: ImageIcon, title: "Images" },
];

const CONTEXTUAL_ITEMS: WikiNavItem[] = [
  { id: "edit", href: "", icon: FileEdit, title: "Edit", contextual: true },
  { id: "talk", href: "", icon: MessageSquare, title: "Talk", contextual: true },
];

// ---------------------------------------------------------------------------
// Search Modal
// ---------------------------------------------------------------------------

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const deferredQuery = React.useDeferredValue(debouncedQuery);

  const { data: searchData } = api.wikios.advancedSearch.useQuery(
    { query: deferredQuery, limit: 8 },
    { enabled: open && deferredQuery.length >= 2, staleTime: 30_000 }
  );

  const items = searchData?.results ?? [];

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on results change
  useEffect(() => { setSelectedIndex(0); }, [items.length]);

  // Global Cmd+K listener
  useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose(); else { /* parent handles open */ }
      }
    };
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, [open, onClose]);

  const navigate = useCallback(
    (title: string) => {
      onClose();
      router.push(withBasePath(`/w/${encodeURIComponent(title.replace(/ /g, "_"))}`));
    },
    [router, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) {
        navigate(items[selectedIndex].title);
      } else if (query.trim()) {
        onClose();
        router.push(withBasePath(`/w/special/search?q=${encodeURIComponent(query)}`));
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--wikios-text-dim)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--wikios-text-dim)] sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {query.length >= 2 && items.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((item, idx) => (
              <li key={item.title}>
                <button
                  className={cn(
                    "flex w-full flex-col px-4 py-2.5 text-left transition-colors",
                    idx === selectedIndex
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  )}
                  onClick={() => navigate(item.title)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className={cn(
                    "truncate text-sm font-medium",
                    idx === selectedIndex ? "text-[var(--wikios-text)]" : "text-[var(--wikios-text-muted)]"
                  )}>
                    {item.title}
                  </span>
                  {item.snippet && (
                    <span
                      className="mt-0.5 line-clamp-1 text-[11px] text-[var(--wikios-text-dim)] [&_.searchmatch]:text-[var(--wikios-text)] [&_.searchmatch]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: item.snippet }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && items.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[var(--wikios-text-dim)]">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer */}
        {query.length >= 2 && (
          <div className="border-t border-white/10 px-4 py-2">
            <button
              className="text-xs text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text-muted)] transition-colors"
              onClick={() => {
                onClose();
                router.push(withBasePath(`/w/special/search?q=${encodeURIComponent(query)}`));
              }}
            >
              Full search for &ldquo;{query}&rdquo; →
            </button>
          </div>
        )}

        {query.length < 2 && (
          <div className="px-4 py-6 text-center text-xs text-[var(--wikios-text-dim)]">
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Cmd+K to open search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Page transition animation — content materializes from DI on route change
  const contentRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      const el = contentRef.current;
      if (el) {
        el.classList.remove("wikios-page-enter");
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add("wikios-page-enter");
      }
    }
  }, [pathname]);

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
    if (p.includes("/w/special/recent")) return "recent";
    if (p.includes("/w/special/lorewards")) return "lorewards";
    if (p.includes("/blurbs")) return "blurbs";
    if (p.includes("/w/special/stashes")) return "stashes";
    if (p.includes("/w/special/images")) return "images";
    if (p.includes("/w/special/watchlist")) return "stashes";
    if (p.includes("/w/special/random")) return "random";
    if (p.includes("/w/special/search")) return "search";
    if (p.includes("/w/special/history")) return "history";
    if (p === "/w/Main_Page") return "main";
    return null;
  };

  const activeId = getActiveId();

  return (
    <div className="wikios-shell">
      {/* Mobile: horizontal pill bar */}
      <nav className="wikios-mobile-nav lg:hidden">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {NAV_GROUP_1.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          <LorewardsMobilePill isActive={activeId === "lorewards"} />
          {NAV_GROUP_2.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          {NAV_GROUP_3.map((item) => (
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
            {/* Browse */}
            {NAV_GROUP_1.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            <div className="mx-auto my-1.5 h-px w-6 bg-border/50" />

            {/* Community */}
            <LorewardsRailIcon isActive={activeId === "lorewards"} />
            {NAV_GROUP_2.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            <div className="mx-auto my-1.5 h-px w-6 bg-border/50" />

            {/* Media */}
            {NAV_GROUP_3.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            {/* Contextual (edit/talk) */}
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
        <main ref={contentRef} className="wikios-content min-w-0 flex-1">
          {title && (
            <h1 className="wikios-article-title">{title.replace(/_/g, " ")}</h1>
          )}
          {children}
        </main>
      </div>

      <footer className="wikios-main-footer">
        Powered by <strong>WikiOS</strong> v0.5-alpha
      </footer>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
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
      href={withBasePath("/w/special/lorewards")}
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
      href={withBasePath("/w/special/lorewards")}
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
