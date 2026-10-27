/**
 * edit-conflict.ts — has someone saved this page since the editor loaded it? (WK-2)
 *
 * An editor loads a page together with the reference of its latest revision (`revisionRef`, the
 * same reference history, diff and undo use) and sends it back as `baseRevisionRef` when it saves.
 * A save whose base is not the latest revision would overwrite an edit the author never saw.
 *
 * The save itself makes that check atomically (`ArticleRepository.saveArticle` with `expectedHeadRef`: under the
 * article's row lock, in the save's transaction, so two saves with the same base cannot both pass). The reading
 * check here, `detectEditConflict`, answers earlier and without a write: the bot API uses it to compare `baserevid` and
 * `basetimestamp` with the head before it builds the new text. The references that name a revision are in
 * edit-conflict-error.ts.
 */

import { ArticleRepository } from "./article-repository";
import { toRevisionRef } from "./domain-types";
import {
  headMatchesBase,
  revisionRefs,
  type EditConflict,
  type RevisionIdentity,
} from "./edit-conflict-error";

export { revisionRefs, type EditConflict };

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
  if (headMatchesBase(head, baseRevisionRef ?? null)) return null;
  const current = await ArticleRepository.findBySlug(title, source);
  return {
    currentWikitext: current?.wikitext ?? "",
    currentRevisionRef: head ? toRevisionRef(head) : null,
  };
}
