/**
 * Realm boards — the NationStates regional message board, built on the ThinkTank primitive.
 *
 * Each realm gets one ThinktankGroup of type `realm_board` (mapped by `RealmBoard`), created the first
 * time someone opens it. Access follows nation ownership, not invites:
 *  - anyone may read the board feed (realms are never private — decision 19), see REALM_BOARD_PUBLIC_READ;
 *  - owners of a nation in the realm are members: they post, chat and write docs;
 *  - realm moderators (site admins and the realm's founder, `canModerateRealm`) manage it.
 * ThinktankMember rows are kept in step with ownership when the board is opened (`openRealmBoard`) so
 * the group chat (a ThinkShare conversation) and the roster work unchanged.
 */
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { canModerateRealm } from "~/server/modules/realms/realms.access";
import { parsePrismaError } from "~/lib/prisma-error";

export const REALM_BOARD_TYPE = "realm_board";

/** Whether non-members may read a realm board's feed. Posting always needs a nation in the realm. */
export const REALM_BOARD_PUBLIC_READ = true;

/** Board posts carry this pseudo-hashtag, like every ThinkTank group post. */
export const groupPostTag = (groupId: string) => `group:${groupId}`;

export const isRealmBoard = (group: { type: string }) => group.type === REALM_BOARD_TYPE;

type BoardDb = Pick<PrismaClient, "realmBoard" | "realm" | "user" | "country">;

export interface RealmBoardAccess {
  isMember: boolean;
  isManager: boolean;
  role: string | null;
  realmId: string | null;
  /** The caller's nations in the realm (empty when signed out or they own none). */
  ownedCountryIds: string[];
}

const NO_ACCESS: RealmBoardAccess = {
  isMember: false,
  isManager: false,
  role: null,
  realmId: null,
  ownedCountryIds: [],
};

/** Access of `clerkUserId` to the board group `groupId`, from nation ownership and realm moderation. */
export async function getRealmBoardAccess(
  db: BoardDb,
  groupId: string,
  clerkUserId: string | null | undefined
): Promise<RealmBoardAccess> {
  const board = await db.realmBoard.findUnique({ where: { groupId }, select: { realmId: true } });
  if (!board) return NO_ACCESS;
  if (!clerkUserId) return { ...NO_ACCESS, realmId: board.realmId };

  const [realm, user] = await Promise.all([
    db.realm.findUnique({ where: { id: board.realmId }, select: { ownerId: true } }),
    db.user.findUnique({
      where: { clerkUserId },
      select: { id: true, clerkUserId: true, role: { select: { name: true, level: true } } },
    }),
  ]);
  if (!realm || !user) return { ...NO_ACCESS, realmId: board.realmId };

  const owned = await db.country.findMany({
    where: { realmId: board.realmId, ownerUserId: user.id },
    select: { id: true },
  });
  const ownedCountryIds = owned.map((c) => c.id);
  const isManager = canModerateRealm(user, realm);
  const isMember = isManager || ownedCountryIds.length > 0;
  const role =
    realm.ownerId === clerkUserId ? "owner" : isManager ? "admin" : isMember ? "member" : null;
  return { isMember, isManager, role, realmId: board.realmId, ownedCountryIds };
}

type EnsureDb = Pick<
  PrismaClient,
  "realmBoard" | "thinktankGroup" | "thinkshareConversation" | "$transaction"
>;

/** The realm's board group, created (with its chat conversation) on first use. Safe under races. */
export async function ensureRealmBoard(
  db: EnsureDb,
  realm: { id: string; name: string; ownerId: string }
): Promise<{ groupId: string; created: boolean }> {
  const existing = await db.realmBoard.findUnique({
    where: { realmId: realm.id },
    select: { groupId: true },
  });
  if (existing) return { groupId: existing.groupId, created: false };

  try {
    const groupId = await db.$transaction(async (tx) => {
      const name = `${realm.name} Board`;
      const conversation = await tx.thinkshareConversation.create({
        data: { type: "group", name, source: "thinktank" },
      });
      const group = await tx.thinktankGroup.create({
        data: {
          name,
          description: `The regional board of ${realm.name}: open to every nation of the realm.`,
          type: REALM_BOARD_TYPE,
          createdBy: realm.ownerId,
          memberCount: 0,
          conversationId: conversation.id,
          // Nations post as their personas; the persona's country must be in the realm.
          settings: JSON.stringify({ allowPersonaPosting: true }),
        },
      });
      await tx.thinkshareConversation.update({
        where: { id: conversation.id },
        data: { sourceId: group.id },
      });
      await tx.realmBoard.create({ data: { realmId: realm.id, groupId: group.id } });
      return group.id;
    });
    return { groupId, created: true };
  } catch (error) {
    // Someone else opened the board first: their transaction won, ours rolled back.
    if (parsePrismaError(error)?.type !== "unique_constraint") throw error;
    const winner = await db.realmBoard.findUnique({
      where: { realmId: realm.id },
      select: { groupId: true },
    });
    if (!winner) throw error;
    return { groupId: winner.groupId, created: false };
  }
}

type SyncDb = Pick<
  PrismaClient,
  "thinktankMember" | "thinktankGroup" | "conversationParticipant" | "country"
>;

/**
 * Keep ThinktankMember rows (and the chat's participants) in step with nation ownership:
 *  - the caller joins on first open when they are a member (a later "Leave" is respected);
 *  - members who no longer own a nation in the realm, and are not its founder, are deactivated.
 */
export async function syncRealmBoardMembers(
  db: SyncDb,
  board: { groupId: string; realmId: string; conversationId: string | null; realmOwnerId: string },
  caller: { clerkUserId: string; access: RealmBoardAccess } | null
): Promise<void> {
  const [members, owners] = await Promise.all([
    db.thinktankMember.findMany({
      where: { groupId: board.groupId },
      select: { id: true, userId: true, isActive: true },
    }),
    db.country.findMany({
      where: { realmId: board.realmId, ownerUserId: { not: null } },
      select: { owner: { select: { clerkUserId: true } } },
    }),
  ]);
  const ownerIds = new Set(owners.map((c) => c.owner?.clerkUserId).filter(Boolean));

  const keep = (userId: string) =>
    ownerIds.has(userId) ||
    userId === board.realmOwnerId ||
    (caller?.clerkUserId === userId && caller.access.isMember);
  const stale = members.filter((m) => m.isActive && !keep(m.userId)).map((m) => m.userId);

  if (stale.length > 0) {
    await db.thinktankMember.updateMany({
      where: { groupId: board.groupId, userId: { in: stale } },
      data: { isActive: false },
    });
    if (board.conversationId) {
      await db.conversationParticipant.updateMany({
        where: { conversationId: board.conversationId, userId: { in: stale } },
        data: { isActive: false, leftAt: new Date() },
      });
    }
  }

  let joined = false;
  const callerRow = caller && members.find((m) => m.userId === caller.clerkUserId);
  if (caller?.access.isMember && !callerRow) {
    await db.thinktankMember.create({
      data: {
        groupId: board.groupId,
        userId: caller.clerkUserId,
        role: caller.access.isManager ? "admin" : "member",
      },
    });
    if (board.conversationId) {
      await db.conversationParticipant.upsert({
        where: {
          conversationId_userId: {
            conversationId: board.conversationId,
            userId: caller.clerkUserId,
          },
        },
        create: {
          conversationId: board.conversationId,
          userId: caller.clerkUserId,
          role: caller.access.isManager ? "admin" : "participant",
        },
        update: { isActive: true, leftAt: null },
      });
    }
    joined = true;
  }

  if (stale.length > 0 || joined) {
    const memberCount = members.filter((m) => m.isActive && !stale.includes(m.userId)).length;
    await db.thinktankGroup.update({
      where: { id: board.groupId },
      data: { memberCount: memberCount + (joined ? 1 : 0) },
    });
  }
}

/**
 * A persona posting to a realm board must speak for a nation of that realm. Throws FORBIDDEN otherwise.
 */
export async function requireRealmPersona(
  db: Pick<PrismaClient, "thinkpagesAccount">,
  accountId: string,
  realmId: string
): Promise<void> {
  const account = await db.thinkpagesAccount.findFirst({
    where: { id: accountId, country: { realmId } },
    select: { id: true },
  });
  if (!account) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Post to a realm board as a persona of one of the realm's nations",
    });
  }
}

/**
 * The persona a realm-board post "as yourself" goes out under: the caller's oldest active persona of a
 * nation they own in the realm, or a new citizen persona of their first such nation.
 */
export async function realmBoardPersona(
  db: Pick<PrismaClient, "thinkpagesAccount" | "country">,
  clerkUserId: string,
  ownedCountryIds: string[]
): Promise<string> {
  const existing = await db.thinkpagesAccount.findFirst({
    where: { clerkUserId, isActive: true, countryId: { in: ownedCountryIds } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const countryId = ownedCountryIds[0]!;
  const nation = await db.country.findUnique({ where: { id: countryId }, select: { name: true } });
  const name = nation?.name ?? "Citizen";
  const handle =
    name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "citizen";
  const created = await db.thinkpagesAccount.create({
    data: {
      clerkUserId,
      countryId,
      accountType: "citizen",
      username: `${handle}_${Date.now().toString().slice(-4)}`,
      displayName: name,
      firstName: name,
      lastName: "",
      bio: "User Account",
    },
    select: { id: true },
  });
  return created.id;
}
