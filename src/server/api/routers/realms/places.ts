/**
 * Realms as places: the realm directory (/realms), whose activity counts each realm's forum section
 * (the realm board page is gone; /r/[realm]/board redirects to the forum).
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { realmSettings } from "~/server/modules/realms/realms.settings";
import { isRealmHiddenFrom, type RealmActor } from "~/server/modules/realms/realms.access";
import { nationPageTaken } from "~/server/modules/realms/realms.handover";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import {
  ensureRealmBoard,
  getRealmBoardAccess,
  syncRealmBoardMembers,
} from "~/server/shared/realm-board";

/** How far back "forum activity" in the directory looks. */
const FORUM_ACTIVITY_WINDOW_DAYS = 7;

/** How many nations a nation search returns at most. */
export const NATION_SEARCH_LIMIT = 20;

type NationPage = { realmId: string; title: string; wikiSource: string };

/**
 * The nation pages of realms' lore indexes that no country has taken yet: claimable through
 * `realms.claimNationPage`. A page is taken by the country carrying its page reference (even after a rename), or
 * by name for a country without one, as in getRealmHub.
 */
async function unclaimedNationPages<P extends NationPage>(
  db: PrismaClient,
  pages: P[]
): Promise<P[]> {
  if (pages.length === 0) return [];
  const titles = [...new Set(pages.map((page) => page.title))];
  const countries = await db.country.findMany({
    where: {
      realmId: { in: [...new Set(pages.map((page) => page.realmId))] },
      OR: [{ wikiPageTitle: { in: titles } }, { wikiPageTitle: null, name: { in: titles } }],
    },
    select: { realmId: true, name: true, wikiSource: true, wikiPageTitle: true },
  });
  const taken = nationPageTaken(countries);
  return pages.filter((page) => !taken(page));
}

/**
 * Activity in a realm's forum section since `since`: posts made and the latest thread activity. Public categories
 * only (the directory is open to everyone) and nothing hidden.
 */
async function forumActivity(db: PrismaClient, realmId: string, since: Date) {
  const inSection = {
    hidden: false,
    category: { scope: "realm", realmId, visibility: "public" },
  };
  const [recentPosts, latest] = await Promise.all([
    db.forumPost.count({ where: { hidden: false, createdAt: { gte: since }, thread: inSection } }),
    db.forumThread.findFirst({
      where: inSection,
      orderBy: { lastPostAt: "desc" },
      select: { lastPostAt: true },
    }),
  ]);
  return { recentPosts, lastPostAt: latest?.lastPostAt ?? null };
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
      _count: { select: { countries: true } },
    },
  });
  const realmIds = realms.map((r) => r.id);
  if (realmIds.length === 0) return [];

  const [unclaimed, mine, nationPages] = await Promise.all([
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
    db.realmPage.findMany({
      where: { realmId: { in: realmIds }, kind: "nation" },
      select: { realmId: true, title: true, wikiSource: true },
    }),
  ]);
  const claimablePages = new Map<string, number>();
  for (const page of await unclaimedNationPages(db, nationPages))
    claimablePages.set(page.realmId, (claimablePages.get(page.realmId) ?? 0) + 1);

  const since = new Date(Date.now() - FORUM_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const countBy = (rows: Array<{ realmId: string; _count: { _all: number } }>) =>
    new Map(rows.map((row) => [row.realmId, row._count._all]));
  const unclaimedBy = countBy(unclaimed);
  const mineBy = countBy(mine);

  return Promise.all(
    realms.map(async ({ settings, _count, foundedAt, createdAt, ...realm }) => ({
      ...realm,
      foundedAt: foundedAt ?? createdAt,
      nationCount: _count.countries,
      openNationCount: unclaimedBy.get(realm.id) ?? 0,
      /** Lore-index nation pages no country has taken yet (claimable through `realms.claimNationPage`). */
      openNationPageCount: claimablePages.get(realm.id) ?? 0,
      myNationCount: mineBy.get(realm.id) ?? 0,
      maxNationsPerUser: realmSettings(settings).maxNationsPerUser,
      /** Forum activity in the realm's section: posts in the last week and the latest thread activity. */
      board: await forumActivity(db, realm.id, since),
    }))
  );
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
