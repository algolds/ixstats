/**
 * opensearch.ts — `action=opensearch` (plan 410): title suggestions in the OpenSearch array format
 * `[query, [titles], [descriptions], [urls]]`, which is the whole response (no object around it).
 */

import type { JsonValue } from "../format";
import { missingParam } from "../errors";
import type { ApiContext } from "../types";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

/** Suggestions per request (500 with apihighlimits), as MediaWiki's opensearch limit. */
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export async function runOpenSearch(rc: ApiContext): Promise<JsonValue[]> {
  const p = rc.params.scope("", "opensearch");
  const query = p.string("search");
  if (query === undefined) throw missingParam("search");
  const limit = p.integer("limit", {
    fallback: DEFAULT_LIMIT,
    min: 1,
    max: rc.highLimits ? 500 : MAX_LIMIT,
  });
  const { hits } = await rc.deps.search(query, "title", limit, 0);
  const titles = hits.map((hit) => hit.title);
  return [
    query,
    titles,
    // MediaWiki's descriptions are empty unless an extension fills them in.
    titles.map(() => ""),
    titles.map((title) => `${rc.deps.siteUrl}/wiki/${canonicalizeTitle(title)?.urlPath ?? encodeURIComponent(title)}`),
  ];
}
