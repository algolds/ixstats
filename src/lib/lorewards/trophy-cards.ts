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
import { contestHolder, contestPlaceKey, groupByContest, type Contest } from "./contest-identity";
import {
  contestEntryIds,
  findContestEntries,
  lockContestPlace,
  type StoredContestEntry,
} from "./contest-store";
import { placeOf, resolveLorewardPlace, type LorewardPlaceRef } from "./resolve-user";

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

type TrophyEntry = StoredContestEntry;

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
async function mintedKeys(db: PrismaClient): Promise<Set<string>> {
  const rows = await db.card.findMany({
    where: { lorewardEntryId: { not: null } },
    select: { lorewardEntryId: true, lorewardEdition: true },
  });
  return new Set(rows.map((r) => `${r.lorewardEntryId}:${r.lorewardEdition}`));
}

/** Whether a card of this place of the contest (its entries `entryIds`, read inside the place's lock) exists. */
async function contestPlaceMinted(
  tx: Prisma.TransactionClient,
  entryIds: string[],
  place: LorewardPlace
): Promise<boolean> {
  const count = await tx.card.count({
    where: { lorewardEntryId: { in: entryIds }, lorewardEdition: place },
  });
  return count > 0;
}

async function mintOne(
  db: PrismaClient,
  season: number,
  { entry, place }: MissingPlace
): Promise<boolean> {
  const recorded = placeOf(entry, place);
  if (!recorded) return false;
  const { wikiUser, page } = recorded;

  const label = CONTEST_LABEL[entry.type];
  const rarity = trophyRarity(entry.type, place);
  const userId = await resolveLorewardPlace(db, recorded);
  try {
    return await db.$transaction(async (tx) => {
      // One card per contest place: a concurrent sync waits here, then finds this card.
      await lockContestPlace(tx, contestPlaceKey(entry, place));
      if (await contestPlaceMinted(tx, await contestEntryIds(tx, entry), place)) return false;
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
      return true;
    });
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

/**
 * Every approved daily, weekly and monthly entry, by contest (`groupByContest`: a contest can be stored twice), read
 * in pages so the 1,000-row cap drops none.
 */
async function contests(db: PrismaClient) {
  return groupByContest(
    await findContestEntries(db, { status: "approved", type: { in: CONTESTS } })
  );
}

const cardKeys = (contest: Contest<TrophyEntry>, place: LorewardPlace) =>
  contest.map((entry) => `${entry.id}:${place}`);

/**
 * The recorded places of the approved contests (or only those holding one of `entryIds`) with no card yet: one card
 * per contest and place, through the entry `contestHolder` chooses, and none while the contest's entries disagree.
 */
async function missingPlaces(db: PrismaClient, entryIds?: string[]): Promise<MissingPlace[]> {
  const [all, existing] = await Promise.all([contests(db), mintedKeys(db)]);

  const missing: MissingPlace[] = [];
  for (const contest of all) {
    if (entryIds && !contest.some((entry) => entryIds.includes(entry.id))) continue;
    for (const place of PLACES) {
      const holder = contestHolder(contest, place);
      if ("conflict" in holder || cardKeys(contest, place).some((key) => existing.has(key)))
        continue;
      const { entry } = holder;
      if (isContest(entry.type) && placeOf(entry, place)) {
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
  for (const place of missing) if (await mintOne(db, season, place)) minted++;
  return { minted };
}

/** One trophy card to grant, the place it is resolved from, and the contest entry it is chosen through. */
interface TrophyGrant {
  cardId: string;
  recorded: LorewardPlaceRef;
  place: LorewardPlace;
  entry: TrophyEntry;
}

/**
 * Whether a card of this place of the contest (its entries `entryIds`, read inside the place's lock) is owned, or was
 * granted before.
 */
async function contestPlaceSettled(
  tx: Prisma.TransactionClient,
  entryIds: string[],
  place: LorewardPlace
): Promise<boolean> {
  const where = { lorewardEntryId: { in: entryIds }, lorewardEdition: place };
  const [owned, placeCards] = await Promise.all([
    tx.cardOwnership.count({ where: { cards: where } }),
    tx.card.findMany({ where, select: { metadata: true } }),
  ]);
  return owned > 0 || placeCards.some((card) => Boolean(metaOf(card.metadata).grantedTo));
}

/**
 * Gives one unowned trophy card to `userId`, unless a card of its contest place (this one or a twin's) gained an owner
 * or was granted in the meantime.
 */
async function grantOne(db: PrismaClient, grant: TrophyGrant, userId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // One card per contest place: a concurrent grant of it waits here, then sees this one.
    await lockContestPlace(tx, contestPlaceKey(grant.entry, grant.place));
    const entryIds = await contestEntryIds(tx, grant.entry);
    if (await contestPlaceSettled(tx, entryIds, grant.place)) return false;
    const serial = await allocateSerialNumberTx(tx, grant.cardId);
    const card = await tx.card.findUnique({
      where: { id: grant.cardId },
      select: { metadata: true },
    });
    if (!card) return false;
    await tx.cardOwnership.create({ data: ownershipData(grant.cardId, userId, serial) });
    await tx.card.update({
      where: { id: grant.cardId },
      data: {
        metadata: {
          ...metaOf(card.metadata),
          grantedTo: userId,
          grantedAt: new Date().toISOString(),
        },
      },
    });
    return true;
  });
}

interface UnownedCard {
  id: string;
  metadata: Prisma.JsonValue;
  lorewardEntryId: string | null;
  lorewardEdition: string | null;
}

/**
 * The card to grant for each place of each approved contest, and the place to resolve it from: one per contest and
 * place (the chosen entry's card, else its twin's), none while the contest's entries disagree, and none once one of
 * its cards was owned or granted.
 */
function cardsToGrant(
  unowned: UnownedCard[],
  all: Array<Contest<TrophyEntry>>,
  minted: Set<string>
): TrophyGrant[] {
  const waiting = new Map(
    unowned.map((card) => [
      `${card.lorewardEntryId}:${card.lorewardEdition}`,
      { id: card.id, granted: Boolean(metaOf(card.metadata).grantedTo) },
    ])
  );
  // A card that exists but is not waiting is owned; one granted before (then removed) stays settled.
  const settled = (key: string) => minted.has(key) && (waiting.get(key)?.granted ?? true);

  const grants: TrophyGrant[] = [];
  for (const contest of all) {
    for (const place of PLACES) {
      const holder = contestHolder(contest, place);
      const keys = cardKeys(contest, place);
      if ("conflict" in holder || keys.some(settled)) continue;
      const card =
        waiting.get(`${holder.entry.id}:${place}`) ??
        keys.map((key) => waiting.get(key)).find((found) => found !== undefined);
      const recorded = placeOf(holder.entry, place);
      if (card && recorded) {
        grants.push({ cardId: card.id, recorded, place, entry: holder.entry });
      }
    }
  }
  return grants;
}

/**
 * Grants each unowned trophy card of an approved contest to its place's account once `resolveLorewardPlace` tells
 * it: one card per contest and place. A card granted before is never granted again, even if its owner later sold,
 * junked or crafted it away.
 */
export async function grantUnownedTrophyCards(db: PrismaClient): Promise<{ granted: number }> {
  const unowned = await db.card.findMany({
    where: { lorewardEntryId: { not: null }, CardOwnership: { none: {} } },
    select: { id: true, metadata: true, lorewardEntryId: true, lorewardEdition: true },
  });
  const [all, minted] = await Promise.all([contests(db), mintedKeys(db)]);

  let granted = 0;
  for (const grant of cardsToGrant(unowned, all, minted)) {
    const userId = await resolveLorewardPlace(db, grant.recorded);
    if (userId && (await grantOne(db, grant, userId))) granted++;
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
