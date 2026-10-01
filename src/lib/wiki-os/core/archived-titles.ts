/**
 * archived-titles.ts — which titles WikiOS has deleted (status ARCHIVED).
 *
 * The question asked by anything that holds live MediaWiki data, which still has a page WikiOS deleted:
 * the lore-card generator's lists and previews, the passport's discussion comments.
 */

import { db } from "~/server/db";
import { canonicalizeTitle } from "./title";

/** Titles per query, well under the database's bind-parameter limit. */
const CHUNK = 5_000;

/** The canonical titles among `rawTitles` that are deleted in `source`. */
export async function archivedTitlesAmong(
  rawTitles: readonly string[],
  source = "ixwiki"
): Promise<Set<string>> {
  const titles = [
    ...new Set(rawTitles.flatMap((raw) => canonicalizeTitle(raw, { source })?.title ?? [])),
  ];
  const hidden = new Set<string>();
  for (let start = 0; start < titles.length; start += CHUNK) {
    const rows = await db.wikiArticle.findMany({
      where: { source, status: "ARCHIVED", title: { in: titles.slice(start, start + CHUNK) } },
      select: { title: true },
    });
    for (const row of rows) hidden.add(row.title);
  }
  return hidden;
}

/** `rawTitles` without the pages WikiOS has deleted, in their order. */
export async function withoutArchivedTitles(
  rawTitles: string[],
  source = "ixwiki"
): Promise<string[]> {
  const hidden = await archivedTitlesAmong(rawTitles, source);
  if (hidden.size === 0) return rawTitles;
  return rawTitles.filter((raw) => !hidden.has(canonicalizeTitle(raw, { source })?.title ?? ""));
}
