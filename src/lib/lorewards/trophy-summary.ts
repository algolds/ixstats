import type { Prisma, PrismaClient } from "@prisma/client";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import type { TodayRace } from "./today-race";

export interface TrophyCardSummary {
  id: string;
  title: string;
  contest: LorewardType;
  place: LorewardPlace;
}

export interface Trophies {
  wins: { daily: number; weekly: number; monthly: number };
  /** Daily runner-ups: weekly and monthly runner-ups are not recorded. */
  runnerUps: number;
  streak: number;
  /** The trophy cards the user's account holds. */
  cards: TrophyCardSummary[];
}

type TrophyDb = Pick<PrismaClient, "lorewardUserStats" | "cardOwnership">;

export const NO_TROPHIES: Trophies = {
  wins: { daily: 0, weekly: 0, monthly: 0 },
  runnerUps: 0,
  streak: 0,
  cards: [],
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
async function ownedTrophyCards(db: TrophyDb, userId: string): Promise<TrophyCardSummary[]> {
  const owned = await db.cardOwnership.findMany({
    where: { ownerId: userId, cards: { lorewardEntryId: { not: null } } },
    select: { cards: { select: { id: true, title: true, lorewardEdition: true, metadata: true } } },
    orderBy: { acquiredAt: "desc" },
  });
  const summaries: TrophyCardSummary[] = [];
  for (const { cards: card } of owned) {
    const contest = contestOf(card.metadata);
    const place = placeOf(card.lorewardEdition);
    if (contest && place) summaries.push({ id: card.id, title: card.title, contest, place });
  }
  return summaries;
}

/**
 * A wiki user's trophies: counts from their Lorewards stats (matched case-insensitively, like the leaderboards)
 * and the trophy cards held by the platform account `userId` that verified the wiki name (null: none).
 */
export async function loadTrophies(
  db: TrophyDb,
  wikiUsername: string,
  userId: string | null
): Promise<Trophies> {
  const [stats, cards] = await Promise.all([
    db.lorewardUserStats.findFirst({
      where: { username: { equals: wikiUsername, mode: "insensitive" } },
    }),
    userId ? ownedTrophyCards(db, userId) : Promise.resolve([]),
  ]);
  if (!stats) return { ...NO_TROPHIES, cards };
  return {
    wins: { daily: stats.dailyWins, weekly: stats.weeklyWins, monthly: stats.monthlyWins },
    runnerUps: stats.dailyRunnerUps,
    streak: stats.currentStreak,
    cards,
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

/** The wiki user's place (1-based) in today's top ten, or null when they are not in it. */
export function todayRankOf(race: TodayRace, wikiUsername: string): number | null {
  const wanted = wikiUsername.toLowerCase();
  return race.entries.find((e) => e.user.toLowerCase() === wanted)?.rank ?? null;
}
