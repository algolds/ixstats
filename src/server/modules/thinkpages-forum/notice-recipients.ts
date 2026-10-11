/**
 * Who may be told about a post (spec section 4): the people who can read it. Nobody, moderators included, is told about
 * a hidden thread (the caller has already refused a hidden post). A public thread in a visible realm is readable by
 * every member, so it costs no role lookup; a staff board or a Reports thread needs each member's moderator context, looked up for the whole list at once.
 */
import { isSiteAdmin } from "~/server/modules/realms";
import { canSeeThread, type ForumViewer, type ModeratorContext } from "./access";
import { advertRealmHiddenFrom, advertRealmOf } from "./advert-access";
import { forumMemberOf } from "./forum-viewer";
import { MODERATOR_POWER, type ScopeDb } from "./mod-scope";
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
  thread: { authorUserId: string | null; hidden: boolean; advertRealmId?: string | null };
  category: { id: string; scope: string; realmId: string | null; visibility: string };
  /** The category's realm, null in the sitewide section. */
  realm: ForumRealm | null;
}

/**
 * What each user moderates here, in three queries for the whole list instead of three per user (`moderatorContext`):
 * only this category and its realm matter to whether they may read the thread. Site admins need no query.
 */
async function moderatorsHere(
  db: ScopeDb,
  place: NoticePlace,
  users: readonly Recipient[]
): Promise<Map<string, ModeratorContext>> {
  const { category } = place;
  const others = users.filter((user) => !isSiteAdmin(forumMemberOf(user)));
  const clerkIds = others.map((user) => user.clerkUserId);
  const realmId = category.scope === "realm" ? category.realmId : null;
  const [founded, officers, moderators] = await Promise.all([
    realmId
      ? db.realm.findMany({
          where: { id: realmId, ownerId: { in: clerkIds } },
          select: { ownerId: true },
        })
      : [],
    realmId
      ? db.realmOfficer.findMany({
          where: { realmId, userId: { in: clerkIds }, powers: { has: MODERATOR_POWER } },
          select: { userId: true },
        })
      : [],
    db.forumCategoryModerator.findMany({
      where: { categoryId: category.id, userId: { in: others.map((user) => user.id) } },
      select: { userId: true },
    }),
  ]);
  const ofRealm = new Set([...founded.map((r) => r.ownerId), ...officers.map((o) => o.userId)]);
  const ofCategory = new Set(moderators.map((m) => m.userId));
  return new Map(
    users.map((user) => [
      user.id,
      {
        siteAdmin: isSiteAdmin(forumMemberOf(user)),
        realmIds: realmId && ofRealm.has(user.clerkUserId) ? [realmId] : [],
        categoryIds: ofCategory.has(user.id) ? [category.id] : [],
      },
    ])
  );
}

export async function readableUsers<T extends Recipient>(
  db: ScopeDb,
  place: NoticePlace,
  users: readonly T[]
): Promise<T[]> {
  if (place.thread.hidden) return [];
  const mods =
    place.category.visibility === "public" ? null : await moderatorsHere(db, place, users);
  const readable: T[] = [];
  // One realm read for the whole list, not one per recipient.
  const advertRealm = await advertRealmOf(db, place.thread);
  for (const user of users) {
    const member = forumMemberOf(user);
    const viewer: ForumViewer = mods ? { ...member, mod: mods.get(user.id) } : member;
    if (!canSeeThread(viewer, place.thread, place.category)) continue;
    if (place.realm && !canSeeRealm(viewer, place.realm)) continue;
    if (advertRealmHiddenFrom(viewer, advertRealm)) continue;
    readable.push(user);
  }
  return readable;
}
