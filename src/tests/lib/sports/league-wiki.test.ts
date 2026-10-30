import { extractLeagueTeams } from "~/lib/sports/league-wiki";

describe("extractLeagueTeams", () => {
  it("reads a bulleted list under a Teams section, naming the team by its label", () => {
    const wikitext = [
      "Intro text with [[Somewhere]].",
      "== Teams ==",
      "* [[FC Varro|Varro]]",
      "* [[Dinamo Lest]]",
      "== History ==",
      "* [[Not A Team]]",
    ].join("\n");

    expect(extractLeagueTeams(wikitext)).toEqual([
      { name: "Varro", wikiSlug: "FC_Varro" },
      { name: "Dinamo Lest", wikiSlug: "Dinamo_Lest" },
    ]);
  });

  it("takes the first wikilink of each wikitable row under a Clubs section", () => {
    const wikitext = [
      "== Clubs ==",
      '{| class="wikitable"',
      "! Club !! City",
      "|-",
      "| [[Aster FC]] || [[Marn]]",
      "|-",
      "| [[Borra United|Borra]]",
      "| [[Cask]]",
      "|}",
    ].join("\n");

    expect(extractLeagueTeams(wikitext)).toEqual([
      { name: "Aster FC", wikiSlug: "Aster_FC" },
      { name: "Borra", wikiSlug: "Borra_United" },
    ]);
  });

  it("ends a section at the next heading of the same or a higher level but keeps its subsections", () => {
    const wikitext = [
      "=== Members ===",
      "* [[A]]",
      "==== Founders ====",
      "* [[B]]",
      "=== Rules ===",
      "* [[C]]",
    ].join("\n");

    expect(extractLeagueTeams(wikitext).map((t) => t.name)).toEqual(["A", "B"]);
  });

  it("falls back to an infobox teams parameter when no section matches", () => {
    const wikitext = [
      "{{Infobox league",
      "| name = The League",
      "| teams = [[A]], [[B|Bee]]<br>[[C#History|Cee]]",
      "| founded = 1990",
      "}}",
      "== History ==",
      "* [[D]]",
    ].join("\n");

    expect(extractLeagueTeams(wikitext)).toEqual([
      { name: "A", wikiSlug: "A" },
      { name: "Bee", wikiSlug: "B" },
      { name: "Cee", wikiSlug: "C" },
    ]);
  });

  it("drops duplicates and keeps the order of first appearance", () => {
    const wikitext = ["== Teams ==", "* [[B]]", "* [[A]]", "* [[b|Bee again]]", "* [[A]]"].join(
      "\n"
    );

    expect(extractLeagueTeams(wikitext).map((t) => t.name)).toEqual(["B", "A"]);
  });

  it("ignores File and Category links, references and comments", () => {
    const wikitext = [
      "== Teams ==",
      "* [[File:Crest.png|20px]] [[Real FC]]<ref>[[Source page]]</ref>",
      "<!-- * [[Hidden FC]] -->",
      "* [[Category:Teams]]",
      "* [[:Category:Other]]",
      "* [[Image:Old.png]]",
    ].join("\n");

    expect(extractLeagueTeams(wikitext)).toEqual([{ name: "Real FC", wikiSlug: "Real_FC" }]);
  });

  it("keeps a plain bulleted name with no slug", () => {
    expect(extractLeagueTeams("== Teams ==\n* Plain Town\n* [[Linked]]")).toEqual([
      { name: "Plain Town", wikiSlug: null },
      { name: "Linked", wikiSlug: "Linked" },
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(extractLeagueTeams("Just a [[Page]] about nothing.")).toEqual([]);
    expect(extractLeagueTeams("")).toEqual([]);
  });
});
