/**
 * The viewer's own Lorewards. A place is theirs when the payout rule pays it to them (`resolveLorewardPlace`): a
 * plain name through their approved name claim on it (shown or hidden: these are the owner's own views), a `wikios>`
 * name through their WikiOS edits. A name they carry proves nothing on its own, so the shared stats row of a name
 * never counts for them.
 */
import type { PrismaClient } from "@prisma/client";
import { namesOfUser } from "~/lib/identity/wiki-names";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { importName } from "~/lib/wiki-os/services/import-label";
import {
  claimedLorewardUser,
  contestWindow,
  nameSpellings,
  placeOf,
  resolveLorewardPlace,
  scoredEditsAccount,
  type LorewardPlaceRef,
} from "./resolve-user";
import { calculateStreaks } from "./streaks";
import type { TodayRace, TodayRaceEntry } from "./today-race";
import { ownedTrophyCards, type Trophies } from "./trophy-summary";

type MyTrophiesDb = Pick<
  PrismaClient,
  "wikiNameClaim" | "wikiRevision" | "lorewardEntry" | "cardOwnership"
>;

export interface MyTrophies extends Trophies {
  /** The viewer's first-approved claimed name, else the label their latest WikiOS edit carries; null with neither. */
  wikiUsername: string | null;
  /** Whether `wikiUsername` is a name the viewer holds an approved claim on, so its public record is theirs. */
  verified: boolean;
  /** Every name the viewer holds an approved claim on (their own view, so hidden ones too), oldest approval first. */
  claimedNames: string[];
  /**
   * Classic-wiki places (plain names) under the viewer's WikiOS labels that no account has claimed: an approved claim
   * would give them the ones they made.
   */
  unmatched: number;
}

/** Who the viewer is on the wiki. */
export interface ViewerNames {
  /** Every ixwiki name they hold an approved claim on (shown or hidden), oldest approval first. */
  claimed: string[];
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

/** The viewer's approved ixwiki names and the labels of their ixwiki WikiOS edits. */
export async function viewerNames(
  db: Pick<PrismaClient, "wikiNameClaim" | "wikiRevision">,
  userId: string
): Promise<ViewerNames> {
  const [claimed, rows] = await Promise.all([
    namesOfUser(db, userId),
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
    claimed: claimed.map((c) => c.name),
    labels: labelled.map((l) => l.label),
    since: Math.min(Infinity, ...labelled.map((l) => l.first)),
  };
}

function recordedNames(names: ViewerNames): RecordedNames {
  const plain = [...names.claimed, ...names.labels].flatMap(nameSpellings);
  return { plain: new Set(plain), imported: new Set(names.labels.map(importName)) };
}

/**
 * Whether a place recorded under one of the viewer's names is theirs. "unmatched": a plain name no account has
 * claimed (it may be a classic-wiki win of theirs). "other": the rule pays it to someone else, or to no one.
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
    holders.set(recorded.wikiUser, await claimedLorewardUser(db, recorded.wikiUser));
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
function countPlaces(tied: TiedPlace[]): Omit<Trophies, "cards" | "holderHandle"> {
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
 * The viewer's trophies: counted from the places tied to them, with the classic-wiki places a claim could give them.
 * The trophy cards their account owns always show; with no name at all no place is read.
 */
export async function loadMyTrophies(
  db: MyTrophiesDb,
  userId: string,
  names: ViewerNames
): Promise<MyTrophies> {
  const wikiUsername = names.claimed[0] ?? names.labels[0] ?? null;
  const [{ tied, unmatched }, cards] = await Promise.all([
    wikiUsername ? tiePlaces(db, userId, names) : { tied: [], unmatched: 0 },
    ownedTrophyCards(db, userId),
  ]);
  return {
    wikiUsername,
    verified: names.claimed.length > 0,
    claimedNames: names.claimed,
    unmatched,
    ...countPlaces(tied),
    cards,
    // The viewer's own trophies open in Mine, through no holder.
    holderHandle: null,
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
 * The viewer's entry in today's race: the best entry under one of their names whose scored edits the dividend's
 * rule credits to them (`scoredEditsAccount`).
 */
export async function myRaceEntry(
  db: Pick<PrismaClient, "wikiNameClaim" | "wikiRevision">,
  race: TodayRace,
  names: ViewerNames,
  userId: string
): Promise<TodayRaceEntry | null> {
  const authors = new Set([...names.claimed.flatMap(nameSpellings), ...names.labels]);
  for (const entry of race.entries) {
    if (!authors.has(entry.user)) continue;
    const authorIds = await raceEntryAuthorIds(db, race.date, entry);
    if ((await scoredEditsAccount(db, entry.user, authorIds)) === userId) return entry;
  }
  return null;
}
