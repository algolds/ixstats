/**
 * The sitewide boards for the Forums home: each visible board with its thread and post counts, style, and latest
 * post (with the author's public name, the same way a thread list names its authors), plus the New across ThinkPages
 * feed.
 */
import type { PrismaClient } from "@prisma/client";
import { isAdvertCategory } from "~/lib/thinkpages-forum/adverts";
import type { PersonaType } from "~/lib/thinkpages-forum/persona-type";
import { bannedBoardIds } from "./mod-bans";
import { canSeeCategory, canSeeThread, canStartThread, type ForumViewer } from "./access";
import {
  latestPerCategory,
  postCountsPerCategory,
  railThreadWhere,
  type LatestPost,
} from "./board-reads";
import { authorsOf, summarizeCategories, type AuthorsDb } from "./reads";

export type BoardsDb = Pick<PrismaClient, "forumCategory" | "forumThread" | "forumPost"> &
  AuthorsDb;

export interface BoardAuthor {
  name: string;
  handle: string | null;
  /** The persona's picture for a persona, the member's own otherwise; never the player's behind a persona. */
  avatarUrl: string | null;
  /** The member's nation flag; null for a persona (it never names the player's nation) and imported authors. */
  flagUrl: string | null;
  /** A persona's voice; null otherwise. */
  personaType: PersonaType | null;
}

export type BoardLatest = LatestPost & { author: BoardAuthor | null };

/** Persona threads name the persona only, never the player behind it; imported posts keep their XenForo name. */
function nameOf(
  latest: LatestPost,
  authors: Awaited<ReturnType<typeof authorsOf>>
): BoardAuthor | null {
  if (latest.authorPersonaId) {
    const persona = authors.personas.get(latest.authorPersonaId);
    return {
      name: persona?.displayName ?? "Persona",
      handle: persona?.username ?? null,
      avatarUrl: persona?.avatarUrl ?? null,
      flagUrl: null,
      personaType: persona?.personaType ?? null,
    };
  }
  const user = latest.authorUserId ? authors.users.get(latest.authorUserId) : undefined;
  if (user) return { ...user, personaType: null };
  return latest.importedAuthorName
    ? {
        name: latest.importedAuthorName,
        handle: null,
        avatarUrl: null,
        flagUrl: null,
        personaType: null,
      }
    : null;
}

/** A persona post never carries the player's user id on this public read; the resolved `author` is the persona. */
function publicLatest(
  latest: LatestPost,
  authors: Awaited<ReturnType<typeof authorsOf>>
): BoardLatest {
  return {
    ...latest,
    authorUserId: latest.authorPersonaId ? null : latest.authorUserId,
    author: nameOf(latest, authors),
  };
}

export async function listBoards(
  db: BoardsDb & Pick<PrismaClient, "forumBan">,
  viewer: ForumViewer
) {
  const all = await db.forumCategory.findMany({
    where: { scope: "site", realmId: null },
    orderBy: { order: "asc" },
  });
  const visible = all.filter((c) => canSeeCategory(viewer, c));
  const [summaries, postCounts, latest, bans] = await Promise.all([
    summarizeCategories(db, viewer, all),
    postCountsPerCategory(db, viewer, visible),
    latestPerCategory(db, viewer, visible),
    bannedBoardIds(
      db,
      viewer,
      visible.map((c) => c.id)
    ),
  ]);
  const authors = await authorsOf(
    db,
    [...latest.values()].map((l) => (l.authorPersonaId ? null : l.authorUserId)),
    [...latest.values()].map((l) => l.authorPersonaId)
  );
  const categoryByKey = new Map(visible.map((c) => [c.key, c]));
  return summaries.map((summary) => {
    const category = categoryByKey.get(summary.key)!;
    const last = latest.get(category.id);
    return {
      ...summary,
      id: category.id,
      style: category.style,
      visibility: category.visibility,
      // Find a Realm takes adverts only, so the home's New thread menu never offers it; nor a board a ban closes.
      canStart:
        canStartThread(viewer, category) &&
        !isAdvertCategory(category) &&
        !bans.site &&
        !bans.categories.has(category.id),
      postCount: postCounts.get(category.id) ?? 0,
      latest: last ? publicLatest(last, authors) : null,
    };
  });
}

/** One post in New across ThinkPages (the home and front page feeds): who wrote it, in which thread and board, and whether it began it. */
export type ActivityItem = BoardLatest & {
  postId: string;
  categoryName: string;
  isFirstPost: boolean;
  /** The post's board is in character. */
  inCharacter: boolean;
};

/** Activity asks for more posts than it returns, because posts in threads the viewer cannot see are dropped. */
const ACTIVITY_OVERFETCH = 4;

/**
 * The newest visible posts across the sitewide and published realm boards, newest first: three queries (posts, the
 * first post of each of their threads, authors). Persona posts carry no player id, as on `listBoards`.
 */
export async function latestActivity(
  db: BoardsDb & Pick<PrismaClient, "realm">,
  viewer: ForumViewer,
  limit = 6
): Promise<ActivityItem[]> {
  const posts = await db.forumPost.findMany({
    where: { hidden: false, thread: await railThreadWhere(db) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit * ACTIVITY_OVERFETCH,
    select: {
      id: true,
      threadId: true,
      authorUserId: true,
      authorPersonaId: true,
      importedAuthorName: true,
      createdAt: true,
      thread: {
        select: {
          title: true,
          authorUserId: true,
          hidden: true,
          category: {
            select: {
              id: true,
              name: true,
              style: true,
              visibility: true,
              scope: true,
              realmId: true,
            },
          },
        },
      },
    },
  });
  const visible = posts
    .filter((p) => canSeeThread(viewer, p.thread, p.thread.category))
    .slice(0, limit);
  if (visible.length === 0) return [];
  const [firsts, authors] = await Promise.all([
    db.forumPost.findMany({
      where: { threadId: { in: [...new Set(visible.map((p) => p.threadId))] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      distinct: ["threadId"],
      select: { id: true },
    }),
    authorsOf(
      db,
      visible.map((p) => (p.authorPersonaId ? null : p.authorUserId)),
      visible.map((p) => p.authorPersonaId)
    ),
  ]);
  const firstIds = new Set(firsts.map((f) => f.id));
  return visible.map((p) => ({
    ...publicLatest(
      {
        threadId: p.threadId,
        threadTitle: p.thread.title,
        authorUserId: p.authorUserId,
        authorPersonaId: p.authorPersonaId,
        importedAuthorName: p.importedAuthorName,
        at: p.createdAt,
      },
      authors
    ),
    postId: p.id,
    categoryName: p.thread.category.name,
    isFirstPost: firstIds.has(p.id),
    inCharacter: p.thread.category.style === "ic",
  }));
}
