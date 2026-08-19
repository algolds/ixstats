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
