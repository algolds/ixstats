// src/lib/card-service.ts
// Card service layer for IxCards Phase 1

import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { CardRarity } from "./enums";
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

    // Unified valuation: max(rarityFloor × typeMult, nsValue × premium). See card-valuation.ts.
    const cfg = await getValuationConfig(db);
    const nsMarketValue = parseFloat(String((card.stats as any)?.marketValue ?? "")) || null;
    return computeCardValue({ rarity: card.rarity, cardType: card.cardType, nsMarketValue }, cfg);
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
 * Award a card to a user for achievement unlock
 * Creates CardOwnership record with ACHIEVEMENT acquire method
 * @param db - Prisma client instance
 * @param userId - User ID (database id or clerk id)
 * @param cardId - Card ID to award
 * @param achievementId - Achievement ID for context
 * @param achievementTitle - Achievement title for logging
 * @returns Created CardOwnership record
 */
export async function awardAchievementCard(
  db: PrismaClient,
  userId: string,
  cardId: string,
  achievementId: string,
  achievementTitle: string
) {
  try {
    // Validate inputs
    if (!userId || userId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User ID is required",
      });
    }

    if (!cardId || cardId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card ID is required",
      });
    }

    // Find user (handles both database id and clerk id)
    const user = await db.user.findFirst({
      where: {
        OR: [{ id: userId }, { clerkUserId: userId }],
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Verify card exists
    const card = await db.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Card not found",
      });
    }

    // Check if user already owns this card
    const existingOwnership = await db.cardOwnership.findFirst({
      where: {
        userId: user.id,
        cardId,
      },
    });

    if (existingOwnership) {
      // Increment quantity if already owned
      const updated = await db.cardOwnership.update({
        where: { id: existingOwnership.id },
        data: {
          quantity: existingOwnership.quantity + 1,
          updatedAt: new Date(),
        },
        include: {
          cards: true,
        },
      });

      console.log(
        `[CARD_SERVICE] Incremented card quantity for user ${user.id}: ${card.title} (${achievementTitle})`
      );

      return updated;
    }

    // Get next serial number for this card
    const maxSerial = await db.cardOwnership.findFirst({
      where: { cardId },
      orderBy: { serialNumber: "desc" },
      select: { serialNumber: true },
    });

    const nextSerial = (maxSerial?.serialNumber || 0) + 1;

    // Create new ownership record
    const ownership = await db.cardOwnership.create({
      data: {
        id: `card_own_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        ownerId: user.id,
        cardId,
        serialNumber: nextSerial,
        quantity: 1,
        level: 1,
        experience: 0,
        isLocked: true, // Lock achievement cards by default to prevent accidental trade
        acquiredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        cards: true,
      },
    });

    // Log the award to activity feed (best effort, non-blocking)
    // TODO: Re-enable when Activity model is added to Prisma schema
    try {
      // await (db as any).activity.create({
      //   data: {
      //     userId: user.clerkUserId,
      //     activityType: "CARD_ACQUIRED",
      //     title: "Achievement Card Unlocked",
      //     description: `Received commemorative card "${card.title}" for unlocking ${achievementTitle}`,
      //     metadata: {
      //       cardId: card.id,
      //       cardTitle: card.title,
      //       cardRarity: card.rarity,
      //       achievementId,
      //       achievementTitle,
      //       acquireMethod: AcquireMethod.ACHIEVEMENT,
      //       serialNumber: nextSerial,
      //     },
      //   },
      // });
      console.log("[CARD_SERVICE] Achievement card awarded (activity logging disabled)");
    } catch (activityError) {
      console.error("[CARD_SERVICE] Failed to log card award activity:", activityError);
    }

    console.log(
      `[CARD_SERVICE] Awarded card to user ${user.id}: ${card.title} #${nextSerial} (${achievementTitle})`
    );

    return ownership;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error awarding achievement card:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to award achievement card",
    });
  }
}
