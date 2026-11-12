/**
 * Who may be joined to a ThinkTank chat they hold no participant row in.
 */
import type { PrismaClient } from "@prisma/client";
import { getRealmBoardAccess, isRealmBoard } from "~/server/shared/realm-board";

type EnrollmentDb = Pick<
  PrismaClient,
  | "thinktankGroup"
  | "conversationParticipant"
  | "realmBoard"
  | "realm"
  | "user"
  | "country"
  | "realmOfficer"
  | "realmBoardBan"
  | "realmClaim"
>;

/**
 * Joins `actorId` to the conversation when they are an active member of the active ThinkTank that owns it (membership
 * sync in thinktanks/membership.ts normally writes the row on join already), and, for a realm board, only while the
 * board still counts them a member (a banned nation's owner is not). Anyone else gets null: non-members, members who
 * left, and every caller of a conversation no ThinkTank owns, such as a group DM.
 */
export async function enrollThinktankMember(
  db: EnrollmentDb,
  actorId: string,
  conversationId: string
) {
  const group = await db.thinktankGroup.findFirst({
    where: {
      conversationId,
      isActive: true,
      members: { some: { userId: actorId, isActive: true } },
    },
    select: { id: true, type: true },
  });
  if (!group) return null;
  if (isRealmBoard(group) && !(await getRealmBoardAccess(db, group.id, actorId)).isMember) {
    return null;
  }

  return db.conversationParticipant
    .upsert({
      where: { conversationId_userId: { conversationId, userId: actorId } },
      create: { conversationId, userId: actorId, role: "participant" },
      update: { isActive: true, leftAt: null },
      include: { conversation: true },
    })
    .catch(() => null);
}

/**
 * Whether `actorId` has lost the right to read a realm board's chat although a participant row remains: the board
 * no longer counts them a member (their nation was banned, or they gave the nation up). Any other conversation, and
 * any other ThinkTank chat, is never revoked here.
 */
export async function realmBoardChatRevoked(
  db: EnrollmentDb,
  conversation: { source?: string | null; sourceId?: string | null },
  actorId: string
): Promise<boolean> {
  if (conversation.source !== "thinktank" || !conversation.sourceId) return false;
  const group = await db.thinktankGroup.findUnique({
    where: { id: conversation.sourceId },
    select: { id: true, type: true },
  });
  if (!group || !isRealmBoard(group)) return false;
  return !(await getRealmBoardAccess(db, group.id, actorId)).isMember;
}
