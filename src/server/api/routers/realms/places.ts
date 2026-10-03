/**
 * Realms as places: the realm directory (/realms) and each realm's board (/r/[realm]/board), the
 * NationStates regional message board built on the ThinkTank primitive (see thinktanks/realm-board.ts).
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { realmSettings } from "~/server/modules/realms/realms.settings";
import {
  ensureRealmBoard,
  getRealmBoardAccess,
  groupPostTag,
  syncRealmBoardMembers,
} from "~/server/api/routers/thinkpages/thinktanks/realm-board";

/** How far back "board activity" in the directory looks. */
const BOARD_ACTIVITY_WINDOW_DAYS = 7;

/** Realms the directory lists: active public realms, plus IxWorld whatever its row says. */
export const DIRECTORY_REALM_WHERE = {
  OR: [{ id: DEFAULT_REALM_ID }, { visibility: "public", status: "active" }],
};

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
      settings: true,
      _count: { select: { countries: true } },
    },
  });
  const realmIds = realms.map((r) => r.id);
  if (realmIds.length === 0) return [];

  const [unclaimed, mine, boards] = await Promise.all([
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
  ]);

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

  return realms.map(({ settings, _count, ...realm }) => ({
    ...realm,
    nationCount: _count.countries,
    openNationCount: unclaimedBy.get(realm.id) ?? 0,
    myNationCount: mineBy.get(realm.id) ?? 0,
    maxNationsPerUser: realmSettings(settings).maxNationsPerUser,
    /** Null until someone opens the board for the first time. */
    board: activity.get(realm.id) ?? null,
  }));
}

/**
 * Open a realm's board: create it on first use, bring the caller's membership in line with the nations
 * they own there (and drop members who no longer own one), and say what the caller may do.
 */
export async function openRealmBoard(db: PrismaClient, slug: string, clerkUserId: string | null) {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!realm) throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });

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
