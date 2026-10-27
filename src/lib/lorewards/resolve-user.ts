import { type PrismaClient } from "@prisma/client";
import { IXWIKI, ownerOfName } from "~/lib/identity/wiki-names";
import type { LorewardPlace } from "~/lib/vault/vault-bonus";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import { importName, labelOfImportName } from "~/lib/wiki-os/services/import-label";

/**
 * Who a Loreward place pays: "Edits made in WikiOS earn for your account without a claim; wins on the classic wiki
 * need an approved name claim". The bot scores MediaWiki, where a WikiOS edit by an author with no shown claimed
 * name arrives as `wikios>Label` (`importName`; no MediaWiki account can hold a `>`). Every other recorded name is a
 * MediaWiki account, or a WikiOS user mirrored under their primary shown claim, so only that name's approved claim
 * can be paid for it.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/**
 * The bot's contest day is a US Eastern day (UTC-4 or UTC-5), so a window runs to 06:00Z after its last day: a
 * superset of the contest. A wider window only adds edits, so it can only pay no one, never the wrong account.
 */
const EASTERN_DAY_END_MS = DAY_MS + 6 * 3_600_000;

/** One recorded Loreward place: the name it is recorded under, the winning page, the contest and its days. */
export interface LorewardPlaceRef {
  wikiUser: string;
  page: string | null;
  type: string;
  /** A daily's day; a weekly's or monthly's key, which is only a day for some of them. */
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
}

interface RecordedEntry {
  type: string;
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
    type: entry.type,
    date: entry.date,
    dateStart: entry.dateStart,
    dateEnd: entry.dateEnd,
  };
}

/**
 * The one form of a recorded name: a `wikios>` name as the mirror writes it, any other as MediaWiki normalizes a
 * username (only its first letter is case-insensitive).
 */
export function canonicalWikiName(name: string): string {
  const label = labelOfImportName(name);
  return label === null ? normalizeWikiUsername(name) : importName(label);
}

/** The spellings a plain wiki name can be recorded under: as given, normalized with spaces, and with underscores. */
export function nameSpellings(wikiUser: string): string[] {
  const spaced = normalizeWikiUsername(wikiUser);
  return [...new Set([wikiUser, spaced, spaced.replace(/ /g, "_")])];
}

/**
 * A superset of the contest's days as a `createdAt` range: from 00:00Z on its first day (its recorded range, else a
 * daily's date) to 06:00Z after its last. Null when the dates are not days, or for a weekly or monthly with no range.
 */
export function contestWindow(
  place: Pick<LorewardPlaceRef, "type" | "date" | "dateStart" | "dateEnd">
): { gte: Date; lt: Date } | null {
  const range = place.dateStart && place.dateEnd ? [place.dateStart, place.dateEnd] : null;
  const [from, to] = range ?? (place.type === "daily" ? [place.date, place.date] : []);
  if (!from || !to || !DAY.test(from) || !DAY.test(to)) return null;
  const gte = new Date(`${from}T00:00:00.000Z`);
  const lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + EASTERN_DAY_END_MS);
  return Number.isNaN(gte.getTime()) || Number.isNaN(lt.getTime()) ? null : { gte, lt };
}

/**
 * The account holding the ixwiki name's APPROVED claim, or null (a pending, rejected or revoked claim pays no one). Any
 * visibility: a payout is not a display, so a claim its owner keeps hidden still pays them. The match is exact on the
 * normalized name, as the resolver stores it: MediaWiki usernames are case-sensitive after the first letter.
 */
export function claimedLorewardUser(
  db: Pick<PrismaClient, "wikiNameClaim">,
  wikiUser: string
): Promise<string | null> {
  return ownerOfName(db, IXWIKI, wikiUser);
}

/**
 * The WikiOS account behind a `wikios>` place: the ixwiki revisions carrying the label, on the winning page (never a
 * redirect a page move left at its title), inside the contest's window. Only when there is at least one and every
 * one has the same non-null `authorId`; null when there is none, or when two accounts (or a MediaWiki editor of that
 * name) made them.
 */
async function labelEditsAuthor(
  db: Pick<PrismaClient, "wikiRevision">,
  place: LorewardPlaceRef,
  label: string
): Promise<string | null> {
  const window = contestWindow(place);
  const page = place.page ? canonicalizeTitle(place.page) : null;
  if (!window || !page) return null;
  const [only, ...others] = await db.wikiRevision.groupBy({
    by: ["authorId"],
    where: {
      source: IXWIKI,
      author: label,
      createdAt: window,
      article: { source: IXWIKI, title: page.title, redirectTargetSlug: null },
    },
  });
  return only && others.length === 0 ? only.authorId : null;
}

/** The account a place pays: for a `wikios>` name, the WikiOS account behind its edits; else the name's approved claim. */
export async function resolveLorewardPlace(
  db: Pick<PrismaClient, "wikiNameClaim" | "wikiRevision">,
  place: LorewardPlaceRef
): Promise<string | null> {
  const label = labelOfImportName(place.wikiUser);
  return label === null
    ? claimedLorewardUser(db, place.wikiUser)
    : labelEditsAuthor(db, place, label);
}

/**
 * The account a set of scored revisions (one name's edits to one page on one day) is credited to, from the
 * revisions' own `authorId`s: one WikiOS account on all of them, that account (even when someone else claims the
 * name); none on any (all mirrored from MediaWiki), the holder of the name's approved claim; mixed, no one.
 */
export async function scoredEditsAccount(
  db: Pick<PrismaClient, "wikiNameClaim">,
  wikiUser: string,
  authorIds: ReadonlyArray<string | null>
): Promise<string | null> {
  const [only, ...others] = [...new Set(authorIds)];
  if (only === undefined || others.length > 0) return null;
  return only ?? claimedLorewardUser(db, wikiUser);
}
