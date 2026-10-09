/**
 * ThinkPages forum paths, shared by pages and components. Plain paths for `<Link>` and `redirect()`, never
 * `createUrl()` (it would double the production basePath). Slugs and keys are encoded, so a slug cannot add a path
 * segment or a query parameter.
 */
import { REALM_HUB_KEY } from "./categories";

export const FORUM_HOME = "/thinkpages/forum";

/** Where a category sits: a realm category carries its realm's slug, a sitewide one none. */
export interface CategoryPlace {
  key: string;
  realm?: { slug: string } | null;
}

const seg = encodeURIComponent;

/** The forum home, opened on `realm`'s section when given. */
export function forumHomeHref(realm?: string | null): string {
  return realm ? `${FORUM_HOME}?realm=${seg(realm)}` : FORUM_HOME;
}

export function categoryHref(category: CategoryPlace): string {
  const { key, realm } = category;
  return realm ? `/thinkpages/r/${seg(realm.slug)}/${seg(key)}` : `/thinkpages/c/${seg(key)}`;
}

/** A realm's Hub, where its forum section starts. */
export function hubHref(realmSlug: string): string {
  return categoryHref({ key: REALM_HUB_KEY, realm: { slug: realmSlug } });
}

export function newThreadHref(category: CategoryPlace): string {
  return `${categoryHref(category)}/new`;
}

export function threadHref(threadId: string): string {
  return `/thinkpages/t/${seg(threadId)}`;
}

/** The realm's Nations tab, where a player claims a nation to post in its section. */
export function claimNationHref(slug: string): string {
  return `/r/${seg(slug)}/nations`;
}

/** The member's standing (warnings, bans, appeals) on the forum home, where ban notices send an appeal. */
export const STANDING_HREF = `${FORUM_HOME}#standing`;

/** The moderation console, opened on `tab` and filtered to `realm` when given. */
export function modHref({ tab, realm }: { tab?: string; realm?: string } = {}): string {
  const query = [tab && `tab=${seg(tab)}`, realm && `realm=${seg(realm)}`].filter(Boolean);
  return query.length > 0 ? `/thinkpages/mod?${query.join("&")}` : "/thinkpages/mod";
}
