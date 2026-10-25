/**
 * The people, realm, cards and packs of a money scenario, written through the Prisma API so one seed runs on the
 * in-memory client (`memory-prisma.ts`) and on the scratch Postgres (`scenario-db.ts`) alike. Every id starts with the
 * scenario's prefix, and `removeWorld` deletes them again (Postgres only; a memory client is thrown away).
 *
 * The router contexts are the caller's own (`callerContext`), so a scenario calls the real tRPC procedures as each
 * player.
 */
import type { CardRarity, CardType, PrismaClient } from "@prisma/client";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { clearGeneralCardSettingsCache } from "~/lib/cards/general-settings";
import { clearValuationCache } from "~/lib/cards/valuation";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

type Db = PrismaClient;

export interface Player {
  id: string;
  clerkUserId: string;
}

/** Every config cache the economy reads, so a scenario starts from what is stored. */
export function clearEconomyCaches(): void {
  clearEconomyConfigCache();
  clearGeneralCardSettingsCache();
  clearValuationCache();
  invalidateVaultConfigCache();
}

/** A published realm (its cards are catalogue cards). */
export async function addRealm(db: Db, id: string): Promise<{ id: string }> {
  return db.realm.create({
    data: { id, slug: id, name: `Realm ${id}`, ownerId: `${id}-owner`, status: "published" },
    select: { id: true },
  });
}

/** A signed-up player with a vault holding `credits` IxC. */
export async function addPlayer(db: Db, id: string, credits = 0): Promise<Player> {
  const user = await db.user.create({
    data: { id, clerkUserId: `${id}-clerk`, lastSeenAt: new Date() },
    select: { id: true, clerkUserId: true },
  });
  await db.myVault.create({ data: { userId: id, credits } });
  return user;
}

export interface CardSeed {
  id: string;
  realmId: string;
  rarity: CardRarity;
  cardType?: CardType;
  title?: string;
  countryId?: string | null;
}

/** An approved, live catalogue card. */
export async function addCard(db: Db, seed: CardSeed): Promise<{ id: string }> {
  return db.card.create({
    data: {
      id: seed.id,
      realmId: seed.realmId,
      rarity: seed.rarity,
      cardType: seed.cardType ?? "LORE",
      title: seed.title ?? `Card ${seed.id}`,
      countryId: seed.countryId ?? null,
    },
    select: { id: true },
  });
}

/** A nation in the realm, owned by `ownerUserId` (the royalty's recipient). */
export async function addCountry(
  db: Db,
  id: string,
  realmId: string,
  ownerUserId: string | null
): Promise<{ id: string }> {
  return db.country.create({
    data: {
      id,
      realmId,
      ownerUserId,
      name: `Nation ${id}`,
      baselinePopulation: 1,
      baselineGdpPerCapita: 1,
      maxGdpGrowthRate: 0,
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      currentPopulation: 1,
      currentGdpPerCapita: 1,
      currentTotalGdp: 1,
      baselineDate: new Date(Date.UTC(2040, 0, 1)),
      economicTier: "Developing",
      populationTier: "Micro",
    },
    select: { id: true },
  });
}

const NO_ODDS = {
  commonOdds: 0,
  uncommonOdds: 0,
  rareOdds: 0,
  ultraRareOdds: 0,
  epicOdds: 0,
  legendaryOdds: 0,
};

export interface PackSeed {
  id: string;
  realmId: string;
  priceCredits: number;
  cardCount: number;
  /** The only rarity the pack gives (100%). */
  rarity: CardRarity;
}

const ODDS_COLUMN: Record<CardRarity, keyof typeof NO_ODDS> = {
  COMMON: "commonOdds",
  UNCOMMON: "uncommonOdds",
  RARE: "rareOdds",
  ULTRA_RARE: "ultraRareOdds",
  EPIC: "epicOdds",
  LEGENDARY: "legendaryOdds",
};

/** A pack on sale that draws only the realm's cards of one rarity, so a run's pulls are never another run's cards. */
export async function addPack(db: Db, seed: PackSeed): Promise<{ id: string }> {
  return db.cardPack.create({
    data: {
      id: seed.id,
      name: `Pack ${seed.id}`,
      packType: "BASIC",
      priceCredits: seed.priceCredits,
      cardCount: seed.cardCount,
      ...NO_ODDS,
      [ODDS_COLUMN[seed.rarity]]: 100,
      themeFilter: { realmIds: [seed.realmId] },
    },
    select: { id: true },
  });
}

/** A copy minted straight in (a scenario's starting collection), with its mint row. */
export async function addCopy(
  db: Db,
  copy: { id: string; cardId: string; ownerId: string; serialNumber: number }
): Promise<{ id: string }> {
  const row = await db.cardOwnership.create({ data: copy, select: { id: true } });
  await db.cardTransferEvent.create({
    data: {
      ownershipId: copy.id,
      cardId: copy.cardId,
      serialNumber: copy.serialNumber,
      finish: "STANDARD",
      toUserId: copy.ownerId,
      action: "ADMIN",
    },
  });
  return row;
}

/** Each player's IxC, by id. */
export async function creditsOf(db: Db, ids: readonly string[]): Promise<Record<string, number>> {
  const rows = await db.myVault.findMany({
    where: { userId: { in: [...ids] } },
    select: { userId: true, credits: true },
  });
  return Object.fromEntries(rows.map((r) => [r.userId, r.credits]));
}

/** A player's ledger rows, oldest first. */
export async function ledgerOf(db: Db, userId: string) {
  return db.vaultTransaction.findMany({
    where: { vault: { userId } },
    select: { credits: true, balanceAfter: true, type: true, source: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/** The tRPC context of a signed-in player. Each gets its own rate-limit bucket. */
export function callerContext(db: Db, player: Player): MockCallerContext {
  return createMockCallerContext({
    db,
    auth: { userId: player.clerkUserId },
    user: { id: player.id, clerkUserId: player.clerkUserId, countryId: null },
    rateLimitIdentifier: `${player.id}-${Math.random()}`,
  });
}

/** Deletes a Postgres scenario's rows, children first. Never needed for a memory client. */
export async function removeWorld(db: Db, prefix: string): Promise<void> {
  const mine = { startsWith: prefix };
  await db.cardDustEvent.deleteMany({ where: { userId: mine } });
  await db.cardTransferEvent.deleteMany({
    where: { OR: [{ cardId: mine }, { toUserId: mine }, { fromUserId: mine }] },
  });
  await db.cardAuction.deleteMany({ where: { cardId: mine } });
  await db.cardListing.deleteMany({ where: { cardId: mine } });
  await db.tradeOffer.deleteMany({ where: { initiatorId: mine } });
  await db.cardPack.deleteMany({ where: { id: mine } });
  await db.cardOwnership.deleteMany({ where: { ownerId: mine } });
  await db.card.deleteMany({ where: { id: mine } });
  await db.country.deleteMany({ where: { id: mine } });
  await db.user.deleteMany({ where: { id: mine } });
  await db.cardDustBalance.deleteMany({ where: { realmId: mine } });
  await db.realm.deleteMany({ where: { id: mine } });
}
