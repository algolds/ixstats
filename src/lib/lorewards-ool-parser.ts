/**
 * lorewards-ool-parser.ts
 * Parses IxWiki:OOL/* wiki pages into structured Loreward entries.
 * Handles multiple historical formats (2017-2026).
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Mirror the bot's USERNAME_ALIASES
const USERNAME_ALIASES: Record<string, string> = {
  Rumahoki: "Castadilla",
};
const REVERSE_ALIASES = Object.fromEntries(
  Object.entries(USERNAME_ALIASES).map(([k, v]) => [v, k])
);

function resolveUsername(displayName: string): string {
  return REVERSE_ALIASES[displayName] ?? displayName;
}

function monthToIndex(month: string): number {
  return MONTHS.indexOf(month);
}

export interface ParsedOOLEntry {
  date: string;
  type: "daily" | "weekly" | "monthly";
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
  month?: string;
  year?: number;
}

/**
 * Parse daily entries — handles all known formats:
 *
 * Format A (2022-2024, 2026):
 *   *'''January 1'''<br>Winner: [[User:X]] for [[Article]]<br>Runner up: [[User:Y]] for [[Article2]]
 *
 * Format B (2025):
 *   *'''January 1'''<br> Winner: [[Article]] ([[User:X]])<br> Runner up: [[Article2]] ([[User:Y]])
 *
 * Format C (2017-2020, wikitable):
 *   |[[user:X]] 3/18/2017
 */
export function parseDailyEntries(wikitext: string, year: number): ParsedOOLEntry[] {
  const entries: ParsedOOLEntry[] = [];

  // Detect old wikitable format (2017-2020)
  if (wikitext.includes('class="wikitable"') && !wikitext.includes("==Daily==")) {
    return parseOldWikitableFormat(wikitext, year);
  }

  const dailyMatch = wikitext.match(/==\s*Daily\s*==([\s\S]*?)(?:==\s*Weekly\s*==|$)/i);
  if (!dailyMatch) return entries;
  const dailySection = dailyMatch[1]!;

  const lines = dailySection.split("\n");

  for (const line of lines) {
    // Skip month headers (====March====)
    if (/====\s*\w+\s*====/.test(line)) continue;

    // Match entry header: *'''Month Day'''
    const entryMatch = line.match(/\*\s*'''(\w+)\s+(\d+)'''/);
    if (!entryMatch) continue;

    const month = entryMatch[1]!;
    const day = parseInt(entryMatch[2]!, 10);
    const monthIdx = monthToIndex(month);
    if (monthIdx === -1) continue;

    // Use the month from the entry itself (more reliable than section header)
    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Check for "None awarded"
    if (/Winner:\s*None\s*awarded/i.test(line)) {
      entries.push({
        date: dateStr,
        type: "daily",
        winnerUser: null,
        winnerPage: null,
        runnerUpUser: null,
        runnerUpPage: null,
      });
      continue;
    }

    let winnerUser: string | null = null;
    let winnerPage: string | null = null;
    let runnerUpUser: string | null = null;
    let runnerUpPage: string | null = null;

    // Format A: Winner: [[User:X]] for [[Article]]
    const fmtA_winner = line.match(
      /Winner\s*:\s*\[\[User:([^\]|]+)[^\]]*\]\]\s*for\s*\[\[([^\]]+)\]\]/i
    );
    if (fmtA_winner) {
      winnerUser = resolveUsername(fmtA_winner[1]!.trim());
      winnerPage = fmtA_winner[2]!.trim();
    }

    // Format B: Winner: [[Article]] ([[User:X]])
    if (!fmtA_winner) {
      const fmtB_winner = line.match(
        /Winner\s*:\s*\[\[([^\]]+)\]\]\s*\(\[\[User:([^\]|]+)[^\]]*\]\]\)/i
      );
      if (fmtB_winner) {
        winnerPage = fmtB_winner[1]!.trim();
        winnerUser = resolveUsername(fmtB_winner[2]!.trim());
      }
    }

    // Format A runner-up
    const fmtA_runner = line.match(
      /Runner[- ]?up\s*:\s*\[\[User:([^\]|]+)[^\]]*\]\]\s*for\s*\[\[([^\]]+)\]\]/i
    );
    if (fmtA_runner) {
      runnerUpUser = resolveUsername(fmtA_runner[1]!.trim());
      runnerUpPage = fmtA_runner[2]!.trim();
    }

    // Format B runner-up
    if (!fmtA_runner) {
      const fmtB_runner = line.match(
        /Runner[- ]?up\s*:\s*\[\[([^\]]+)\]\]\s*\(\[\[User:([^\]|]+)[^\]]*\]\]\)/i
      );
      if (fmtB_runner) {
        runnerUpPage = fmtB_runner[1]!.trim();
        runnerUpUser = resolveUsername(fmtB_runner[2]!.trim());
      }
    }

    entries.push({
      date: dateStr,
      type: "daily",
      winnerUser,
      winnerPage,
      runnerUpUser,
      runnerUpPage,
    });
  }

  return entries;
}

/**
 * Parse old wikitable format (2017-2020).
 * Format: |[[user:X]] 3/18/2017
 * No article titles, just usernames and dates.
 */
function parseOldWikitableFormat(wikitext: string, year: number): ParsedOOLEntry[] {
  const entries: ParsedOOLEntry[] = [];
  const lines = wikitext.split("\n");

  for (const line of lines) {
    // Match: |[[user:X]] M/D/YYYY
    const match = line.match(/\|\s*\[\[user:([^\]|]+)\]\]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (!match) continue;

    const username = resolveUsername(match[1]!.trim());
    const m = parseInt(match[2]!, 10);
    const d = parseInt(match[3]!, 10);
    const y = parseInt(match[4]!, 10);
    if (y !== year) continue;

    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    entries.push({
      date: dateStr,
      type: "daily",
      winnerUser: username,
      winnerPage: null, // Old format has no article
      runnerUpUser: null,
      runnerUpPage: null,
    });
  }

  return entries;
}

/**
 * Extract a username from various wikitext link formats:
 *   [[User:X]], [[User: X]], [[X]] (bare link, no User: prefix)
 */
function extractUser(text: string): string | null {
  // [[User:X]] or [[User: X]]
  const userLink = text.match(/\[\[User:\s*([^\]|]+)\]\]/i);
  if (userLink) return resolveUsername(userLink[1]!.trim());

  // Bare [[X]] (no User: prefix — used inconsistently in some years)
  const bareLink = text.match(/\[\[([^\]:]+)\]\]/);
  if (bareLink) {
    const name = bareLink[1]!.trim();
    // Skip if it looks like an article (contains spaces + lowercase, or "List of...")
    if (name.includes(" ") && name[0] === name[0]!.toLowerCase()) return null;
    return resolveUsername(name);
  }

  return null;
}

/**
 * Parse weekly entries. Handles all known formats:
 *   *'''January 1 - January 7''' - [[User:X]]
 *   *'''Week of March 24-30''': [[User:X]] for [[Article]]
 *   *'''March 2 - March 8''' - [[User: Castadilla]]
 *   *'''April 6 - April 12''' - [[Castadilla]]
 */
export function parseWeeklyEntries(wikitext: string, year: number): ParsedOOLEntry[] {
  const entries: ParsedOOLEntry[] = [];

  const weeklyMatch = wikitext.match(/==\s*Weekly\s*==([\s\S]*?)(?:==\s*Monthly\s*==|$)/i);
  if (!weeklyMatch) return entries;

  const lines = weeklyMatch[1]!.split("\n");
  for (const line of lines) {
    if (!line.startsWith("*")) continue;

    // Extract the start date from week range: '''Month Day - ...''' or '''Week of Month Day...'''
    const dateMatch = line.match(/'''(?:Week of\s+)?(\w+)\s+(\d+)/i);
    if (!dateMatch) continue;

    const month = dateMatch[1]!;
    const day = parseInt(dateMatch[2]!, 10);
    const monthIdx = monthToIndex(month);
    if (monthIdx === -1) continue;
    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Extract user — try all formats after the date range
    const afterDate = line.replace(/^.*'''[^']*'''\s*[-:]\s*/, "");

    // Format with article: [[User:X]] for [[Article]]
    const withArticle = afterDate.match(/\[\[User:\s*([^\]|]+)\]\]\s*for\s*\[\[([^\]]+)\]\]/i);
    if (withArticle) {
      entries.push({
        date: dateStr,
        type: "weekly",
        winnerUser: resolveUsername(withArticle[1]!.trim()),
        winnerPage: withArticle[2]!.trim(),
        runnerUpUser: null,
        runnerUpPage: null,
      });
      continue;
    }

    // Just user link
    const user = extractUser(afterDate);
    if (user) {
      entries.push({
        date: dateStr,
        type: "weekly",
        winnerUser: user,
        winnerPage: null,
        runnerUpUser: null,
        runnerUpPage: null,
      });
    }
  }

  return entries;
}

/**
 * Parse monthly entries. Handles all known formats:
 *   ====January====\n*[[User:X]]
 *   ====January====\n[[User:X]]
 *   ====January====\n[[Castadilla]]
 *   *'''January''': [[User:X]] for [[Article]]
 */
export function parseMonthlyEntries(wikitext: string, year: number): ParsedOOLEntry[] {
  const entries: ParsedOOLEntry[] = [];

  const monthlyMatch = wikitext.match(/==\s*Monthly\s*==([\s\S]*?)(?:\n==[^=]|$)/i);
  if (!monthlyMatch) return entries;

  const section = monthlyMatch[1]!;
  let currentMonth = "";

  const lines = section.split("\n");
  for (const line of lines) {
    // Month subsection header: ====January====
    const monthHeader = line.match(/====\s*(\w+)\s*====/);
    if (monthHeader) {
      currentMonth = monthHeader[1]!;
      continue;
    }

    // Inline format: *'''January''': [[User:X]]
    const inlineMatch = line.match(/\*\s*'''(\w+)'''\s*[:]\s*(.*)/);
    if (inlineMatch) {
      const month = inlineMatch[1]!;
      const monthIdx = monthToIndex(month);
      if (monthIdx === -1) continue;
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
      const rest = inlineMatch[2]!;

      // With article
      const withArt = rest.match(/\[\[User:\s*([^\]|]+)\]\]\s*for\s*\[\[([^\]]+)\]\]/i);
      if (withArt) {
        entries.push({
          date: dateStr,
          type: "monthly",
          winnerUser: resolveUsername(withArt[1]!.trim()),
          winnerPage: withArt[2]!.trim(),
          runnerUpUser: null,
          runnerUpPage: null,
          month,
          year,
        });
        continue;
      }

      const user = extractUser(rest);
      if (user) {
        entries.push({
          date: dateStr,
          type: "monthly",
          winnerUser: user,
          winnerPage: null,
          runnerUpUser: null,
          runnerUpPage: null,
          month,
          year,
        });
        continue;
      }

      // Plain text username: '''Username'''
      const plainUser = rest.match(/'''([^']+)'''/);
      if (plainUser) {
        entries.push({
          date: dateStr,
          type: "monthly",
          winnerUser: resolveUsername(plainUser[1]!.trim()),
          winnerPage: null,
          runnerUpUser: null,
          runnerUpPage: null,
          month,
          year,
        });
      }
      continue;
    }

    // User on its own line under a month header: *[[User:X]] or [[User:X]] or [[Castadilla]]
    if (currentMonth && (line.includes("[[User:") || line.includes("[["))) {
      const monthIdx = monthToIndex(currentMonth);
      if (monthIdx === -1) continue;
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;

      const user = extractUser(line);
      if (user) {
        entries.push({
          date: dateStr,
          type: "monthly",
          winnerUser: user,
          winnerPage: null,
          runnerUpUser: null,
          runnerUpPage: null,
          month: currentMonth,
          year,
        });
      }
    }
  }

  return entries;
}

/** Parse all entry types from an OOL page */
export function parseOOLPage(wikitext: string, year: number): ParsedOOLEntry[] {
  return [
    ...parseDailyEntries(wikitext, year),
    ...parseWeeklyEntries(wikitext, year),
    ...parseMonthlyEntries(wikitext, year),
  ];
}

/** All known OOL page years */
export const OOL_YEARS = [2017, 2018, 2019, 2020, 2022, 2023, 2024, 2025, 2026];

// ---------------------------------------------------------------------------
// Main OOL page parsers (IxWiki:OOL — active members, annual winners)
// ---------------------------------------------------------------------------

export interface ActiveMember {
  username: string;
  membershipDate: string; // "Antiquity", "Sept-23", etc.
  medalScore: number;
}

export interface AnnualWinner {
  year: number;
  username: string | null;
}

/**
 * Parse the Active Members table from the main OOL page.
 * Format: wikitable rows with Username, Order Membership Date, Medal Count, Medal Score
 */
export function parseActiveMembers(wikitext: string): ActiveMember[] {
  const members: ActiveMember[] = [];

  // Find the Active Members table
  const tableMatch = wikitext.match(/==\s*Active Members\s*==([\s\S]*?)\n\|}/);
  if (!tableMatch) return members;

  const rows = tableMatch[1]!.split("|-");
  for (const row of rows) {
    // Extract username from [[User:X]]
    const userMatch = row.match(/\[\[User:([^\]|]+)\]\]/);
    if (!userMatch) continue;

    // Extract membership date (second column)
    const lines = row.split("\n").filter((l) => l.startsWith("|") && !l.startsWith("|-"));
    if (lines.length < 4) continue;

    // Membership date is the second | line
    const dateStr = lines[1]?.replace(/^\|\s*/, "").trim() ?? "";

    // Medal score is the last | line (number)
    const scoreStr = lines[lines.length - 1]?.replace(/^\|\s*/, "").trim() ?? "0";
    const medalScore = parseInt(scoreStr, 10) || 0;

    members.push({
      username: userMatch[1]!.trim(),
      membershipDate: dateStr,
      medalScore,
    });
  }

  return members;
}

/**
 * Parse Annual Winners from the main OOL page.
 */
export function parseAnnualWinners(wikitext: string): AnnualWinner[] {
  const winners: AnnualWinner[] = [];

  const section = wikitext.match(/==\s*Annual Winners\s*==([\s\S]*?)(?:==\s*Rookie|$)/i);
  if (!section) return winners;

  const yearBlocks = section[1]!.matchAll(/===\s*(\d{4})\s*===([\s\S]*?)(?====|\s*$)/g);
  for (const match of yearBlocks) {
    const year = parseInt(match[1]!, 10);
    const content = match[2]!;

    const userMatch = content.match(/\[\[User:([^\]|]+)\]\]/);
    winners.push({
      year,
      username: userMatch ? userMatch[1]!.trim() : null,
    });
  }

  return winners;
}
