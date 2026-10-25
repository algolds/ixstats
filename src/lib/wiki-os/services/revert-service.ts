/**
 * Revert and rollback: an older revision's text saved again as a new edit, through the one save path
 * (`commitWikitextSave`: the mirror job, the edge purge), on top of the head they read (`expectedHeadRef`). An edit that
 * lands between that read and the save makes the save an edit conflict, answered with the page as it is now, and nothing
 * is saved: a revert never replaces an edit nobody looked at.
 *
 * Rollback undoes the consecutive edits of the page's last editor among its live revisions only (an overwritten one is
 * history, never the head), reading WikiOS's own conflict writes as nobody's edit (`planRollback`). An overwritten
 * revision keeps its text, so a revert may still bring it back.
 */
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import {
  getArticleHistoryShadow,
  getRevisionWikitextShadow,
  type HistoryRevision,
} from "../adapters/mediawiki/article-store";
import { ArticleRepository } from "../core";
import { parseRevisionRef, toRevisionRef } from "../core/domain-types";
import type { WikiAuthContext } from "../auth";
import { authorizeAction } from "../permissions";
import { CONFLICT_NOTICE_AUTHOR, isSystemRevision } from "./conflict-sides";
import {
  assertCanEditArticle,
  deletedPage,
  requireRestorableWikitext,
  saveOrConflict,
  type CheckedSaveOutcome,
} from "./edit-service";
import { planRollback } from "./rollback-plan";

const SOURCE = "ixwiki";

/** Revisions read when looking for the last edit by someone else. */
const ROLLBACK_WINDOW = 50;

export type RevertResult =
  | { success: true; title: string; revisionId: string }
  | Extract<CheckedSaveOutcome, { success: false }>;

const precondition = (message: string) => new TRPCError({ code: "PRECONDITION_FAILED", message });

/** The page's head now, as a ref (`toRevisionRef`); null when it has no live revision. */
async function liveHeadRef(title: string): Promise<string | null> {
  const { revisions } = await getArticleHistoryShadow(title, 1);
  return revisions[0]?.revid ?? null;
}

/** Saves `wikitext` as a new edit of `title` on top of `headRef`, the head the caller read. */
async function saveOnHead(
  ctx: WikiAuthContext,
  save: { title: string; wikitext: string; summary: string; headRef: string | null }
): Promise<RevertResult> {
  const { title, wikitext, summary, headRef } = save;
  const outcome = await saveOrConflict(ctx, {
    title,
    wikitext,
    summary,
    minor: false,
    expectedHeadRef: headRef,
  });
  return outcome.success ? { ...outcome, title } : outcome;
}

/** Brings the text of revision `input.revid` back as a new edit of `title`, on top of the head read now. */
export async function revertPage(
  ctx: WikiAuthContext,
  input: { title: string; revid: string; summary?: string }
): Promise<RevertResult> {
  const { title, revid } = input;
  await assertCanEditArticle(ctx, title);
  const oldRev = await getRevisionWikitextShadow(revid);
  if (!oldRev) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Revision ${revid} not found.` });
  }
  const wikitext = await requireRestorableWikitext(ctx, title, oldRev);
  return saveOnHead(ctx, {
    title,
    wikitext,
    summary: input.summary || `Reverted to revision ${revid} via WikiOS`,
    headRef: await liveHeadRef(title),
  });
}

/**
 * The refs, of `revisions`, that are WikiOS's own conflict writes (`isSystemRevision`). Only a revision under
 * `CONFLICT_NOTICE_AUTHOR`'s name can be one, so the table is asked about those alone, and not at all without any.
 */
async function systemWriteRefs(revisions: readonly HistoryRevision[]): Promise<Set<string>> {
  const named = revisions.filter((revision) => revision.user === CONFLICT_NOTICE_AUTHOR);
  if (named.length === 0) return new Set();
  const rows = await db.wikiRevision.findMany({
    where: { source: SOURCE, OR: named.map((revision) => parseRevisionRef(revision.revid)) },
    select: { id: true, mwRevId: true, origin: true, authorId: true, author: true },
  });
  return new Set(rows.filter(isSystemRevision).map(toRevisionRef));
}

/**
 * Undoes the consecutive edits of `title`'s last editor (`planRollback`): the text of the revision before them is saved
 * as a new edit, on top of the head the history was read at. Refuses a page with nothing older by anyone else (a
 * single revision included).
 */
export async function rollbackPage(ctx: WikiAuthContext, title: string): Promise<RevertResult> {
  await authorizeAction(ctx, "rollback", title);
  const current = await ArticleRepository.findBySlug(title, SOURCE, { includeArchived: true });
  if (current?.status === "ARCHIVED") throw deletedPage();

  // the live revisions only: an overwritten one is never the head, nor the last editor
  const { revisions } = await getArticleHistoryShadow(title, ROLLBACK_WINDOW);
  const system = await systemWriteRefs(revisions);
  const plan = planRollback(
    revisions.map((revision) => ({ ...revision, systemWrite: system.has(revision.revid) }))
  );
  if (!plan?.target) {
    throw precondition("All revisions are by the same user, so there is nothing to roll back to.");
  }

  const oldContent = await getRevisionWikitextShadow(plan.target.revid);
  if (!oldContent) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "The revision to roll back to could not be found.",
    });
  }
  return saveOnHead(ctx, {
    title,
    wikitext: await requireRestorableWikitext(ctx, title, oldContent),
    summary: `Rolled back edits by ${plan.lastEdit.user} to revision ${plan.target.revid}`,
    headRef: revisions[0]!.revid,
  });
}
