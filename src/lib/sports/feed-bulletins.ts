export interface MatchDayResultLine {
  homeName: string;
  homeId?: string;
  awayName: string;
  awayId?: string;
  homeScore: number;
  awayScore: number;
  isUpset?: boolean;
}

/**
 * Format a match day's results into a single bulletin content block.
 */
export interface StandingMover {
  name: string;
  id?: string;
  oldRank: number;
  newRank: number;
}

// ---------------------------------------------------------------------------
// Structured payload — lets the feed render a rich card with deep links while
// the markdown body (below) stays intact for Discord mirroring + fallback.
// ---------------------------------------------------------------------------

export interface SportsBulletinData {
  league: { id?: string; name: string };
  sportEmoji: string;
  matchDay: number;
  results: {
    home: { name: string; id?: string };
    away: { name: string; id?: string };
    homeScore: number;
    awayScore: number;
    isUpset?: boolean;
  }[];
  movers?: { name: string; id?: string; oldRank: number; newRank: number }[];
  llmSummary?: string;
}

export function encodeSportsBulletin(data: SportsBulletinData, markdown: string): string {
  return `<!-- sports-bulletin:${JSON.stringify(data)} -->\n${markdown}`;
}

export function parseSportsBulletin(content: string | null | undefined): SportsBulletinData | null {
  if (!content) return null;
  const match = content.match(/<!-- sports-bulletin:([\s\S]*?)-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]!) as SportsBulletinData;
  } catch {
    return null;
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
