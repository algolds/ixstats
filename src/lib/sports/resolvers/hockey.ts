/**
 * Sports Engine — Ice Hockey Match Resolver (3-Period Simulation)
 *
 * Implements standard Ice Hockey simulation:
 * - 3 regulation periods (20 minutes each = 60 minutes total)
 * - 5v5 line shifts (Line 1 vs Line 2)
 * - 2-minute minor penalties (power plays 5v4)
 * - Period 2 Long Change defensive transition effects
 * - 5-minute major fighting penalties
 * - Period 3 Goalie Pull / Extra Attacker & Empty Net mechanics (t >= 57)
 * - 3-on-3 Sudden Death Overtime (5 mins)
 * - Penalty Shootout (3 rounds + sudden death)
 */

import type { EventTraceStep } from "../types";
import type { SportResolverContext, SportMatchOutcome } from "./types";
import {
  extractHockeyLines,
  getPlayerOverall,
  getRosterPlayerByRoleWeight,
  getCardPlayerWeight,
} from "./helpers";

export function runHockeyMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng, homeOffense, awayOffense, homeDefense, awayDefense, homeTactical, awayTactical, homeRoster, awayRoster } = ctx;

  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeLines = extractHockeyLines(homeRoster, homeOffense);
  const awayLines = extractHockeyLines(awayRoster, awayOffense);

  let homePowerPlayMins = 0;
  let awayPowerPlayMins = 0;
  let homeMajorPenaltyMins = 0;
  let awayMajorPenaltyMins = 0;
  let homeGoaliePulled = false;
  let awayGoaliePulled = false;

  trace.push({
    t: 0,
    type: "tactic_shift",
    description: `Puck drop! Match underway. Home system: ${homeTactical.replace(/_/g, " ")}. Away system: ${awayTactical.replace(/_/g, " ")}.`,
    team: "home",
  });

  // ─── 3 PERIODS OF 20 MINUTES (1..60) ───
  for (let t = 2; t <= 60; t += 2) {
    const period = t <= 20 ? 1 : t <= 40 ? 2 : 3;

    // Decay active penalties
    if (homePowerPlayMins > 0) homePowerPlayMins = Math.max(0, homePowerPlayMins - 2);
    if (awayPowerPlayMins > 0) awayPowerPlayMins = Math.max(0, awayPowerPlayMins - 2);
    if (homeMajorPenaltyMins > 0) homeMajorPenaltyMins = Math.max(0, homeMajorPenaltyMins - 2);
    if (awayMajorPenaltyMins > 0) awayMajorPenaltyMins = Math.max(0, awayMajorPenaltyMins - 2);

    // End of period intermission notifications
    if (t === 20) {
      trace.push({
        t: 20,
        type: "tactic_shift",
        description: `END OF 1ST PERIOD: Score is ${homeScore}-${awayScore}. Ice clean & 1st intermission.`,
        team: "home",
      });
    } else if (t === 40) {
      trace.push({
        t: 40,
        type: "tactic_shift",
        description: `END OF 2ND PERIOD: Score is ${homeScore}-${awayScore}. Ice clean & 2nd intermission.`,
        team: "home",
      });
    }

    // Line shift selection (Line 1 ~55%, Line 2 ~45%)
    const homeLineActive = rng() < 0.55 ? 1 : 2;
    const awayLineActive = rng() < 0.55 ? 1 : 2;

    // Minor Penalties (6% chance per 2-min interval) -> 2-min Power Play
    if (rng() < 0.06 && homePowerPlayMins === 0 && awayPowerPlayMins === 0) {
      const isHomePenalized = rng() < 0.5;
      const penaltyInfractions = ["slashing", "hooking", "tripping", "cross-checking", "holding", "high-sticking"];
      const infraction = penaltyInfractions[Math.floor(rng() * penaltyInfractions.length)] ?? "tripping";

      if (isHomePenalized) {
        awayPowerPlayMins = 2;
        const player = getCardPlayerWeight(homeRoster, rng);
        trace.push({
          t,
          type: "card",
          description: `PENALTY (P${period}): ${player ? player.name : "Home player"} assessed 2 mins for ${infraction}. Away POWER PLAY!`,
          actorId: player?.id,
          actorName: player?.name,
          team: "home",
        });
      } else {
        homePowerPlayMins = 2;
        const player = getCardPlayerWeight(awayRoster, rng);
        trace.push({
          t,
          type: "card",
          description: `PENALTY (P${period}): ${player ? player.name : "Away player"} assessed 2 mins for ${infraction}. Home POWER PLAY!`,
          actorId: player?.id,
          actorName: player?.name,
          team: "away",
        });
      }
    }

    // Period 2: 5-Minute Major Fight Events (3.5% chance during P2 long change)
    if (period === 2 && rng() < 0.035 && homeMajorPenaltyMins === 0 && awayMajorPenaltyMins === 0) {
      const playerH = getCardPlayerWeight(homeRoster, rng);
      const playerA = getCardPlayerWeight(awayRoster, rng);
      homeMajorPenaltyMins = 5;
      awayMajorPenaltyMins = 5;
      trace.push({
        t,
        type: "injury",
        description: `FIGHT MAJOR (P2): Gloves dropped! ${playerH ? playerH.name : "Home forward"} and ${playerA ? playerA.name : "Away defenseman"} exchange blows at center ice. 5-minute majors assessed!`,
        actorId: playerH?.id,
        actorName: playerH?.name,
        team: "home",
      });
    }

    // Period 3: Goalie Pulling / Extra Attacker Mechanics (t >= 56)
    if (period === 3 && t >= 56) {
      if (homeScore > awayScore && homeScore - awayScore <= 2 && !awayGoaliePulled) {
        awayGoaliePulled = true;
        trace.push({
          t,
          type: "tactic_shift",
          description: `TACTIC SHIFT (P3 ${t}m): Away coach signals to bench — Goalie pulled for the 6-on-5 extra attacker!`,
          team: "away",
        });
      } else if (awayScore > homeScore && awayScore - homeScore <= 2 && !homeGoaliePulled) {
        homeGoaliePulled = true;
        trace.push({
          t,
          type: "tactic_shift",
          description: `TACTIC SHIFT (P3 ${t}m): Home coach signals to bench — Goalie pulled for the 6-on-5 extra attacker!`,
          team: "home",
        });
      }
    }

    // Calculate shift ratings
    let hOff = homeLineActive === 1 ? homeLines.line1.offense : homeLines.line2.offense;
    let hDef = homeLineActive === 1 ? homeLines.line1.defense : homeLines.line2.defense;
    let aOff = awayLineActive === 1 ? awayLines.line1.offense : awayLines.line2.offense;
    let aDef = awayLineActive === 1 ? awayLines.line1.defense : awayLines.line2.defense;

    // Period 2: Long Change fatigue penalty (increases defensive breakdown by ~10%)
    if (period === 2) {
      hDef = Math.max(20, hDef * 0.92);
      aDef = Math.max(20, aDef * 0.92);
    }

    // Power play modifiers
    if (awayPowerPlayMins > 0) {
      aOff += 14;
      hDef -= 10;
    }
    if (homePowerPlayMins > 0) {
      hOff += 14;
      aDef -= 10;
    }

    // Goalie pull modifiers
    if (homeGoaliePulled) {
      hOff += 22; // 6-on-5 extra attacker offensive pressure
    } else {
      hDef = (hDef * 0.6) + (homeLines.goalie.defense * 0.4);
    }

    if (awayGoaliePulled) {
      aOff += 22; // 6-on-5 extra attacker offensive pressure
    } else {
      aDef = (aDef * 0.6) + (awayLines.goalie.defense * 0.4);
    }

    // Goal scoring probabilities
    const baseShotRate = 0.085;
    const homeGoalProb = (hOff / (hOff + aDef)) * baseShotRate + (awayGoaliePulled ? 0.09 : 0);
    const awayGoalProb = (aOff / (aOff + hDef)) * baseShotRate + (homeGoaliePulled ? 0.09 : 0);

    // Check Home Goal
    if (rng() < homeGoalProb) {
      homeScore++;
      const scorer = getRosterPlayerByRoleWeight(homeRoster, "Home Attacker", rng);
      const isPPG = homePowerPlayMins > 0;
      const isEmptyNet = awayGoaliePulled;

      let goalDesc = `GOAL! (P${period} ${t}m) ${scorer.name} snaps a one-timer past the netminder!`;
      if (isEmptyNet) {
        goalDesc = `EMPTY NET GOAL! (P${period} ${t}m) ${scorer.name} sends the puck all the way down the ice into the empty net!`;
      } else if (isPPG) {
        goalDesc = `POWER PLAY GOAL! (P${period} ${t}m) ${scorer.name} capitalizes with the man-advantage!`;
        homePowerPlayMins = 0; // Minor penalty ends on PPG
      }

      trace.push({
        t,
        type: "goal",
        description: goalDesc,
        actorId: scorer.id,
        actorName: scorer.name,
        team: "home",
      });
    }

    // Check Away Goal
    if (rng() < awayGoalProb) {
      awayScore++;
      const scorer = getRosterPlayerByRoleWeight(awayRoster, "Away Attacker", rng);
      const isPPG = awayPowerPlayMins > 0;
      const isEmptyNet = homeGoaliePulled;

      let goalDesc = `GOAL! (P${period} ${t}m) ${scorer.name} buries a rebound for the away team!`;
      if (isEmptyNet) {
        goalDesc = `EMPTY NET GOAL! (P${period} ${t}m) ${scorer.name} clears the zone and hits the empty cage!`;
      } else if (isPPG) {
        goalDesc = `POWER PLAY GOAL! (P${period} ${t}m) ${scorer.name} strikes on the power play!`;
        awayPowerPlayMins = 0; // Minor penalty ends on PPG
      }

      trace.push({
        t,
        type: "goal",
        description: goalDesc,
        actorId: scorer.id,
        actorName: scorer.name,
        team: "away",
      });
    }
  }

  // ─── OVERTIME: 3-ON-3 SUDDEN DEATH (5 MINS: 61..65) ───
  if (homeScore === awayScore) {
    trace.push({
      t: 60,
      type: "tactic_shift",
      description: `END OF REGULATION: 60 minutes complete tied ${homeScore}-${awayScore}. Proceeding to 5-Minute 3-on-3 Sudden Death Overtime!`,
      team: "home",
    });

    const otOffenseHome = homeOffense + 25;
    const otDefenseAway = Math.max(15, awayDefense - 15);
    const otOffenseAway = awayOffense + 25;
    const otDefenseHome = Math.max(15, homeDefense - 15);

    const otHomeGoalProb = (otOffenseHome / (otOffenseHome + otDefenseAway)) * 0.28;
    const otAwayGoalProb = (otOffenseAway / (otOffenseAway + otDefenseHome)) * 0.28;

    let otResolved = false;
    for (let otMin = 1; otMin <= 5; otMin++) {
      const otTime = 60 + otMin;
      if (rng() < otHomeGoalProb) {
        homeScore++;
        const scorer = getRosterPlayerByRoleWeight(homeRoster, "Home Attacker", rng);
        trace.push({
          t: otTime,
          type: "goal",
          description: `OVERTIME WINNER! (OT ${otMin}m) ${scorer.name} wins it on a 2-on-1 rush! Sudden death game over!`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "home",
        });
        otResolved = true;
        break;
      } else if (rng() < otAwayGoalProb) {
        awayScore++;
        const scorer = getRosterPlayerByRoleWeight(awayRoster, "Away Attacker", rng);
        trace.push({
          t: otTime,
          type: "goal",
          description: `OVERTIME WINNER! (OT ${otMin}m) ${scorer.name} fires a laser off the crossbar and in! Away team wins in OT!`,
          actorId: scorer.id,
          actorName: scorer.name,
          team: "away",
        });
        otResolved = true;
        break;
      }
    }

    // ─── PENALTY SHOOTOUT (IF STILL TIED AFTER OT) ───
    if (!otResolved && homeScore === awayScore) {
      trace.push({
        t: 65,
        type: "tactic_shift",
        description: `OVERTIME COMPLETE: Still deadlocked at ${homeScore}-${awayScore}. Proceeding to Penalty Shootout!`,
        team: "home",
      });

      let homeShootoutGoals = 0;
      let awayShootoutGoals = 0;

      // Best-of-3 Shootout Rounds
      for (let round = 1; round <= 3; round++) {
        const homeShooter = getRosterPlayerByRoleWeight(homeRoster, `Home Shooter ${round}`, rng);
        const homeShooterRating = homeRoster
          ? getPlayerOverall(homeRoster.find((p) => p.id === homeShooter.id))
          : 68;
        const awayGoalieRating = awayLines.goalie.defense;
        const homeProb = (homeShooterRating / (homeShooterRating + awayGoalieRating)) * 0.68;

        if (rng() < homeProb) {
          homeShootoutGoals++;
          trace.push({
            t: 65 + round,
            type: "goal",
            description: `SHOOTOUT R${round}: ${homeShooter.name} with a silky deke — GOAL!`,
            actorId: homeShooter.id,
            actorName: homeShooter.name,
            team: "home",
          });
        } else {
          trace.push({
            t: 65 + round,
            type: "card",
            description: `SHOOTOUT R${round}: ${homeShooter.name} denied with a pad save!`,
            actorId: homeShooter.id,
            actorName: homeShooter.name,
            team: "home",
          });
        }

        const awayShooter = getRosterPlayerByRoleWeight(awayRoster, `Away Shooter ${round}`, rng);
        const awayShooterRating = awayRoster
          ? getPlayerOverall(awayRoster.find((p) => p.id === awayShooter.id))
          : 68;
        const homeGoalieRating = homeLines.goalie.defense;
        const awayProb = (awayShooterRating / (awayShooterRating + homeGoalieRating)) * 0.68;

        if (rng() < awayProb) {
          awayShootoutGoals++;
          trace.push({
            t: 65 + round,
            type: "goal",
            description: `SHOOTOUT R${round}: ${awayShooter.name} beats the glove side — GOAL!`,
            actorId: awayShooter.id,
            actorName: awayShooter.name,
            team: "away",
          });
        } else {
          trace.push({
            t: 65 + round,
            type: "card",
            description: `SHOOTOUT R${round}: ${awayShooter.name} shot turned aside with the blocker!`,
            actorId: awayShooter.id,
            actorName: awayShooter.name,
            team: "away",
          });
        }
      }

      // Sudden Death Shootout rounds if tied after 3 rounds
      let sdRound = 4;
      while (homeShootoutGoals === awayShootoutGoals && sdRound <= 10) {
        const homeShooter = getRosterPlayerByRoleWeight(homeRoster, `Home Shooter ${sdRound}`, rng);
        const homeShooterRating = homeRoster
          ? getPlayerOverall(homeRoster.find((p) => p.id === homeShooter.id))
          : 68;
        const awayGoalieRating = awayLines.goalie.defense;
        const homeScores = rng() < (homeShooterRating / (homeShooterRating + awayGoalieRating)) * 0.68;

        const awayShooter = getRosterPlayerByRoleWeight(awayRoster, `Away Shooter ${sdRound}`, rng);
        const awayShooterRating = awayRoster
          ? getPlayerOverall(awayRoster.find((p) => p.id === awayShooter.id))
          : 68;
        const homeGoalieRating = homeLines.goalie.defense;
        const awayScores = rng() < (awayShooterRating / (awayShooterRating + homeGoalieRating)) * 0.68;

        if (homeScores) homeShootoutGoals++;
        if (awayScores) awayShootoutGoals++;

        trace.push({
          t: 65 + sdRound,
          type: "tactic_shift",
          description: `SHOOTOUT Sudden Death R${sdRound - 3}: Home ${homeScores ? "SCORES (Goal!)" : "MISSED (No Goal)"} | Away ${awayScores ? "SCORES (Goal!)" : "MISSED (No Goal)"}`,
          team: "home",
        });

        sdRound++;
      }

      if (homeShootoutGoals > awayShootoutGoals) {
        homeScore++;
        trace.push({
          t: 76,
          type: "goal",
          description: `FINAL: Home team secures the extra point, winning the shootout ${homeShootoutGoals}-${awayShootoutGoals}!`,
          team: "home",
        });
      } else {
        awayScore++;
        trace.push({
          t: 76,
          type: "goal",
          description: `FINAL: Away team secures the extra point, winning the shootout ${awayShootoutGoals}-${homeShootoutGoals}!`,
          team: "away",
        });
      }
    }
  }

  return { homeScore, awayScore, trace };
}
