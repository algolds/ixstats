export * from "./rng";
export * from "./elo-calculator";
export * from "./racing-resolver";
export * from "./types";
export * from "./resolvers";
export * from "./tactics";
export * from "./modifiers";

import { createRNG } from "./rng";
import { computeStrength, computeEloDelta } from "./elo-calculator";
import type { TeamRatingVector, ExtendedMatchResult } from "./types";
import { clamp } from "~/lib/utils";
import type { RosterPlayer, SportResolverContext } from "./resolvers";
import {
  runHockeyMatch,
  runBasketballMatch,
  runFootballMatch,
  runBaseballMatch,
  runSoccerMatch,
} from "./resolvers";
import {
  checkCPUTactics,
  applyTactics,
  getTacticalBonus,
  computeAdjustedStrength,
} from "./tactics";
import {
  applyStorytellerModifiers,
  type TeamStorytellerModifiers,
} from "./modifiers";

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

  // 2. Evaluate tactics and apply vectors
  const homeTactical =
    args.homeTacticalIntent ||
    checkCPUTactics(homeTeamModified, awayTeamModified, homeTeamModified.coaching);
  const awayTactical =
    args.awayTacticalIntent ||
    checkCPUTactics(awayTeamModified, homeTeamModified, awayTeamModified.coaching);

  const hTactRes = applyTactics(homeTactical, homeTeamModified.offense, homeTeamModified.defense);
  const aTactRes = applyTactics(awayTactical, awayTeamModified.offense, awayTeamModified.defense);

  let homeOffense = hTactRes.o;
  let homeDefense = hTactRes.d;
  let awayOffense = aTactRes.o;
  let awayDefense = aTactRes.d;
  let baseVariance = 2.0 + hTactRes.vMod + aTactRes.vMod;

  // Apply customizable sliders from lineups
  const hLineup = args.homeLineup ?? {};
  const aLineup = args.awayLineup ?? {};
  const hAttackFocus = typeof hLineup.attackFocus === "number" ? hLineup.attackFocus : 50;
  const hTeamIntensity = typeof hLineup.teamIntensity === "number" ? hLineup.teamIntensity : 50;
  const aAttackFocus = typeof aLineup.attackFocus === "number" ? aLineup.attackFocus : 50;
  const aTeamIntensity = typeof aLineup.teamIntensity === "number" ? aLineup.teamIntensity : 50;

  homeOffense = Math.max(1, Math.min(99, homeOffense + (hAttackFocus - 50) * 0.16));
  homeDefense = Math.max(1, Math.min(99, homeDefense + (50 - hAttackFocus) * 0.16));
  awayOffense = Math.max(1, Math.min(99, awayOffense + (aAttackFocus - 50) * 0.16));
  awayDefense = Math.max(1, Math.min(99, awayDefense + (50 - aAttackFocus) * 0.16));

  baseVariance = Math.max(0.5, baseVariance + (hTeamIntensity - 50) * 0.01 + (aTeamIntensity - 50) * 0.01);

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
  const differential = homeStrength - awayStrength;
  const isHomeFavored = differential >= 0;

  // 3. Dispatch to Sport-Specific Sim Loop
  const resolverCtx: SportResolverContext = {
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
  };

  const outcome =
    args.sport === "hockey"
      ? runHockeyMatch(resolverCtx)
      : args.sport === "basketball"
        ? runBasketballMatch(resolverCtx)
        : args.sport === "football"
          ? runFootballMatch(resolverCtx)
          : args.sport === "baseball"
            ? runBaseballMatch(resolverCtx)
            : runSoccerMatch(resolverCtx);

  const { homeScore, awayScore, trace } = outcome;

  // 4. Determine Winner, ELO Deltas & Evaluation Vector
  let winner: "home" | "away" | "draw" = "draw";
  if (homeScore > awayScore) winner = "home";
  else if (awayScore > homeScore) winner = "away";

  const homeWon = winner === "home";
  const awayWon = winner === "away";
  const isDraw = winner === "draw";
  const upset = isDraw ? Math.abs(differential) > 10 : isHomeFavored ? awayWon : homeWon;

  const isDivineDerby = !!(
    args.homeTeamModifiers?.saintBlessing && args.awayTeamModifiers?.saintBlessing
  );

  const dominance =
    Math.round(
      ((homeOffense + homeDefense) / (homeOffense + homeDefense + awayOffense + awayDefense)) * 100
    ) / 100;
  const tempo = Math.round((baseVariance / 2.0) * 100) / 100;
  const volatility = isDivineDerby
    ? 0.95
    : Math.round((1 - Math.abs(winProbability - 0.5) * 2) * 100) / 100;

  const kFactor = isChampionship ? 32 : isPlayoff ? 24 : 16;
  const homeActual = homeWon ? 1 : isDraw ? 0.5 : 0;
  const awayActual = awayWon ? 1 : isDraw ? 0.5 : 0;

  let ELOFeedbackScale = 1.0;
  if (homeWon && dominance < 0.42) ELOFeedbackScale = 0.7;
  if (awayWon && dominance > 0.58) ELOFeedbackScale = 0.7;

  const rawHomeDelta = computeEloDelta(rawHomeStrength, rawAwayStrength, homeActual, kFactor);
  const rawAwayDelta = computeEloDelta(rawAwayStrength, rawHomeStrength, awayActual, kFactor);

  const homeRatingDelta = Math.round(rawHomeDelta * ELOFeedbackScale * 100) / 100;
  const awayRatingDelta = Math.round(rawAwayDelta * ELOFeedbackScale * 100) / 100;

  return {
    homeScore,
    awayScore,
    winner,
    upset,
    upsetFactor: clamp(Math.abs(differential) / 50, 0, 1),
    keyStats: {
      homeStrength: Math.round(homeStrength * 100) / 100,
      awayStrength: Math.round(awayStrength * 100) / 100,
      differential: Math.round(differential * 100) / 100,
      dominance,
      tempo,
      volatility,
    },
    homeRatingDelta,
    awayRatingDelta,
    evaluation: {
      winProbability: Math.round(winProbability * 100) / 100,
      dominance,
      tempo,
      volatility,
    },
    trace,
  };
}
