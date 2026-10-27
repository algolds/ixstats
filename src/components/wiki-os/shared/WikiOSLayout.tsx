"use client";

import { type ReactNode, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useWikiOSShortcuts } from "~/components/wiki-os/shared/useWikiOSShortcuts";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { WikiArticleTabs } from "~/components/wiki-os/reader/WikiArticleTabs";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { WIKIOS_VERSION } from "~/lib/buildVersion";
import { stripBasePath } from "~/lib/base-path";
import { getArticleRoute, isNonArticlePath, type ArticleView } from "~/lib/wiki-os/article-route";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { useWikiPrefetch } from "~/hooks/useWikiPrefetch";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from "~/components/ui/popover";

// Sibling component imports
import { WikiPageActions } from "./WikiPageActions";
import { WikiOSContentWrapper } from "./WikiOSContentWrapper";
import { WikiOSLogomark } from "./WikiOSLogomark";
import { useMountOnFirstOpen } from "./useMountOnFirstOpen";

// A dialog nobody has opened when the page paints: fetched the first time it is opened.
const CreatePageModal = dynamic(() => import("./CreatePageModal").then((m) => m.CreatePageModal), {
  ssr: false,
});

export function WikiOSLayout({
  title,
  hideTitleHeading = false,
  readOnly,
  articleView = "read",
  children,
}: {
  title?: string;
  hideTitleHeading?: boolean;
  /** Another wiki's page shown in WikiOS (ruling E-l): no page tools and no edit shortcut. */
  readOnly?: boolean;
  /** The view of the page its path does not say (`?action=edit|history` on /wiki/<title>). */
  articleView?: ArticleView;
  children: ReactNode;
}) {
  useWikiOSShortcuts(readOnly);
  useWikiPrefetch();
  const { articleTitle } = useWikiContext();
  const pathname = usePathname();
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const createPageMounted = useMountOnFirstOpen(createPageOpen);

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

  const cleanPath = stripBasePath(pathname);
  // Another wiki's page is read-only: no tabs, and none of the article's own tools.
  const articleRoute = readOnly ? null : getArticleRoute(cleanPath, articleView);
  const hasArticleTools = !(readOnly || isMainPage || isNonArticlePath(cleanPath));

  const tabs = articleRoute && (
    <WikiArticleTabs title={articleRoute.title} active={articleRoute.tab} canEdit={isSignedIn} />
  );
  const actions = (
    <WikiPageActions
      onNewPage={() => setCreatePageOpen(true)}
      pageTools={{
        title: activeTitle,
        isSignedIn,
        country: countryData,
        articleTools: hasArticleTools,
      }}
    />
  );

  return (
    <div className="wikios-shell wikios-root">
      <WikiOSContentWrapper
        title={hideTitleHeading ? undefined : title}
        actions={actions}
        tabs={tabs}
      >
        {children}
      </WikiOSContentWrapper>

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
          <a href={ixstatesHref("/terms")} className="hover:text-yellow transition-colors">
            Terms of service
          </a>
          <span>•</span>
          <a href={ixstatesHref("/privacy")} className="hover:text-yellow transition-colors">
            Privacy policy
          </a>
        </div>
      </footer>

      {createPageMounted && (
        <CreatePageModal open={createPageOpen} onClose={() => setCreatePageOpen(false)} />
      )}
    </div>
  );
}
