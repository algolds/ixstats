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
