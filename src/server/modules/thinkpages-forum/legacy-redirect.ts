/**
 * Where a `/forum/*` path of the retired XenForo bridge goes on the native forum (phase 4, Task 6; unconditional
 * since phase 4b). Threads and posts resolve through `xenforoThreadId` / `xenforoPostId`, forum
 * nodes through the applied node map (the `forum_import_node_map` row, written by the importer) and then the node's
 * archive category `xf-<nodeId>`, members through `User.forumUserId` (the earliest linked account, as attribution
 * does) to their handle. Anything unresolved, or a failed lookup, lands on the forum home. Targets are built from ids
 * and known keys only (legacy-forum.ts), never from the request.
 *
 * Only what an anonymous visitor may read resolves: a thread or post that is not hidden, in a public category, in
 * the site section or a published realm. Anything else lands on the forum home too, so walking the sequential
 * XenForo ids never tells hidden or staff content apart from content that was never imported (staff following an old
 * link to hidden content reach it through the mod console instead).
 */
import type { PrismaClient } from "@prisma/client";
import { categoryVisibilityWhere } from "~/lib/thinkpages-forum/categories";
import { archiveKey } from "~/lib/thinkpages-forum/import/node-map";
import {
  legacyForumTarget,
  parseNodeLandings,
  type LegacyForumRef,
  type LegacyLookups,
  type NodeLanding,
} from "~/lib/thinkpages-forum/legacy-forum";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";
import { isRealmPublished } from "~/server/modules/realms";
import { loadForumRealm } from "./realm-access";

export type LegacyDb = Pick<
  PrismaClient,
  "forumThread" | "forumPost" | "forumCategory" | "realm" | "user" | "systemConfig"
>;

export const FORUM_IMPORT_NODE_MAP_KEY = "forum_import_node_map";
/** How long a process keeps the applied node map before reading the row again (an import run may rewrite it). */
const NODE_MAP_TTL_MS = 60_000;

/** Categories an anonymous visitor may read (public visibility). */
const PUBLIC_CATEGORY = categoryVisibilityWhere({ signedIn: false, siteAdmin: false });
const PLACE = { select: { scope: true, realmId: true } } as const;

const NONE: LegacyLookups = { threadId: null, postId: null, category: null, handle: null };

let nodeMap: { landings: ReadonlyMap<number, NodeLanding>; loadedAt: number } | null = null;

async function nodeLandings(db: LegacyDb): Promise<ReadonlyMap<number, NodeLanding>> {
  if (nodeMap && Date.now() - nodeMap.loadedAt <= NODE_MAP_TTL_MS) return nodeMap.landings;
  const row = await db.systemConfig.findUnique({
    where: { key: FORUM_IMPORT_NODE_MAP_KEY },
    select: { value: true },
  });
  nodeMap = { landings: parseNodeLandings(row?.value ?? null), loadedAt: Date.now() };
  return nodeMap.landings;
}

type Category = LegacyLookups["category"];

/** Whether a category's place is open to anonymous readers: the site section, or a published realm. */
async function placeIsPublic(
  db: LegacyDb,
  place: { scope: string; realmId: string | null }
): Promise<boolean> {
  if (place.scope !== "realm") return true;
  const realm = place.realmId ? await loadForumRealm(db, { id: place.realmId }) : null;
  return realm !== null && isRealmPublished(realm.id, realm.status);
}

async function siteCategory(db: LegacyDb, key: string): Promise<Category> {
  const row = await db.forumCategory.findFirst({
    where: { scope: "site", realmId: null, key, ...PUBLIC_CATEGORY },
    select: { key: true },
  });
  return row ? { key: row.key, realmSlug: null } : null;
}

/** A realm category, under its realm's canonical slug (IxWorld's legacy "default" becomes "ixworld"). */
async function realmCategory(db: LegacyDb, slug: string, key: string): Promise<Category> {
  const realm = await loadForumRealm(db, { slug });
  if (!realm || !isRealmPublished(realm.id, realm.status)) return null;
  const row = await db.forumCategory.findFirst({
    where: { scope: "realm", realmId: realm.id, key, ...PUBLIC_CATEGORY },
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

async function publicThreadId(db: LegacyDb, xenforoThreadId: number): Promise<string | null> {
  const row = await db.forumThread.findFirst({
    where: { xenforoThreadId, hidden: false, category: PUBLIC_CATEGORY },
    select: { id: true, category: PLACE },
  });
  return row && (await placeIsPublic(db, row.category)) ? row.id : null;
}

async function publicPostId(db: LegacyDb, xenforoPostId: number): Promise<string | null> {
  const row = await db.forumPost.findFirst({
    where: { xenforoPostId, hidden: false, thread: { hidden: false, category: PUBLIC_CATEGORY } },
    select: { id: true, thread: { select: { category: PLACE } } },
  });
  return row && (await placeIsPublic(db, row.thread.category)) ? row.id : null;
}

async function memberHandle(db: LegacyDb, forumUserId: number): Promise<string | null> {
  const row = await db.user.findFirst({
    where: { forumUserId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { handle: true },
  });
  return row?.handle ?? null;
}

async function lookup(db: LegacyDb, ref: LegacyForumRef): Promise<LegacyLookups> {
  switch (ref.kind) {
    case "thread":
      return { ...NONE, threadId: await publicThreadId(db, ref.threadId) };
    case "post":
      return { ...NONE, postId: await publicPostId(db, ref.postId) };
    case "forum":
      return { ...NONE, category: await nodeCategory(db, ref.nodeId) };
    case "member":
      return { ...NONE, handle: await memberHandle(db, ref.userId) };
    default:
      return NONE;
  }
}

/** The native target for a legacy `/forum/*` ref; the forum home when nothing resolves. */
export async function legacyForumRedirectFor(db: LegacyDb, ref: LegacyForumRef): Promise<string> {
  try {
    return legacyForumTarget(ref, await lookup(db, ref));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[forum] legacy redirect lookup failed; sending to the forum home:", message);
    return FORUM_HOME;
  }
}

export function __resetLegacyForumRedirectForTests(): void {
  nodeMap = null;
}
