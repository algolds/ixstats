/**
 * What the XenForo importer (phase 4, scripts/migrations/import-xenforo-forum.ts) reads from the database before it
 * plans, the run's single-flight lock, and the applied node map the `/forum/<nodeId>` redirect reads back. The
 * writes are import-write.ts, the rollback import-rollback.ts.
 */
import type { PrismaClient } from "@prisma/client";
import { categoryVisibilityWhere, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import type { NodeMapFile, ResolvedNode } from "~/lib/thinkpages-forum/import/node-map";
import type { ImportDbState } from "~/lib/thinkpages-forum/import/plan";
import { FORUM_IMPORT_NODE_MAP_KEY } from "./legacy-redirect";
import { loadForumRealm } from "./realm-access";

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

/** The database half of `ImportDbState`; `attachmentFor` comes from the attachment copy plan. */
export type LoadedImportState = Omit<ImportDbState, "attachmentFor">;

const PUBLIC_CATEGORY = categoryVisibilityWhere({ signedIn: false, siteAdmin: false });

/** The realm slugs a node map names (realm targets), each once. */
export function mappedRealmSlugs(nodeMap: NodeMapFile | null): string[] {
  const slugs = Object.values(nodeMap?.nodes ?? {}).flatMap((t) =>
    "scope" in t && t.scope === "realm" ? [t.realm] : []
  );
  return [...new Set(slugs)];
}

async function realmIdsOf(db: ImportDb, slugs: readonly string[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const slug of slugs) {
    const realm = await loadForumRealm(db, { slug });
    if (realm) ids.set(slug, realm.id);
  }
  return ids;
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
  const realmIds = await realmIdsOf(db, realmSlugs);
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

/**
 * XenForo ids of imported posts the database now holds as hidden (the post or its thread) or in a category that is
 * not public: their attachments are registered restricted whatever the snapshot says (Task 4's override).
 */
export async function restrictedImportedPosts(db: ImportDb): Promise<Set<number>> {
  const rows = await db.forumPost.findMany({
    where: {
      xenforoPostId: { not: null },
      OR: [
        { hidden: true },
        { thread: { hidden: true } },
        { thread: { category: { NOT: PUBLIC_CATEGORY } } },
      ],
    },
    select: { xenforoPostId: true },
  });
  return new Set(rows.flatMap((r) => (r.xenforoPostId === null ? [] : [r.xenforoPostId])));
}

const IMPORT_LOCK = "forum-import";

/**
 * One import or rollback at a time: a session advisory lock, held until the runner disconnects (the runner always
 * ends with `$disconnect`). False when another run holds it.
 */
export async function takeImportLock(db: Pick<PrismaClient, "$queryRaw">): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${IMPORT_LOCK})) AS "locked"`;
  return rows[0]?.locked === true;
}

/**
 * The node map the run applied, as each node's resolved target (map, heuristic or default) in the node map file's
 * shape, so the redirect's parser reads it and it can be passed back as `--node-map`. Realms stay slugs.
 */
export function appliedNodeMap(resolved: readonly ResolvedNode[]): NodeMapFile {
  return { nodes: Object.fromEntries(resolved.map((r) => [String(r.node.node_id), r.target])) };
}

export async function storeNodeMap(
  db: Pick<PrismaClient, "systemConfig">,
  map: NodeMapFile
): Promise<void> {
  const value = JSON.stringify(map);
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
