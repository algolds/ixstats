/**
 * inbound-judge.ts — the conflict rule's verdict on a classic edit the inbound sync found colliding with WikiOS's head
 * (inbound-revision-sync.ts): what WikiOS holds against it is its head and the revisions since the edit's base, or, for
 * a page WikiOS deleted, that delete.
 *
 * WikiOS's own conflict writes (`isSystemWrite`: trail dummy edits, talk notes) never win or lose by time. They are never
 * the standing change nor in its branch, and a classic edit that meets nothing else since its base is no collision: it
 * is imported as the head over them, and they stay in the history (a talk note it leaves out of the page is owed again,
 * conflict-note-reopen.ts).
 */
import { decideCollision, type CollisionVerdict, type PageChange } from "./conflict-rule";
import {
  classicChangeOfRevision,
  isSystemWrite,
  wikiosBranchFrom,
  wikiosDeletion,
  wikiosHead,
} from "./conflict-sides";
import type { MediaWikiRevision } from "./inbound-mediawiki";

const SOURCE = "ixwiki";

/**
 * collision: the rule's verdict; none: WikiOS holds nothing to judge against; past-system-writes: since the edit's base
 * WikiOS has only its own conflict writes. `skipped`: WikiOS's own conflict writes since the base, which the edit did not
 * build on (a talk note among them is owed again when the edit becomes the head).
 */
export type InboundJudgement =
  | { kind: "collision"; verdict: CollisionVerdict; skipped: PageChange[] }
  | { kind: "none" }
  | { kind: "past-system-writes"; skipped: PageChange[] };

export interface ClassicEditToJudge {
  articleId: string;
  /** The article is deleted in WikiOS. */
  archived: boolean;
  rev: MediaWikiRevision;
  /** `rev_sha1` of the edit's parent, when fetched. */
  parentSha1: string | null;
  /** When the edit counts, if not at its own save time (a restore that brought it back). */
  effectiveAt: Date | undefined;
}

/** The classic edit against `standing` and WikiOS's changes since the base (`standingBranch`). */
async function verdictOf(
  edit: ClassicEditToJudge,
  standing: PageChange,
  standingBranch: PageChange[],
  skipped: PageChange[]
): Promise<InboundJudgement> {
  const incoming = await classicChangeOfRevision(edit.rev, edit.effectiveAt);
  const verdict = decideCollision(SOURCE, edit.articleId, {
    incoming,
    standing,
    incomingBranch: [incoming],
    standingBranch,
  });
  return { kind: "collision", verdict, skipped };
}

/**
 * The rule's verdict on a classic edit against what WikiOS holds: the page's delete when WikiOS deleted it, else its
 * newest person's revision and the people's revisions since the edit's base (see the header for WikiOS's own writes).
 */
export async function judgeClassicEdit(edit: ClassicEditToJudge): Promise<InboundJudgement> {
  const deletion = edit.archived ? await wikiosDeletion(edit.articleId) : null;
  if (deletion) return verdictOf(edit, deletion, [deletion], []);
  const { based, changes } = await wikiosBranchFrom(
    edit.articleId,
    edit.rev.parentid,
    edit.parentSha1
  );
  const people = changes.filter((change) => !isSystemWrite(change.author));
  const skipped = changes.filter((change) => isSystemWrite(change.author));
  if (based && skipped.length > 0 && people.length === 0) {
    return { kind: "past-system-writes", skipped };
  }
  const standing = await wikiosHead(edit.articleId);
  return standing ? verdictOf(edit, standing, people, skipped) : { kind: "none" };
}
