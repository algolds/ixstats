/**
 * page-list-service.ts — the lists MediaWiki shows under `Special:AllPages` and
 * `Special:PrefixIndex`, and the pages of the sitemap: published IxWiki pages of one namespace in
 * title order, from a cursor.
 */

import { db } from "~/server/db";
import { NAMESPACE_CANONICAL_NAMES } from "./title";

export interface ListPagesInput {
  /** Namespace id (0 = main). */
  namespace: number;
  /** Only pages whose name (without the namespace prefix) starts with this. */
  prefix: string;
  /** Start at this name (without the namespace prefix), inclusive. */
  from: string;
  limit: number;
}

export interface ListedPage {
  /** The full title, namespace prefix included. */
  title: string;
  isRedirect: boolean;
}

export interface PageListing {
  pages: ListedPage[];
  /** The name (without namespace prefix) the next page of the list starts at, or null at the end. */
  next: string | null;
}

/** How a namespace's pages are stored: "Talk:" for namespace 1, "" for the main namespace. */
function storedPrefix(namespace: number): string {
  const name = NAMESPACE_CANONICAL_NAMES[namespace];
  return name ? `${name}:` : "";
}

/** One page of the pages of a namespace, in title order (`limit` of them, and where the next page starts). */
export async function listPages(input: ListPagesInput): Promise<PageListing> {
  const stored = storedPrefix(input.namespace);
  const rows = await db.wikiArticle.findMany({
    where: {
      source: "ixwiki",
      status: "PUBLISHED",
      namespace: input.namespace,
      title: {
        ...(input.prefix ? { startsWith: stored + input.prefix } : {}),
        ...(input.from ? { gte: stored + input.from } : {}),
      },
    },
    orderBy: { title: "asc" },
    take: input.limit + 1,
    select: { title: true, redirectTargetSlug: true },
  });

  const pages = rows
    .slice(0, input.limit)
    .map((row) => ({ title: row.title, isRedirect: row.redirectTargetSlug !== null }));
  const after = rows[input.limit];
  return { pages, next: after ? after.title.slice(stored.length) : null };
}
