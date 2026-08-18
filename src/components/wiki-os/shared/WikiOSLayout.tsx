// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wiki-os/shared/WikiOSLayout.tsx
// WikiOS content wrapper with standard DashboardSidebarLayout.

"use client";

import { type ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWikiOSShortcuts } from "~/components/wiki-os/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { WIKIOS_VERSION } from "~/lib/buildVersion";
import { stripBasePath } from "~/lib/base-path";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { StatusIndicator } from "~/components/status-indicator";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from "~/components/ui/popover";

// Sibling component imports
import { SearchModal } from "./SearchModal";
import { WikiOSUnifiedSidebar } from "./WikiOSUnifiedSidebar";
import { WikiOSContentWrapper } from "./WikiOSContentWrapper";
import { CreatePageModal } from "./CreatePageModal";

import type { TocEntry } from "~/lib/wiki-os/html-transformer";

export function WikiOSLayout({
  title,
  sidebarVariant = "wiki",
  hideTitleHeading = false,
  sections,
  children,
}: {
  title?: string;
  sidebarVariant?: "wiki" | "dashboard";
  hideTitleHeading?: boolean;
  sections?: TocEntry[];
  children: ReactNode;
}) {
  useWikiOSShortcuts();
  const { articleTitle, setActiveModal } = useWikiContext();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [createPageOpen, setCreatePageOpen] = useState(false);

  // Check URL params to auto-open page creation modal
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("create") === "true" || params.get("action") === "create-page") {
        setCreatePageOpen(true);
      }
    }
  }, []);

  // Global Cmd+K to open search
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const activeTitle = title || articleTitle || "";
  const slug = activeTitle ? encodeURIComponent(activeTitle.replace(/ /g, "_")) : null;

  const isMainPage =
    activeTitle === "Main Page" ||
    activeTitle === "Main_Page" ||
    stripBasePath(pathname) === "/wiki/Main_Page" ||
    stripBasePath(pathname) === "/wiki/Main_Page/";

  // Active Country Context Query
  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: activeTitle },
    {
      enabled:
        !!activeTitle &&
        activeTitle.trim() !== "" &&
        !isMainPage &&
        !activeTitle.includes(":") &&
        ![
          "Stashes",
          "Blurbs",
          "Repository",
          "Lorewards",
          "Wiki & Lore",
          "Recent Changes",
          "Search",
          "Random",
        ].includes(activeTitle),
      retry: false,
    }
  );

  const { isSignedIn } = useWikiAuth();

  const getActiveId = () => {
    const p = stripBasePath(pathname);
    if (p.includes("/talk")) return "talk";
    if (p.includes("/edit")) return "edit";
    if (p.includes("/wiki/recent")) return "recent";
    if (p.includes("/wiki/lorewards")) return "lorewards";
    if (p.includes("/blurbs")) return "blurbs";
    if (p.includes("/stashes")) return "stashes";
    if (p.includes("/wiki/repository")) return "images";
    if (p.includes("/wiki/watchlist")) return "stashes";
    if (p.includes("/wiki/random")) return "random";
    if (p.includes("/wiki/search")) return "search";
    if (p.includes("/wiki/history")) return "history";
    if (p === "/wiki/Main_Page") return "main";
    return null;
  };

  const activeId = getActiveId();

  // A "special page" is anything that is NOT an editable wiki article — the Main Page,
  // the reserved /wiki/* tool routes, the Special: namespace, and non-article library
  // routes. Article pages (/wiki/<Title> and their /edit, /talk sub-routes) are NOT
  // special, so the page-tools (Edit / Talk / History / What Links Here) render for them.
  // NOTE: previously this matched every "/wiki/" path, which hid page tools on all
  // articles since every article lives under /wiki/.
  const RESERVED_WIKI_SLUGS = new Set([
    "lorewards",
    "diff",
    "watchlist",
    "search",
    "random",
    "repository",
    "recent-changes",
    "categories",
    "whatlinkshere",
    "user",
    "history",
    "contributions",
  ]);
  const cleanPath = stripBasePath(pathname);
  const wikiSlugMatch = cleanPath.match(/^\/wiki\/([^/]+)/);
  const wikiSlug = wikiSlugMatch ? decodeURIComponent(wikiSlugMatch[1]) : null;
  const isReservedWikiPage = !!wikiSlug && RESERVED_WIKI_SLUGS.has(wikiSlug);
  const isSpecialNamespace = !!wikiSlug && /^special:/i.test(wikiSlug);
  const isLibraryRoute =
    cleanPath === "/blurbs" ||
    cleanPath.startsWith("/blurbs/") ||
    cleanPath === "/stashes" ||
    cleanPath.startsWith("/stashes/");
  // Not under /wiki/<slug> at all → not an article either.
  const isSpecialPage =
    isMainPage || isReservedWikiPage || isSpecialNamespace || isLibraryRoute || !wikiSlug;

  const sidebarContent = (
    <WikiOSUnifiedSidebar
      activeId={activeId}
      onSearchClick={() => setSearchOpen(true)}
      onCreatePageClick={() => setCreatePageOpen(true)}
      title={activeTitle}
      slug={slug}
      isSignedIn={isSignedIn}
      setActiveModal={setActiveModal}
      countryData={countryData}
      isSpecialPage={isSpecialPage}
      pathname={pathname}
      sections={sections}
    />
  );

  return (
    <div className="wikios-shell wikios-root">
      <DashboardSidebarLayout
        sidebarContent={sidebarContent}
        showFloatingExpand={false}
        defaultCollapsed={true}
        disableCollapse={false}
        variant="rail"
        expandedWidthClassName="w-48"
        expandedWidthStyle="12rem"
        disableGlobalHover={true}
      >
        <WikiOSContentWrapper title={hideTitleHeading ? undefined : title}>
          {children}
        </WikiOSContentWrapper>
      </DashboardSidebarLayout>

      <footer className="wikios-main-footer text-muted-foreground/40 mt-16 flex flex-col items-center justify-center gap-3 border-t border-white/5 pt-6 pb-8 text-center text-xs">
        <div className="flex items-center justify-center gap-1.5">
          <span>Powered by</span>
          <Popover>
            <PopoverTrigger className="cursor-pointer font-bold text-[var(--wikios-text)] underline decoration-dotted transition-colors select-none hover:text-blue-400">
              WikiOS
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 text-left">
              <PopoverTitle className="mb-1 text-sm font-bold text-[var(--wikios-text)]">
                About WikiOS
              </PopoverTitle>
              <PopoverDescription className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
                WikiOS is the next-generation wiki platform. It features a beautiful design,
                improved performance, modern editing tools, and more.
              </PopoverDescription>
            </PopoverContent>
          </Popover>
          <span>v{WIKIOS_VERSION}</span>
        </div>
        <StatusIndicator
          status="operational"
          label="WikiOS Online"
          size="sm"
          className="border-white/5 bg-transparent"
        />
        <div className="text-muted-foreground/60 flex items-center justify-center gap-4 text-[11px]">
          <Link href="/terms" className="transition-colors hover:text-amber-400">
            Terms of Service
          </Link>
          <span>•</span>
          <Link href="/privacy" className="transition-colors hover:text-amber-400">
            Privacy Policy
          </Link>
        </div>
      </footer>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CreatePageModal open={createPageOpen} onClose={() => setCreatePageOpen(false)} />
    </div>
  );
}
