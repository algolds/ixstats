"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { ArticleNotFound } from "~/components/wiki-os/reader/ArticleNotFound";
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
import { RESERVED_TOOL_PAGES, redirectTarget } from "./reserved-tool-pages";
import { toReaderAuthorInfo } from "~/components/wiki-os/reader/toReaderAuthorInfo";
import type { ArticleAuthorInfo as CanonicalAuthorInfo } from "~/lib/wiki-os/types/canonical";

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
  const articleRef = useRef<HTMLDivElement>(null);

  const rawSlug = params.slug || "";
  const slug = decodeURIComponent(rawSlug);
  const title = slug.replace(/_/g, " ");
  const isMainPage = title === "Main Page" || title === "Main_Page" || slug === "Main_Page";

  const { wikiSource, isEditAction, isMarginParam } = readerParams(searchParams);
  const isIxWiki = wikiSource === "ixwiki";
  const [mode, setMode] = useState<ArticleMode>(isEditAction ? "source" : "reading");

  // Normalized keys for reserved tool detection
  const slugLower = slug.toLowerCase();
  const titleLower = title.toLowerCase();
  const reservedKeys = [
    slugLower.replace(/[\s_]+/g, "-"),
    titleLower.replace(/[\s_]+/g, "-"),
    slugLower,
    titleLower,
  ];
  const targetReservedPath = reservedKeys.map((k) => RESERVED_TOOL_PAGES[k]).find(Boolean) ?? null;

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

  // Category:, User:, Special: pages and reserved tool routes live elsewhere
  const redirectPath = redirectTarget(title, targetReservedPath);
  useEffect(() => {
    if (redirectPath) router.replace(withBasePath(redirectPath));
  }, [redirectPath, router]);

  const isCategoryOrSpecialOrMain = isMainPage || redirectPath !== null;

  // Fetch article HTML (strictly disabled on reserved tools, category routes, and special pages)
  const { data, isLoading, error, refetch } = api.wikios.getArticleHtml.useQuery(
    articleHtmlInput(title, wikiSource),
    {
      enabled: !!title && !isCategoryOrSpecialOrMain,
      staleTime: 10 * 60 * 1000,
      retry: false,
    }
  );

  // Background idle wikitext warmup so clicking Edit is 0ms
  useEffect(() => {
    if (data && !isMainPage && isIxWiki) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => {
          void utils.wikios.getWikitext.prefetch({ title }, { staleTime: 10 * 60 * 1000 });
        });
      }
    }
  }, [data, title, isMainPage, isIxWiki, utils]);

  // Canonical link and page title
  useEffect(() => {
    if (isMainPage) {
      document.title = "IxWiki | WikiOS";
    } else if (data?.title) {
      const prefix = mode !== "reading" ? `Editing ${data.title}` : data.title;
      document.title = `${prefix} | ${WIKI_SOURCES[wikiSource].name}`;
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
                <p className="text-body text-label-secondary mt-4">Loading article...</p>
              </div>
            )}
            {error && !data && (
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
                authorInfo={
                  data.authorInfo
                    ? toReaderAuthorInfo(data.authorInfo as CanonicalAuthorInfo)
                    : null
                }
              />
            )}
          </>
        )}
      </div>
    </WikiOSLayout>
  );
}
