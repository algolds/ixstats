"use client";
// src/app/(wiki-os)/wiki/[slug]/ArticlePageClient.tsx (rendered by page.tsx)
// WikiOS Article Reader & In-Place Editor with Instant Caching

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { ArticleNotFound } from "~/components/wiki-os/reader/ArticleNotFound";
import { ArticleBusy } from "~/components/wiki-os/reader/ArticleBusy";
import { WikiOSMainPage } from "~/components/wiki-os/reader/WikiOSMainPage";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { withBasePath } from "~/lib/base-path";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import {
  articleHtmlInput,
  getWikiBaseUrl,
  parseWikiSource,
  WIKI_SOURCES,
} from "~/lib/wiki-os/config";
import type { ArticleMode } from "~/lib/wiki-os/types";
import { RESERVED_TOOL_PAGES } from "./reserved-tool-pages";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { canonicalizeTitle, decodeTitleParam } from "~/lib/wiki-os/core/title";

const ARTICLE_STALE_TIME_MS = 10 * 60 * 1000;
/** How soon a stale article (its render pending) is asked for again. */
const STALE_ARTICLE_REFETCH_MS = 5_000;
const BUSY_RETRY_DELAY_MS = 3_000;

/** "Busy" (TOO_MANY_REQUESTS): the page may exist, the lookup was refused for now. Not "no such page". */
function isBusyError(error: { data?: { code?: string } | null }): boolean {
  return error.data?.code === "TOO_MANY_REQUESTS";
}

/**
 * `?source=` reads another wiki's page (e.g. a realm's iiwiki lore), read-only (ruling E-l);
 * `?action=edit` opens the editor, for IxWiki pages only.
 */
function readerParams(searchParams: Pick<URLSearchParams, "get">) {
  const wikiSource = parseWikiSource(searchParams.get("source"));
  const isIxWiki = wikiSource === "ixwiki";
  return {
    wikiSource,
    isEditAction: isIxWiki && searchParams.get("action") === "edit",
    isMarginParam: isIxWiki && Boolean(searchParams.get("margin")),
  };
}

export default function WikiOSArticlePage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = api.useUtils();
  const { setActiveModal } = useWikiContext();
  const { isSignedIn } = useWikiAuth();
  const articleRef = useRef<HTMLDivElement>(null);

  const { wikiSource, isEditAction, isMarginParam } = readerParams(searchParams);
  const isIxWiki = wikiSource === "ixwiki";

  // The URL segment is decoded once; everything below works on the canonical title.
  const rawSlug = params.slug || "";
  const decodedSlug = decodeTitleParam(rawSlug);
  const canon = useMemo(
    () => canonicalizeTitle(decodedSlug, { source: wikiSource }),
    [decodedSlug, wikiSource]
  );
  const title = canon?.title ?? "";
  const slug = title.replace(/ /g, "_");
  const isMainPage = title === "Main Page";
  const [mode, setMode] = useState<ArticleMode>(isEditAction ? "source" : "reading");

  // Normalized keys for reserved tool detection
  const slugLower = slug.toLowerCase();
  const slugDashed = slugLower.replace(/[\s_]+/g, "-");
  const titleLower = title.toLowerCase();
  const titleDashed = titleLower.replace(/[\s_]+/g, "-");

  const targetReservedPath =
    RESERVED_TOOL_PAGES[slugDashed] ||
    RESERVED_TOOL_PAGES[titleDashed] ||
    RESERVED_TOOL_PAGES[slugLower] ||
    RESERVED_TOOL_PAGES[titleLower] ||
    null;

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

  // Redirect Category: pages, User: profiles, Special: pages, or reserved tool routes
  useEffect(() => {
    if (targetReservedPath) {
      router.replace(withBasePath(targetReservedPath));
      return;
    }

    if (title.startsWith("Category:")) {
      const catName = title.slice("Category:".length);
      router.replace(
        withBasePath(`/wiki/categories/${encodeURIComponent(catName.replace(/ /g, "_"))}`)
      );
    } else if (title.startsWith("User:") || title.startsWith("User_talk:")) {
      const userName = title.replace(/^User(_talk)?:/i, "").trim();
      router.replace(withBasePath(getWikiProfilePath(userName.replace(/_/g, " "))));
    } else if (/^Special:/i.test(title)) {
      const spec = title.replace(/^Special:/i, "").trim();
      const specLower = spec.toLowerCase();

      if (specLower === "specialpages" || specLower === "utilities") {
        router.replace(withBasePath("/util"));
      } else if (specLower === "recentchanges" || specLower === "recent-changes") {
        router.replace(withBasePath("/util/recent-changes"));
      } else if (specLower === "watchlist") {
        router.replace(withBasePath("/util/watchlist"));
      } else if (specLower === "random" || specLower === "randompage") {
        router.replace(withBasePath("/util/random"));
      } else if (specLower === "categories" || specLower === "categorytree") {
        router.replace(withBasePath("/util/categories"));
      } else if (specLower === "search") {
        router.replace(withBasePath("/util/search"));
      } else if (specLower === "templates") {
        router.replace(withBasePath("/util/templates"));
      } else if (specLower === "diff") {
        router.replace(withBasePath("/util/diff"));
      } else if (specLower.startsWith("contributions")) {
        const user = spec.replace(/^contributions\/?/i, "").trim();
        router.replace(
          user
            ? withBasePath(`/util/contributions/${encodeURIComponent(user)}`)
            : withBasePath("/util/contributions")
        );
      } else if (specLower.startsWith("whatlinkshere")) {
        const target = spec.replace(/^whatlinkshere\/?/i, "").trim();
        router.replace(
          target
            ? withBasePath(`/util/whatlinkshere/${encodeURIComponent(target)}`)
            : withBasePath("/util/whatlinkshere")
        );
      } else {
        router.replace(withBasePath("/util"));
      }
    }
  }, [title, targetReservedPath, router]);

  const isCategoryOrSpecialOrMain =
    isMainPage ||
    title.startsWith("Category:") ||
    title.startsWith("User:") ||
    title.startsWith("User_talk:") ||
    /^Special:/i.test(title) ||
    Boolean(targetReservedPath);

  // An IxWiki URL that is not the canonical spelling (`/wiki/foo_bar` for "Foo bar") moves to the
  // canonical one, keeping the query string and hash. Compared decoded, so encoding differences
  // never loop. Another wiki's page (`?source=`) is never redirected, and neither is a subpage
  // ("Foo/Bar"): its canonical path has a literal "/", which only plan 412's catch-all route serves.
  useEffect(() => {
    if (!canon || !isIxWiki || canon.title.includes("/")) return;
    if (isCategoryOrSpecialOrMain || decodedSlug === slug) return;
    const query = searchParams.toString();
    const hash =
      window.location.hash ||
      (canon.fragment ? `#${encodeURIComponent(canon.fragment.replace(/ /g, "_"))}` : "");
    router.replace(`${withBasePath(`/wiki/${canon.urlPath}`)}${query ? `?${query}` : ""}${hash}`);
  }, [canon, isIxWiki, isCategoryOrSpecialOrMain, decodedSlug, slug, searchParams, router]);

  // Fetch article HTML (strictly disabled on reserved tools, category routes, and special pages)
  const { data, isLoading, error, refetch, failureCount } = api.wikios.getArticleHtml.useQuery(
    articleHtmlInput(title, wikiSource),
    {
      enabled: !!title && !isCategoryOrSpecialOrMain,
      // An article served while its render is still pending (`stale`) is asked for again soon and
      // never treated as fresh; a finished one is good for ten minutes.
      staleTime: (query) => (query.state.data?.stale ? 0 : ARTICLE_STALE_TIME_MS),
      refetchInterval: (query) => (query.state.data?.stale ? STALE_ARTICLE_REFETCH_MS : false),
      // "Busy" (the page may exist, MediaWiki was not asked yet) is worth a retry; anything else is final.
      retry: (failures, err) => isBusyError(err) && failures < 2,
      retryDelay: BUSY_RETRY_DELAY_MS,
    }
  );

  // Background idle wikitext warmup so clicking Edit is 0ms. Only a signed-in reader can edit:
  // an anonymous reader never pays for the wikitext (up to 2 MB) of every page they open.
  useEffect(() => {
    if (data && !isMainPage && isIxWiki && isSignedIn) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => {
          void utils.wikios.getWikitext.prefetch({ title }, { staleTime: 10 * 60 * 1000 });
        });
      }
    }
  }, [data, title, isMainPage, isIxWiki, isSignedIn, utils]);

  // Canonical link and page title
  useEffect(() => {
    if (isMainPage) {
      document.title = "IxWiki — WikiOS";
    } else if (data?.title) {
      const prefix = mode !== "reading" ? `Editing ${data.title}` : data.title;
      document.title = `${prefix} — ${WIKI_SOURCES[wikiSource].name}`;
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      const origin = getWikiBaseUrl(wikiSource).replace(/\/+$/, "");
      canonical.href = `${origin}/wiki/${encodeURIComponent(data.title.replace(/ /g, "_"))}`;
    }
  }, [data?.title, isMainPage, mode, wikiSource]);

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

  if (!canon) {
    return (
      <WikiOSLayout readOnly={!isIxWiki}>
        <div className="wikios-article-container min-h-[500px]">
          <ArticleNotFound title={decodedSlug} wikiSource={wikiSource} onCreate={() => {}} />
        </div>
      </WikiOSLayout>
    );
  }

  // Main Page
  if (isMainPage) {
    return (
      <WikiOSLayout>
        <WikiOSMainPage />
      </WikiOSLayout>
    );
  }

  return (
    <WikiOSLayout readOnly={!isIxWiki}>
      <div ref={articleRef} className="wikios-article-container min-h-[500px]">
        {mode !== "reading" ? (
          <WikiEditBridge
            title={title}
            initialMode={mode === "visual" ? "visual" : "source"}
            onClose={handleExitEdit}
            onSaveSuccess={handleSaveSuccess}
          />
        ) : (
          <>
            {isLoading && !data && (
              <div className="wikios-loading flex min-h-[300px] flex-col items-center justify-center">
                <div className="wikios-loading-spinner" />
                <p className="mt-4 text-sm text-zinc-400">
                  {failureCount > 0 ? "WikiOS is busy — retrying..." : "Loading article..."}
                </p>
              </div>
            )}
            {error && !data && isBusyError(error) && (
              <ArticleBusy title={title} onRetry={() => void refetch()} />
            )}
            {error && !data && !isBusyError(error) && (
              <ArticleNotFound
                title={title}
                wikiSource={wikiSource}
                onCreate={() => handleEnterEdit("source")}
              />
            )}
            {data && (
              <ArticleRenderer
                title={data.title}
                contentHtml={data.contentHtml}
                infoboxHtml={data.infoboxHtml}
                noticesHtml={data.noticesHtml}
                toc={data.toc}
                categories={data.categories}
                lastModified={data.lastModified ?? null}
                wikiSource={wikiSource}
                authorInfo={data.authorInfo}
              />
            )}
          </>
        )}
      </div>
    </WikiOSLayout>
  );
}
