import type {
  TeamRatingVector,
  EventTraceStep,
  EvaluationVector,
  ExtendedMatchResult,
} from "../types";

export interface RosterPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  ratings: any;
}

export interface SportResolverContext {
  rng: () => number;
  homeOffense: number;
  homeDefense: number;
  awayOffense: number;
  awayDefense: number;
  homeTactical: string;
  awayTactical: string;
  homeTeamModified: TeamRatingVector;
  awayTeamModified: TeamRatingVector;
  isPlayoff: boolean;
  isChampionship: boolean;
  archetype: string;
  homeRoster?: RosterPlayer[];
  awayRoster?: RosterPlayer[];
}

export interface SportMatchOutcome {
  homeScore: number;
  awayScore: number;
  trace: EventTraceStep[];
}
