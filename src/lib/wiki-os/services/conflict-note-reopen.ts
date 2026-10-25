/**
 * conflict-note-reopen.ts — a talk note a classic edit left out of the page. Someone who saved the talk page on classic
 * from a version before WikiOS's note never saw the note: the inbound sync imports their edit as the head (a note wins or
 * loses nothing by time, inbound-judge.ts) and the note stays in the page's history. Its notice is then owed again, so
 * the settler (conflict-notices.ts) appends the note to the new head on its next run. A note whose section the new text
 * still holds was seen, and is not owed again.
 */
import { db } from "~/server/db";
import { canonicalizeTitle } from "../core/title";
import { noticeRecipients, type PageChange } from "./conflict-rule";
import { reopenNotice, toConflictEntry } from "./conflict-log";
import { conflictOfNote } from "./conflict-notice-copy";
import { isSystemRevision, talkPageTitle } from "./conflict-sides";

const SOURCE = "ixwiki";

/**
 * What a note added after its parent's text; empty when it added nothing (a trail dummy edit keeps the text as it was)
 * or did not extend its parent.
 */
function appendedSection(text: string, parentText: string): string {
  const before = parentText.trimEnd();
  return text.startsWith(before) ? text.slice(before.length).trim() : "";
}

/** The note `ref` names, with the section it appended; null for a revision that is no system write naming a conflict. */
async function noteOf(
  ref: string
): Promise<{ id: string; conflictId: string; section: string } | null> {
  const row = await db.wikiRevision.findUnique({
    where: { id: ref },
    select: {
      id: true,
      origin: true,
      author: true,
      authorId: true,
      summary: true,
      wikitext: true,
      parentRevisionId: true,
    },
  });
  const conflictId = row && isSystemRevision(row) ? conflictOfNote(row.summary) : null;
  if (!row || !conflictId) return null;
  const parent = row.parentRevisionId
    ? await db.wikiRevision.findUnique({
        where: { id: row.parentRevisionId },
        select: { wikitext: true },
      })
    : null;
  // empty for a revision that appended nothing: every text holds it, so nothing is owed for it
  return { id: row.id, conflictId, section: appendedSection(row.wikitext, parent?.wikitext ?? "") };
}

/** The recipients of conflict `conflictId` told by a note on the talk page `title`. */
async function recipientsTalkedTo(
  conflictId: string,
  noteId: string,
  title: string
): Promise<string[]> {
  const row = await db.wikiConflict.findUnique({ where: { id: conflictId } });
  // a trail on a talk page names its conflict too: it is no note
  if (!row || row.trailRevisionId === noteId) return [];
  // (a recipient never told on a talk page has no mark there to take back)
  return noticeRecipients(toConflictEntry(row).overwritten).flatMap((recipient) => {
    const talk = canonicalizeTitle(talkPageTitle(recipient) ?? "", { source: SOURCE });
    return talk?.title === title ? [recipient.key] : [];
  });
}

/**
 * After a classic edit of the talk page `title` became its head over WikiOS's own writes (`skipped`, which it did not
 * build on), each note among them whose section `headText` does not hold is owed again: its recipient's talk-page mark
 * is taken back (`reopenNotice`). Resolves to how many notices are owed again.
 */
export async function reopenSkippedNotes(
  title: string,
  skipped: readonly PageChange[],
  headText: string
): Promise<number> {
  let reopened = 0;
  for (const change of skipped) {
    const note = await noteOf(change.ref);
    if (!note || headText.includes(note.section)) continue;
    for (const key of await recipientsTalkedTo(note.conflictId, note.id, title)) {
      if (await reopenNotice(note.conflictId, key, "talk-page")) reopened += 1;
    }
  }
  return reopened;
}
