/**
 * edit-service.ts — the one path a wikitext save takes, whoever asks (the editor's `saveWikitext`
 * and the `api.php` `action=edit`).
 *
 * `assertCanEditArticle` is the permission gate (blocked? namespace? protection? the right?),
 * `commitWikitextSave` the write: PostgreSQL first (`ArticleRepository.saveArticle`: article, an
 * append-only revision, its MediaWiki mirror job in the same transaction, render queued), then the
 * edge-cache purge. The edit-conflict check is part of the write (`WikitextSave.expectedHeadRef`).
 */

import { TRPCError } from "@trpc/server";
import { ArticleRepository } from "../core";
import { canonicalizeTitle } from "../core/title";
import { CloudflareGuardian } from "../guardian/cloudflare-guardian";
import { isWikiAdmin, resolveWikiUsername, type WikiAuthContext } from "../auth";
import { authorizeAction } from "../permissions";

/**
 * The refusal for saving over a deleted (archived) page. Its old revisions stay in the table and the
 * history readers do not hide them by deletion date, so a save must not quietly republish them: an
 * administrator restores the page first.
 */
export const deletedPage = () =>
  new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "This page was deleted; ask an administrator to restore it",
  });

/**
 * Throws FORBIDDEN unless the caller may edit `title` (or create it, when it does not exist): not
 * blocked, allowed in its namespace, past its protection, and holding the right (see
 * `authorizeAction`). A deleted (archived) page counts as missing for those checks, as in MediaWiki,
 * but cannot be saved over (PRECONDITION_FAILED).
 */
export async function assertCanEditArticle(
  ctx: WikiAuthContext,
  title: string,
  realm = "ixwiki"
): Promise<void> {
  const existing = await ArticleRepository.findBySlug(title, realm, { includeArchived: true });
  const archived = existing?.status === "ARCHIVED";
  await authorizeAction(ctx, existing && !archived ? "edit" : "create", title, realm);
  if (archived) throw deletedPage();
}

/**
 * The wikitext a revert or rollback may save over `title`, from the revision it restores. Throws
 * when the revision is parked (a MediaWiki edit that conflicted with the page's text and never went
 * live: it was never the page, so there is nothing to go back to), when the text was never imported
 * (a placeholder must not blank the page), when the revision belongs to another page, or when it
 * would blank a page that has text (admins may). Text that is only whitespace counts as blank on
 * both sides.
 */
export async function requireRestorableWikitext(
  ctx: WikiAuthContext,
  title: string,
  revision: { wikitext: string | null; title: string; parked: boolean }
): Promise<string> {
  const { wikitext } = revision;
  if (revision.parked) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "That revision never went live (a MediaWiki edit that conflicted with the page's text), so it cannot be restored.",
    });
  }
  if (wikitext === null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This revision's text has not been imported yet.",
    });
  }
  if (canonicalizeTitle(revision.title)?.title !== title) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That revision belongs to a different page.",
    });
  }
  if (wikitext.trim() === "" && !(await isWikiAdmin(ctx))) {
    const current = await ArticleRepository.findBySlug(title);
    if ((current?.wikitext ?? "").trim() !== "") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Restoring this revision would blank the page. Only administrators can do that.",
      });
    }
  }
  return wikitext;
}

export interface WikitextSave {
  /** Canonical title. */
  title: string;
  wikitext: string;
  summary: string;
  minor: boolean;
  /**
   * The revision the author based the text on (`toRevisionRef`), or null for a page the author believes does not
   * exist yet. The save throws `EditConflictError` unless it is still the page's latest live revision: checked inside
   * the save's transaction, so two saves with the same base cannot both succeed. Omitted: no check.
   */
  expectedHeadRef?: string | null;
}

/**
 * Save `save.wikitext` as a new revision of `save.title`, authored as the caller (the caller has
 * been authorized): PostgreSQL first (the revision and its mirror job in one transaction,
 * `ArticleRepository.saveArticle`, which also makes the edit-conflict check of `save.expectedHeadRef`),
 * then the edge-cache purge. Throws `EditConflictError` for a save based on a revision that is no longer the head.
 */
export async function commitWikitextSave(ctx: WikiAuthContext, save: WikitextSave) {
  const { title, wikitext, summary, minor, expectedHeadRef } = save;
  const authorName = resolveWikiUsername(ctx) ?? "Community Contributor";

  // 1. Primary Save: Direct to PostgreSQL
  const saveResult = await ArticleRepository.saveArticle(
    { slug: title, title, wikitext, editSummary: summary, minor, expectedHeadRef },
    ctx.auth?.userId ?? undefined,
    authorName
  );

  // 2. Edge cache purge (the save queued its own MediaWiki mirror job in its transaction)
  void CloudflareGuardian.purgeArticleEdgeCache(title);

  return saveResult;
}
