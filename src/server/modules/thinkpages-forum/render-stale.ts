/**
 * Re-renders Canvas posts whose stored HTML is a fallback, from an older pipeline, or older than a template it uses
 * (spec §3). Driven from the forum side: WikiOS knows nothing about forum posts. Runs from the cron job
 * "forum-render-stale" in small batches so readers keep the shared MediaWiki engine.
 */
import type { PrismaClient } from "@prisma/client";
import { db as appDb } from "~/server/db";
import { FORUM_RENDERER_VERSION, renderViaWiki } from "./render";

const BATCH = 10;

export type StaleDb = Pick<PrismaClient, "forumPost" | "forumPostTemplate" | "$transaction">;

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
    const out = await renderViaWiki(post.contentWikitext ?? "", post.threadId);
    if (!out) {
      failed += 1;
      continue;
    }
    await db.$transaction(async (tx) => {
      await tx.forumPost.update({
        where: { id: post.id },
        data: {
          contentHtml: out.contentHtml,
          plainText: out.plainText,
          rendererVersion: out.rendererVersion,
          renderedAt: out.renderedAt,
        },
      });
      await tx.forumPostTemplate.deleteMany({ where: { postId: post.id } });
      if (out.templates.length > 0) {
        await tx.forumPostTemplate.createMany({
          data: out.templates.map((title) => ({ postId: post.id, title })),
          skipDuplicates: true,
        });
      }
    });
    rendered += 1;
  }
  return { rendered, failed };
}

export async function renderStaleForumPosts(): Promise<{ rendered: number; failed: number }> {
  return rerenderPosts(appDb, await staleForumPostIds(appDb, BATCH));
}
