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

const RESERVED_TOOL_PAGES: Record<string, string> = {
  categories: "/wiki/categories",
  "category-index": "/wiki/categories",
  "categories-index": "/wiki/categories",
  contributions: "/wiki/contributions",
  utilities: "/wiki/utilities",
  templates: "/wiki/templates",
  "template-palette": "/wiki/templates",
  diff: "/wiki/diff",
  "diff-viewer": "/wiki/diff",
  watchlist: "/stashes",
  random: "/wiki/random",
  randompage: "/wiki/random",
  search: "/wiki/search",
  "recent-changes": "/wiki/recent-changes",
  recentchanges: "/wiki/recent-changes",
  repository: "/wiki/repository",
  whatlinkshere: "/wiki/whatlinkshere",
  "what-links-here": "/wiki/whatlinkshere",
  lorewards: "/wiki/lorewards",
  specialpages: "/wiki/utilities",
  "special-pages": "/wiki/utilities",
};

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

  // Check URL search param for edit mode (e.g. ?action=edit)
  const isEditAction = searchParams.get("action") === "edit";
  const isMarginParam = searchParams.get("margin");
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
      router.replace(
        withBasePath(`/wiki/user/${encodeURIComponent(userName.replace(/ /g, "_"))}`)
      );
    } else if (/^Special:/i.test(title)) {
      const spec = title.replace(/^Special:/i, "").trim();
      const specLower = spec.toLowerCase();

      if (specLower === "specialpages" || specLower === "utilities") {
        router.replace(withBasePath("/wiki/utilities"));
      } else if (specLower === "recentchanges" || specLower === "recent-changes") {
        router.replace(withBasePath("/wiki/recent-changes"));
      } else if (specLower === "watchlist") {
        router.replace(withBasePath("/stashes"));
      } else if (specLower === "random" || specLower === "randompage") {
        router.replace(withBasePath("/wiki/random"));
      } else if (specLower === "categories" || specLower === "categorytree") {
        router.replace(withBasePath("/wiki/categories"));
      } else if (specLower === "search") {
        router.replace(withBasePath("/wiki/search"));
      } else if (specLower === "templates") {
        router.replace(withBasePath("/wiki/templates"));
      } else if (specLower === "diff") {
        router.replace(withBasePath("/wiki/diff"));
      } else if (specLower.startsWith("contributions")) {
        const user = spec.replace(/^contributions\/?/i, "").trim();
        router.replace(
          user
            ? withBasePath(`/wiki/contributions/${encodeURIComponent(user)}`)
            : withBasePath("/wiki/contributions")
        );
      } else if (specLower.startsWith("whatlinkshere")) {
        const target = spec.replace(/^whatlinkshere\/?/i, "").trim();
        router.replace(
          target
            ? withBasePath(`/wiki/whatlinkshere/${encodeURIComponent(target)}`)
            : withBasePath("/wiki/whatlinkshere")
        );
      } else {
        router.replace(withBasePath("/wiki/utilities"));
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

  // Fetch article HTML (strictly disabled on reserved tools, category routes, and special pages)
  const { data, isLoading, error, refetch } = api.wikios.getArticleHtml.useQuery(
    { title },
    {
      enabled: !!title && !isCategoryOrSpecialOrMain,
      staleTime: 10 * 60 * 1000,
      retry: false,
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
              <div className="wikios-error facet-hierarchy-child rounded-lg p-6">
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
                          typeof (data.authorInfo as any).creator === "object"
                            ? (data.authorInfo as any).creator?.username ?? null
                            : (data.authorInfo as any).creator ?? (data.authorInfo as any).author ?? null,
                        creatorAvatar:
                          (data.authorInfo as any).creator?.avatar ??
                          (data.authorInfo as any).creatorAvatar ??
                          null,
                        createdAt:
                          (data.authorInfo as any).createdAt ??
                          (data.authorInfo as any).creator?.timestamp ??
                          (data.authorInfo as any).createdTimestamp ??
                          null,
                        lastEditor:
                          typeof (data.authorInfo as any).lastEditor === "object"
                            ? (data.authorInfo as any).lastEditor?.username ?? null
                            : (data.authorInfo as any).lastEditor ?? null,
                        lastEditorAvatar:
                          (data.authorInfo as any).lastEditor?.avatar ??
                          (data.authorInfo as any).lastEditorAvatar ??
                          null,
                        lastEditedAt:
                          (data.authorInfo as any).lastEditedAt ??
                          (data.authorInfo as any).lastEditor?.timestamp ??
                          (data.authorInfo as any).lastModifiedTimestamp ??
                          null,
                        contributors:
                          (data.authorInfo as any).topContributors ??
                          (data.authorInfo as any).contributors ??
                          [],
                        totalContributors:
                          (data.authorInfo as any).totalContributors ??
                          ((data.authorInfo as any).topContributors?.length ?? 0),
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
