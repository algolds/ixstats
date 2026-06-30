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
  matchDay?: number;
  results?: {
    home: { name: string; id?: string };
    away: { name: string; id?: string };
    homeScore: number;
    awayScore: number;
    isUpset?: boolean;
  }[];
  movers?: { name: string; id?: string; oldRank: number; newRank: number }[];
  llmSummary?: string;
  isChampionBulletin?: boolean;
  championName?: string;
  championId?: string;
  isPlayoffBulletin?: boolean;
  roundName?: string;
}

export function encodeSportsBulletin(data: SportsBulletinData, markdown: string): string {
  return `<!-- sports-bulletin:${JSON.stringify(data)} -->\n${markdown}`;
}

function cleanNameAndId(rawName: string): { name: string; id?: string } {
  // Strip trophies and bold tags first
  let clean = rawName.replace(/🏆/g, "").replace(/\*\*/g, "").trim();
  // Check if it matches markdown link: [Name](/path/id)
  const linkMatch = clean.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    const name = linkMatch[1]!.trim();
    const url = linkMatch[2]!;
    const idMatch = url.match(/\/(?:myclub|myleague)\/([a-zA-Z0-9_-]+)/);
    return {
      name,
      id: idMatch ? idMatch[1] : undefined,
    };
  }
  return { name: clean };
}

export function parseSportsBulletin(content: string | null | undefined): SportsBulletinData | null {
  if (!content) return null;
  const match = content.match(/<!-- sports-bulletin:([\s\S]*?)-->/);
  if (match) {
    try {
      return JSON.parse(match[1]!) as SportsBulletinData;
    } catch {
      // fall through
    }
  }

  // Detect Champion Bulletin
  const lines = content.split(/\r?\n/);
  const firstLine = lines[0] || "";
  const champHeaderMatch = firstLine.match(
    /^(?:([^\s*]+)\s+)?🏆\s+(?:\*\*)?(.+?)\s+CHAMPION CROWNED!(?:\*\*)?/i
  );
  if (champHeaderMatch) {
    const sportEmoji = champHeaderMatch[1] || "";
    const leagueInfo = cleanNameAndId(champHeaderMatch[2]!);
    const leagueName = leagueInfo.name;
    const leagueId = leagueInfo.id;

    let championName = "";
    let championId = "";
    let llmSummary = "";
    let inSummary = false;
    const summaryLines: string[] = [];

    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (!line || /^═+$/.test(line) || /^---+$/.test(line)) continue;

      const congratMatch = line.match(/Congratulations to\s+(.+?)\s+for winning/i);
      if (congratMatch) {
        const champInfo = cleanNameAndId(congratMatch[1]!);
        championName = champInfo.name;
        championId = champInfo.id || "";
        continue;
      }

      if (line.includes("Season Summary")) {
        inSummary = true;
        continue;
      }

      if (inSummary) {
        summaryLines.push(line);
      }
    }

    if (summaryLines.length > 0) {
      llmSummary = summaryLines.join("\n");
    }

    return {
      league: { name: leagueName, id: leagueId },
      sportEmoji,
      isChampionBulletin: true,
      championName: championName || undefined,
      championId: championId || undefined,
      llmSummary: llmSummary || undefined,
    };
  }

  // Detect Playoff Bulletin
  const playoffHeaderMatch = firstLine.match(
    /^(?:([^\s*]+)\s+)?(?:\*\*)?(.+?)\s+Playoff\s+(.+?)\s+Results(?:\*\*)?/i
  );
  if (playoffHeaderMatch) {
    const sportEmoji = playoffHeaderMatch[1] || "";
    const leagueInfo = cleanNameAndId(playoffHeaderMatch[2]!.replace(/\s+Playoff$/i, "").trim());
    const leagueName = leagueInfo.name;
    const leagueId = leagueInfo.id;
    const roundName = playoffHeaderMatch[3]!;

    const results: SportsBulletinData["results"] = [];
    let llmSummary = "";
    let inSummary = false;
    const summaryLines: string[] = [];

    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (!line || /^═+$/.test(line) || /^---+$/.test(line)) continue;

      if (line.includes("Round Summary") || line.includes("Matchday Summary")) {
        inSummary = true;
        continue;
      }

      if (inSummary) {
        summaryLines.push(line);
        continue;
      }

      // Parse score line
      const scoreRegex = /\s+(\d+)\s*[-–—]\s*(\d+)\s+/;
      const scoreMatch = line.match(scoreRegex);
      if (!scoreMatch) continue;

      const scoreIndex = scoreMatch.index!;
      const scoreLength = scoreMatch[0].length;
      const leftPart = line.substring(0, scoreIndex).trim();
      const rightPart = line.substring(scoreIndex + scoreLength).trim();

      const homeScore = Number(scoreMatch[1]);
      const awayScore = Number(scoreMatch[2]);

      const homeInfo = cleanNameAndId(leftPart);
      const awayInfo = cleanNameAndId(rightPart);

      if (homeInfo.name && awayInfo.name && !Number.isNaN(homeScore) && !Number.isNaN(awayScore)) {
        results.push({
          home: { name: homeInfo.name, id: homeInfo.id },
          away: { name: awayInfo.name, id: awayInfo.id },
          homeScore,
          awayScore,
        });
      }
    }

    if (summaryLines.length > 0) {
      llmSummary = summaryLines.join("\n");
    }

    return {
      league: { name: leagueName, id: leagueId },
      sportEmoji,
      isPlayoffBulletin: true,
      roundName,
      results: results.length > 0 ? results : undefined,
      llmSummary: llmSummary || undefined,
    };
  }

  // Fallback to matchday parser
  return parseMarkdownBulletin(content);
}

/**
 * Reconstruct bulletin data from the deterministic `formatMatchDayBulletin`
 * markdown (header + score lines + optional table movers). ids are unrecoverable
 * from text, so cards from this path render without deep links.
 *
 * ponytail: heuristic text parse; splits scores on the " – " en-dash. Breaks only
 * if a team name literally contains " – " (none do). Marker-encoded posts skip this.
 */
function parseMarkdownBulletin(content: string): SportsBulletinData | null {
  const lines = content.split(/\r?\n/);
  const header = lines[0]?.match(
    /^(?:([^\s*]+)\s+)?(?:\*\*)?([^*]+?)(?:\*\*)?\s+—\s+Matchday\s+(\d+)/
  );
  if (!header) return null;

  const leagueInfo = cleanNameAndId(header[2]!);
  const results: SportsBulletinData["results"] = [];
  const movers: NonNullable<SportsBulletinData["movers"]> = [];
  let inMovers = false;

  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line || /^═+$/.test(line) || /^---+$/.test(line)) continue;
    if (line.includes("Table Movers")) {
      inMovers = true;
      continue;
    }
    if (inMovers) {
      const m = line.match(/^•\s+(.+?)\s+[▲▼]\d+\s+\((\d+)\w+\s+→\s+(\d+)\w+\)/);
      if (m) {
        const moverInfo = cleanNameAndId(m[1]!);
        movers.push({
          name: moverInfo.name,
          id: moverInfo.id,
          oldRank: Number(m[2]),
          newRank: Number(m[3]),
        });
      }
      continue;
    }
    if (line.startsWith("⭐") || line.startsWith("•") || line.startsWith("📝")) continue;

    // Robust score line matching: Home Score - Score Away (supports standard hyphen, en-dash, and em-dash)
    const scoreRegex = /\s+(\d+)\s*[-–—]\s*(\d+)\s+/;
    const scoreMatch = line.match(scoreRegex);
    if (!scoreMatch) continue;

    const scoreIndex = scoreMatch.index!;
    const scoreLength = scoreMatch[0].length;
    const leftPart = line.substring(0, scoreIndex).trim();
    const rightPart = line.substring(scoreIndex + scoreLength).trim();

    const homeScore = Number(scoreMatch[1]);
    const awayScore = Number(scoreMatch[2]);

    const homeInfo = cleanNameAndId(leftPart);
    const awayInfo = cleanNameAndId(rightPart);

    if (Number.isNaN(homeScore) || Number.isNaN(awayScore) || !homeInfo.name || !awayInfo.name)
      continue;
    results.push({
      home: { name: homeInfo.name, id: homeInfo.id },
      away: { name: awayInfo.name, id: awayInfo.id },
      homeScore,
      awayScore,
    });
  }

  if (results.length === 0) return null;
  return {
    league: { name: leagueInfo.name, id: leagueInfo.id },
    sportEmoji: header[1] || "",
    matchDay: Number(header[3]),
    results,
    movers: movers.length > 0 ? movers : undefined,
  };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function formatMatchDayBulletin(args: {
  leagueName: string;
  leagueId?: string;
  sportEmoji: string;
  matchDay: number;
  results: MatchDayResultLine[];
  movers?: StandingMover[];
  llmSummary?: string;
}): string {
  const { leagueName, leagueId, sportEmoji, matchDay, results, movers, llmSummary } = args;

  const leagueFormatted = leagueId ? `[${leagueName}](/myleague/${leagueId})` : leagueName;
  const header = `**${leagueFormatted}** — Matchday ${matchDay}`;

  const matchLines = results.map((r) => {
    const homeNameFormatted = r.homeId ? `[${r.homeName}](/myclub/${r.homeId})` : r.homeName;
    const awayNameFormatted = r.awayId ? `[${r.awayName}](/myclub/${r.awayId})` : r.awayName;

    const homeText = r.homeScore > r.awayScore ? `🏆 **${homeNameFormatted}**` : homeNameFormatted;
    const awayText = r.awayScore > r.homeScore ? `🏆 **${awayNameFormatted}**` : awayNameFormatted;
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
            const moverNameFormatted = m.id ? `[${m.name}](/myclub/${m.id})` : m.name;
            return `• ${moverNameFormatted} ${arrow}${Math.abs(m.oldRank - m.newRank)} (${ordinal(m.oldRank)} → ${ordinal(m.newRank)})`;
          })
          .join("\n")
      : "";

  const summarySection = llmSummary ? `\n\n📝 **Matchday Summary**\n${llmSummary}` : "";

  return `${header}\n\n${matchLines.join("\n")}${upsetSection}${moversSection}${summarySection}`;
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
  leagueId?: string;
  sportEmoji: string;
  championName: string;
  championId?: string;
  llmSummary?: string;
}): string {
  const { leagueName, leagueId, sportEmoji, championName, championId, llmSummary } = args;
  const leagueFormatted = leagueId ? `[${leagueName}](/myleague/${leagueId})` : leagueName;
  const header = `🏆 **${leagueFormatted} CHAMPION CROWNED!**`;
  const championFormatted = championId
    ? `[${championName}](/myclub/${championId})`
    : `**${championName}**`;
  const body = `Congratulations to ${championFormatted} for winning the championship!`;
  const summarySection = llmSummary ? `\n\n📝 **Season Summary**\n${llmSummary}` : "";
  return `${header}\n\n${body}${summarySection}`;
}

/**
 * Format playoff bulletin.
 */
export function formatPlayoffBulletin(args: {
  leagueName: string;
  leagueId?: string;
  sportEmoji: string;
  roundName: string;
  results: MatchDayResultLine[];
  llmSummary?: string;
}): string {
  const { leagueName, leagueId, sportEmoji, roundName, results, llmSummary } = args;
  const leagueFormatted = leagueId ? `[${leagueName}](/myleague/${leagueId})` : leagueName;
  const header = `**${leagueFormatted} Playoff ${roundName} Results**`;
  const matchLines = results.map((r) => {
    const homeNameFormatted = r.homeId ? `[${r.homeName}](/myclub/${r.homeId})` : r.homeName;
    const awayNameFormatted = r.awayId ? `[${r.awayName}](/myclub/${r.awayId})` : r.awayName;

    const homeText = r.homeScore > r.awayScore ? `🏆 **${homeNameFormatted}**` : homeNameFormatted;
    const awayText = r.awayScore > r.homeScore ? `🏆 **${awayNameFormatted}**` : awayNameFormatted;
    return `${homeText} ${r.homeScore} – ${r.awayScore} ${awayText}`;
  });
  const summarySection = llmSummary ? `\n\n📝 **Round Summary**\n${llmSummary}` : "";
  return `${header}\n\n${matchLines.join("\n")}${summarySection}`;
}
