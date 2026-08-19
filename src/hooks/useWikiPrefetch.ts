"use client";

import { useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { getCachedArticle } from "~/lib/wiki-os/wikios-cache";

const PREFETCH_DEBOUNCE_MS = 50;
const prefetchedSet = new Set<string>();

/**
 * Hook for speculative prefetching of WikiOS articles on link hover, touch,
 * and idle viewport inspection.
 */
export function useWikiPrefetch() {
  const utils = api.useUtils();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchArticle = useCallback(
    async (rawTitle: string, prefetchWikitext = false) => {
      const title = decodeURIComponent(rawTitle).trim().replace(/_/g, " ");
      if (!title || title.startsWith("Special:") || title.startsWith("Category:")) {
        return;
      }

      const cacheKey = title.toLowerCase();
      if (prefetchedSet.has(cacheKey)) {
        return;
      }
      prefetchedSet.add(cacheKey);

      try {
        // Check local IndexedDB/memory cache first
        const cached = await getCachedArticle(title);
        if (!cached) {
          // Warm up tRPC / React Query cache
          await utils.wikios.getArticleHtml.prefetch(
            { title },
            { staleTime: 10 * 60 * 1000 }
          );
        }

        if (prefetchWikitext) {
          await utils.wikios.getWikitext.prefetch(
            { title },
            { staleTime: 10 * 60 * 1000 }
          );
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
        // Match /wiki/[slug]
        const match = url.pathname.match(/^\/wiki\/([^/?#]+)$/);
        if (match && match[1]) {
          const rawSlug = match[1];
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            void prefetchArticle(rawSlug);
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
