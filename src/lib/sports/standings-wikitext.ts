/**
 * A league's standings as wikitext, for "Publish to wiki" on the league page. The table lives between two HTML
 * comment markers in the league's IxWiki article, so a publish replaces only its own block and never the text an
 * editor wrote around it.
 */

export const STANDINGS_START = "<!-- IxStates standings: start -->";
export const STANDINGS_END = "<!-- IxStates standings: end -->";

/** One team's line, in standings order. `wikiSlug` is the team's page title with underscores, or null. */
export interface StandingRow {
  position: number;
  teamName: string;
  wikiSlug: string | null;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
}

/** The article has a start marker with no end marker after it: replacing would run to the end of the article. */
export class StandingsMarkerError extends Error {
  constructor() {
    super("The article has a standings start marker with no end marker after it.");
    this.name = "StandingsMarkerError";
  }
}

const ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "[": "&#91;",
  "]": "&#93;",
  "{": "&#123;",
  "}": "&#125;",
};

/**
 * A name as plain table text: no markup (links, templates, tags or a comment that could fake a marker), one line,
 * and `|` as `{{!}}` so it cannot end the cell.
 */
function plainText(name: string): string {
  return name
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>[\]{}]/g, (ch) => ENTITIES[ch] ?? ch)
    .replace(/\|/g, "{{!}}");
}

/** Characters a MediaWiki title cannot hold: a slug with one is not linked. */
const INVALID_TITLE = /[<>[\]{}|\r\n]/;

function teamCell(row: StandingRow): string {
  const name = plainText(row.teamName);
  const slug = row.wikiSlug?.trim();
  return slug && !INVALID_TITLE.test(slug) ? `[[${slug}|${name}]]` : name;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function rowLine(row: StandingRow): string {
  const played = row.wins + row.draws + row.losses;
  return [
    row.position,
    teamCell(row),
    played,
    row.wins,
    row.draws,
    row.losses,
    row.pointsFor,
    row.pointsAgainst,
    signed(row.pointsFor - row.pointsAgainst),
    row.points,
  ].join(" || ");
}

/** The standings block, markers included: a note naming when it is from, then one table row per team. */
export function standingsWikitext(
  league: { name: string },
  rows: StandingRow[],
  asOf: string
): string {
  return [
    STANDINGS_START,
    `''Standings as of ${plainText(asOf)}, published from IxStates.''`,
    '{| class="wikitable"',
    `|+ ${plainText(league.name)} standings`,
    "! Pos !! Team !! GP !! W !! D !! L !! PF !! PA !! Diff !! Pts",
    ...rows.flatMap((row) => ["|-", `| ${rowLine(row)}`]),
    "|}",
    STANDINGS_END,
  ].join("\n");
}

/**
 * `article` with `block` in place of its first marked standings block (everything else byte-identical), or, when it
 * has none, with a `== Standings ==` section holding `block` appended. Throws `StandingsMarkerError` for a start marker
 * with no end marker after it.
 */
export function spliceStandings(article: string, block: string): string {
  const start = article.indexOf(STANDINGS_START);
  if (start === -1) {
    const body = article.trimEnd();
    return `${body}${body ? "\n\n" : ""}== Standings ==\n${block}\n`;
  }
  const end = article.indexOf(STANDINGS_END, start + STANDINGS_START.length);
  if (end === -1) throw new StandingsMarkerError();
  return article.slice(0, start) + block + article.slice(end + STANDINGS_END.length);
}
