import type { PrismaClient } from "@prisma/client";
import { labelOfImportName } from "~/lib/wiki-os/services/import-label";
import { nameSpellings } from "./resolve-user";

/** One player's Lorewards standing over every name they play under. */
export interface LorewardStatsTotal {
  totalScore: number;
  totalBytes: number;
  dailyWins: number;
  dailyRunnerUps: number;
  weeklyWins: number;
  monthlyWins: number;
  currentStreak: number;
  longestStreak: number;
}

const SUMMED = [
  "totalScore",
  "totalBytes",
  "dailyWins",
  "dailyRunnerUps",
  "weeklyWins",
  "monthlyWins",
] as const;
const LARGEST = ["currentStreak", "longestStreak"] as const;
const SELECT = {
  totalScore: true,
  totalBytes: true,
  dailyWins: true,
  dailyRunnerUps: true,
  weeklyWins: true,
  monthlyWins: true,
  currentStreak: true,
  longestStreak: true,
} as const;
const NONE: LorewardStatsTotal = {
  totalScore: 0,
  totalBytes: 0,
  dailyWins: 0,
  dailyRunnerUps: 0,
  weeklyWins: 0,
  monthlyWins: 0,
  currentStreak: 0,
  longestStreak: 0,
};

/** The usernames a name's stats row may be kept under: a plain name in its `nameSpellings`, a `wikios>` name as it is. */
function spellingsOf(name: string): string[] {
  return labelOfImportName(name) === null ? nameSpellings(name) : [name];
}

function addUp(total: LorewardStatsTotal, row: LorewardStatsTotal): LorewardStatsTotal {
  const next = { ...total };
  for (const key of SUMMED) next[key] += row[key];
  for (const key of LARGEST) next[key] = Math.max(next[key], row[key]);
  return next;
}

/**
 * The Lorewards stats rows of several names added up (the streaks are the largest, not a sum); null when none has a
 * row. A plain name is read in its `nameSpellings`, a `wikios>` name as it is. One query.
 */
export async function lorewardStatsOfNames(
  db: Pick<PrismaClient, "lorewardUserStats">,
  names: readonly string[]
): Promise<LorewardStatsTotal | null> {
  const usernames = [...new Set(names.flatMap(spellingsOf))];
  if (usernames.length === 0) return null;
  const rows = await db.lorewardUserStats.findMany({
    where: { username: { in: usernames } },
    select: SELECT,
  });
  return rows.length === 0 ? null : rows.reduce(addUp, NONE);
}
