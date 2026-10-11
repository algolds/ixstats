/**
 * Native threads anyone may read, for surfaces outside the forum (phase 4b, Q10): the global activity feed, Trending
 * and the old-forum link previews read these instead of the retired XenForo bridge. A thread is public when it is
 * not hidden, its category is public (`categoryVisibilityWhere` for an anonymous viewer) and it sits in the site
 * section or a published realm.
 */
import type { PrismaClient } from "@prisma/client";
import { categoryVisibilityWhere, notBoardCategory } from "~/lib/thinkpages-forum/categories";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isRealmPublished } from "~/server/modules/realms";
import { advertGate } from "./advert-access";
import { authorsOf, type AuthorsDb } from "./reads";

export type PublicThreadsDb = Pick<PrismaClient, "forumThread" | "forumPost" | "realm"> & AuthorsDb;

export interface PublicForumThread {
  id: string;
  title: string;
  /** The persona's name, else the member's public name, else the imported XenForo name, else "Member". */
  author: string;
  categoryName: string;
  replyCount: number;
  createdAt: Date;
  lastPostAt: Date;
  href: string;
}

/** Where a listed thread sits: the category it is in, as a preview needs it. */
export interface PublicThreadPlacement {
  key: string;
  name: string;
  scope: string;
  realmId: string | null;
  style: string;
}

const EXCERPT_LENGTH = 200;

const THREAD_SELECT = {
  id: true,
  title: true,
  authorUserId: true,
  authorPersonaId: true,
  importedAuthorName: true,
  postCount: true,
  createdAt: true,
  lastPostAt: true,
  category: { select: { key: true, name: true, scope: true, realmId: true, style: true } },
} as const;

interface ThreadRow {
  id: string;
  title: string;
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
  postCount: number;
  createdAt: Date;
  lastPostAt: Date;
  category: PublicThreadPlacement;
}

/** A published realm as a preview names it. */
export interface PublishedRealm {
  id: string;
  slug: string;
  name: string;
  emblemUrl: string | null;
  thumbnail: string | null;
}

/** The published realms' rows (one query; IxWorld may have none). */
export async function publishedRealms(db: Pick<PrismaClient, "realm">): Promise<PublishedRealm[]> {
  const realms = await db.realm.findMany({
    select: { id: true, status: true, slug: true, name: true, emblemUrl: true, thumbnail: true },
  });
  return realms
    .filter((r) => isRealmPublished(r.id, r.status))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      emblemUrl: r.emblemUrl,
      thumbnail: r.thumbnail,
    }));
}

const withIxWorld = (realms: readonly PublishedRealm[]): string[] => [
  ...new Set([DEFAULT_REALM_ID, ...realms.map((r) => r.id)]),
];

/** Ids of the published realms (IxWorld always, with or without its row). */
export async function publishedRealmIds(db: Pick<PrismaClient, "realm">): Promise<string[]> {
  return withIxWorld(await publishedRealms(db));
}

function publicThreadWhereIn(realmIds: readonly string[]) {
  return {
    hidden: false,
    ...advertGate(null),
    category: {
      ...categoryVisibilityWhere({ signedIn: false, siteAdmin: false }),
      // The realm board's messages are not threads or posts anywhere outside the board.
      ...notBoardCategory(),
      OR: [{ scope: "site" }, { scope: "realm", realmId: { in: [...realmIds] } }],
    },
  };
}

/**
 * The `ForumThread` where clause for what anyone may read: not hidden, a public category, in the site section or
 * a published realm, and never a realm board. Shared with the passport's forum footprint (member-activity.ts).
 */
export async function publicThreadWhere(db: Pick<PrismaClient, "realm">) {
  return publicThreadWhereIn(await publishedRealmIds(db));
}

async function withAuthors(db: PublicThreadsDb, rows: ThreadRow[]): Promise<PublicForumThread[]> {
  const authors = await authorsOf(
    db,
    // A persona thread never looks up its player.
    rows.map((r) => (r.authorPersonaId ? null : r.authorUserId)),
    rows.map((r) => r.authorPersonaId)
  );
  return rows.map((row) => {
    // A persona thread names the persona only, never the player behind it (AuthorName's rule).
    const author = row.authorPersonaId
      ? authors.personas.get(row.authorPersonaId)?.displayName
      : ((row.authorUserId ? authors.users.get(row.authorUserId)?.name : undefined) ??
        row.importedAuthorName);
    return {
      id: row.id,
      title: row.title,
      author: author ?? "Member",
      categoryName: row.category.name,
      replyCount: Math.max(0, row.postCount - 1),
      createdAt: row.createdAt,
      lastPostAt: row.lastPostAt,
      href: threadHref(row.id),
    };
  });
}

/** Who wrote a thread or post, as an opaque token two rows can be compared by (a persona, a member, else an imported name). */
export function authorRef(row: {
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
}): string {
  if (row.authorPersonaId) return `persona:${row.authorPersonaId}`;
  return row.authorUserId ? `user:${row.authorUserId}` : `imported:${row.importedAuthorName ?? ""}`;
}

/**
 * A listed thread with the category it sits in, whether a persona wrote it (never which one, or its player) and
 * `starter`, the opaque `authorRef` of its author. `starter` is for comparison inside the module, never for output.
 */
export type PlacedThread = PublicForumThread & {
  placement: PublicThreadPlacement;
  persona: boolean;
  starter: string;
};

/**
 * The newest public threads by last activity, each with its category, and the published realms the same realm read
 * gave (so a preview needs no second realm query). Trending reads `threads` alone.
 */
export async function latestPublicThreads(
  db: PublicThreadsDb,
  limit: number
): Promise<{ threads: PlacedThread[]; realms: PublishedRealm[] }> {
  const realms = await publishedRealms(db);
  const rows = await db.forumThread.findMany({
    where: publicThreadWhereIn(withIxWorld(realms)),
    orderBy: { lastPostAt: "desc" },
    take: limit,
    select: THREAD_SELECT,
  });
  const threads = await withAuthors(db, rows);
  return {
    threads: threads.map((thread, index) => ({
      ...thread,
      placement: rows[index]!.category,
      persona: Boolean(rows[index]!.authorPersonaId),
      starter: authorRef(rows[index]!),
    })),
    realms,
  };
}

/** An imported thread by its old XenForo id, when anyone may read it; its first post's text is the excerpt. */
export async function publicThreadByXenforoId(
  db: PublicThreadsDb,
  xenforoThreadId: number
): Promise<(PublicForumThread & { excerpt: string | null }) | null> {
  const row = await db.forumThread.findFirst({
    where: { xenforoThreadId, ...(await publicThreadWhere(db)) },
    select: THREAD_SELECT,
  });
  if (!row) return null;
  const [thread] = await withAuthors(db, [row]);
  const first = await db.forumPost.findFirst({
    where: { threadId: row.id, hidden: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { plainText: true },
  });
  const excerpt = first?.plainText.replace(/\s+/g, " ").trim().slice(0, EXCERPT_LENGTH) ?? "";
  return { ...thread!, excerpt: excerpt || null };
}
