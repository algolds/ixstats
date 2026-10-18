/**
 * Old forum links in imported XenForo posts and where they point on the native forum. Pure: the import's link
 * resolver (`src/server/modules/thinkpages-forum/import-forum-links.ts`) looks the ids up and passes what it found.
 * Every target is built from links.ts helpers (or a handle, encoded), so it is always an app path on this site.
 */
import { categoryHref, postHref, threadHref } from "../links";
import type { NodeMapFile, NodeTarget } from "./node-map";

/** An old forum link's target, by XenForo id: a forum node, a thread, a post or a member. */
export type ForumRef =
  | { kind: "forum"; nodeId: number }
  | { kind: "thread"; threadId: number }
  | { kind: "post"; postId: number }
  | { kind: "member"; userId: number };

/** What the import found for a ref: native ids, the category (realm slug for a realm one) and a member's handle. */
export interface ForumLookups {
  threadId: string | null;
  postId: string | null;
  category: { key: string; realmSlug: string | null } | null;
  handle: string | null;
}

/** A member's profile; the handle is encoded, so it stays one path segment. */
const memberHref = (handle: string): string => `/@${encodeURIComponent(handle)}`;

function categoryTarget(category: ForumLookups["category"]): string | null {
  if (!category) return null;
  const realm = category.realmSlug ? { slug: category.realmSlug } : null;
  return categoryHref({ key: category.key, realm });
}

/** The native page for a ref, given what was found; null when nothing was. */
export function forumRefTarget(ref: ForumRef, found: ForumLookups): string | null {
  switch (ref.kind) {
    case "thread":
      return found.threadId ? threadHref(found.threadId) : null;
    case "post":
      return found.postId ? postHref(found.postId) : null;
    case "forum":
      return categoryTarget(found.category);
    case "member":
      return found.handle ? memberHref(found.handle) : null;
  }
}

/** A node's seeded target from the applied node map: a sitewide category, or a realm (by slug) category. */
export type NodeLanding = Extract<NodeTarget, { scope: string }>;

/**
 * The run's applied node map (`appliedNodeMap`) as each node's landing. Archive and skip entries have none: an
 * archived node lands through its archive key `xf-<nodeId>`, a skipped one nowhere.
 */
export function nodeLandings(nodeMap: NodeMapFile): ReadonlyMap<number, NodeLanding> {
  const landings = new Map<number, NodeLanding>();
  for (const [nodeId, target] of Object.entries(nodeMap.nodes)) {
    if ("scope" in target) landings.set(Number(nodeId), target);
  }
  return landings;
}
