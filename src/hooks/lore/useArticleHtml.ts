"use client";

import { useEffect, useMemo } from "react";
import { getBasePath } from "~/lib/base-path";
import { linksUnderBasePath } from "~/lib/lore/piece-links";
import { articleHtmlInput, type WikiSource } from "~/lib/wiki-os/config";
import { isLeanResolvable, parseLeanMarker, resolveLeanHtml } from "~/lib/wiki-os/lean-article";
import { api } from "~/trpc/react";

/** As long as WikiOS keeps a finished article fresh. */
const ARTICLE_STALE_TIME_MS = 10 * 60 * 1000;

/**
 * A wiki page's article as WikiOS's reader gets it (`wikios.getArticleHtml`): for IxWiki the view bundle WikiOS
 * rendered and sanitized once per revision, for another wiki its own render, sanitized the same way. `markup` is that
 * HTML, untouched but for its root-relative links, which get the base path (`linksUnderBasePath`), ready for
 * `dangerouslySetInnerHTML` (one object per HTML string). Null while loading, on an error, or for an empty page.
 */
export function useArticleHtml(title: string, source: WikiSource, enabled = true) {
  const { data, isLoading, error, refetch } = api.wikios.getArticleHtml.useQuery(
    articleHtmlInput(title, source),
    { staleTime: ARTICLE_STALE_TIME_MS, retry: false, enabled }
  );

  // A lean answer cached by a WikiOS page load is a marker, not HTML: one this page cannot resolve is asked for again.
  const marker = data?.contentHtml;
  const unresolved = parseLeanMarker(marker) !== null && !isLeanResolvable(marker);
  useEffect(() => {
    if (unresolved) void refetch();
  }, [unresolved, refetch]);
  const html = unresolved ? null : resolveLeanHtml(marker);
  const markup = useMemo(
    () => (html ? { __html: linksUnderBasePath(html, getBasePath()) } : null),
    [html]
  );

  return { data, markup, isLoading: isLoading || unresolved, error };
}
