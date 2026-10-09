/**
 * Where a `/forum/*` path of the old XenForo bridge goes on the native forum (phase 4, Task 6). Null while the
 * legacy switch is off. Otherwise threads and posts resolve through `xenforoThreadId` / `xenforoPostId`, forum
 * nodes through the applied node map (the `forum_import_node_map` row, written by the importer) and then the node's
 * archive category `xf-<nodeId>`, members through `User.forumUserId` (the earliest linked account, as attribution
 * does) to their handle. Anything unresolved, or a failed lookup, lands on the forum home. Targets are built from ids
 * and known keys only (legacy-forum.ts), never from the request.
 */
import type { PrismaClient } from "@prisma/client";
import { archiveKey } from "~/lib/thinkpages-forum/import/node-map";
import {
  legacyForumTarget,
  parseNodeLandings,
  type LegacyForumRef,
  type LegacyLookups,
  type NodeLanding,
} from "~/lib/thinkpages-forum/legacy-forum";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";
import {
  __resetLegacyForumSwitchForTests,
  LEGACY_FORUM_TTL_MS,
  refreshLegacyForumRedirect,
} from "./legacy-switch";
import { loadForumRealm } from "./realm-access";

export type LegacyDb = Pick<
  PrismaClient,
  "forumThread" | "forumPost" | "forumCategory" | "realm" | "user" | "systemConfig"
>;

export const FORUM_IMPORT_NODE_MAP_KEY = "forum_import_node_map";

const NONE: LegacyLookups = { threadId: null, postId: null, category: null, handle: null };

let nodeMap: { landings: ReadonlyMap<number, NodeLanding>; loadedAt: number } | null = null;

async function nodeLandings(db: LegacyDb): Promise<ReadonlyMap<number, NodeLanding>> {
  if (nodeMap && Date.now() - nodeMap.loadedAt <= LEGACY_FORUM_TTL_MS) return nodeMap.landings;
  const row = await db.systemConfig.findUnique({
    where: { key: FORUM_IMPORT_NODE_MAP_KEY },
    select: { value: true },
  });
  nodeMap = { landings: parseNodeLandings(row?.value ?? null), loadedAt: Date.now() };
  return nodeMap.landings;
}

type Category = LegacyLookups["category"];

async function siteCategory(db: LegacyDb, key: string): Promise<Category> {
  const row = await db.forumCategory.findFirst({
    where: { scope: "site", realmId: null, key },
    select: { key: true },
  });
  return row ? { key: row.key, realmSlug: null } : null;
}

/** A realm category, under its realm's canonical slug (IxWorld's legacy "default" becomes "ixworld"). */
async function realmCategory(db: LegacyDb, slug: string, key: string): Promise<Category> {
  const realm = await loadForumRealm(db, { slug });
  if (!realm) return null;
  const row = await db.forumCategory.findFirst({
    where: { scope: "realm", realmId: realm.id, key },
    select: { key: true },
  });
  return row ? { key: row.key, realmSlug: realm.slug } : null;
}

async function nodeCategory(db: LegacyDb, nodeId: number): Promise<Category> {
  const landing = (await nodeLandings(db)).get(nodeId);
  const mapped = !landing
    ? null
    : landing.scope === "site"
      ? await siteCategory(db, landing.key)
      : await realmCategory(db, landing.realm, landing.key);
  return mapped ?? (await siteCategory(db, archiveKey(nodeId)));
}

async function lookup(db: LegacyDb, ref: LegacyForumRef): Promise<LegacyLookups> {
  switch (ref.kind) {
    case "thread": {
      const row = await db.forumThread.findUnique({
        where: { xenforoThreadId: ref.threadId },
        select: { id: true },
      });
      return { ...NONE, threadId: row?.id ?? null };
    }
    case "post": {
      const row = await db.forumPost.findUnique({
        where: { xenforoPostId: ref.postId },
        select: { id: true },
      });
      return { ...NONE, postId: row?.id ?? null };
    }
    case "forum":
      return { ...NONE, category: await nodeCategory(db, ref.nodeId) };
    case "member": {
      const row = await db.user.findFirst({
        where: { forumUserId: ref.userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { handle: true },
      });
      return { ...NONE, handle: row?.handle ?? null };
    }
    default:
      return NONE;
  }
}

/** The native target for a legacy `/forum/*` ref, or null while the legacy switch is off. */
export async function legacyForumRedirectFor(
  db: LegacyDb,
  ref: LegacyForumRef
): Promise<string | null> {
  if (!(await refreshLegacyForumRedirect())) return null;
  try {
    return legacyForumTarget(ref, await lookup(db, ref));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[forum] legacy redirect lookup failed; sending to the forum home:", message);
    return FORUM_HOME;
  }
}

export function __resetLegacyForumRedirectForTests(): void {
  __resetLegacyForumSwitchForTests();
  nodeMap = null;
}
