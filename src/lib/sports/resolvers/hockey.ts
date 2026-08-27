import type { EventTraceStep } from "../types";
import type { SportResolverContext, SportMatchOutcome } from "./types";
import {
  extractHockeyLines,
  getPlayerOverall,
  getRosterPlayerByRoleWeight,
  getCardPlayerWeight,
} from "./helpers";

export function runHockeyMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng, homeOffense, awayOffense, homeTactical, awayTactical, homeRoster, awayRoster } = ctx;

  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeLines = extractHockeyLines(homeRoster, homeOffense);
  const awayLines = extractHockeyLines(awayRoster, awayOffense);

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
        const player = getCardPlayerWeight(homeRoster, rng);
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
        const player = getCardPlayerWeight(awayRoster, rng);
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
      const playerH = getCardPlayerWeight(homeRoster, rng);
      const playerA = getCardPlayerWeight(awayRoster, rng);
      trace.push({
        t,
        type: "injury",
        description: `FIGHT MAJOR: ${playerH ? playerH.name : "Home player"} and ${playerA ? playerA.name : "Away player"} assess 5 mins for fighting.`,
        actorId: playerH?.id,
        actorName: playerH?.name,
        team: "home",
      });
    }

    // Goalie Pulling at t >= 55
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

    const homeGoalProb = (hOff / (hOff + aDef)) * 0.18 + (awayGoaliePulled ? 0.2 : 0);
    const awayGoalProb = (aOff / (aOff + hDef)) * 0.18 + (homeGoaliePulled ? 0.2 : 0);

    if (rng() < homeGoalProb) {
      homeScore++;
      const scorer = getRosterPlayerByRoleWeight(homeRoster, "Home Attacker", rng);
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
      const scorer = getRosterPlayerByRoleWeight(awayRoster, "Away Attacker", rng);
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
    const otDefenseAway = ctx.awayDefense - 10;
    const otOffenseAway = awayOffense + 20;
    const otDefenseHome = ctx.homeDefense - 10;

    const otHomeGoalProb = (otOffenseHome / (otOffenseHome + otDefenseAway)) * 0.3;
    const otAwayGoalProb = (otOffenseAway / (otOffenseAway + otDefenseHome)) * 0.3;

    if (rng() < otHomeGoalProb) {
      homeScore++;
      const scorer = getRosterPlayerByRoleWeight(homeRoster, "Home Attacker", rng);
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
      const scorer = getRosterPlayerByRoleWeight(awayRoster, "Away Attacker", rng);
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
      const homeShooter = getRosterPlayerByRoleWeight(homeRoster, `Home Shooter ${round}`, rng);
      const homeShooterRating = homeRoster
        ? getPlayerOverall(homeRoster.find((p) => p.id === homeShooter.id))
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

      const awayShooter = getRosterPlayerByRoleWeight(awayRoster, `Away Shooter ${round}`, rng);
      const awayShooterRating = awayRoster
        ? getPlayerOverall(awayRoster.find((p) => p.id === awayShooter.id))
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
      const homeShooter = getRosterPlayerByRoleWeight(homeRoster, `Home Shooter ${sdRound}`, rng);
      const homeShooterRating = homeRoster
        ? getPlayerOverall(homeRoster.find((p) => p.id === homeShooter.id))
        : 65;
      const awayGoalieOverall = awayLines.goalie.defense;
      const homeProb = homeShooterRating / (homeShooterRating + awayGoalieOverall);
      const homeScores = rng() < homeProb * 0.7;

      const awayShooter = getRosterPlayerByRoleWeight(awayRoster, `Away Shooter ${sdRound}`, rng);
      const awayShooterRating = awayRoster
        ? getPlayerOverall(awayRoster.find((p) => p.id === awayShooter.id))
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

  return { homeScore, awayScore, trace };
}
