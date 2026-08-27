export * from "./rng";
export * from "./elo-calculator";
export * from "./racing-resolver";
export * from "./types";
export * from "./resolvers";

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
  homeLineup?: any;
  awayLineup?: any;
  homeRoster?: RosterPlayer[];
  awayRoster?: RosterPlayer[];
  homeTeamModifiers?: { saintName?: string; saintBlessing?: number; countryScandal?: number };
  awayTeamModifiers?: { saintName?: string; saintBlessing?: number; countryScandal?: number };
}): ExtendedMatchResult {
  // Apply Storyteller modifiers to seed and ratings
  let seedAdjustment = 0;
  const homeTeamModified = { ...args.homeTeam };
  const awayTeamModified = { ...args.awayTeam };

  if (args.homeTeamModifiers?.saintBlessing) {
    homeTeamModified.overall += args.homeTeamModifiers.saintBlessing;
    homeTeamModified.form += args.homeTeamModifiers.saintBlessing * 2;
    seedAdjustment += 1047;
  }
  if (args.homeTeamModifiers?.countryScandal) {
    homeTeamModified.overall -= args.homeTeamModifiers.countryScandal;
    homeTeamModified.form -= args.homeTeamModifiers.countryScandal * 2;
  }

  if (args.awayTeamModifiers?.saintBlessing) {
    awayTeamModified.overall += args.awayTeamModifiers.saintBlessing;
    awayTeamModified.form += args.awayTeamModifiers.saintBlessing * 2;
    seedAdjustment -= 1047;
  }
  if (args.awayTeamModifiers?.countryScandal) {
    awayTeamModified.overall -= args.awayTeamModifiers.countryScandal;
    awayTeamModified.form -= args.awayTeamModifiers.countryScandal * 2;
  }

  const rng = createRNG(args.seed + seedAdjustment);
  const isPlayoff = args.context?.isPlayoff ?? false;
  const isChampionship = args.context?.isChampionship ?? false;

  const homeAdvantageRaw = args.context?.homeAdvantage ?? 55;
  const homeAdvantageAdjustment = (homeAdvantageRaw - 50) / 10;

  // 1. Calculate pre-match win probability
  const rawHomeStrength = computeStrength(homeTeamModified);
  const rawAwayStrength = computeStrength(awayTeamModified);
  const winProbability =
    1 / (1 + Math.pow(10, (rawAwayStrength - (rawHomeStrength + homeAdvantageAdjustment)) / 400));

  // 2. Evaluate and apply tactical intents
  let homeTactical = args.homeTacticalIntent || "neutral";
  let awayTactical = args.awayTacticalIntent || "neutral";

  // CPU Underdog / Coach Auto-Tactic logic
  const checkCPUTactics = (
    team: TeamRatingVector,
    opp: TeamRatingVector,
    coachDevRating = 60
  ): string => {
    const diff = computeStrength(team) - computeStrength(opp);
    if (diff <= -12) {
      return "park_the_bus";
    } else if (diff <= -6) {
      return "counter_attack";
    }
    if (coachDevRating >= 75) {
      return "all_out_attack";
    } else if (coachDevRating <= 45) {
      return "park_the_bus";
    }
    return "neutral";
  };

  if (!args.homeTacticalIntent) {
    homeTactical = checkCPUTactics(homeTeamModified, awayTeamModified, homeTeamModified.coaching);
  }
  if (!args.awayTacticalIntent) {
    awayTactical = checkCPUTactics(awayTeamModified, homeTeamModified, awayTeamModified.coaching);
  }

  // Tactical Vector adjustments
  let homeOffense = homeTeamModified.offense;
  let homeDefense = homeTeamModified.defense;
  let awayOffense = awayTeamModified.offense;
  let awayDefense = awayTeamModified.defense;
  let baseVariance = 2.0;

  const applyTactics = (intent: string, off: number, def: number) => {
    let o = off;
    let d = def;
    let vMod = 0;
    if (intent === "all_out_attack") {
      o = Math.min(99, o + 10);
      d = Math.max(1, d - 12);
      vMod = 0.8;
    } else if (intent === "park_the_bus" || intent === "catenaccio") {
      o = Math.max(1, o - 12);
      d = Math.min(99, d + 15);
      vMod = -1.0;
    } else if (intent === "counter_attack") {
      o = Math.min(99, o + 5);
      d = Math.min(99, d + 5);
    } else if (intent === "tiki_taka") {
      o = Math.min(99, o + 8);
      d = Math.min(99, d + 4);
      vMod = -0.5;
    } else if (intent === "gegenpressing") {
      o = Math.min(99, o + 12);
      d = Math.max(1, d - 5);
      vMod = 0.6;
    } else if (intent === "kick_and_rush") {
      o = Math.min(99, o + 6);
      d = Math.max(1, d - 8);
      vMod = 1.0;
    }
    return { o, d, vMod };
  };

  const hTactRes = applyTactics(homeTactical, homeOffense, homeDefense);
  const aTactRes = applyTactics(awayTactical, awayOffense, awayDefense);

  homeOffense = hTactRes.o;
  homeDefense = hTactRes.d;
  awayOffense = aTactRes.o;
  awayDefense = aTactRes.d;
  baseVariance += hTactRes.vMod + aTactRes.vMod;

  // Apply customizable sliders from lineups
  const hLineup = (args.homeLineup as Record<string, any>) ?? {};
  const aLineup = (args.awayLineup as Record<string, any>) ?? {};
  const hAttackFocus = typeof hLineup.attackFocus === "number" ? hLineup.attackFocus : 50;
  const hTeamIntensity = typeof hLineup.teamIntensity === "number" ? hLineup.teamIntensity : 50;
  const aAttackFocus = typeof aLineup.attackFocus === "number" ? aLineup.attackFocus : 50;
  const aTeamIntensity = typeof aLineup.teamIntensity === "number" ? aLineup.teamIntensity : 50;

  const hOffAdjust = (hAttackFocus - 50) * 0.16;
  const hDefAdjust = (50 - hAttackFocus) * 0.16;
  const aOffAdjust = (aAttackFocus - 50) * 0.16;
  const aDefAdjust = (50 - aAttackFocus) * 0.16;

  homeOffense = Math.max(1, Math.min(99, homeOffense + hOffAdjust));
  homeDefense = Math.max(1, Math.min(99, homeDefense + hDefAdjust));
  awayOffense = Math.max(1, Math.min(99, awayOffense + aOffAdjust));
  awayDefense = Math.max(1, Math.min(99, awayDefense + aDefAdjust));

  baseVariance += (hTeamIntensity - 50) * 0.01 + (aTeamIntensity - 50) * 0.01;
  baseVariance = Math.max(0.5, baseVariance);

  // Rock-Paper-Scissors / tactical counter bonuses
  const getTacticalBonus = (tactical: string, opponentTactical: string): number => {
    const t = tactical === "park_the_bus" ? "catenaccio" : tactical;
    const opp = opponentTactical === "park_the_bus" ? "catenaccio" : opponentTactical;

    if (t === "counter_attack" && opp === "all_out_attack") return 8;
    if (t === "gegenpressing" && opp === "tiki_taka") return 6;
    if (t === "tiki_taka" && opp === "catenaccio") return 6;
    if (t === "catenaccio" && opp === "gegenpressing") return 6;
    if (t === "kick_and_rush" && opp === "catenaccio") return 4;
    if (t === "counter_attack" && opp === "gegenpressing") return 4;
    return 0;
  };

  const homeTacticalBonus = getTacticalBonus(homeTactical, awayTactical);
  const awayTacticalBonus = getTacticalBonus(awayTactical, homeTactical);

  // Recalculate adjusted strengths
  const computeAdjustedStrength = (
    vec: TeamRatingVector,
    off: number,
    def: number,
    bonus: number
  ) => {
    return (
      vec.overall * 0.35 +
      off * 0.2 +
      def * 0.2 +
      vec.form * 0.15 +
      vec.depth * 0.05 +
      vec.coaching * 0.05 +
      bonus
    );
  };

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

  let outcome: { homeScore: number; awayScore: number; trace: any[] };

  if (args.sport === "hockey") {
    outcome = runHockeyMatch(resolverCtx);
  } else if (args.sport === "basketball") {
    outcome = runBasketballMatch(resolverCtx);
  } else if (args.sport === "football") {
    outcome = runFootballMatch(resolverCtx);
  } else if (args.sport === "baseball") {
    outcome = runBaseballMatch(resolverCtx);
  } else {
    outcome = runSoccerMatch(resolverCtx);
  }

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
