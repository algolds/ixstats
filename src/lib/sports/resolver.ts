export * from "./rng";
export * from "./elo-calculator";
export * from "./racing-resolver";
export * from "./types";
export * from "./resolvers";
export * from "./tactics";
export * from "./modifiers";

import { createRNG } from "./rng";
import { computeStrength } from "./elo-calculator";
import type { TeamRatingVector, ExtendedMatchResult } from "./types";
import type { RosterPlayer } from "./resolvers";
import {
  checkCPUTactics,
  applyTactics,
  getTacticalBonus,
  computeAdjustedStrength,
} from "./tactics";
import { applyStorytellerModifiers, type TeamStorytellerModifiers } from "./modifiers";
import { applyLineupSliders, buildMatchResult, runSportMatch } from "./match-outcome";

export function resolveMatch(args: {
  sport: string;
  homeTeam: TeamRatingVector;
  awayTeam: TeamRatingVector;
  archetype: string;
  seed: number;
  context?: {
    isPlayoff?: boolean;
    isChampionship?: boolean;
    homeAdvantage?: number;
  };
  homeTacticalIntent?: string;
  awayTacticalIntent?: string;
  homeLineup?: Record<string, unknown>;
  awayLineup?: Record<string, unknown>;
  homeRoster?: RosterPlayer[];
  awayRoster?: RosterPlayer[];
  homeTeamModifiers?: TeamStorytellerModifiers;
  awayTeamModifiers?: TeamStorytellerModifiers;
}): ExtendedMatchResult {
  // 1. Apply Storyteller modifiers to seed and ratings
  const homeMod = applyStorytellerModifiers(args.homeTeam, args.homeTeamModifiers, true);
  const awayMod = applyStorytellerModifiers(args.awayTeam, args.awayTeamModifiers, false);
  const homeTeamModified = homeMod.team;
  const awayTeamModified = awayMod.team;
  const seedAdjustment = homeMod.seedDelta + awayMod.seedDelta;

  const rng = createRNG(args.seed + seedAdjustment);
  const isPlayoff = args.context?.isPlayoff ?? false;
  const isChampionship = args.context?.isChampionship ?? false;

  const homeAdvantageRaw = args.context?.homeAdvantage ?? 55;
  const homeAdvantageAdjustment = (homeAdvantageRaw - 50) / 10;

  // Pre-match win probability
  const rawHomeStrength = computeStrength(homeTeamModified);
  const rawAwayStrength = computeStrength(awayTeamModified);
  const winProbability =
    1 / (1 + Math.pow(10, (rawAwayStrength - (rawHomeStrength + homeAdvantageAdjustment)) / 400));

  // 2. Evaluate tactics and apply vectors, then the customizable lineup sliders
  const homeTactical =
    args.homeTacticalIntent ||
    checkCPUTactics(homeTeamModified, awayTeamModified, homeTeamModified.coaching);
  const awayTactical =
    args.awayTacticalIntent ||
    checkCPUTactics(awayTeamModified, homeTeamModified, awayTeamModified.coaching);

  const ratings = applyLineupSliders(
    applyTactics(homeTactical, homeTeamModified.offense, homeTeamModified.defense),
    applyTactics(awayTactical, awayTeamModified.offense, awayTeamModified.defense),
    args.homeLineup,
    args.awayLineup
  );
  const { homeOffense, homeDefense, awayOffense, awayDefense } = ratings;

  const homeTacticalBonus = getTacticalBonus(homeTactical, awayTactical);
  const awayTacticalBonus = getTacticalBonus(awayTactical, homeTactical);

  const homeStrength =
    computeAdjustedStrength(homeTeamModified, homeOffense, homeDefense, homeTacticalBonus) +
    homeAdvantageAdjustment;
  const awayStrength = computeAdjustedStrength(
    awayTeamModified,
    awayOffense,
    awayDefense,
    awayTacticalBonus
  );

  // 3. Dispatch to Sport-Specific Sim Loop
  const outcome = runSportMatch(args.sport, {
    rng,
    homeOffense,
    homeDefense,
    awayOffense,
    awayDefense,
    homeTactical,
    awayTactical,
    homeTeamModified,
    awayTeamModified,
    isPlayoff,
    isChampionship,
    archetype: args.archetype,
    homeRoster: args.homeRoster,
    awayRoster: args.awayRoster,
  });

  // 4. Determine Winner, ELO Deltas & Evaluation Vector
  return buildMatchResult({
    outcome,
    ratings,
    homeStrength,
    awayStrength,
    rawHomeStrength,
    rawAwayStrength,
    winProbability,
    isPlayoff,
    isChampionship,
    isDivineDerby: !!(
      args.homeTeamModifiers?.saintBlessing && args.awayTeamModifiers?.saintBlessing
    ),
  });
}
