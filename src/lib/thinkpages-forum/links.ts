/**
 * ThinkPages forum paths, shared by pages and components. Plain paths for `<Link>` and `redirect()`, never
 * `createUrl()` (it would double the production basePath). Slugs and keys are encoded, so a slug cannot add a path
 * segment or a query parameter.
 */
import { ADVERT_CATEGORY_KEY } from "./adverts";
import { REALM_HUB_KEY } from "./categories";

export const FORUM_HOME = "/thinkpages";

/** Whether a base-path-free pathname is the forum or under it. */
export function isForumPath(pathname: string): boolean {
  return pathname === FORUM_HOME || pathname.startsWith(`${FORUM_HOME}/`);
}

/** Where a category sits: a realm category carries its realm's slug, a sitewide one none. */
export interface CategoryPlace {
  key: string;
  realm?: { slug: string } | null;
}

const seg = encodeURIComponent;

/** A category as the moderation router locates it: its key, and its realm's slug for a realm category. */
export function categoryLocator(category: CategoryPlace): { key: string; realm?: string } {
  return category.realm ? { key: category.key, realm: category.realm.slug } : { key: category.key };
}

export function categoryHref(category: CategoryPlace): string {
  const { key, realm } = category;
  return realm ? `/thinkpages/r/${seg(realm.slug)}/${seg(key)}` : `/thinkpages/c/${seg(key)}`;
}

/** A realm's landing page, where its live board is. */
export function realmHref(realmSlug: string): string {
  return `/thinkpages/r/${seg(realmSlug)}`;
}

/** A message on a realm's landing page, anchored by `postId`. */
export function realmBoardHref(realmSlug: string, postId?: string): string {
  return postId ? `${realmHref(realmSlug)}#post-${seg(postId)}` : realmHref(realmSlug);
}

/** A realm's Hub, where its forum section starts. */
export function hubHref(realmSlug: string): string {
  return categoryHref({ key: REALM_HUB_KEY, realm: { slug: realmSlug } });
}

export function newThreadHref(category: CategoryPlace): string {
  return `${categoryHref(category)}/new`;
}

/** The form that creates a realm's advert in Find a Realm; the realm is fixed by `advert`. */
export function newAdvertHref(realmSlug: string): string {
  return `${newThreadHref({ key: ADVERT_CATEGORY_KEY })}?advert=${seg(realmSlug)}`;
}

/** The query parameter that carries an activity id into a composer, which inserts its action token once. */
export const ATTACH_PARAM = "attach";

function withAttach(path: string, activityId: string): string {
  return `${path}?${ATTACH_PARAM}=${seg(activityId)}`;
}

/** A realm's landing page, its board composer prefilled with an action. */
export function realmBoardAttachHref(realmSlug: string, activityId: string): string {
  return withAttach(realmHref(realmSlug), activityId);
}

/** A category's new-thread form, prefilled with an action. */
export function newThreadAttachHref(category: CategoryPlace, activityId: string): string {
  return withAttach(newThreadHref(category), activityId);
}

export function threadHref(threadId: string): string {
  return `/thinkpages/t/${seg(threadId)}`;
}

/** A post by its permalink: the server finds its page in the thread, and shows a hidden post to moderators. */
export function postHref(postId: string): string {
  return `/thinkpages/post/${seg(postId)}`;
}

/** A thread opened at its first unread post (a server redirect; a signed-out visitor gets the thread itself). */
export function unreadHref(threadId: string): string {
  return `${threadHref(threadId)}/unread`;
}

/** A member's Passport page, by handle. */
export function handleProfileHref(handle: string): string {
  return `/id/${seg(handle)}`;
}

/** A persona's profile (the dashboard owns the feed). */
export function personaProfileHref(username: string): string {
  return `/dashboard/profile/${seg(username)}`;
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
