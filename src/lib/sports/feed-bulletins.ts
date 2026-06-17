export interface MatchDayResultLine {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Format a match day's results into a single bulletin content block.
 */
export function formatMatchDayBulletin(args: {
  leagueName: string;
  sportEmoji: string;
  matchDay: number;
  results: MatchDayResultLine[];
}): string {
  const { leagueName, sportEmoji, matchDay, results } = args;
  const lines = results.map(
    (r) => `${r.homeName} ${r.homeScore}–${r.awayScore} ${r.awayName}`
  );
  return `${sportEmoji} [${leagueName}] Match Day ${matchDay} results\n\n${lines.join("\n")}`;
}
