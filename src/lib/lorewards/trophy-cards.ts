/**
 * Loreward trophy cards: every recorded Loreward place (daily, weekly or monthly; winner or runner-up) is a
 * one-of-one, tradeable lore card for that wiki user. The card is minted once per (entry, edition) and held
 * unowned until the place's account can be told (a plain name's exact verified wiki link, or the one WikiOS account
 * behind a `wikios>` name's edits: `resolveLorewardPlace`), then granted exactly once.
 * No IxCredits are written here: trophy cards are collectibles, kept out of deck value (`EXCLUDE_TROPHY_CARDS`).
 *
 * A trophy card carries the winning page's `wikiArticleTitle` like any lore card, so random lore generation
 * will not make a second card of that page (`checkCardExists`); that is intended.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { LoreCategory } from "~/lib/cards/category-enums";
import { CardRarity, CardType } from "~/lib/cards/enums";
import { newCardOwnershipId } from "~/lib/cards/ownership-id";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { allocateSerialNumberTx } from "~/lib/cards/serial-number";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { placeOf, resolveLorewardPlace } from "./resolve-user";

/** Prisma `where` fragment for a card relation that leaves trophy cards out (deck value, collection interest). */
export const EXCLUDE_TROPHY_CARDS = { lorewardEntryId: null } as const;

export const isTrophyCard = (card: { lorewardEntryId: string | null }) =>
  card.lorewardEntryId !== null;

const CONTESTS: LorewardType[] = ["daily", "weekly", "monthly"];
const PLACES: LorewardPlace[] = ["winner", "runner-up"];
const CONTEST_LABEL: Record<LorewardType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/** The lore generator's catalog value for each rarity a trophy card can take. */
const TROPHY_MARKET_VALUE: Record<string, number> = {
  [CardRarity.RARE]: 40,
  [CardRarity.EPIC]: 250,
  [CardRarity.LEGENDARY]: 600,
};

const isContest = (type: string): type is LorewardType => (CONTESTS as string[]).includes(type);

/** Legendary for a monthly winner; Epic for a weekly winner and a monthly runner-up; Rare for the rest. */
export function trophyRarity(type: LorewardType, place: LorewardPlace): CardRarity {
  if (type === "monthly" && place === "winner") return CardRarity.LEGENDARY;
  if (type === "monthly" || (type === "weekly" && place === "winner")) return CardRarity.EPIC;
  return CardRarity.RARE;
}

interface TrophyEntry {
  id: string;
  type: string;
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
}

const metaOf = (value: Prisma.JsonValue | null | undefined): Prisma.JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

/** A unique violation: `P2002` from a raw client, a `ConflictError` once it passes through `~/server/db`. */
const isUniqueViolation = (error: Error) =>
  (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
  error instanceof ConflictError;

const ownershipData = (cardId: string, userId: string, serialNumber: number) => ({
  id: newCardOwnershipId(),
  cardId,
  userId,
  ownerId: userId,
  serialNumber,
  quantity: 1,
  level: 1,
  experience: 0,
  isLocked: false,
  acquiredAt: new Date(),
});

/** Keys (`<entryId>:<edition>`) of the trophy cards that already exist. */
async function mintedKeys(db: PrismaClient, entryIds?: string[]): Promise<Set<string>> {
  const rows = await db.card.findMany({
    where: { lorewardEntryId: entryIds ? { in: entryIds } : { not: null } },
    select: { lorewardEntryId: true, lorewardEdition: true },
  });
  return new Set(rows.map((r) => `${r.lorewardEntryId}:${r.lorewardEdition}`));
}

async function mintOne(
  db: PrismaClient,
  season: number,
  entry: TrophyEntry & { type: LorewardType },
  place: LorewardPlace
): Promise<boolean> {
  const recorded = placeOf(entry, place);
  if (!recorded) return false;
  const { wikiUser, page } = recorded;

  const label = CONTEST_LABEL[entry.type];
  const rarity = trophyRarity(entry.type, place);
  const userId = await resolveLorewardPlace(db, recorded);
  try {
    await db.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          title: page ?? `${label} Loreward ${entry.date}`,
          description: `${label} Loreward ${place}, ${entry.date}. Won by ${wikiUser}${page ? ` with ${page}` : ""}.`,
          category: LoreCategory.SPECIAL,
          cardType: CardType.LORE,
          rarity,
          season,
          wikiSource: "ixwiki",
          wikiArticleTitle: page,
          totalSupply: 1,
          marketValue: TROPHY_MARKET_VALUE[rarity]!,
          lorewardEntryId: entry.id,
          lorewardEdition: place,
          metadata: {
            contest: entry.type,
            place,
            date: entry.date,
            entryId: entry.id,
            wikiUser,
            ...(userId ? { grantedTo: userId } : {}),
          },
        },
      });
      if (userId) {
        const serial = await allocateSerialNumberTx(tx, card.id);
        await tx.cardOwnership.create({ data: ownershipData(card.id, userId, serial) });
      }
    });
    return true;
  } catch (error) {
    // Another run minted this place between the existence check and the insert.
    if (error instanceof Error && isUniqueViolation(error)) return false;
    throw error;
  }
}

interface MissingPlace {
  entry: TrophyEntry & { type: LorewardType };
  place: LorewardPlace;
}

/** The entry columns a trophy card's place is resolved from. */
const ENTRY_SELECT = {
  id: true,
  type: true,
  date: true,
  dateStart: true,
  dateEnd: true,
  winnerUser: true,
  winnerPage: true,
  runnerUpUser: true,
  runnerUpPage: true,
} as const;

/** The recorded places of the approved daily, weekly and monthly entries (or only `entryIds`) with no card yet. */
async function missingPlaces(db: PrismaClient, entryIds?: string[]): Promise<MissingPlace[]> {
  const [entries, existing] = await Promise.all([
    db.lorewardEntry.findMany({
      where: {
        status: "approved",
        type: { in: CONTESTS },
        ...(entryIds ? { id: { in: entryIds } } : {}),
      },
      select: ENTRY_SELECT,
      orderBy: { date: "asc" },
    }),
    mintedKeys(db, entryIds),
  ]);

  const missing: MissingPlace[] = [];
  for (const entry of entries) {
    if (!isContest(entry.type)) continue;
    for (const place of PLACES) {
      const recorded = place === "winner" ? entry.winnerUser : entry.runnerUpUser;
      if (recorded && !existing.has(`${entry.id}:${place}`)) {
        missing.push({ entry: { ...entry, type: entry.type }, place });
      }
    }
  }
  return missing;
}

/**
 * Mints the trophy card of every recorded place of the approved daily, weekly and monthly entries (all of them,
 * or only `entryIds`) that has none yet, owned by the place's user when `resolveLorewardPlace` tells one.
 * Idempotent: the unique (entry, edition) key means a re-run mints nothing new. Entries before the payout start
 * mint too (the history backfill); no credits are paid.
 */
export async function mintTrophyCards(
  db: PrismaClient,
  entryIds?: string[]
): Promise<{ minted: number }> {
  const [missing, season] = await Promise.all([
    missingPlaces(db, entryIds),
    getCurrentIxCardSeason(db),
  ]);
  let minted = 0;
  for (const { entry, place } of missing) if (await mintOne(db, season, entry, place)) minted++;
  return { minted };
}

/** Gives one unowned trophy card to `userId` unless it gained an owner, or was granted before, in the meantime. */
async function grantOne(db: PrismaClient, cardId: string, userId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // Takes the per-card lock, so a concurrent grant waits and then sees this one.
    const serial = await allocateSerialNumberTx(tx, cardId);
    const card = await tx.card.findUnique({ where: { id: cardId }, select: { metadata: true } });
    const meta = metaOf(card?.metadata);
    if (!card || meta.grantedTo || (await tx.cardOwnership.count({ where: { cardId } })) > 0) {
      return false;
    }
    await tx.cardOwnership.create({ data: ownershipData(cardId, userId, serial) });
    await tx.card.update({
      where: { id: cardId },
      data: { metadata: { ...meta, grantedTo: userId, grantedAt: new Date().toISOString() } },
    });
    return true;
  });
}

const editionOf = (edition: string | null): LorewardPlace | null =>
  edition === "winner" || edition === "runner-up" ? edition : null;

/**
 * Grants each unowned trophy card of an approved entry to its place's account once `resolveLorewardPlace` tells
 * it. A card granted before is never granted again, even if its owner later sold, junked or crafted it away.
 */
export async function grantUnownedTrophyCards(db: PrismaClient): Promise<{ granted: number }> {
  const unowned = await db.card.findMany({
    where: { lorewardEntryId: { not: null }, CardOwnership: { none: {} } },
    select: { id: true, metadata: true, lorewardEntryId: true, lorewardEdition: true },
  });
  const waiting = unowned.filter((card) => !metaOf(card.metadata).grantedTo);
  const entryIds = [...new Set(waiting.flatMap((card) => card.lorewardEntryId ?? []))];
  const entries = await db.lorewardEntry.findMany({
    where: { id: { in: entryIds }, status: "approved" },
    select: ENTRY_SELECT,
  });
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  let granted = 0;
  for (const card of waiting) {
    const entry = card.lorewardEntryId ? entryById.get(card.lorewardEntryId) : undefined;
    const edition = editionOf(card.lorewardEdition);
    const recorded = entry && edition ? placeOf(entry, edition) : null;
    const userId = recorded ? await resolveLorewardPlace(db, recorded) : null;
    if (userId && (await grantOne(db, card.id, userId))) granted++;
  }
  return { granted };
}

export interface TrophyBackfillReport {
  /** Places with no card yet, by `<contest>:<place>`. */
  missing: Record<string, number>;
  minted: number;
  granted: number;
}

/**
 * The one-time history backfill: a trophy card for every recorded place back to 2017, granted where
 * `resolveLorewardPlace` tells the place's account, with no credits. Reports what is missing and writes nothing unless `apply`; idempotent.
 */
export async function backfillTrophyCards(
  db: PrismaClient,
  apply: boolean
): Promise<TrophyBackfillReport> {
  const missing: Record<string, number> = {};
  for (const { entry, place } of await missingPlaces(db)) {
    const key = `${entry.type}:${place}`;
    missing[key] = (missing[key] ?? 0) + 1;
  }
  if (!apply) return { missing, minted: 0, granted: 0 };
  const { minted } = await mintTrophyCards(db);
  const { granted } = await grantUnownedTrophyCards(db);
  return { missing, minted, granted };
}
