/**
 * Who sees and posts in a forum category. Visibility follows one rule (`visibleForumVisibilities`, M8): `public` to
 * everyone, `reporter_staff` (Reports) to signed-in members, who see only their own threads there (`canSeeThread`),
 * and `staff` to site admins. `postRole: "staff"` means only site admins start threads.
 */
import { visibleForumVisibilities } from "~/lib/thinkpages-forum/categories";
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms";
import { canModerateCategory } from "./mod-scope";

/** What the viewer moderates (M10): computed by `moderatorContext`, attached by the router on signed-in reads. */
export interface ModeratorContext {
  siteAdmin: boolean;
  realmIds: readonly string[];
  categoryIds: readonly string[];
}

/**
 * `activeRealmId`: set only by the `realms` procedure, from the viewer's primary nation (`primaryRealmIdOf`); unset
 * elsewhere. `mod`: what the viewer moderates; absent means nothing beyond what `isSiteAdmin` grants.
 */
export type ForumViewer =
  | (RealmActor & { countryId: string | null; activeRealmId?: string | null; mod?: ModeratorContext })
  | null;

/** M8 through visibleForumVisibilities: reporter_staff is visible to any signed-in member; staff to site admins. */
export function canSeeCategory(viewer: ForumViewer, category: { visibility: string }): boolean {
  const visible = visibleForumVisibilities({
    signedIn: viewer !== null,
    siteAdmin: viewer !== null && isSiteAdmin(viewer),
  });
  return visible.some((v) => v === category.visibility);
}

/**
 * A thread the viewer may read: hidden needs a moderator of the category (M9); reporter_staff needs a moderator or
 * the author (M8).
 */
export function canSeeThread(
  viewer: ForumViewer,
  thread: { authorUserId: string; hidden: boolean },
  category: { id: string; scope: string; realmId: string | null; visibility: string }
): boolean {
  if (!canSeeCategory(viewer, category)) return false;
  if (canModerateCategory(viewer, category)) return true;
  if (thread.hidden) return false;
  return category.visibility !== "reporter_staff" || thread.authorUserId === viewer?.id;
}

/** Who may post (start a thread or reply) in a category: `postRole: "staff"` categories take site admins only. */
export function canPostIn(viewer: ForumViewer, category: { visibility: string; postRole: string }): boolean {
  if (viewer === null || !canSeeCategory(viewer, category)) return false;
  return category.postRole !== "staff" || isSiteAdmin(viewer);
}

/** Starting a thread follows the posting rule. */
export function canStartThread(viewer: ForumViewer, category: { visibility: string; postRole: string }): boolean {
  return canPostIn(viewer, category);
}
