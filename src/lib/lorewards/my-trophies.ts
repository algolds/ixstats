/**
 * The viewer's own Lorewards. With a verified ixwiki link the name's whole record is theirs. Without one, a name
 * their WikiOS edits carry proves nothing on its own (another player, or a MediaWiki editor, can carry it too), so
 * only the places tied to them count: those whose winning edits are all theirs (`winningEditsAuthor`).
 */
import type { PrismaClient } from "@prisma/client";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import {
  contestWindow,
  nameSpellings,
  placeOf,
  verifiedLorewardUser,
  winningEditsAuthor,
  type LorewardPlaceRef,
} from "./resolve-user";
import { calculateStreaks } from "./streaks";
import type { TodayRace } from "./today-race";
import {
  loadTrophies,
  NO_TROPHIES,
  ownedTrophyCards,
  todayRankOf,
  type Trophies,
} from "./trophy-summary";

type MyTrophiesDb = Pick<
  PrismaClient,
  "wikiAccountLink" | "wikiRevision" | "lorewardEntry" | "lorewardUserStats" | "cardOwnership"
>;

export interface MyTrophies extends Trophies {
  /** The viewer's verified ixwiki name, else the name their latest WikiOS edit carries; null with neither. */
  wikiUsername: string | null;
  /** Whether `wikiUsername` is the viewer's verified link, so the name's public record (stats, history) is theirs. */
  verified: boolean;
  /** Places recorded under the viewer's WikiOS names that could not be tied to them. */
  unmatched: number;
}

const CONTESTS: LorewardType[] = ["daily", "weekly", "monthly"];
const PLACES: LorewardPlace[] = ["winner", "runner-up"];

const isContest = (type: string): type is LorewardType => (CONTESTS as string[]).includes(type);

interface TiedPlace {
  type: LorewardType;
  place: LorewardPlace;
  date: string;
}

interface WikiosNames {
  names: string[];
  latest: string;
  /** When the viewer's first ixwiki WikiOS edit was made (ms). */
  since: number;
}

/** The names the viewer's ixwiki WikiOS edits carry, the latest one, and when the first edit was made. */
async function wikiosNames(db: MyTrophiesDb, userId: string): Promise<WikiosNames | null> {
  const rows = await db.wikiRevision.groupBy({
    by: ["author"],
    where: { authorId: userId, source: "ixwiki", author: { not: null } },
    _min: { createdAt: true },
    _max: { createdAt: true },
  });
  const names: string[] = [];
  let latest: { name: string; at: number } | null = null;
  let since = Infinity;
  for (const row of rows) {
    if (!row.author) continue;
    names.push(row.author);
    const at = row._max?.createdAt?.getTime() ?? 0;
    if (!latest || at > latest.at) latest = { name: row.author, at };
    since = Math.min(since, row._min?.createdAt?.getTime() ?? Infinity);
  }
  return latest ? { names, latest: latest.name, since } : null;
}

/**
 * Whether a place recorded under one of the viewer's names is theirs. "other": someone else verified the name, so
 * it is theirs, not the viewer's. "unmatched": its winning edits are not all the viewer's (or are not mirrored).
 */
async function tieOf(
  db: MyTrophiesDb,
  userId: string,
  recorded: LorewardPlaceRef,
  since: number,
  holders: Map<string, string | null>
): Promise<"tied" | "unmatched" | "other"> {
  if (!holders.has(recorded.wikiUser)) {
    holders.set(recorded.wikiUser, await verifiedLorewardUser(db, recorded.wikiUser));
  }
  if (holders.get(recorded.wikiUser)) return "other";
  // A contest that ended before the viewer's first WikiOS edit has no winning edit of theirs.
  const window = contestWindow(recorded);
  if (window && window.lt.getTime() <= since) return "unmatched";
  return (await winningEditsAuthor(db, recorded)) === userId ? "tied" : "unmatched";
}

/** The places recorded under the viewer's names, split into those tied to them and a count of the rest. */
async function tiePlaces(
  db: MyTrophiesDb,
  userId: string,
  names: WikiosNames
): Promise<{ tied: TiedPlace[]; unmatched: number }> {
  const spellings = new Set(names.names.flatMap(nameSpellings));
  const entries = await db.lorewardEntry.findMany({
    where: {
      status: "approved",
      type: { in: CONTESTS },
      OR: [{ winnerUser: { in: [...spellings] } }, { runnerUpUser: { in: [...spellings] } }],
    },
    select: {
      type: true,
      date: true,
      dateStart: true,
      dateEnd: true,
      winnerUser: true,
      winnerPage: true,
      runnerUpUser: true,
      runnerUpPage: true,
    },
  });

  const tied: TiedPlace[] = [];
  let unmatched = 0;
  const holders = new Map<string, string | null>();
  for (const entry of entries) {
    const { type } = entry;
    if (!isContest(type)) continue;
    for (const place of PLACES) {
      const recorded = placeOf(entry, place);
      if (!recorded || !spellings.has(recorded.wikiUser)) continue;
      const tie = await tieOf(db, userId, recorded, names.since, holders);
      if (tie === "tied") tied.push({ type, place, date: entry.date });
      if (tie === "unmatched") unmatched++;
    }
  }
  return { tied, unmatched };
}

/** Wins, daily runner-ups and the current daily streak, counted from the tied places only. */
function countPlaces(tied: TiedPlace[]): Omit<Trophies, "cards"> {
  const wins = { daily: 0, weekly: 0, monthly: 0 };
  let runnerUps = 0;
  const winDays: string[] = [];
  for (const { type, place, date } of tied) {
    if (place === "runner-up") {
      if (type === "daily") runnerUps++;
      continue;
    }
    wins[type]++;
    if (type === "daily") winDays.push(date);
  }
  return { wins, runnerUps, streak: calculateStreaks(winDays).current };
}

/**
 * The viewer's trophies: under their verified link, the name's record (its stats row is theirs); otherwise counted
 * from the places tied to them, with how many places under their names could not be tied.
 */
export async function loadMyTrophies(db: MyTrophiesDb, userId: string): Promise<MyTrophies> {
  const link = await db.wikiAccountLink.findFirst({
    where: { userId, source: "ixwiki", verifiedAt: { not: null } },
    select: { username: true },
  });
  if (link) {
    const trophies = await loadTrophies(db, link.username, userId);
    return { wikiUsername: link.username, verified: true, unmatched: 0, ...trophies };
  }

  const names = await wikiosNames(db, userId);
  if (!names) return { wikiUsername: null, verified: false, unmatched: 0, ...NO_TROPHIES };
  const [{ tied, unmatched }, cards] = await Promise.all([
    tiePlaces(db, userId, names),
    ownedTrophyCards(db, userId),
  ]);
  return { wikiUsername: names.latest, verified: false, unmatched, ...countPlaces(tied), cards };
}

/**
 * The viewer's place in today's race: under their verified name, else the best entry under their WikiOS name whose
 * edits today are all theirs.
 */
export async function myRaceRank(
  db: Pick<PrismaClient, "wikiRevision">,
  race: TodayRace,
  mine: Pick<MyTrophies, "wikiUsername" | "verified">,
  userId: string
): Promise<number | null> {
  if (!mine.wikiUsername) return null;
  if (mine.verified) return todayRankOf(race, mine.wikiUsername);
  const spellings = nameSpellings(mine.wikiUsername);
  for (const entry of race.entries) {
    if (!spellings.includes(entry.user)) continue;
    const today = { wikiUser: entry.user, page: entry.page, date: race.date };
    if ((await winningEditsAuthor(db, { ...today, dateStart: null, dateEnd: null })) === userId) {
      return entry.rank;
    }
  }
  return null;
}
