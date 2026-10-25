/**
 * What a rollback undoes, and where it takes the page, from the page's live revisions newest first (pure; the editor's
 * `rollback` and api.php's `action=rollback` both read it).
 *
 * A rollback undoes the consecutive edits of the page's last editor. WikiOS's own conflict writes (a trail dummy edit,
 * a talk note: `isSystemRevision`) are nobody's edit: they are never the last editor, and one between that editor's
 * edits does not end the run. One below the run is where the page goes back to: a talk note's text is kept that way,
 * and a trail has its parent's text anyway.
 */

/** A revision as a rollback reads it. */
export interface RollbackCandidate {
  /** The author's name; edits by the same name are one editor's. */
  user: string | null;
  /** One of WikiOS's own conflict writes. */
  systemWrite: boolean;
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
  // the newest system write since the last editor's latest edit: the page's text just below the run, if it ends here
  let below: T | null = null;
  for (const revision of newestFirst.slice(start + 1)) {
    if (revision.systemWrite) {
      below ??= revision;
    } else if (revision.user !== lastEdit.user) {
      return { lastEdit, target: below ?? revision };
    } else {
      below = null;
    }
  }
  return { lastEdit, target: below };
}
