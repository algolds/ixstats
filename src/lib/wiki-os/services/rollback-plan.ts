/**
 * What a rollback undoes, and where it takes the page, from the page's live revisions newest first (pure; the editor's
 * `rollback` and api.php's `action=rollback` both read it).
 *
 * A rollback undoes the consecutive edits of the page's last editor. WikiOS's own conflict writes (`isSystemRevision`)
 * are nobody's edit, so they are never the last editor. A trail dummy edit (the head's text again, no change) is
 * passed over: it never ends the run, and the revision below it has its text anyway. A talk note changes the text, and
 * that text must not be lost: the first note met, inside the run or below it, is where the page goes back to.
 */

/** Revisions read when looking for the last edit by someone else. */
export const ROLLBACK_WINDOW = 50;

/** The refusal of a rollback whose target's text is the page's text already (the save would be a null edit). */
export const NOTHING_TO_ROLL_BACK =
  "There is nothing to roll back: the page already has that text.";

/** A revision as a rollback reads it. */
export interface RollbackCandidate {
  /** The author's name; edits by the same name are one editor's. */
  user: string | null;
  /** One of WikiOS's own conflict writes. */
  systemWrite: boolean;
  /** Whether it changed the page's text: a talk note does, a trail dummy edit does not. */
  changedText: boolean;
}

export interface RollbackPlan<T> {
  /** The newest edit by a person: its author's consecutive edits are what the rollback undoes. */
  lastEdit: T;
  /** The revision whose text the page goes back to; null when nothing older is by anyone else. */
  target: T | null;
}

/** The plan for `newestFirst` (the page's live revisions, newest first); null when none of them is a person's. */
export function planRollback<T extends RollbackCandidate>(
  newestFirst: readonly T[]
): RollbackPlan<T> | null {
  const start = newestFirst.findIndex((revision) => !revision.systemWrite);
  if (start < 0) return null;
  const lastEdit = newestFirst[start]!;
  // a trail is passed over; a talk note, or another editor's edit, ends the run and is where the page goes back to
  const target = newestFirst
    .slice(start + 1)
    .find((revision) =>
      revision.systemWrite ? revision.changedText : revision.user !== lastEdit.user
    );
  return { lastEdit, target: target ?? null };
}
