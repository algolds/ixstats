// src/lib/card-service.ts
// Card service layer for IxCards Phase 1

import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { CardType, CardRarity, AcquireMethod } from "@prisma/client";

/**
 * Card creation input interface
 */
export interface CardCreationData {
  title: string;
  description?: string;
  artwork: string;
  artworkVariants?: any;
  cardType: CardType;
  rarity?: CardRarity;
  season: number;
  nsCardId?: number;
  nsSeason?: number;
  nsData?: any;
  wikiSource?: string;
  wikiArticleTitle?: string;
  wikiUrl?: string;
  countryId?: string;
  stats: any;
  totalSupply?: number;
  marketValue?: number;
  level?: number;
  evolutionStage?: number;
  enhancements?: any;
}

/**
 * Card filter interface for querying
 */
export interface CardFilters {
  season?: number;
  rarity?: CardRarity;
  type?: CardType;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated result interface
 */
export interface PaginatedCards {
  cards: any[];
  total: number;
  hasMore: boolean;
}

/**
 * Card stats interface for market data
 */
export interface CardStats {
  totalSupply: number;
  marketValue: number;
  recentTrades: any[];
}

/**
 * Rarity calculation input for nation cards
 */
interface NationCardInput {
  economicTier: number;
  leaderboardRank?: number;
  achievementCount: number;
  embassyCount: number;
  accountAge: number;
}

/**
 * Rarity calculation input for lore cards
 */
interface LoreCardInput {
  articleLength: number;
  referenceCount: number;
  isFeatured: boolean;
}

/**
 * NS rarity mapping
 */
const NS_RARITY_MAP: Record<string, number> = {
  common: 10,
  uncommon: 30,
  rare: 50,
  "ultra-rare": 70,
  epic: 85,
  legendary: 95,
};

/**
 * Create a new card with validation
 * @param db - Prisma client instance
 * @param cardData - Card creation data
 * @returns Created card
 */
export async function createCard(db: PrismaClient, cardData: CardCreationData) {
  try {
    // Defensive validation
    if (!cardData.title || cardData.title.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card title is required",
      });
    }

    if (!cardData.artwork || cardData.artwork.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card artwork URL is required",
      });
    }

    if (!cardData.cardType) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card type is required",
      });
    }

    if (!cardData.season || cardData.season < 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Valid season number is required",
      });
    }

    if (!cardData.stats) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card stats are required",
      });
    }

    // Calculate rarity if not provided
    const rarity = cardData.rarity || CardRarity.COMMON;

    // Create the card
    const card = await db.card.create({
      data: {
        title: cardData.title.trim(),
        description: cardData.description?.trim() || null,
        artwork: cardData.artwork.trim(),
        artworkVariants: cardData.artworkVariants || null,
        cardType: cardData.cardType,
        rarity,
        season: cardData.season,
        nsCardId: cardData.nsCardId || null,
        nsSeason: cardData.nsSeason || null,
        wikiSource: cardData.wikiSource || null,
        wikiArticleTitle: cardData.wikiArticleTitle || null,
        countryId: cardData.countryId || null,
        stats: cardData.stats,
        totalSupply: cardData.totalSupply || 0,
        marketValue: cardData.marketValue || 0,
        level: cardData.level || 1,
        enhancements: cardData.enhancements || null,
      },
    });

    return card;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error creating card:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create card",
    });
  }
}

/**
 * Get card by ID with full details
 * @param db - Prisma client instance
 * @param cardId - Card ID
 * @returns Card with full details or null
 */
export async function getCard(db: PrismaClient, cardId: string) {
  try {
    if (!cardId || cardId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card ID is required",
      });
    }

    const card = await db.card.findUnique({
      where: { id: cardId },
      include: {
        CardOwnership: {
          select: {
            userId: true,
            ownerId: true,
            acquiredAt: true,
            serialNumber: true,
          },
        },
      },
    });

    if (!card) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Card not found",
      });
    }

    return card;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error fetching card:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch card",
    });
  }
}

/**
 * Query cards with filters and pagination
 * @param db - Prisma client instance
 * @param filters - Card filters
 * @returns Paginated card results
 */
export async function getCards(
  db: PrismaClient,
  filters: CardFilters
): Promise<PaginatedCards> {
  try {
    const limit = Math.min(filters.limit || 20, 100); // Cap at 100
    const offset = Math.max(filters.offset || 0, 0);

    // Build where clause
    const where: any = {};

    if (filters.season !== undefined) {
      where.season = filters.season;
    }

    if (filters.rarity) {
      where.rarity = filters.rarity;
    }

    if (filters.type) {
      where.cardType = filters.type;
    }

    if (filters.search && filters.search.trim().length > 0) {
      where.OR = [
        { title: { contains: filters.search.trim(), mode: "insensitive" } },
        {
          description: { contains: filters.search.trim(), mode: "insensitive" },
        },
      ];
    }

    // Get total count and cards in parallel
    const [total, cards] = await Promise.all([
      db.card.count({ where }),
      db.card.findMany({
        where,
        orderBy: [
          { rarity: "desc" },
          { marketValue: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      cards,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    console.error("[CARD_SERVICE] Error querying cards:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to query cards",
    });
  }
}

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
    };

    if (filterRarity) {
      where.cards = {
        rarity: filterRarity,
      };
    }

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
 * Calculate card rarity based on card type and metrics
 * Implementation of algorithm from IXCARDS_IMPLEMENTATION_PLAN.md lines 523-558
 * @param cardInput - Card metrics for rarity calculation
 * @returns Calculated rarity
 */
export function calculateCardRarity(cardInput: {
  type: CardType;
  economicTier?: number;
  leaderboardRank?: number;
  achievementCount?: number;
  embassyCount?: number;
  accountAge?: number;
  articleLength?: number;
  referenceCount?: number;
  isFeatured?: boolean;
  nsRarity?: string;
}): CardRarity {
  let rarityScore = 0;

  // For nation cards
  if (cardInput.type === CardType.NATION) {
    // Economic tier: Tier 1 = 20 points, Tier 7 = 140 points (inverted scale)
    const economicTier = cardInput.economicTier || 7;
    rarityScore += (8 - economicTier) * 20; // Higher tier = more points

    // Leaderboard rank: Top ranks get more points
    if (cardInput.leaderboardRank) {
      rarityScore += (1000 - cardInput.leaderboardRank) / 10;
    }

    // Achievements: 2 points each
    rarityScore += (cardInput.achievementCount || 0) * 2;

    // Embassy count: 3 points each
    rarityScore += (cardInput.embassyCount || 0) * 3;

    // Veteran bonus: 15 points for nations over 1 year old
    if ((cardInput.accountAge || 0) > 365) {
      rarityScore += 15;
    }
  }

  // For lore cards
  if (cardInput.type === CardType.LORE) {
    // Article length: 1 point per 100 characters
    rarityScore += (cardInput.articleLength || 0) / 100;

    // References: 5 points each
    rarityScore += (cardInput.referenceCount || 0) * 5;

    // Featured article: 50 points
    if (cardInput.isFeatured) {
      rarityScore += 50;
    }
  }

  // For NS import cards
  if (cardInput.type === CardType.NS_IMPORT && cardInput.nsRarity) {
    rarityScore = NS_RARITY_MAP[cardInput.nsRarity.toLowerCase()] || 10;
  }

  // Special cards default to rare
  if (cardInput.type === CardType.SPECIAL) {
    rarityScore = Math.max(rarityScore, 50); // At least ULTRA_RARE
  }

  // Map score to rarity tiers
  if (rarityScore >= 90) return CardRarity.LEGENDARY;
  if (rarityScore >= 70) return CardRarity.EPIC;
  if (rarityScore >= 50) return CardRarity.ULTRA_RARE;
  if (rarityScore >= 30) return CardRarity.RARE;
  if (rarityScore >= 15) return CardRarity.UNCOMMON;
  return CardRarity.COMMON;
}

/**
 * Update card stats from nation data
 * @param db - Prisma client instance
 * @param cardId - Card ID
 * @returns Updated card
 */
export async function updateCardStats(db: PrismaClient, cardId: string) {
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

    // Only update nation cards
    if (card.cardType !== CardType.NATION || !card.countryId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only nation cards can have stats updated from nation data",
      });
    }

    // Fetch country data separately
    const country = await db.country.findUnique({
      where: { id: card.countryId },
    });

    if (!country) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Country not found for this card",
      });
    }

    // Calculate new stats from country data
    const newStats = {
      economic: Math.min(
        100,
        Math.floor((country.currentGdpPerCapita || 0) / 1000)
      ),
      diplomatic: Math.min(100, 50), // TODO: Calculate from embassy count when available
      military: Math.min(100, 60), // TODO: Calculate from defense data when available
      social: Math.min(100, 55), // TODO: Calculate from ThinkPages data when available
    };

    // Update card
    const updatedCard = await db.card.update({
      where: { id: cardId },
      data: {
        stats: newStats,
        updatedAt: new Date(),
      },
    });

    return updatedCard;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error updating card stats:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update card stats",
    });
  }
}

/**
 * Transfer card ownership between users
 * @param db - Prisma client instance
 * @param fromUserId - Source user ID
 * @param toUserId - Destination user ID
 * @param cardId - Card ID
 * @returns Transfer result
 */
export async function transferCard(
  db: PrismaClient,
  fromUserId: string,
  toUserId: string,
  cardId: string
) {
  try {
    // Validation
    if (!fromUserId || fromUserId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Source user ID is required",
      });
    }

    if (!toUserId || toUserId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Destination user ID is required",
      });
    }

    if (!cardId || cardId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card ID is required",
      });
    }

    if (fromUserId === toUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot transfer card to yourself",
      });
    }

    // Check if source user owns the card
    const sourceOwnership = await db.cardOwnership.findFirst({
      where: {
        ownerId: fromUserId,
        cardId,
        isLocked: false,
      },
    });

    if (!sourceOwnership) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User does not own this card or card is locked",
      });
    }

    // Perform transfer in transaction
    const result = await db.$transaction(async (tx) => {
      // Update ownership to new owner
      await tx.cardOwnership.update({
        where: {
          id: sourceOwnership.id,
        },
        data: {
          ownerId: toUserId,
          userId: toUserId,
          lastSaleDate: new Date(),
        },
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    console.error("[CARD_SERVICE] Error transferring card:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to transfer card",
    });
  }
}

/**
 * Calculate card market value based on supply/demand
 * @param db - Prisma client instance
 * @param cardId - Card ID
 * @returns Market value
 */
export async function getCardMarketValue(
  db: PrismaClient,
  cardId: string
): Promise<number> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Card ID is required",
      });
    }

    const card = await db.card.findUnique({
      where: { id: cardId },
      include: {
        CardOwnership: true,
      },
    });

    if (!card) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Card not found",
      });
    }

    // Base value by rarity
    const baseValues: Record<CardRarity, number> = {
      [CardRarity.COMMON]: 10,
      [CardRarity.UNCOMMON]: 25,
      [CardRarity.RARE]: 50,
      [CardRarity.ULTRA_RARE]: 100,
      [CardRarity.EPIC]: 250,
      [CardRarity.LEGENDARY]: 500,
    };

    let value = baseValues[card.rarity as CardRarity] || 10;

    // Supply factor: Lower supply = higher value
    const totalOwned = card.CardOwnership.length;
    if (totalOwned > 0) {
      const supplyMultiplier = Math.max(0.5, Math.min(3.0, 100 / totalOwned));
      value *= supplyMultiplier;
    }

    // Type multiplier
    if (card.cardType === CardType.SPECIAL) {
      value *= 2.0;
    } else if (card.cardType === CardType.NATION) {
      value *= 1.5;
    }

    // Round to 2 decimal places
    return Math.round(value * 100) / 100;
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
        OR: [
          { id: userId },
          { clerkUserId: userId },
        ],
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
    try {
      await db.activity.create({
        data: {
          userId: user.clerkUserId,
          activityType: "CARD_ACQUIRED",
          title: "Achievement Card Unlocked",
          description: `Received commemorative card "${card.title}" for unlocking ${achievementTitle}`,
          metadata: {
            cardId: card.id,
            cardTitle: card.title,
            cardRarity: card.rarity,
            achievementId,
            achievementTitle,
            acquireMethod: AcquireMethod.ACHIEVEMENT,
            serialNumber: nextSerial,
          },
        },
      });
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
