/**
 * lorewards-sync.ts
 * Syncs Loreward data from the Discord bot's state file and the OOL wiki page
 * into Prisma for fast queries, leaderboards, and profile dashboards.
 */

import * as fs from "fs";
import * as path from "path";
import * as mysql from "mysql2/promise";
import { db } from "~/server/db";
import { parseOOLPage, OOL_YEARS, parseActiveMembers, parseAnnualWinners } from "~/lib/lorewards-ool-parser";

// Direct MySQL for namespace 4 (Project/IxWiki) pages
let oolPool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (!oolPool) {
    oolPool = mysql.createPool({
      host: "localhost",
      port: 3306,
      user: "ixwiki",
      password: "Multico1!",
      database: "ixwiki",
      waitForConnections: true,
      connectionLimit: 2,
    });
  }
  return oolPool;
}

async function fetchOOLPageWikitext(yearOrKey: number | "main"): Promise<string | null> {
  try {
    const pool = getPool();
    const pageTitle = yearOrKey === "main" ? "OOL" : `OOL/${yearOrKey}`;
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      `SELECT t.old_text
       FROM page p
       JOIN slots s ON s.slot_revision_id = p.page_latest
       JOIN content c ON c.content_id = s.slot_content_id
       JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
       WHERE p.page_title = ? AND p.page_namespace = 4
       LIMIT 1`,
      [pageTitle]
    );
    if (!rows || rows.length === 0) return null;
    return String(rows[0]!.old_text);
  } catch (err) {
    console.error(`[Lorewards] MySQL error fetching OOL/${year}:`, err);
    return null;
  }
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

/**
 * Sync recent results from the bot's lorewards-state.json file.
 */
export async function syncFromStateFile(): Promise<number> {
  let state: StateFile;
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    state = JSON.parse(raw) as StateFile;
  } catch {
    console.warn("[Lorewards] Could not read state file:", STATE_FILE);
    return 0;
  }

  let synced = 0;

  // Sync daily results
  for (const [date, result] of Object.entries(state.dailyResults ?? {})) {
    if (result.status !== "approved") continue;
    await db.lorewardEntry.upsert({
      where: { date_type: { date, type: "daily" } },
      create: {
        date,
        type: "daily",
        winnerUser: result.winner?.user ?? null,
        winnerPage: result.winner?.page ?? null,
        winnerScore: result.winner?.score ?? null,
        winnerBytes: result.winner?.bytesAdded ?? null,
        runnerUpUser: result.runnerUp?.user ?? null,
        runnerUpPage: result.runnerUp?.page ?? null,
        runnerUpScore: result.runnerUp?.score ?? null,
        runnerUpBytes: result.runnerUp?.bytesAdded ?? null,
        editCount: result.editCount ?? 0,
        status: "approved",
        metadata: result.candidates ? JSON.stringify(result.candidates) : null,
      },
      update: {
        winnerUser: result.winner?.user ?? null,
        winnerPage: result.winner?.page ?? null,
        winnerScore: result.winner?.score ?? null,
        winnerBytes: result.winner?.bytesAdded ?? null,
        runnerUpUser: result.runnerUp?.user ?? null,
        runnerUpPage: result.runnerUp?.page ?? null,
        runnerUpScore: result.runnerUp?.score ?? null,
        runnerUpBytes: result.runnerUp?.bytesAdded ?? null,
        editCount: result.editCount ?? 0,
        metadata: result.candidates ? JSON.stringify(result.candidates) : null,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  // Sync weekly results — capture weekStart/weekEnd for date range display
  for (const [date, result] of Object.entries(state.weeklyResults ?? {})) {
    await db.lorewardEntry.upsert({
      where: { date_type: { date, type: "weekly" } },
      create: {
        date,
        type: "weekly",
        dateStart: result.weekStart ?? null,
        dateEnd: result.weekEnd ?? null,
        winnerUser: result.winner?.user ?? null,
        winnerPage: result.winner?.page ?? null,
        winnerScore: result.winner?.score ?? null,
        winnerBytes: result.winner?.bytesAdded ?? null,
        status: "approved",
      },
      update: {
        dateStart: result.weekStart ?? undefined,
        dateEnd: result.weekEnd ?? undefined,
        winnerUser: result.winner?.user ?? null,
        winnerPage: result.winner?.page ?? null,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  // Sync monthly results — derive range from date key (YYYY-MM format)
  for (const [date, result] of Object.entries(state.monthlyResults ?? {})) {
    // Compute month range from key (e.g. "2026-03" → Mar 1 - Mar 31)
    let monthStart: string | null = null;
    let monthEnd: string | null = null;
    if (result.monthStart) {
      monthStart = result.monthStart;
      monthEnd = result.monthEnd ?? null;
    } else if (/^\d{4}-\d{2}$/.test(date)) {
      // Derive from YYYY-MM key
      const [year, month] = date.split("-").map(Number);
      if (year && month) {
        monthStart = `${date}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        monthEnd = `${date}-${String(lastDay).padStart(2, "0")}`;
      }
    }

    await db.lorewardEntry.upsert({
      where: { date_type: { date, type: "monthly" } },
      create: {
        date,
        type: "monthly",
        dateStart: monthStart,
        dateEnd: monthEnd,
        winnerUser: result.winner?.user ?? null,
        winnerPage: result.winner?.page ?? null,
        winnerScore: result.winner?.score ?? null,
        status: "approved",
      },
      update: {
        dateStart: monthStart ?? undefined,
        dateEnd: monthEnd ?? undefined,
        winnerUser: result.winner?.user ?? null,
        winnerPage: result.winner?.page ?? null,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  return synced;
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

      console.log(`[Lorewards] Synced ${yearSynced} entries from OOL/${year} (${parsed.length} parsed)`);
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

  let dailyWins = 0, dailyRunnerUps = 0, weeklyWins = 0, monthlyWins = 0;
  let totalBytes = 0;
  let lastWinDate: string | null = null;
  const winDates: string[] = [];

  for (const e of entries) {
    if (e.winnerUser === username) {
      if (e.type === "daily") { dailyWins++; winDates.push(e.date); }
      if (e.type === "weekly") weeklyWins++;
      if (e.type === "monthly") monthlyWins++;
      totalBytes += e.winnerBytes ?? 0;
      lastWinDate = e.date;
    }
    if (e.runnerUpUser === username && e.type === "daily") {
      dailyRunnerUps++;
    }
  }

  const { current, longest } = calculateStreaks(winDates);

  // Preserve existing totalScore (set from main OOL page medal scores)
  const existing = await db.lorewardUserStats.findUnique({ where: { username } });

  await db.lorewardUserStats.upsert({
    where: { username },
    create: {
      username, dailyWins, dailyRunnerUps, weeklyWins, monthlyWins,
      currentStreak: current, longestStreak: longest,
      totalScore: 0, totalBytes, lastWinDate,
    },
    update: {
      dailyWins, dailyRunnerUps, weeklyWins, monthlyWins,
      currentStreak: current, longestStreak: longest,
      // Only update totalScore if it wasn't already set from the main OOL page
      ...(existing?.totalScore === 0 || !existing ? { totalScore: 0 } : {}),
      totalBytes, lastWinDate,
    },
  });
}

/**
 * Recompute stats for all users with entries.
 */
export async function recomputeAllStats(): Promise<number> {
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
export async function fullSync(): Promise<{ stateEntries: number; oolEntries: number; users: number; members: number }> {
  const members = await syncFromMainOOLPage();
  const stateEntries = await syncFromStateFile();
  const oolEntries = await syncFromOOLPages();
  const users = await recomputeAllStats();
  // Re-apply medal scores from main page (they're canonical, overwrite computed values)
  await syncFromMainOOLPage();
  return { stateEntries, oolEntries, users, members };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateStreaks(winDates: string[]): { current: number; longest: number } {
  if (winDates.length === 0) return { current: 0, longest: 0 };

  const sorted = [...winDates].sort();
  let longest = 1;
  let current = 1;
  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      streak++;
    } else {
      streak = 1;
    }
    longest = Math.max(longest, streak);
  }

  // Current streak: count backwards from the last win date
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = sorted[sorted.length - 1]!;
  const daysSinceLast = (new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLast > 1) {
    current = 0; // Streak broken
  } else {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const prev = new Date(sorted[i]!);
      const curr = new Date(sorted[i + 1]!);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) current++;
      else break;
    }
  }

  return { current, longest };
}
