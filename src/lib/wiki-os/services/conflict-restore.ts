/**
 * "Restore my text": an author whose text a collision overwrote brings it back with one click, from the notice's diff.
 * The text is saved as a new edit on the page's current head, through the one save path (`commitWikitextSave`: the
 * permission gate, the edit-conflict check, the mirror job), so nothing in either wiki's history is rewritten and the
 * overwritten revision stays as it was.
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
import { isRevisionRef, parseRevisionRef, toRevisionRef } from "../core/domain-types";
import { EditConflictError, type EditConflict } from "../core/edit-conflict-error";
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
  articleId: string;
  title: string;
  revision: StoredRevision;
}

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
  if (revision.authorId && ids.includes(revision.authorId)) return true;
  // a WikiOS save's name is a passport handle, not a classic name anyone claims; a hidden editor is nobody's
  if (revision.origin !== "classic" || revision.userDeleted || !revision.author) return false;
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
        select: { id: true, title: true },
      })
    : null;
  const revision = article ? await findRevision(article.id, input.ref) : null;
  if (!article || !revision) {
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
  return { articleId: article.id, title: article.title, revision };
}

/** The page's head now, as a save names its base (null: no live revision). */
async function currentHeadRef(articleId: string): Promise<string | null> {
  const head = await db.wikiRevision.findFirst({
    where: { articleId, parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, mwRevId: true },
  });
  return head ? toRevisionRef(head) : null;
}

/**
 * Brings the caller's overwritten text back as a new edit on the page's head, with the summary naming the conflict.
 * A save that lands between reading the head and writing returns the edit conflict (the page as it is now), and
 * nothing is saved.
 */
export async function restoreOverwrittenText(
  ctx: WikiAuthContext,
  input: OverwrittenRef
): Promise<RestoreOverwrittenResult> {
  const { articleId, title, revision } = await findRestorable(ctx, input);
  await assertCanEditArticle(ctx, title);
  const wikitext = await requireRestorableWikitext(ctx, title, {
    wikitext: revision.wikitext,
    title,
  });
  try {
    const saved = await commitWikitextSave(ctx, {
      title,
      wikitext,
      summary: `Restored my text replaced in conflict ${shortConflictId(input.conflictId)}`,
      minor: false,
      expectedHeadRef: await currentHeadRef(articleId),
    });
    return { success: true, revisionId: saved.revisionId };
  } catch (error) {
    if (error instanceof EditConflictError) {
      return { success: false, editConflict: true, ...error.conflict };
    }
    throw error;
  }
}

/** Whether the caller may restore `input.ref` (the diff view shows "Restore my text" only then). */
export async function overwrittenRestorable(
  ctx: WikiAuthContext,
  input: OverwrittenRef
): Promise<boolean> {
  try {
    await findRestorable(ctx, input);
    return true;
  } catch (error) {
    if (error instanceof TRPCError) return false;
    throw error;
  }
}
