"use client";
/**
 * useRepositoryImages: the one results accumulator behind the image repository page and the picker's repository tab.
 *
 * Commons results are pages of `commons.search` (a category is a `deepcat:` filter on the same search, so browsing and
 * searching are one query). Each page is its own cached query keyed by its offset; a new term starts again from the
 * first page, so nothing is reset by hand. IxWiki and IIWiki files come from one `wikios.searchFiles` call (capped at
 * 50, no paging yet) and are filtered by file type here.
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
  /** Commons results per page. */
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
  /** The wiki result reached its cap, so more files may exist. */
  truncated: boolean;
  error: { rateLimited: boolean } | null;
  retry: () => void;
}

export const REPOSITORY_PAGE_SIZE = 40;
/** The shortest query that is searched. */
export const MIN_REPOSITORY_QUERY_LENGTH = 2;
/** What `wikios.searchFiles` is asked for (its maximum). */
export const WIKI_FILE_LIMIT = 50;
const STALE_TIME_MS = 60_000;

type Slice = Omit<RepositoryImages, "mode">;

const EMPTY: Slice = {
  images: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  loadMore: () => undefined,
  totalHits: null,
  truncated: false,
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
    truncated: false,
    error: failed ? { rateLimited: failed.error?.data?.code === "TOO_MANY_REQUESTS" } : null,
    retry,
  };
}

function useWikiFiles(
  source: WikiSubSource,
  query: string,
  category: string | null,
  fileType: ImageTypeFilter,
  active: boolean
): Slice {
  const result = api.wikios.searchFiles.useQuery(
    {
      query: query || undefined,
      category: category ?? undefined,
      limit: WIKI_FILE_LIMIT,
      wiki: source,
    },
    { enabled: active, staleTime: STALE_TIME_MS, retry: false }
  );
  const data = result.data;
  const images = useMemo(
    () =>
      data
        ? wikiFilesToImages(data, source).filter((img) => matchesImageFilters(img, fileType, "all"))
        : [],
    [data, source, fileType]
  );

  return {
    ...EMPTY,
    images,
    isLoading: active && result.isPending,
    truncated: data?.length === WIKI_FILE_LIMIT,
    error: result.isError
      ? { rateLimited: result.error?.data?.code === "TOO_MANY_REQUESTS" }
      : null,
    retry: () => void result.refetch(),
  };
}

export function useRepositoryImages(input: RepositoryImagesInput): RepositoryImages {
  const { source, categories, browsingCategory, fileType, enabled, pageSize } = input;
  const trimmed = input.query.trim();
  const searching = trimmed.length >= MIN_REPOSITORY_QUERY_LENGTH;
  const query = searching ? trimmed : "";
  const hasCategory = categories.length > 0 || !!browsingCategory;
  const mode: RepositoryMode = searching ? "search" : hasCategory ? "browse" : "idle";
  const active = enabled && mode !== "idle";
  const isCommons = source === "commons";

  const commons = useCommonsPages(
    buildCommonsTerm(categories, browsingCategory, fileType, query),
    active && isCommons,
    pageSize ?? REPOSITORY_PAGE_SIZE
  );
  const wiki = useWikiFiles(
    isCommons ? "ixwiki" : source,
    query,
    browsingCategory,
    fileType,
    active && !isCommons
  );

  return { ...(isCommons ? commons : wiki), mode };
}
