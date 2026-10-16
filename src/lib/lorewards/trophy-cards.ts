/**
 * Loreward trophy cards: every recorded Loreward place (daily, weekly or monthly; winner or runner-up) is a
 * one-of-one, bound Trophy card (cards refresh §2.1) for that wiki user, its copy Serialised. The card is minted
 * once per (entry, edition) and held unowned until the user's wiki account is verified-linked
 * (`resolveLorewardUser`), then granted exactly once.
 * No IxCredits are written here: trophy cards stay out of deck value and the dividend (`EXCLUDE_TROPHY_CARDS`).
 * A Lore card and a Trophy card may exist for the same article (§3).
 */
import { type Prisma, type PrismaClient } from "@prisma/client";
import { isUniqueViolation } from "~/lib/prisma-error";
import { LoreCategory } from "~/lib/cards/category-enums";
import { CardFinish, CardRarity, CardType } from "~/lib/cards/enums";
import { articleHomeRealm } from "~/lib/cards/home-realm";
import { canonicalArticleTitle } from "~/lib/cards/legacy-mapping";
import { mintCopy } from "~/lib/cards/mint";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { lockCardSerialsTx } from "~/lib/cards/serial-number";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { resolveLorewardUser } from "./resolve-user";

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

interface TrophyEntry {
  id: string;
  type: string;
  date: string;
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
}

const metaOf = (value: Prisma.JsonValue | null | undefined): Prisma.JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

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
  const wikiUser = place === "winner" ? entry.winnerUser : entry.runnerUpUser;
  const page = place === "winner" ? entry.winnerPage : entry.runnerUpPage;
  if (!wikiUser) return false;

  const label = CONTEST_LABEL[entry.type];
  const rarity = trophyRarity(entry.type, place);
  const userId = await resolveLorewardUser(db, wikiUser);
  try {
    await db.$transaction(async (tx) => {
      const title = page ?? `${label} Loreward ${entry.date}`;
      const card = await tx.card.create({
        data: {
          title,
          description: `${label} Loreward ${place}, ${entry.date}. Won by ${wikiUser}${page ? ` with ${page}` : ""}.`,
          category: LoreCategory.SPECIAL,
          cardType: CardType.TROPHY,
          isBound: true,
          realmId: await articleHomeRealm(tx, "ixwiki", title),
          rarity,
          season,
          wikiSource: "ixwiki",
          wikiArticleTitle: page === null ? null : canonicalArticleTitle(page, "ixwiki"),
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
        await mintCopy(tx, {
          cardId: card.id,
          ownerId: userId,
          finish: CardFinish.SERIALISED,
          source: "TROPHY",
        });
      }
    });
    return true;
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

/** The recorded places of the approved daily, weekly and monthly entries (or only `entryIds`) with no card yet. */
async function missingPlaces(db: PrismaClient, entryIds?: string[]): Promise<MissingPlace[]> {
  const [entries, existing] = await Promise.all([
    db.lorewardEntry.findMany({
      where: {
        status: "approved",
        type: { in: CONTESTS },
        ...(entryIds ? { id: { in: entryIds } } : {}),
      },
      select: {
        id: true,
        type: true,
        date: true,
        winnerUser: true,
        winnerPage: true,
        runnerUpUser: true,
        runnerUpPage: true,
      },
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
 * or only `entryIds`) that has none yet, owned by the place's verified-linked user when there is one.
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
    // The per-card lock first, so a concurrent grant waits and then sees this one.
    await lockCardSerialsTx(tx, cardId);
    const card = await tx.card.findUnique({ where: { id: cardId }, select: { metadata: true } });
    const meta = metaOf(card?.metadata);
    if (!card || meta.grantedTo || (await tx.cardOwnership.count({ where: { cardId } })) > 0) {
      return false;
    }
    await mintCopy(tx, {
      cardId,
      ownerId: userId,
      finish: CardFinish.SERIALISED,
      source: "TROPHY",
    });
    await tx.card.update({
      where: { id: cardId },
      data: { metadata: { ...meta, grantedTo: userId, grantedAt: new Date().toISOString() } },
    });
    return true;
  });
}

/**
 * Grants each unowned trophy card to its winner once that wiki account has a verified link. A card granted
 * before is never granted again, A trophy is bound and stays with
 * the account it was granted to (§3).
 */
export async function grantUnownedTrophyCards(db: PrismaClient): Promise<{ granted: number }> {
  const unowned = await db.card.findMany({
    where: { lorewardEntryId: { not: null }, CardOwnership: { none: {} } },
    select: { id: true, metadata: true },
  });

  const byWikiUser = new Map<string, string[]>();
  for (const card of unowned) {
    const { wikiUser, grantedTo } = metaOf(card.metadata);
    if (grantedTo || typeof wikiUser !== "string") continue;
    byWikiUser.set(wikiUser, [...(byWikiUser.get(wikiUser) ?? []), card.id]);
  }

  let granted = 0;
  for (const [wikiUser, cardIds] of byWikiUser) {
    const userId = await resolveLorewardUser(db, wikiUser);
    if (!userId) continue;
    for (const cardId of cardIds) if (await grantOne(db, cardId, userId)) granted++;
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
 * The one-time history backfill: a trophy card for every recorded place back to 2017, granted to linked
 * winners, with no credits. Reports what is missing and writes nothing unless `apply`; idempotent.
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
