"use client";
// src/components/shared/editor/useWikiDialogQueries.ts
// What the composer's wiki dialog asks the wikis: its search across every wiki and its embed preview, once typing
// pauses; and picking a search result.

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "~/hooks/useDebounce";
import { api } from "~/trpc/react";
import type { WikiSource } from "~/lib/wiki-os/config";
import { pickableEmbedImages } from "~/lib/wiki-os/embed-image";

/** How long typing must pause before the dialog asks the wikis (a search asks every wiki). */
export const WIKI_DIALOG_SEARCH_DELAY = 300;
/** The search's own limit on a query (`wikios.search`). */
const MAX_QUERY_LENGTH = 200;
const PREVIEW_STALE_TIME = 30_000;

/** A search result across every wiki: the article and the wiki it is on. */
export interface WikiSearchResult {
  title: string;
  source: WikiSource;
}

interface WikiDialogQueriesOptions {
  /** What is typed in the dialog's title field. */
  target: string;
  /** The dialog's wiki (the embed preview reads the title there). */
  source: WikiSource;
  open: boolean;
  /** Whether the dialog inserts an embed card (only then is a preview asked for). */
  embed: boolean;
  setTarget: (title: string) => void;
  setSource: (source: WikiSource) => void;
  /** Sets the image the embed card will carry (as stored), or "" for none. */
  setImage: (url: string) => void;
}

/**
 * The dialog's queries, all on `title`, the typed title trimmed once typing pauses (`WIKI_DIALOG_SEARCH_DELAY`), so
 * no keystroke reaches a wiki:
 *  - the search across every wiki, clamped to the search's limit, never for one character or for the result just
 *    picked (`selectResult`; the pick is forgotten when the title moves off it or the dialog closes);
 *  - in embed mode, the preview's intro and images on the dialog's wiki; the first image a card can show is picked.
 */
export function useWikiDialogQueries({
  target,
  source,
  open,
  embed,
  setTarget,
  setSource,
  setImage,
}: WikiDialogQueriesOptions) {
  const [picked, setPicked] = useState<string | null>(null);
  // The pick only holds while the title is still it, in the open dialog (state adjusted while rendering).
  if (picked !== null && (!open || target.trim() !== picked)) setPicked(null);

  const title = useDebounce(target.trim(), WIKI_DIALOG_SEARCH_DELAY);
  const query = title.slice(0, MAX_QUERY_LENGTH);
  const search = api.wikios.search.useQuery(
    { query, limit: 5, wikiSource: "all" },
    { enabled: open && query.length > 1 && query !== picked, staleTime: 10_000 }
  );

  const preview = { enabled: open && embed && title !== "", staleTime: PREVIEW_STALE_TIME };
  const intro = api.wikios.getIntro.useQuery({ title, wiki: source }, preview);
  const images = api.wikios.getPageImages.useQuery({ title, wiki: source }, preview);

  useEffect(() => {
    setImage(pickableEmbedImages(images.data, source)[0]?.stored ?? "");
  }, [images.data, source, setImage]);

  const selectResult = useCallback(
    (result: WikiSearchResult) => {
      setPicked(result.title);
      setTarget(result.title);
      setSource(result.source);
    },
    [setTarget, setSource]
  );
  return { search, selectResult, title, intro, images };
}
