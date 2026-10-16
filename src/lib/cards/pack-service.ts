// src/lib/card-pack-service.ts
// Card pack service for IxCards system

import { CardType, LoreCategory } from "@prisma/client";
import type { CardRarity, Prisma, PrismaClient } from "@prisma/client";
import { spendCreditsTx } from "~/lib/vault/vault-ledger";
import { getRarityTier } from "./display-utils";
import { copyRoom } from "./capacity";
import { CardFinish } from "./enums";
import { mintCopy } from "./mint";
import { isJsonObject } from "./ns-facts";
import { grantCardXp } from "./xp-utils";

/**
 * A pack-service failure the caller can act on. `code` is the tRPC error code the router
 * surfaces, so known failures don't reach players as 500s.
 */
export class PackError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "BAD_REQUEST" | "PRECONDITION_FAILED" | "CONFLICT",
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

function stringList(value: Prisma.JsonValue | undefined): string[] {
  if (typeof value === "string") return value ? [value] : [];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v !== "")
    : [];
}

/** The listed values that the enum knows. */
function known<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

/** Card filters for a pack's `themeFilter` JSON (an empty list when there is no theme). */
export function themeFilterWhere(themeFilter: Prisma.JsonValue | null): Prisma.CardWhereInput[] {
  if (!isJsonObject(themeFilter)) return [];
  const where: Prisma.CardWhereInput[] = [];

  // A theme naming only unknown categories or types matches nothing rather than everything
  const categories = stringList(themeFilter.categories);
  if (categories.length > 0) {
    where.push({ category: { in: known(categories, Object.values(LoreCategory)) } });
  }
  const subcategories = stringList(themeFilter.subcategories);
  if (subcategories.length > 0) where.push({ subcategory: { in: subcategories } });
  const cardTypes = stringList(themeFilter.cardTypes);
  if (cardTypes.length > 0) {
    where.push({ cardType: { in: known(cardTypes, Object.values(CardType)) } });
  }
  const countryIds = stringList(themeFilter.countryIds);
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
 * theme, never Special or Trophy (achievement, event and trophy rewards) and never crafted.
 */
async function packPoolWhere(
  tx: Prisma.TransactionClient,
  pack: { cardType: CardType | null; season: number | null; themeFilter: Prisma.JsonValue | null }
): Promise<Prisma.CardWhereInput> {
  // Cards crafted before crafting was retired carry `metadata.crafted` (or the old "Crafted via"
  // description); they stay out of packs. Matched positively, as a NOT on a JSON path would also
  // drop every card without metadata.
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
    // Special and Trophy cards never drop from packs (achievement and event rewards, Loreward and sports trophies)
    { cardType: { notIn: [CardType.SPECIAL, CardType.TROPHY] } },
    ...themeFilterWhere(pack.themeFilter),
  ];
  if (pack.cardType) and.push({ cardType: pack.cardType });
  if (pack.season) and.push({ season: pack.season });
  if (crafted.length > 0) and.push({ id: { notIn: crafted.map((c) => c.id) } });
  return { AND: and };
}

/** Why a pack could not be claimed: missing or someone else's reads NOT_FOUND (ids can't be probed); else opened. */
async function unclaimedPackError(
  tx: Prisma.TransactionClient,
  userPackId: string,
  userId: string
) {
  const own = await tx.userPack.findFirst({
    where: { id: userPackId, userId },
    select: { id: true },
  });
  return own
    ? new PackError("CONFLICT", "This pack has already been opened")
    : new PackError("NOT_FOUND", "Pack not found");
}

type PoolPack = Parameters<typeof packPoolWhere>[1];

/** Draws one card of a rolled rarity; an empty tier falls back to the next-lower one, then reaches upward. */
async function poolDrawer(tx: Prisma.TransactionClient, pack: PoolPack) {
  const poolWhere = await packPoolWhere(tx, pack);
  const tierCounts = new Map<CardRarity, number>();
  const countTier = async (rarity: CardRarity) => {
    const cached = tierCounts.get(rarity);
    if (cached !== undefined) return cached;
    const count = await tx.card.count({ where: { AND: [poolWhere, { rarity }] } });
    tierCounts.set(rarity, count);
    return count;
  };
  return async (rolled: CardRarity) => {
    const rank = rarityRank(rolled);
    const tiers = [...RARITY_ORDER.slice(0, rank + 1).reverse(), ...RARITY_ORDER.slice(rank + 1)];
    for (const tier of tiers) {
      const count = await countTier(tier);
      if (count === 0) continue;
      const card = await tx.card.findFirst({
        where: { AND: [poolWhere, { rarity: tier }] },
        skip: Math.floor(Math.random() * count),
        take: 1,
      });
      if (!card) throw new PackError("PRECONDITION_FAILED", `Failed to select a ${tier} card`);
      return card;
    }
    throw new PackError(
      "PRECONDITION_FAILED",
      "This pack has no cards available right now. Please try again later."
    );
  };
}

/**
 * Opens a pack: claims it first (only one open can flip `isOpened`, so a second, concurrent open throws CONFLICT
 * before anything is minted; cards refresh §5.4), checks capacity, draws the whole pack, then mints each pulled
 * card through `mintCopy`. One transaction: any failure leaves the pack unopened.
 */
export async function openPack(db: PrismaClient, userId: string, userPackId: string) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.userPack.updateMany({
      where: { id: userPackId, userId, isOpened: false },
      data: { isOpened: true, openedAt: new Date() },
    });
    if (claimed.count !== 1) throw await unclaimedPackError(tx, userPackId, userId);
    const { pack } = await tx.userPack.findUniqueOrThrow({
      where: { id: userPackId },
      include: { pack: true },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: { select: { level: true } } },
    });
    if ((await copyRoom(tx, { id: userId, roleLevel: user?.role?.level })) < pack.cardCount) {
      throw new PackError(
        "PRECONDITION_FAILED",
        "Your inventory is full. Purchase a Card Capacity Upgrade in the Store to hold more."
      );
    }

    const draw = await poolDrawer(tx, pack);
    const cards = [];
    for (const rarity of generatePackCards(pack)) cards.push(await draw(rarity));

    // mintCopy holds its per-card serial lock until commit, so mint in cardId order: two concurrent opens that
    // drew the same cards in different orders would otherwise deadlock.
    const pulled: Array<{ card: (typeof cards)[number]; ownershipId: string }> = new Array(
      cards.length
    );
    const mintOrder = cards
      .map((card, index) => ({ card, index }))
      .sort((a, b) => a.card.id.localeCompare(b.card.id));
    for (const { card, index } of mintOrder) {
      const copy = await mintCopy(tx, {
        cardId: card.id,
        ownerId: userId,
        finish: CardFinish.STANDARD,
        source: "PACK_OPEN",
      });
      await grantCardXp(
        tx,
        copy.id,
        10,
        "PACK_OPEN",
        JSON.stringify({ packId: pack.id, packName: pack.name })
      );
      pulled[index] = { card, ownershipId: copy.id };
    }
    return pulled;
  });
}

/** The best rarity a pack pulled, in schema order (Epic above Ultra Rare); "COMMON" for none. */
export function bestPulledRarity(cards: ReadonlyArray<{ rarity: string }>): string {
  return cards.reduce(
    (best, card) => (getRarityTier(card.rarity) > getRarityTier(best) ? card.rarity : best),
    "COMMON"
  );
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
