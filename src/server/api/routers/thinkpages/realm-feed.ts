/**
 * The realm filter of the ThinkPages feed: public posts by personas whose nation is in the realm, plus
 * the posts on the realm's board (ThinkTank posts, readable by anyone — see thinktanks/realm-board.ts).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { groupPostTag, REALM_BOARD_PUBLIC_READ } from "./thinktanks/realm-board";

export async function realmFeedWhere(
  db: Pick<PrismaClient, "realmBoard">,
  realmId: string
): Promise<Prisma.ThinkpagesPostWhereInput> {
  const byNation: Prisma.ThinkpagesPostWhereInput = {
    visibility: "public",
    account: { country: { realmId } },
  };
  if (!REALM_BOARD_PUBLIC_READ) return byNation;
  const board = await db.realmBoard.findUnique({ where: { realmId }, select: { groupId: true } });
  if (!board) return byNation;
  return {
    OR: [
      byNation,
      { visibility: "thinktank", hashtags: { contains: `"${groupPostTag(board.groupId)}"` } },
    ],
  };
}
