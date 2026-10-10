/**
 * Who may be told about a post (spec section 4): the people who can read it. Nobody, moderators included, is told about
 * a hidden thread (the caller has already refused a hidden post). A public thread in a visible realm is readable by
 * every member, so it costs no role lookup; a staff board or a Reports thread needs each member's moderator context.
 */
import { canSeeThread, type ForumViewer } from "./access";
import { forumActorOf, forumMemberOf } from "./forum-viewer";
import type { ScopeDb } from "./mod-scope";
import { canSeeRealm, type ForumRealm } from "./realm-access";

export const RECIPIENT_SELECT = {
  id: true,
  clerkUserId: true,
  countryId: true,
  role: { select: { name: true, level: true } },
} as const;

export interface Recipient {
  id: string;
  clerkUserId: string;
  countryId: string | null;
  role: { name: string; level: number } | null;
}

export interface NoticePlace {
  thread: { authorUserId: string | null; hidden: boolean };
  category: { id: string; scope: string; realmId: string | null; visibility: string };
  /** The category's realm, null in the sitewide section. */
  realm: ForumRealm | null;
}

export async function readableUsers<T extends Recipient>(
  db: ScopeDb,
  place: NoticePlace,
  users: readonly T[]
): Promise<T[]> {
  if (place.thread.hidden) return [];
  const needsRoles = place.category.visibility !== "public";
  const readable: T[] = [];
  for (const user of users) {
    const viewer: ForumViewer = needsRoles ? await forumActorOf(db, user) : forumMemberOf(user);
    if (!canSeeThread(viewer, place.thread, place.category)) continue;
    if (place.realm && !canSeeRealm(viewer, place.realm)) continue;
    readable.push(user);
  }
  return readable;
}
