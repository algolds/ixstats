/**
 * The viewer's own Lorewards. A place is theirs when the payout rule pays it to them (`resolveLorewardPlace`): a
 * plain name through their exact verified link, a `wikios>` name through their WikiOS edits. A name they carry
 * proves nothing on its own, so the shared stats row of a name never counts for them.
 */
import type { PrismaClient } from "@prisma/client";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { importName } from "~/lib/wiki-os/services/import-label";
import {
  contestWindow,
  nameSpellings,
  placeOf,
  resolveLorewardPlace,
  scoredEditsAccount,
  verifiedLorewardUser,
  type LorewardPlaceRef,
} from "./resolve-user";
import { calculateStreaks } from "./streaks";
import type { TodayRace, TodayRaceEntry } from "./today-race";
import { NO_TROPHIES, ownedTrophyCards, type Trophies } from "./trophy-summary";

type MyTrophiesDb = Pick<
  PrismaClient,
  "wikiAccountLink" | "wikiRevision" | "lorewardEntry" | "cardOwnership"
>;

export interface MyTrophies extends Trophies {
  /** The viewer's verified ixwiki name, else the label their latest WikiOS edit carries; null with neither. */
  wikiUsername: string | null;
  /** Whether `wikiUsername` is the viewer's verified link, so the name's public record (stats, history) is theirs. */
  verified: boolean;
  /**
   * Classic-wiki places (plain names) under the viewer's WikiOS labels that no account has verified: a verified link
   * would claim the ones they made.
   */
  unmatched: number;
}

/** Who the viewer is on the wiki. */
export interface ViewerNames {
  /** Their verified ixwiki username, or null. */
  link: string | null;
  /** The labels their ixwiki WikiOS edits carry, latest first. */
  labels: string[];
  /** When their first ixwiki WikiOS edit was made (ms); Infinity with none. */
  since: number;
}

/** The names the viewer's places can be recorded under: plain (MediaWiki) spellings, and `wikios>` names. */
interface RecordedNames {
  plain: Set<string>;
  imported: Set<string>;
}

const CONTESTS: LorewardType[] = ["daily", "weekly", "monthly"];
const PLACES: LorewardPlace[] = ["winner", "runner-up"];
const DAY_MS = 86_400_000;

const isContest = (type: string): type is LorewardType => (CONTESTS as string[]).includes(type);

interface TiedPlace {
  type: LorewardType;
  place: LorewardPlace;
  date: string;
}

/** The viewer's verified ixwiki link and the labels of their ixwiki WikiOS edits. */
export async function viewerNames(
  db: Pick<PrismaClient, "wikiAccountLink" | "wikiRevision">,
  userId: string
): Promise<ViewerNames> {
  const [link, rows] = await Promise.all([
    db.wikiAccountLink.findFirst({
      where: { userId, source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    }),
    db.wikiRevision.groupBy({
      by: ["author"],
      where: { authorId: userId, source: "ixwiki", author: { not: null } },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
  ]);
  const labelled = rows.flatMap((row) =>
    row.author
      ? [
          {
            label: row.author,
            first: row._min?.createdAt?.getTime() ?? Infinity,
            last: row._max?.createdAt?.getTime() ?? 0,
          },
        ]
      : []
  );
  labelled.sort((a, b) => b.last - a.last);
  return {
    link: link?.username ?? null,
    labels: labelled.map((l) => l.label),
    since: Math.min(Infinity, ...labelled.map((l) => l.first)),
  };
}

function recordedNames(names: ViewerNames): RecordedNames {
  const plain = [...(names.link ? [names.link] : []), ...names.labels].flatMap(nameSpellings);
  return { plain: new Set(plain), imported: new Set(names.labels.map(importName)) };
}

/**
 * Whether a place recorded under one of the viewer's names is theirs. "unmatched": a plain name no account has
 * verified (it may be a classic-wiki win of theirs). "other": the rule pays it to someone else, or to no one.
 */
async function tieOf(
  db: MyTrophiesDb,
  userId: string,
  recorded: LorewardPlaceRef,
  names: ViewerNames & RecordedNames,
  holders: Map<string, string | null>
): Promise<"tied" | "unmatched" | "other"> {
  if (names.imported.has(recorded.wikiUser)) {
    // A contest that ended before the viewer's first WikiOS edit holds none of their edits.
    const window = contestWindow(recorded);
    if (!window || window.lt.getTime() <= names.since) return "other";
    return (await resolveLorewardPlace(db, recorded)) === userId ? "tied" : "other";
  }
  if (!holders.has(recorded.wikiUser)) {
    holders.set(recorded.wikiUser, await verifiedLorewardUser(db, recorded.wikiUser));
  }
  const holder = holders.get(recorded.wikiUser);
  if (holder === userId) return "tied";
  return holder ? "other" : "unmatched";
}

/** The places recorded under the viewer's names, split into those tied to them and a count of the unmatched. */
async function tiePlaces(
  db: MyTrophiesDb,
  userId: string,
  names: ViewerNames
): Promise<{ tied: TiedPlace[]; unmatched: number }> {
  const recorded = { ...names, ...recordedNames(names) };
  const entries = await db.lorewardEntry.findMany({
    where: {
      status: "approved",
      type: { in: CONTESTS },
      OR: [
        { winnerUser: { in: [...recorded.plain, ...recorded.imported] } },
        { runnerUpUser: { in: [...recorded.plain, ...recorded.imported] } },
      ],
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
      const ref = placeOf(entry, place);
      if (!ref || !(recorded.plain.has(ref.wikiUser) || recorded.imported.has(ref.wikiUser)))
        continue;
      const tie = await tieOf(db, userId, ref, recorded, holders);
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

/** The viewer's trophies: counted from the places tied to them, with the classic-wiki places a link could claim. */
export async function loadMyTrophies(
  db: MyTrophiesDb,
  userId: string,
  names: ViewerNames
): Promise<MyTrophies> {
  const wikiUsername = names.link ?? names.labels[0] ?? null;
  if (!wikiUsername) return { wikiUsername: null, verified: false, unmatched: 0, ...NO_TROPHIES };
  const [{ tied, unmatched }, cards] = await Promise.all([
    tiePlaces(db, userId, names),
    ownedTrophyCards(db, userId),
  ]);
  return {
    wikiUsername,
    verified: names.link !== null,
    unmatched,
    ...countPlaces(tied),
    cards,
  };
}

/** The `authorId`s of the revisions today's race scored for an entry: its author's edits to its page on its day. */
async function raceEntryAuthorIds(
  db: Pick<PrismaClient, "wikiRevision">,
  date: string,
  entry: TodayRaceEntry
): Promise<Array<string | null>> {
  const page = canonicalizeTitle(entry.page);
  if (!page) return [];
  const gte = new Date(`${date}T00:00:00.000Z`);
  const groups = await db.wikiRevision.groupBy({
    by: ["authorId"],
    where: {
      source: "ixwiki",
      author: entry.user,
      createdAt: { gte, lt: new Date(gte.getTime() + DAY_MS) },
      article: { namespace: 0, title: page.title },
    },
  });
  return groups.map((group) => group.authorId);
}

/**
 * The viewer's place in today's race: the best entry under one of their names whose scored edits the dividend's
 * rule credits to them (`scoredEditsAccount`).
 */
export async function myRaceRank(
  db: Pick<PrismaClient, "wikiAccountLink" | "wikiRevision">,
  race: TodayRace,
  names: ViewerNames,
  userId: string
): Promise<number | null> {
  const authors = new Set([...(names.link ? nameSpellings(names.link) : []), ...names.labels]);
  for (const entry of race.entries) {
    if (!authors.has(entry.user)) continue;
    const authorIds = await raceEntryAuthorIds(db, race.date, entry);
    if ((await scoredEditsAccount(db, entry.user, authorIds)) === userId) return entry.rank;
  }
  return null;
}
