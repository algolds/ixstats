/**
 * edit-conflict-error.ts — the pure half of edit-conflict detection: what names a revision, whether a base names the
 * page's head, and the error a save throws when it does not.
 *
 * `ArticleRepository.saveArticle` makes the check inside its transaction, under the article's row lock, so it cannot
 * import the module that reads the repository (edit-conflict.ts); both import this one.
 */

/** What an editor needs after a conflict: the page as it is now, and the base to save on top of it. */
export interface EditConflict {
  /** The page as it is now. */
  currentWikitext: string;
  /** The reference to send as `baseRevisionRef` to save on top of the current version. */
  currentRevisionRef: string | null;
}

export interface RevisionIdentity {
  id: string;
  mwRevId?: number | null;
}

/**
 * A revision has two references: the row id, and the MediaWiki rev_id once the mirror (or the inbound sync) has stamped
 * the row. `toRevisionRef` switches from the first to the second at that moment, so a revision the editor loaded by its
 * row id is still the head after the stamp. Both count as the head.
 */
export function revisionRefs(revision: RevisionIdentity): string[] {
  return revision.mwRevId ? [revision.id, String(revision.mwRevId)] : [revision.id];
}

/**
 * Whether a save based on `base` is made on top of `head`, the page's latest live revision (null: the page has none).
 * No base (null) means the editor believes the page does not exist yet: that conflicts with a page created in the
 * meantime, and only with that.
 */
export function headMatchesBase(head: RevisionIdentity | null, base: string | null): boolean {
  return head === null ? base === null : base !== null && revisionRefs(head).includes(base);
}

/** Thrown by a save whose base is not the page's latest live revision (somebody saved since the editor loaded it). */
export class EditConflictError extends Error {
  constructor(readonly conflict: EditConflict) {
    super("Edit conflict: the page was changed since this edit was based on it");
    this.name = "EditConflictError";
  }
}
