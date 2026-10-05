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

/**
 * A path that is NOT an editable wiki article: the reserved /wiki/* tool routes, the Special: namespace, and
 * anything not under /wiki/<slug> (util, library and other routes). Article pages (/wiki/<Title> and their
 * /edit, /talk sub-routes) are NOT special, so the page tools (Edit / Talk / History / What Links Here) render
 * for them. NOTE: previously this matched every "/wiki/" path, which hid page tools on all articles.
 */
function isNonArticlePath(cleanPath: string): boolean {
  const wikiSlug = cleanPath.match(/^\/wiki\/([^/]+)/)?.[1];
  if (!wikiSlug) return true;
  const slug = decodeURIComponent(wikiSlug);
  return RESERVED_WIKI_SLUGS.has(slug) || /^special:/i.test(slug);
}

/** First match wins, so the broad `/util` rule shadows the /util/* tools listed after it. */
const SIDEBAR_ACTIVE_RULES: ReadonlyArray<[id: string, pattern: RegExp]> = [
  ["talk", /\/talk/],
  ["edit", /\/edit/],
  ["categories", /\/(?:util|wiki)\/categories/],
  ["recent", /\/(?:util|wiki)\/recent/],
  ["templates", /\/(?:util|wiki)\/templates/],
  ["utilities", /^\/util|\/wiki\/utilities/],
  ["lorewards", /\/(?:util|wiki)\/lorewards/],
  ["blurbs", /\/blurbs/],
  ["stashes", /\/stashes/],
  ["images", /\/(?:util|wiki)\/repository/],
  ["stashes", /\/(?:util|wiki)\/watchlist/],
  ["random", /\/(?:util|wiki)\/random/],
  ["search", /\/(?:util|wiki)\/search/],
  ["history", /\/(?:util|wiki)\/history/],
  ["main", /^\/wiki(?:\/Main_Page)?$/],
];

export function WikiOSLayout({
  title,
  hideTitleHeading = false,
  readOnly,
  children,
}: {
  title?: string;
  hideTitleHeading?: boolean;
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

  const activeId =
    SIDEBAR_ACTIVE_RULES.find(([, re]) => re.test(stripBasePath(pathname)))?.[0] ?? null;

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
    />
  );

  return (
    <div className="wikios-shell wikios-root">
      <DashboardSidebarLayout
        sidebarContent={sidebarContent}
        defaultCollapsed={true}
        disableCollapse={false}
        expandedWidthClassName="w-48"
        expandedWidthStyle="12rem"
        disableGlobalHover={true}
      >
        <WikiOSContentWrapper title={hideTitleHeading ? undefined : title}>
          {children}
        </WikiOSContentWrapper>
      </DashboardSidebarLayout>

      <footer className="wikios-main-footer text-label-secondary border-separator text-footnote mt-16 flex flex-col items-center justify-center gap-4 border-t pt-8 pb-10 text-center font-[var(--wikios-font-brand)]">
        <Popover>
          <PopoverTrigger asChild>
            <button className="group flex cursor-pointer flex-col items-center justify-center gap-2 opacity-80 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none hover:opacity-100">
              <WikiOSLogomark className="text-label h-7 w-auto transition-transform duration-300" />
              <div className="text-label-secondary group-hover:text-label-secondary text-caption flex items-center gap-2 font-[var(--wikios-font-brand)]">
                <span className="text-label-secondary group-hover:text-label font-semibold">
                  Powered by wikiOS
                </span>
                <span className="text-label-secondary">•</span>
                <span className="text-label-secondary font-medium tabular-nums">
                  v{WIKIOS_VERSION}
                </span>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 text-left font-[var(--wikios-font-ui)]">
            <PopoverTitle className="text-headline text-label mb-1 font-[var(--wikios-font-brand)]">
              About WikiOS
            </PopoverTitle>
            <PopoverDescription className="text-footnote text-label-secondary leading-relaxed">
              WikiOS is the wiki reader and editor for IxStates and other worldbuilding communities.
            </PopoverDescription>
          </PopoverContent>
        </Popover>

        <div className="text-label-secondary text-footnote flex items-center justify-center gap-4 font-[var(--wikios-font-ui)]">
          <Link href="/terms" className="hover:text-yellow transition-colors">
            Terms of service
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-yellow transition-colors">
            Privacy policy
          </Link>
        </div>
      </footer>

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CreatePageModal open={createPageOpen} onClose={() => setCreatePageOpen(false)} />
    </div>
  );
}
