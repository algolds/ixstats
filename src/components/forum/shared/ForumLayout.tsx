// src/components/forum/shared/ForumLayout.tsx
// Forum content wrapper with icon rail sidebar on desktop, horizontal pills on mobile.
// Mirrors WikiOSLayout.tsx pattern with orange forum accent color.

"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { type ReactNode, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Flame,
  Clock,
  Search,
  Bookmark,
  MessageCircle,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Bell,
  Reply,
  Share2,
  PenSquare,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { stripBasePath } from "~/lib/base-path";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
// eslint-disable-next-line unused-imports/no-unused-imports
import { api } from "~/trpc/react";
import { IXFORUM_VERSION } from "~/lib/buildVersion";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

interface ForumNavItem {
  id: string;
  href: string;
  icon: typeof Home;
  title: string;
  contextual?: boolean;
}

const NAV_GROUP_1: ForumNavItem[] = [
  { id: "home", href: "/forum", icon: Home, title: "Forums" },
  { id: "trending", href: "/forum?sort=trending", icon: Flame, title: "Trending" },
  { id: "new-posts", href: "/forum?sort=new", icon: Clock, title: "New Posts" },
];

const NAV_GROUP_2: ForumNavItem[] = [
  { id: "stashes", href: "/forum/bookmarks", icon: Bookmark, title: "Stashes" },
  { id: "conversations", href: "/messages", icon: MessageCircle, title: "Messages" },
];

// eslint-disable-next-line unused-imports/no-unused-vars
const NAV_GROUP_3: ForumNavItem[] = [
  { id: "search", href: "/forum/search", icon: Search, title: "Search" },
];

// ---------------------------------------------------------------------------
// Search Modal
// ---------------------------------------------------------------------------

function ForumSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, [open, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      onClose();
      router.push(withBasePath(`/forum/search?q=${encodeURIComponent(query)}`));
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--forum-text-dim)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search forums..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--forum-text)] outline-none placeholder:text-[var(--forum-text-dim)]"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--forum-text-dim)] sm:inline">
            ESC
          </kbd>
        </div>
        <div className="px-4 py-6 text-center text-xs text-[var(--forum-text-dim)]">
          Press Enter to search forums
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface ForumLayoutProps {
  children: ReactNode;
}

export function ForumLayout({ children }: ForumLayoutProps) {
  const { currentThread } = useForumContext();
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

  // Page transition animation
  const contentRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      const el = contentRef.current;
      if (el) {
        el.classList.remove("forum-page-enter");
        void el.offsetWidth;
        el.classList.add("forum-page-enter");
      }
    }
  }, [pathname]);

  // Build contextual nav items for thread view
  const contextualItems: ForumNavItem[] = currentThread
    ? [
        { id: "reply", href: "#reply", icon: Reply, title: "Reply", contextual: true },
        { id: "share", href: "#share", icon: Share2, title: "Share", contextual: true },
      ]
    : [];

  const getActiveId = () => {
    const p = stripBasePath(pathname);
    if (p === "/forum" || p === "/forum/") return "home";
    if (p.includes("/forum/conversations")) return "conversations";
    if (p.includes("/forum/bookmarks")) return "bookmarks";
    if (p.includes("/forum/search")) return "search";
    if (p.includes("/forum/new-thread")) return "new-thread";
    if (p.includes("sort=trending")) return "trending";
    if (p.includes("sort=new")) return "new-posts";
    return null;
  };

  const activeId = getActiveId();

  return (
    <div className="forum-shell relative">
      {/* Interactive grid background — orange accent on hover */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="pointer-events-auto fixed inset-0 z-0 opacity-25 dark:opacity-15"
        squaresClassName="fill-slate-200/15 dark:fill-slate-700/15 stroke-slate-300/20 dark:stroke-slate-600/20 [&:hover]:fill-orange-500/30 [&:hover]:stroke-orange-500/50 transition-all duration-300"
      />

      {/* Mobile: horizontal pill bar */}
      <nav className="forum-mobile-nav lg:hidden">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {NAV_GROUP_1.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          {NAV_GROUP_2.map((item) => (
            <MobilePill key={item.id} item={item} isActive={activeId === item.id} />
          ))}
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">Search</span>
          </button>
          {contextualItems.map((item) => (
            <MobilePill key={item.id} item={item} isActive={false} />
          ))}
        </div>
      </nav>

      <div className="flex">
        {/* Desktop: icon rail */}
        <aside className="forum-icon-rail hidden lg:flex">
          <nav className="flex flex-col gap-1">
            {/* Browse */}
            {NAV_GROUP_1.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            <div className="bg-border/50 mx-auto my-1.5 h-px w-6" />

            {/* Community */}
            {NAV_GROUP_2.map((item) => (
              <RailIcon key={item.id} item={item} isActive={activeId === item.id} />
            ))}

            <div className="bg-border/50 mx-auto my-1.5 h-px w-6" />

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                "text-muted-foreground hover:bg-orange-500/10 hover:text-orange-300"
              )}
              title="Search (⌘K)"
            >
              <Search className="h-[18px] w-[18px]" />
              <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full ml-2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                Search (⌘K)
              </span>
            </button>

            {/* New Thread */}
            <RailIcon
              item={{
                id: "new-thread",
                href: "/forum/new-thread",
                icon: PenSquare,
                title: "New Thread",
              }}
              isActive={activeId === "new-thread"}
            />

            {/* Contextual (reply/share when in thread) */}
            {contextualItems.length > 0 && (
              <>
                <div className="bg-border/50 mx-auto my-1.5 h-px w-6" />
                {contextualItems.map((item) => (
                  <RailIcon key={item.id} item={item} isActive={false} />
                ))}
              </>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main ref={contentRef} className="forum-content relative z-10 min-w-0 flex-1">
          {children}
        </main>
      </div>

      <footer className="forum-main-footer relative z-10">
        Powered by <strong>IxForum</strong> v{IXFORUM_VERSION}
      </footer>

      {/* Search Modal */}
      <ForumSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rail icon (desktop)
// ---------------------------------------------------------------------------

function RailIcon({ item, isActive }: { item: ForumNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={withBasePath(item.href)}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
        isActive
          ? "bg-orange-500/15 text-orange-400"
          : "text-muted-foreground hover:bg-orange-500/10 hover:text-orange-300"
      )}
      title={item.title}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="bg-popover text-popover-foreground pointer-events-none absolute left-full ml-2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {item.title}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Mobile pill
// ---------------------------------------------------------------------------

function MobilePill({ item, isActive }: { item: ForumNavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={withBasePath(item.href)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
        isActive
          ? "bg-orange-500/15 text-orange-400 shadow-sm"
          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap">{item.title}</span>
    </Link>
  );
}
