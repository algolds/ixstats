export * from "./rng";
export * from "./elo-calculator";
export * from "./racing-resolver";
export * from "./types";

import { createRNG } from "./rng";
import { computeStrength, computeEloDelta } from "./elo-calculator";
import type { MatchResult, TeamRatingVector } from "./types";
import { clamp } from "~/lib/utils";


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

function getPlayerOverall(p: any): number {
  const ratings = p?.ratings;
  if (!ratings) return 50;
  if (typeof ratings.overall === "number") return ratings.overall;
  const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
  if (values.length === 0) return 50;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function extractHockeyLines(roster: any[] | undefined, defaultRating: number) {
  const playersByPos: Record<string, any[]> = { G: [], D: [], C: [], LW: [], RW: [] };
  if (roster) {
    for (const p of roster) {
      const pos = p.position?.toUpperCase();
      if (playersByPos[pos]) {
        playersByPos[pos].push(p);
      }
    }
  }

  // Sort by overall desc
  for (const pos of Object.keys(playersByPos)) {
    playersByPos[pos].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
  }

  const getPlayerOrFallback = (pos: string, index: number) => {
    const list = playersByPos[pos];
    if (list && list[index]) return list[index];
    if (list && list[0]) return list[0];
    if (roster && roster[0]) return roster[0];
    return {
      ratings: {
        overall: defaultRating,
        offense: defaultRating,
        defense: defaultRating,
        skating: defaultRating,
        positioning: defaultRating,
        reflexes: defaultRating,
      },
    };
  };

  const l1_c = getPlayerOrFallback("C", 0);
  const l1_lw = getPlayerOrFallback("LW", 0);
  const l1_rw = getPlayerOrFallback("RW", 0);
  const l1_d1 = getPlayerOrFallback("D", 0);
  const l1_d2 = getPlayerOrFallback("D", 1);

  const l2_c = getPlayerOrFallback("C", 1);
  const l2_lw = getPlayerOrFallback("LW", 1);
  const l2_rw = getPlayerOrFallback("RW", 1);
  const l2_d1 = getPlayerOrFallback("D", 2);
  const l2_d2 = getPlayerOrFallback("D", 3);

  const goalie = getPlayerOrFallback("G", 0);

  const computeAvgAttr = (players: any[], attrs: string[]) => {
    let sum = 0;
    let count = 0;
    for (const p of players) {
      const r = p.ratings || {};
      for (const a of attrs) {
        if (typeof r[a] === "number") {
          sum += r[a];
          count++;
        }
      }
    }
    return count > 0 ? sum / count : defaultRating;
  };

  const l1_off = computeAvgAttr([l1_c, l1_lw, l1_rw], ["shooting", "passing", "skating"]);
  const l1_def = computeAvgAttr([l1_d1, l1_d2], ["checking", "positioning", "physical"]);

  const l2_off = computeAvgAttr([l2_c, l2_lw, l2_rw], ["shooting", "passing", "skating"]);
  const l2_def = computeAvgAttr([l2_d1, l2_d2], ["checking", "positioning", "physical"]);

  const goalie_def = computeAvgAttr([goalie], ["reflexes", "positioning"]);

  return {
    line1: { offense: l1_off, defense: l1_def },
    line2: { offense: l2_off, defense: l2_def },
    goalie: { defense: goalie_def },
  };
}

function extractBasketballRoster(roster: any[] | undefined, defaultRating: number) {
  const playersByPos: Record<string, any[]> = { PG: [], SG: [], SF: [], PF: [], C: [] };
  if (roster) {
    for (const p of roster) {
      const pos = p.position?.toUpperCase();
      if (playersByPos[pos]) {
        playersByPos[pos].push(p);
      }
    }
  }

  const getPlayerOrFallback = (pos: string, idx: number) => {
    const list = playersByPos[pos] || [];
    if (list[idx]) return list[idx];
    if (list[0]) return list[0];
    if (roster && roster[0]) return roster[0];
    return {
      id: `fallback_${pos}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: { overall: defaultRating, offense: defaultRating, defense: defaultRating },
    };
  };

  return {
    pg: getPlayerOrFallback("PG", 0),
    sg: getPlayerOrFallback("SG", 0),
    sf: getPlayerOrFallback("SF", 0),
    pf: getPlayerOrFallback("PF", 0),
    c: getPlayerOrFallback("C", 0),
  };
}

function extractFootballRoster(roster: any[] | undefined, defaultRating: number) {
  const getPlayerOrFallback = (pos: string) => {
    const found = roster?.find((p) => p.position?.toUpperCase() === pos);
    if (found) return found;
    return {
      id: `fallback_${pos}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: { overall: defaultRating, offense: defaultRating, defense: defaultRating },
    };
  };

  return {
    qb: getPlayerOrFallback("QB"),
    rb: getPlayerOrFallback("RB"),
    wr: getPlayerOrFallback("WR"),
    te: getPlayerOrFallback("TE"),
    k: getPlayerOrFallback("K"),
    p: getPlayerOrFallback("P"),
  };
}

function extractBaseballRoster(roster: any[] | undefined, defaultRating: number) {
  const getPlayerOrFallback = (pos: string) => {
    const found = roster?.find((p) => p.position?.toUpperCase() === pos);
    if (found) return found;
    return {
      id: `fallback_${pos}`,
      firstName: "Fallback",
      lastName: pos,
      position: pos,
      ratings: { overall: defaultRating, offense: defaultRating, defense: defaultRating },
    };
  };

  return {
    sp: getPlayerOrFallback("SP"),
    rp: getPlayerOrFallback("RP"),
    cp: getPlayerOrFallback("CP"),
    c: getPlayerOrFallback("C"),
  };
}

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
  homeRoster?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    ratings: any;
  }>;
  awayRoster?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    ratings: any;
  }>;
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

  // 3. Chronological Trace Simulation
  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const getRosterPlayerByRoleWeight = (roster: any[] | undefined, defaultName: string) => {
    if (!roster || roster.length === 0) return { id: "generic", name: defaultName };
    const weights = roster.map((p) => {
      const pos = p.position.toUpperCase();
      if (["ST", "W", "AM", "QB", "RB", "WR", "C", "LW", "RW", "SG", "SF", "FIGHTER"].includes(pos))
        return 60;
      if (["CM", "TE", "OL", "PG", "PF"].includes(pos)) return 30;
      return 10;
    });

    const sum = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * sum;
    for (let i = 0; i < roster.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return { id: roster[i].id, name: `${roster[i].firstName} ${roster[i].lastName}` };
      }
    }
    return { id: roster[0].id, name: `${roster[0].firstName} ${roster[0].lastName}` };
  };

  const getCardPlayerWeight = (roster: any[] | undefined) => {
    if (!roster || roster.length === 0) return null;
    const weights = roster.map((p) => {
      const pos = p.position.toUpperCase();
      if (["GK", "CB", "FB", "DL", "LB", "CB", "S", "D", "G", "PF", "C"].includes(pos)) return 50;
      return 20;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * sum;
    for (let i = 0; i < roster.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return { id: roster[i].id, name: `${roster[i].firstName} ${roster[i].lastName}` };
      }
    }
    return { id: roster[0].id, name: `${roster[0].firstName} ${roster[0].lastName}` };
  };

  // Saint blessing / Scandal logs at start of match
  if (args.homeTeamModifiers?.saintBlessing && args.homeTeamModifiers?.saintName) {
    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Ceremonial: The home crowd echoes the Invocation of ${args.homeTeamModifiers.saintName}. Blessings descend upon the pitch!`,
      team: "home",
    });
  }
  if (args.awayTeamModifiers?.saintBlessing && args.awayTeamModifiers?.saintName) {
    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Ceremonial: The away crowd echoes the Invocation of ${args.awayTeamModifiers.saintName}. Blessings descend upon the pitch!`,
      team: "away",
    });
  }

  const isDivineDerby = !!(
    args.homeTeamModifiers?.saintBlessing && args.awayTeamModifiers?.saintBlessing
  );
  if (isDivineDerby) {
    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Divine Derby: Both clubs carry saintly blessings! Expect extreme match volatility.`,
      team: "home",
    });
  }

  if (args.sport === "hockey") {
    // ─── Ice Hockey Sim Loop ───
    const homeLines = extractHockeyLines(args.homeRoster, homeOffense);
    const awayLines = extractHockeyLines(args.awayRoster, awayOffense);

    let homePowerPlayMins = 0;
    let awayPowerPlayMins = 0;
    let homeGoaliePulled = false;
    let awayGoaliePulled = false;

    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Match begins. Home team using ${homeTactical.replace(/_/g, " ")} tactics. Away team using ${awayTactical.replace(/_/g, " ")} tactics.`,
      team: "home",
    });

    for (let t = 5; t <= 60; t += 5) {
      if (homePowerPlayMins > 0) homePowerPlayMins = Math.max(0, homePowerPlayMins - 5);
      if (awayPowerPlayMins > 0) awayPowerPlayMins = Math.max(0, awayPowerPlayMins - 5);

      const homeLineActive = rng() < 0.6 ? 1 : 2;
      const awayLineActive = rng() < 0.6 ? 1 : 2;

      // Minor penalty (8% chance) -> Power play
      if (rng() < 0.08) {
        const penalizedTeam = rng() < 0.5 ? "home" : "away";
        if (penalizedTeam === "home") {
          awayPowerPlayMins = 2;
          const player = getCardPlayerWeight(args.homeRoster);
          trace.push({
            t,
            type: "card",
            description: `PENALTY: ${player ? player.name : "Home player"} gets 2 mins for slashing. Away Power Play!`,
            actorId: player?.id,
            actorName: player?.name,
            team: "home",
          });
        } else {
          homePowerPlayMins = 2;
          const player = getCardPlayerWeight(args.awayRoster);
          trace.push({
            t,
            type: "card",
            description: `PENALTY: ${player ? player.name : "Away player"} gets 2 mins for hooking. Home Power Play!`,
            actorId: player?.id,
            actorName: player?.name,
            team: "away",
          });
        }
      }

      // Fight major event (5% chance)
      if (rng() < 0.05) {
        const playerH = getCardPlayerWeight(args.homeRoster);
        const playerA = getCardPlayerWeight(args.awayRoster);
        trace.push({
          t,
          type: "injury",
          description: `FIGHT MAJOR: ${playerH ? playerH.name : "Home player"} and ${playerA ? playerA.name : "Away player"} assess 5 mins for fighting.`,
          actorId: playerH?.id,
          actorName: playerH?.name,
          team: "home",
        });
      }

      // Goalie Pulling at t >= 58
      if (t >= 55) {
        if (homeScore > awayScore && homeScore - awayScore <= 2 && !awayGoaliePulled) {
          awayGoaliePulled = true;
          trace.push({
            t,
            type: "tactic_shift",
            description: `TACTIC SHIFT: Away goalie pulled for an extra attacker!`,
            team: "away",
          });
        } else if (awayScore > homeScore && awayScore - homeScore <= 2 && !homeGoaliePulled) {
          homeGoaliePulled = true;
          trace.push({
            t,
            type: "tactic_shift",
            description: `TACTIC SHIFT: Home goalie pulled for an extra attacker!`,
            team: "home",
          });
        }
      }

      // Compute ratings for this shift
      let hOff = homeLineActive === 1 ? homeLines.line1.offense : homeLines.line2.offense;
      let hDef = homeLineActive === 1 ? homeLines.line1.defense : homeLines.line2.defense;
      let aOff = awayLineActive === 1 ? awayLines.line1.offense : awayLines.line2.offense;
      let aDef = awayLineActive === 1 ? awayLines.line1.defense : awayLines.line2.defense;

      if (awayPowerPlayMins > 0) {
        aOff += 10;
        hDef -= 8;
      }
      if (homePowerPlayMins > 0) {
        hOff += 10;
        aDef -= 8;
      }

      if (homeGoaliePulled) {
        hOff += 15;
      } else {
        hDef = (hDef + homeLines.goalie.defense) / 2;
      }

      if (awayGoaliePulled) {
        aOff += 15;
      } else {
        aDef = (aDef + awayLines.goalie.defense) / 2;
      }

      let homeGoalProb = (hOff / (hOff + aDef)) * 0.18;
      let awayGoalProb = (aOff / (aOff + hDef)) * 0.18;

      if (homeGoaliePulled) awayGoalProb += 0.2;
      if (awayGoaliePulled) homeGoalProb += 0.2;

      if (rng() < homeGoalProb) {
        homeScore++;
        const scorer = getRosterPlayerByRoleWeight(args.homeRoster, "Home Attacker");
        trace.push({
          t,
          type: "goal",
          description: `GOAL! ${scorer.name} fires a shot past the goalie!${awayGoaliePulled ? " (Empty Net)" : ""}`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "home",
        });
      }

      if (rng() < awayGoalProb) {
        awayScore++;
        const scorer = getRosterPlayerByRoleWeight(args.awayRoster, "Away Attacker");
        trace.push({
          t,
          type: "goal",
          description: `GOAL! ${scorer.name} scores for the away team!${homeGoaliePulled ? " (Empty Net)" : ""}`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "away",
        });
      }
    }

    // Overtime sudden death if tied
    if (homeScore === awayScore) {
      trace.push({
        t: 60,
        type: "tactic_shift",
        description: `END OF REGULATION: Tied at ${homeScore}-${awayScore}. Proceeding to 3-on-3 Overtime.`,
        team: "home",
      });

      const otOffenseHome = homeOffense + 20;
      const otDefenseAway = awayDefense - 10;
      const otOffenseAway = awayOffense + 20;
      const otDefenseHome = homeDefense - 10;

      const otHomeGoalProb = (otOffenseHome / (otOffenseHome + otDefenseAway)) * 0.3;
      const otAwayGoalProb = (otOffenseAway / (otOffenseAway + otDefenseHome)) * 0.3;

      if (rng() < otHomeGoalProb) {
        homeScore++;
        const scorer = getRosterPlayerByRoleWeight(args.homeRoster, "Home Attacker");
        trace.push({
          t: 65,
          type: "goal",
          description: `OT GOAL! ${scorer.name} scores the sudden death winner!`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "home",
        });
      } else if (rng() < otAwayGoalProb) {
        awayScore++;
        const scorer = getRosterPlayerByRoleWeight(args.awayRoster, "Away Attacker");
        trace.push({
          t: 65,
          type: "goal",
          description: `OT GOAL! ${scorer.name} scores the sudden death winner!`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "away",
        });
      }
    }

    // Shootout if still tied after OT
    if (homeScore === awayScore) {
      trace.push({
        t: 65,
        type: "tactic_shift",
        description: `OT OVER: Still tied. Proceeding to Shootout!`,
        team: "home",
      });

      let homeShootoutGoals = 0;
      let awayShootoutGoals = 0;

      for (let round = 1; round <= 3; round++) {
        const homeShooter = getRosterPlayerByRoleWeight(args.homeRoster, `Home Shooter ${round}`);
        const homeShooterRating = args.homeRoster
          ? getPlayerOverall(args.homeRoster.find((p) => p.id === homeShooter.id))
          : 65;
        const awayGoalieOverall = awayLines.goalie.defense;
        const homeProb = homeShooterRating / (homeShooterRating + awayGoalieOverall);

        if (rng() < homeProb * 0.7) {
          homeShootoutGoals++;
          trace.push({
            t: 65 + round,
            type: "goal",
            description: `SHOOTOUT: ${homeShooter.name} scores for the home team!`,
            actorId: homeShooter.id,
            actorName: homeShooter.name,
            team: "home",
          });
        } else {
          trace.push({
            t: 65 + round,
            type: "card",
            description: `SHOOTOUT: ${homeShooter.name} is stopped.`,
            actorId: homeShooter.id,
            actorName: homeShooter.name,
            team: "home",
          });
        }

        const awayShooter = getRosterPlayerByRoleWeight(args.awayRoster, `Away Shooter ${round}`);
        const awayShooterRating = args.awayRoster
          ? getPlayerOverall(args.awayRoster.find((p) => p.id === awayShooter.id))
          : 65;
        const homeGoalieOverall = homeLines.goalie.defense;
        const awayProb = awayShooterRating / (awayShooterRating + homeGoalieOverall);

        if (rng() < awayProb * 0.7) {
          awayShootoutGoals++;
          trace.push({
            t: 65 + round,
            type: "goal",
            description: `SHOOTOUT: ${awayShooter.name} scores for the away team!`,
            actorId: awayShooter.id,
            actorName: awayShooter.name,
            team: "away",
          });
        } else {
          trace.push({
            t: 65 + round,
            type: "card",
            description: `SHOOTOUT: ${awayShooter.name} is stopped.`,
            actorId: awayShooter.id,
            actorName: awayShooter.name,
            team: "away",
          });
        }
      }

      let sdRound = 4;
      while (homeShootoutGoals === awayShootoutGoals && sdRound < 10) {
        const homeShooter = getRosterPlayerByRoleWeight(args.homeRoster, `Home Shooter ${sdRound}`);
        const homeShooterRating = args.homeRoster
          ? getPlayerOverall(args.homeRoster.find((p) => p.id === homeShooter.id))
          : 65;
        const awayGoalieOverall = awayLines.goalie.defense;
        const homeProb = homeShooterRating / (homeShooterRating + awayGoalieOverall);
        const homeScores = rng() < homeProb * 0.7;

        const awayShooter = getRosterPlayerByRoleWeight(args.awayRoster, `Away Shooter ${sdRound}`);
        const awayShooterRating = args.awayRoster
          ? getPlayerOverall(args.awayRoster.find((p) => p.id === awayShooter.id))
          : 65;
        const homeGoalieOverall = homeLines.goalie.defense;
        const awayProb = awayShooterRating / (awayShooterRating + homeGoalieOverall);
        const awayScores = rng() < awayProb * 0.7;

        if (homeScores) homeShootoutGoals++;
        if (awayScores) awayShootoutGoals++;

        trace.push({
          t: 65 + sdRound,
          type: "tactic_shift",
          description: `SHOOTOUT sudden death R${sdRound - 3}: Home ${homeScores ? "SCORES" : "MISSES"} | Away ${awayScores ? "SCORES" : "MISSES"}`,
          team: "home",
        });

        sdRound++;
      }

      if (homeShootoutGoals > awayShootoutGoals) {
        homeScore++;
        trace.push({
          t: 75,
          type: "goal",
          description: `Home team wins the shootout ${homeShootoutGoals}-${awayShootoutGoals}!`,
          team: "home",
        });
      } else {
        awayScore++;
        trace.push({
          t: 75,
          type: "goal",
          description: `Away team wins the shootout ${awayShootoutGoals}-${homeShootoutGoals}!`,
          team: "away",
        });
      }
    }
  } else if (args.sport === "basketball") {
    // ─── Basketball Sim Loop ───
    const homeLine = extractBasketballRoster(args.homeRoster, homeOffense);
    const awayLine = extractBasketballRoster(args.awayRoster, awayOffense);

    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Tip-off! Match begins. Home: PG ${homeLine.pg.firstName} ${homeLine.pg.lastName} | Away: PG ${awayLine.pg.firstName} ${awayLine.pg.lastName}.`,
      team: "home",
    });

    const quarters = [1, 2, 3, 4];
    const quarterNames = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];

    // Track team fouls per quarter
    let homeTeamFouls = 0;
    let awayTeamFouls = 0;

    const runFreeThrows = (shooter: any, team: "home" | "away", count: number): number => {
      let made = 0;
      const ftProb = clamp(0.75 + (getPlayerOverall(shooter) - 65) / 300, 0.45, 0.95);
      for (let i = 0; i < count; i++) {
        if (rng() < ftProb) {
          made++;
        }
      }
      return made;
    };

    for (const q of quarters) {
      const startT = (q - 1) * 12;
      const endT = q * 12;

      homeTeamFouls = 0;
      awayTeamFouls = 0;

      trace.push({
        t: startT,
        type: "tactic_shift",
        description: `Start of the ${quarterNames[q - 1]}.`,
        team: "home",
      });

      const possessionsPerQuarter = 24;
      for (let pos = 1; pos <= possessionsPerQuarter; pos++) {
        const posTime = startT + Math.round((pos / possessionsPerQuarter) * 11);
        const secondVal = Math.floor(rng() * 60);
        const timeString = `${posTime}:${secondVal < 10 ? "0" : ""}${secondVal}`;

        // Home Possession
        {
          const turnoverRoll = rng();
          const toChance = 0.12 - homeTeamModified.coaching / 1000;
          if (turnoverRoll < toChance) {
            const homeTurnoverPlayer = getRosterPlayerByRoleWeight(args.homeRoster, "Home Player");
            const awayStealPlayer = getCardPlayerWeight(args.awayRoster);
            if (rng() < 0.5 && awayStealPlayer) {
              trace.push({
                t: posTime,
                type: "card",
                description: `[Q${q} ${timeString}] Steal! ${awayStealPlayer.name} intercepts a pass from ${homeTurnoverPlayer.name}.`,
                actorId: awayStealPlayer.id,
                actorName: awayStealPlayer.name,
                team: "away",
              });
            } else {
              trace.push({
                t: posTime,
                type: "card",
                description: `[Q${q} ${timeString}] Turnover: ${homeTurnoverPlayer.name} commits a bad pass out of bounds.`,
                actorId: homeTurnoverPlayer.id,
                actorName: homeTurnoverPlayer.name,
                team: "home",
              });
            }
          } else {
            const players = [homeLine.pg, homeLine.sg, homeLine.sf, homeLine.pf, homeLine.c];
            const usageWeights = [0.25, 0.25, 0.2, 0.15, 0.15];
            let usageRoll = rng();
            let shooter = players[0];
            for (let i = 0; i < players.length; i++) {
              usageRoll -= usageWeights[i];
              if (usageRoll <= 0) {
                shooter = players[i];
                break;
              }
            }

            const isThree = rng() < 0.35;
            const baseProb = isThree ? 0.35 : 0.47;
            const diffMod = (homeOffense - awayDefense) / 300;
            const shootProb = baseProb + diffMod;

            // Shooting foul check (12% on 2pt, 6% on 3pt)
            const isFouled = rng() < (isThree ? 0.06 : 0.12);

            if (isFouled) {
              awayTeamFouls++;
              const isMade = rng() < shootProb;
              const shooterName = `${shooter.firstName} ${shooter.lastName}`;
              if (isMade) {
                const points = isThree ? 3 : 2;
                homeScore += points;
                const ftMade = runFreeThrows(shooter, "home", 1);
                homeScore += ftMade;
                trace.push({
                  t: posTime,
                  type: "goal",
                  description: `[Q${q} ${timeString}] BASKET & ONE! ${shooterName} scores a ${points}pt shot and is fouled. FT: ${ftMade ? "GOOD" : "MISSED"}. Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: shooter.id,
                  actorName: shooterName,
                  team: "home",
                });
              } else {
                const ftCount = isThree ? 3 : 2;
                const ftsMade = runFreeThrows(shooter, "home", ftCount);
                homeScore += ftsMade;
                trace.push({
                  t: posTime,
                  type: "goal",
                  description: `[Q${q} ${timeString}] FOUL on the shot! ${shooterName} is fouled while shooting. FTs: ${ftsMade}/${ftCount}. Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: shooter.id,
                  actorName: shooterName,
                  team: "home",
                });
              }
            } else {
              if (rng() < shootProb) {
                const points = isThree ? 3 : 2;
                homeScore += points;
                trace.push({
                  t: posTime,
                  type: "goal",
                  description: `[Q${q} ${timeString}] BASKET! ${shooter.firstName} ${shooter.lastName} hits a ${isThree ? "three-pointer" : "mid-range jumper"}. Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: shooter.id,
                  actorName: `${shooter.firstName} ${shooter.lastName}`,
                  team: "home",
                });
              } else {
                const reboundRoll = rng();
                if (reboundRoll < 0.25) {
                  const reber = getRosterPlayerByRoleWeight(args.homeRoster, "Home Rebounder");
                  trace.push({
                    t: posTime,
                    type: "tactic_shift",
                    description: `[Q${q} ${timeString}] Offensive Rebound secured by ${reber.name}.`,
                    actorId: reber.id,
                    actorName: reber.name,
                    team: "home",
                  });
                  if (rng() < 0.45) {
                    homeScore += 2;
                    trace.push({
                      t: posTime,
                      type: "goal",
                      description: `[Q${q} ${timeString}] BASKET! ${reber.name} scores on a quick putback! Score: Home ${homeScore} - Away ${awayScore}`,
                      actorId: reber.id,
                      actorName: reber.name,
                      team: "home",
                    });
                  }
                }
              }
            }
          }
        }

        // Away Possession
        {
          const turnoverRoll = rng();
          const toChance = 0.12 - awayTeamModified.coaching / 1000;
          if (turnoverRoll < toChance) {
            const awayTurnoverPlayer = getRosterPlayerByRoleWeight(args.awayRoster, "Away Player");
            const homeStealPlayer = getCardPlayerWeight(args.homeRoster);
            if (rng() < 0.5 && homeStealPlayer) {
              trace.push({
                t: posTime,
                type: "card",
                description: `[Q${q} ${timeString}] Steal! ${homeStealPlayer.name} intercepts a pass from ${awayTurnoverPlayer.name}.`,
                actorId: homeStealPlayer.id,
                actorName: homeStealPlayer.name,
                team: "home",
              });
            } else {
              trace.push({
                t: posTime,
                type: "card",
                description: `[Q${q} ${timeString}] Turnover: ${awayTurnoverPlayer.name} commits a bad pass out of bounds.`,
                actorId: awayTurnoverPlayer.id,
                actorName: awayTurnoverPlayer.name,
                team: "away",
              });
            }
          } else {
            const players = [awayLine.pg, awayLine.sg, awayLine.sf, awayLine.pf, awayLine.c];
            const usageWeights = [0.25, 0.25, 0.2, 0.15, 0.15];
            let usageRoll = rng();
            let shooter = players[0];
            for (let i = 0; i < players.length; i++) {
              usageRoll -= usageWeights[i];
              if (usageRoll <= 0) {
                shooter = players[i];
                break;
              }
            }

            const isThree = rng() < 0.35;
            const baseProb = isThree ? 0.35 : 0.47;
            const diffMod = (awayOffense - homeDefense) / 300;
            const shootProb = baseProb + diffMod;

            // Shooting foul check (12% on 2pt, 6% on 3pt)
            const isFouled = rng() < (isThree ? 0.06 : 0.12);

            if (isFouled) {
              homeTeamFouls++;
              const isMade = rng() < shootProb;
              const shooterName = `${shooter.firstName} ${shooter.lastName}`;
              if (isMade) {
                const points = isThree ? 3 : 2;
                awayScore += points;
                const ftMade = runFreeThrows(shooter, "away", 1);
                awayScore += ftMade;
                trace.push({
                  t: posTime,
                  type: "goal",
                  description: `[Q${q} ${timeString}] BASKET & ONE! ${shooterName} scores a ${points}pt shot and is fouled. FT: ${ftMade ? "GOOD" : "MISSED"}. Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: shooter.id,
                  actorName: shooterName,
                  team: "away",
                });
              } else {
                const ftCount = isThree ? 3 : 2;
                const ftsMade = runFreeThrows(shooter, "away", ftCount);
                awayScore += ftsMade;
                trace.push({
                  t: posTime,
                  type: "goal",
                  description: `[Q${q} ${timeString}] FOUL on the shot! ${shooterName} is fouled while shooting. FTs: ${ftsMade}/${ftCount}. Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: shooter.id,
                  actorName: shooterName,
                  team: "away",
                });
              }
            } else {
              if (rng() < shootProb) {
                const points = isThree ? 3 : 2;
                awayScore += points;
                trace.push({
                  t: posTime,
                  type: "goal",
                  description: `[Q${q} ${timeString}] BASKET! ${shooter.firstName} ${shooter.lastName} hits a ${isThree ? "three-pointer" : "mid-range jumper"}. Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: shooter.id,
                  actorName: `${shooter.firstName} ${shooter.lastName}`,
                  team: "away",
                });
              } else {
                const reboundRoll = rng();
                if (reboundRoll < 0.25) {
                  const reber = getRosterPlayerByRoleWeight(args.awayRoster, "Away Rebounder");
                  trace.push({
                    t: posTime,
                    type: "tactic_shift",
                    description: `[Q${q} ${timeString}] Offensive Rebound secured by ${reber.name}.`,
                    actorId: reber.id,
                    actorName: reber.name,
                    team: "away",
                  });
                  if (rng() < 0.45) {
                    awayScore += 2;
                    trace.push({
                      t: posTime,
                      type: "goal",
                      description: `[Q${q} ${timeString}] BASKET! ${reber.name} scores on a quick putback! Score: Home ${homeScore} - Away ${awayScore}`,
                      actorId: reber.id,
                      actorName: reber.name,
                      team: "away",
                    });
                  }
                }
              }
            }
          }
        }
      }

      trace.push({
        t: endT,
        type: "tactic_shift",
        description: `End of the ${quarterNames[q - 1]}. Current Score: Home ${homeScore} - Away ${awayScore}`,
        team: "home",
      });
    }

    // Overtime if tied
    let otCount = 0;
    while (homeScore === awayScore && otCount < 5) {
      otCount++;
      const otTime = 48 + otCount * 5;
      trace.push({
        t: otTime - 5,
        type: "tactic_shift",
        description: `END OF REGULATION/OT: Tied at ${homeScore}-${awayScore}. Proceeding to 5-minute Overtime (OT ${otCount}).`,
        team: "home",
      });

      // Sim 10 possessions in OT
      for (let pos = 1; pos <= 10; pos++) {
        const team = pos % 2 === 0 ? "home" : "away";
        const offRatings = team === "home" ? homeTeamModified : awayTeamModified;
        const defRatings = team === "home" ? awayTeamModified : homeTeamModified;
        const offLine = team === "home" ? homeLine : awayLine;
        const offOffense = team === "home" ? homeOffense : awayOffense;
        const defDefense = team === "home" ? awayDefense : homeDefense;

        if (rng() < 0.1) {
          // Turnover
          const toPlayer = getRosterPlayerByRoleWeight(
            team === "home" ? args.homeRoster : args.awayRoster,
            `${team === "home" ? "Home" : "Away"} Player`
          );
          trace.push({
            t: otTime,
            type: "card",
            description: `[OT ${otCount}] Turnover: ${toPlayer.name} loses possession.`,
            actorId: toPlayer.id,
            actorName: toPlayer.name,
            team,
          });
        } else {
          // Shot
          const players = [offLine.pg, offLine.sg, offLine.sf, offLine.pf, offLine.c];
          const usageWeights = [0.25, 0.25, 0.2, 0.15, 0.15];
          let usageRoll = rng();
          let shooter = players[0];
          for (let i = 0; i < players.length; i++) {
            usageRoll -= usageWeights[i];
            if (usageRoll <= 0) {
              shooter = players[i];
              break;
            }
          }

          const isThree = rng() < 0.35;
          const baseProb = isThree ? 0.35 : 0.47;
          const diffMod = (offOffense - defDefense) / 300;
          const shootProb = baseProb + diffMod;
          const isFouled = rng() < 0.1;

          if (isFouled) {
            const ftsMade = runFreeThrows(shooter, team, isThree ? 3 : 2);
            if (team === "home") homeScore += ftsMade;
            else awayScore += ftsMade;
            trace.push({
              t: otTime,
              type: "goal",
              description: `[OT ${otCount}] Shooting Foul! ${shooter.firstName} ${shooter.lastName} shoots free throws: ${ftsMade}/${isThree ? 3 : 2}. Score: Home ${homeScore} - Away ${awayScore}`,
              actorId: shooter.id,
              actorName: `${shooter.firstName} ` + shooter.lastName,
              team,
            });
          } else if (rng() < shootProb) {
            const points = isThree ? 3 : 2;
            if (team === "home") homeScore += points;
            else awayScore += points;
            trace.push({
              t: otTime,
              type: "goal",
              description: `[OT ${otCount}] BASKET! ${shooter.firstName} ${shooter.lastName} hits a ${points}pt shot. Score: Home ${homeScore} - Away ${awayScore}`,
              actorId: shooter.id,
              actorName: `${shooter.firstName} ${shooter.lastName}`,
              team,
            });
          }
        }
      }
    }
  } else if (args.sport === "football") {
    // ─── American Football Sim Loop ───
    const homeLine = extractFootballRoster(args.homeRoster, homeOffense);
    const awayLine = extractFootballRoster(args.awayRoster, awayOffense);

    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Kickoff! Match begins. Home QB: ${homeLine.qb.firstName} ${homeLine.qb.lastName} | Away QB: ${awayLine.qb.firstName} ${awayLine.qb.lastName}.`,
      team: "home",
    });

    const quarters = [1, 2, 3, 4];
    const quarterNames = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];

    let possession: "home" | "away" = rng() < 0.5 ? "home" : "away";
    let yardline = 25;

    const runDrive = (
      q: number,
      timeString: string,
      driveTime: number
    ): { finished: boolean; scoringPlay: "td" | "fg" | "none" | "turnover" } => {
      let down = 1;
      let yardsToGo = 10;
      let driveFinished = false;
      let scoringPlay: "td" | "fg" | "none" | "turnover" = "none";

      const offTeam = possession;
      const defTeam = possession === "home" ? "away" : "home";
      const offRatings = offTeam === "home" ? homeTeamModified : awayTeamModified;
      const defRatings = defTeam === "home" ? homeTeamModified : awayTeamModified;
      const offQB = offTeam === "home" ? homeLine.qb : awayLine.qb;
      const offRB = offTeam === "home" ? homeLine.rb : awayLine.rb;
      const offWR = offTeam === "home" ? homeLine.wr : awayLine.wr;
      const offLine = offTeam === "home" ? homeLine : awayLine;

      while (down <= 4 && !driveFinished) {
        const passPlay = rng() < 0.55;

        if (passPlay) {
          const intRoll = rng();
          const sackRoll = rng();
          const compRoll = rng();

          if (sackRoll < 0.06) {
            const loss = Math.floor(rng() * 6) + 4;
            yardline -= loss;
            down++;
            yardsToGo += loss;
          } else if (intRoll < 0.025) {
            trace.push({
              t: driveTime,
              type: "tactic_shift",
              description: `[Q${q} ${timeString}] INTERCEPTION! ${offQB.firstName} ${offQB.lastName} pass intercepted by defense!`,
              actorId: offQB.id,
              actorName: `${offQB.firstName} ${offQB.lastName}`,
              team: offTeam,
            });
            possession = defTeam;
            yardline = 100 - (yardline + Math.floor(rng() * 15));
            if (yardline > 80) yardline = 80;
            if (yardline < 20) yardline = 20;
            driveFinished = true;
            scoringPlay = "turnover";
          } else {
            const compProb = 0.58 + (offRatings.offense - defRatings.defense) / 500;
            if (compRoll < compProb) {
              const gains =
                Math.floor(rng() * 12) + (rng() < 0.15 ? Math.floor(rng() * 25) + 15 : 4);
              yardline += gains;
              if (gains > 25) {
                trace.push({
                  t: driveTime,
                  type: "tactic_shift",
                  description: `[Q${q} ${timeString}] Deep Pass! ${offQB.firstName} ${offQB.lastName} completes a ${gains}-yard pass to ${offWR.firstName} ${offWR.lastName}!`,
                  actorId: offQB.id,
                  actorName: `${offQB.firstName} ${offQB.lastName}`,
                  team: offTeam,
                });
              }
              if (gains >= yardsToGo) {
                down = 1;
                yardsToGo = 10;
              } else {
                down++;
                yardsToGo -= gains;
              }
            } else {
              down++;
            }
          }
        } else {
          const fumbleRoll = rng();
          if (fumbleRoll < 0.015) {
            trace.push({
              t: driveTime,
              type: "tactic_shift",
              description: `[Q${q} ${timeString}] FUMBLE! ${offRB.firstName} ${offRB.lastName} fumbles the ball, recovered by defense!`,
              actorId: offRB.id,
              actorName: `${offRB.firstName} ${offRB.lastName}`,
              team: offTeam,
            });
            possession = defTeam;
            yardline = 100 - yardline;
            if (yardline > 80) yardline = 80;
            if (yardline < 20) yardline = 20;
            driveFinished = true;
            scoringPlay = "turnover";
          } else {
            const runProb =
              2 +
              Math.floor(rng() * 6) +
              (rng() < 0.1 ? Math.floor(rng() * 15) : 0) +
              Math.round((offRatings.offense - defRatings.defense) / 100);
            const gains = Math.max(-3, runProb);
            yardline += gains;
            if (gains >= yardsToGo) {
              down = 1;
              yardsToGo = 10;
            } else {
              down++;
              yardsToGo -= gains;
            }
          }
        }

        if (yardline >= 100) {
          const extraPoint = rng() < 0.96 ? 1 : 0;
          const pts = 6 + extraPoint;
          if (offTeam === "home") homeScore += pts;
          else awayScore += pts;

          trace.push({
            t: driveTime,
            type: "goal",
            description: `[Q${q} ${timeString}] TOUCHDOWN! ${offRB.firstName} ${offRB.lastName} punches it into the endzone! PAT: ${extraPoint ? "Good" : "No Good"}. Score: Home ${homeScore} - Away ${awayScore}`,
            actorId: offRB.id,
            actorName: `${offRB.firstName} ${offRB.lastName}`,
            team: offTeam,
          });

          possession = defTeam;
          // Kickoff return starting field position simulation
          const koReturn = 15 + Math.floor(rng() * 15) + (rng() < 0.01 ? 75 : 0);
          if (koReturn >= 90) {
            // Kickoff return TD!
            if (possession === "home") homeScore += 7;
            else awayScore += 7;
            trace.push({
              t: driveTime,
              type: "goal",
              description: `[Q${q} ${timeString}] KICKOFF RETURN TOUCHDOWN! Sensational special teams score! Score: Home ${homeScore} - Away ${awayScore}`,
              team: possession,
            });
            possession = possession === "home" ? "away" : "home";
            yardline = 25;
          } else {
            yardline = koReturn;
          }
          driveFinished = true;
          scoringPlay = "td";
        }

        if (down === 4 && !driveFinished) {
          if (yardline >= 65) {
            const fgDist = 100 - yardline + 17;
            const fgProb = 0.9 - (fgDist - 20) * 0.012;
            if (rng() < fgProb) {
              if (offTeam === "home") homeScore += 3;
              else awayScore += 3;

              trace.push({
                t: driveTime,
                type: "goal",
                description: `[Q${q} ${timeString}] FIELD GOAL! ${offLine.k.firstName} ${offLine.k.lastName} converts a ${fgDist}-yard field goal. Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: offLine.k.id,
                actorName: `${offLine.k.firstName} ${offLine.k.lastName}`,
                team: offTeam,
              });
              scoringPlay = "fg";
            } else {
              trace.push({
                t: driveTime,
                type: "tactic_shift",
                description: `[Q${q} ${timeString}] Field Goal Missed! ${offLine.k.firstName} ${offLine.k.lastName} pushes a ${fgDist}-yard kick wide.`,
                actorId: offLine.k.id,
                actorName: `${offLine.k.firstName} ${offLine.k.lastName}`,
                team: offTeam,
              });
            }
            possession = defTeam;
            // Missed FG spot: take over at spot of kick (yardline - 7, or 20, whichever is greater)
            const spotOfKick = Math.max(20, yardline - 7);
            yardline = 100 - spotOfKick;
            driveFinished = true;
          } else {
            const puntDist = Math.floor(rng() * 15) + 35;
            const puntReturn = Math.floor(rng() * 8);
            const netPunt = puntDist - puntReturn;
            yardline = 100 - (yardline + netPunt);
            if (yardline < 10) yardline = 10;
            if (yardline > 90) yardline = 90;
            trace.push({
              t: driveTime,
              type: "tactic_shift",
              description: `[Q${q} ${timeString}] Punt: ${offLine.p.firstName} ${offLine.p.lastName} punts the ball ${puntDist} yards. Returned ${puntReturn} yards.`,
              actorId: offLine.p.id,
              actorName: `${offLine.p.firstName} ${offLine.p.lastName}`,
              team: offTeam,
            });
            possession = defTeam;
            driveFinished = true;
          }
        }
      }
      return { finished: driveFinished, scoringPlay };
    };

    for (const q of quarters) {
      const startT = (q - 1) * 15;
      const endT = q * 15;

      trace.push({
        t: startT,
        type: "tactic_shift",
        description: `Start of the ${quarterNames[q - 1]}. Possession: ${possession === "home" ? "Home" : "Away"} team.`,
        team: possession,
      });

      const drivesPerQuarter = 5;
      for (let drive = 1; drive <= drivesPerQuarter; drive++) {
        const driveTime = startT + Math.round((drive / drivesPerQuarter) * 14);
        const secondVal = Math.floor(rng() * 60);
        const timeString = `${driveTime}:${secondVal < 10 ? "0" : ""}${secondVal}`;
        runDrive(q, timeString, driveTime);
      }

      trace.push({
        t: endT,
        type: "tactic_shift",
        description: `End of the ${quarterNames[q - 1]}. Current Score: Home ${homeScore} - Away ${awayScore}`,
        team: "home",
      });
    }

    // Overtime drive-by-drive simulation
    if (homeScore === awayScore) {
      trace.push({
        t: 60,
        type: "tactic_shift",
        description: `END OF REGULATION: Tied at ${homeScore}-Score. Proceeding to Overtime under possession rules.`,
        team: possession,
      });

      let otDrive = 1;
      let otCompleted = false;
      const firstPossessionTeam = possession;
      let firstDriveScore: "td" | "fg" | "none" = "none";

      while (!otCompleted && otDrive < 6) {
        const timeString = `OT drive ${otDrive}`;
        const activeOffTeam = possession;
        const driveRes = runDrive(5, timeString, 60 + otDrive);

        const currentScore = driveRes.scoringPlay;
        if (otDrive === 1) {
          if (currentScore === "td") {
            // First drive TD wins immediately
            trace.push({
              t: 65,
              type: "goal",
              description: `OVERTIME: Walk-off Touchdown! Game ends.`,
              team: activeOffTeam,
            });
            otCompleted = true;
          } else if (currentScore === "fg") {
            firstDriveScore = "fg";
          }
        } else if (otDrive === 2) {
          if (firstDriveScore === "fg") {
            if (currentScore === "td") {
              // Other team scored TD to answer FG -> they win!
              trace.push({
                t: 65,
                type: "goal",
                description: `OVERTIME: Touchdown walk-off wins the game!`,
                team: activeOffTeam,
              });
              otCompleted = true;
            } else if (currentScore === "fg") {
              // Score tied after each team got a drive -> proceed to sudden death
              firstDriveScore = "none"; // Reset, now next score wins
            } else {
              // Failed to match the FG -> first drive team wins!
              trace.push({
                t: 65,
                type: "goal",
                description: `OVERTIME: Defense stands! First possession team wins.`,
                team: firstPossessionTeam,
              });
              otCompleted = true;
            }
          } else {
            // First team did not score. Next score of any kind wins!
            if (currentScore === "td" || currentScore === "fg") {
              trace.push({
                t: 65,
                type: "goal",
                description: `OVERTIME: Walk-off score! Game ends.`,
                team: activeOffTeam,
              });
              otCompleted = true;
            }
          }
        } else {
          // Sudden death (drive 3+)
          if (currentScore === "td" || currentScore === "fg") {
            trace.push({
              t: 65,
              type: "goal",
              description: `OVERTIME: Sudden death walk-off score! Game ends.`,
              team: activeOffTeam,
            });
            otCompleted = true;
          }
        }
        otDrive++;
      }
    }
  } else if (args.sport === "baseball") {
    // ─── Baseball Sim Loop ───
    const homeLine = extractBaseballRoster(args.homeRoster, homeOffense);
    const awayLine = extractBaseballRoster(args.awayRoster, awayOffense);

    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Play ball! Match begins. Home Pitcher: SP ${homeLine.sp.firstName} ${homeLine.sp.lastName} | Away Pitcher: SP ${awayLine.sp.firstName} ${awayLine.sp.lastName}.`,
      team: "home",
    });

    const inningsCount = 9;
    let homeOrderIdx = 0;
    let awayOrderIdx = 0;

    // Pitchers state
    let homeActivePitcher = homeLine.sp;
    let awayActivePitcher = awayLine.sp;
    let homePitcherType: "SP" | "RP" | "CP" = "SP";
    let awayPitcherType: "SP" | "RP" | "CP" = "SP";
    let homePitcherFatigue = 0;
    let awayPitcherFatigue = 0;

    for (let inning = 1; inning <= inningsCount; inning++) {
      // 1. Top of the inning (Away batting, Home pitching)
      {
        let outs = 0;
        let bases = [false, false, false];

        // Pitching change check for home team
        if (
          homePitcherType === "SP" &&
          inning >= 6 &&
          (homePitcherFatigue >= 75 || awayScore >= 4)
        ) {
          homeActivePitcher = homeLine.rp;
          homePitcherType = "RP";
          homePitcherFatigue = 0;
          trace.push({
            t: inning,
            type: "tactic_shift",
            description: `[Top ${inning}] PITCHING CHANGE: RP ${homeLine.rp.firstName} ${homeLine.rp.lastName} enters the game, replacing SP ${homeLine.sp.firstName} ${homeLine.sp.lastName}.`,
            actorId: homeLine.rp.id,
            actorName: `${homeLine.rp.firstName} ${homeLine.rp.lastName}`,
            team: "home",
          });
        }
        if (
          homePitcherType === "RP" &&
          inning === 9 &&
          homeScore > awayScore &&
          homeScore - awayScore <= 3
        ) {
          homeActivePitcher = homeLine.cp;
          homePitcherType = "CP";
          homePitcherFatigue = 0;
          trace.push({
            t: inning,
            type: "tactic_shift",
            description: `[Top ${inning}] PITCHING CHANGE: Closer CP ${homeLine.cp.firstName} ${homeLine.cp.lastName} enters the game to close it out.`,
            actorId: homeLine.cp.id,
            actorName: `${homeLine.cp.firstName} ${homeLine.cp.lastName}`,
            team: "home",
          });
        }

        while (outs < 3) {
          const awayBatter = args.awayRoster?.[awayOrderIdx % (args.awayRoster.length || 9)] ?? {
            id: `away_batter_${awayOrderIdx}`,
            firstName: "Away",
            lastName: `Batter ${awayOrderIdx + 1}`,
            ratings: { overall: awayOffense },
          };
          awayOrderIdx++;

          const batterOverall = getPlayerOverall(awayBatter);
          // Effective pitcher overall degrades with fatigue
          const pitcherOverall = Math.max(
            30,
            getPlayerOverall(homeActivePitcher) - Math.round(homePitcherFatigue / 3)
          );

          homePitcherFatigue += 1.2;

          const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
          const walkProb = 0.08;
          const kProb = 0.18;

          const roll = rng();
          if (roll < hitProb) {
            const hitTypeRoll = rng();
            let basesToAdvance = 1;
            let hitType = "single";

            if (hitTypeRoll < 0.65) {
              basesToAdvance = 1;
              hitType = "single";
            } else if (hitTypeRoll < 0.85) {
              basesToAdvance = 2;
              hitType = "double";
            } else if (hitTypeRoll < 0.95) {
              basesToAdvance = 3;
              hitType = "triple";
            } else {
              basesToAdvance = 4;
              hitType = "home run";
            }

            let runsScored = 0;
            if (basesToAdvance === 4) {
              runsScored = 1 + bases.filter(Boolean).length;
              bases = [false, false, false];
              awayScore += runsScored;
              homePitcherFatigue += runsScored * 4;
              trace.push({
                t: inning,
                type: "goal",
                description: `[Top ${inning}] HOME RUN! ${awayBatter.firstName} ${awayBatter.lastName} crushes a deep blast! ${runsScored} run(s) score. Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: awayBatter.id,
                actorName: `${awayBatter.firstName} ${awayBatter.lastName}`,
                team: "away",
              });
            } else {
              for (let b = 2; b >= 0; b--) {
                if (bases[b]) {
                  if (b + basesToAdvance >= 3) {
                    runsScored++;
                    bases[b] = false;
                  } else {
                    bases[b + basesToAdvance] = true;
                    bases[b] = false;
                  }
                }
              }
              bases[basesToAdvance - 1] = true;
              if (runsScored > 0) {
                awayScore += runsScored;
                homePitcherFatigue += runsScored * 4;
                trace.push({
                  t: inning,
                  type: "goal",
                  description: `[Top ${inning}] RBI Hit! ${awayBatter.firstName} ${awayBatter.lastName} hits a ${hitType}! Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: awayBatter.id,
                  actorName: `${awayBatter.firstName} ${awayBatter.lastName}`,
                  team: "away",
                });
              }
            }
          } else if (roll < hitProb + walkProb) {
            let runsScored = 0;
            if (bases[0] && bases[1] && bases[2]) {
              runsScored = 1;
              awayScore++;
              homePitcherFatigue += 4;
            } else if (bases[0] && bases[1]) {
              bases[2] = true;
            } else if (bases[0]) {
              bases[1] = true;
            } else {
              bases[0] = true;
            }
            if (runsScored > 0) {
              trace.push({
                t: inning,
                type: "goal",
                description: `[Top ${inning}] Walk scores a run! ${awayBatter.firstName} ${awayBatter.lastName} walks. Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: awayBatter.id,
                actorName: `${awayBatter.firstName} ${awayBatter.lastName}`,
                team: "away",
              });
            }
          } else if (roll < hitProb + walkProb + kProb) {
            outs++;
            if (rng() < 0.25) {
              trace.push({
                t: inning,
                type: "card",
                description: `[Top ${inning}] Strikeout! ${homeActivePitcher.firstName} ${homeActivePitcher.lastName} strikes out ${awayBatter.firstName} ${awayBatter.lastName}.`,
                actorId: homeActivePitcher.id,
                actorName: `${homeActivePitcher.firstName} ${homeActivePitcher.lastName}`,
                team: "home",
              });
            }
          } else {
            outs++;
          }
        }
      }

      // Bottom of the inning
      if (inning === 9 && homeScore > awayScore) {
        trace.push({
          t: inning,
          type: "tactic_shift",
          description: `Bottom 9th not played as Home team leads.`,
          team: "home",
        });
        break;
      }

      {
        let outs = 0;
        let bases = [false, false, false];

        // Pitching change check for away team
        if (
          awayPitcherType === "SP" &&
          inning >= 6 &&
          (awayPitcherFatigue >= 75 || homeScore >= 4)
        ) {
          awayActivePitcher = awayLine.rp;
          awayPitcherType = "RP";
          awayPitcherFatigue = 0;
          trace.push({
            t: inning,
            type: "tactic_shift",
            description: `[Bottom ${inning}] PITCHING CHANGE: RP ${awayLine.rp.firstName} ${awayLine.rp.lastName} enters the game, replacing SP ${awayLine.sp.firstName} ${awayLine.sp.lastName}.`,
            actorId: awayLine.rp.id,
            actorName: `${awayLine.rp.firstName} ${awayLine.rp.lastName}`,
            team: "away",
          });
        }
        if (
          awayPitcherType === "RP" &&
          inning === 9 &&
          awayScore > homeScore &&
          awayScore - homeScore <= 3
        ) {
          awayActivePitcher = awayLine.cp;
          awayPitcherType = "CP";
          awayPitcherFatigue = 0;
          trace.push({
            t: inning,
            type: "tactic_shift",
            description: `[Bottom ${inning}] PITCHING CHANGE: Closer CP ${awayLine.cp.firstName} ${awayLine.cp.lastName} enters the game to close it out.`,
            actorId: awayLine.cp.id,
            actorName: `${awayLine.cp.firstName} ${awayLine.cp.lastName}`,
            team: "away",
          });
        }

        while (outs < 3) {
          const homeBatter = args.homeRoster?.[homeOrderIdx % (args.homeRoster.length || 9)] ?? {
            id: `home_batter_${homeOrderIdx}`,
            firstName: "Home",
            lastName: `Batter ${homeOrderIdx + 1}`,
            ratings: { overall: homeOffense },
          };
          homeOrderIdx++;

          const batterOverall = getPlayerOverall(homeBatter);
          // Effective pitcher overall degrades with fatigue
          const pitcherOverall = Math.max(
            30,
            getPlayerOverall(awayActivePitcher) - Math.round(awayPitcherFatigue / 3)
          );

          awayPitcherFatigue += 1.2;

          const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
          const walkProb = 0.08;
          const kProb = 0.18;

          const roll = rng();
          if (roll < hitProb) {
            const hitTypeRoll = rng();
            let basesToAdvance = 1;
            let hitType = "single";

            if (hitTypeRoll < 0.65) {
              basesToAdvance = 1;
              hitType = "single";
            } else if (hitTypeRoll < 0.85) {
              basesToAdvance = 2;
              hitType = "double";
            } else if (hitTypeRoll < 0.95) {
              basesToAdvance = 3;
              hitType = "triple";
            } else {
              basesToAdvance = 4;
              hitType = "home run";
            }

            let runsScored = 0;
            if (basesToAdvance === 4) {
              runsScored = 1 + bases.filter(Boolean).length;
              bases = [false, false, false];
              homeScore += runsScored;
              awayPitcherFatigue += runsScored * 4;
              trace.push({
                t: inning,
                type: "goal",
                description: `[Bottom ${inning}] HOME RUN! ${homeBatter.firstName} ${homeBatter.lastName} crushes a deep blast! ${runsScored} run(s) score. Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: homeBatter.id,
                actorName: `${homeBatter.firstName} ${homeBatter.lastName}`,
                team: "home",
              });
            } else {
              for (let b = 2; b >= 0; b--) {
                if (bases[b]) {
                  if (b + basesToAdvance >= 3) {
                    runsScored++;
                    bases[b] = false;
                  } else {
                    bases[b + basesToAdvance] = true;
                    bases[b] = false;
                  }
                }
              }
              bases[basesToAdvance - 1] = true;
              if (runsScored > 0) {
                homeScore += runsScored;
                awayPitcherFatigue += runsScored * 4;
                trace.push({
                  t: inning,
                  type: "goal",
                  description: `[Bottom ${inning}] RBI Hit! ${homeBatter.firstName} ${homeBatter.lastName} hits a ${hitType}! Score: Home ${homeScore} - Away ${awayScore}`,
                  actorId: homeBatter.id,
                  actorName: `${homeBatter.firstName} ${homeBatter.lastName}`,
                  team: "home",
                });
              }
            }

            if (inning === 9 && homeScore > awayScore) {
              trace.push({
                t: inning,
                type: "goal",
                description: `Walk-off victory for the home team!`,
                team: "home",
              });
              break;
            }
          } else if (roll < hitProb + walkProb) {
            let runsScored = 0;
            if (bases[0] && bases[1] && bases[2]) {
              runsScored = 1;
              homeScore++;
              awayPitcherFatigue += 4;
            } else if (bases[0] && bases[1]) {
              bases[2] = true;
            } else if (bases[0]) {
              bases[1] = true;
            } else {
              bases[0] = true;
            }
            if (runsScored > 0) {
              trace.push({
                t: inning,
                type: "goal",
                description: `[Bottom ${inning}] Walk scores a run! ${homeBatter.firstName} ${homeBatter.lastName} walks. Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: homeBatter.id,
                actorName: `${homeBatter.firstName} ${homeBatter.lastName}`,
                team: "home",
              });
            }
            if (inning === 9 && homeScore > awayScore) {
              trace.push({
                t: inning,
                type: "goal",
                description: `Walk-off victory for the home team!`,
                team: "home",
              });
              break;
            }
          } else if (roll < hitProb + walkProb + kProb) {
            outs++;
            if (rng() < 0.25) {
              trace.push({
                t: inning,
                type: "card",
                description: `[Bottom ${inning}] Strikeout! ${awayActivePitcher.firstName} ${awayActivePitcher.lastName} strikes out ${homeBatter.firstName} ${homeBatter.lastName}.`,
                actorId: awayActivePitcher.id,
                actorName: `${awayActivePitcher.firstName} ${awayActivePitcher.lastName}`,
                team: "away",
              });
            }
          } else {
            outs++;
          }
        }
      }
    }

    // Extra Innings if tied
    let extraInning = 9;
    while (homeScore === awayScore && extraInning < 15) {
      extraInning++;
      trace.push({
        t: extraInning,
        type: "tactic_shift",
        description: `Tied at ${homeScore}-${awayScore}. Proceeding to Inning ${extraInning}!`,
        team: "home",
      });

      // Top Half
      {
        let outs = 0;
        // eslint-disable-next-line prefer-const
        let bases = [false, false, false];
        while (outs < 3) {
          const awayBatter = args.awayRoster?.[awayOrderIdx % (args.awayRoster.length || 9)] ?? {
            id: `away_batter_${awayOrderIdx}`,
            firstName: "Away",
            lastName: `Batter ${awayOrderIdx + 1}`,
            ratings: { overall: awayOffense },
          };
          awayOrderIdx++;
          const batterOverall = getPlayerOverall(awayBatter);
          const pitcherOverall = Math.max(
            30,
            getPlayerOverall(homeActivePitcher) - Math.round(homePitcherFatigue / 3)
          );
          homePitcherFatigue += 1.2;

          const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
          if (rng() < hitProb) {
            awayScore++;
            trace.push({
              t: extraInning,
              type: "goal",
              description: `[Top ${extraInning}] Extra Innings RBI Hit! Score: Home ${homeScore} - Away ${awayScore}`,
              team: "away",
            });
          } else {
            outs++;
          }
        }
      }

      // Bottom Half
      {
        let outs = 0;
        // eslint-disable-next-line prefer-const
        let bases = [false, false, false];
        while (outs < 3) {
          const homeBatter = args.homeRoster?.[homeOrderIdx % (args.homeRoster.length || 9)] ?? {
            id: `home_batter_${homeOrderIdx}`,
            firstName: "Home",
            lastName: `Batter ${homeOrderIdx + 1}`,
            ratings: { overall: homeOffense },
          };
          homeOrderIdx++;
          const batterOverall = getPlayerOverall(homeBatter);
          const pitcherOverall = Math.max(
            30,
            getPlayerOverall(awayActivePitcher) - Math.round(awayPitcherFatigue / 3)
          );
          awayPitcherFatigue += 1.2;

          const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
          if (rng() < hitProb) {
            homeScore++;
            trace.push({
              t: extraInning,
              type: "goal",
              description: `[Bottom ${extraInning}] Extra Innings Walk-off Hit! Score: Home ${homeScore} - Away ${awayScore}`,
              team: "home",
            });
            if (homeScore > awayScore) break;
          } else {
            outs++;
          }
        }
      }
    }
  } else {
    // ─── Soccer / Default Sim Loop (Enhanced) ───
    trace.push({
      t: 0,
      type: "tactic_shift",
      description: `Match begins. Home team using ${homeTactical.replace(/_/g, " ")} tactics. Away team using ${awayTactical.replace(/_/g, " ")} tactics.`,
      team: "home",
    });

    // Track cards and sent-off players
    const playerYellowCards = new Map<string, number>();
    const sentOffPlayers = new Set<string>();
    let homeRedCardsCount = 0;
    let awayRedCardsCount = 0;

    const selectActivePlayer = (
      roster: any[] | undefined,
      defaultName: string
    ): { id: string; name: string } => {
      if (!roster || roster.length === 0) return { id: "generic", name: defaultName };
      const available = roster.filter((p) => !sentOffPlayers.has(p.id));
      if (available.length === 0)
        return { id: roster[0].id, name: `${roster[0].firstName} ${roster[0].lastName}` };
      return getRosterPlayerByRoleWeight(available, defaultName);
    };

    const selectActiveCardPlayer = (
      roster: any[] | undefined
    ): { id: string; name: string } | null => {
      if (!roster || roster.length === 0) return null;
      const available = roster.filter((p) => !sentOffPlayers.has(p.id));
      if (available.length === 0) return null;
      return getCardPlayerWeight(available);
    };

    const runSoccerTick = (t: number) => {
      const initialTraceLength = trace.length;
      if (t === 60) {
        if (homeScore > awayScore && awayTactical !== "all_out_attack") {
          awayTactical = "all_out_attack";
          trace.push({
            t,
            type: "tactic_shift",
            description: `Tactical Shift: Away team switches to All-Out Attack to chase the game!`,
            team: "away",
          });
        } else if (awayScore > homeScore && homeTactical !== "all_out_attack") {
          homeTactical = "all_out_attack";
          trace.push({
            t,
            type: "tactic_shift",
            description: `Tactical Shift: Home team switches to All-Out Attack to chase the game!`,
            team: "home",
          });
        }
      }
      if (t === 75) {
        if (homeScore - awayScore >= 2 && homeTactical !== "park_the_bus") {
          homeTactical = "park_the_bus";
          trace.push({
            t,
            type: "tactic_shift",
            description: `Tactical Shift: Home team switches to Park the Bus to lock down the victory.`,
            team: "home",
          });
        } else if (awayScore - homeScore >= 2 && awayTactical !== "park_the_bus") {
          awayTactical = "park_the_bus";
          trace.push({
            t,
            type: "tactic_shift",
            description: `Tactical Shift: Away team switches to Park the Bus to lock down the victory.`,
            team: "away",
          });
        }
      }

      // Red card handicap: -10% offense, -15% defense per red card
      const homeOffScale = Math.pow(0.9, homeRedCardsCount);
      const homeDefScale = Math.pow(0.85, homeRedCardsCount);
      const awayOffScale = Math.pow(0.9, awayRedCardsCount);
      const awayDefScale = Math.pow(0.85, awayRedCardsCount);

      const baseGoalProb = 0.13; // Increased from 0.045 to avoid 40% draw rate
      const homeGoalProb =
        ((homeOffense * homeOffScale) / (homeOffense * homeOffScale + awayDefense * awayDefScale)) *
          baseGoalProb +
        (homeTactical === "all_out_attack" ? 0.015 : 0);
      const awayGoalProb =
        ((awayOffense * awayOffScale) / (awayOffense * awayOffScale + homeDefense * homeDefScale)) *
          baseGoalProb +
        (awayTactical === "all_out_attack" ? 0.015 : 0);

      // Home goal attempt
      if (rng() < homeGoalProb) {
        homeScore++;
        const scorer = selectActivePlayer(args.homeRoster, "Home Striker");
        trace.push({
          t,
          type: "goal",
          description: `GOAL! ${scorer.name} finds the back of the net! Score: Home ${homeScore} - Away ${awayScore}`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "home",
        });
      } else {
        if (rng() < 0.1) {
          const shooter = selectActivePlayer(args.homeRoster, "Home Attacker");
          trace.push({
            t,
            type: "tactic_shift",
            description: `Shot! ${shooter.name} fires a powerful shot, but the keeper makes a diving save!`,
            actorId: shooter.id,
            actorName: shooter.name,
            team: "home",
          });
        }
      }

      // Away goal attempt
      if (rng() < awayGoalProb) {
        awayScore++;
        const scorer = selectActivePlayer(args.awayRoster, "Away Striker");
        trace.push({
          t,
          type: "goal",
          description: `GOAL! ${scorer.name} strikes a clinical finish! Score: Home ${homeScore} - Away ${awayScore}`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "away",
        });
      } else {
        if (rng() < 0.1) {
          const shooter = selectActivePlayer(args.awayRoster, "Away Attacker");
          trace.push({
            t,
            type: "tactic_shift",
            description: `Shot! ${shooter.name} tests the goalkeeper from distance, but it's held safely.`,
            actorId: shooter.id,
            actorName: shooter.name,
            team: "away",
          });
        }
      }

      // Yellow/Red Card checks (3% chance per tick)
      if (rng() < 0.03) {
        const cardTeam = rng() < 0.5 ? "home" : "away";
        const roster = cardTeam === "home" ? args.homeRoster : args.awayRoster;
        const player = selectActiveCardPlayer(roster);
        if (player) {
          const yellows = (playerYellowCards.get(player.id) ?? 0) + 1;
          playerYellowCards.set(player.id, yellows);

          if (yellows === 2) {
            sentOffPlayers.add(player.id);
            if (cardTeam === "home") homeRedCardsCount++;
            else awayRedCardsCount++;

            trace.push({
              t,
              type: "card",
              description: `RED CARD! ${player.name} is sent off after receiving a second yellow card!`,
              actorId: player.id,
              actorName: player.name,
              team: cardTeam,
            });
          } else {
            trace.push({
              t,
              type: "card",
              description: `Yellow Card shown to ${player.name} for a rough tactical challenge.`,
              actorId: player.id,
              actorName: player.name,
              team: cardTeam,
            });
          }
        }
      }

      // Straight Red Card check (0.15% chance per tick)
      if (rng() < 0.0015) {
        const cardTeam = rng() < 0.5 ? "home" : "away";
        const roster = cardTeam === "home" ? args.homeRoster : args.awayRoster;
        const player = selectActiveCardPlayer(roster);
        if (player) {
          sentOffPlayers.add(player.id);
          if (cardTeam === "home") homeRedCardsCount++;
          else awayRedCardsCount++;

          trace.push({
            t,
            type: "card",
            description: `STRAIGHT RED CARD! ${player.name} is sent off for violent conduct!`,
            actorId: player.id,
            actorName: player.name,
            team: cardTeam,
          });
        }
      }

      // Injury check (0.5% chance per tick)
      if (rng() < 0.005) {
        const injuryTeam = rng() < 0.5 ? "home" : "away";
        const roster = injuryTeam === "home" ? args.homeRoster : args.awayRoster;
        if (roster && roster.length > 0) {
          const player = selectActivePlayer(
            roster,
            `${injuryTeam === "home" ? "Home" : "Away"} Player`
          );
          if (player && player.id !== "generic") {
            sentOffPlayers.add(player.id); // Cannot play anymore
            trace.push({
              t,
              type: "injury",
              description: `INJURY: ${player.name} is forced off the field with an injury!`,
              actorId: player.id,
              actorName: player.name,
              team: injuryTeam,
            });
          }
        }
      }

      if (trace.length === initialTraceLength) {
        if (rng() < 0.5) {
          const passiveEvents = [
            "Midfield battle intensifies as both teams contest possession.",
            "A patient build-up play in the middle third by the home side.",
            "Solid defensive shape prevents any progression into the penalty area.",
            "Strong tackles flying in from both sides in a high-intensity period.",
            "A long cross into the box is confidently collected by the goalkeeper.",
            "The home team spreads the play wide, trying to pull the defense apart.",
            "A quick counter-attack opportunity is shut down by a tactical interception.",
            "Crowd rises as the ball shifts rapidly between the penalty boxes.",
            "Excellent pressing forces a hurried clearance into touch.",
            "Strategic passes are swapped along the back line as players seek an opening.",
          ];
          const desc = passiveEvents[Math.floor(rng() * passiveEvents.length)];
          trace.push({
            t,
            type: "tactic_shift",
            description: desc,
            team: rng() < 0.5 ? "home" : "away",
          });
        }
      }
    };

    // Regulation 90 minutes
    for (let t = 5; t <= 90; t += 5) {
      runSoccerTick(t);
    }

    // Extra Time check for playoff/bracket matches
    const isPlayoffOrBracket = args.archetype === "bracket" || isPlayoff;
    if (isPlayoffOrBracket && homeScore === awayScore) {
      trace.push({
        t: 90,
        type: "tactic_shift",
        description: `END OF REGULATION: Tied at ${homeScore}-${awayScore}. Proceeding to 30 minutes of Extra Time.`,
        team: "home",
      });

      for (let t = 95; t <= 120; t += 5) {
        runSoccerTick(t);
      }
    }

    // Penalty Shootout
    if (isPlayoffOrBracket && homeScore === awayScore) {
      trace.push({
        t: 120,
        type: "tactic_shift",
        description: `END OF EXTRA TIME: Still tied at ${homeScore}-${awayScore}. Proceeding to Penalty Shootout!`,
        team: "home",
      });

      let homeShootoutGoals = 0;
      let awayShootoutGoals = 0;

      const runPenaltyKick = (team: "home" | "away", roundNum: number): boolean => {
        const roster = team === "home" ? args.homeRoster : args.awayRoster;
        const shooter = selectActivePlayer(roster, `${team === "home" ? "Home" : "Away"} Shooter`);
        const shooterRating =
          shooter.id !== "generic" && roster
            ? getPlayerOverall(roster.find((p) => p.id === shooter.id))
            : 65;
        // Keepers overall
        const keeperRating = 70;
        const pkProb = clamp(0.75 + (shooterRating - keeperRating) / 600, 0.5, 0.95);

        const scored = rng() < pkProb;
        trace.push({
          t: 121 + roundNum,
          type: scored ? "goal" : "card",
          description: `PENALTY KICK (Round ${roundNum}): ${shooter.name} ${scored ? "SCORES" : "MISSES"} for the ${team} team!`,
          actorId: shooter.id,
          actorName: shooter.name,
          team,
        });
        return scored;
      };

      // 5 Standard PK rounds
      let activeRound = 1;
      for (; activeRound <= 5; activeRound++) {
        if (runPenaltyKick("home", activeRound)) homeShootoutGoals++;
        if (runPenaltyKick("away", activeRound)) awayShootoutGoals++;

        // Early win checks
        const homeRemaining = 5 - activeRound;
        const awayRemaining = 5 - activeRound;
        if (homeShootoutGoals > awayShootoutGoals + awayRemaining) break;
        if (awayShootoutGoals > homeShootoutGoals + homeRemaining) break;
      }

      // Sudden death (Round 6+)
      while (homeShootoutGoals === awayShootoutGoals && activeRound < 15) {
        activeRound++;
        const homeScored = runPenaltyKick("home", activeRound);
        const awayScored = runPenaltyKick("away", activeRound);
        if (homeScored) homeShootoutGoals++;
        if (awayScored) awayShootoutGoals++;
      }

      if (homeShootoutGoals > awayShootoutGoals) {
        homeScore++;
        trace.push({
          t: 140,
          type: "goal",
          description: `Shootout finished: Home team wins the shootout ${homeShootoutGoals}-${awayShootoutGoals}!`,
          team: "home",
        });
      } else {
        awayScore++;
        trace.push({
          t: 140,
          type: "goal",
          description: `Shootout finished: Away team wins the shootout ${awayShootoutGoals}-${homeShootoutGoals}!`,
          team: "away",
        });
      }
    }
  }
  let winner: "home" | "away" | "draw" = "draw";
  if (homeScore > awayScore) winner = "home";
  else if (awayScore > homeScore) winner = "away";

  const homeWon = winner === "home";
  const awayWon = winner === "away";
  const isDraw = winner === "draw";
  const upset = isDraw ? Math.abs(differential) > 10 : isHomeFavored ? awayWon : homeWon;

  // 4. Calculate ELO Rating Deltas (factoring in dominance vector)
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
