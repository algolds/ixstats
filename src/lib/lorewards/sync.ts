/**
 * lorewards-sync.ts
 * Syncs Loreward data from the Discord bot's state file and the OOL wiki page
 * into Prisma for fast queries, leaderboards, and profile dashboards.
 */

import * as fs from "fs";
import * as path from "path";
import type { LorewardEntry, Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { parseOOLPage, OOL_YEARS, parseActiveMembers, parseAnnualWinners } from "./ool-parser";
import {
  getBonusConfig,
  getLorewardPayouts,
  grantBonusTx,
  LOREWARD_PAYOUT_START,
  lorewardBonusKey,
  type LorewardPlace,
  type LorewardType,
} from "~/lib/vault/vault-bonus";
import {
  contestHolder,
  contestPlaceKey,
  describeConflict,
  groupByContest,
  type Contest,
} from "./contest-identity";
import {
  findContestEntries,
  holderStillRecordedTx,
  lockContestPlace,
  type StoredContestEntry,
} from "./contest-store";
import { placeOf, resolveLorewardPlace } from "./resolve-user";
import { calculateStreaks } from "./streaks";
import { grantUnownedTrophyCards, mintTrophyCards } from "./trophy-cards";
import { LedgerError } from "~/lib/vault/vault-ledger";
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

const STATE_FILE = path.resolve("/ixwiki/shared/bots/discord/lorewards-state.json");

interface StateFileResult {
  winner?: { user: string; page: string; score: number; bytesAdded: number };
  runnerUp?: { user: string; page: string; score: number; bytesAdded: number };
  candidates?: Array<{ user: string; page: string; score: number; bytesAdded: number }>;
  editCount?: number;
  status?: string;
  date?: string;
  // Weekly range fields
  weekStart?: string;
  weekEnd?: string;
  // Monthly range fields
  monthStart?: string;
  monthEnd?: string;
}

interface StateFile {
  dailyResults?: Record<string, StateFileResult>;
  weeklyResults?: Record<string, StateFileResult>;
  monthlyResults?: Record<string, StateFileResult>;
}

const winnerOf = (r: StateFileResult) => ({
  winnerUser: r.winner?.user ?? null,
  winnerPage: r.winner?.page ?? null,
});

/** Month range from the state file, else derived from a YYYY-MM key (e.g. "2026-03" → Mar 1 - Mar 31). */
function monthRange(date: string, result: StateFileResult) {
  if (result.monthStart) return { start: result.monthStart, end: result.monthEnd ?? null };
  const [year, month] = /^\d{4}-\d{2}$/.test(date) ? date.split("-").map(Number) : [];
  if (!year || !month) return { start: null, end: null };
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${date}-01`, end: `${date}-${String(lastDay).padStart(2, "0")}` };
}

/** The `date|type` keys of the entries an admin override wrote (`overriddenAt`): no sync writes their places again. */
async function overriddenKeys(): Promise<ReadonlySet<string>> {
  const rows = await db.lorewardEntry.findMany({
    where: { overriddenAt: { not: null } },
    select: { date: true, type: true },
  });
  return new Set(rows.map((row) => `${row.date}|${row.type}`));
}

/** One state-file result: `places` are its winner and runner-up columns, `rest` the others it updates. */
interface StateEntryWrite {
  date: string;
  type: "daily" | "weekly" | "monthly";
  create: Omit<Prisma.LorewardEntryCreateInput, "date" | "type">;
  places: Prisma.LorewardEntryUpdateInput;
  rest?: Prisma.LorewardEntryUpdateInput;
}

/** Creates the entry, or updates it, writing its places only when no admin override holds them. */
const upsertEntry = (
  { date, type, create, places, rest }: StateEntryWrite,
  overridden: ReadonlySet<string>
) =>
  db.lorewardEntry.upsert({
    where: { date_type: { date, type } },
    create: { date, type, status: "approved", ...create },
    update: {
      ...rest,
      ...(overridden.has(`${date}|${type}`) ? {} : places),
      syncedAt: new Date(),
    },
  });

async function syncDaily(
  results: Record<string, StateFileResult> | undefined,
  overridden: ReadonlySet<string>
): Promise<number> {
  let synced = 0;
  for (const [date, result] of Object.entries(results ?? {})) {
    if (result.status !== "approved") continue;
    const places = {
      ...winnerOf(result),
      winnerScore: result.winner?.score ?? null,
      winnerBytes: result.winner?.bytesAdded ?? null,
      runnerUpUser: result.runnerUp?.user ?? null,
      runnerUpPage: result.runnerUp?.page ?? null,
      runnerUpScore: result.runnerUp?.score ?? null,
      runnerUpBytes: result.runnerUp?.bytesAdded ?? null,
    };
    const rest = {
      editCount: result.editCount ?? 0,
      metadata: result.candidates ? JSON.stringify(result.candidates) : null,
    };
    await upsertEntry(
      { date, type: "daily", create: { ...places, ...rest }, places, rest },
      overridden
    );
    synced++;
  }

  return synced;
}

/** Weekly results carry weekStart/weekEnd for date range display. */
async function syncWeekly(
  results: Record<string, StateFileResult> | undefined,
  overridden: ReadonlySet<string>
): Promise<number> {
  let synced = 0;
  for (const [date, result] of Object.entries(results ?? {})) {
    await upsertEntry(
      {
        date,
        type: "weekly",
        create: {
          dateStart: result.weekStart ?? null,
          dateEnd: result.weekEnd ?? null,
          ...winnerOf(result),
          winnerScore: result.winner?.score ?? null,
          winnerBytes: result.winner?.bytesAdded ?? null,
        },
        places: winnerOf(result),
        rest: { dateStart: result.weekStart ?? undefined, dateEnd: result.weekEnd ?? undefined },
      },
      overridden
    );
    synced++;
  }

  return synced;
}

async function syncMonthly(
  results: Record<string, StateFileResult> | undefined,
  overridden: ReadonlySet<string>
): Promise<number> {
  let synced = 0;
  for (const [date, result] of Object.entries(results ?? {})) {
    const { start, end } = monthRange(date, result);
    await upsertEntry(
      {
        date,
        type: "monthly",
        create: {
          dateStart: start,
          dateEnd: end,
          ...winnerOf(result),
          winnerScore: result.winner?.score ?? null,
        },
        places: winnerOf(result),
        rest: { dateStart: start ?? undefined, dateEnd: end ?? undefined },
      },
      overridden
    );
    synced++;
  }

  return synced;
}

/**
 * Sync recent results from the bot's lorewards-state.json file.
 */
export async function syncFromStateFile(): Promise<number> {
  let state: StateFile;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as StateFile;
  } catch {
    console.warn("[Lorewards] Could not read state file:", STATE_FILE);
    return 0;
  }

  const overridden = await overriddenKeys();
  return (
    (await syncDaily(state.dailyResults, overridden)) +
    (await syncWeekly(state.weeklyResults, overridden)) +
    (await syncMonthly(state.monthlyResults, overridden))
  );
}

/**
 * Backfill historical entries from ALL OOL wiki pages (2017-2026).
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
        if (!entry.winnerUser) continue;

        // Only insert if not already present
        const existing = await db.lorewardEntry.findUnique({
          where: { date_type: { date: entry.date, type: entry.type } },
        });
        if (existing) continue;
        // A weekly or monthly the state file holds under its own key is written there, not stored twice.
        if (await writeStateTwin(entry)) {
          yearSynced++;
          continue;
        }

        await db.lorewardEntry.create({
          data: {
            date: entry.date,
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
        yearSynced++;
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
 * Full sync: main OOL page → state file → yearly OOL pages → recompute stats.
 */
export async function fullSync(): Promise<{
  stateEntries: number;
  oolEntries: number;
  users: number;
  members: number;
}> {
  const members = await syncFromMainOOLPage();
  const stateEntries = await syncFromStateFile();
  const oolEntries = await syncFromOOLPages();
  const users = await recomputeAllStats();
  // Re-apply medal scores from main page (they're canonical, overwrite computed values)
  await syncFromMainOOLPage();
  await syncTrophyCards();
  return { stateEntries, oolEntries, users, members };
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
 * entry an admin override wrote (`overriddenAt`) keeps its own.
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

/**
 * The stored entries of the parsed entries' keys (`date|type`), and the weekly and monthly entries the state file
 * stores under their own key (`2026-W42`) whose first day (`dateStart`) is a parsed date: the same contest.
 */
async function storedFor(parsed: ParsedEntry[]) {
  const dates = [...new Set(parsed.map((entry) => entry.date))];
  const rows = await db.lorewardEntry.findMany({
    where: {
      OR: [
        { date: { in: dates } },
        { type: { in: ["weekly", "monthly"] }, dateStart: { in: dates } },
      ],
    },
    select: STORED_PLACES,
  });
  const twins = rows.filter((row) => row.dateStart !== null && row.dateStart !== row.date);
  return {
    own: new Map(rows.map((row) => [`${row.date}|${row.type}`, row])),
    twins: new Map(twins.map((row) => [`${row.dateStart}|${row.type}`, row])),
  };
}

/**
 * The state-keyed entry of a weekly or monthly the OOL page keys by its first day, written with the page's places
 * (under the guard) instead of a second entry. Returns whether there was one.
 */
async function writeStateTwin(entry: ParsedEntry): Promise<boolean> {
  if (entry.type === "daily") return false;
  const twin = await db.lorewardEntry.findFirst({
    where: { type: entry.type, dateStart: entry.date },
    select: STORED_PLACES,
  });
  if (!twin) return false;
  await db.lorewardEntry.update({ where: { id: twin.id }, data: oolPlaces(twin, entry) });
  return true;
}

/**
 * Write one current-year entry of the OOL page: over the entry of its key, else over the state-keyed entry of the
 * same weekly or monthly, else as a new entry. Returns the names it stores.
 */
async function writeOOLEntry(
  entry: ParsedEntry,
  stored: Awaited<ReturnType<typeof storedFor>>,
  year: number
): Promise<Array<string | null>> {
  const key = `${entry.date}|${entry.type}`;
  const own = stored.own.get(key);
  const twin = own ? undefined : stored.twins.get(key);
  const places = oolPlaces(own ?? twin, entry);
  if (twin) {
    await db.lorewardEntry.update({ where: { id: twin.id }, data: places });
  } else {
    // Upsert so we get updates/corrections made on the wiki
    await db.lorewardEntry.upsert({
      where: { date_type: { date: entry.date, type: entry.type } },
      create: {
        date: entry.date,
        type: entry.type,
        ...places,
        status: "approved",
        month: entry.month,
        year: entry.year ?? year,
      },
      update: places,
    });
  }
  return [places.winnerUser, places.runnerUpUser];
}

let lastAutoSyncTime = 0;
const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown

/**
 * Automatically sync recent winners from the state file, main OOL page,
 * and current year's OOL wiki page, throttled with a 5-minute cooldown.
 */
export async function syncCurrentWinners(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastAutoSyncTime < AUTO_SYNC_COOLDOWN_MS) {
    return;
  }
  lastAutoSyncTime = now;

  console.log("[Lorewards] Running auto-sync of current winners...");
  try {
    // 1. Sync from local bot state file (extremely fast)
    await syncFromStateFile();

    // 2. Sync main OOL page (fast, updates active member scores)
    await syncFromMainOOLPage();

    // 3. Sync only the current year's OOL wiki page (updates daily/weekly/monthly wins)
    const currentYear = new Date().getFullYear();
    const wikitext = await fetchOOLPageWikitext(currentYear);
    if (wikitext) {
      const parsed = parseOOLPage(wikitext, currentYear);
      const activeUsernames = new Set<string>();
      const stored = await storedFor(parsed);

      for (const entry of parsed) {
        if (!entry.winnerUser) continue;
        for (const name of await writeOOLEntry(entry, stored, currentYear)) {
          if (name) activeUsernames.add(name);
        }
      }

      // Recompute stats for only the users active in the current year to save DB overhead
      for (const username of activeUsernames) {
        await recomputeUserStats(username);
      }
    }

    console.log("[Lorewards] Auto-sync of current winners completed.");
  } catch (err) {
    console.error("[Lorewards] Auto-sync of current winners failed:", err);
  }
}

const PAID_PLACES: LorewardPlace[] = ["winner", "runner-up"];

function isPaidType(type: string): type is LorewardType {
  return type === "daily" || type === "weekly" || type === "monthly";
}

/** The day an entry counts from for the payout start: a daily's `date`, a weekly or monthly's `dateEnd`. */
function payoutDay(entry: { type: string; date: string; dateEnd: string | null }): string {
  return entry.type === "daily" ? entry.date : (entry.dateEnd ?? entry.date);
}

/**
 * A month before `day`: the earliest first day of a weekly or monthly that ends on or after it, so a first-day twin
 * (no range) of a contest that ends after the payout start is read with its state-keyed entry.
 */
const monthBefore = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) - 31 * 86_400_000).toISOString().slice(0, 10);

/**
 * The approved entries a payout can reach: a payout day (a daily's date, a weekly's or monthly's `dateEnd`) on or
 * after `LOREWARD_PAYOUT_START`, plus the first-day twins of the contests that end after it. Read in pages, so the
 * 1,000-row cap never drops one.
 */
function paidEntries(): Promise<StoredContestEntry[]> {
  const ranged = { type: { in: ["weekly", "monthly"] } };
  return findContestEntries(db, {
    status: "approved",
    OR: [
      { type: "daily", date: { gte: LOREWARD_PAYOUT_START } },
      { ...ranged, dateEnd: { gte: LOREWARD_PAYOUT_START } },
      { ...ranged, dateEnd: null, date: { gte: monthBefore(LOREWARD_PAYOUT_START) } },
    ],
  });
}

/**
 * Whether a Loreward bonus was paid for this place already, to anyone, under the key of any of `entryIds` (the
 * contest's entries, read inside the place's lock). A place pays once, whoever holds it now.
 */
async function contestPlacePaid(
  tx: Prisma.TransactionClient,
  entryIds: string[],
  place: LorewardPlace
): Promise<boolean> {
  const paid = await tx.vaultTransaction.findFirst({
    where: {
      type: "EARN_BONUS",
      source: { in: entryIds.map((id) => lorewardBonusKey(id, place)) },
    },
    select: { id: true },
  });
  return paid !== null;
}

/** What paying one place came to: paid, refused by the ledger (earning off, maintenance), or not paid. */
type PlaceOutcome = "paid" | "refused" | "unpaid";

/**
 * Pay one place of one contest, once, through the entry `contestHolder` chooses: in one transaction that takes the
 * place's advisory lock, then reads the contest's entries again and pays only when none was paid for the place, so
 * overlapping or successive runs that listed different entries pay it at most once.
 */
async function payPlace(
  contest: Contest<StoredContestEntry>,
  place: LorewardPlace,
  payouts: Awaited<ReturnType<typeof getLorewardPayouts>>
): Promise<PlaceOutcome> {
  const holder = contestHolder(contest, place);
  if ("conflict" in holder) {
    console.warn(
      `[Lorewards] Not paying ${describeConflict(holder.conflict, place)}: the entries disagree. Settle it at the source (the bot's state file or the OOL page), or with an override, which writes every entry of the contest.`
    );
    return "unpaid";
  }
  const e = holder.entry;
  const recorded = placeOf(e, place);
  if (!isPaidType(e.type) || !recorded) return "unpaid";
  const amount = payouts[e.type][place];
  if (amount <= 0) return "unpaid";
  const userId = await resolveLorewardPlace(db, recorded);
  if (!userId) return "unpaid"; // no account can be told behind the place: skip

  const metadata = {
    entryId: e.id,
    date: e.date,
    type: e.type,
    place,
    wikiUser: recorded.wikiUser,
    winnerUser: e.winnerUser,
    ...(recorded.page ? { page: recorded.page } : {}),
  };
  try {
    const paid = await db.$transaction(async (tx) => {
      await lockContestPlace(tx, contestPlaceKey(e, place));
      // An override that wrote the place while this run waited leaves the resolved holder unrecorded: pay nobody
      const entryIds = await holderStillRecordedTx(tx, e, place, recorded);
      if (!entryIds || (await contestPlacePaid(tx, entryIds, place))) return false;
      return grantBonusTx(tx, userId, lorewardBonusKey(e.id, place), amount, metadata);
    });
    return paid ? "paid" : "unpaid";
  } catch (error) {
    // The ledger refusing an earn (earning switched off, maintenance) rolls the payment back: the key stays free.
    if (error instanceof LedgerError) return "refused";
    console.error(`[Lorewards] Paying ${contestPlaceKey(e, place)} failed:`, error);
    return "unpaid";
  }
}

/**
 * Pay the winner and the runner-up of every approved daily, weekly and monthly contest from the payout start
 * (`LOREWARD_PAYOUT_START`) on, by contest and place (`resolveLorewardPlace`). A plain name pays only the exact holder
 * of its VERIFIED ixwiki `WikiAccountLink`; a `wikios>Label` name pays the one WikiOS account behind the label's
 * edits to the winning page in the contest. Anything else pays no one. A contest stored twice (`groupByContest`)
 * pays each place once, through its state-keyed entry, and not at all while its entries name different holders.
 * Entries before the start are never paid, so an account found later does not back-pay history. Idempotent and
 * safe to overlap: each place pays inside one transaction holding its advisory lock (`contestPlaceKey`), and only
 * when no entry of the contest was paid for it yet, to anyone, under `lorewardBonusKey(entryId, place)`. So a place
 * pays its first holder only; a later holder (an OOL write, a twin, an admin override after payment) is not paid.
 * Returns the number of newly-granted bonuses.
 */
export async function grantLorewardBonuses(): Promise<number> {
  const cfg = await getBonusConfig(db);
  if (!cfg.enabled) return 0;
  const payouts = await getLorewardPayouts(db);
  const entries = await paidEntries();

  const outcomes: PlaceOutcome[] = [];
  for (const contest of groupByContest(entries.filter((e) => isPaidType(e.type)))) {
    // The contest's payout day is read from its state-keyed entry (the one with a range), as it pays through it.
    const lead = contest.find((e) => e.dateStart !== null) ?? contest[0];
    if (payoutDay(lead) < LOREWARD_PAYOUT_START) continue;
    for (const place of PAID_PLACES) outcomes.push(await payPlace(contest, place, payouts));
  }
  const granted = outcomes.filter((outcome) => outcome === "paid").length;
  const refused = outcomes.filter((outcome) => outcome === "refused").length;
  if (refused > 0) {
    console.warn(
      `[Lorewards] The ledger refused ${refused} Loreward bonuses (earning is off or in maintenance); their places stay unpaid and are tried again on the next run.`
    );
  }
  console.log(`[Lorewards] Granted ${granted} new Loreward bonuses.`);
  return granted;
}

/**
 * Trophy cards for the recorded Loreward places: mint the ones that have no card yet, then give each unowned
 * card to its winner once an account can be told behind the place (`resolveLorewardPlace`). Idempotent, and
 * writes no IxCredits.
 */
export async function syncTrophyCards(): Promise<{ minted: number; granted: number }> {
  const { minted } = await mintTrophyCards(db);
  const { granted } = await grantUnownedTrophyCards(db);
  console.log(`[Lorewards] Minted ${minted} trophy cards, granted ${granted}.`);
  return { minted, granted };
}
