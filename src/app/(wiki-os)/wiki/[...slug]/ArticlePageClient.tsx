"use client";
// src/app/(wiki-os)/wiki/[...slug]/ArticlePageClient.tsx (rendered by page.tsx)
// WikiOS Article Reader & In-Place Editor. The route resolves the URL (title, redirect, canonical
// spelling, 404) on the server and primes the query cache, so the article is in the first HTML;
// this component keeps what is per viewer: edit mode, margin, stash, narrator.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { ArticleNotFound } from "~/components/wiki-os/reader/ArticleNotFound";
import { ArticleBusy } from "~/components/wiki-os/reader/ArticleBusy";
import { RedirectNotice } from "~/components/wiki-os/reader/RedirectNotice";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { WikiEditGate } from "~/components/wiki-os/editor/WikiEditGate";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useWikiSetting } from "~/components/wiki-os/shared/useWikiSetting";
import { articleUsesInspector } from "~/lib/wiki-os/article-gutter";
import {
  articleHtmlInput,
  getWikiBaseUrl,
  WIKI_SOURCES,
  type WikiSource,
} from "~/lib/wiki-os/config";
import type { ArticleMode } from "~/lib/wiki-os/types";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { isLeanResolvable, parseLeanMarker } from "~/lib/wiki-os/lean-article";

// The Main Page is its own chunk: an article never downloads it. It stays server-rendered (its data
// is in the first HTML), so the chunk is preloaded for that page, not fetched after hydration.
const WikiOSMainPage = dynamic(() =>
  import("~/components/wiki-os/reader/WikiOSMainPage").then((m) => m.WikiOSMainPage)
);

const ARTICLE_STALE_TIME_MS = 10 * 60 * 1000;
/** How soon a stale article (its render pending) is asked for again. */
const STALE_ARTICLE_REFETCH_MS = 5_000;
const BUSY_RETRY_DELAY_MS = 3_000;

/**
 * A template chip that shows the viewer's own country. The route reads the article as an anonymous
 * viewer (its tRPC context carries no session), so such a chip arrives as "No Country Loaded".
 */
const VIEWER_CHIP = 'data-key="MyCountry:';

/**
 * Whether the server's copy of the page may hold the anonymous reader's chips. A lean copy (its HTML
 * is markers; see lib/wiki-os/lean-article.ts) is always the anonymous one, whatever the chips are.
 */
function hasViewerChips(
  article:
    { contentHtml: string; infoboxHtml: string | null; noticesHtml: string | null } | undefined
): boolean {
  if (!article) return false;
  if (parseLeanMarker(article.contentHtml) !== null) return true;
  return [article.contentHtml, article.infoboxHtml, article.noticesHtml].some((html) =>
    html?.includes(VIEWER_CHIP)
  );
}

/** "Busy" (TOO_MANY_REQUESTS): the page may exist, the lookup was refused for now. Not "no such page". */
function isBusyError(error: { data?: { code?: string } | null }): boolean {
  return error.data?.code === "TOO_MANY_REQUESTS";
}

export interface ArticlePageClientProps {
  /** The canonical title: IxWiki's under MediaWiki's rules, another wiki's under its own. */
  title: string;
  wikiSource: WikiSource;
  /** False for `?redirect=no`: the redirect page itself (the same input the route primed). */
  followRedirect?: boolean;
  /** "(Redirected from X)": the page the reader was sent here from. */
  redirectedFrom?: string | null;
  /** Open the editor on load (`?action=edit`): `section` is a heading, or "new" for a new topic. */
  initialEdit?: { mode: "source" | "visual"; section: string | null } | null;
  /** Shown above the article (a user page's profile card). */
  aside?: ReactNode;
  /** Shown below the article (a category page's member list). */
  children?: ReactNode;
}

export default function ArticlePageClient({
  title,
  wikiSource,
  followRedirect = true,
  redirectedFrom = null,
  initialEdit = null,
  aside,
  children,
}: ArticlePageClientProps) {
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const { setActiveModal } = useWikiContext();
  const { isSignedIn, isLoaded: isAuthLoaded } = useWikiAuth();
  const articleRef = useRef<HTMLDivElement>(null);

  const isIxWiki = wikiSource === "ixwiki";
  // `?action=edit` opens the editor, for IxWiki pages only; `?margin` opens Margin, same.
  const isEditAction = isIxWiki && searchParams.get("action") === "edit";
  const isMarginParam = isIxWiki && Boolean(searchParams.get("margin"));
  const isMainPage = title === "Main Page";
  const [mode, setMode] = useState<ArticleMode>(
    isIxWiki && initialEdit ? initialEdit.mode : "reading"
  );

  // Sync mode with URL
  useEffect(() => {
    if (isEditAction && mode === "reading") {
      setMode("source");
    }
  }, [isEditAction, mode]);

  // Sync margin param with WikiContext
  useEffect(() => {
    if (isMarginParam) {
      setActiveModal("margin");
    }
  }, [isMarginParam, setActiveModal]);

  // The route primed this query (same input), so a fresh article is not fetched again.
  const { data, isLoading, error, refetch, failureCount } = api.wikios.getArticleHtml.useQuery(
    articleHtmlInput(title, wikiSource, { followRedirect }),
    {
      enabled: !!title && !isMainPage,
      // An article served while its render is still pending (`stale`) is asked for again soon and
      // never treated as fresh; a finished one is good for ten minutes.
      staleTime: (query) => (query.state.data?.stale ? 0 : ARTICLE_STALE_TIME_MS),
      refetchInterval: (query) => (query.state.data?.stale ? STALE_ARTICLE_REFETCH_MS : false),
      // "Busy" (the page may exist, MediaWiki was not asked yet) is worth a retry; anything else is final.
      retry: (failures, err) => isBusyError(err) && failures < 2,
      retryDelay: BUSY_RETRY_DELAY_MS,
    }
  );

  // A lean page (lib/wiki-os/lean-article.ts) hydrates with markers for the article's HTML, which the
  // reader reads back from the DOM the server rendered. A marker with no such DOM (kept from an
  // earlier page load) is replaced by asking for the article.
  const leanMarker = data?.contentHtml;
  const leanUnresolved = useMemo(
    () => parseLeanMarker(leanMarker) !== null && !isLeanResolvable(leanMarker),
    [leanMarker]
  );
  useEffect(() => {
    if (leanUnresolved) void refetch();
  }, [leanUnresolved, refetch]);
  // Until then the cached marker is no data: the page shows its loading state, not an empty article.
  const article = leanUnresolved ? undefined : data;

  // The server's copy of a page with viewer-specific chips is the anonymous one: a signed-in
  // reader asks once more, with their session, for their own chips.
  const refetchedForViewer = useRef(false);
  useEffect(() => {
    if (isAuthLoaded && isSignedIn && hasViewerChips(data) && !refetchedForViewer.current) {
      refetchedForViewer.current = true;
      void refetch();
    }
  }, [isAuthLoaded, isSignedIn, data, refetch]);

  // Background idle warmup so clicking Edit is 0ms: the wikitext the editor opens on, and the answer the edit
  // gate (WikiEditGate) waits for. Only a signed-in reader can edit: an anonymous reader never pays for the
  // wikitext (up to 2 MB) of every page they open, and the gate does not ask the server for them.
  useEffect(() => {
    if (data && !isMainPage && isIxWiki && isSignedIn) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => {
          void utils.wikios.getWikitext.prefetch({ title }, { staleTime: 10 * 60 * 1000 });
          void utils.wikios.getEditAccess.prefetch({ title }, { staleTime: 60 * 1000 });
        });
      }
    }
  }, [data, title, isMainPage, isIxWiki, isSignedIn, utils]);

  // Page title. An IxWiki page's canonical link comes from the server's metadata; another wiki's
  // page is client-rendered, so its canonical link (its own wiki's URL) is set here.
  useEffect(() => {
    if (isMainPage) {
      document.title = "IxWiki | WikiOS";
    } else if (data?.title) {
      const prefix = mode !== "reading" ? `Editing ${data.title}` : data.title;
      document.title = `${prefix} | ${WIKI_SOURCES[wikiSource].name}`;
      if (isIxWiki) return;
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      const origin = getWikiBaseUrl(wikiSource).replace(/\/+$/, "");
      canonical.href = `${origin}/wiki/${encodeURIComponent(data.title.replace(/ /g, "_"))}`;
    }
  }, [data?.title, isMainPage, isIxWiki, mode, wikiSource]);

  const handleEnterEdit = useCallback((editMode: "source" | "visual" = "source") => {
    setMode(editMode);
    const newUrl = `${window.location.pathname}?action=edit`;
    window.history.pushState(null, "", newUrl);
  }, []);

  const handleExitEdit = useCallback(() => {
    setMode("reading");
    const newUrl = window.location.pathname;
    window.history.pushState(null, "", newUrl);
  }, []);

  const handleSaveSuccess = useCallback(() => {
    void refetch();
    handleExitEdit();
  }, [refetch, handleExitEdit]);

  // The Inspector gutter is decided before the article loads (the column must not jump when it
  // arrives); a missing article and the editor give it back.
  const showWikiToc = useWikiSetting("wikios:showWikiToc", true);
  const inspector = articleUsesInspector({
    reading: mode === "reading",
    notFound: Boolean(error) && !article,
    showToc: showWikiToc,
  });

  // Main Page
  if (isMainPage) {
    return (
      <WikiOSLayout>
        <WikiOSMainPage />
      </WikiOSLayout>
    );
  }

  return (
    <WikiOSLayout
      readOnly={!isIxWiki}
      inspector={inspector}
      articleView={mode === "reading" ? "read" : "edit"}
    >
      <div ref={articleRef} className="wikios-article-container min-h-[500px]">
        {mode !== "reading" ? (
          <WikiEditGate title={title} onClose={handleExitEdit}>
            <WikiEditBridge
              title={title}
              initialMode={mode === "visual" ? "visual" : "source"}
              initialSection={
                initialEdit?.section && initialEdit.section !== "new"
                  ? initialEdit.section
                  : undefined
              }
              newSection={initialEdit?.section === "new"}
              onClose={handleExitEdit}
              onSaveSuccess={handleSaveSuccess}
            />
          </WikiEditGate>
        ) : (
          <>
            {redirectedFrom && <RedirectNotice from={redirectedFrom} />}
            {aside}
            {(isLoading || leanUnresolved) && !article && (
              <div className="wikios-loading flex min-h-[300px] flex-col items-center justify-center">
                <div className="wikios-loading-spinner" />
                <p className="text-body text-label-secondary mt-4">
                  {failureCount > 0 ? "WikiOS is busy — retrying..." : "Loading article..."}
                </p>
              </div>
            )}
            {error && !article && isBusyError(error) && (
              <ArticleBusy title={title} onRetry={() => void refetch()} />
            )}
            {error && !article && !isBusyError(error) && (
              <ArticleNotFound
                title={title}
                wikiSource={wikiSource}
                canCreate={isSignedIn}
                onCreate={() => handleEnterEdit("source")}
              />
            )}
            {article && (
              <ArticleRenderer
                title={article.title}
                contentHtml={article.contentHtml}
                infoboxHtml={article.infoboxHtml}
                noticesHtml={article.noticesHtml}
                toc={article.toc}
                categories={article.categories}
                lastModified={article.lastModified ?? null}
                wikiSource={wikiSource}
                authorInfo={article.authorInfo}
              />
            )}
            {children}
          </>
        )}
      </div>
    </WikiOSLayout>
  );
}
