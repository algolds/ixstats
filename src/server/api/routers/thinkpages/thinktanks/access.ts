/**
 * ThinkTank access rules, shared by the groups, membership and documents routers.
 *
 * The acting user is always `ctx.auth.userId`. A member is anyone with an active ThinktankMember
 * row (or the group's creator). Managers are the owner and group admins (`role` "owner"/"admin").
 * Non-public groups (`private`, `invite_only`) are readable by members only.
 * Realm boards (`realm_board`) follow nation ownership instead of member rows: see ./realm-board.ts.
 */
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  getRealmBoardAccess,
  isRealmBoard,
  REALM_BOARD_PUBLIC_READ,
  REALM_BOARD_TYPE,
} from "./realm-board";

type AccessDb = Pick<
  PrismaClient,
  "thinktankGroup" | "thinktankMember" | "realmBoard" | "realm" | "user" | "country"
>;
type AccountDb = Pick<PrismaClient, "thinkpagesAccount">;

export const GROUP_MANAGER_ROLES = ["owner", "admin"] as const;

export interface GroupAccess<G> {
  group: G;
  isMember: boolean;
  isManager: boolean;
  role: string | null;
}

interface GroupLike {
  id: string;
  type: string;
  createdBy: string;
  isActive: boolean;
}

/** Membership and role of `userId` in `group` (null userId = signed out). */
export async function getGroupAccess<G extends GroupLike>(
  db: AccessDb,
  group: G,
  userId: string | null | undefined
): Promise<GroupAccess<G>> {
  if (isRealmBoard(group)) {
    const { isMember, isManager, role } = await getRealmBoardAccess(db, group.id, userId);
    return { group, isMember, isManager, role };
  }
  if (!userId) return { group, isMember: false, isManager: false, role: null };

  const member = await db.thinktankMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
    select: { role: true, isActive: true },
  });
  const isCreator = group.createdBy === userId;
  const activeRole = member?.isActive ? member.role : null;
  const role = isCreator ? "owner" : activeRole;

  return {
    group,
    isMember: isCreator || Boolean(activeRole),
    isManager: isCreator || (GROUP_MANAGER_ROLES as readonly string[]).includes(activeRole ?? ""),
    role,
  };
}

/** Public groups (and realm boards) are readable by anyone; other groups by their members only. */
export function canReadGroup(access: GroupAccess<GroupLike>): boolean {
  return canReadGroupType(access.group.type) || access.isMember;
}

/** Whether a group of this type is readable by non-members. */
export function canReadGroupType(type: string): boolean {
  return type === "public" || (type === REALM_BOARD_TYPE && REALM_BOARD_PUBLIC_READ);
}

async function loadActiveGroup(db: AccessDb, groupId: string) {
  const group = await db.thinktankGroup.findUnique({ where: { id: groupId } });
  if (!group || !group.isActive) {
    throw new TRPCError({ code: "NOT_FOUND", message: "ThinkTank group not found" });
  }
  return group;
}

/** Load an active group the caller may read, or throw NOT_FOUND / FORBIDDEN. */
export async function requireGroupReader(
  db: AccessDb,
  groupId: string,
  userId: string | null | undefined
) {
  const access = await getGroupAccess(db, await loadActiveGroup(db, groupId), userId);
  if (!canReadGroup(access)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This ThinkTank is only visible to its members",
    });
  }
  return access;
}

/** Load an active group the caller is a member of, or throw NOT_FOUND / FORBIDDEN. */
export async function requireGroupMember(db: AccessDb, groupId: string, userId: string) {
  const access = await getGroupAccess(db, await loadActiveGroup(db, groupId), userId);
  if (!access.isMember) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this group" });
  }
  return access;
}

/** Load an active group the caller owns or administers, or throw NOT_FOUND / FORBIDDEN. */
export async function requireGroupManager(db: AccessDb, groupId: string, userId: string) {
  const access = await getGroupAccess(db, await loadActiveGroup(db, groupId), userId);
  if (!access.isManager) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the group owner or a group admin can do this",
    });
  }
  return access;
}

/**
 * Posting as a persona: the group must allow persona posting and the ThinkPages account must be
 * one of the caller's own active accounts. Throws FORBIDDEN otherwise.
 */
export async function requirePersonaAccount(
  db: AccountDb,
  group: { settings: string | null },
  accountId: string,
  userId: string
) {
  let allowPersonaPosting = false;
  try {
    allowPersonaPosting = Boolean(group.settings && JSON.parse(group.settings).allowPersonaPosting);
  } catch {
    allowPersonaPosting = false;
  }
  if (!allowPersonaPosting) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This group does not allow posting as a persona account",
    });
  }
  const ownAccount = await db.thinkpagesAccount.findFirst({
    where: { id: accountId, clerkUserId: userId, isActive: true },
    select: { id: true },
  });
  if (!ownAccount) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only post as your own ThinkPages accounts",
    });
  }
}
