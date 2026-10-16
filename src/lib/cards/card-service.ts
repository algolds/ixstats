// src/lib/card-service.ts
// Card service layer for IxCards Phase 1

import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { CardFinish, type CardRarity } from "./enums";
import { mintCopy } from "./mint";
import { nsBankValue } from "./ns-facts";
import { computeCardValue, getValuationConfig } from "./valuation";

/**
 * Get user's card inventory via CardOwnership
 * @param db - Prisma client instance
 * @param userId - User ID
 * @param sortBy - Sort option
 * @param filterRarity - Optional rarity filter
 * @returns User's cards
 */
export async function getUserCards(
  db: PrismaClient,
  userId: string,
  sortBy?: "rarity" | "acquired" | "value",
  filterRarity?: CardRarity
) {
  try {
    if (!userId || userId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User ID is required",
      });
    }

    const where: any = {
      ownerId: userId,
      cards: {
        isRetired: false,
        ...(filterRarity && { rarity: filterRarity }),
      },
    };

    let orderBy: any = [];
    if (sortBy === "rarity") {
      orderBy = [{ cards: { rarity: "desc" } }, { cards: { marketValue: "desc" } }];
    } else if (sortBy === "value") {
      orderBy = [{ cards: { marketValue: "desc" } }];
    } else {
      // Default to acquired date
      orderBy = [{ acquiredAt: "desc" }];
    }

    const ownerships = await db.cardOwnership.findMany({
      where,
      include: {
        cards: true,
      },
      orderBy,
    });

    return ownerships;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error fetching user cards:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch user cards",
    });
  }
}

/**
 * Calculate card market value based on supply/demand
 * @param db - Prisma client instance
 * @param cardId - Card ID
 * @returns Market value
 */
export async function getCardMarketValue(db: PrismaClient, cardId: string): Promise<number> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card ID is required",
      });
    }

    const card = await db.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Card not found",
      });
    }

    // One valuation: max(rarityFloor × typeMult, NS bank value × premium); the bank value lives in metadata.nsData
    const cfg = await getValuationConfig(db);
    return computeCardValue(
      { rarity: card.rarity, cardType: card.cardType, nsMarketValue: nsBankValue(card.metadata) },
      cfg
    );
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error calculating market value:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to calculate market value",
    });
  }
}

/**
 * Mints an achievement's reward card for its new holder: one bound copy per award (cards refresh §2.1), through
 * `mintCopy` (source ACHIEVEMENT). `userId` may be a database or a Clerk id.
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
      mintCopy(tx, { cardId, ownerId: user.id, finish: CardFinish.STANDARD, source: "ACHIEVEMENT" })
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
