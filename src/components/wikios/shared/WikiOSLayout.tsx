// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wikios/shared/WikiOSLayout.tsx
// WikiOS content wrapper with standard DashboardSidebarLayout.

"use client";

import {
  type ReactNode,
  type KeyboardEvent,
  useState,
  useEffect,
  useRef,
  useCallback,
  useDeferredValue,
} from "react";
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
  Trophy,
  ChevronDown,
  Globe,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";
import { stripBasePath } from "~/lib/base-path";
import { useWikiOSShortcuts } from "~/components/wikios/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { WIKIOS_VERSION } from "~/lib/buildVersion";

// Import core dashboard/MyCountry components
import { DashboardSidebarLayout } from "~/components/dashboard/DashboardSidebarLayout";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

interface WikiNavItem {
  id: string;
  href: string;
  icon: typeof Home;
  title: string;
  contextual?: boolean;
}

const NAV_GROUP_1: WikiNavItem[] = [
  { id: "main", href: "/w/Main_Page", icon: Home, title: "Main Page" },
  { id: "recent", href: "/w/special/recent-changes", icon: Clock, title: "Recent Changes" },
  { id: "random", href: "/w/special/random", icon: Shuffle, title: "Random" },
];

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

  const deferredQuery = useDeferredValue(debouncedQuery);

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
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Global Cmd+K listener
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

  const navigate = useCallback(
    (title: string) => {
      onClose();
      navigateWithBasePath(`/w/${encodeURIComponent(title.replace(/ /g, "_"))}`, router);
    },
    [router, onClose]
  );

  const handleKeyDown = (e: KeyboardEvent) => {
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
        navigateWithBasePath(`/w/special/search?q=${encodeURIComponent(query)}`, router);
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
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--wikios-text)] outline-none placeholder:text-[var(--wikios-text-dim)]"
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
                    idx === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                  )}
                  onClick={() => navigate(item.title)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      idx === selectedIndex
                        ? "text-[var(--wikios-text)]"
                        : "text-[var(--wikios-text-muted)]"
                    )}
                  >
                    {item.title}
                  </span>
                  {item.snippet && (
                    <span
                      className="mt-0.5 line-clamp-1 text-[11px] text-[var(--wikios-text-dim)] [&_.searchmatch]:font-semibold [&_.searchmatch]:text-[var(--wikios-text)]"
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
              className="text-xs text-[var(--wikios-text-dim)] transition-colors hover:text-[var(--wikios-text-muted)]"
              onClick={() => {
                onClose();
                navigateWithBasePath(`/w/special/search?q=${encodeURIComponent(query)}`, router);
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
// Collapsible Sectioned Navigation Widget
// ---------------------------------------------------------------------------

function WikiOSNavigationWidget({
  activeId,
  contextualItems,
  onSearchClick,
}: {
  activeId: string | null;
  contextualItems: WikiNavItem[];
  onSearchClick: () => void;
}) {
  const [openSections, setOpenSections] = useState({
    navigation: true,
    library: true,
    media: true,
    pageTools: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const navLinkClass = (isActive: boolean) =>
    cn(
      "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-all hover:bg-white/5",
      isActive
        ? "bg-blue-500/10 text-blue-400 font-semibold"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "w-48 overflow-hidden rounded-xl border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      <div className="relative bg-blue-500/10 px-3 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold text-blue-400">
          <BookOpen className="h-3.5 w-3.5" />
          Wiki Navigation
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>

      <CutoutCardContent className="space-y-3 p-3 pt-1">
        {/* Search trigger */}
        <button
          onClick={onSearchClick}
          className="flex w-full items-center gap-2 rounded-md bg-white/5 border border-white/5 px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all outline-none"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search Wiki...</span>
          <kbd className="ml-auto rounded bg-white/5 border border-white/5 px-1 text-[8px] text-muted-foreground/60">
            ⌘K
          </kbd>
        </button>

        {/* Page Tools (Contextual Edit/Talk) */}
        {contextualItems.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => toggleSection("pageTools")}
              className="flex w-full items-center justify-between text-[9px] font-bold tracking-wider text-muted-foreground/60 uppercase"
            >
              <span>Page Tools</span>
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", openSections.pageTools ? "" : "-rotate-90")}
              />
            </button>
            {openSections.pageTools && (
              <div className="mt-1 space-y-0.5">
                {contextualItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={withBasePath(item.href)}
                      className={navLinkClass(activeId === item.id)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Navigation Section */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection("navigation")}
            className="flex w-full items-center justify-between text-[9px] font-bold tracking-wider text-muted-foreground/60 uppercase"
          >
            <span>Navigation</span>
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", openSections.navigation ? "" : "-rotate-90")}
            />
          </button>
          {openSections.navigation && (
            <div className="mt-1 space-y-0.5">
              {NAV_GROUP_1.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={withBasePath(item.href)}
                    className={navLinkClass(activeId === item.id)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Library Section */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection("library")}
            className="flex w-full items-center justify-between text-[9px] font-bold tracking-wider text-muted-foreground/60 uppercase"
          >
            <span>Library</span>
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", openSections.library ? "" : "-rotate-90")}
            />
          </button>
          {openSections.library && (
            <div className="mt-1 space-y-0.5">
              {NAV_GROUP_2.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={withBasePath(item.href)}
                    className={navLinkClass(activeId === item.id)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Media & Extras Section */}
        <div className="space-y-1">
          <button
            onClick={() => toggleSection("media")}
            className="flex w-full items-center justify-between text-[9px] font-bold tracking-wider text-muted-foreground/60 uppercase"
          >
            <span>Media & Extras</span>
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", openSections.media ? "" : "-rotate-90")}
            />
          </button>
          {openSections.media && (
            <div className="mt-1 space-y-0.5">
              {NAV_GROUP_3.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={withBasePath(item.href)}
                    className={navLinkClass(activeId === item.id)}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
              <Link
                href={withBasePath("/w/special/lorewards")}
                className={navLinkClass(activeId === "lorewards")}
              >
                <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>Lorewards</span>
              </Link>
            </div>
          )}
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}

// ---------------------------------------------------------------------------
// Active Country Context Widget
// ---------------------------------------------------------------------------

function ActiveCountryContextWidget({ country }: { country: any }) {
  const router = useRouter();
  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "w-48 overflow-hidden rounded-xl border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      <div className="relative bg-amber-500/10 px-3 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Globe className="h-3.5 w-3.5" />
          Country Context
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>
      <CutoutCardContent className="space-y-3 p-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm">
            <UnifiedCountryFlag countryName={country.name} size="sm" showTooltip={false} />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-xs font-bold text-foreground">{country.name}</h4>
            <p className="text-[9px] text-muted-foreground">{country.continent}</p>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-white/5 pt-2 text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Population:</span>
            <span className="font-semibold text-foreground">
              {Math.round(country.currentPopulation).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GDP per Cap:</span>
            <span className="font-semibold text-foreground">
              ${Math.round(country.currentGdpPerCapita).toLocaleString()}
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push(`/countries?compare=${country.id}`)}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-all active:scale-[0.98]"
        >
          Compare with My Country
        </button>
      </CutoutCardContent>
    </CutoutCard>
  );
}

// ---------------------------------------------------------------------------
// Layout Wrapper
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

  const activeTitle = title || articleTitle || "";
  const slug = activeTitle ? encodeURIComponent(activeTitle.replace(/ /g, "_")) : null;

  // Active Country Context Query
  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: activeTitle },
    {
      enabled:
        !!activeTitle &&
        activeTitle.trim() !== "" &&
        activeTitle !== "Main Page" &&
        activeTitle !== "Main_Page" &&
        !activeTitle.includes(":"),
      retry: false,
    }
  );

  const { isSignedIn } = useAuth();

  const contextualItems = slug
    ? CONTEXTUAL_ITEMS.reduce<WikiNavItem[]>((acc, item) => {
        // Hide edit action for guests
        if (item.id === "edit" && !isSignedIn) return acc;
        switch (item.id) {
          case "edit":
            acc.push({ ...item, href: `/w/${slug}/edit` });
            break;
          case "talk":
            acc.push({ ...item, href: `/w/${slug}/talk` });
            break;
          default:
            acc.push(item);
        }
        return acc;
      }, [])
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

  const sidebarContent = (
    <>
      <WikiOSNavigationWidget
        activeId={activeId}
        contextualItems={contextualItems}
        onSearchClick={() => setSearchOpen(true)}
      />
      {countryData && <ActiveCountryContextWidget country={countryData} />}
    </>
  );

  return (
    <div className="wikios-shell wikios-root">
      <DashboardSidebarLayout sidebarContent={sidebarContent}>
        <main ref={contentRef} className="wikios-content min-w-0 flex-1">
          {title && <h1 className="wikios-article-title">{title.replace(/_/g, " ")}</h1>}
          {children}
        </main>
      </DashboardSidebarLayout>

      <footer className="wikios-main-footer pb-8 text-center text-xs text-muted-foreground/40 border-t border-white/5 pt-6 mt-16">
        Powered by <strong>WikiOS</strong> v{WIKIOS_VERSION}
      </footer>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
