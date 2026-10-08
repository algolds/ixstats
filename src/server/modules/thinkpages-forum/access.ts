/**
 * Who sees and posts in a forum category. Phase 1 (ruling P7): `staff` and `reporter_staff` categories are both
 * admin-only until reports land in phase 3, and `postRole: "staff"` means only site admins start threads.
 */
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms";

export type ForumViewer = (RealmActor & { countryId: string | null }) | null;

export function canSeeCategory(viewer: ForumViewer, category: { visibility: string }): boolean {
  if (category.visibility === "public") return true;
  return viewer !== null && isSiteAdmin(viewer);
}

export function canStartThread(viewer: ForumViewer, category: { visibility: string; postRole: string }): boolean {
  if (viewer === null || !canSeeCategory(viewer, category)) return false;
  return category.postRole !== "staff" || isSiteAdmin(viewer);
}
