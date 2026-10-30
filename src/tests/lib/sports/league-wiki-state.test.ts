import {
  INITIAL_LEAGUE_WIKI,
  leagueWikiReducer,
  type LeagueWikiState,
} from "~/lib/sports/league-wiki-state";

const imported: LeagueWikiState = {
  wikiSlug: "Varro_League",
  teams: [
    { name: "Varro", wikiSlug: "FC_Varro" },
    { name: "Lest", wikiSlug: null },
  ],
};

describe("leagueWikiReducer", () => {
  it("keeps the imported names while the team count still matches them", () => {
    expect(leagueWikiReducer(imported, { type: "teamCountEdited", teamCount: 2 })).toBe(imported);
  });

  it("drops the imported names when the team count is changed by hand", () => {
    expect(leagueWikiReducer(imported, { type: "teamCountEdited", teamCount: 3 })).toEqual({
      wikiSlug: "Varro_League",
      teams: null,
    });
  });

  it("keeps the article when the teams are imported, cleared or the slug edited", () => {
    const withTeams = leagueWikiReducer(
      { ...INITIAL_LEAGUE_WIKI, wikiSlug: "Varro_League" },
      { type: "teamsImported", teams: imported.teams ?? [] }
    );
    expect(withTeams).toEqual(imported);
    expect(leagueWikiReducer(withTeams, { type: "teamsCleared" }).wikiSlug).toBe("Varro_League");
    expect(leagueWikiReducer(withTeams, { type: "slugEdited", wikiSlug: "Other" })).toEqual({
      ...imported,
      wikiSlug: "Other",
    });
  });

  it("resets to nothing", () => {
    expect(leagueWikiReducer(imported, { type: "reset" })).toEqual(INITIAL_LEAGUE_WIKI);
  });
});
