/**
 * talk.ts — the subject/talk pairing of MediaWiki namespaces.
 *
 * Every content namespace N (even id) has a talk namespace N + 1 (`Foo` and `Talk:Foo`, `User:Foo`
 * and `User talk:Foo`). `Special:` and `Media:` have none, and neither do namespaces whose +1 id
 * is not in `NAMESPACE_CANONICAL_NAMES` (`Topic:`). Both directions go through `canonicalizeTitle`,
 * so the counterpart is always a canonical title.
 */

import { canonicalizeTitle, NAMESPACE_CANONICAL_NAMES, type CanonicalTitle } from "./title";

/** Whether `namespaceId` is a talk namespace (`Talk`, `User talk`, ...). */
export function isTalkNamespace(namespaceId: number): boolean {
  return namespaceId > 0 && namespaceId % 2 === 1 && namespaceId in NAMESPACE_CANONICAL_NAMES;
}

/** The namespace the discussion of `namespaceId` lives in, or null when it has none. */
function counterpartNamespace(namespaceId: number): number | null {
  if (namespaceId < 0) return null;
  const counterpart = isTalkNamespace(namespaceId) ? namespaceId - 1 : namespaceId + 1;
  return counterpart === 0 || counterpart in NAMESPACE_CANONICAL_NAMES ? counterpart : null;
}

/** The page on the other side of the subject/talk pairing ("Foo" <-> "Talk:Foo"), or null when there is none. */
export function counterpartOf(canon: CanonicalTitle): CanonicalTitle | null {
  const namespaceId = counterpartNamespace(canon.namespaceId);
  if (namespaceId === null) return null;
  const prefix = NAMESPACE_CANONICAL_NAMES[namespaceId];
  return canonicalizeTitle(prefix ? `${prefix}:${canon.base}` : canon.base);
}

/** The discussion page of the subject page `canon`, or null when `canon` is a talk page or has no talk namespace. */
export function talkPageOf(canon: CanonicalTitle): CanonicalTitle | null {
  return isTalkNamespace(canon.namespaceId) ? null : counterpartOf(canon);
}

/** The subject page of the talk page `canon`, or null when `canon` is not a talk page. */
export function subjectPageOf(canon: CanonicalTitle): CanonicalTitle | null {
  return isTalkNamespace(canon.namespaceId) ? counterpartOf(canon) : null;
}
