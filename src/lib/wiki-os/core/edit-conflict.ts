/**
 * edit-conflict.ts — has someone saved this page since the editor loaded it? (WK-2)
 *
 * An editor loads a page together with the reference of its latest revision (`revisionRef`, the
 * same reference history, diff and undo use) and sends it back as `baseRevisionRef` when it saves.
 * A save whose base is not the latest revision would overwrite an edit the author never saw.
 *
 * A revision has two references: the row id, and the MediaWiki rev_id once the export worker has
 * stamped the row. `toRevisionRef` switches from the first to the second at that moment, so a
 * revision the editor loaded by its row id is still the head after the stamp. Both count as the
 * head here. The check reads first and saves after, so two saves within the same few milliseconds
 * can still both pass; it stops the ordinary case of a page edited while somebody else had it open.
 */

import { ArticleRepository } from "./article-repository";
import { toRevisionRef } from "./domain-types";

interface RevisionIdentity {
  id: string;
  mwRevId?: number | null;
}

/** Every reference that names this revision: its row id and, once stamped, its MediaWiki rev_id. */
export function revisionRefs(revision: RevisionIdentity): string[] {
  return revision.mwRevId ? [revision.id, String(revision.mwRevId)] : [revision.id];
}

/** The latest revision of `title`, or null when the page has no revision. */
async function getHeadRevision(title: string, source: string): Promise<RevisionIdentity | null> {
  const [head] = await ArticleRepository.getHistory(title, source, 1);
  return head ?? null;
}

/** The latest revision of `title`: its current reference and every reference that names it. */
export interface HeadRevision {
  revisionRef: string;
  revisionRefs: string[];
}

export async function getHeadRevisionRefs(
  title: string,
  source = "ixwiki"
): Promise<HeadRevision | null> {
  const head = await getHeadRevision(title, source);
  return head ? { revisionRef: toRevisionRef(head), revisionRefs: revisionRefs(head) } : null;
}

export interface EditConflict {
  /** The page as it is now. */
  currentWikitext: string;
  /** The reference to send as `baseRevisionRef` to save on top of the current version. */
  currentRevisionRef: string | null;
}

/**
 * The conflict a save based on `baseRevisionRef` would cause, or null when the page is still at
 * that revision. No base means the editor believes the page does not exist yet: that conflicts
 * with a page created in the meantime, and only with that.
 */
export async function detectEditConflict(
  title: string,
  baseRevisionRef: string | undefined,
  source = "ixwiki"
): Promise<EditConflict | null> {
  const head = await getHeadRevision(title, source);
  const matches =
    head === null
      ? baseRevisionRef === undefined
      : baseRevisionRef !== undefined && revisionRefs(head).includes(baseRevisionRef);
  if (matches) return null;
  const current = await ArticleRepository.findBySlug(title, source);
  return {
    currentWikitext: current?.wikitext ?? "",
    currentRevisionRef: head ? toRevisionRef(head) : null,
  };
}
