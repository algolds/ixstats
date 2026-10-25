/**
 * visible-page.ts — the IxWiki page a title leads to for this reader: its title after redirects, and its wikitext.
 * For `wikios.checkPageExists` and for server modules that list wiki pages (a country's lore pieces).
 */

import type { WikiAuthContext } from "../auth";
import { resolveRedirect } from "../adapters/mediawiki/bridge";
import { getArticleWikitextShadow } from "../adapters/mediawiki/article-store";
import { canSeeTitle } from "../permissions";

export interface VisiblePage {
  /** The title after redirects. */
  resolvedTitle: string;
  /** The page's wikitext; null when there is no such page, or it is a deleted page this reader may not see. */
  wikitext: string | null;
}

export interface VisiblePageOptions {
  /**
   * Whether a deleted page counts for a reader who may see it (the default, as WikiOS's own title checks); false
   * treats it as missing for every reader, as a listing of live pages needs.
   */
  includeArchived?: boolean;
}

export async function readVisiblePage(
  ctx: WikiAuthContext,
  title: string,
  { includeArchived = true }: VisiblePageOptions = {}
): Promise<VisiblePage> {
  const { title: resolvedTitle } = await resolveRedirect(title);
  // A deleted page does not exist for a reader who may not see it.
  if (!(await canSeeTitle(ctx, resolvedTitle))) return { resolvedTitle, wikitext: null };
  const article = await getArticleWikitextShadow(resolvedTitle, "ixwiki", {
    includeArchived, // canSeeTitle above
  });
  return { resolvedTitle, wikitext: article?.wikitext ?? null };
}
