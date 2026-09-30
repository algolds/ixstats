/**
 * edit-conflict.ts — has someone saved this page since the editor loaded it? (WK-2)
 *
 * An editor loads a page together with the reference of its latest revision (`revisionRef`, the
 * same reference history, diff and undo use) and sends it back as `baseRevisionRef` when it saves.
 * A save whose base is not the latest revision would overwrite an edit the author never saw.
 * The check reads first and saves after, so two saves within the same few milliseconds can still
 * both pass; it stops the ordinary case of a page edited while somebody else had it open.
 */

import { ArticleRepository } from "./article-repository";
import { toRevisionRef } from "./domain-types";

/** The reference of the latest revision of `title`, or null when the page has no revision. */
export async function getHeadRevisionRef(title: string, source = "ixwiki"): Promise<string | null> {
  const [head] = await ArticleRepository.getHistory(title, source, 1);
  return head ? toRevisionRef(head) : null;
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
  const head = await getHeadRevisionRef(title, source);
  if ((baseRevisionRef ?? null) === head) return null;
  const current = await ArticleRepository.findBySlug(title, source);
  return { currentWikitext: current?.wikitext ?? "", currentRevisionRef: head };
}
