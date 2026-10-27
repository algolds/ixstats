/**
 * Syncs Loreward results into Prisma from the IxWiki:OOL pages: the full history daily (`fullSync`) and the current year
 * hourly (`backfillCurrentYearFromOOL`). The Discord bot's webhook (`/api/bot/lorewards/sync`) is the primary source;
 * these fill its gaps. Every sync ends by settling what it wrote (`settleLorewardPlaces`).
 */

import type { LorewardEntry, Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { parseOOLPage, OOL_YEARS, parseActiveMembers, parseAnnualWinners } from "./ool-parser";
import { contestHolder, groupByContest } from "./contest-identity";
import { weeklyKeyOfFirstDay } from "./contest-week";
import { settleLorewardPlaces, type SettleResult } from "./settle";
import { calculateStreaks } from "./streaks";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { labelOfImportName } from "~/lib/wiki-os/services/import-label";
import { isWikiosV1Enabled } from "~/lib/wiki-os/v1-switch";

/**
 * Before the WikiOS v1 cutover (`WIKIOS_V1_ENABLED` off) classic MediaWiki is the wiki of record and
 * WikiOS's copy of a page may lag it, so a page WikiOS lacks is read from MediaWiki's api.php, as before v1.
 */
async function fetchOOLPageFromMediaWiki(pageTitle: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: pageTitle,
      format: "json",
      formatversion: "2",
    });
    const res = await fetch(`${getMediaWikiApiUrl("ixwiki")}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: { missing?: boolean; revisions?: { slots?: { main?: { content?: string } } }[] }[];
      };
    };
    const page = data.query?.pages?.[0];
    return page && !page.missing ? (page.revisions?.[0]?.slots?.main?.content ?? null) : null;
  } catch (err) {
    console.warn(`[Lorewards] MediaWiki read failed for ${pageTitle}:`, err);
    return null;
  }
}

/**
 * The wikitext of an OOL page: a WikiOS page, read from Postgres (after the cutover MediaWiki is never asked;
 * before it, a page WikiOS lacks is read from MediaWiki). Null when neither has the page, or the reads fail.
 */
async function fetchOOLPageWikitext(yearOrKey: number | "main"): Promise<string | null> {
  const pageTitle = yearOrKey === "main" ? "IxWiki:OOL" : `IxWiki:OOL/${yearOrKey}`;
  const shortTitle = yearOrKey === "main" ? "OOL" : `OOL/${yearOrKey}`;

  try {
    const article = await db.wikiArticle.findFirst({
      where: {
        source: "ixwiki",
        OR: [
          { title: pageTitle },
          { title: shortTitle },
          { slug: pageTitle.toLowerCase().replace(/[:/]/g, "_") },
          { slug: shortTitle.toLowerCase().replace(/[:/]/g, "_") },
        ],
      },
      select: { wikitext: true },
    });
    if (article?.wikitext) return article.wikitext;
  } catch (err) {
    console.warn(`[Lorewards] DB lookup failed for ${pageTitle}:`, err);
  }

  return isWikiosV1Enabled() ? null : fetchOOLPageFromMediaWiki(pageTitle);
}

/**
 * Writes the place columns of the entries `where` selects, unless an admin override wrote them (`overriddenAt`): no
 * sync writes an override's places again. The mark is checked in the write itself, never read beforehand: an
 * override that commits while a sync runs holds its rows' locks until then, so this update waits for it and skips them.
 */
const writePlaces = (
  where: Prisma.LorewardEntryWhereInput,
  places: Prisma.LorewardEntryUpdateManyMutationInput
) => db.lorewardEntry.updateMany({ where: { ...where, overriddenAt: null }, data: places });

/**
 * Backfill historical entries from ALL OOL wiki pages (2017-2026), storing only the ones whose key holds none
 * (`storeHistoryEntry`).
 */
export async function syncFromOOLPages(): Promise<number> {
  let totalSynced = 0;

  for (const year of OOL_YEARS) {
    console.log(`[Lorewards] Syncing OOL/${year}...`);

    try {
      const wikitext = await fetchOOLPageWikitext(year);
      if (!wikitext) {
        console.warn(`[Lorewards] Could not fetch OOL/${year}`);
        continue;
      }

      const parsed = parseOOLPage(wikitext, year);
      let yearSynced = 0;

      for (const entry of parsed) {
        // Skip entries with no winner
        if (entry.winnerUser && (await storeHistoryEntry(entry, year))) yearSynced++;
      }

      console.log(
        `[Lorewards] Synced ${yearSynced} entries from OOL/${year} (${parsed.length} parsed)`
      );
      totalSynced += yearSynced;
    } catch (err) {
      console.error(`[Lorewards] Error syncing OOL/${year}:`, err);
    }
  }

  return totalSynced;
}

/** `entries` with the other entries of their contests: a weekly's or monthly's twin under the other key. */
async function withTwins(entries: LorewardEntry[]): Promise<LorewardEntry[]> {
  const ranged = entries.filter((e) => e.type === "weekly" || e.type === "monthly");
  if (ranged.length === 0) return entries;
  const twins = await db.lorewardEntry.findMany({
    where: {
      status: "approved",
      OR: ranged.flatMap((e) => {
        const day = e.dateStart ?? e.date;
        return [
          { type: e.type, date: day },
          { type: e.type, dateStart: day },
        ];
      }),
    },
    orderBy: { date: "asc" },
  });
  const known = new Set(entries.map((e) => e.id));
  return [...entries, ...twins.filter((twin) => !known.has(twin.id))];
}

/**
 * A user's wins, daily runner-ups, streaks and bytes, counting each contest once (`groupByContest`): through the
 * entry `contestHolder` chooses, and for neither name while the contest's entries disagree on the place.
 */
function countUserPlaces(entries: LorewardEntry[], username: string) {
  const stats = { dailyWins: 0, dailyRunnerUps: 0, weeklyWins: 0, monthlyWins: 0 };
  let totalBytes = 0;
  let lastWinDate: string | null = null;
  const winDates: string[] = [];

  for (const contest of groupByContest(entries)) {
    const won = contestHolder(contest, "winner");
    if (!("conflict" in won) && won.entry.winnerUser === username) {
      const e = won.entry;
      if (e.type === "daily") {
        stats.dailyWins++;
        winDates.push(e.date);
      }
      if (e.type === "weekly") stats.weeklyWins++;
      if (e.type === "monthly") stats.monthlyWins++;
      totalBytes += e.winnerBytes ?? 0;
      lastWinDate = e.date;
    }
    const ran = contestHolder(contest, "runner-up");
    if (!("conflict" in ran) && ran.entry.runnerUpUser === username && ran.entry.type === "daily") {
      stats.dailyRunnerUps++;
    }
  }

  const { current, longest } = calculateStreaks(winDates);
  return { ...stats, currentStreak: current, longestStreak: longest, totalBytes, lastWinDate };
}

/**
 * Recompute aggregate stats for a specific user, counting each contest once (`countUserPlaces`).
 * Does NOT overwrite totalScore — that comes from the canonical main OOL page medal scores.
 */
export async function recomputeUserStats(username: string): Promise<void> {
  const entries = await db.lorewardEntry.findMany({
    where: {
      OR: [{ winnerUser: username }, { runnerUpUser: username }],
      status: "approved",
    },
    orderBy: { date: "asc" },
  });
  const computed = countUserPlaces(await withTwins(entries), username);

  // totalScore is left untouched on update: it comes from the main OOL page medal scores
  await db.lorewardUserStats.upsert({
    where: { username },
    create: { username, ...computed, totalScore: 0 },
    update: computed,
  });
}

/**
 * Recompute stats for all users with entries.
 */
async function recomputeAllStats(): Promise<number> {
  const winners = await db.lorewardEntry.findMany({
    where: { status: "approved" },
    select: { winnerUser: true, runnerUpUser: true },
  });

  const usernames = new Set<string>();
  for (const e of winners) {
    if (e.winnerUser) usernames.add(e.winnerUser);
    if (e.runnerUpUser) usernames.add(e.runnerUpUser);
  }

  for (const username of usernames) {
    await recomputeUserStats(username);
  }

  return usernames.size;
}

/**
 * Sync canonical medal scores and membership data from the main IxWiki:OOL page.
 * This is the authoritative source for user rankings.
 */
export async function syncFromMainOOLPage(): Promise<number> {
  const wikitext = await fetchOOLPageWikitext("main");
  if (!wikitext) {
    console.warn("[Lorewards] Could not fetch main OOL page");
    return 0;
  }

  const members = parseActiveMembers(wikitext);
  console.log(`[Lorewards] Found ${members.length} active members on main OOL page`);

  for (const member of members) {
    await db.lorewardUserStats.upsert({
      where: { username: member.username },
      create: {
        username: member.username,
        totalScore: member.medalScore,
      },
      update: {
        totalScore: member.medalScore,
      },
    });
  }

  // Also parse annual winners
  const annualWinners = parseAnnualWinners(wikitext);
  for (const w of annualWinners) {
    if (!w.username) continue;
    // Store annual wins as monthly type with special date
    await db.lorewardEntry.upsert({
      where: { date_type: { date: `${w.year}-12-31`, type: "annual" } },
      create: {
        date: `${w.year}-12-31`,
        type: "annual",
        winnerUser: w.username,
        winnerPage: null,
        status: "approved",
        year: w.year,
      },
      update: {
        winnerUser: w.username,
      },
    });
  }

  return members.length;
}

/**
 * Full sync (daily cron `lorewards-full-sync`): main OOL page → yearly OOL pages → recompute stats, then every approved
 * place settled.
 */
export async function fullSync(): Promise<{
  members: number;
  oolEntries: number;
  users: number;
  settled: SettleResult;
}> {
  const members = await syncFromMainOOLPage();
  const oolEntries = await syncFromOOLPages();
  const users = await recomputeAllStats();
  // Re-apply medal scores from main page (they're canonical, overwrite computed values)
  await syncFromMainOOLPage();
  const settled = await settleLorewardPlaces();
  return { members, oolEntries, users, settled };
}

type ParsedEntry = ReturnType<typeof parseOOLPage>[number];

/** The four place columns the OOL page writes. */
interface PlaceColumns {
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
}

const STORED_PLACES = {
  id: true,
  date: true,
  type: true,
  dateStart: true,
  winnerUser: true,
  winnerPage: true,
  runnerUpUser: true,
  runnerUpPage: true,
  overriddenAt: true,
} as const;

const isImportName = (name: string | null | undefined): name is string =>
  !!name && labelOfImportName(name) !== null;

/**
 * The OOL page's name and page for one place, unless they would turn a stored `wikios>` name into a plain one: then
 * the stored name, with its stored page (or, when it stored none, the OOL page's if its line names the same holder). A `wikios>` name pays only the WikiOS account behind its edits to its page, a plain
 * one whoever verifies that MediaWiki account.
 */
function oolPlace(
  stored: { name: string | null; page: string | null } | undefined,
  fromPage: { name: string | null; page: string | null }
): { name: string | null; page: string | null } {
  if (!stored || !isImportName(stored.name) || isImportName(fromPage.name)) return fromPage;
  // The kept name keeps its page. One stored with none takes the page's only when the page's line names the same
  // holder (the label itself): another holder's page is their article, not one the label's edits won.
  const sameHolder = labelOfImportName(stored.name) === fromPage.name;
  return { name: stored.name, page: stored.page ?? (sameHolder ? fromPage.page : null) };
}

/**
 * The place columns the OOL page writes over `stored` (none when the entry is new), under the `wikios>` guard. An
 * entry an admin override wrote (`overriddenAt`) keeps its own, and `writePlaces` writes nothing over it.
 */
function oolPlaces(
  stored: (PlaceColumns & { overriddenAt: Date | null }) | undefined,
  entry: PlaceColumns
): PlaceColumns {
  if (stored?.overriddenAt) {
    const { winnerUser, winnerPage, runnerUpUser, runnerUpPage } = stored;
    return { winnerUser, winnerPage, runnerUpUser, runnerUpPage };
  }
  const winner = oolPlace(stored && { name: stored.winnerUser, page: stored.winnerPage }, {
    name: entry.winnerUser,
    page: entry.winnerPage,
  });
  const runnerUp = oolPlace(stored && { name: stored.runnerUpUser, page: stored.runnerUpPage }, {
    name: entry.runnerUpUser,
    page: entry.runnerUpPage,
  });
  return {
    winnerUser: winner.name,
    winnerPage: winner.page,
    runnerUpUser: runnerUp.name,
    runnerUpPage: runnerUp.page,
  };
}

/** Where an OOL entry is stored: its key (`date`) and, for a weekly, its real first and last days. */
interface StoredKey {
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
}

/** A parsed entry with where it is stored. */
interface KeyedEntry {
  entry: ParsedEntry;
  key: StoredKey;
}

/**
 * A weekly's ISO week key and range (`weeklyKeyOfFirstDay`), anything else its own date. Null for a weekly whose date
 * is not a day: it is skipped.
 */
function storedKeyOf(entry: ParsedEntry): StoredKey | null {
  if (entry.type === "weekly") return weeklyKeyOfFirstDay(entry.date);
  return { date: entry.date, dateStart: null, dateEnd: null };
}

/**
 * Whether `stored`, the row at a weekly's ISO key, is another week (another first day, e.g. the bot's Monday-start W13
 * for the page's Sunday-start week of 22 March). Logged: nothing of the page's week is written over it.
 */
function isAnotherWeek(entry: ParsedEntry, key: StoredKey, stored: { dateStart: string | null }) {
  if (entry.type !== "weekly" || stored.dateStart === key.dateStart) return false;
  console.warn(
    `[Lorewards] OOL week ${entry.date} is stored as another week (${key.date}): not written`
  );
  return true;
}

/**
 * One history entry of an OOL page, stored only when its key holds none: written over its monthly's twin
 * (`writeStateTwin`), else created under its key (a weekly under its ISO week, with its range). Returns whether it
 * stored it.
 */
async function storeHistoryEntry(entry: ParsedEntry, year: number): Promise<boolean> {
  const key = storedKeyOf(entry);
  if (!key) return false;
  const existing = await db.lorewardEntry.findUnique({
    where: { date_type: { date: key.date, type: entry.type } },
    select: { dateStart: true },
  });
  if (existing) {
    // Stored already; another week on the key is logged, and either way nothing is written
    isAnotherWeek(entry, key, existing);
    return false;
  }
  if (await writeStateTwin(entry)) return true;

  await db.lorewardEntry.create({
    data: {
      ...key,
      type: entry.type,
      winnerUser: entry.winnerUser,
      winnerPage: entry.winnerPage,
      runnerUpUser: entry.runnerUpUser,
      runnerUpPage: entry.runnerUpPage,
      status: "approved",
      month: entry.month,
      year: entry.year ?? year,
    },
  });
  return true;
}

/**
 * The stored entries of the keyed entries (`date|type`, a weekly by its ISO week), and the monthlies the bot stores
 * under their own key (`2026-10`) whose first day (`dateStart`) is a parsed date: the same contest.
 */
async function storedFor(keyed: KeyedEntry[]) {
  const dates = [...new Set(keyed.map(({ key }) => key.date))];
  const rows = await db.lorewardEntry.findMany({
    where: {
      OR: [{ date: { in: dates } }, { type: "monthly", dateStart: { in: dates } }],
    },
    select: STORED_PLACES,
  });
  const twins = rows.filter(
    (row) => row.type === "monthly" && row.dateStart !== null && row.dateStart !== row.date
  );
  return {
    own: new Map(rows.map((row) => [`${row.date}|${row.type}`, row])),
    twins: new Map(twins.map((row) => [`${row.dateStart}|${row.type}`, row])),
  };
}

/**
 * The bot-keyed entry of a monthly the OOL page keys by its first day, written with the page's places (under the
 * guard) instead of a second entry. Returns whether there was one; never for a daily or a weekly (a weekly's key is its
 * ISO week, `storedKeyOf`).
 */
async function writeStateTwin(entry: ParsedEntry): Promise<boolean> {
  if (entry.type !== "monthly") return false;
  const twin = await db.lorewardEntry.findFirst({
    where: { type: entry.type, dateStart: entry.date },
    select: STORED_PLACES,
  });
  if (!twin) return false;
  await writePlaces({ id: twin.id }, oolPlaces(twin, entry));
  return true;
}

/**
 * Write one current-year entry of the OOL page: over the entry of its key, else over the bot-keyed entry of the same
 * monthly, else as a new entry (a weekly with its range). Returns the entry's id and the names it stores, or null when
 * the row at a weekly's key is another week (`isAnotherWeek`): nothing is written.
 */
async function writeOOLEntry(
  { entry, key }: KeyedEntry,
  stored: Awaited<ReturnType<typeof storedFor>>,
  year: number
): Promise<{ id: string; names: Array<string | null> } | null> {
  const target =
    stored.own.get(`${key.date}|${entry.type}`) ?? stored.twins.get(`${entry.date}|${entry.type}`);
  if (target && isAnotherWeek(entry, key, target)) return null;
  const places = oolPlaces(target, entry);
  // A contest it does not hold yet: created with the page's places (an upsert, should a writer create it meanwhile)
  const row =
    target ??
    (await db.lorewardEntry.upsert({
      where: { date_type: { date: key.date, type: entry.type } },
      create: {
        ...key,
        type: entry.type,
        ...places,
        status: "approved",
        month: entry.month,
        year: entry.year ?? year,
      },
      update: {},
      select: { id: true, dateStart: true },
    }));
  if (!target && isAnotherWeek(entry, key, row)) return null;
  // Updates and corrections made on the wiki, over the stored entry
  await writePlaces({ id: row.id }, places);
  return { id: row.id, names: [places.winnerUser, places.runnerUpUser] };
}

/**
 * The OOL gap-filler (hourly cron `lorewards-ool-backfill`): the main OOL page, then the current UTC year's page, written
 * over stored entries under the override and `wikios>` guards; the touched users' stats recomputed; then the entries it
 * wrote settled. Replaces `syncCurrentWinners`.
 */
export async function backfillCurrentYearFromOOL(): Promise<{
  entries: number;
  settled: SettleResult;
}> {
  await syncFromMainOOLPage();
  const year = new Date().getUTCFullYear();
  const wikitext = await fetchOOLPageWikitext(year);
  if (!wikitext) console.warn(`[Lorewards] Could not fetch OOL/${year}`);
  const keyed = (wikitext ? parseOOLPage(wikitext, year) : []).flatMap((entry) => {
    const key = entry.winnerUser ? storedKeyOf(entry) : null;
    return key ? [{ entry, key }] : [];
  });
  const stored = await storedFor(keyed);

  const written: string[] = [];
  const names = new Set<string>();
  for (const entry of keyed) {
    const wrote = await writeOOLEntry(entry, stored, year);
    if (!wrote) continue;
    written.push(wrote.id);
    for (const name of wrote.names) if (name) names.add(name);
  }
  // Only the users the current year's page touched, to save DB overhead
  for (const username of names) await recomputeUserStats(username);

  const settled = await settleLorewardPlaces({ entryIds: written });
  console.log(`[Lorewards] OOL backfill wrote ${written.length} entries from OOL/${year}.`);
  return { entries: written.length, settled };
}
