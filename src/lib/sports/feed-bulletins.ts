export interface MatchDayResultLine {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  isUpset?: boolean;
  homeId?: string;
  awayId?: string;
}

/**
 * Format a match day's results into a single bulletin content block.
 */
export interface StandingMover {
  name: string;
  oldRank: number;
  newRank: number;
  id?: string;
}

// ---------------------------------------------------------------------------
// Structured payload — lets the feed render a rich card with deep links while
// the markdown body (below) stays intact for Discord mirroring + fallback.
// ---------------------------------------------------------------------------

export const SPORTS_BULLETIN_PREFIX = "[sportsbulletin]";

export interface SportsBulletinData {
  league: { name: string; id?: string };
  sportEmoji: string;
  matchDay: number;
  results: Array<{
    home: { name: string; id?: string };
    away: { name: string; id?: string };
    homeScore: number;
    awayScore: number;
    isUpset?: boolean;
  }>;
  movers?: Array<{ name: string; id?: string; oldRank: number; newRank: number }>;
  llmSummary?: string;
}

/** Prepend a one-line JSON marker so the feed can render a structured card. */
export function encodeSportsBulletin(data: SportsBulletinData, markdown: string): string {
  return `${SPORTS_BULLETIN_PREFIX}${JSON.stringify(data)}\n\n${markdown}`;
}

/** Parse the marker back out; returns null for ordinary posts. */
export function parseSportsBulletin(
  content: string | null | undefined
): { data: SportsBulletinData; body: string } | null {
  if (!content?.startsWith(SPORTS_BULLETIN_PREFIX)) return null;
  const rest = content.slice(SPORTS_BULLETIN_PREFIX.length);
  const nl = rest.indexOf("\n");
  if (nl === -1) return null;
  try {
    const data = JSON.parse(rest.slice(0, nl)) as SportsBulletinData;
    return { data, body: rest.slice(nl).replace(/^\n+/, "") };
  } catch {
    return null; // ponytail: malformed marker → fall back to plain text
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function formatMatchDayBulletin(args: {
  leagueName: string;
  sportEmoji: string;
  matchDay: number;
  results: MatchDayResultLine[];
  movers?: StandingMover[];
  llmSummary?: string;
}): string {
  const { leagueName, sportEmoji, matchDay, results, movers, llmSummary } = args;

  const header = `${sportEmoji} **${leagueName}** — Matchday ${matchDay}`;
  const separator = "═".repeat(30);

  const matchLines = results.map((r) => {
    const homeText = r.homeScore > r.awayScore ? `🏆 **${r.homeName}**` : r.homeName;
    const awayText = r.awayScore > r.homeScore ? `🏆 **${r.awayName}**` : r.awayName;
    return `${homeText} ${r.homeScore} – ${r.awayScore} ${awayText}`;
  });

  const upsets = results.filter((r) => r.isUpset);
  const upsetSection =
    upsets.length > 0
      ? `\n\n⭐ **Upsets of the Day**\n` +
        upsets
          .map(
            (u) =>
              `• ${u.homeScore > u.awayScore ? u.homeName : u.awayName} defeats ${u.homeScore > u.awayScore ? u.awayName : u.homeName}!`
          )
          .join("\n")
      : "";

  const moversSection =
    movers && movers.length > 0
      ? `\n\n📈 **Table Movers**\n` +
        movers
          .map((m) => {
            const up = m.newRank < m.oldRank;
            const arrow = up ? "▲" : "▼";
            return `• ${m.name} ${arrow}${Math.abs(m.oldRank - m.newRank)} (${ordinal(m.oldRank)} → ${ordinal(m.newRank)})`;
          })
          .join("\n")
      : "";

  const summarySection = llmSummary ? `\n\n📝 **Matchday Summary**\n${llmSummary}` : "";

  return `${header}\n${separator}\n${matchLines.join("\n")}${upsetSection}${moversSection}${summarySection}`;
}

/** Build the structured payload that backs the rich feed card. */
export function buildMatchDayBulletinData(args: {
  leagueName: string;
  leagueId?: string;
  sportEmoji: string;
  matchDay: number;
  results: MatchDayResultLine[];
  movers?: StandingMover[];
  llmSummary?: string;
}): SportsBulletinData {
  return {
    league: { name: args.leagueName, id: args.leagueId },
    sportEmoji: args.sportEmoji,
    matchDay: args.matchDay,
    results: args.results.map((r) => ({
      home: { name: r.homeName, id: r.homeId },
      away: { name: r.awayName, id: r.awayId },
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      isUpset: r.isUpset,
    })),
    movers: args.movers?.map((m) => ({
      name: m.name,
      id: m.id,
      oldRank: m.oldRank,
      newRank: m.newRank,
    })),
    llmSummary: args.llmSummary,
  };
}

/**
 * Format season champion news bulletin.
 */
export function formatSeasonChampionBulletin(args: {
  leagueName: string;
  sportEmoji: string;
  championName: string;
  llmSummary?: string;
}): string {
  const { leagueName, sportEmoji, championName, llmSummary } = args;
  const header = `🏆 **${leagueName} CHAMPION CROWNED!**`;
  const separator = "═".repeat(30);
  const body = `Congratulations to **${championName}** for winning the championship!`;
  const summarySection = llmSummary ? `\n\n📝 **Season Summary**\n${llmSummary}` : "";
  return `${sportEmoji} ${header}\n${separator}\n${body}${summarySection}`;
}

/**
 * Format playoff bulletin.
 */
export function formatPlayoffBulletin(args: {
  leagueName: string;
  sportEmoji: string;
  roundName: string;
  results: MatchDayResultLine[];
  llmSummary?: string;
}): string {
  const { leagueName, sportEmoji, roundName, results, llmSummary } = args;
  const header = `${sportEmoji} **${leagueName} Playoff ${roundName} Results**`;
  const separator = "═".repeat(30);
  const matchLines = results.map((r) => {
    const homeText = r.homeScore > r.awayScore ? `🏆 **${r.homeName}**` : r.homeName;
    const awayText = r.awayScore > r.homeScore ? `🏆 **${r.awayName}**` : r.awayName;
    return `${homeText} ${r.homeScore} – ${r.awayScore} ${awayText}`;
  });
  const summarySection = llmSummary ? `\n\n📝 **Round Summary**\n${llmSummary}` : "";
  return `${header}\n${separator}\n${matchLines.join("\n")}${summarySection}`;
}
