"use client";
// src/components/wiki-os/reader/useStatValues.ts
// The values of an article's stat placeholders ({{MyCountry:..}}, {{CountryData:..}}, ...), asked of
// `wikios.resolveWikiPlaceholders`, which takes at most STAT_CHUNK_SIZE keys per call. A page with
// more keys is asked in chunks, one query each, so no page can fail the lot by having too many.

import { useMemo } from "react";
import { api } from "~/trpc/react";
import type { DynamicStatData } from "./ArticlePlaceholders";

/** The server's limit on `placeholders` per call. */
export const STAT_CHUNK_SIZE = 200;
const STAT_STALE_TIME_MS = 5 * 60 * 1000;

/** `keys` without repeats, in order, in groups of at most `size`. */
export function chunkStatKeys(keys: readonly string[], size = STAT_CHUNK_SIZE): string[][] {
  const distinct = Array.from(new Set(keys));
  const chunks: string[][] = [];
  for (let start = 0; start < distinct.length; start += size) {
    chunks.push(distinct.slice(start, start + size));
  }
  return chunks;
}

type StatValues = Record<string, DynamicStatData>;

/** All chunks' values in one record; a chunk that failed or has not arrived adds nothing. */
function mergeStatResults(results: Array<{ data?: StatValues }>): StatValues {
  return Object.assign({}, ...results.map((result) => result.data ?? {}));
}

/** The values for `keys` (repeats ignored), by key; keys not resolved yet are absent. */
export function useStatValues(keys: readonly string[]): StatValues {
  const chunks = useMemo(() => chunkStatKeys(keys), [keys]);
  return api.useQueries(
    (t) =>
      chunks.map((placeholders) =>
        t.wikios.resolveWikiPlaceholders({ placeholders }, { staleTime: STAT_STALE_TIME_MS })
      ),
    { combine: mergeStatResults }
  );
}
