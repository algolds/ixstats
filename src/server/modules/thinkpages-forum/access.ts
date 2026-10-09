/**
 * Who sees and posts in a forum category. Phase 1 (ruling P7): `staff` and `reporter_staff` categories are both
 * admin-only until reports land in phase 3, and `postRole: "staff"` means only site admins start threads.
 */
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms";

/** `activeRealmId`: the realm of the nation the viewer acts as (the router fills it from `user.country.realmId`). */
export type ForumViewer = (RealmActor & { countryId: string | null; activeRealmId?: string | null }) | null;

export function canSeeCategory(viewer: ForumViewer, category: { visibility: string }): boolean {
  if (category.visibility === "public") return true;
  return viewer !== null && isSiteAdmin(viewer);
}

/** Who may post (start a thread or reply) in a category: `postRole: "staff"` categories take site admins only. */
export function canPostIn(viewer: ForumViewer, category: { visibility: string; postRole: string }): boolean {
  if (viewer === null || !canSeeCategory(viewer, category)) return false;
  return category.postRole !== "staff" || isSiteAdmin(viewer);
}

/** Starting a thread follows the posting rule in phase 1. */
export function canStartThread(viewer: ForumViewer, category: { visibility: string; postRole: string }): boolean {
  return canPostIn(viewer, category);
}
