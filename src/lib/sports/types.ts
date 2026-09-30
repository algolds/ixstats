/**
 * Core Types & Interfaces for Sports Engine (MyLeague)
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { CareerStage } from "./talent";

export type PrismaContext =
  | PrismaClient
  | Prisma.TransactionClient
  | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface AgingPlayerRecord {
  id: string;
  age: number;
  careerStage: CareerStage;
  ratings: Record<string, number>;
  contractYears: number;
  salary: number;
}

export interface AgingCoachRecord {
  id: string;
  age: number;
  careerStage: CareerStage;
  ratings: Record<string, number>;
  contractYears: number;
  salary: number;
}

export interface StandingRecord {
  id?: string;
  teamId: string;
  seasonId?: string;
  division?: string | null;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  rank?: number;
}

export interface TeamRecord {
  id: string;
  name: string;
  nationId?: string | null;
  leagueId: string;
  division?: string | null;
  players?: AgingPlayerRecord[];
  coaches?: AgingCoachRecord[];
}

export type MatchSimulationEvent =
  | { type: "goal"; minute: number; teamId: string; playerId: string; assistPlayerId?: string }
  | { type: "yellow_card"; minute: number; teamId: string; playerId: string }
  | { type: "red_card"; minute: number; teamId: string; playerId: string }
  | {
      type: "substitution";
      minute: number;
      teamId: string;
      playerInId: string;
      playerOutId: string;
    }
  | {
      type: "injury";
      minute: number;
      teamId: string;
      playerId: string;
      severity: "minor" | "moderate" | "severe";
    };

export interface TeamRatingVector {
  overall: number;
  offense: number;
  defense: number;
  form: number;
  depth: number;
  coaching: number;
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
  upset: boolean;
  upsetFactor: number;
  keyStats: Record<string, number>;
  homeRatingDelta: number;
  awayRatingDelta: number;
}

export interface EventTraceStep {
  t: number;
  type: "goal" | "card" | "injury" | "tactic_shift";
  description: string;
  actorId?: string;
  actorName?: string;
  team: "home" | "away";
}

export interface PlayerRatings {
  overall?: number;
  offense?: number;
  defense?: number;
  stamina?: number;
  speed?: number;
  pace?: number;
  consistency?: number;
  wetSkill?: number;
  overtaking?: number;
  tyreManagement?: number;
  starts?: number;
  power?: number;
  technique?: number;
  chin?: number;
  heart?: number;
  cuts?: number;
  shooting?: number;
  playmaking?: number;
  rebounding?: number;
  skating?: number;
  goaltending?: number;
  hitting?: number;
  passing?: number;
  rushing?: number;
  catching?: number;
  tackling?: number;
  coverage?: number;
  kicking?: number;
  batting?: number;
  pitching?: number;
  fielding?: number;
  running?: number;
  form?: number;
  injuredUntil?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  [key: string]: number | undefined;
}

export interface PlayerTraits {
  clutch?: boolean;
  injuryProne?: boolean;
  leader?: boolean;
  fanFavorite?: boolean;
  hotHeaded?: boolean;
  ironMan?: boolean;
  [key: string]: boolean | string | number | undefined;
}

export interface CoachRatings {
  strategy: number;
  development: number;
  motivation: number;
  adaptability: number;
  [key: string]: number;
}

export interface TeamLineup {
  starters?: string[];
  captainId?: string | null;
  formation?: string;
  attackFocus?: number;
  teamIntensity?: number;
  [key: string]: unknown;
}

export interface TeamSponsor {
  type?: string;
  name?: string;
  baseFee?: number;
  winBonus?: number;
  description?: string;
  tier?: "local" | "national" | "global";
  contractExpiresSeason?: number;
  [key: string]: unknown;
}

export interface MatchStatsPayload {
  homeShots?: number;
  awayShots?: number;
  homePossession?: number;
  awayPossession?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  homePenalties?: number;
  awayPenalties?: number;
  events?: MatchSimulationEvent[];
  [key: string]: unknown;
}

export interface RaceGridEntry {
  driverId: string;
  teamId: string;
  position: number;
  qualifyingTime?: number;
}

export interface RaceResultEntry {
  driverId: string;
  driverName?: string;
  teamId: string;
  teamName?: string;
  position: number;
  points: number;
  status: "finished" | "dnf" | "dsq";
  gap?: string;
  fastestLap?: boolean;
}

export interface LeagueSettingsPayload {
  playoffFormat?: string;
  playoffTeams?: number;
  relegationCount?: number;
  promotionCount?: number;
  draftRounds?: number;
  seasonLength?: number;
  hasOvertime?: boolean;
  hasShootout?: boolean;
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  [key: string]: unknown;
}

export interface EvaluationVector {
  winProbability: number;
  dominance: number;
  tempo: number;
  volatility: number;
}

export interface ExtendedMatchResult extends MatchResult {
  evaluation: EvaluationVector;
  trace: EventTraceStep[];
}

