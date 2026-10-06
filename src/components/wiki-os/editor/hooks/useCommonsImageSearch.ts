"use client";
/**
 * useCommonsImageSearch — the image picker's Commons tab (WK-6): pages of `commons.search` (the procedure the media
 * search's repository tab uses, behind its own `commons` rate-limit bucket) for a debounced query, with "load more".
 *
 * Each page is its own cached query (`offset` from the page before's `nextOffset`); a new query starts again from the
 * first page. A failed page is not retried on its own (a rate-limited search would only burn more of the bucket): the
 * tab offers a retry. Only images are listed (Commons also holds video, audio and PDFs), each with the author and
 * licence Commons gives, for the attribution the picker shows.
 */

import { useCallback, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { ImageResult } from "../ImageSearchGrid";

/** Results per page: what the repository tab asks for. */
export const COMMONS_PAGE_SIZE = 30;
/** The shortest query that is searched. */
export const MIN_COMMONS_QUERY_LENGTH = 2;
const STALE_TIME_MS = 60_000;

/** One file as `commons.search` returns it. */
export interface CommonsSearchImage {
  title: string;
  url: string;
  thumbUrl: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  artist: string;
  license: string;
}

const isHttps = (url: string | null | undefined): url is string =>
  !!url && /^https:\/\//i.test(url);

/** A Commons file as a picker result, or null when it is not an image (or has no https address). */
export function commonsImageToResult(image: CommonsSearchImage): ImageResult | null {
  if (!image.mime.startsWith("image/") || !isHttps(image.url)) return null;
  return {
    title: image.title,
    url: image.url,
    thumbUrl: isHttps(image.thumbUrl) ? image.thumbUrl : image.url,
    width: image.width || undefined,
    height: image.height || undefined,
    mime: image.mime,
    source: "commons",
    artist: image.artist || undefined,
    license: image.license || undefined,
    descriptionUrl: isHttps(image.descriptionUrl) ? image.descriptionUrl : undefined,
  };
}

/** The images of every page loaded, in order, each title once (an offset can shift between two pages). */
export function mergeCommonsPages(
  pages: ReadonlyArray<{ images: CommonsSearchImage[] } | undefined>
): ImageResult[] {
  const seen = new Set<string>();
  const results: ImageResult[] = [];
  for (const page of pages) {
    for (const image of page?.images ?? []) {
      if (seen.has(image.title)) continue;
      seen.add(image.title);
      const result = commonsImageToResult(image);
      if (result) results.push(result);
    }
  }
  return results;
}

export interface CommonsImageSearch {
  results: ImageResult[];
  /** The first page is on its way. */
  isLoading: boolean;
  /** A further page is on its way. */
  isLoadingMore: boolean;
  /** Commons has more results after the last page loaded. */
  hasMore: boolean;
  /** How many files Commons found, when it says. */
  totalHits: number | null;
  /** A page failed: `rateLimited` when the search bucket is spent. */
  error: { rateLimited: boolean } | null;
  loadMore: () => void;
  retry: () => void;
}

/** The Commons search for `query` while `enabled` (the Commons tab is open); nothing is fetched otherwise. */
export function useCommonsImageSearch(query: string, enabled: boolean): CommonsImageSearch {
  const term = query.trim();
  const active = enabled && term.length >= MIN_COMMONS_QUERY_LENGTH;
  const [paging, setPaging] = useState<{ term: string; offsets: number[] }>({
    term: "",
    offsets: [0],
  });
  const offsets = useMemo(() => (paging.term === term ? paging.offsets : [0]), [paging, term]);

  const pages = api.useQueries((t) =>
    active
      ? offsets.map((offset) =>
          t.commons.search(
            { query: term, limit: COMMONS_PAGE_SIZE, offset },
            { staleTime: STALE_TIME_MS, retry: false }
          )
        )
      : []
  );

  // A few pages of 30 at most: merged on each render, no memo needed
  const results = mergeCommonsPages(pages.map((page) => page.data));

  const last = pages[pages.length - 1];
  const nextOffset = last?.data?.nextOffset ?? null;
  const failed = pages.find((page) => page.isError);

  const loadMore = useCallback(() => {
    if (nextOffset === null || offsets.includes(nextOffset)) return;
    setPaging({ term, offsets: [...offsets, nextOffset] });
  }, [nextOffset, offsets, term]);

  const retry = () => {
    for (const page of pages) if (page.isError) void page.refetch();
  };

  return {
    results,
    isLoading: active && !!pages[0]?.isPending,
    isLoadingMore: active && pages.length > 1 && !!last?.isFetching,
    hasMore: active && nextOffset !== null && !last?.isFetching,
    totalHits: pages[0]?.data?.totalHits ?? null,
    error: failed ? { rateLimited: failed.error?.data?.code === "TOO_MANY_REQUESTS" } : null,
    loadMore,
    retry,
  };
}
