/**
 * Who may see imported content (phase 4, Q4, Q5). Pure; shared by the plan (thread and post rows, the staff-like
 * warning) and the attachment copy (public or restricted media assets), so both decide alike.
 */
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import type { NodeTarget } from "./node-map";
import type { XfPost, XfThread } from "./xenforo-types";

/** A sitewide category's visibility as the database holds it (ImportDbState.siteCategories). */
export interface SiteCategoryVisibility {
  key: string;
  visibility: string;
}

/** What a sitewide key no database row or seed names, or an unpublished realm, counts as: never public by mistake. */
export const UNKNOWN_SITE_VISIBILITY = "restricted";

/**
 * The visibility of the category a node target lands in (null: skipped). Archives take the map's visibility; a realm
 * category is public only while its realm is published (`publishedRealms`: the node map's realm slugs whose realm
 * `isRealmPublished`, as the loader reports them; a draft or generating realm, or one not reported, is restricted);
 * a sitewide key is looked up in the database's categories, then the seeds.
 */
export function categoryVisibility(
  target: NodeTarget,
  siteCategories: readonly SiteCategoryVisibility[],
  publishedRealms: ReadonlySet<string> = new Set()
): string | null {
  if ("skip" in target) return null;
  if ("archive" in target) return target.visibility ?? "public";
  if (target.scope === "realm") {
    return publishedRealms.has(target.realm) ? "public" : UNKNOWN_SITE_VISIBILITY;
  }
  const known = [...siteCategories, ...SITE_CATEGORIES].find((c) => c.key === target.key);
  return known?.visibility ?? UNKNOWN_SITE_VISIBILITY;
}

export type ImportedThread =
  | { skip: "deleted" | "noPosts" | "firstPostDeleted" }
  | { first: XfPost; posts: XfPost[]; hidden: boolean };

/**
 * Q5 for one thread: a deleted thread, one without posts and one whose first post is deleted are not imported; a
 * moderated thread or first post hides the thread (phase 3 never hides a first post alone). `posts` are the
 * thread's posts that are not deleted.
 */
export function importedThread(thread: XfThread, posts: readonly XfPost[]): ImportedThread {
  if (thread.discussion_state === "deleted") return { skip: "deleted" };
  const first = posts.find((p) => p.is_first_post) ?? posts[0];
  if (!first) return { skip: "noPosts" };
  if (first.message_state === "deleted") return { skip: "firstPostDeleted" };
  return {
    first,
    posts: posts.filter((p) => p.message_state !== "deleted"),
    hidden: thread.discussion_state === "moderated" || first.message_state === "moderated",
  };
}
