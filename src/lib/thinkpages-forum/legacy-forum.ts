/**
 * The old XenForo bridge's `/forum/*` paths and where they land on the native forum (phase 4, Task 6). Pure: the
 * forum module looks the ids up and passes what it found. Every target is built from links.ts helpers (or a handle,
 * encoded), so it is always an app path on this site and phase 5 retargets the forum by editing FORUM_HOME.
 */
import { z } from "zod";
import { categoryHref, FORUM_HOME, postHref, threadHref } from "./links";

export type LegacyForumRef =
  | { kind: "home" }
  | { kind: "forum"; nodeId: number }
  | { kind: "thread"; threadId: number }
  | { kind: "post"; postId: number }
  | { kind: "member"; userId: number }
  | { kind: "other" };

/** What the module found for a ref: native ids, the category (realm slug for a realm one) and a member's handle. */
export interface LegacyLookups {
  threadId: string | null;
  postId: string | null;
  category: { key: string; realmSlug: string | null } | null;
  handle: string | null;
}

export type LegacyRoute = "forum" | "thread" | "post" | "member";

const OTHER: LegacyForumRef = { kind: "other" };
/** XenForo ids are positive and the native columns are Int: anything past int4 cannot match a row. */
const MAX_ID = 2_147_483_647;

function legacyId(segment: string): number | null {
  if (!/^\d{1,10}$/.test(segment)) return null;
  const id = Number(segment);
  return id >= 1 && id <= MAX_ID ? id : null;
}

/** The ref for one route segment; a segment that is not a XenForo id is `other`. */
export function legacyRefFor(route: LegacyRoute, segment: string): LegacyForumRef {
  const id = legacyId(segment);
  if (id === null) return OTHER;
  switch (route) {
    case "forum":
      return { kind: "forum", nodeId: id };
    case "thread":
      return { kind: "thread", threadId: id };
    case "post":
      return { kind: "post", postId: id };
    case "member":
      return { kind: "member", userId: id };
  }
}

/** A member's profile; the handle is encoded, so it stays one path segment. */
const memberHref = (handle: string): string => `/@${encodeURIComponent(handle)}`;

function categoryTarget(category: LegacyLookups["category"]): string {
  if (!category) return FORUM_HOME;
  const realm = category.realmSlug ? { slug: category.realmSlug } : null;
  return categoryHref({ key: category.key, realm });
}

/** The native page for a ref, given what was found; anything unresolved lands on the forum home. */
export function legacyForumTarget(ref: LegacyForumRef, found: LegacyLookups): string {
  switch (ref.kind) {
    case "thread":
      return found.threadId ? threadHref(found.threadId) : FORUM_HOME;
    case "post":
      return found.postId ? postHref(found.postId) : FORUM_HOME;
    case "forum":
      return categoryTarget(found.category);
    case "member":
      return found.handle ? memberHref(found.handle) : FORUM_HOME;
    default:
      return FORUM_HOME;
  }
}

const categoryKey = z.string().regex(/^[a-z0-9-]{2,40}$/);

const landingSchema = z.union([
  z.object({ scope: z.literal("site"), key: categoryKey }),
  z.object({ scope: z.literal("realm"), realm: z.string().min(1).max(100), key: categoryKey }),
]);

/** A node's seeded target from the applied node map: a sitewide category, or a realm (by slug) category. */
export type NodeLanding = z.infer<typeof landingSchema>;

// Archive, skip and malformed entries become null: they land through the archive key, or not at all.
const landingsSchema = z.record(z.string().regex(/^\d+$/), landingSchema.nullable().catch(null));
const rowSchema = z.union([
  z.object({ nodes: landingsSchema }).transform((file) => file.nodes),
  landingsSchema,
]);

function landingsOf(json: string): Record<string, NodeLanding | null> {
  try {
    const parsed = rowSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/**
 * The `forum_import_node_map` SystemConfig row (node id → target, or the node map file shape `{ nodes }`), read
 * defensively: an absent row, bad JSON or a malformed entry yields no landing for that node.
 */
export function parseNodeLandings(value: string | null): ReadonlyMap<number, NodeLanding> {
  const landings = new Map<number, NodeLanding>();
  if (!value) return landings;
  for (const [nodeId, landing] of Object.entries(landingsOf(value))) {
    if (landing) landings.set(Number(nodeId), landing);
  }
  return landings;
}
