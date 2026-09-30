/**
 * Canonical Sports Domain Contracts & Focus Architecture
 * Based on the Unified MySports PRD (mysports-v0.md)
 */

export type SportsFocusType = "competition" | "organization" | "athlete" | "match";

export interface SportsFocus {
  type: SportsFocusType;
  id: string;
  extra?: Record<string, string>;
}

export type FocusResolutionState =
  | "VALID"
  | "NOT_FOUND"
  | "INVALID_CONTEXT"
  | "UNAUTHORIZED"
  | "MALFORMED";

/**
 * Parses a focus parameter string such as "athlete:cm34xabc" or "organization:org123"
 */
export function parseSportsFocus(param: string | null | undefined): SportsFocus | null {
  if (!param || typeof param !== "string") return null;
  const parts = param.split(":");
  if (parts.length < 2) return null;

  const type = parts[0]?.toLowerCase();
  const id = parts[1];

  if (!id) return null;

  if (type === "competition" || type === "organization" || type === "athlete" || type === "match") {
    return {
      type: type as SportsFocusType,
      id,
    };
  }

  return null;
}

/**
 * Serializes a SportsFocus object to a URL search parameter string.
 */
export function serializeSportsFocus(focus: SportsFocus | null | undefined): string | null {
  if (!focus?.type || !focus?.id) return null;
  return `${focus.type}:${focus.id}`;
}

export interface CompetitionEntity {
  id: string;
  name: string;
  sportPreset: string;
  archetype: string;
  teamCount: number;
  seasonCount: number;
  status: "active" | "paused" | "completed" | "archived";
  logo?: string | null;
  coverImage?: string | null;
  isCanonical?: boolean;
}

export interface OrganizationEntity {
  id: string;
  name: string;
  shortName?: string | null;
  city?: string | null;
  color?: string | null;
  logo?: string | null;
  leagueId: string;
  leagueName?: string | null;
  sportPreset?: string | null;
  budget?: number | null;
  ownerUserId?: string | null;
}

export interface AthleteEntity {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overallRating: number;
  potential?: number | null;
  teamId?: string | null;
  teamName?: string | null;
  ratings?: Record<string, number> | null;
  morale?: number;
  form?: number;
  salary?: number;
  contractYears?: number;
  careerStage?: "rookie" | "prime" | "veteran" | "declining" | "retired";
}

export interface MatchEntity {
  id: string;
  seasonId: string;
  matchDay: number;
  status: "scheduled" | "in_progress" | "completed" | "postponed";
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeColor?: string | null;
  awayColor?: string | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  scheduledIxTime?: number | null;
}

export interface CanonicalMatchEvent {
  id: string;
  matchId: string;
  minute: number;
  type: "goal" | "yellow_card" | "red_card" | "substitution" | "injury" | "point" | "knockdown" | "pitstop";
  teamId: string;
  primaryAthleteId?: string;
  secondaryAthleteId?: string;
  primaryAthleteName?: string;
  secondaryAthleteName?: string;
  narrative?: string;
  metadata?: Record<string, unknown>;
}
