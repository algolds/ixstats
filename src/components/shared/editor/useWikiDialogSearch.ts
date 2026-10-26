"use client";
// src/components/shared/editor/useWikiDialogSearch.ts
// The composer wiki dialog's search across every wiki, and picking one of its results.

import { useCallback, useState } from "react";
import { useDebounce } from "~/hooks/useDebounce";
import { api } from "~/trpc/react";
import type { WikiSource } from "~/lib/wiki-os/config";

/** How long typing must pause before the dialog searches (each search asks every wiki). */
export const WIKI_DIALOG_SEARCH_DELAY = 300;
/** The search's own limit on a query (`wikios.search`). */
const MAX_QUERY_LENGTH = 200;

/** A search result across every wiki: the article and the wiki it is on. */
export interface WikiSearchResult {
  title: string;
  source: WikiSource;
}

interface WikiDialogSearchOptions {
  /** What is typed in the dialog's title field. */
  target: string;
  open: boolean;
  setTarget: (title: string) => void;
  setSource: (source: WikiSource) => void;
}

/**
 * Searches every wiki for the dialog's title once typing pauses (`WIKI_DIALOG_SEARCH_DELAY`), trimmed and clamped to
 * the search's limit, and never for one character or for the result just picked. `selectResult` puts a result's title
 * and wiki in the dialog, so it is inserted from its own wiki.
 */
export function useWikiDialogSearch({
  target,
  open,
  setTarget,
  setSource,
}: WikiDialogSearchOptions) {
  const [picked, setPicked] = useState<string | null>(null);
  const query = useDebounce(target.trim().slice(0, MAX_QUERY_LENGTH), WIKI_DIALOG_SEARCH_DELAY);
  const search = api.wikios.search.useQuery(
    { query, limit: 5, wikiSource: "all" },
    { enabled: open && query.length > 1 && query !== picked, staleTime: 10_000 }
  );
  const selectResult = useCallback(
    (result: WikiSearchResult) => {
      setPicked(result.title);
      setTarget(result.title);
      setSource(result.source);
    },
    [setTarget, setSource]
  );
  return { search, selectResult };
}
