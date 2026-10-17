/**
 * Loreward trophy cards: every recorded Loreward place (daily, weekly or monthly; winner or runner-up) is a
 * one-of-one, bound Trophy card (cards refresh §2.1) for that wiki user, its copy Serialised. The card is minted
 * once per (entry, edition) and held unowned until the place's account can be told (a plain name's exact verified
 * wiki link, or the one WikiOS account behind a `wikios>` name's edits: `resolveLorewardPlace`), then granted
 * exactly once.
 * No IxCredits are written here: trophy cards stay out of deck value and the dividend (`EXCLUDE_TROPHY_CARDS`).
 * A Lore card and a Trophy card may exist for the same article (§3).
 */
import { type Prisma, type PrismaClient } from "@prisma/client";
import { isUniqueViolation } from "~/lib/prisma-error";
import { LoreCategory } from "~/lib/cards/category-enums";
import { CardFinish, CardRarity, CardType } from "~/lib/cards/enums";
import { articleHomeRealm } from "~/lib/cards/home-realm";
import { canonicalArticleTitle } from "~/lib/cards/legacy-mapping";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { mintCopy } from "~/lib/cards/mint";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { highestIssuedSerialTx, lockCardSerialsTx } from "~/lib/cards/serial-number";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { contestHolder, contestPlaceKey, groupByContest, type Contest } from "./contest-identity";
import {
  findContestEntries,
  holderStillRecordedTx,
  lockContestPlace,
  type StoredContestEntry,
} from "./contest-store";
import { placeOf, resolveLorewardPlace, type LorewardPlaceRef } from "./resolve-user";

/** Prisma `where` fragment for a card relation that leaves every trophy out (deck value, the dividend, packs). */
export const EXCLUDE_TROPHY_CARDS = { cardType: { not: CardType.TROPHY } } as const;

export const isTrophyCard = (card: { cardType: string }) => card.cardType === CardType.TROPHY;

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

/** A trophy card's title, description and article, from its contest, date, place, winner and page. */
export function trophyCardText(
  type: LorewardType,
  date: string,
  place: LorewardPlace,
  wikiUser: string,
  page: string | null
) {
  const label = CONTEST_LABEL[type];
  return {
    title: page ?? `${label} Loreward ${date}`,
    description: `${label} Loreward ${place}, ${date}. Won by ${wikiUser}${page ? ` with ${page}` : ""}.`,
    wikiArticleTitle: page === null ? null : canonicalArticleTitle(page, "ixwiki"),
  };
}

/**
 * Mints a trophy's one copy for `ownerId`: serial 1 the first time, and that serial again, reissued, once its place
 * changed hands and the copy was voided (§2.4). A trophy is a one-of-one, so a second serial would pass its run. The
 * caller holds the card's serial lock (the grant and an override take it), or created the card in this transaction.
 */
export async function mintTrophyCopyTx(
  tx: Prisma.TransactionClient,
  cardId: string,
  ownerId: string
): Promise<void> {
  const issued = await highestIssuedSerialTx(tx, cardId);
  await mintCopy(tx, {
    cardId,
    ownerId,
    finish: CardFinish.SERIALISED,
    source: "TROPHY",
    ...(issued > 0 ? { serialNumber: issued } : {}),
  });
}

type TrophyEntry = StoredContestEntry;

const metaOf = (value: Prisma.JsonValue | null | undefined): Prisma.JsonObject =>
  isJsonObject(value) ? value : {};

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

  const rarity = trophyRarity(entry.type, place);
  const userId = await resolveLorewardPlace(db, recorded);
  try {
    return await db.$transaction(async (tx) => {
      // One card per contest place: a concurrent sync waits here, then finds this card. An override that wrote the
      // place meanwhile leaves the listed holder unrecorded, and this run mints nothing for it.
      await lockContestPlace(tx, contestPlaceKey(entry, place));
      const entryIds = await holderStillRecordedTx(tx, entry, place, recorded);
      if (!entryIds || (await contestPlaceMinted(tx, entryIds, place))) return false;
      const text = trophyCardText(entry.type, entry.date, place, wikiUser, page);
      const card = await tx.card.create({
        data: {
          ...text,
          category: LoreCategory.SPECIAL,
          cardType: CardType.TROPHY,
          isBound: true,
          realmId: await articleHomeRealm(tx, "ixwiki", text.title),
          rarity,
          season,
          wikiSource: "ixwiki",
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
      if (userId) await mintTrophyCopyTx(tx, card.id, userId);
      return true;
    });
  } catch (error) {
    // Another run minted this place between the existence check and the insert.
    if (isUniqueViolation(error)) return false;
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
 * Gives one unowned trophy card to `userId`, unless, by the time both locks are held, the place no longer records the
 * listed holder (an override or a sync wrote it), a card of its contest place (this one or a twin's) gained an owner
 * or was granted, or the card was retired.
 */
async function grantOne(db: PrismaClient, grant: TrophyGrant, userId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // One card per contest place: a concurrent grant of it waits here, then sees this one. The per-card lock comes
    // second, never first (mintCopy takes it again), so the checks below read under both.
    await lockContestPlace(tx, contestPlaceKey(grant.entry, grant.place));
    await lockCardSerialsTx(tx, grant.cardId);
    const entryIds = await holderStillRecordedTx(tx, grant.entry, grant.place, grant.recorded);
    if (!entryIds || (await contestPlaceSettled(tx, entryIds, grant.place))) return false;
    const card = await tx.card.findUnique({
      where: { id: grant.cardId },
      select: { metadata: true, isRetired: true },
    });
    if (!card || card.isRetired) return false;
    await mintTrophyCopyTx(tx, grant.cardId, userId);
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
 * it: one card per contest and place. A card granted before is never granted again: a trophy is bound and stays with
 * the account it was granted to (§3), unless an override of its place clears the grant (§2.4). A retired card (a
 * place an override emptied) waits for an override to fill the place again.
 */
export async function grantUnownedTrophyCards(db: PrismaClient): Promise<{ granted: number }> {
  const unowned = await db.card.findMany({
    where: { lorewardEntryId: { not: null }, isRetired: false, CardOwnership: { none: {} } },
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
