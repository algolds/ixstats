/**
 * purge-service.ts — `action=purge`: make a page's rendering new again.
 *
 * A purge marks the stored rendering stale (`htmlSyncedAt` = null: readers keep the old bundle until
 * the render replaces it), forgets what the caches hold about the page and queues a render, which
 * is single-flight and capped by the render service. Nothing about the page's text changes.
 */

import { db } from "~/server/db";
import { enqueueRender } from "./render-service";
import { evictWikiTitleCaches } from "./title-cache-eviction";

export async function purgeArticle(article: { id: string; title: string }): Promise<void> {
  await db.wikiArticle.update({
    where: { id: article.id },
    data: { htmlSyncedAt: null },
    select: { id: true },
  });
  await evictWikiTitleCaches(article.title, "ixwiki", article.id);
  enqueueRender(article.id);
}
