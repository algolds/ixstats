// src/lib/card-service.ts
// Card service layer for IxCards Phase 1

import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { mintCopy } from "./mint";

/**
 * Mints an achievement's reward card for its new holder: one bound copy per award (cards refresh §2.1), through
 * `mintCopy` (source ACHIEVEMENT), its finish rolled. A reward never checks capacity (§3). `userId` may be a database
 * or a Clerk id.
 */
export async function awardAchievementCard(
  db: PrismaClient,
  userId: string,
  cardId: string,
  achievementId: string,
  achievementTitle: string
) {
  try {
    if (!userId?.trim())
      throw new TRPCError({ code: "BAD_REQUEST", message: "User ID is required" });
    if (!cardId?.trim())
      throw new TRPCError({ code: "BAD_REQUEST", message: "Card ID is required" });

    const user = await db.user.findFirst({
      where: { OR: [{ id: userId }, { clerkUserId: userId }] },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    const card = await db.card.findUnique({ where: { id: cardId } });
    if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });

    const ownership = await db.$transaction((tx) =>
      mintCopy(tx, { cardId, ownerId: user.id, source: "ACHIEVEMENT" })
    );
    console.log(
      `[CARD_SERVICE] Awarded ${card.title} #${ownership.serialNumber} to user ${user.id} (${achievementId}: ${achievementTitle})`
    );
    return ownership;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[CARD_SERVICE] Error awarding achievement card:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to award achievement card",
    });
  }
}
