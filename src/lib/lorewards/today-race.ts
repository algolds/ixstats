import { scoreDailyWikiOS } from "./scoring";

const CACHE_MS = 10 * 60_000;
const TOP = 10;

export interface TodayRaceEntry {
  rank: number;
  user: string;
  page: string;
  score: number;
  bytesAdded: number;
  editCount: number;
}

export interface TodayRace {
  /** The UTC day being raced, `yyyy-mm-dd`. */
  date: string;
  /** Mainspace edits scored so far today. */
  editCount: number;
  entries: TodayRaceEntry[];
}

let cached: { date: string; expires: number; race: Promise<TodayRace> } | null = null;

async function scoreToday(date: string): Promise<TodayRace> {
  const scored = await scoreDailyWikiOS(date);
  const entries = scored.candidates
    .filter((c) => c.finalScore > 0)
    .slice(0, TOP)
    .map((c, i) => ({
      rank: i + 1,
      user: c.user,
      page: c.page,
      score: Math.round(c.finalScore),
      bytesAdded: c.bytesAdded,
      editCount: c.editCount,
    }));
  return { date, editCount: scored.editCount, entries };
}

/**
 * The standings of today's (UTC) Loreward race: the top ten scoring editors so far. Scoring reads a day of
 * revisions, so one run is shared by every reader for ten minutes and a failed run is not kept.
 */
export function getTodayRace(now: number = Date.now()): Promise<TodayRace> {
  const date = new Date(now).toISOString().slice(0, 10);
  if (cached && cached.date === date && cached.expires > now) return cached.race;

  const race = scoreToday(date);
  const entry = { date, expires: now + CACHE_MS, race };
  cached = entry;
  race.catch(() => {
    if (cached === entry) cached = null;
  });
  return race;
}
