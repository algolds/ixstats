/**
 * Realms as places: the realm directory (/realms) and each realm's board (/r/[realm]/board), the
 * NationStates regional message board built on the ThinkTank primitive (see thinktanks/realm-board.ts).
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { realmSettings } from "~/server/modules/realms/realms.settings";
import { isRealmHiddenFrom, type RealmActor } from "~/server/modules/realms/realms.access";
import {
  ensureRealmBoard,
  getRealmBoardAccess,
  groupPostTag,
  syncRealmBoardMembers,
} from "~/server/shared/realm-board";

/** How far back "board activity" in the directory looks. */
const BOARD_ACTIVITY_WINDOW_DAYS = 7;

/**
 * Realms the directory lists: active public realms, plus IxWorld whatever its row says (AT-6). Unlisted realms are
 * reachable by link only and never listed; draft and generating realms are shown only to their staff, by link.
 */
export const DIRECTORY_REALM_WHERE = {
  OR: [{ id: DEFAULT_REALM_ID }, { visibility: "public", status: "active" }],
};

/** How many nations a nation search returns at most. */
export const NATION_SEARCH_LIMIT = 20;

type NationPage = { realmId: string; title: string; wikiSource: string };

/**
 * The nation pages of realms' lore indexes that no country has taken yet: claimable through
 * `realms.claimNationPage`. A claimed page's country carries the page title (country names are unique per realm),
 * as in getRealmHub.
 */
async function unclaimedNationPages<P extends NationPage>(
  db: PrismaClient,
  pages: P[]
): Promise<P[]> {
  if (pages.length === 0) return [];
  const taken = await db.country.findMany({
    where: {
      realmId: { in: [...new Set(pages.map((page) => page.realmId))] },
      name: { in: [...new Set(pages.map((page) => page.title))] },
    },
    select: { realmId: true, name: true },
  });
  const key = (realmId: string, name: string) => JSON.stringify([realmId, name]);
  const named = new Set(taken.map((country) => key(country.realmId, country.name)));
  return pages.filter((page) => !named.has(key(page.realmId, page.title)));
}

/** Open realms with their nation counts, board activity and the viewer's own holdings. */
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
      _count: { select: { countries: true } },
    },
  });
  const realmIds = realms.map((r) => r.id);
  if (realmIds.length === 0) return [];

  const [unclaimed, mine, boards, nationPages] = await Promise.all([
    db.country.groupBy({
      by: ["realmId"],
      where: { realmId: { in: realmIds }, ownerUserId: null },
      _count: { _all: true },
    }),
    viewerUserId
      ? db.country.groupBy({
          by: ["realmId"],
          where: { realmId: { in: realmIds }, ownerUserId: viewerUserId },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    db.realmBoard.findMany({
      where: { realmId: { in: realmIds } },
      select: { realmId: true, groupId: true },
    }),
    db.realmPage.findMany({
      where: { realmId: { in: realmIds }, kind: "nation" },
      select: { realmId: true, title: true, wikiSource: true },
    }),
  ]);
  const claimablePages = new Map<string, number>();
  for (const page of await unclaimedNationPages(db, nationPages))
    claimablePages.set(page.realmId, (claimablePages.get(page.realmId) ?? 0) + 1);

  const since = new Date(Date.now() - BOARD_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const activity = new Map(
    await Promise.all(
      boards.map(async (board) => {
        const onBoard = { hashtags: { contains: `"${groupPostTag(board.groupId)}"` } };
        // Board posts carry an IxTime stamp; activity is measured on the real-time createdAt.
        const [recentPosts, latest] = await Promise.all([
          db.thinkpagesPost.count({ where: { ...onBoard, createdAt: { gte: since } } }),
          db.thinkpagesPost.findFirst({
            where: onBoard,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return [board.realmId, { recentPosts, lastPostAt: latest?.createdAt ?? null }] as const;
      })
    )
  );
  const countBy = (rows: Array<{ realmId: string; _count: { _all: number } }>) =>
    new Map(rows.map((row) => [row.realmId, row._count._all]));
  const unclaimedBy = countBy(unclaimed);
  const mineBy = countBy(mine);

  return realms.map(({ settings, _count, foundedAt, createdAt, ...realm }) => ({
    ...realm,
    foundedAt: foundedAt ?? createdAt,
    nationCount: _count.countries,
    openNationCount: unclaimedBy.get(realm.id) ?? 0,
    /** Lore-index nation pages no country has taken yet (claimable through `realms.claimNationPage`). */
    openNationPageCount: claimablePages.get(realm.id) ?? 0,
    myNationCount: mineBy.get(realm.id) ?? 0,
    maxNationsPerUser: realmSettings(settings).maxNationsPerUser,
    /** Null until someone opens the board for the first time. */
    board: activity.get(realm.id) ?? null,
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
      where: { realmId: { in: realmIds }, isDemo: false, name: contains },
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

/**
 * Open a realm's board: create it on first use, bring the caller's membership in line with the nations
 * they own there (and drop members who no longer own one), and say what the caller may do. A draft or
 * generating realm's board opens for its staff only (AT-6).
 */
export async function openRealmBoard(db: PrismaClient, slug: string, viewer: RealmActor | null) {
  const clerkUserId = viewer?.clerkUserId ?? null;
  const realm = await db.realm.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true, status: true },
  });
  if (!realm || isRealmHiddenFrom(viewer, realm))
    throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });

  const { groupId } = await ensureRealmBoard(db, realm);
  const group = await db.thinktankGroup.findUnique({
    where: { id: groupId },
    select: { id: true, conversationId: true },
  });
  if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Realm board not found" });

  const access = await getRealmBoardAccess(db, groupId, clerkUserId);
  try {
    await syncRealmBoardMembers(
      db,
      {
        groupId,
        realmId: realm.id,
        conversationId: group.conversationId,
        realmOwnerId: realm.ownerId,
      },
      clerkUserId ? { clerkUserId, access } : null
    );
  } catch (error) {
    // Reading the board never fails on a membership sync; the next open retries it.
    console.error("[realms] board membership sync failed:", error);
  }

  return {
    groupId,
    realm: { id: realm.id, slug: realm.slug, name: realm.name },
    canPost: access.isMember,
    canModerate: access.isManager,
    /** The caller's nations in this realm: the personas the board composer offers. */
    ownedCountryIds: access.ownedCountryIds,
  };
}
