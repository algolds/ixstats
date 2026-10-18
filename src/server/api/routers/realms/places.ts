/**
 * Realms as places: the realm directory (/realms), whose activity counts each realm's forum section and its live
 * board, and the directory's nation search.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { notBoardCategory, onlyBoardCategory } from "~/lib/thinkpages-forum/categories";
import { realmSettings } from "~/server/modules/realms/realms.settings";
import {
  openNationCounts,
  unclaimedNationPages,
} from "~/server/modules/realms/realms.open-nations";
import { PREVIEWED_BOARD_MESSAGES } from "~/server/modules/thinkpages-forum";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";

/** How far back "forum activity" in the directory looks. */
const FORUM_ACTIVITY_WINDOW_DAYS = 7;

/** How many nations a nation search returns at most. */
export const NATION_SEARCH_LIMIT = 20;

type ForumActivity = { recentPosts: number; lastPostAt: Date | null };

/**
 * Activity in the realms' forum sections since `since`: posts made and the latest thread activity, for every realm in
 * three queries however many there are (the sections' categories, the latest thread per category, one grouped count
 * of the window's posts per category). Public categories only (the directory is open to everyone) and nothing
 * hidden; an archived thread is never the latest (U12). A realm with no section reads as no posts and no activity.
 */
async function forumActivityByRealm(
  db: PrismaClient,
  realmIds: string[],
  since: Date
): Promise<Map<string, ForumActivity>> {
  const activity = new Map<string, ForumActivity>(
    realmIds.map((id) => [id, { recentPosts: 0, lastPostAt: null }])
  );
  const categories = await db.forumCategory.findMany({
    where: {
      scope: "realm",
      realmId: { in: realmIds },
      visibility: "public",
      ...notBoardCategory(),
    },
    select: { id: true, realmId: true },
  });
  const realmOf = new Map(categories.map((category) => [category.id, category.realmId]));
  if (realmOf.size === 0) return activity;
  const categoryIds = [...realmOf.keys()];
  const [latest, active] = await Promise.all([
    db.forumThread.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: categoryIds }, hidden: false, archived: false },
      _max: { lastPostAt: true },
    }),
    // Counted in the database, one row per section however many threads were active.
    db.$queryRaw<Array<{ categoryId: string; posts: number }>>`
      SELECT t."categoryId", COUNT(*)::int AS posts
      FROM forum_posts p
      JOIN forum_threads t ON t.id = p."threadId"
      WHERE t."categoryId" IN (${Prisma.join(categoryIds)})
        AND t.hidden = false AND p.hidden = false AND p."createdAt" >= ${since}
      GROUP BY t."categoryId"`,
  ]);
  for (const row of latest) {
    const entry = activity.get(realmOf.get(row.categoryId) ?? "");
    const at = row._max.lastPostAt;
    if (entry && at && (!entry.lastPostAt || at > entry.lastPostAt)) entry.lastPostAt = at;
  }
  for (const section of active) {
    const entry = activity.get(realmOf.get(section.categoryId) ?? "");
    if (entry) entry.recentPosts += section.posts;
  }
  return activity;
}

/**
 * Messages on the realms' live boards since `since`: the directory's own "board messages this week" figure, batched
 * for the whole directory in two queries however many realms there are (the realms' public board threads, then one
 * grouped count of their messages). It is never added to `forumActivityByRealm`'s post count (the board stays out of every
 * forum count): public board category, thread not hidden, messages not hidden and not the placeholder line of a
 * message that was continued in a thread.
 */
async function boardMessagesByRealm(
  db: PrismaClient,
  realmIds: string[],
  since: Date
): Promise<Map<string, number>> {
  const threads = await db.forumThread.findMany({
    where: {
      hidden: false,
      category: {
        scope: "realm",
        realmId: { in: realmIds },
        visibility: "public",
        ...onlyBoardCategory(),
      },
    },
    select: { id: true, category: { select: { realmId: true } } },
  });
  const realmOfThread = new Map(threads.map((thread) => [thread.id, thread.category.realmId]));
  const counts = new Map<string, number>();
  if (realmOfThread.size === 0) return counts;
  const rows = await db.forumPost.groupBy({
    by: ["threadId"],
    where: {
      threadId: { in: [...realmOfThread.keys()] },
      ...PREVIEWED_BOARD_MESSAGES,
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });
  for (const row of rows) {
    const realmId = realmOfThread.get(row.threadId);
    if (realmId) counts.set(realmId, (counts.get(realmId) ?? 0) + row._count._all);
  }
  return counts;
}

/** Open realms with their nation counts, forum activity and the viewer's own holdings. */
export async function listRealmDirectory(db: PrismaClient, viewerUserId: string | null) {
  const realms = await db.realm.findMany({
    where: DIRECTORY_REALM_WHERE,
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      thumbnail: true,
      bannerUrl: true,
      tags: true,
      foundedAt: true,
      createdAt: true,
      settings: true,
      // Generated scenery slots (claimable false) are no nations of the realm.
      _count: { select: { countries: { where: { claimable: true } } } },
    },
  });
  const realmIds = realms.map((r) => r.id);
  if (realmIds.length === 0) return [];

  const [open, mine] = await Promise.all([
    openNationCounts(db, realmIds),
    viewerUserId
      ? db.country.groupBy({
          by: ["realmId"],
          where: { realmId: { in: realmIds }, ownerUserId: viewerUserId },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const since = new Date(Date.now() - FORUM_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const countBy = (rows: Array<{ realmId: string; _count: { _all: number } }>) =>
    new Map(rows.map((row) => [row.realmId, row._count._all]));
  const mineBy = countBy(mine);

  // Both figures are batched for every realm; the forum counts still exclude the board, which has its own figure.
  const [boardWeek, boards] = await Promise.all([
    boardMessagesByRealm(db, realmIds, since),
    forumActivityByRealm(db, realmIds, since),
  ]);
  return realms.map(({ settings, _count, foundedAt, createdAt, ...realm }) => ({
    ...realm,
    foundedAt: foundedAt ?? createdAt,
    nationCount: _count.countries,
    openNationCount: open.nations.get(realm.id) ?? 0,
    /** Lore-index nation pages no country has taken yet (claimable through `realms.claimNationPage`). */
    openNationPageCount: open.pages.get(realm.id) ?? 0,
    myNationCount: mineBy.get(realm.id) ?? 0,
    maxNationsPerUser: realmSettings(settings).maxNationsPerUser,
    /** Forum activity in the realm's section: posts in the last week and the latest thread activity. */
    board: boards.get(realm.id)!,
    /** Board messages in the last week: its own figure, never added to `board.recentPosts`. */
    boardMessagesThisWeek: boardWeek.get(realm.id) ?? 0,
  }));
}

/**
 * Nations whose name contains `query`, across the realms the directory lists (DIRECTORY_REALM_WHERE: never a draft,
 * generating or unlisted realm): countries, claimable when nobody owns them, and lore-index nation pages no country
 * has taken yet, always claimable. Sorted by name, at most NATION_SEARCH_LIMIT. Never exposes owner ids.
 */
export async function searchDirectoryNations(db: PrismaClient, query: string) {
  const realms = await db.realm.findMany({
    where: DIRECTORY_REALM_WHERE,
    select: { id: true, slug: true, name: true },
  });
  if (realms.length === 0) return [];
  const realmById = new Map(realms.map((realm) => [realm.id, realm]));
  const realmIds = [...realmById.keys()];
  const contains = { contains: query, mode: "insensitive" as const };

  const [countries, pages] = await Promise.all([
    db.country.findMany({
      where: { realmId: { in: realmIds }, isDemo: false, claimable: true, name: contains },
      orderBy: { name: "asc" },
      take: NATION_SEARCH_LIMIT,
      select: { id: true, name: true, slug: true, flag: true, realmId: true, ownerUserId: true },
    }),
    db.realmPage.findMany({
      where: { realmId: { in: realmIds }, kind: "nation", title: contains },
      orderBy: { title: "asc" },
      take: NATION_SEARCH_LIMIT,
      select: { realmId: true, title: true, wikiSource: true },
    }),
  ]);
  const openPages = await unclaimedNationPages(db, pages);

  const results = [
    ...countries.flatMap(({ ownerUserId, realmId, ...country }) => {
      const realm = realmById.get(realmId);
      return realm
        ? [{ kind: "country" as const, ...country, claimable: ownerUserId === null, realm }]
        : [];
    }),
    ...openPages.flatMap((page) => {
      const realm = realmById.get(page.realmId);
      return realm
        ? [
            {
              kind: "page" as const,
              id: `${page.realmId}:${page.wikiSource}:${page.title}`,
              name: page.title,
              slug: null,
              flag: null,
              claimable: true,
              realm,
            },
          ]
        : [];
    }),
  ];
  return results.sort((a, b) => a.name.localeCompare(b.name)).slice(0, NATION_SEARCH_LIMIT);
}
