/**
 * What the XenForo importer (phase 4, scripts/migrations/import-xenforo-forum.ts) reads from the database before it
 * plans, the run's single-flight lock, and the applied node map the `/forum/<nodeId>` redirect reads back. The
 * writes are import-write.ts, the rollback import-rollback.ts.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { categoryVisibilityWhere, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  nodeMapSchema,
  type NodeMapFile,
  type ResolvedNode,
} from "~/lib/thinkpages-forum/import/node-map";
import type { ImportDbState } from "~/lib/thinkpages-forum/import/plan";
import { isRealmPublished } from "~/server/modules/realms";
import { FORUM_IMPORT_NODE_MAP_KEY } from "./legacy-redirect";
import { loadForumRealm } from "./realm-access";

/**
 * The importer's client. It must be an uncapped `PrismaClient` (the runner's own, on one never-reaped connection),
 * never `~/server/db`: that client caps an unbounded `findMany` at 1000 rows, which would silently truncate the
 * already-imported ids, the restricted posts and the rollback's thread list.
 */
export type ImportDb = Pick<
  PrismaClient,
  | "user"
  | "realm"
  | "forumCategory"
  | "forumThread"
  | "forumPost"
  | "postActionLink"
  | "systemConfig"
  | "uploadedAsset"
  | "$transaction"
  | "$executeRaw"
  | "$queryRaw"
>;

/**
 * The database half of `ImportDbState`; `attachmentFor` comes from the attachment copy plan. `publishedRealms` are
 * the mapped realm slugs whose realm is published, for `categoryVisibility` (a draft realm's category is not public).
 */
export type LoadedImportState = Omit<ImportDbState, "attachmentFor"> & {
  publishedRealms: ReadonlySet<string>;
};

const PUBLIC_CATEGORY = categoryVisibilityWhere({ signedIn: false, siteAdmin: false });

/** The realm slugs a node map names (realm targets), each once. */
export function mappedRealmSlugs(nodeMap: NodeMapFile | null): string[] {
  const slugs = Object.values(nodeMap?.nodes ?? {}).flatMap((t) =>
    "scope" in t && t.scope === "realm" ? [t.realm] : []
  );
  return [...new Set(slugs)];
}

async function realmIdsOf(db: ImportDb, slugs: readonly string[]) {
  const ids = new Map<string, string>();
  const published = new Set<string>();
  for (const slug of slugs) {
    const realm = await loadForumRealm(db, { slug });
    if (realm) ids.set(slug, realm.id);
    if (realm && isRealmPublished(realm.id, realm.status)) published.add(slug);
  }
  return { ids, published };
}

/**
 * Linked users, sitewide categories with their visibility, the realm categories of the mapped realms (resolved by
 * the module's loadForumRealm, so IxWorld's "ixworld" and "default" both find realm "default"), and what an earlier
 * run already imported.
 */
export async function loadImportDbState(
  db: ImportDb,
  realmSlugs: readonly string[]
): Promise<LoadedImportState> {
  const users = await db.user.findMany({
    where: { forumUserId: { not: null } },
    select: { id: true, forumUserId: true, createdAt: true },
  });
  const siteCategories = await db.forumCategory.findMany({
    where: { scope: "site", realmId: null },
    select: { id: true, key: true, visibility: true },
  });
  const { ids: realmIds, published: publishedRealms } = await realmIdsOf(db, realmSlugs);
  const realmRows = await db.forumCategory.findMany({
    where: { scope: "realm", realmId: { in: [...new Set(realmIds.values())] } },
    select: { id: true, realmId: true, key: true },
  });
  const threads = await db.forumThread.findMany({
    where: { xenforoThreadId: { not: null } },
    select: { id: true, xenforoThreadId: true },
  });
  const posts = await db.forumPost.findMany({
    where: { xenforoPostId: { not: null } },
    select: { xenforoPostId: true },
  });
  return {
    users: users.flatMap((u) =>
      u.forumUserId === null
        ? []
        : [{ id: u.id, forumUserId: u.forumUserId, createdAt: u.createdAt }]
    ),
    siteCategories,
    realmIds,
    publishedRealms,
    realmCategories: realmRows.flatMap((c) =>
      c.realmId === null ? [] : [{ id: c.id, realmId: c.realmId, key: c.key }]
    ),
    existingThreads: new Map(
      threads.flatMap((t) => (t.xenforoThreadId === null ? [] : [[t.xenforoThreadId, t.id]]))
    ),
    existingPosts: new Set(
      posts.flatMap((p) => (p.xenforoPostId === null ? [] : [p.xenforoPostId]))
    ),
  };
}

/** Why the plan's targets cannot all resolve: a missing phase 1 seed, or a mapped realm slug that names no realm. */
export function missingTargets(state: LoadedImportState, realmSlugs: readonly string[]): string[] {
  const seeds = SITE_CATEGORIES.filter((s) => !state.siteCategories.some((c) => c.key === s.key));
  return [
    ...seeds.map(
      (s) => `Sitewide category "${s.key}" is missing: apply the phase 1 forum migration.`
    ),
    ...realmSlugs
      .filter((slug) => !state.realmIds.has(slug))
      .map((slug) => `The node map names realm "${slug}", which does not exist.`),
  ];
}

/** Ids of the published realms (IxWorld always, with or without its row). */
async function publishedRealmIds(db: ImportDb): Promise<string[]> {
  const realms = await db.realm.findMany({ select: { id: true, status: true } });
  const published = realms.filter((r) => isRealmPublished(r.id, r.status)).map((r) => r.id);
  return [...new Set([DEFAULT_REALM_ID, ...published])];
}

/**
 * XenForo ids of imported posts the database now holds as hidden (the post or its thread), in a category that is
 * not public, or in a realm category whose realm is not published (draft, generating, or gone): their attachments
 * are registered restricted whatever the snapshot says (Task 4's override).
 */
export async function restrictedImportedPosts(db: ImportDb): Promise<Set<number>> {
  const published = await publishedRealmIds(db);
  const rows = await db.forumPost.findMany({
    where: {
      xenforoPostId: { not: null },
      OR: [
        { hidden: true },
        { thread: { hidden: true } },
        { thread: { category: { NOT: PUBLIC_CATEGORY } } },
        { thread: { category: { scope: "realm", realmId: { notIn: published } } } },
      ],
    },
    select: { xenforoPostId: true },
  });
  return new Set(rows.flatMap((r) => (r.xenforoPostId === null ? [] : [r.xenforoPostId])));
}

const IMPORT_LOCK = "forum-import";

/**
 * One import or rollback at a time: a session advisory lock, held until the runner disconnects (the runner always
 * ends with `$disconnect`). False when another run holds it. Re-entrant: the holding session gets true again.
 */
export async function takeImportLock(db: Pick<PrismaClient, "$queryRaw">): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${IMPORT_LOCK})) AS "locked"`;
  return rows[0]?.locked === true;
}

export class ImportLockLostError extends Error {
  constructor() {
    super("The import lock was lost; stopping.");
    this.name = "ImportLockLostError";
  }
}

/**
 * Fails closed before each phase: the runner's single connection re-takes the lock it already holds (true), or a
 * lock that lapsed and nobody claimed; false means another run holds it now, so this one stops.
 */
export async function assertImportLock(db: Pick<PrismaClient, "$queryRaw">): Promise<void> {
  if (!(await takeImportLock(db))) throw new ImportLockLostError();
}

/**
 * The node map the run applied, as each node's resolved target (map, heuristic or default) in the node map file's
 * shape, so the redirect's parser reads it and it can be passed back as `--node-map`. Realms stay slugs.
 */
export function appliedNodeMap(resolved: readonly ResolvedNode[]): NodeMapFile {
  return { nodes: Object.fromEntries(resolved.map((r) => [String(r.node.node_id), r.target])) };
}

/** The stored node map's entries; an absent or unreadable row has none (and is replaced). */
function storedNodes(value: string | null): NodeMapFile["nodes"] {
  if (!value) return {};
  try {
    const parsed = nodeMapSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data.nodes : {};
  } catch {
    return {};
  }
}

/** Merges this run's node targets into the stored map (this run's entries win), so earlier nodes keep landing. */
export async function storeNodeMap(
  db: Pick<PrismaClient, "systemConfig">,
  map: NodeMapFile
): Promise<void> {
  const row = await db.systemConfig.findUnique({
    where: { key: FORUM_IMPORT_NODE_MAP_KEY },
    select: { value: true },
  });
  const value = JSON.stringify({ nodes: { ...storedNodes(row?.value ?? null), ...map.nodes } });
  await db.systemConfig.upsert({
    where: { key: FORUM_IMPORT_NODE_MAP_KEY },
    create: {
      key: FORUM_IMPORT_NODE_MAP_KEY,
      value,
      description:
        "XenForo node id → forum target applied by the phase 4 import (read by /forum/<nodeId>).",
    },
    update: { value },
  });
}
