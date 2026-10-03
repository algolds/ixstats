export interface MatchDayResultLine {
  homeName: string;
  homeId?: string;
  awayName: string;
  awayId?: string;
  homeScore: number;
  awayScore: number;
  isUpset?: boolean;
}

export interface StandingMover {
  name: string;
  id?: string;
  oldRank: number;
  newRank: number;
}

/**
 * Structured payload: lets the feed render a rich card with deep links while the markdown body
 * stays intact for Discord mirroring + fallback.
 */
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
  const clean = rawName.replace(/🏆|🛡️|⭐|🏒|⚽|🏀|🏈|⚾|🏎️|🥊|\*\*/g, "").trim();

  const linkMatch = clean.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    const name = linkMatch[1]!.replace(/🏆|🛡️|⭐|🏒|⚽|🏀|🏈|⚾|🏎️|🥊|\*\*/g, "").trim();
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

const isDivider = (line: string) => /^═+$/.test(line) || /^---+$/.test(line);

/** The first of the first three lines that matches `pattern` (bulletins put their header there). */
function findHeader(lines: string[], pattern: RegExp) {
  for (let index = 0; index < Math.min(lines.length, 3); index++) {
    const match = pattern.exec(lines[index]!);
    if (match) return { index, match, text: lines[index]! };
  }
  return null;
}

/** Optional leading sport emoji plus the (possibly linked) league name. */
function extractHeaderInfo(rawLeft: string) {
  let str = rawLeft.trim();
  const emojiMatch = str.match(/^([\u1F300-\u1F9FF\u2600-\u26FF\u2700-\u27BF])\s*/);
  let sportEmoji = "🏆";
  if (emojiMatch) {
    sportEmoji = emojiMatch[1]!;
    str = str.substring(emojiMatch[0].length).trim();
  }
  return { sportEmoji, leagueInfo: cleanNameAndId(str) };
}

type ParsedBulletinLines = string[];

function parseChampionBulletin(lines: ParsedBulletinLines): SportsBulletinData | null {
  const header = findHeader(lines, /CHAMPION CROWNED!/i);
  if (!header) return null;
  const { sportEmoji, leagueInfo } = extractHeaderInfo(
    header.text.substring(0, header.match.index).trim()
  );

  let champion: { name: string; id?: string } | undefined;
  let inSummary = false;
  const summaryLines: string[] = [];
  for (const line of lines.slice(header.index + 1).filter((l) => !isDivider(l))) {
    const congrats = /Congratulations to\s+(.+?)\s+for winning/i.exec(line);
    if (congrats) champion = cleanNameAndId(congrats[1]!);
    else if (line.includes("Season Summary")) inSummary = true;
    else if (inSummary) summaryLines.push(line);
  }

  return {
    league: { name: leagueInfo.name, id: leagueInfo.id },
    sportEmoji,
    isChampionBulletin: true,
    championName: champion?.name || undefined,
    championId: champion?.id || undefined,
    llmSummary: summaryLines.join("\n") || undefined,
  };
}

function parsePlayoffBulletin(lines: ParsedBulletinLines): SportsBulletinData | null {
  const header = findHeader(lines, /\s+Playoff\s+(.+?)\s+Results(?:\*\*)?\s*$/i);
  if (!header) return null;
  const { sportEmoji, leagueInfo } = extractHeaderInfo(
    header.text.substring(0, header.match.index).trim()
  );

  const results: NonNullable<SportsBulletinData["results"]> = [];
  let inSummary = false;
  const summaryLines: string[] = [];
  for (const line of lines.slice(header.index + 1).filter((l) => !isDivider(l))) {
    if (line.includes("Round Summary") || line.includes("Matchday Summary")) inSummary = true;
    else if (inSummary) summaryLines.push(line);
    else {
      const parsed = parseResultLineFromText(line);
      if (parsed) results.push(parsed);
    }
  }

  return {
    league: { name: leagueInfo.name, id: leagueInfo.id },
    sportEmoji,
    isPlayoffBulletin: true,
    roundName: header.match[1]!.trim(),
    results: results.length > 0 ? results : undefined,
    llmSummary: summaryLines.join("\n") || undefined,
  };
}

function parseSingleMatchBulletin(lines: ParsedBulletinLines): SportsBulletinData | null {
  const header = findHeader(lines, /^📢?\s*\[MyLeague Bulletin\]\s*(.*)/i);
  const parsed = header && parseResultLineFromText(header.match[1]!.trim());
  if (!parsed) return null;

  const leagueName = /^(.*?)\s+Team\s+\d+$/i.exec(parsed.home.name)?.[1] ?? "MyLeague";
  return { league: { name: leagueName }, sportEmoji: "⚽", results: [parsed] };
}

function parseMatchdayBulletin(lines: ParsedBulletinLines): SportsBulletinData | null {
  const header = findHeader(lines, /[-–—]\s*Matchday\s+(\d+)/i);
  const rawLeft = header?.text.substring(0, header.match.index).trim();
  if (!header || !rawLeft) return null;

  const { sportEmoji, leagueInfo } = extractHeaderInfo(rawLeft);
  const results: NonNullable<SportsBulletinData["results"]> = [];
  const movers: NonNullable<SportsBulletinData["movers"]> = [];
  let inMovers = false;

  for (const line of lines.slice(header.index + 1).filter((l) => !isDivider(l))) {
    if (line.includes("Table Movers")) {
      inMovers = true;
    } else if (inMovers) {
      const m = line.match(/^(?:•|\*|-)?\s*(.+?)\s+[▲▼]\d+\s+\((\d+)\w*\s*→\s*(\d+)\w*\)/);
      if (m) {
        const { name, id } = cleanNameAndId(m[1]!);
        movers.push({ name, id, oldRank: Number(m[2]), newRank: Number(m[3]) });
      }
    } else {
      const parsed = parseResultLineFromText(line);
      if (parsed) results.push(parsed);
    }
  }

  if (results.length === 0) return null;
  return {
    league: { name: leagueInfo.name, id: leagueInfo.id },
    sportEmoji,
    matchDay: Number(header.match[1]),
    results,
    movers: movers.length > 0 ? movers : undefined,
  };
}

export function parseSportsBulletin(content: string | null | undefined): SportsBulletinData | null {
  if (!content) return null;

  // Primary: the JSON comment marker
  const marker = content.match(/<!-- sports-bulletin:([\s\S]*?)-->/);
  if (marker) {
    try {
      return JSON.parse(marker[1]!) as SportsBulletinData;
    } catch {
      // fall through to the markdown parsers
    }
  }

  // Strip blurb header wrapper if present: [blurb:slug|Title]\n\n...
  const lines = content
    .replace(/^\[blurb:[^\]]+\]\s*/i, "")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  for (const parse of [
    parseChampionBulletin,
    parsePlayoffBulletin,
    parseSingleMatchBulletin,
    parseMatchdayBulletin,
  ]) {
    const data = parse(lines);
    if (data) return data;
  }
  return null;
}

const ORDINAL_SUFFIX = { one: "st", two: "nd", few: "rd", other: "th" } as const;
const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });
export const ordinal = (n: number) =>
  `${n}${ORDINAL_SUFFIX[ordinalRules.select(n) as keyof typeof ORDINAL_SUFFIX]}`;

const leagueLink = (name: string, id?: string) => (id ? `[${name}](/myleague/${id})` : name);
const clubLink = (name: string, id?: string) => (id ? `[${name}](/myclub/${id})` : name);

/** One "🏆 **Winner** 2 – 1 Loser" line per result. */
function resultLines(results: MatchDayResultLine[]) {
  return results.map((r) => {
    const home = clubLink(r.homeName, r.homeId);
    const away = clubLink(r.awayName, r.awayId);
    const homeText = r.homeScore > r.awayScore ? `🏆 **${home}**` : home;
    const awayText = r.awayScore > r.homeScore ? `🏆 **${away}**` : away;
    return `${homeText} ${r.homeScore} – ${r.awayScore} ${awayText}`;
  });
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
  const { leagueName, leagueId, matchDay, results, movers, llmSummary } = args;
  const header = `**${leagueLink(leagueName, leagueId)}** — Matchday ${matchDay}`;

  const upsets = results.filter((r) => r.isUpset);
  const upsetSection =
    upsets.length > 0
      ? `\n\n⭐ **Upsets of the Day**\n` +
        upsets
          .map((u) => {
            const homeWon = u.homeScore > u.awayScore;
            return `• ${homeWon ? u.homeName : u.awayName} defeats ${homeWon ? u.awayName : u.homeName}!`;
          })
          .join("\n")
      : "";

  const moversSection =
    movers && movers.length > 0
      ? `\n\n📈 **Table Movers**\n` +
        movers
          .map((m) => {
            const arrow = m.newRank < m.oldRank ? "▲" : "▼";
            return `• ${clubLink(m.name, m.id)} ${arrow}${Math.abs(m.oldRank - m.newRank)} (${ordinal(m.oldRank)} → ${ordinal(m.newRank)})`;
          })
          .join("\n")
      : "";

  const summarySection = llmSummary ? `\n\n📝 **Matchday Summary**\n${llmSummary}` : "";

  return `${header}\n\n${resultLines(results).join("\n")}${upsetSection}${moversSection}${summarySection}`;
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
    movers: args.movers?.map(({ name, id, oldRank, newRank }) => ({ name, id, oldRank, newRank })),
    llmSummary: args.llmSummary,
  };
}

export function formatSeasonChampionBulletin(args: {
  leagueName: string;
  leagueId?: string;
  sportEmoji: string;
  championName: string;
  championId?: string;
  llmSummary?: string;
}): string {
  const { leagueName, leagueId, championName, championId, llmSummary } = args;
  const header = `🏆 **${leagueLink(leagueName, leagueId)} CHAMPION CROWNED!**`;
  const champion = championId ? clubLink(championName, championId) : `**${championName}**`;
  const summarySection = llmSummary ? `\n\n📝 **Season Summary**\n${llmSummary}` : "";
  return `${header}\n\nCongratulations to ${champion} for winning the championship!${summarySection}`;
}

export function formatPlayoffBulletin(args: {
  leagueName: string;
  leagueId?: string;
  sportEmoji: string;
  roundName: string;
  results: MatchDayResultLine[];
  llmSummary?: string;
}): string {
  const { leagueName, leagueId, roundName, results, llmSummary } = args;
  const header = `**${leagueLink(leagueName, leagueId)} Playoff ${roundName} Results**`;
  const summarySection = llmSummary ? `\n\n📝 **Round Summary**\n${llmSummary}` : "";
  return `${header}\n\n${resultLines(results).join("\n")}${summarySection}`;
}
