/**
 * Teams named by a league's wiki article. The league creator imports them, so a chartered league starts with its
 * real clubs instead of "<League> Team 1".
 *
 * A teams section (bulleted list or wikitable) is read first; when the article has none, an infobox parameter
 * naming the teams is the fallback. `wikiSlug` is the page title with underscores, the form `SportTeam.wikiSlug`
 * stores and `titleToWikiOSRoute` links.
 */

export interface WikiLeagueTeam {
  name: string;
  wikiSlug: string | null;
}

const TEAMS_WORDS = "teams|clubs|members|participants|franchises";
const SECTION_HEADING = new RegExp(`^==+\\s*(?:${TEAMS_WORDS})\\s*==+`, "im");
const INFOBOX_PARAM = new RegExp(
  `^[ \\t]*\\|[ \\t]*(?:${TEAMS_WORDS})[ \\t]*=([\\s\\S]*?)(?=^[ \\t]*\\||^[ \\t]*\\}\\}|(?![\\s\\S]))`,
  "gim"
);
const HEADING_LEVEL = /^(=+)[^=\n]/;
const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const NON_TEAM_NAMESPACE = /^:?(?:file|image|media|category):/i;
const MAX_NAME_LENGTH = 200;

function stripNoise(wikitext: string): string {
  return wikitext
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
}

/** A page title as a stored slug: trimmed, spaces as underscores; null when empty. */
export function toWikiSlug(title: string | null | undefined): string | null {
  const slug = title?.trim().replace(/\s+/g, "_");
  return slug ? slug : null;
}

function toTeam(target: string, label: string | undefined): WikiLeagueTeam | null {
  const title = target.trim();
  if (!title || NON_TEAM_NAMESPACE.test(title)) return null;
  const name = (label?.trim() || title).slice(0, MAX_NAME_LENGTH);
  return { name, wikiSlug: toWikiSlug(title) };
}

/** Every team link in `text`, in order. */
function allLinks(text: string): WikiLeagueTeam[] {
  return [...text.matchAll(WIKILINK)].flatMap(([, target, label]) => {
    const team = toTeam(target ?? "", label);
    return team ? [team] : [];
  });
}

/** The line's first team link; a line with no link at all is a plain name when it is simple text. */
function bulletTeam(item: string): WikiLeagueTeam | null {
  if (item.includes("[[")) return allLinks(item)[0] ?? null;
  const name = item.replace(/'{2,}/g, "").trim().slice(0, MAX_NAME_LENGTH);
  return name && !/[{}<>|]/.test(name) ? { name, wikiSlug: null } : null;
}

/** The first team link of each wikitable row and each bullet in a section's lines. */
function sectionTeams(lines: string[]): WikiLeagueTeam[] {
  const teams: WikiLeagueTeam[] = [];
  let inTable = false;
  let row: string[] = [];
  const flushRow = () => {
    const first = allLinks(row.join(" "))[0];
    if (first) teams.push(first);
    row = [];
  };
  for (const line of lines) {
    const text = line.trim();
    if (text.startsWith("{|")) {
      inTable = true;
      row = [];
    } else if (text.startsWith("|}")) {
      flushRow();
      inTable = false;
    } else if (inTable && text.startsWith("|-")) {
      flushRow();
    } else if (inTable) {
      if (!text.startsWith("!")) row.push(text);
    } else if (text.startsWith("*")) {
      const team = bulletTeam(text.replace(/^\*+/, ""));
      if (team) teams.push(team);
    }
  }
  return teams;
}

/** The lines under each teams heading, up to the next heading of the same or a higher level. */
function teamsSections(wikitext: string): string[][] {
  const lines = wikitext.split("\n");
  const sections: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!SECTION_HEADING.test(lines[i] ?? "")) continue;
    const level = HEADING_LEVEL.exec(lines[i] ?? "")?.[1]?.length ?? 2;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = HEADING_LEVEL.exec(lines[j] ?? "")?.[1]?.length;
      if (next !== undefined && next <= level) break;
      body.push(lines[j] ?? "");
    }
    sections.push(body);
  }
  return sections;
}

function infoboxTeams(wikitext: string): WikiLeagueTeam[] {
  return [...wikitext.matchAll(INFOBOX_PARAM)].flatMap(([, value]) => allLinks(value ?? ""));
}

function dropDuplicates(teams: WikiLeagueTeam[]): WikiLeagueTeam[] {
  const seen = new Set<string>();
  return teams.filter((team) => {
    const key = (team.wikiSlug ?? team.name).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The teams a league article names, in article order and without duplicates; `[]` when it names none. */
export function extractLeagueTeams(wikitext: string): WikiLeagueTeam[] {
  const clean = stripNoise(wikitext);
  const fromSections = teamsSections(clean).flatMap(sectionTeams);
  return dropDuplicates(fromSections.length > 0 ? fromSections : infoboxTeams(clean));
}
