/**
 * Realm boards — the NationStates regional message board, built on the ThinkTank primitive.
 *
 * Each realm gets one ThinktankGroup of type `realm_board` (mapped by `RealmBoard`), created the first
 * time someone opens it. Access follows nation ownership, not invites:
 *  - anyone may read the board feed (realms are never private — decision 19), see REALM_BOARD_PUBLIC_READ;
 *  - owners of a nation in the realm are members: they post, chat and write docs;
 *  - realm moderators (site admins, the realm's founder and officers with the `board` power) manage it;
 *  - a nation muted on the board cannot post; a banned nation's owner is not a member (no posts, no chat).
 * ThinktankMember rows are kept in step with ownership when the board is opened (`openRealmBoard`) so
 * the group chat (a ThinkShare conversation) and the roster work unchanged.
 */
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { hasRealmPower } from "~/server/modules/realms/realms.access";
import { parsePrismaError } from "~/lib/prisma-error";
import { embassyPostTag } from "~/lib/realms/realm-region";

export const REALM_BOARD_TYPE = "realm_board";

/** Whether non-members may read a realm board's feed. Posting always needs a nation in the realm. */
export const REALM_BOARD_PUBLIC_READ = true;

/** Board posts carry this pseudo-hashtag, like every ThinkTank group post. */
export const groupPostTag = (groupId: string) => `group:${groupId}`;

export const isRealmBoard = (group: { type: string }) => group.type === REALM_BOARD_TYPE;

type BoardDb = Pick<
  PrismaClient,
  "realmBoard" | "realm" | "user" | "country" | "realmOfficer" | "realmBoardBan"
>;

interface RealmBoardRestriction {
  kind: "mute" | "ban";
  until: Date | null;
  reason: string | null;
}

interface RealmBoardAccess {
  isMember: boolean;
  isManager: boolean;
  role: string | null;
  realmId: string | null;
  /** The caller's nations in the realm (empty when signed out or they own none). */
  ownedCountryIds: string[];
  /** A mute or ban on one of the caller's nations; a ban outranks a mute. Never set for managers. */
  restriction: RealmBoardRestriction | null;
}

const NO_ACCESS: RealmBoardAccess = {
  isMember: false,
  isManager: false,
  role: null,
  realmId: null,
  ownedCountryIds: [],
  restriction: null,
};

/** Board mutes and bans in force on any of `countryIds` (expired ones are ignored). */
export async function activeBoardRestrictions(
  db: Pick<PrismaClient, "realmBoardBan">,
  realmId: string,
  countryIds: string[]
) {
  if (countryIds.length === 0) return [];
  return db.realmBoardBan.findMany({
    where: {
      realmId,
      countryId: { in: countryIds },
      OR: [{ until: null }, { until: { gt: new Date() } }],
    },
    select: { countryId: true, kind: true, until: true, reason: true },
  });
}

/** The strongest of `rows`: any ban over a mute, then the one that lasts longest. */
export function strongestRestriction(
  rows: Array<{ kind: string; until: Date | null; reason: string | null }>
): RealmBoardRestriction | null {
  const rank = (r: { kind: string; until: Date | null }) =>
    (r.kind === "ban" ? 2 : 1) * 1e15 + (r.until ? r.until.getTime() : 1e15 - 1);
  const top = [...rows].sort((a, b) => rank(b) - rank(a))[0];
  if (!top) return null;
  return { kind: top.kind === "ban" ? "ban" : "mute", until: top.until, reason: top.reason };
}

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

  const [owned, officers] = await Promise.all([
    db.country.findMany({
      where: { realmId: board.realmId, ownerUserId: user.id },
      select: { id: true },
    }),
    db.realmOfficer.findMany({
      where: { realmId: board.realmId, userId: clerkUserId },
      select: { userId: true, powers: true },
    }),
  ]);
  const ownedCountryIds = owned.map((c) => c.id);
  const isManager = hasRealmPower(user, realm, officers, "board");
  const restriction = isManager
    ? null
    : strongestRestriction(await activeBoardRestrictions(db, board.realmId, ownedCountryIds));
  const isMember = isManager || (ownedCountryIds.length > 0 && restriction?.kind !== "ban");
  const role =
    realm.ownerId === clerkUserId ? "owner" : isManager ? "admin" : isMember ? "member" : null;
  return { isMember, isManager, role, realmId: board.realmId, ownedCountryIds, restriction };
}

/** A message for a restricted caller ("…until 12 Oct"), or null when they may post. */
export function boardRestrictionMessage(restriction: RealmBoardRestriction | null): string | null {
  if (!restriction) return null;
  const until = restriction.until
    ? ` until ${restriction.until.toISOString().slice(0, 10)}`
    : " until a moderator lifts it";
  const verb = restriction.kind === "ban" ? "banned from" : "muted on";
  return `Your nation is ${verb} this board${until}${restriction.reason ? `: ${restriction.reason}` : ""}`;
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
  "thinktankMember" | "thinktankGroup" | "conversationParticipant" | "country" | "realmBoardBan"
>;

/**
 * Keep ThinktankMember rows (and the chat's participants) in step with nation ownership:
 *  - the caller joins on first open when they are a member (a later "Leave" is respected);
 *  - members who no longer own a nation in the realm (or whose every nation there is banned from the board),
 *    and are not its founder, are deactivated.
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
      select: { id: true, owner: { select: { clerkUserId: true } } },
    }),
  ]);
  const banned = new Set(
    (
      await activeBoardRestrictions(
        db,
        board.realmId,
        owners.map((c) => c.id)
      )
    )
      .filter((r) => r.kind === "ban")
      .map((r) => r.countryId)
  );
  // A ban on any of a player's nations takes the player off the board (as getRealmBoardAccess decides).
  const bannedOwners = new Set(
    owners.filter((c) => banned.has(c.id)).map((c) => c.owner?.clerkUserId)
  );
  const ownerIds = new Set(
    owners.map((c) => c.owner?.clerkUserId).filter((id) => id && !bannedOwners.has(id))
  );

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

/** The realms `realmId` has an active embassy with, by id. */
export interface EmbassyPartner {
  id: string;
  name: string;
  slug: string;
}

export async function embassyPartners(
  db: Pick<PrismaClient, "realmEmbassy">,
  realmId: string
): Promise<Map<string, EmbassyPartner>> {
  const realm = { select: { id: true, name: true, slug: true } } as const;
  const rows = await db.realmEmbassy.findMany({
    where: { status: "active", OR: [{ fromRealmId: realmId }, { toRealmId: realmId }] },
    select: { fromRealmId: true, fromRealm: realm, toRealm: realm },
  });
  return new Map(
    rows.map((row) => {
      const partner = row.fromRealmId === realmId ? row.toRealm : row.fromRealm;
      return [partner.id, partner] as const;
    })
  );
}

/** The partner realm whose embassy tag a post carries, if any. */
export function embassySource(
  hashtags: string | null,
  partners: Map<string, EmbassyPartner>
): EmbassyPartner | null {
  if (!hashtags || partners.size === 0) return null;
  for (const [realmId, partner] of partners) {
    if (hashtags.includes(`"${embassyPostTag(realmId)}"`)) return partner;
  }
  return null;
}

/**
 * Where a group feed reads from: the group's own posts, plus — on a realm board — the embassy-flagged posts
 * of realms it has an active embassy with. `embassyFrom` labels those posts with their realm.
 */
export async function groupFeedScope(
  db: Pick<PrismaClient, "realmBoard" | "realmEmbassy">,
  group: { id: string; type: string }
) {
  const onGroup = { hashtags: { contains: `group:${group.id}` } };
  const board = isRealmBoard(group)
    ? await db.realmBoard.findUnique({ where: { groupId: group.id }, select: { realmId: true } })
    : null;
  const partners = board
    ? await embassyPartners(db, board.realmId)
    : new Map<string, EmbassyPartner>();
  /** The partner realm a post was cross-posted from, if any. */
  const embassyFrom = (hashtags: string | null) => embassySource(hashtags, partners);
  if (partners.size === 0) return { where: onGroup, embassyFrom };
  // Only posts made on the partner's own board, flagged for embassies there (the tags are set server-side).
  const partnerBoards = await db.realmBoard.findMany({
    where: { realmId: { in: [...partners.keys()] } },
    select: { realmId: true, groupId: true },
  });
  if (partnerBoards.length === 0) return { where: onGroup, embassyFrom };
  const embassyPosts = partnerBoards.map((b) => ({
    visibility: "thinktank",
    AND: [
      { hashtags: { contains: `"${groupPostTag(b.groupId)}"` } },
      { hashtags: { contains: `"${embassyPostTag(b.realmId)}"` } },
    ],
  }));
  return { where: { OR: [onGroup, ...embassyPosts] }, embassyFrom };
}

/**
 * A group post's tags: the caller's own (never a `group:` or `embassy:` pseudo-tag, which would place the post
 * on another board), the group's tag, and the realm's embassy tag when the post is flagged for embassies.
 */
export function groupPostTags(
  groupId: string,
  own: string[] = [],
  embassyRealmId?: string | false | null
) {
  const system = [
    groupPostTag(groupId),
    ...(embassyRealmId ? [embassyPostTag(embassyRealmId)] : []),
  ];
  return [...new Set([...ownHashtags(own), ...system])];
}

/**
 * The caller's access to a realm board they are posting to (null for any other group). Throws FORBIDDEN, with
 * the reason, when one of their nations is muted or banned on the board.
 */
export async function realmBoardPoster(
  db: BoardDb,
  group: { id: string; type: string },
  clerkUserId: string
): Promise<RealmBoardAccess | null> {
  if (!isRealmBoard(group)) return null;
  const access = await getRealmBoardAccess(db, group.id, clerkUserId);
  const restricted = boardRestrictionMessage(access.restriction);
  if (restricted) throw new TRPCError({ code: "FORBIDDEN", message: restricted });
  return access;
}

const PSEUDO_TAG = /^#?(group|embassy):/i;

/** The tags a caller may set: never a `group:` or `embassy:` pseudo-tag, which places a post on a board. */
export function ownHashtags(tags: string[] = []): string[] {
  return tags.filter((tag) => !PSEUDO_TAG.test(tag.trim()));
}

/** The pseudo-tags a stored post carries (`hashtags` is a JSON array), kept when its author edits the tags. */
export function storedPseudoTags(hashtags: string | null): string[] {
  try {
    const tags: unknown = JSON.parse(hashtags ?? "[]");
    return Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === "string" && PSEUDO_TAG.test(t))
      : [];
  } catch {
    return [];
  }
}

/**
 * Take a player off a realm's board at once (a ban): their member row and chat participant are deactivated,
 * rather than waiting for the next board open to sync them.
 */
export async function removeFromRealmBoard(
  db: Pick<
    PrismaClient,
    "realmBoard" | "thinktankGroup" | "thinktankMember" | "conversationParticipant"
  >,
  realmId: string,
  clerkUserId: string
): Promise<void> {
  const board = await db.realmBoard.findUnique({ where: { realmId }, select: { groupId: true } });
  if (!board) return;
  const group = await db.thinktankGroup.findUnique({
    where: { id: board.groupId },
    select: { conversationId: true },
  });
  const { count } = await db.thinktankMember.updateMany({
    where: { groupId: board.groupId, userId: clerkUserId, isActive: true },
    data: { isActive: false },
  });
  if (group?.conversationId) {
    await db.conversationParticipant.updateMany({
      where: { conversationId: group.conversationId, userId: clerkUserId, isActive: true },
      data: { isActive: false, leftAt: new Date() },
    });
  }
  if (count > 0) {
    await db.thinktankGroup.update({
      where: { id: board.groupId },
      data: { memberCount: { decrement: count } },
    });
  }
}
