/**
 * lorewards-sync.ts
 * Syncs Loreward data from the Discord bot's state file and the OOL wiki page
 * into Prisma for fast queries, leaderboards, and profile dashboards.
 */

import * as fs from "fs";
import * as path from "path";
import { db } from "~/server/db";
import { parseOOLPage, OOL_YEARS, parseActiveMembers, parseAnnualWinners } from "./ool-parser";
import { getBonusConfig, grantBonus } from "~/lib/vault/vault-bonus";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

async function fetchOOLPageWikitext(yearOrKey: number | "main"): Promise<string | null> {
  const pageTitle = yearOrKey === "main" ? "IxWiki:OOL" : `IxWiki:OOL/${yearOrKey}`;
  const shortTitle = yearOrKey === "main" ? "OOL" : `OOL/${yearOrKey}`;

  // 1. Try PostgreSQL first (<1ms)
  try {
    const article: any = await (db as any).wikiArticle.findFirst({
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
    console.warn("[Lorewards] DB lookup failed, falling back to HTTP:", pageTitle, err);
  }

  // 2. Try MediaWiki Action API HTTP
  try {
    const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
    const params = new URLSearchParams({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: pageTitle,
      format: "json",
    });

    const res = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const pages = data?.query?.pages || {};
      const pageId = Object.keys(pages)[0];
      if (pageId && pageId !== "-1") {
        const rev = pages[pageId]?.revisions?.[0];
        return rev?.slots?.main?.["*"] ?? rev?.["*"] ?? null;
      }
    }
  } catch (err) {
    console.error(`[Lorewards] HTTP error fetching OOL/${yearOrKey}:`, err);
  }

  return null;
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

const upsertEntry = (
  date: string,
  type: "daily" | "weekly" | "monthly",
  create: Record<string, unknown>,
  update: Record<string, unknown>
) =>
  db.lorewardEntry.upsert({
    where: { date_type: { date, type } },
    create: { date, type, status: "approved", ...create } as any,
    update: { ...update, syncedAt: new Date() } as any,
  });

async function syncDaily(results: Record<string, StateFileResult> | undefined): Promise<number> {
  let synced = 0;
  for (const [date, result] of Object.entries(results ?? {})) {
    if (result.status !== "approved") continue;
    const fields = {
      ...winnerOf(result),
      winnerScore: result.winner?.score ?? null,
      winnerBytes: result.winner?.bytesAdded ?? null,
      runnerUpUser: result.runnerUp?.user ?? null,
      runnerUpPage: result.runnerUp?.page ?? null,
      runnerUpScore: result.runnerUp?.score ?? null,
      runnerUpBytes: result.runnerUp?.bytesAdded ?? null,
      editCount: result.editCount ?? 0,
      metadata: result.candidates ? JSON.stringify(result.candidates) : null,
    };
    await upsertEntry(date, "daily", fields, fields);
    synced++;
  }

  return synced;
}

/** Weekly results carry weekStart/weekEnd for date range display. */
async function syncWeekly(results: Record<string, StateFileResult> | undefined): Promise<number> {
  let synced = 0;
  for (const [date, result] of Object.entries(results ?? {})) {
    await upsertEntry(
      date,
      "weekly",
      {
        dateStart: result.weekStart ?? null,
        dateEnd: result.weekEnd ?? null,
        ...winnerOf(result),
        winnerScore: result.winner?.score ?? null,
        winnerBytes: result.winner?.bytesAdded ?? null,
      },
      {
        dateStart: result.weekStart ?? undefined,
        dateEnd: result.weekEnd ?? undefined,
        ...winnerOf(result),
      }
    );
    synced++;
  }

  return synced;
}

async function syncMonthly(results: Record<string, StateFileResult> | undefined): Promise<number> {
  let synced = 0;
  for (const [date, result] of Object.entries(results ?? {})) {
    const { start, end } = monthRange(date, result);
    await upsertEntry(
      date,
      "monthly",
      {
        dateStart: start,
        dateEnd: end,
        ...winnerOf(result),
        winnerScore: result.winner?.score ?? null,
      },
      { dateStart: start ?? undefined, dateEnd: end ?? undefined, ...winnerOf(result) }
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

  return (
    (await syncDaily(state.dailyResults)) +
    (await syncWeekly(state.weeklyResults)) +
    (await syncMonthly(state.monthlyResults))
  );
}

/**
 * Backfill historical entries from ALL OOL wiki pages (2017-2026).
 */
async function syncFromOOLPages(): Promise<number> {
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

/**
 * Recompute aggregate stats for a specific user.
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

  const stats = { dailyWins: 0, dailyRunnerUps: 0, weeklyWins: 0, monthlyWins: 0 };
  let totalBytes = 0;
  let lastWinDate: string | null = null;
  const winDates: string[] = [];

  for (const e of entries) {
    if (e.winnerUser === username) {
      if (e.type === "daily") {
        stats.dailyWins++;
        winDates.push(e.date);
      }
      if (e.type === "weekly") stats.weeklyWins++;
      if (e.type === "monthly") stats.monthlyWins++;
      totalBytes += e.winnerBytes ?? 0;
      lastWinDate = e.date;
    }
    if (e.runnerUpUser === username && e.type === "daily") stats.dailyRunnerUps++;
  }

  const { current, longest } = calculateStreaks(winDates);
  const computed = {
    ...stats,
    currentStreak: current,
    longestStreak: longest,
    totalBytes,
    lastWinDate,
  };

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
async function syncFromMainOOLPage(): Promise<number> {
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
  return { stateEntries, oolEntries, users, members };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;

function calculateStreaks(winDates: string[]): { current: number; longest: number } {
  if (winDates.length === 0) return { current: 0, longest: 0 };

  const sorted = [...winDates].sort();
  let longest = 1;
  let run = 1; // after the loop: the consecutive-day run ending at the last win
  for (let i = 1; i < sorted.length; i++) {
    run = daysBetween(sorted[i - 1]!, sorted[i]!) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const today = new Date().toISOString().slice(0, 10);
  const streakBroken = daysBetween(sorted[sorted.length - 1]!, today) > 1;
  return { current: streakBroken ? 0 : run, longest };
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

      for (const entry of parsed) {
        if (!entry.winnerUser) continue;

        activeUsernames.add(entry.winnerUser);
        if (entry.runnerUpUser) activeUsernames.add(entry.runnerUpUser);

        // Upsert so we get updates/corrections made on the wiki
        await db.lorewardEntry.upsert({
          where: { date_type: { date: entry.date, type: entry.type } },
          create: {
            date: entry.date,
            type: entry.type,
            winnerUser: entry.winnerUser,
            winnerPage: entry.winnerPage,
            runnerUpUser: entry.runnerUpUser,
            runnerUpPage: entry.runnerUpPage,
            status: "approved",
            month: entry.month,
            year: entry.year ?? currentYear,
          },
          update: {
            winnerUser: entry.winnerUser,
            winnerPage: entry.winnerPage,
            runnerUpUser: entry.runnerUpUser,
            runnerUpPage: entry.runnerUpPage,
          },
        });
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

/**
 * Grant the Loreward-winner credit bonus to any winning entry whose wiki winnerUser
 * maps to a platform account through a VERIFIED ixwiki `WikiAccountLink` (token proven on the wiki user
 * page, or admin-verified). The legacy `User.wikiUsername` column is deliberately not consulted: it can hold
 * values that were never proven, so paying through it would pay whoever squatted the name.
 * Idempotent: grantBonus(oneTime) keys
 * off `bonus:loreward:<entryId>`, so re-running after each sync only pays new wins.
 * Returns the number of newly-granted bonuses.
 */
export async function grantLorewardBonuses(): Promise<number> {
  const cfg = await getBonusConfig(db);
  if (!cfg.enabled || cfg.loreward <= 0) return 0;

  const entries = await db.lorewardEntry.findMany({
    where: { winnerUser: { not: null }, status: "approved" },
    select: { id: true, winnerUser: true, date: true, type: true },
  });

  let granted = 0;
  for (const e of entries) {
    if (!e.winnerUser) continue;
    const link = await db.wikiAccountLink.findFirst({
      where: {
        source: "ixwiki",
        verifiedAt: { not: null },
        username: { equals: normalizeWikiUsername(e.winnerUser), mode: "insensitive" },
      },
      select: { userId: true },
    });
    if (!link) continue; // winner has no verified platform account — skip

    const res = await grantBonus(db, link.userId, `bonus:loreward:${e.id}`, cfg.loreward, {
      oneTime: true,
      metadata: { entryId: e.id, date: e.date, type: e.type, winnerUser: e.winnerUser },
    });
    if (res.granted) granted++;
  }
  console.log(`[Lorewards] Granted ${granted} new Loreward bonuses.`);
  return granted;
}
