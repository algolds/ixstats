import { type PrismaClient } from "@prisma/client";
import type { LorewardPlace } from "~/lib/vault/vault-bonus";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

/**
 * Who a Loreward place pays: "WikiOS edits earn without a link; MediaWiki edits need a verified link". A wiki name
 * alone proves nothing (a WikiOS label can be a country name the player chose, and `wiki_revisions` mirrors only
 * part of MediaWiki's history), so a place is resolved from its own winning edits, never from the name's other edits.
 */

const SOURCE = "ixwiki";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** One recorded Loreward place: the name it is recorded under, the winning page and the contest's UTC days. */
export interface LorewardPlaceRef {
  wikiUser: string;
  page: string | null;
  /** A daily's day; a weekly's or monthly's key, which is only a day for some of them. */
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
}

interface RecordedEntry {
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
}

/** An entry's place, or null when nobody is recorded there. */
export function placeOf(entry: RecordedEntry, place: LorewardPlace): LorewardPlaceRef | null {
  const wikiUser = place === "winner" ? entry.winnerUser : entry.runnerUpUser;
  if (!wikiUser) return null;
  return {
    wikiUser,
    page: place === "winner" ? entry.winnerPage : entry.runnerUpPage,
    date: entry.date,
    dateStart: entry.dateStart,
    dateEnd: entry.dateEnd,
  };
}

/** The spellings a wiki name's revisions can carry: as recorded, normalized with spaces, and with underscores. */
export function nameSpellings(wikiUser: string): string[] {
  const spaced = normalizeWikiUsername(wikiUser);
  return [...new Set([wikiUser, spaced, spaced.replace(/ /g, "_")])];
}

/** The contest's UTC days as a `createdAt` range: its recorded range, else its date; null when they are not days. */
export function contestWindow(
  place: Pick<LorewardPlaceRef, "date" | "dateStart" | "dateEnd">
): { gte: Date; lt: Date } | null {
  const [from, to] =
    place.dateStart && place.dateEnd ? [place.dateStart, place.dateEnd] : [place.date, place.date];
  if (!DAY.test(from) || !DAY.test(to)) return null;
  const gte = new Date(`${from}T00:00:00.000Z`);
  const lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS);
  return Number.isNaN(gte.getTime()) || Number.isNaN(lt.getTime()) ? null : { gte, lt };
}

/**
 * The account that verified the ixwiki name, or null. The match is exact on the normalized username, as the inbound
 * sync's `verifiedWikiUserId` matches it: MediaWiki usernames are case-sensitive after the first letter.
 */
export async function verifiedLorewardUser(
  db: Pick<PrismaClient, "wikiAccountLink">,
  wikiUser: string
): Promise<string | null> {
  const link = await db.wikiAccountLink.findFirst({
    where: { source: SOURCE, username: normalizeWikiUsername(wikiUser), verifiedAt: { not: null } },
    select: { userId: true },
  });
  return link?.userId ?? null;
}

/**
 * The WikiOS account behind a place's winning edits: the ixwiki revisions under the name's spellings, on the winning
 * page, inside the contest's days. Only when there is at least one and every one has the same non-null `authorId`;
 * null when they are not mirrored, when one is an unverified MediaWiki edit, or when two accounts made them.
 */
export async function winningEditsAuthor(
  db: Pick<PrismaClient, "wikiRevision">,
  place: LorewardPlaceRef
): Promise<string | null> {
  const window = contestWindow(place);
  const page = place.page ? canonicalizeTitle(place.page) : null;
  if (!window || !page) return null;
  const [only, ...others] = await db.wikiRevision.groupBy({
    by: ["authorId"],
    where: {
      source: SOURCE,
      author: { in: nameSpellings(place.wikiUser) },
      createdAt: window,
      article: { source: SOURCE, title: page.title },
    },
  });
  return only && others.length === 0 ? only.authorId : null;
}

/** The account a place pays: the name's verified link, else the WikiOS account behind its winning edits. */
export async function resolveLorewardPlace(
  db: Pick<PrismaClient, "wikiAccountLink" | "wikiRevision">,
  place: LorewardPlaceRef
): Promise<string | null> {
  return (await verifiedLorewardUser(db, place.wikiUser)) ?? winningEditsAuthor(db, place);
}
