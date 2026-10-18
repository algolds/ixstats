/**
 * The import's forum link pass: old forum links in imported XenForo posts (forum.ixwiki.com, and the retired bridge's
 * `/forum/...` paths) are pointed at the native pages, once every thread is written. Threads and posts resolve through
 * `xenforoThreadId` / `xenforoPostId`, forum nodes through the run's applied node map (`nodeLandings`) and then the
 * node's archive category `xf-<nodeId>`, members through `User.forumUserId` (the earliest linked account, as
 * attribution does) to their handle. Anything unresolved is null, and a failed lookup throws. Targets are built from
 * ids and known keys only (`src/lib/thinkpages-forum/import/forum-links.ts`), never from the link itself.
 *
 * Only what an anonymous visitor may read resolves: a thread or post that is not hidden, in a public category, in
 * the site section or a published realm. Anything else is null too, so stored post HTML never tells hidden or staff
 * content apart from content that was never imported: every unresolved link is unwrapped (or kept for the rerun) alike.
 */
import { categoryVisibilityWhere } from "~/lib/thinkpages-forum/categories";
import {
  FORUM_LINK_MARKERS,
  forumHrefRefs,
  forumRefTarget,
  nodeLandings,
  rewriteForumHrefs,
  type ForumLookups,
  type ForumRef,
  type NodeLanding,
} from "~/lib/thinkpages-forum/import/forum-links";
import { archiveKey, type NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import { isRealmPublished } from "~/server/modules/realms";
import type { ImportDb } from "./import-db";
import { loadForumRealm } from "./realm-access";

export type ForumLinksDb = Pick<
  ImportDb,
  "forumThread" | "forumPost" | "forumCategory" | "realm" | "user"
>;

/** Categories an anonymous visitor may read (public visibility). */
const PUBLIC_CATEGORY = categoryVisibilityWhere({ signedIn: false, siteAdmin: false });
const PLACE = { select: { scope: true, realmId: true } } as const;

const NONE: ForumLookups = { threadId: null, postId: null, category: null, handle: null };

type Category = ForumLookups["category"];

/** Whether a category's place is open to anonymous readers: the site section, or a published realm. */
async function placeIsPublic(
  db: ForumLinksDb,
  place: { scope: string; realmId: string | null }
): Promise<boolean> {
  if (place.scope !== "realm") return true;
  const realm = place.realmId ? await loadForumRealm(db, { id: place.realmId }) : null;
  return realm !== null && isRealmPublished(realm.id, realm.status);
}

async function siteCategory(db: ForumLinksDb, key: string): Promise<Category> {
  const row = await db.forumCategory.findFirst({
    where: { scope: "site", realmId: null, key, ...PUBLIC_CATEGORY },
    select: { key: true },
  });
  return row ? { key: row.key, realmSlug: null } : null;
}

/** A realm category, under its realm's canonical slug (Ixnay's legacy "default" and former "ixworld" become "ixnay"). */
async function realmCategory(db: ForumLinksDb, slug: string, key: string): Promise<Category> {
  const realm = await loadForumRealm(db, { slug });
  if (!realm || !isRealmPublished(realm.id, realm.status)) return null;
  const row = await db.forumCategory.findFirst({
    where: { scope: "realm", realmId: realm.id, key, ...PUBLIC_CATEGORY },
    select: { key: true },
  });
  return row ? { key: row.key, realmSlug: realm.slug } : null;
}

async function nodeCategory(
  db: ForumLinksDb,
  nodeId: number,
  landings: ReadonlyMap<number, NodeLanding>
): Promise<Category> {
  const landing = landings.get(nodeId);
  const mapped = !landing
    ? null
    : landing.scope === "site"
      ? await siteCategory(db, landing.key)
      : await realmCategory(db, landing.realm, landing.key);
  return mapped ?? (await siteCategory(db, archiveKey(nodeId)));
}

async function publicThreadId(db: ForumLinksDb, xenforoThreadId: number): Promise<string | null> {
  const row = await db.forumThread.findFirst({
    where: { xenforoThreadId, hidden: false, category: PUBLIC_CATEGORY },
    select: { id: true, category: PLACE },
  });
  return row && (await placeIsPublic(db, row.category)) ? row.id : null;
}

async function publicPostId(db: ForumLinksDb, xenforoPostId: number): Promise<string | null> {
  const row = await db.forumPost.findFirst({
    where: { xenforoPostId, hidden: false, thread: { hidden: false, category: PUBLIC_CATEGORY } },
    select: { id: true, thread: { select: { category: PLACE } } },
  });
  return row && (await placeIsPublic(db, row.thread.category)) ? row.id : null;
}

async function memberHandle(db: ForumLinksDb, forumUserId: number): Promise<string | null> {
  const row = await db.user.findFirst({
    where: { forumUserId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { handle: true },
  });
  return row?.handle ?? null;
}

async function lookup(
  db: ForumLinksDb,
  ref: ForumRef,
  landings: ReadonlyMap<number, NodeLanding>
): Promise<ForumLookups> {
  switch (ref.kind) {
    case "home":
      return NONE;
    case "thread":
      return { ...NONE, threadId: await publicThreadId(db, ref.threadId) };
    case "post":
      return { ...NONE, postId: await publicPostId(db, ref.postId) };
    case "forum":
      return { ...NONE, category: await nodeCategory(db, ref.nodeId, landings) };
    case "member":
      return { ...NONE, handle: await memberHandle(db, ref.userId) };
  }
}

/** The native page an old forum link points at, or null when nothing public resolves; a lookup error propagates. */
export async function resolveForumRef(
  db: ForumLinksDb,
  ref: ForumRef,
  landings: ReadonlyMap<number, NodeLanding>
): Promise<string | null> {
  return forumRefTarget(ref, await lookup(db, ref, landings));
}

const PAGE = 500;

/** Imported posts that may hold an old forum link; Canvas-sourced posts are rendered from their wikitext. */
const MAY_HOLD_OLD_LINKS = {
  xenforoPostId: { not: null },
  contentWikitext: null,
  OR: FORUM_LINK_MARKERS.map((marker) => ({ contentHtml: { contains: marker } })),
};

export interface ForumLinkRewrite {
  /** Old forum links pointed at their native page. */
  mapped: number;
  /** Old forum links unwrapped to their text: nothing an anonymous visitor may read is there. */
  unwrapped: number;
}

/**
 * Every imported post's old forum links (any run's), pointed at the native pages; an unresolved one is unwrapped, or
 * kept for the rerun while `dropUnresolved` is false (a thread failed, so its link may resolve later). Keyset-paged
 * and idempotent (a native path is never an old link); each distinct ref is looked up once. `plainText` is left
 * alone: it never held an href.
 */
export async function rewriteImportedForumLinks(
  db: ForumLinksDb,
  opts: { nodeMap: NodeMapFile; dropUnresolved: boolean }
): Promise<ForumLinkRewrite> {
  const landings = nodeLandings(opts.nodeMap);
  const unresolved = opts.dropUnresolved ? "drop" : "keep";
  const targets = new Map<string, string | null>();
  const keyOf = (ref: ForumRef) => JSON.stringify(ref);
  const resolveAll = async (refs: readonly ForumRef[]) => {
    for (const ref of refs) {
      const key = keyOf(ref);
      if (!targets.has(key)) targets.set(key, await resolveForumRef(db, ref, landings));
    }
  };
  const targetOf = (ref: ForumRef) => targets.get(keyOf(ref)) ?? null;
  const out: ForumLinkRewrite = { mapped: 0, unwrapped: 0 };
  let after = "";
  for (;;) {
    const posts = await db.forumPost.findMany({
      where: { ...MAY_HOLD_OLD_LINKS, id: { gt: after } },
      orderBy: { id: "asc" },
      take: PAGE,
      select: { id: true, contentHtml: true },
    });
    if (!posts.length) return out;
    after = posts[posts.length - 1]!.id;
    for (const post of posts) {
      await resolveAll(forumHrefRefs(post.contentHtml));
      const rewrite = rewriteForumHrefs(post.contentHtml, targetOf, unresolved);
      if (rewrite.html === post.contentHtml) continue;
      await db.forumPost.update({ where: { id: post.id }, data: { contentHtml: rewrite.html } });
      out.mapped += rewrite.mapped;
      out.unwrapped += rewrite.unwrapped;
    }
  }
}
