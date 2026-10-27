import { computeEloDelta } from "./elo-calculator";
import type { EventTraceStep, ExtendedMatchResult } from "./types";
import { clamp } from "~/lib/utils";
import type { SportMatchOutcome, SportResolverContext } from "./resolvers";
import {
  runHockeyMatch,
  runBasketballMatch,
  runFootballMatch,
  runBaseballMatch,
  runSoccerMatch,
} from "./resolvers";
import type { applyTactics } from "./tactics";

type TacticalVector = ReturnType<typeof applyTactics>;
type Winner = ExtendedMatchResult["winner"];

interface SliderAdjustedRatings {
  homeOffense: number;
  homeDefense: number;
  awayOffense: number;
  awayDefense: number;
  baseVariance: number;
}

interface MatchOutcomeInputs {
  outcome: SportMatchOutcome;
  ratings: SliderAdjustedRatings;
  homeStrength: number;
  awayStrength: number;
  rawHomeStrength: number;
  rawAwayStrength: number;
  winProbability: number;
  isPlayoff: boolean;
  isChampionship: boolean;
  isDivineDerby: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sliderValue(lineup: Record<string, unknown>, key: string): number {
  const value = lineup[key];
  return typeof value === "number" ? value : 50;
}

/**
 * Applies the customizable lineup sliders (attack focus, team intensity) on top of
 * the tactical vectors.
 */
export function applyLineupSliders(
  home: TacticalVector,
  away: TacticalVector,
  homeLineup?: Record<string, unknown>,
  awayLineup?: Record<string, unknown>
): SliderAdjustedRatings {
  const hLineup = homeLineup ?? {};
  const aLineup = awayLineup ?? {};
  const hAttackFocus = sliderValue(hLineup, "attackFocus");
  const hTeamIntensity = sliderValue(hLineup, "teamIntensity");
  const aAttackFocus = sliderValue(aLineup, "attackFocus");
  const aTeamIntensity = sliderValue(aLineup, "teamIntensity");
  const tacticalVariance = 2.0 + home.vMod + away.vMod;

  return {
    homeOffense: Math.max(1, Math.min(99, home.o + (hAttackFocus - 50) * 0.16)),
    homeDefense: Math.max(1, Math.min(99, home.d + (50 - hAttackFocus) * 0.16)),
    awayOffense: Math.max(1, Math.min(99, away.o + (aAttackFocus - 50) * 0.16)),
    awayDefense: Math.max(1, Math.min(99, away.d + (50 - aAttackFocus) * 0.16)),
    baseVariance: Math.max(
      0.5,
      tacticalVariance + (hTeamIntensity - 50) * 0.01 + (aTeamIntensity - 50) * 0.01
    ),
  };
}

/**
 * Dispatches to the sport-specific simulation loop (soccer is the fallback).
 */
export function runSportMatch(sport: string, ctx: SportResolverContext): SportMatchOutcome {
  switch (sport) {
    case "hockey":
      return runHockeyMatch(ctx);
    case "basketball":
      return runBasketballMatch(ctx);
    case "football":
      return runFootballMatch(ctx);
    case "baseball":
      return runBaseballMatch(ctx);
    default:
      return runSoccerMatch(ctx);
  }
}

/** Hockey regulation length; the hockey sim stamps overtime and shootout events after it. */
const HOCKEY_REGULATION_MINUTES = 60;

/**
 * True when a hockey game was decided after regulation (an overtime or shootout goal),
 * read from the resolver's trace. Always false for other sports.
 */
export function decidedAfterRegulation(sport: string, trace: EventTraceStep[]): boolean {
  if (sport !== "hockey") return false;
  return trace.some((step) => step.type === "goal" && step.t > HOCKEY_REGULATION_MINUTES);
}

function determineWinner(homeScore: number, awayScore: number): Winner {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function isUpset(winner: Winner, differential: number): boolean {
  if (winner === "draw") return Math.abs(differential) > 10;
  return differential >= 0 ? winner === "away" : winner === "home";
}

function actualScore(won: boolean, isDraw: boolean): number {
  if (won) return 1;
  return isDraw ? 0.5 : 0;
}

function kFactorFor(isPlayoff: boolean, isChampionship: boolean): number {
  if (isChampionship) return 32;
  return isPlayoff ? 24 : 16;
}

function eloFeedbackScale(winner: Winner, dominance: number): number {
  if (winner === "home" && dominance < 0.42) return 0.7;
  if (winner === "away" && dominance > 0.58) return 0.7;
  return 1.0;
}

function computeDominance(ratings: SliderAdjustedRatings): number {
  const { homeOffense, homeDefense, awayOffense, awayDefense } = ratings;
  return round2(
    (homeOffense + homeDefense) / (homeOffense + homeDefense + awayOffense + awayDefense)
  );
}

/**
 * Determines the winner, ELO deltas and evaluation vector for a simulated match.
 */
export function buildMatchResult(inputs: MatchOutcomeInputs): ExtendedMatchResult {
  const { homeScore, awayScore, trace } = inputs.outcome;
  const differential = inputs.homeStrength - inputs.awayStrength;
  const winner = determineWinner(homeScore, awayScore);
  const isDraw = winner === "draw";

  const dominance = computeDominance(inputs.ratings);
  const tempo = round2(inputs.ratings.baseVariance / 2.0);
  const volatility = inputs.isDivineDerby
    ? 0.95
    : round2(1 - Math.abs(inputs.winProbability - 0.5) * 2);

  const kFactor = kFactorFor(inputs.isPlayoff, inputs.isChampionship);
  const homeActual = actualScore(winner === "home", isDraw);
  const awayActual = actualScore(winner === "away", isDraw);
  const scale = eloFeedbackScale(winner, dominance);
  const { rawHomeStrength, rawAwayStrength } = inputs;
  const rawHomeDelta = computeEloDelta(rawHomeStrength, rawAwayStrength, homeActual, kFactor);
  const rawAwayDelta = computeEloDelta(rawAwayStrength, rawHomeStrength, awayActual, kFactor);

  return {
    homeScore,
    awayScore,
    winner,
    upset: isUpset(winner, differential),
    upsetFactor: clamp(Math.abs(differential) / 50, 0, 1),
    keyStats: {
      homeStrength: round2(inputs.homeStrength),
      awayStrength: round2(inputs.awayStrength),
      differential: round2(differential),
      dominance,
      tempo,
      volatility,
    },
    homeRatingDelta: round2(rawHomeDelta * scale),
    awayRatingDelta: round2(rawAwayDelta * scale),
    evaluation: {
      winProbability: round2(inputs.winProbability),
      dominance,
      tempo,
      volatility,
    },
    trace,
  };
}
