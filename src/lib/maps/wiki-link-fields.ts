import type { WikiSource } from "~/lib/wiki-os/config";

export interface FeatureWikiInput {
  wikiPageTitle?: string | null;
  wikiSource?: WikiSource | string | null;
}

/**
 * Normalizes `(wikiPageTitle, wikiSource)` when creating a map feature.
 * Returns `{}` when neither field is provided so omitted optional fields stay omitted;
 * stamps `wikiSource` (`input.wikiSource ?? "ixwiki"`) whenever a non-empty `wikiPageTitle` is stored.
 */
export function normalizeFeatureWikiCreate(input: FeatureWikiInput): {
  wikiPageTitle?: string;
  wikiSource?: string | null;
} {
  const title = input.wikiPageTitle?.trim();
  if (!title) {
    return {
      ...(input.wikiPageTitle !== undefined ? { wikiPageTitle: undefined } : {}),
      ...(input.wikiSource !== undefined ? { wikiSource: null } : {}),
    };
  }
  return {
    wikiPageTitle: input.wikiPageTitle ?? undefined,
    wikiSource: input.wikiSource ?? "ixwiki",
  };
}

/**
 * Normalizes `(wikiPageTitle, wikiSource)` when updating a map feature.
 * Clearing `wikiPageTitle` (`null` or blank) always clears `wikiSource` (`null`).
 * Updating `wikiPageTitle` without supplying `wikiSource` preserves `existing.wikiSource`
 * when the title is unchanged, or defaults to `"ixwiki"` for a newly linked title.
 */
export function normalizeFeatureWikiUpdate(
  input: FeatureWikiInput,
  existing?: { wikiPageTitle?: string | null; wikiSource?: string | null } | null
): {
  wikiPageTitle?: string | null;
  wikiSource?: string | null;
} {
  if (input.wikiPageTitle === undefined && input.wikiSource === undefined) {
    return {};
  }
  if (input.wikiPageTitle !== undefined) {
    const trimmed = input.wikiPageTitle?.trim() ?? "";
    if (!trimmed) {
      return { wikiPageTitle: input.wikiPageTitle, wikiSource: null };
    }
    if (input.wikiSource !== undefined) {
      return { wikiPageTitle: input.wikiPageTitle, wikiSource: input.wikiSource ?? "ixwiki" };
    }
    const preserved =
      existing?.wikiPageTitle === input.wikiPageTitle ? existing.wikiSource : undefined;
    return {
      wikiPageTitle: input.wikiPageTitle,
      wikiSource: preserved ?? "ixwiki",
    };
  }
  const hasExistingTitle = Boolean(existing?.wikiPageTitle?.trim());
  return {
    wikiSource: hasExistingTitle ? (input.wikiSource ?? "ixwiki") : null,
  };
}
