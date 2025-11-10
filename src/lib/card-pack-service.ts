// src/lib/card-pack-service.ts
// Card pack service for IxCards system

import type { PrismaClient } from "@prisma/client";
import type { PackType, CardRarity } from "@prisma/client";

/**
 * Pack odds validation - ensures all rarity odds sum to 100%
 */
export function validatePackOdds(odds: {
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
}): boolean {
  const total =
    odds.commonOdds +
    odds.uncommonOdds +
    odds.rareOdds +
    odds.ultraRareOdds +
    odds.epicOdds +
    odds.legendaryOdds;

  // Allow for small floating point errors (within 0.01%)
  return Math.abs(total - 100) < 0.01;
}

/**
 * Weighted random selection based on rarity odds
 */
export function selectRarityByOdds(odds: {
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
}): CardRarity {
  const random = Math.random() * 100;
  let cumulative = 0;

  // Build cumulative distribution
  cumulative += odds.commonOdds;
  if (random < cumulative) return "COMMON";

  cumulative += odds.uncommonOdds;
  if (random < cumulative) return "UNCOMMON";

  cumulative += odds.rareOdds;
  if (random < cumulative) return "RARE";

  cumulative += odds.ultraRareOdds;
  if (random < cumulative) return "ULTRA_RARE";

  cumulative += odds.epicOdds;
  if (random < cumulative) return "EPIC";

  // Fallback to legendary (should match remaining odds)
  return "LEGENDARY";
}

/**
 * Create new pack configuration (admin only)
 */
export async function createPack(
  db: PrismaClient,
  packData: {
    name: string;
    description?: string;
    artwork: string;
    cardCount?: number;
    packType: PackType;
    priceCredits: number;
    commonOdds?: number;
    uncommonOdds?: number;
    rareOdds?: number;
    ultraRareOdds?: number;
    epicOdds?: number;
    legendaryOdds?: number;
    season?: number;
    cardType?: string;
    themeFilter?: object;
    isAvailable?: boolean;
    limitedQuantity?: number;
    purchaseLimit?: number;
    expiresAt?: Date;
  }
) {
  // Validate odds if provided
  const odds = {
    commonOdds: packData.commonOdds ?? 65,
    uncommonOdds: packData.uncommonOdds ?? 25,
    rareOdds: packData.rareOdds ?? 7,
    ultraRareOdds: packData.ultraRareOdds ?? 2,
    epicOdds: packData.epicOdds ?? 0.9,
    legendaryOdds: packData.legendaryOdds ?? 0.1,
  };

  if (!validatePackOdds(odds)) {
    throw new Error(
      "Pack odds validation failed: odds must sum to 100%. " +
        `Current sum: ${Object.values(odds).reduce((a, b) => a + b, 0).toFixed(2)}%`
    );
  }

  // Create pack with validated odds
  return db.cardPack.create({
    data: {
      id: `pack_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: packData.name,
      description: packData.description,
      artwork: packData.artwork,
      cardCount: packData.cardCount ?? 5,
      packType: packData.packType,
      priceCredits: packData.priceCredits,
      ...odds,
      season: packData.season,
      cardType: packData.cardType,
      themeFilter: packData.themeFilter,
      isActive: packData.isAvailable ?? true,
      limitedQuantity: packData.limitedQuantity,
      purchaseLimit: packData.purchaseLimit,
      expiresAt: packData.expiresAt,
    },
  });
}

/**
 * Purchase pack with IxCredits deduction
 * Returns UserPack record
 */
export async function purchasePack(
  db: PrismaClient,
  userId: string,
  packId: string
) {
  return db.$transaction(async (tx) => {
    // 1. Get pack details
    const pack = await tx.cardPack.findUnique({
      where: { id: packId },
    });

    if (!pack) {
      throw new Error("Pack not found");
    }

    // 2. Validate availability
    if (!pack.isActive) {
      throw new Error("Pack is not available for purchase");
    }

    // Check expiry
    if (pack.expiresAt && pack.expiresAt < new Date()) {
      throw new Error("Pack has expired");
    }

    // Check purchase limit
    if (pack.purchaseLimit) {
      const userPurchaseCount = await tx.userPack.count({
        where: {
          userId,
          packId,
        },
      });

      if (userPurchaseCount >= pack.purchaseLimit) {
        throw new Error(
          `Purchase limit reached: ${pack.purchaseLimit} pack(s) per user`
        );
      }
    }

    // Check limited quantity
    if (pack.limitedQuantity !== null && pack.limitedQuantity !== undefined) {
      const soldCount = await tx.userPack.count({
        where: { packId },
      });

      if (soldCount >= pack.limitedQuantity) {
        throw new Error("Pack sold out");
      }
    }

    // 3. Get user vault to check balance
    const userVault = await tx.myVault.findUnique({
      where: { userId },
    });

    if (!userVault) {
      throw new Error("User vault not found");
    }

    if (userVault.credits < pack.priceCredits) {
      throw new Error(
        `Insufficient credits. Required: ${pack.priceCredits} IxC, Available: ${userVault.credits} IxC`
      );
    }

    // 4. Deduct credits and create transaction record
    await tx.myVault.update({
      where: { userId },
      data: {
        credits: {
          decrement: pack.priceCredits,
        },
      },
    });

    await tx.vaultTransaction.create({
      data: {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        vaultId: userVault.id,
        credits: -pack.priceCredits,
        type: "PACK_PURCHASE",
        source: "PACK_PURCHASE",
        balanceAfter: userVault.credits - pack.priceCredits,
        metadata: {
          packId: pack.id,
          packName: pack.name,
        },
      },
    });

    // 5. Create UserPack record
    const userPack = await tx.userPack.create({
      data: {
        userId,
        packId,
        isOpened: false,
        acquiredMethod: "PURCHASE",
      },
    });

    return userPack;
  });
}

/**
 * Generate cards for pack based on rarity distribution
 * Returns array of card rarities to be pulled from card pool
 */
export function generatePackCards(pack: {
  cardCount: number;
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
}): CardRarity[] {
  const rarities: CardRarity[] = [];
  const odds = {
    commonOdds: pack.commonOdds,
    uncommonOdds: pack.uncommonOdds,
    rareOdds: pack.rareOdds,
    ultraRareOdds: pack.ultraRareOdds,
    epicOdds: pack.epicOdds,
    legendaryOdds: pack.legendaryOdds,
  };

  for (let i = 0; i < pack.cardCount; i++) {
    rarities.push(selectRarityByOdds(odds));
  }

  return rarities;
}

/**
 * Open pack and generate card ownership records
 * Returns array of cards pulled from pack
 */
export async function openPack(
  db: PrismaClient,
  userId: string,
  userPackId: string
) {
  return db.$transaction(async (tx) => {
    // 1. Get UserPack with pack details
    const userPack = await tx.userPack.findUnique({
      where: { id: userPackId },
      include: { pack: true },
    });

    if (!userPack) {
      throw new Error("Pack not found");
    }

    // 2. Verify ownership
    if (userPack.userId !== userId) {
      throw new Error("Unauthorized: Pack belongs to another user");
    }

    // 3. Check if already opened
    if (userPack.isOpened) {
      throw new Error("Pack has already been opened");
    }

    // 4. Generate card rarities based on pack odds
    const rarities = generatePackCards(userPack.pack);

    // 5. Select actual cards from pool based on rarities
    const cards = [];
    for (const rarity of rarities) {
      // Build where clause
      const where: {
        rarity: CardRarity;
        cardType?: string;
        season?: number;
      } = { rarity };

      // Apply pack filters
      if (userPack.pack.cardType) {
        where.cardType = userPack.pack.cardType;
      }
      if (userPack.pack.season) {
        where.season = userPack.pack.season;
      }

      // Get random card of this rarity
      const cardCount = await tx.card.count({ where });

      if (cardCount === 0) {
        throw new Error(
          `No cards found for rarity: ${rarity} with pack filters`
        );
      }

      // Random offset for variety
      const randomOffset = Math.floor(Math.random() * cardCount);

      const card = await tx.card.findFirst({
        where,
        skip: randomOffset,
        take: 1,
      });

      if (!card) {
        throw new Error(`Failed to select card for rarity: ${rarity}`);
      }

      cards.push(card);

      // 6. Create CardOwnership record
      const maxSerial = await tx.cardOwnership.findFirst({
        where: { cardId: card.id },
        orderBy: { serialNumber: 'desc' },
        select: { serialNumber: true },
      });
      const nextSerial = (maxSerial?.serialNumber || 0) + 1;

      await tx.cardOwnership.create({
        data: {
          id: `co_${Date.now()}_${userId}_${card.id}`,
          userId,
          cardId: card.id,
          ownerId: userId,
          serialNumber: nextSerial,
          level: 1,
          experience: 0,
        },
      });
    }

    // 7. Mark pack as opened
    await tx.userPack.update({
      where: { id: userPackId },
      data: {
        isOpened: true,
        openedAt: new Date(),
      },
    });

    return cards;
  });
}

/**
 * Get available packs for purchase
 */
export async function getAvailablePacks(db: PrismaClient) {
  const now = new Date();

  return db.cardPack.findMany({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ packType: "asc" }, { priceCredits: "asc" }],
  });
}

/**
 * Get user's packs (default: unopened only)
 */
export async function getUserPacks(
  db: PrismaClient,
  userId: string,
  isOpened?: boolean
) {
  return db.userPack.findMany({
    where: {
      userId,
      ...(isOpened !== undefined && { isOpened }),
    },
    include: {
      pack: true,
    },
    orderBy: { acquiredDate: "desc" },
  });
}
