/**
 * "Restore my text": an author whose text a collision overwrote brings it back with one click, from the notice's diff.
 * The text is saved as a new edit through the one save path (`commitWikitextSave`: the permission gate, the
 * edit-conflict check, the mirror job), so nothing in either wiki's history is rewritten and the overwritten revision
 * stays as it was. It is saved on the page the conflict left (`baseOf`: its trail, else its winner): if anyone edited
 * since, the author gets the edit conflict and edits the page by hand, so a later edit is never replaced unseen.
 *
 * Who may restore what is read from the conflict row: the ref must be one of the text revisions the row lists as
 * overwritten (never judged by a revision's park reason, which can name a later winner than the row's), WikiOS must have
 * its text, and the caller must have written it: as the account that saved it, or, for a classic edit, as the holder of
 * the approved claim of the name it was saved under. A deletion, move or restore that lost is done again on the page,
 * not here.
 */
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { ownerOfName } from "~/lib/identity/wiki-names";
import { requireWikiUserIds, type WikiAuthContext } from "../auth";
import { isRevisionRef, parseRevisionRef } from "../core/domain-types";
import { EditConflictError, headMatchesBase, type EditConflict } from "../core/edit-conflict-error";
import { canonicalizeTitle, type CanonicalTitle } from "../core/title";
import { articleHref } from "../wiki-path";
import { shortConflictId, toConflictEntry, type ConflictLogEntry } from "./conflict-log";
import { conflictRefOf } from "./conflict-sides";
import {
  assertCanEditArticle,
  commitWikitextSave,
  requireRestorableWikitext,
} from "./edit-service";

export interface OverwrittenRef {
  conflictId: string;
  /** The overwritten revision: its ref in the conflict row, or its MediaWiki id once the mirror stamped it. */
  ref: string;
}

/**
 * What the diff view offers: the one-click restore while the page is as the conflict left it; once someone edited
 * since, a link to edit the page by hand (stale); nothing when the viewer may not restore that text.
 */
export type RestoreOffer =
  { state: "restorable" | "stale"; editHref: string } | { state: "unavailable" };

export type RestoreOverwrittenResult =
  { success: true; revisionId: string } | ({ success: false; editConflict: true } & EditConflict);

const REVISION_SELECT = {
  id: true,
  mwRevId: true,
  origin: true,
  authorId: true,
  author: true,
  userDeleted: true,
  textDeleted: true,
  wikitext: true,
} as const;

interface StoredRevision {
  id: string;
  mwRevId: number | null;
  origin: string;
  authorId: string | null;
  author: string | null;
  userDeleted: boolean;
  textDeleted: boolean;
  wikitext: string | null;
}

interface Restorable {
  entry: ConflictLogEntry;
  articleId: string;
  canon: CanonicalTitle;
  /** The page's text now. */
  pageText: string;
  revision: StoredRevision;
}

/** A restore that passed every check: what it saves, where, and on top of what. */
interface CheckedRestore {
  entry: ConflictLogEntry;
  articleId: string;
  canon: CanonicalTitle;
  wikitext: string;
}

const UNAVAILABLE: RestoreOffer = { state: "unavailable" };

const refused = (code: TRPCError["code"], message: string) => new TRPCError({ code, message });

async function loadEntry(conflictId: string): Promise<ConflictLogEntry> {
  const row = await db.wikiConflict.findUnique({ where: { id: conflictId } });
  if (!row) throw refused("NOT_FOUND", "That conflict is not in the log.");
  return toConflictEntry(row);
}

/** The page's revision `ref` names (by row id or MediaWiki id); null when WikiOS has none. */
async function findRevision(articleId: string, ref: string): Promise<StoredRevision | null> {
  if (!isRevisionRef(ref)) return null;
  return db.wikiRevision.findFirst({
    where: { articleId, ...parseRevisionRef(ref) },
    select: REVISION_SELECT,
  });
}

/** Whether the caller wrote `revision`: its account, or the approved claim of the classic name it was saved under. */
async function isAuthor(ctx: WikiAuthContext, revision: StoredRevision): Promise<boolean> {
  const ids = requireWikiUserIds(ctx);
  // an editor MediaWiki hides is nobody's, by account or by claim
  if (revision.userDeleted) return false;
  if (revision.authorId && ids.includes(revision.authorId)) return true;
  // a WikiOS save's name is a passport handle, not a classic name anyone claims
  if (revision.origin !== "classic" || !revision.author) return false;
  const owner = await ownerOfName(db, "ixwiki", revision.author);
  return ids.some((id) => id === owner);
}

/**
 * The text `input.ref` names, once every check passed: a text revision the row lists as overwritten, which WikiOS has,
 * written by the caller. Throws the refusal otherwise.
 */
async function findRestorable(ctx: WikiAuthContext, input: OverwrittenRef): Promise<Restorable> {
  const entry = await loadEntry(input.conflictId);
  const listed = entry.overwritten.find((change) => change.ref === input.ref);
  if (listed && listed.action !== "edit") {
    throw refused(
      "BAD_REQUEST",
      `Only overwritten text can be restored here; do the ${listed.action} again on the page.`
    );
  }
  const article = entry.articleId
    ? await db.wikiArticle.findUnique({
        where: { id: entry.articleId },
        select: { id: true, title: true, wikitext: true },
      })
    : null;
  const canon = article ? canonicalizeTitle(article.title) : null;
  const revision = article ? await findRevision(article.id, input.ref) : null;
  if (!article || !canon || !revision) {
    throw listed
      ? refused(
          "PRECONDITION_FAILED",
          "WikiOS does not have this text yet, so it cannot restore it."
        )
      : refused("BAD_REQUEST", "That revision is not one this conflict overwrote.");
  }
  const ref = conflictRefOf(revision);
  // (a deletion, move or restore is named by its log entry, never by a revision's ref)
  if (!entry.overwritten.some((change) => change.ref === ref)) {
    throw refused("BAD_REQUEST", "That revision is not one this conflict overwrote.");
  }
  if (!(await isAuthor(ctx, revision))) {
    throw refused("FORBIDDEN", "Only the author of that text can restore it.");
  }
  if (revision.textDeleted) {
    throw refused("PRECONDITION_FAILED", "That text is hidden, so it cannot be restored.");
  }
  return { entry, articleId: article.id, canon, pageText: article.wikitext, revision };
}

/**
 * Every check a restore passes, the save's own included: the text (`findRestorable`), the caller's right to edit the
 * page, text a save may put back, and text that is not the page's already (that would be an empty edit).
 */
async function checkRestore(ctx: WikiAuthContext, input: OverwrittenRef): Promise<CheckedRestore> {
  const { entry, articleId, canon, pageText, revision } = await findRestorable(ctx, input);
  await assertCanEditArticle(ctx, canon.title);
  const wikitext = await requireRestorableWikitext(ctx, canon.title, {
    wikitext: revision.wikitext,
    title: canon.title,
  });
  if (wikitext === pageText) {
    throw refused("PRECONDITION_FAILED", "That text is the page's text already.");
  }
  return { entry, articleId, canon, wikitext };
}

/** The page the conflict left: its trail revision once written (a `log:` entry is no revision), else its winner. */
export function baseOf(entry: Pick<ConflictLogEntry, "trailRevisionId" | "winner">): string {
  const trail = entry.trailRevisionId;
  return trail && !trail.startsWith("log:") ? trail : entry.winner.ref;
}

/**
 * Brings the caller's overwritten text back as a new edit on the page the conflict left (`baseOf`), with the summary
 * naming the conflict. A page edited since returns the edit conflict (the page as it is now), and nothing is saved.
 */
export async function restoreOverwrittenText(
  ctx: WikiAuthContext,
  input: OverwrittenRef
): Promise<RestoreOverwrittenResult> {
  const { entry, canon, wikitext } = await checkRestore(ctx, input);
  try {
    const saved = await commitWikitextSave(ctx, {
      title: canon.title,
      wikitext,
      summary: `Restored my text replaced in conflict ${shortConflictId(input.conflictId)}`,
      minor: false,
      expectedHeadRef: baseOf(entry),
    });
    return { success: true, revisionId: saved.revisionId };
  } catch (error) {
    if (error instanceof EditConflictError) {
      return { success: false, editConflict: true, ...error.conflict };
    }
    throw error;
  }
}

/** The page's head now (null: no live revision). */
function liveHead(articleId: string) {
  return db.wikiRevision.findFirst({
    where: { articleId, parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, mwRevId: true },
  });
}

/**
 * What the diff view offers the caller for `input.ref` (see `RestoreOffer`). A signed-out visitor is offered nothing,
 * before anything is read.
 */
export async function overwrittenRestorable(
  ctx: WikiAuthContext,
  input: OverwrittenRef
): Promise<RestoreOffer> {
  if (!(ctx.user?.id ?? ctx.auth?.userId)) return UNAVAILABLE;
  let checked: CheckedRestore;
  try {
    checked = await checkRestore(ctx, input);
  } catch (error) {
    if (error instanceof TRPCError) return UNAVAILABLE;
    throw error;
  }
  const head = await liveHead(checked.articleId);
  return {
    state: headMatchesBase(head, baseOf(checked.entry)) ? "restorable" : "stale",
    editHref: articleHref(checked.canon, { action: "edit" }),
  };
}
