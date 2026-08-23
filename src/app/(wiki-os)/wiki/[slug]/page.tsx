// src/app/(wiki-os)/wiki/[slug]/page.tsx
// WikiOS Article Reader & In-Place Editor with Instant Caching
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ArticleRenderer } from "~/components/wiki-os/reader/ArticleRenderer";
import { WikiOSMainPage } from "~/components/wiki-os/reader/WikiOSMainPage";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { useLinkPreviews } from "~/components/wiki-os/reader/LinkPreview";
import { withBasePath } from "~/lib/base-path";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import type { ArticleMode } from "~/lib/wiki-os/types";

export default function WikiOSArticlePage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = api.useUtils();
  const { setActiveModal } = useWikiContext();
  const articleRef = useRef<HTMLDivElement>(null);

  const slug = params.slug;
  const title = decodeURIComponent(slug).replace(/_/g, " ");
  const isMainPage = title === "Main Page" || title === "Main_Page";

  // Check URL search param for edit mode (e.g. ?action=edit)
  const isEditAction = searchParams.get("action") === "edit";
  const isMarginParam = searchParams.get("margin");
  const [mode, setMode] = useState<ArticleMode>(isEditAction ? "source" : "reading");

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


  // Redirect Category: pages or /wiki/categories to the category browser
  useEffect(() => {
    if (title.startsWith("Category:")) {
      const catName = title.slice("Category:".length);
      router.replace(
        withBasePath(`/wiki/categories/${encodeURIComponent(catName.replace(/ /g, "_"))}`)
      );
    } else if (title.toLowerCase() === "categories") {
      router.replace(withBasePath("/wiki/categories"));
    }
  }, [title, router]);

  const isCategoryOrMain =
    isMainPage ||
    title.startsWith("Category:") ||
    title.toLowerCase() === "categories";

  // Fetch article HTML
  const { data, isLoading, error, refetch } = api.wikios.getArticleHtml.useQuery(
    { title },
    {
      enabled: !!title && !isCategoryOrMain,
      staleTime: 10 * 60 * 1000,
    }
  );

  // Background idle wikitext warmup so clicking Edit is 0ms
  useEffect(() => {
    if (data && !isMainPage) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => {
          void utils.wikios.getWikitext.prefetch({ title }, { staleTime: 10 * 60 * 1000 });
        });
      }
    }
  }, [data, title, isMainPage, utils]);

  // Canonical link and page title
  useEffect(() => {
    if (isMainPage) {
      document.title = "IxWiki — WikiOS";
    } else if (data?.title) {
      const prefix = mode !== "reading" ? `Editing ${data.title}` : data.title;
      document.title = `${prefix} — IxWiki`;
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = `https://ixwiki.com/wiki/${encodeURIComponent(data.title.replace(/ /g, "_"))}`;
    }
  }, [data?.title, isMainPage, mode]);

  // Link hover previews
  const previewPortal = useLinkPreviews(articleRef);

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
    <WikiOSLayout>
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
                <p className="mt-4 text-sm text-zinc-400">Loading article...</p>
              </div>
            )}
            {error && !data && (
              <div className="wikios-error glass-hierarchy-child rounded-lg p-6">
                <h2 className="mb-2 text-lg font-semibold text-red-400">Article not found</h2>
                <p className="text-sm text-zinc-400">
                  The page &ldquo;{title}&rdquo; does not exist on IxWiki.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleEnterEdit("source")}
                    className="wikios-action-btn cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
                  >
                    Create this page
                  </button>
                </div>
              </div>
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
                authorInfo={
                  data.authorInfo
                    ? {
                        creator:
                          "creator" in data.authorInfo
                            ? data.authorInfo.creator ?? null
                            : (data.authorInfo as { author?: string | null }).author ?? null,
                        creatorAvatar:
                          "creatorAvatar" in data.authorInfo
                            ? (data.authorInfo as { creatorAvatar?: string | null }).creatorAvatar ?? null
                            : null,
                        createdAt:
                          "createdAt" in data.authorInfo
                            ? data.authorInfo.createdAt ?? null
                            : (data.authorInfo as { createdTimestamp?: string | null })
                                .createdTimestamp ?? null,
                        lastEditor: data.authorInfo.lastEditor ?? null,
                        lastEditorAvatar:
                          "lastEditorAvatar" in data.authorInfo
                            ? (data.authorInfo as { lastEditorAvatar?: string | null }).lastEditorAvatar ?? null
                            : null,
                        lastEditedAt:
                          "lastEditedAt" in data.authorInfo
                            ? data.authorInfo.lastEditedAt ?? null
                            : (data.authorInfo as { lastModifiedTimestamp?: string | null })
                                .lastModifiedTimestamp ?? null,
                      }
                    : null
                }
              />
            )}
          </>
        )}
      </div>
      {previewPortal}
    </WikiOSLayout>
  );
}
