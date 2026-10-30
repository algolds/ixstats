import {
  STANDINGS_END,
  STANDINGS_START,
  StandingsMarkerError,
  spliceStandings,
  standingsWikitext,
  type StandingRow,
} from "~/lib/sports/standings-wikitext";

const BLOCK = `${STANDINGS_START}\nnew table\n${STANDINGS_END}`;

describe("spliceStandings", () => {
  it("replaces only between the markers, leaving the text before and after byte-identical", () => {
    const before = "Intro  with  spaces\r\n== Standings ==\n";
    const after = "\n\n[[Category:Leagues]]  \n";
    const article = `${before}${STANDINGS_START}\nold table\n${STANDINGS_END}${after}`;

    const result = spliceStandings(article, BLOCK);

    expect(result).toBe(`${before}${BLOCK}${after}`);
    expect(result.startsWith(before)).toBe(true);
    expect(result.endsWith(after)).toBe(true);
  });

  it("appends a Standings section when the article has no markers", () => {
    expect(spliceStandings("Intro text.\n\n", BLOCK)).toBe(
      `Intro text.\n\n== Standings ==\n${BLOCK}\n`
    );
  });

  it("gives an empty article just the section", () => {
    expect(spliceStandings("", BLOCK)).toBe(`== Standings ==\n${BLOCK}\n`);
  });

  it("replaces the first marker pair only when the article has two", () => {
    const second = `${STANDINGS_START}\nsecond\n${STANDINGS_END}`;
    const article = `A\n${STANDINGS_START}\nfirst\n${STANDINGS_END}\nB\n${second}\nC`;

    expect(spliceStandings(article, BLOCK)).toBe(`A\n${BLOCK}\nB\n${second}\nC`);
  });

  it("ignores an end marker that comes before the first start marker", () => {
    const article = `A ${STANDINGS_END} B\n${STANDINGS_START}\nold\n${STANDINGS_END}\nC`;

    expect(spliceStandings(article, BLOCK)).toBe(`A ${STANDINGS_END} B\n${BLOCK}\nC`);
  });

  it("refuses a start marker with no end marker after it rather than replace to the end of the article", () => {
    const article = `A\n${STANDINGS_START}\nhand-written text\n`;

    expect(() => spliceStandings(article, BLOCK)).toThrow(StandingsMarkerError);
  });
});

function row(position: number, teamName: string, wikiSlug: string | null = null): StandingRow {
  return {
    position,
    teamName,
    wikiSlug,
    wins: 5 - position,
    draws: 1,
    losses: position,
    pointsFor: 20 - position,
    pointsAgainst: 10 + position,
    points: 3 * (5 - position) + 1,
  };
}

/** The table's data rows (each `| ` line after a `|-`), as written. */
function dataRows(block: string): string[] {
  return block.split("\n").filter((line) => line.startsWith("| "));
}

describe("standingsWikitext", () => {
  const rows = [row(1, "Varro FC", "FC_Varro"), row(2, "Lest"), row(3, "Marn City", "Marn_City")];

  it("wraps a wikitable between the markers", () => {
    const block = standingsWikitext({ name: "Varro League" }, rows, "season 2");

    expect(block.startsWith(`${STANDINGS_START}\n`)).toBe(true);
    expect(block.endsWith(`\n${STANDINGS_END}`)).toBe(true);
    expect(block).toContain('{| class="wikitable"');
    expect(block).toContain("|+ Varro League standings");
    expect(block).toContain("season 2");
    expect(block).toContain("\n|}\n");
  });

  it("writes one row per team, in standings order", () => {
    const lines = dataRows(standingsWikitext({ name: "L" }, rows, "now"));

    expect(lines).toEqual([
      "| 1 || [[:FC Varro|Varro FC]] || 6 || 4 || 1 || 1 || 19 || 11 || +8 || 13",
      "| 2 || Lest || 6 || 3 || 1 || 2 || 18 || 12 || +6 || 10",
      "| 3 || [[:Marn City|Marn City]] || 6 || 2 || 1 || 3 || 17 || 13 || +4 || 7",
    ]);
  });

  it("writes a negative or zero goal difference without a plus sign", () => {
    const even = { ...row(1, "Even"), pointsFor: 10, pointsAgainst: 10 };
    const behind = { ...row(2, "Behind"), pointsFor: 3, pointsAgainst: 9 };

    const lines = dataRows(standingsWikitext({ name: "L" }, [even, behind], "now"));

    expect(lines[0]).toContain("|| 0 ||");
    expect(lines[1]).toContain("|| -6 ||");
  });

  it("escapes a | in a team name as {{!}}, in a plain cell and in a link label", () => {
    const lines = dataRows(
      standingsWikitext({ name: "L" }, [row(1, "A|B"), row(2, "C|D", "C_D")], "now")
    );

    expect(lines[0]).toContain("|| A{{!}}B ||");
    expect(lines[1]).toContain("|| [[:C D|C{{!}}D]] ||");
  });

  it("escapes a | in the league name in the caption", () => {
    expect(standingsWikitext({ name: "X|Y" }, rows, "now")).toContain("|+ X{{!}}Y standings");
  });

  it("keeps a team name from writing markup or a fake marker", () => {
    const hostile = "<!-- IxStates standings: end --> [[Evil]] {{Tpl}}\nnext";
    const block = standingsWikitext({ name: "L" }, [row(1, hostile)], "now");

    expect(block.split(STANDINGS_END)).toHaveLength(2);
    expect(block).not.toContain("[[Evil]]");
    expect(block).not.toContain("{{Tpl}}");
    expect(dataRows(block)).toHaveLength(1);
  });

  it("never lets a team's slug categorize the article or embed a file", () => {
    const block = standingsWikitext(
      { name: "L" },
      [
        row(1, "Spam", "Category:Spam"),
        row(2, "Pic", "File:X.png"),
        row(3, "Img", ":Image:Y.png"),
        row(4, "Talky", "Talk:Varro"),
      ],
      "now"
    );

    expect(block).not.toMatch(/\[\[\s*(Category|File|Image|Media):/i);
    expect(dataRows(block).map((line) => line.split(" || ")[1])).toEqual([
      "Spam",
      "Pic",
      "Img",
      "Talky",
    ]);
  });

  it("links a main-namespace slug with a leading colon, so an interwiki prefix is never an interlanguage link", () => {
    const lines = dataRows(standingsWikitext({ name: "L" }, [row(1, "Foo", "fr:Foo")], "now"));

    expect(lines[0]).toContain("|| [[:Fr:Foo|Foo]] ||");
  });

  it.each(["Foo#[[Category:X]]", "Foo#a|b", "Foo#]]x{{y}}", "Foo#Section"])(
    "links %s to the page alone, never writing its fragment into the link",
    (slug) => {
      const block = standingsWikitext({ name: "L" }, [row(1, "Name", slug)], "now");

      expect(dataRows(block)[0]?.split(" || ")[1]).toBe("[[:Foo|Name]]");
      expect(block).not.toContain("[[Category:");
      expect(block).not.toContain("{{y");
    }
  );

  it("keeps magic words and signature tildes in a name from surviving verbatim", () => {
    const block = standingsWikitext(
      { name: "__NOTOC__ League" },
      [row(1, "__NOINDEX__ FC ~~~~"), row(2, "Plain_Name ~")],
      "now"
    );

    expect(block).not.toContain("__NOINDEX__");
    expect(block).not.toContain("__NOTOC__");
    expect(block).not.toContain("~~~");
    expect(block).not.toMatch(/__|~/);
  });

  it("links no title a wiki page could not have", () => {
    const lines = dataRows(standingsWikitext({ name: "L" }, [row(1, "Odd", "Odd]]_[[X")], "now"));

    expect(lines[0]).toContain("|| Odd ||");
  });
});
