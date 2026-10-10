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
  category: { select: { name: true } },
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
  category: { name: string };
}

/** Ids of the published realms (IxWorld always, with or without its row). */
export async function publishedRealmIds(db: Pick<PrismaClient, "realm">): Promise<string[]> {
  const realms = await db.realm.findMany({ select: { id: true, status: true } });
  const published = realms.filter((r) => isRealmPublished(r.id, r.status)).map((r) => r.id);
  return [...new Set([DEFAULT_REALM_ID, ...published])];
}

/**
 * The `ForumThread` where clause for what anyone may read: not hidden, a public category, in the site section or
 * a published realm, and never a realm board. Shared with the passport's forum footprint (member-activity.ts).
 */
export async function publicThreadWhere(db: Pick<PrismaClient, "realm">) {
  return {
    hidden: false,
    category: {
      ...categoryVisibilityWhere({ signedIn: false, siteAdmin: false }),
      // The realm board's messages are not threads or posts anywhere outside the board.
      ...notBoardCategory(),
      OR: [{ scope: "site" }, { scope: "realm", realmId: { in: await publishedRealmIds(db) } }],
    },
  };
}

async function withAuthors(db: PublicThreadsDb, rows: ThreadRow[]): Promise<PublicForumThread[]> {
  const authors = await authorsOf(
    db,
    rows.map((r) => r.authorUserId),
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

/** The newest public threads by last activity. */
export async function latestPublicThreads(
  db: PublicThreadsDb,
  limit: number
): Promise<PublicForumThread[]> {
  const rows = await db.forumThread.findMany({
    where: await publicThreadWhere(db),
    orderBy: { lastPostAt: "desc" },
    take: limit,
    select: THREAD_SELECT,
  });
  return withAuthors(db, rows);
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
