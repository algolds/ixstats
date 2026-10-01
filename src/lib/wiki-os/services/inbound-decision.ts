/**
 * inbound-decision.ts — what a MediaWiki edit means for WikiOS's copy of the page ("fast-forward or park").
 *
 * WikiOS is primary and classic MediaWiki stays editable in parallel, so an edit made there is only
 * taken as the page's next revision when its author started from the text WikiOS holds now:
 *   - echo: the text is WikiOS's own (the mirror's export coming back); nothing to import;
 *   - fast-forward: the edit's parent is WikiOS's head (by MediaWiki revision id, or because the parent
 *     has exactly WikiOS's text): import it as a normal revision;
 *   - park: anything else; the edit is kept in history as a non-current revision and WikiOS's head is
 *     pushed back to MediaWiki.
 * Pure: no database and no network, so every branch is a table test.
 */

import { mwSha1Base36 } from "../xml/sha1";

export type InboundDecision = "echo" | "fast-forward" | "park";

/** WikiOS's current revision of a page: the newest one that is not parked. */
export interface InboundHead {
  /** The MediaWiki revision id carrying this revision, once the mirror stamped it (or an import did). */
  mwRevId: number | null;
  /** `rev_sha1` of the revision's text; null on a row that predates the column. */
  sha1: string | null;
  /** The page's text now. */
  wikitext: string;
}

export interface InboundRevision {
  revid: number;
  /** 0 for the revision that created the page. */
  parentid: number;
  /** `rev_sha1` (base 36) of the revision's text. */
  sha1: string;
  /** Written by WikiOS's own mirror account: a WikiOS edit coming back, never news from MediaWiki. */
  byMirrorBot: boolean;
}

export interface InboundInput {
  /** null: the page does not exist in WikiOS yet (or has no revision). */
  head: InboundHead | null;
  rev: InboundRevision;
  /**
   * `rev_sha1` of MediaWiki revision `rev.parentid`, when the caller fetched it; null when it did not
   * (it is only needed when the parent is not WikiOS's head by id).
   */
  parentSha1: string | null;
}

/**
 * Every hash WikiOS's head text can have in MediaWiki: as stored, and with trailing whitespace cut off,
 * which MediaWiki's pre-save transform does to everything it saves (a textarea's final newline).
 */
function headHashes(head: InboundHead): Set<string> {
  return new Set([head.sha1 ?? mwSha1Base36(head.wikitext), mwSha1Base36(head.wikitext.trimEnd())]);
}

/** Whether a MediaWiki revision with hash `sha1` has WikiOS's head text. */
export function matchesHead(head: InboundHead, sha1: string): boolean {
  return headHashes(head).has(sha1);
}

export function decideInbound({ head, rev, parentSha1 }: InboundInput): InboundDecision {
  if (!head) return "fast-forward";
  if (rev.byMirrorBot || matchesHead(head, rev.sha1)) return "echo";

  if (head.mwRevId !== null && head.mwRevId === rev.parentid) return "fast-forward";
  // The author's base was a MediaWiki revision with exactly WikiOS's text, though not the one WikiOS
  // knows by id: a head the mirror never stamped, or the copy the mirror pushed back after a park.
  if (parentSha1 !== null && matchesHead(head, parentSha1)) return "fast-forward";
  return "park";
}
