// src/lib/card-pack-service.ts
// Card pack service for IxCards system

import { CardType, LoreCategory } from "@prisma/client";
import type { CardRarity, Prisma, PrismaClient } from "@prisma/client";
import { spendCreditsTx } from "~/lib/vault/vault-ledger";
import { EXCLUDE_RESTRICTED_ART } from "./art-licence";
import { assertCapacityTx, CapacityError } from "./capacity";
import { parseCardRarity } from "./enums";
import { rarityRank } from "./face/labels";
import { CATALOGUE_WHERE } from "./hub/catalogue";
import { mintCopy } from "./mint";
import { isJsonObject } from "./ns-facts";
import { rarityList, undeliverableRarities, type PackOdds } from "./pack-odds";
import { createPoolDrawer, rollRarity, tierCounts, type RarityOdds } from "./pool-draw";
import { bySerialLockOrder } from "./serial-number";
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
 *   { "realmIds": ["iiwiki"], "categories": ["MILITARY"], "subcategories": [...],
 *     "cardTypes": ["LORE"], "countryIds": [...] }
 */
export interface PackThemeFilter {
  realmIds?: string[];
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
  const realmIds = stringList(themeFilter.realmIds);
  if (realmIds.length > 0) where.push({ realmId: { in: realmIds } });

  return where;
}

/** The theme keys the pack editor shows (realms, categories, types); other keys stay as stored. */
export function packThemePool(themeFilter: Prisma.JsonValue | null): {
  realmIds: string[];
  categories: LoreCategory[];
  cardTypes: CardType[];
} {
  if (!isJsonObject(themeFilter)) return { realmIds: [], categories: [], cardTypes: [] };
  return {
    realmIds: stringList(themeFilter.realmIds),
    categories: known(stringList(themeFilter.categories), Object.values(LoreCategory)),
    cardTypes: known(stringList(themeFilter.cardTypes), Object.values(CardType)),
  };
}

/** The stored values outside the enum, which the pack editor cannot carry. */
function unknownValues(value: Prisma.JsonValue | undefined, allowed: readonly string[]): string[] {
  return stringList(value).filter((item) => !allowed.includes(item));
}

/**
 * The stored theme with the editor's pool written over it. Keys the editor does not show stay, and so do stored
 * categories and types outside the enums: a theme naming only those matches nothing, so dropping them would widen it.
 */
export function mergePackTheme(
  existing: Prisma.JsonValue | null,
  pool: { realmIds: readonly string[]; categories: readonly string[]; cardTypes: readonly string[] }
): Prisma.JsonObject {
  const stored: Prisma.JsonObject = isJsonObject(existing) ? existing : {};
  return {
    ...stored,
    realmIds: [...pool.realmIds],
    categories: [
      ...pool.categories,
      ...unknownValues(stored.categories, Object.values(LoreCategory)),
    ],
    cardTypes: [...pool.cardTypes, ...unknownValues(stored.cardTypes, Object.values(CardType))],
  };
}

/** A pack's odds columns as percent odds by rarity. */
function packRarityOdds(pack: PackOdds): RarityOdds {
  return {
    COMMON: pack.commonOdds,
    UNCOMMON: pack.uncommonOdds,
    RARE: pack.rareOdds,
    ULTRA_RARE: pack.ultraRareOdds,
    EPIC: pack.epicOdds,
    LEGENDARY: pack.legendaryOdds,
  };
}

/**
 * Arbitrary constant; identifies the per-pack purchase locks in pg_locks (7331 is the serial
 * lock, 7334 capacity, 7340 category suggestions). Taken first in a purchase, before the
 * ledger's vault row lock; nothing else takes it.
 */
const PACK_PURCHASE_LOCK_NAMESPACE = 7341;

const cannotOpen = (rarities: string) =>
  `This pack can't be opened right now: it has no ${rarities} cards to give. It stays unopened; try again later.`;
const notOnSale = (rarities: string) =>
  `This pack is not on sale right now: it has no ${rarities} cards to give.`;

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

    // Serialise only what the counts below need: every purchase of a limited-stock pack (the sold
    // count), else one buyer's purchases of a per-user-limited pack (their count). Unlimited packs
    // take no lock, so a busy drop doesn't queue every buyer behind one another.
    // $executeRaw, not $queryRaw: Prisma cannot deserialize the void pg_advisory_xact_lock returns
    const hasStock = pack.limitedQuantity !== null && pack.limitedQuantity !== undefined;
    if (hasStock || pack.purchaseLimit) {
      const lockKey = hasStock ? packId : `${packId}:${userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PACK_PURCHASE_LOCK_NAMESPACE}::int, hashtext(${lockKey}))`;
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

    // A pack that can't give a rarity it shows or guarantees would never open, so it is not sold
    await deliverablePool(tx, pack, notOnSale);

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
  const odds = packRarityOdds(pack);

  for (let i = 0; i < pack.cardCount; i++) {
    rarities.push(rollRarity(odds));
  }

  const guaranteed = parseCardRarity(pack.guaranteedRarity);
  if (
    guaranteed &&
    rarities.length > 0 &&
    !rarities.some((r) => rarityRank(r) >= rarityRank(guaranteed))
  ) {
    rarities[rarities.length - 1] = guaranteed;
  }

  return rarities;
}

/**
 * The pack's card pool, before rarity: active cards matching the pack's type, season and
 * theme, never Special or Trophy (achievement, event and trophy rewards) and never crafted;
 * only catalogue cards (approved, as imports wait in review, and homed in a published realm,
 * so a draft or generating realm's cards never drop), and never restricted-licence art.
 */
export async function packPoolWhere(
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
    CATALOGUE_WHERE,
    // Special and Trophy cards never drop from packs (achievement and event rewards, Loreward and sports trophies)
    { cardType: { notIn: [CardType.SPECIAL, CardType.TROPHY] } },
    EXCLUDE_RESTRICTED_ART,
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

type PoolPack = Parameters<typeof packPoolWhere>[1] &
  PackOdds & { guaranteedRarity: string | null };

/**
 * The pack's pool and its cards of each rarity, read in `tx`, with the rarities it gives odds for or guarantees that
 * have no card. A pack never falls back to another rarity, so while any are missing it is not sold, put on sale,
 * awarded or opened: it never undercuts its shown odds.
 */
export async function missingRarities(tx: Prisma.TransactionClient, pack: PoolPack) {
  const where = await packPoolWhere(tx, pack);
  const counts = await tierCounts(tx, where);
  const missing = undeliverableRarities(pack, parseCardRarity(pack.guaranteedRarity), counts);
  return { where, counts, missing };
}

/** The pack's pool and its cards of each rarity, refused (`refusal`) while a rarity it shows has no card (Q3). */
async function deliverablePool(
  tx: Prisma.TransactionClient,
  pack: PoolPack,
  refusal: (rarities: string) => string
) {
  const { where, counts, missing } = await missingRarities(tx, pack);
  if (missing.length > 0) throw new PackError("PRECONDITION_FAILED", refusal(rarityList(missing)));
  return { where, counts };
}

/**
 * Opens a pack: claims it first (only one open can flip `isOpened`, so a second, concurrent open throws CONFLICT
 * before anything is minted; cards refresh §5.4), checks capacity under the owner's lock, refuses a pool that can't
 * give a rarity the pack shows, draws the whole pack, then mints each pulled card through `mintCopy`, which rolls its
 * finish. One transaction: any failure, a full collection or an empty rarity included, leaves the pack unopened.
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

    try {
      await assertCapacityTx(tx, userId, pack.cardCount);
    } catch (error) {
      if (error instanceof CapacityError) {
        throw new PackError(
          "PRECONDITION_FAILED",
          "Your inventory is full. Purchase a Card Capacity Upgrade in the Store to hold more."
        );
      }
      throw error;
    }

    const { where, counts } = await deliverablePool(tx, pack, cannotOpen);
    const drawer = createPoolDrawer(tx, where, counts);
    const cards = [];
    for (const rarity of generatePackCards(pack)) {
      const card = await drawer.draw(rarity);
      if (!card) throw new PackError("PRECONDITION_FAILED", cannotOpen(rarityList([rarity])));
      cards.push(card);
    }

    // mintCopy holds its per-card serial lock until commit, so mint in serial-lock order (`bySerialLockOrder`, as a
    // deck import and a break-down lock): two transactions over the same cards in different orders would deadlock.
    const pulled: Array<{ card: (typeof cards)[number]; ownershipId: string }> = new Array(
      cards.length
    );
    const mintOrder = cards
      .map((card, index) => ({ card, index }))
      .sort((a, b) => bySerialLockOrder(a.card.id, b.card.id));
    for (const { card, index } of mintOrder) {
      const copy = await mintCopy(tx, { cardId: card.id, ownerId: userId, source: "PACK_OPEN" });
      await grantCardXp(
        tx,
        copy.id,
        "PACK_OPEN",
        JSON.stringify({ packId: pack.id, packName: pack.name })
      );
      pulled[index] = { card, ownershipId: copy.id };
    }
    return pulled;
  });
}

/** The best rarity a pack pulled, in schema order (Epic above Ultra Rare); Common for none. */
export function bestPulledRarity(cards: ReadonlyArray<{ rarity: string }>): CardRarity {
  return cards.reduce<CardRarity>((best, card) => {
    const rarity = parseCardRarity(card.rarity);
    return rarity && rarityRank(rarity) > rarityRank(best) ? rarity : best;
  }, "COMMON");
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
 * A user's packs, newest first: every pack, opened or not, unless `isOpened` picks one side.
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
