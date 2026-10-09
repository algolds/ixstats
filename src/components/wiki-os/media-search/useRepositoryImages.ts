"use client";
/**
 * useRepositoryImages: the one results accumulator behind the image repository page and the picker's repository tab.
 *
 * Commons results are pages of `commons.search` (a category is a `deepcat:` filter on the same search, so browsing and
 * searching are one query). Each page is its own cached query keyed by its offset; a new term starts again from the
 * first page, so nothing is reset by hand. The wiki sources (IxWiki, IIWiki, the old forum's images, the signed-in
 * user's own uploads) page the same way through `wikios.repositoryFiles`, each page keyed by its cursor, and are
 * filtered by file type here. Forum and own uploads list newest first, so they need no query.
 */

import { useCallback, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import {
  commonsMimeTerm,
  dedupeImages,
  matchesImageFilters,
  wikiFilesToImages,
  type CommonsImage,
  type ImageTypeFilter,
  type WikiSubSource,
} from "./types";

export type RepositorySource = "commons" | WikiSubSource;
export type RepositoryMode = "idle" | "search" | "browse";

export interface RepositoryImagesInput {
  source: RepositorySource;
  /** Already debounced by the caller. */
  query: string;
  /** Commons only: categories that limit the search (`deepcat:`). */
  categories: string[];
  browsingCategory: string | null;
  /** Commons: part of the search term. Wiki: filtered here. */
  fileType: ImageTypeFilter;
  enabled: boolean;
  /** Whether a user is signed in: "My uploads" is only listed for one. */
  signedIn: boolean;
  /** Results per page. */
  pageSize?: number;
}

export interface RepositoryImages {
  images: CommonsImage[];
  mode: RepositoryMode;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  totalHits: number | null;
  error: { rateLimited: boolean } | null;
  retry: () => void;
}

export const REPOSITORY_PAGE_SIZE = 40;
/** The shortest query that is searched. */
export const MIN_REPOSITORY_QUERY_LENGTH = 2;
const STALE_TIME_MS = 60_000;

type Slice = Omit<RepositoryImages, "mode">;

const EMPTY: Slice = {
  images: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  loadMore: () => undefined,
  totalHits: null,
  error: null,
  retry: () => undefined,
};

/** The `deepcat:` terms of the categories (each once), the file type, then the typed query. */
function buildCommonsTerm(
  categories: string[],
  browsingCategory: string | null,
  fileType: ImageTypeFilter,
  query: string
): string {
  const all = [...categories, browsingCategory].filter((c): c is string => !!c);
  const deepcats = [...new Set(all)].map((c) => `deepcat:"${c.replace(/"/g, "")}"`);
  return [...deepcats, commonsMimeTerm(fileType), query].filter(Boolean).join(" ");
}

function useCommonsPages(term: string, active: boolean, pageSize: number): Slice {
  const [paging, setPaging] = useState<{ term: string; offsets: number[] }>({
    term: "",
    offsets: [0],
  });
  const offsets = useMemo(() => (paging.term === term ? paging.offsets : [0]), [paging, term]);

  const pages = api.useQueries((t) =>
    active
      ? offsets.map((offset) =>
          t.commons.search(
            { query: term, limit: pageSize, offset },
            { staleTime: STALE_TIME_MS, retry: false }
          )
        )
      : []
  );

  const images = pages.reduce<CommonsImage[]>(
    (merged, page) => dedupeImages(merged, page.data?.images ?? []),
    []
  );
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
    images,
    isLoading: active && !!pages[0]?.isPending,
    isLoadingMore: active && pages.length > 1 && !!last?.isFetching,
    hasMore: active && nextOffset !== null && !last?.isFetching,
    loadMore,
    totalHits: pages[0]?.data?.totalHits ?? null,
    error: failed ? { rateLimited: failed.error?.data?.code === "TOO_MANY_REQUESTS" } : null,
    retry,
  };
}

/** Wiki sources send a category; the forum and a user's own uploads have none. */
function takesCategory(source: WikiSubSource): boolean {
  return source === "ixwiki" || source === "iiwiki";
}

function useWikiPages(
  source: WikiSubSource,
  query: string,
  category: string | null,
  fileType: ImageTypeFilter,
  active: boolean,
  pageSize: number
): Slice {
  const key = `${source}\u0000${query}\u0000${category ?? ""}`;
  const [paging, setPaging] = useState<{ key: string; cursors: (string | null)[] }>({
    key: "",
    cursors: [null],
  });
  const cursors = useMemo(() => (paging.key === key ? paging.cursors : [null]), [paging, key]);

  const pages = api.useQueries((t) =>
    active
      ? cursors.map((cursor) =>
          t.wikios.repositoryFiles(
            {
              source,
              query: query || undefined,
              category: takesCategory(source) ? (category ?? undefined) : undefined,
              cursor,
              limit: pageSize,
            },
            { staleTime: STALE_TIME_MS, retry: false }
          )
        )
      : []
  );

  const images = pages
    .reduce<CommonsImage[]>(
      (merged, page) => dedupeImages(merged, wikiFilesToImages(page.data?.files ?? [], source)),
      []
    )
    .filter((img) => matchesImageFilters(img, fileType, "all"));
  const last = pages[pages.length - 1];
  const nextCursor = last?.data?.nextCursor ?? null;
  const failed = pages.find((page) => page.isError);

  const loadMore = useCallback(() => {
    if (nextCursor === null || cursors.includes(nextCursor)) return;
    setPaging({ key, cursors: [...cursors, nextCursor] });
  }, [nextCursor, cursors, key]);

  const retry = () => {
    for (const page of pages) if (page.isError) void page.refetch();
  };

  return {
    ...EMPTY,
    images,
    isLoading: active && !!pages[0]?.isPending,
    isLoadingMore: active && pages.length > 1 && !!last?.isFetching,
    hasMore: active && nextCursor !== null && !last?.isFetching,
    loadMore,
    error: failed ? { rateLimited: failed.error?.data?.code === "TOO_MANY_REQUESTS" } : null,
    retry,
  };
}

export function useRepositoryImages(input: RepositoryImagesInput): RepositoryImages {
  const { source, categories, browsingCategory, fileType, enabled, signedIn, pageSize } = input;
  const size = pageSize ?? REPOSITORY_PAGE_SIZE;
  const trimmed = input.query.trim();
  const searching = trimmed.length >= MIN_REPOSITORY_QUERY_LENGTH;
  const query = searching ? trimmed : "";
  const isCommons = source === "commons";
  // Forum and own uploads list newest first with no query; a category belongs only to Commons and the two wikis.
  const isListing = source === "forum" || source === "mine";
  const wikiCategory = isListing ? null : browsingCategory;
  const hasCategory = isListing ? false : categories.length > 0 || !!browsingCategory;
  const mode: RepositoryMode = searching ? "search" : isListing || hasCategory ? "browse" : "idle";
  const canList = enabled && (source !== "mine" || signedIn);
  const active = canList && mode !== "idle";

  const commons = useCommonsPages(
    buildCommonsTerm(categories, browsingCategory, fileType, query),
    active && isCommons,
    size
  );
  const wiki = useWikiPages(
    isCommons ? "ixwiki" : source,
    query,
    wikiCategory,
    fileType,
    active && !isCommons,
    size
  );

  return { ...(isCommons ? commons : wiki), mode };
}
