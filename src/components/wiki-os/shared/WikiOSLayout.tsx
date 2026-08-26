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
import { useWikiPrefetch } from "~/hooks/useWikiPrefetch";
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
import { WikiOSLogomark } from "./WikiOSLogomark";
import { WikiUtilitiesRibbon } from "./WikiUtilitiesRibbon";

import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";

export function WikiOSLayout({
  title,
  sidebarVariant = "wiki",
  hideTitleHeading = false,
  showUtilitiesRibbon,
  sections,
  children,
}: {
  title?: string;
  sidebarVariant?: "wiki" | "dashboard";
  hideTitleHeading?: boolean;
  showUtilitiesRibbon?: boolean;
  sections?: TocEntry[];
  children: ReactNode;
}) {
  useWikiOSShortcuts();
  useWikiPrefetch();
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
    if (p.includes("/util/categories") || p.includes("/wiki/categories")) return "categories";
    if (p.includes("/util/recent") || p.includes("/wiki/recent")) return "recent";
    if (p.includes("/util/templates") || p.includes("/wiki/templates")) return "templates";
    if (p === "/util" || p.startsWith("/util") || p.includes("/wiki/utilities")) return "utilities";
    if (p.includes("/util/lorewards") || p.includes("/wiki/lorewards")) return "lorewards";
    if (p.includes("/blurbs")) return "blurbs";
    if (p.includes("/stashes")) return "stashes";
    if (p.includes("/util/repository") || p.includes("/wiki/repository")) return "images";
    if (p.includes("/util/watchlist") || p.includes("/wiki/watchlist")) return "stashes";
    if (p.includes("/util/random") || p.includes("/wiki/random")) return "random";
    if (p.includes("/util/search") || p.includes("/wiki/search")) return "search";
    if (p.includes("/util/history") || p.includes("/wiki/history")) return "history";
    if (p === "/wiki/Main_Page" || p === "/wiki") return "main";
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
    "utilities",
    "templates",
    "sandbox",
  ]);
  const cleanPath = stripBasePath(pathname);
  const wikiSlugMatch = cleanPath.match(/^\/wiki\/([^/]+)/);
  const wikiSlug = wikiSlugMatch ? decodeURIComponent(wikiSlugMatch[1]) : null;
  const isReservedWikiPage = !!wikiSlug && RESERVED_WIKI_SLUGS.has(wikiSlug);
  const isSpecialNamespace = !!wikiSlug && /^special:/i.test(wikiSlug);
  const isUtilRoute = cleanPath === "/util" || cleanPath.startsWith("/util/");
  const isLibraryRoute =
    cleanPath === "/blurbs" ||
    cleanPath.startsWith("/blurbs/") ||
    cleanPath === "/stashes" ||
    cleanPath.startsWith("/stashes/");
  // Not under /wiki/<slug> at all → not an article either.
  const isSpecialPage =
    isMainPage || isReservedWikiPage || isSpecialNamespace || isLibraryRoute || isUtilRoute || !wikiSlug;

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
          {(showUtilitiesRibbon ?? isSpecialPage) && (
            <WikiUtilitiesRibbon
              onSearchClick={() => setSearchOpen(true)}
              onCreatePageClick={() => setCreatePageOpen(true)}
            />
          )}
          {children}
        </WikiOSContentWrapper>
      </DashboardSidebarLayout>

      <footer className="wikios-main-footer text-muted-foreground/40 mt-16 flex flex-col items-center justify-center gap-3.5 border-t border-white/5 pt-8 pb-10 text-center text-xs font-[var(--wikios-font-brand)]">
        <Popover>
          <PopoverTrigger asChild>
            <button className="group flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 select-none opacity-80 hover:opacity-100 active:scale-95">
              <WikiOSLogomark className="h-7 w-auto text-zinc-900 dark:text-zinc-100 transition-transform duration-300 group-hover:scale-105" />
              <div className="flex items-center gap-1.5 font-[var(--wikios-font-brand)] text-[11px] font-medium tracking-wide text-muted-foreground/70 group-hover:text-muted-foreground">
                <span className="font-semibold text-foreground/80 group-hover:text-foreground">Powered by wikiOS</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="tabular-nums text-muted-foreground/60 font-medium">v{WIKIOS_VERSION}</span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 text-left font-[var(--wikios-font-ui)]">
            <PopoverTitle className="mb-1 font-[var(--wikios-font-brand)] text-sm font-bold text-[var(--wikios-text)]">
              About WikiOS
            </PopoverTitle>
            <PopoverDescription className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
              WikiOS is the next-generation sovereign wiki engine and reading environment for IxStates and worldbuilding communities.
            </PopoverDescription>
          </PopoverContent>
        </Popover>

        <div className="text-muted-foreground/60 flex items-center justify-center gap-4 text-[11px] font-[var(--wikios-font-ui)]">
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
