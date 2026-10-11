/**
 * Re-renders Canvas posts whose stored HTML is a fallback, from an older pipeline, or older than a template it uses
 * (spec §3). Driven from the forum side: WikiOS knows nothing about forum posts. Runs from the cron job
 * "forum-render-stale" in small batches so readers keep the shared MediaWiki engine.
 */
import type { PrismaClient } from "@prisma/client";
import { db as appDb } from "~/server/db";
import { withMentionLinks } from "./mention-links";
import { FORUM_RENDERER_VERSION, renderViaWiki } from "./render";
import { writeTemplates } from "./writes-body";

const BATCH = 10;

/** A post whose render failed is left alone for this long before the cron tries it again. */
const RETRY_AFTER_MS = 30 * 60_000;
/** More failed posts than this are not remembered (the oldest go first), so the extra rows the query reads stay few. */
const MAX_REMEMBERED = 200;

// ponytail: kept in process memory. A restart forgets it and the failing posts head the queue again for one run; a
// `renderAttemptedAt` column that the query orders by is the upgrade if restarts ever make that matter.
const failedAt = new Map<string, number>();

export function resetRenderFailuresForTests(): void {
  failedAt.clear();
}

function rememberFailure(id: string): void {
  failedAt.delete(id);
  failedAt.set(id, Date.now());
  if (failedAt.size > MAX_REMEMBERED) failedAt.delete(failedAt.keys().next().value!);
}

/** The posts that failed too recently to try again, forgetting the ones whose wait is over. */
function recentlyFailed(): Set<string> {
  const since = Date.now() - RETRY_AFTER_MS;
  for (const [id, at] of failedAt) if (at <= since) failedAt.delete(id);
  return new Set(failedAt.keys());
}

export type StaleDb = Pick<
  PrismaClient,
  "forumPost" | "forumPostTemplate" | "$transaction" | "user" | "thinkpagesAccount"
>;

export async function staleForumPostIds(
  db: Pick<PrismaClient, "$queryRaw">,
  limit: number
): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id FROM forum_posts p
    WHERE p."contentWikitext" IS NOT NULL AND p.hidden = false AND (
      p."renderedAt" IS NULL
      OR p."rendererVersion" IS DISTINCT FROM ${FORUM_RENDERER_VERSION}
      OR EXISTS (
        SELECT 1 FROM forum_post_templates t
        WHERE t."postId" = p.id AND (
          EXISTS (SELECT 1 FROM wiki_mirror_jobs j WHERE j.kind = 'revision' AND j.state = 'done' AND j.title = t.title AND j."updatedAt" > p."renderedAt")
          OR EXISTS (SELECT 1 FROM wiki_articles a WHERE a.title = t.title AND a."lastMwSyncAt" > p."renderedAt")
        )
      )
    )
    ORDER BY p."renderedAt" ASC NULLS FIRST
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

export async function rerenderPosts(
  db: StaleDb,
  ids: string[]
): Promise<{ rendered: number; failed: number }> {
  const posts = await db.forumPost.findMany({
    where: { id: { in: ids }, contentWikitext: { not: null } },
    select: { id: true, threadId: true, contentWikitext: true },
  });
  let rendered = 0;
  let failed = 0;
  for (const post of posts) {
    const source = post.contentWikitext ?? "";
    const out = await renderViaWiki(source, post.threadId);
    if (!out) {
      failed += 1;
      rememberFailure(post.id);
      continue;
    }
    failedAt.delete(post.id);
    // The renderer knows nothing of members: the mention links are added to every render, as at save.
    const { contentHtml } = await withMentionLinks(db, {
      contentHtml: out.contentHtml,
      contentWikitext: source,
    });
    // Written only if the author has not edited the post since it was read: an edit has its own fresh render.
    const written = await db.$transaction(async (tx) => {
      const { count } = await tx.forumPost.updateMany({
        where: { id: post.id, contentWikitext: source },
        data: {
          contentHtml,
          plainText: out.plainText,
          rendererVersion: out.rendererVersion,
          renderedAt: out.renderedAt,
        },
      });
      if (count === 0) return false;
      await writeTemplates(tx, post.id, out.templates, true);
      return true;
    });
    if (written) rendered += 1;
  }
  return { rendered, failed };
}

/**
 * The next posts to re-render: the stalest first, without the ones that failed a moment ago. Those sort first (they
 * never got a `renderedAt`), so the query reads one extra row for each of them, and ten posts that always fail
 * cannot keep newer ones from being reached.
 */
export async function nextStaleBatch(db: Pick<PrismaClient, "$queryRaw">): Promise<string[]> {
  const skip = recentlyFailed();
  const ids = await staleForumPostIds(db, BATCH + skip.size);
  return ids.filter((id) => !skip.has(id)).slice(0, BATCH);
}

export async function renderStaleForumPosts(): Promise<{ rendered: number; failed: number }> {
  return rerenderPosts(appDb, await nextStaleBatch(appDb));
}
