/**
 * page-tools.ts — where the page tools (Edit, Discussion) of a page lead: MediaWiki's own URL forms,
 * which the `/wiki/[...slug]` route serves (plan 412).
 */

import { talkPageOf, subjectPageOf } from "./core/talk";
import { canonicalizeTitle, type CanonicalTitle } from "./core/title";
import { articleHref } from "./wiki-path";

/** `/wiki/<title>?action=edit`; for a text that is not a title, the page's URL-encoded `slug` as it was. */
export function pageEditHref(title: string, slug: string | null): string {
  const canon = canonicalizeTitle(title);
  return canon ? articleHref(canon, { action: "edit" }) : `/wiki/${slug ?? ""}?action=edit`;
}

/**
 * The page on the other side of the subject/talk pairing of `title`: its talk page ("Discussion", at
 * `/wiki/Talk:<title>`) or, for a talk page, its subject. Null when it has none (`Special:`).
 */
export function pageTalkPair(title: string): { page: CanonicalTitle; isTalk: boolean } | null {
  const canon = canonicalizeTitle(title);
  if (!canon) return null;
  const subject = subjectPageOf(canon);
  const page = subject ?? talkPageOf(canon);
  return page ? { page, isTalk: subject !== null } : null;
}
