"use client";
// src/components/wiki-os/shared/WikiOSLayout.tsx
// WikiOS content wrapper with standard DashboardSidebarLayout.

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
import { isTalkNamespace } from "~/lib/wiki-os/core/talk";
import { canonicalizeTitle, decodeTitleParam } from "~/lib/wiki-os/core/title";

/**
 * A path that is NOT an editable wiki article: the Special: namespace, and anything not under
 * /wiki/<title> (util, library and other routes). Every other /wiki/<title> is a page (a title that
 * used to be a tool route, such as "Search", is an article now), so the page tools (Edit /
 * Discussion / History / What Links Here) render for it.
 */
function isNonArticlePath(cleanPath: string): boolean {
  const wikiSlug = cleanPath.match(/^\/wiki\/([^/]+)/)?.[1];
  if (!wikiSlug) return true;
  return /^special:/i.test(decodeURIComponent(wikiSlug));
}

/** Whether `cleanPath` is a talk page (`/wiki/Talk:Foo`, `/wiki/User_talk:Jane/Notes`). */
function isTalkPath(cleanPath: string): boolean {
  const title = cleanPath.match(/^\/wiki\/(.+)$/)?.[1];
  if (!title) return false;
  const canon = canonicalizeTitle(title.split("/").map(decodeTitleParam).join("/"));
  return canon !== null && isTalkNamespace(canon.namespaceId);
}

export function WikiOSLayout({
  title,
  // oxlint-disable-next-line eslint/no-unused-vars
  sidebarVariant = "wiki",
  hideTitleHeading = false,
  showUtilitiesRibbon,
  sections,
  readOnly,
  children,
}: {
  title?: string;
  sidebarVariant?: "wiki" | "dashboard";
  hideTitleHeading?: boolean;
  showUtilitiesRibbon?: boolean;
  sections?: TocEntry[];
  /** Another wiki's page shown in WikiOS (ruling E-l): no page tools and no edit shortcut. */
  readOnly?: boolean;
  children: ReactNode;
}) {
  useWikiOSShortcuts(readOnly);
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
        // oxlint-disable-next-line
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
    if (isTalkPath(p)) return "talk";
    if (p.includes("/util/categories")) return "categories";
    if (p.includes("/util/recent")) return "recent";
    if (p.includes("/util/templates")) return "templates";
    if (p === "/util" || p.startsWith("/util")) return "utilities";
    if (p.includes("/util/lorewards")) return "lorewards";
    if (p.includes("/blurbs")) return "blurbs";
    if (p.includes("/stashes")) return "stashes";
    if (p.includes("/util/repository")) return "images";
    if (p.includes("/util/watchlist")) return "stashes";
    if (p.includes("/util/random")) return "random";
    if (p.includes("/util/search")) return "search";
    if (p.includes("/util/history")) return "history";
    if (p === "/wiki/Main_Page" || p === "/wiki") return "main";
    return null;
  };

  const activeId = getActiveId();

  // A "special page" has no page tools: the Main Page, a non-article path, or another wiki's page (read-only).
  const isSpecialPage = readOnly || isMainPage || isNonArticlePath(stripBasePath(pathname));

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
          {/*{(showUtilitiesRibbon ?? isSpecialPage) && (
          //  <WikiUtilitiesRibbon
          //    onSearchClick={() => setSearchOpen(true)}
          //    onCreatePageClick={() => setCreatePageOpen(true)}
          //  />
          )}*/}
          {children}
        </WikiOSContentWrapper>
      </DashboardSidebarLayout>

      <footer className="wikios-main-footer text-muted-foreground/40 mt-16 flex flex-col items-center justify-center gap-3.5 border-t border-white/5 pt-8 pb-10 text-center text-xs font-[var(--wikios-font-brand)]">
        <Popover>
          <PopoverTrigger asChild>
            <button className="group flex cursor-pointer flex-col items-center justify-center gap-2 opacity-80 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none hover:opacity-100 active:scale-95">
              <WikiOSLogomark className="h-7 w-auto text-zinc-900 transition-transform duration-300 group-hover:scale-105 dark:text-zinc-100" />
              <div className="text-muted-foreground/70 group-hover:text-muted-foreground flex items-center gap-1.5 text-xs font-[var(--wikios-font-brand)] font-medium tracking-wide">
                <span className="text-foreground/80 group-hover:text-foreground font-semibold">
                  Powered by wikiOS
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-muted-foreground/60 font-medium tabular-nums">
                  v{WIKIOS_VERSION}
                </span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 text-left font-[var(--wikios-font-ui)]">
            <PopoverTitle className="mb-1 text-sm font-[var(--wikios-font-brand)] font-bold text-[var(--wikios-text)]">
              About WikiOS
            </PopoverTitle>
            <PopoverDescription className="text-xs leading-relaxed text-[var(--wikios-text-muted)]">
              WikiOS is the next-generation sovereign wiki engine and reading environment for
              IxStates and worldbuilding communities.
            </PopoverDescription>
          </PopoverContent>
        </Popover>

        <div className="text-muted-foreground/60 flex items-center justify-center gap-4 text-xs font-[var(--wikios-font-ui)]">
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
