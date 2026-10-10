/**
 * The sitewide boards for the Forums home: each visible board with its thread and post counts, style, and latest
 * post (with the author's public name, the same way a thread list names its authors).
 */
import type { PrismaClient } from "@prisma/client";
import { canSeeCategory, type ForumViewer } from "./access";
import { latestPerCategory, postCountsPerCategory, type LatestPost } from "./board-reads";
import { authorsOf, summarizeCategories, type AuthorsDb } from "./reads";

export type BoardsDb = Pick<PrismaClient, "forumCategory" | "forumThread" | "forumPost"> &
  AuthorsDb;

export interface BoardAuthor {
  name: string;
  handle: string | null;
}

export type BoardLatest = LatestPost & { author: BoardAuthor | null };

/** Persona threads name the persona only, never the player behind it; imported posts keep their XenForo name. */
function nameOf(
  latest: LatestPost,
  authors: Awaited<ReturnType<typeof authorsOf>>
): BoardAuthor | null {
  const persona = latest.authorPersonaId ? authors.personas.get(latest.authorPersonaId) : undefined;
  if (persona) return { name: persona.displayName, handle: persona.username };
  const user = latest.authorUserId ? authors.users.get(latest.authorUserId) : undefined;
  if (user) return { name: user.name, handle: user.handle };
  return latest.importedAuthorName ? { name: latest.importedAuthorName, handle: null } : null;
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

export async function listBoards(db: BoardsDb, viewer: ForumViewer) {
  const all = await db.forumCategory.findMany({
    where: { scope: "site", realmId: null },
    orderBy: { order: "asc" },
  });
  const visible = all.filter((c) => canSeeCategory(viewer, c));
  const [summaries, postCounts, latest] = await Promise.all([
    summarizeCategories(db, viewer, all),
    postCountsPerCategory(db, viewer, visible),
    latestPerCategory(db, viewer, visible),
  ]);
  const authors = await authorsOf(
    db,
    [...latest.values()].map((l) => l.authorUserId),
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
      postCount: postCounts.get(category.id) ?? 0,
      latest: last ? publicLatest(last, authors) : null,
    };
  });
}
