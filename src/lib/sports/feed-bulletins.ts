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
  let clean = rawName
    .replace(/🏆|🛡️|⭐|🏒|⚽|🏀|🏈|⚾|🏎️|🥊|\*\*/g, "")
    .trim();

  const linkMatch = clean.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    const name = linkMatch[1]!
      .replace(/🏆|🛡️|⭐|🏒|⚽|🏀|🏈|⚾|🏎️|🥊|\*\*/g, "")
      .trim();
    const url = linkMatch[2]!;
    const idMatch = url.match(/\/(?:myclub|myleague)\/([a-zA-Z0-9_-]+)/);
    return {
      name,
      id: idMatch ? idMatch[1] : undefined,
    };
  }
  return { name: clean };
}

/**
 * Parse a single result line using dash-relative score extraction.
 * Guarantees correct home/away scores even when team names contain digits (e.g. "Imperial League Team 11").
 */
function parseResultLineFromText(line: string): {
  home: { name: string; id?: string };
  away: { name: string; id?: string };
  homeScore: number;
  awayScore: number;
  isUpset?: boolean;
} | null {
  const dashMatch = line.match(/(.*?)\b(\d+)\s*[-–—]\s*(\d+)\b(.*)/);
  if (!dashMatch) return null;

  const leftPart = dashMatch[1]!.trim();
  const homeScore = Number(dashMatch[2]);
  const awayScore = Number(dashMatch[3]);
  const rightPart = dashMatch[4]!.trim();

  const homeInfo = cleanNameAndId(leftPart);
  const awayInfo = cleanNameAndId(rightPart);

  if (!homeInfo.name || !awayInfo.name || Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    return null;
  }

  const isUpset = line.includes("⭐") || leftPart.includes("🏆") || rightPart.includes("🏆");

  return {
    home: {
      name: homeInfo.name,
      ...(homeInfo.id ? { id: homeInfo.id } : {}),
    },
    away: {
      name: awayInfo.name,
      ...(awayInfo.id ? { id: awayInfo.id } : {}),
    },
    homeScore,
    awayScore,
    ...(isUpset ? { isUpset: true } : {}),
  };
}

export function parseSportsBulletin(content: string | null | undefined): SportsBulletinData | null {
  if (!content) return null;

  // 1. Primary: JSON comment marker
  const match = content.match(/<!-- sports-bulletin:([\s\S]*?)-->/);
  if (match) {
    try {
      return JSON.parse(match[1]!) as SportsBulletinData;
    } catch {
      // fall through
    }
  }

  // Strip blurb header wrapper if present: [blurb:slug|Title]\n\n...
  const cleanStr = content.replace(/^\[blurb:[^\]]+\]\s*/i, "").trim();

  const lines = cleanStr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Helper to extract optional leading emoji and clean league name
  const extractHeaderInfo = (rawLeft: string) => {
    let str = rawLeft.trim();
    const emojiMatch = str.match(/^([\u1F300-\u1F9FF\u2600-\u26FF\u2700-\u27BF])\s*/);
    let sportEmoji = "🏆";
    if (emojiMatch) {
      sportEmoji = emojiMatch[1]!;
      str = str.substring(emojiMatch[0].length).trim();
    }
    const leagueInfo = cleanNameAndId(str);
    return { sportEmoji, leagueInfo };
  };

  // 2. Detect Champion Bulletin: line containing "CHAMPION CROWNED!"
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i]!;
    const champMatch = line.match(/\s+CHAMPION CROWNED!\s*$/i) || line.match(/CHAMPION CROWNED!/i);
    if (champMatch) {
      const rawLeft = line.substring(0, champMatch.index).trim();
      const { sportEmoji, leagueInfo } = extractHeaderInfo(rawLeft);

      let championName = "";
      let championId = "";
      let llmSummary = "";
      let inSummary = false;
      const summaryLines: string[] = [];

      for (const rawLine of lines.slice(i + 1)) {
        if (!rawLine || /^═+$/.test(rawLine) || /^---+$/.test(rawLine)) continue;

        const congratMatch = rawLine.match(/Congratulations to\s+(.+?)\s+for winning/i);
        if (congratMatch) {
          const champInfo = cleanNameAndId(congratMatch[1]!);
          championName = champInfo.name;
          championId = champInfo.id || "";
          continue;
        }

        if (rawLine.includes("Season Summary")) {
          inSummary = true;
          continue;
        }

        if (inSummary) {
          summaryLines.push(rawLine);
        }
      }

      if (summaryLines.length > 0) {
        llmSummary = summaryLines.join("\n");
      }

      return {
        league: { name: leagueInfo.name, id: leagueInfo.id },
        sportEmoji,
        isChampionBulletin: true,
        championName: championName || undefined,
        championId: championId || undefined,
        llmSummary: llmSummary || undefined,
      };
    }
  }

  // 3. Detect Playoff Bulletin: line containing "Playoff <Round> Results"
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i]!;
    const playoffMatch = line.match(/\s+Playoff\s+(.+?)\s+Results(?:\*\*)?\s*$/i);
    if (playoffMatch) {
      const roundName = playoffMatch[1]!.trim();
      const rawLeft = line.substring(0, playoffMatch.index).trim();
      const { sportEmoji, leagueInfo } = extractHeaderInfo(rawLeft);

      const results: SportsBulletinData["results"] = [];
      let llmSummary = "";
      let inSummary = false;
      const summaryLines: string[] = [];

      for (const rawLine of lines.slice(i + 1)) {
        if (!rawLine || /^═+$/.test(rawLine) || /^---+$/.test(rawLine)) continue;

        if (rawLine.includes("Round Summary") || rawLine.includes("Matchday Summary")) {
          inSummary = true;
          continue;
        }

        if (inSummary) {
          summaryLines.push(rawLine);
          continue;
        }

        const parsedLine = parseResultLineFromText(rawLine);
        if (parsedLine) {
          results.push(parsedLine);
        }
      }

      if (summaryLines.length > 0) {
        llmSummary = summaryLines.join("\n");
      }

      return {
        league: { name: leagueInfo.name, id: leagueInfo.id },
        sportEmoji,
        isPlayoffBulletin: true,
        roundName,
        results: results.length > 0 ? results : undefined,
        llmSummary: llmSummary || undefined,
      };
    }
  }

  // 4. Single Match Bulletin: line containing "📢 [MyLeague Bulletin]"
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i]!;
    const singleMatch = line.match(/^📢?\s*\[MyLeague Bulletin\]\s*(.*)/i);
    if (singleMatch) {
      const resultText = singleMatch[1]!.trim();
      const parsedLine = parseResultLineFromText(resultText);
      if (parsedLine) {
        let leagueName = "MyLeague";
        const homeName = parsedLine.home.name;
        const leagueMatch = homeName.match(/^(.*?)\s+Team\s+\d+$/i);
        if (leagueMatch) {
          leagueName = leagueMatch[1]!;
        }

        return {
          league: { name: leagueName },
          sportEmoji: "⚽",
          results: [parsedLine],
        };
      }
    }
  }

  // 5. Fallback: Matchday Bulletin
  return parseMarkdownBulletin(lines, extractHeaderInfo);
}

function parseMarkdownBulletin(
  lines: string[],
  extractHeaderInfo: (rawLeft: string) => { sportEmoji: string; leagueInfo: { name: string; id?: string } }
): SportsBulletinData | null {
  let matchdayMatchIndex = -1;
  let matchDay = 0;
  let rawLeft = "";

  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i]!;
    const m = line.match(/[-–—]\s*Matchday\s+(\d+)/i);
    if (m) {
      matchdayMatchIndex = i;
      matchDay = Number(m[1]);
      rawLeft = line.substring(0, m.index).trim();
      break;
    }
  }

  if (matchdayMatchIndex === -1 || !rawLeft) return null;

  const { sportEmoji, leagueInfo } = extractHeaderInfo(rawLeft);
  const results: SportsBulletinData["results"] = [];
  const movers: NonNullable<SportsBulletinData["movers"]> = [];
  let inMovers = false;

  for (const line of lines.slice(matchdayMatchIndex + 1)) {
    if (/^═+$/.test(line) || /^---+$/.test(line)) continue;
    if (line.includes("Table Movers")) {
      inMovers = true;
      continue;
    }
    if (inMovers) {
      const m = line.match(/^(?:•|\*|-)?\s*(.+?)\s+[▲▼]\d+\s+\((\d+)\w*\s*→\s*(\d+)\w*\)/);
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

    const parsedLine = parseResultLineFromText(line);
    if (parsedLine) {
      results.push(parsedLine);
    }
  }

  if (results.length === 0) return null;
  return {
    league: { name: leagueInfo.name, id: leagueInfo.id },
    sportEmoji,
    matchDay,
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
