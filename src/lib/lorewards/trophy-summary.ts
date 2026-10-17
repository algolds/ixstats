import type { Prisma, PrismaClient } from "@prisma/client";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "~/lib/cards/hub/faces";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { canonicalWikiName } from "./resolve-user";

export interface TrophyCardSummary {
  id: string;
  title: string;
  contest: LorewardType;
  place: LorewardPlace;
  /** The trophy's face. A player's trophies are their showcase, so the art always shows. */
  face: CardFaceData;
}

export interface Trophies {
  wins: { daily: number; weekly: number; monthly: number };
  /** Daily runner-ups: weekly and monthly runner-ups are not recorded. */
  runnerUps: number;
  streak: number;
  /** The trophy cards the user's account holds. */
  cards: TrophyCardSummary[];
  /** The passport handle of the account holding the cards, which opens their sheets through its display; null: none. */
  holderHandle: string | null;
}

type TrophyDb = Pick<PrismaClient, "lorewardUserStats" | "cardOwnership">;

/**
 * The holder's passport handle (`passportHandleOf`), which may be a wiki or forum name or a Clerk id: the router
 * passes it in, as lib code never imports server modules.
 */
type PassportHandleOf = (userId: string) => Promise<string | null>;

export const NO_TROPHIES: Trophies = {
  wins: { daily: 0, weekly: 0, monthly: 0 },
  runnerUps: 0,
  streak: 0,
  cards: [],
  holderHandle: null,
};

/** The contest a trophy card was minted for (`metadata.contest`), or null when it was not recorded. */
function contestOf(metadata: Prisma.JsonValue): LorewardType | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const { contest } = metadata;
  return contest === "daily" || contest === "weekly" || contest === "monthly" ? contest : null;
}

const placeOf = (edition: string | null): LorewardPlace | null =>
  edition === "winner" || edition === "runner-up" ? edition : null;

/** The trophy cards `userId` owns; a card whose contest or place was not recorded is left out. */
export async function ownedTrophyCards(
  db: Pick<PrismaClient, "cardOwnership">,
  userId: string
): Promise<TrophyCardSummary[]> {
  const owned = await db.cardOwnership.findMany({
    where: { ownerId: userId, cards: { lorewardEntryId: { not: null } } },
    select: {
      ...COPY_FACE_SELECT,
      cards: { select: { ...CARD_FACE_SELECT, lorewardEdition: true, metadata: true } },
    },
    orderBy: { acquiredAt: "desc" },
  });
  const summaries: TrophyCardSummary[] = [];
  for (const row of owned) {
    const card = row.cards;
    const contest = contestOf(card.metadata);
    const place = placeOf(card.lorewardEdition);
    if (!contest || !place) continue;
    const face = toCardFace(card, { revealArt: true, copy: row });
    summaries.push({ id: card.id, title: card.title, contest, place, face });
  }
  return summaries;
}

/**
 * A wiki name's public trophies: counts from that exact name's Lorewards stats (`canonicalWikiName`: MediaWiki names
 * are case-sensitive after the first letter, so "OstroZava" is not "Ostrozava") and the trophy cards held by the
 * platform account `userId` that verified the name (null: none), with that account's passport handle (`handleOf`).
 */
export async function loadTrophies(
  db: TrophyDb,
  wikiUsername: string,
  userId: string | null,
  handleOf: PassportHandleOf
): Promise<Trophies> {
  const [stats, cards, holderHandle] = await Promise.all([
    db.lorewardUserStats.findFirst({
      where: { username: canonicalWikiName(wikiUsername) },
    }),
    userId ? ownedTrophyCards(db, userId) : Promise.resolve([]),
    userId ? handleOf(userId) : Promise.resolve(null),
  ]);
  if (!stats) return { ...NO_TROPHIES, cards, holderHandle };
  return {
    wins: { daily: stats.dailyWins, weekly: stats.weeklyWins, monthly: stats.monthlyWins },
    runnerUps: stats.dailyRunnerUps,
    streak: stats.currentStreak,
    cards,
    holderHandle,
  };
}

/** The IxCredits the account has been paid in Loreward bonuses (winner and runner-up places). */
export async function lorewardCreditsPaid(
  db: Pick<PrismaClient, "vaultTransaction">,
  userId: string
): Promise<number> {
  const paid = await db.vaultTransaction.aggregate({
    where: { type: "EARN_BONUS", source: { startsWith: "bonus:loreward:" }, vault: { userId } },
    _sum: { credits: true },
  });
  return paid._sum.credits ?? 0;
}
