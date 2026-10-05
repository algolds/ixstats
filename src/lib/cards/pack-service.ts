// src/lib/card-pack-service.ts
// Card pack service for IxCards system

import { LoreCategory } from "@prisma/client";
import type { CardRarity, Prisma, PrismaClient } from "@prisma/client";
import { getVaultConfig, vaultService } from "~/lib/vault/vault-service";
import { spendCreditsTx } from "~/lib/vault/vault-ledger";
import { grantCardXp } from "./xp-utils";
import { newCardOwnershipId } from "./ownership-id";

/**
 * A pack-service failure the caller can act on. `code` is the tRPC error code the router
 * surfaces, so known failures don't reach players as 500s.
 */
export class PackError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "BAD_REQUEST" | "PRECONDITION_FAILED",
    message: string
  ) {
    super(message);
    this.name = "PackError";
  }
}

/**
 * Optional `CardPack.themeFilter` shape. Each listed key narrows the pool (keys combine with
 * AND, values within a key with OR); unknown keys are ignored.
 *   { "categories": ["MILITARY"], "subcategories": [...], "cardTypes": ["LORE"], "countryIds": [...] }
 */
export interface PackThemeFilter {
  categories?: string[];
  subcategories?: string[];
  cardTypes?: string[];
  countryIds?: string[];
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v !== "")
    : [];
}

/** Card filters for a pack's `themeFilter` JSON (an empty list when there is no theme). */
export function themeFilterWhere(themeFilter: unknown): Prisma.CardWhereInput[] {
  if (!themeFilter || typeof themeFilter !== "object" || Array.isArray(themeFilter)) return [];
  const theme = themeFilter as Record<string, unknown>;
  const where: Prisma.CardWhereInput[] = [];

  const validCategories = new Set<string>(Object.values(LoreCategory));
  const categories = stringList(theme.categories).filter((c) => validCategories.has(c));
  if (stringList(theme.categories).length > 0) {
    // A theme naming only unknown categories matches nothing rather than everything
    where.push({ category: { in: categories as LoreCategory[] } });
  }
  const subcategories = stringList(theme.subcategories);
  if (subcategories.length > 0) where.push({ subcategory: { in: subcategories } });
  const cardTypes = stringList(theme.cardTypes);
  if (cardTypes.length > 0) where.push({ cardType: { in: cardTypes } });
  const countryIds = stringList(theme.countryIds);
  if (countryIds.length > 0) where.push({ countryId: { in: countryIds } });

  return where;
}

interface PackOdds {
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
}

const RARITY_DISTRIBUTION: readonly [CardRarity, keyof PackOdds][] = [
  ["COMMON", "commonOdds"],
  ["UNCOMMON", "uncommonOdds"],
  ["RARE", "rareOdds"],
  ["ULTRA_RARE", "ultraRareOdds"],
  ["EPIC", "epicOdds"],
  ["LEGENDARY", "legendaryOdds"],
] as const;

/**
 * Weighted random selection based on rarity odds
 */
function selectRarityByOdds(odds: PackOdds): CardRarity {
  const random = Math.random() * 100;
  let cumulative = 0;

  for (const [rarity, key] of RARITY_DISTRIBUTION) {
    cumulative += odds[key] ?? 0;
    if (random < cumulative) return rarity;
  }

  return "COMMON";
}

/**
 * Purchase pack with IxCredits deduction
 * Returns UserPack record
 */
export async function purchasePack(db: PrismaClient, userId: string, packId: string) {
  return db.$transaction(async (tx) => {
    // 1. Get pack details (maintenance / packs-disabled switches are enforced by the ledger)
    const pack = await tx.cardPack.findUnique({
      where: { id: packId },
    });

    if (!pack) {
      throw new PackError("NOT_FOUND", "Pack not found");
    }

    // 2. Validate availability
    if (!pack.isActive) {
      throw new PackError("BAD_REQUEST", "Pack is not available for purchase");
    }

    // Check expiry
    if (pack.expiresAt && pack.expiresAt < new Date()) {
      throw new PackError("BAD_REQUEST", "Pack has expired");
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
        throw new PackError(
          "PRECONDITION_FAILED",
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
        throw new PackError("PRECONDITION_FAILED", "Pack sold out");
      }
    }

    // 3. Charge through the ledger (lifetime counters, kill switches, maintenance mode,
    //    row-locked conditional decrement). Throws LedgerError, rolling this transaction back.
    if (pack.priceCredits > 0) {
      await spendCreditsTx(tx, {
        userId,
        amount: pack.priceCredits,
        type: "SPEND_PACKS",
        source: "PACK_PURCHASE",
        metadata: {
          packId: pack.id,
          packName: pack.name,
        },
      });
    }

    // 5. Create UserPack record
    const userPack = await tx.userPack.create({
      data: {
        userId,
        packId,
        isOpened: false,
        acquiredMethod: "PURCHASE",
      },
      include: { pack: true },
    });

    return userPack;
  });
}

/** Pack rarity tiers, lowest first (the order of the odds table). */
const RARITY_ORDER: readonly CardRarity[] = RARITY_DISTRIBUTION.map(([rarity]) => rarity);

function rarityRank(rarity: string | null | undefined): number {
  return RARITY_ORDER.indexOf(rarity as CardRarity);
}

/**
 * Generate cards for pack based on rarity distribution
 * Returns array of card rarities to be pulled from card pool. When the pack has a
 * `guaranteedRarity` and no roll reached it, the last slot is upgraded to that rarity.
 */
export function generatePackCards(pack: {
  cardCount: number;
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
  guaranteedRarity?: string | null;
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

  const guaranteedRank = rarityRank(pack.guaranteedRarity);
  if (
    guaranteedRank >= 0 &&
    rarities.length > 0 &&
    !rarities.some((r) => rarityRank(r) >= guaranteedRank)
  ) {
    rarities[rarities.length - 1] = RARITY_ORDER[guaranteedRank]!;
  }

  return rarities;
}

/**
 * The pack's card pool, before rarity: active cards matching the pack's type, season and
 * theme, never SPECIAL (achievement / event rewards) and never crafted.
 */
async function packPoolWhere(
  tx: Prisma.TransactionClient,
  pack: { cardType: string | null; season: number | null; themeFilter: unknown }
): Promise<Prisma.CardWhereInput> {
  // Crafted cards carry CRAFTED_CARD_MARKER (crafting-rules.ts). Matched positively, as a NOT
  // on a JSON path would also drop every card without metadata. Legacy crafts carry no
  // marker, only the generic "Crafted via <recipe>" description.
  const crafted = await tx.card.findMany({
    where: {
      OR: [
        { metadata: { path: ["crafted"], equals: true } },
        { description: { startsWith: "Crafted via " }, totalSupply: 1 },
      ],
    },
    select: { id: true },
  });

  const and: Prisma.CardWhereInput[] = [
    { isRetired: false },
    { cardType: { not: "SPECIAL" } },
    ...themeFilterWhere(pack.themeFilter),
  ];
  if (pack.cardType) and.push({ cardType: pack.cardType });
  if (pack.season) and.push({ season: pack.season });
  if (crafted.length > 0) and.push({ id: { notIn: crafted.map((c) => c.id) } });
  return { AND: and };
}

/**
 * Open pack and generate card ownership records
 * Returns array of cards pulled from pack
 */
export async function openPack(db: PrismaClient, userId: string, userPackId: string) {
  return db.$transaction(async (tx) => {
    // 1. Get UserPack with pack details
    const userPack = await tx.userPack.findUnique({
      where: { id: userPackId },
      include: { pack: true },
    });

    // 2. Verify ownership (another user's pack reads as missing, so ids can't be probed)
    if (!userPack || userPack.userId !== userId) {
      throw new PackError("NOT_FOUND", "Pack not found");
    }

    // 3. Check if already opened
    if (userPack.isOpened) {
      throw new PackError("BAD_REQUEST", "Pack has already been opened");
    }

    // 3.5 Check inventory capacity limits
    const config = await getVaultConfig(tx as any);
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    const userRoleLevel = user?.role?.level ?? 100;
    const isExempt = config.exemptStaffFromLimit && userRoleLevel <= 20;

    if (!isExempt) {
      const capacityBoost = await vaultService.getCardCapacityBoost(userId, tx as any);
      const maxCards = 150 + capacityBoost;
      const currentCardsCount = await tx.cardOwnership.count({
        where: { userId },
      });
      if (currentCardsCount + userPack.pack.cardCount > maxCards) {
        throw new PackError(
          "PRECONDITION_FAILED",
          `Your inventory is full. Maximum capacity is ${maxCards} cards. Purchase a Card Capacity Upgrade in the Store to hold more.`
        );
      }
    }

    // 4. Generate card rarities based on pack odds
    const rarities = generatePackCards(userPack.pack);

    // 5. Select actual cards from pool based on rarities
    const poolWhere = await packPoolWhere(tx, userPack.pack);
    const tierCounts = new Map<CardRarity, number>();
    const countTier = async (rarity: CardRarity) => {
      let count = tierCounts.get(rarity);
      if (count === undefined) {
        count = await tx.card.count({ where: { AND: [poolWhere, { rarity }] } });
        tierCounts.set(rarity, count);
      }
      return count;
    };

    const cardsWithOwnership = [];
    for (const rolled of rarities) {
      // An empty tier falls back to the next-lower rarity; only when every lower tier is
      // empty too does it reach upward, so a thin pool still opens.
      const rank = rarityRank(rolled);
      const tiers = [...RARITY_ORDER.slice(0, rank + 1).reverse(), ...RARITY_ORDER.slice(rank + 1)];
      let rarity: CardRarity | null = null;
      let cardCount = 0;
      for (const tier of tiers) {
        cardCount = await countTier(tier);
        if (cardCount > 0) {
          rarity = tier;
          break;
        }
      }

      if (!rarity) {
        throw new PackError(
          "PRECONDITION_FAILED",
          "This pack has no cards available right now. Please try again later."
        );
      }

      // Random offset for variety
      const randomOffset = Math.floor(Math.random() * cardCount);

      const card = await tx.card.findFirst({
        where: { AND: [poolWhere, { rarity }] },
        skip: randomOffset,
        take: 1,
      });

      if (!card) {
        throw new PackError("PRECONDITION_FAILED", `Failed to select a ${rarity} card`);
      }

      // 6. Create CardOwnership record
      const maxSerial = await tx.cardOwnership.findFirst({
        where: { cardId: card.id },
        orderBy: { serialNumber: "desc" },
        select: { serialNumber: true },
      });
      const nextSerial = (maxSerial?.serialNumber || 0) + 1;

      const ownership = await tx.cardOwnership.create({
        data: {
          id: newCardOwnershipId(),
          userId,
          cardId: card.id,
          ownerId: userId,
          serialNumber: nextSerial,
          level: 1,
          experience: 0,
        },
      });

      // Log provenance
      const txAny = tx as any;
      await txAny.cardTransferEvent.create({
        data: {
          ownershipId: ownership.id,
          toUserId: userId,
          action: "PACK_OPEN",
        },
      });

      await grantCardXp(
        tx as any,
        ownership.id,
        10,
        "PACK_OPEN",
        JSON.stringify({ packId: userPack.pack.id, packName: userPack.pack.name })
      );

      cardsWithOwnership.push({ card, ownershipId: ownership.id });
    }

    // 7. Mark pack as opened
    await tx.userPack.update({
      where: { id: userPackId },
      data: {
        isOpened: true,
        openedAt: new Date(),
      },
    });

    return cardsWithOwnership;
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
export async function getUserPacks(db: PrismaClient, userId: string, isOpened?: boolean) {
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
