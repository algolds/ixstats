/**
 * trail-revision.ts — the dummy edit that carries the trail of a conflict classic MediaWiki won (`ArticleRepository.
 * recordTrailRevision`). A system write: it never goes through `saveArticle`, so the null-edit skip, the permission
 * gate and the wiki-save rate limit never apply to it.
 */

import { db } from "~/server/db";
import { lockPageForSave, SAVE_TRANSACTION } from "./page-lock";
import { retryableWhenBusy } from "./page-busy-error";
import { mwSha1Base36 } from "../xml/sha1";
import { enqueueRevisionJob, scheduleMirrorKick } from "../services/mirror-outbox";
import { setTrailRevision } from "../services/conflict-log";
import { CONFLICT_NOTICE_AUTHOR } from "../services/conflict-sides";

/** Thrown inside the trail's transaction when another writer claimed the conflict's trail first: rolls it back. */
class TrailTaken extends Error {}

export interface TrailRevisionInput {
  articleId: string;
  /** The trail: `trailSummary` of the conflict. */
  summary: string;
  conflictId: string;
}

/**
 * The trail of a conflict classic MediaWiki won: a revision with the head's text (parented on the head, byte delta 0),
 * by `CONFLICT_NOTICE_AUTHOR`, and its mirror job, so the trail reaches both wikis. Made under the page's lock, and it
 * claims the conflict's trail in the same transaction: null when the conflict already has one or the page is deleted
 * (read under the lock; the caller settles the row without a trail either way). A system write: no
 * permission check, no rate limit, never skipped as a null edit; the text does not change, so no render and no watchers.
 */
export async function recordTrailRevision(
  input: TrailRevisionInput
): Promise<{ revisionId: string } | null> {
  const recorded = await db
    .$transaction(async (tx) => {
      const article = await tx.wikiArticle.findUnique({
        where: { id: input.articleId },
        select: { id: true, title: true, source: true },
      });
      if (!article) throw new Error(`No article ${input.articleId} to record a trail on`);
      await lockPageForSave(tx, article.source, article.title);
      // a page deleted before the lock takes no trail: its mirror job would bring the page back on classic
      const live = await tx.wikiArticle.findUnique({
        where: { id: article.id },
        select: { status: true },
      });
      if (live?.status === "ARCHIVED") return null;
      const conflict = await tx.wikiConflict.findUnique({
        where: { id: input.conflictId },
        select: { trailRevisionId: true },
      });
      if (conflict?.trailRevisionId) return null;
      const head = await tx.wikiRevision.findFirst({
        where: { articleId: article.id, parked: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, wikitext: true },
      });
      if (!head) throw new Error(`"${article.title}" has no revision to record a trail on`);
      const byteSize = Buffer.byteLength(head.wikitext, "utf8");
      const revision = await tx.wikiRevision.create({
        data: {
          articleId: article.id,
          wikitext: head.wikitext,
          summary: input.summary,
          minor: true,
          source: article.source,
          author: CONFLICT_NOTICE_AUTHOR,
          authorId: null,
          parentRevisionId: head.id,
          byteSize,
          byteDelta: 0,
          sha1: mwSha1Base36(head.wikitext),
        },
        select: { id: true },
      });
      if (!(await setTrailRevision(tx, input.conflictId, revision.id))) throw new TrailTaken();
      await enqueueRevisionJob(tx, {
        title: article.title,
        articleId: article.id,
        revisionId: revision.id,
        source: article.source,
      });
      return { revisionId: revision.id };
    }, SAVE_TRANSACTION)
    .catch((error: Error) => {
      if (error instanceof TrailTaken) return null;
      return retryableWhenBusy(error);
    });
  if (recorded) scheduleMirrorKick();
  return recorded;
}
