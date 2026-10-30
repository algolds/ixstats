/**
 * The league creator's wiki step: the league's wiki article and the teams imported from it. Imported names only
 * make sense for the team count they were imported at, so any other count drops them.
 */
import type { WikiLeagueTeam } from "./league-wiki";

export interface LeagueWikiState {
  wikiSlug: string;
  teams: WikiLeagueTeam[] | null;
}

export type LeagueWikiAction =
  | { type: "slugEdited"; wikiSlug: string }
  | { type: "teamsImported"; teams: WikiLeagueTeam[] }
  | { type: "teamCountEdited"; teamCount: number }
  | { type: "teamsCleared" }
  | { type: "reset" };

export const INITIAL_LEAGUE_WIKI: LeagueWikiState = { wikiSlug: "", teams: null };

export function leagueWikiReducer(
  state: LeagueWikiState,
  action: LeagueWikiAction
): LeagueWikiState {
  switch (action.type) {
    case "slugEdited":
      return { ...state, wikiSlug: action.wikiSlug };
    case "teamsImported":
      return { ...state, teams: action.teams };
    case "teamCountEdited":
      return state.teams && state.teams.length !== action.teamCount
        ? { ...state, teams: null }
        : state;
    case "teamsCleared":
      return { ...state, teams: null };
    case "reset":
      return INITIAL_LEAGUE_WIKI;
  }
}
