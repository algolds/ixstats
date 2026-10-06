"use client";

import { useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { stripBasePath } from "~/lib/base-path";
import { articleHtmlInput, type WikiSource } from "~/lib/wiki-os/config";
import { resolveWikiPath } from "~/lib/wiki-os/wiki-path";

const PREFETCH_DEBOUNCE_MS = 50;
const prefetchedSet = new Set<string>();

/**
 * Hook for speculative prefetching of WikiOS articles on link hover, touch,
 * and idle viewport inspection.
 */
export function useWikiPrefetch() {
  const utils = api.useUtils();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Warm the article `title` (canonical, as the reader asks for it) of `source`. */
  const prefetchArticle = useCallback(
    async (title: string, prefetchWikitext = false, source: WikiSource = "ixwiki") => {
      if (!title) return;

      const cacheKey = `${source}:${title.toLowerCase()}`;
      if (prefetchedSet.has(cacheKey)) {
        return;
      }
      prefetchedSet.add(cacheKey);

      try {
        // Warm up tRPC / React Query cache directly, under the reader's key for this wiki
        await utils.wikios.getArticleHtml.prefetch(articleHtmlInput(title, source), {
          staleTime: 10 * 60 * 1000,
        });

        // The editor's wikitext exists only for IxWiki pages
        if (prefetchWikitext && source === "ixwiki") {
          await utils.wikios.getWikitext.prefetch({ title }, { staleTime: 10 * 60 * 1000 });
        }
      } catch {
        // Prefetch is speculative and best-effort; silently ignore errors
      }
    },
    [utils]
  );

  const handlePointerEnter = useCallback(
    (e: Event) => {
      const target = (e.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
      if (!target?.href) return;

      try {
        const url = new URL(target.href, window.location.origin);
        // Any /wiki/<path>, subpages included: the route's own parser says whether it is an article's
        // read view (not a tool, a Special: page, ?action=edit or another view) and under which title.
        const path = stripBasePath(url.pathname).match(/^\/wiki\/(.+)$/)?.[1];
        const page = path ? resolveWikiPath(path.split("/"), url.searchParams) : null;
        if (page?.kind === "article" && page.view.type === "read") {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            void prefetchArticle(page.canon.title, false, page.source);
          }, PREFETCH_DEBOUNCE_MS);
        }
      } catch {
        // Ignore invalid URLs
      }
    },
    [prefetchArticle]
  );

  const handlePointerLeave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Attach global passive listeners for instant hover prefetching
  useEffect(() => {
    const root = document.body;
    root.addEventListener("mouseover", handlePointerEnter, { passive: true });
    root.addEventListener("touchstart", handlePointerEnter, { passive: true });
    root.addEventListener("mouseout", handlePointerLeave, { passive: true });

    return () => {
      root.removeEventListener("mouseover", handlePointerEnter);
      root.removeEventListener("touchstart", handlePointerEnter);
      root.removeEventListener("mouseout", handlePointerLeave);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handlePointerEnter, handlePointerLeave]);

  return { prefetchArticle };
}
