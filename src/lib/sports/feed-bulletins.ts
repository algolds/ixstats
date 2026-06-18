export interface MatchDayResultLine {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  isUpset?: boolean;
}

/**
 * Format a match day's results into a single bulletin content block.
 */
export function formatMatchDayBulletin(args: {
  leagueName: string;
  sportEmoji: string;
  matchDay: number;
  results: MatchDayResultLine[];
  llmSummary?: string;
}): string {
  const { leagueName, sportEmoji, matchDay, results, llmSummary } = args;

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

  const summarySection = llmSummary ? `\n\n📝 **Matchday Summary**\n${llmSummary}` : "";

  return `${header}\n${separator}\n${matchLines.join("\n")}${upsetSection}${summarySection}`;
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
