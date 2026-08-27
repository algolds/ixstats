import type { EventTraceStep } from "../types";
import type { SportResolverContext, SportMatchOutcome, RosterPlayer } from "./types";
import {
  getPlayerOverall,
  getRosterPlayerByRoleWeight,
  getCardPlayerWeight,
} from "./helpers";
import { clamp } from "~/lib/utils";

export function runSoccerMatch(ctx: SportResolverContext): SportMatchOutcome {
  const {
    rng,
    homeOffense,
    homeDefense,
    awayOffense,
    awayDefense,
    homeTactical: initialHomeTactical,
    awayTactical: initialAwayTactical,
    isPlayoff,
    archetype,
    homeRoster,
    awayRoster,
  } = ctx;

  let homeTactical = initialHomeTactical;
  let awayTactical = initialAwayTactical;

  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  trace.push({
    t: 0,
    type: "tactic_shift",
    description: `Match begins. Home team using ${homeTactical.replace(/_/g, " ")} tactics. Away team using ${awayTactical.replace(/_/g, " ")} tactics.`,
    team: "home",
  });

  const playerYellowCards = new Map<string, number>();
  const sentOffPlayers = new Set<string>();
  let homeRedCardsCount = 0;
  let awayRedCardsCount = 0;

  const selectActivePlayer = (
    roster: RosterPlayer[] | undefined,
    defaultName: string
  ): { id: string; name: string } => {
    if (!roster || roster.length === 0) return { id: "generic", name: defaultName };
    const available = roster.filter((p) => !sentOffPlayers.has(p.id));
    if (available.length === 0)
      return { id: roster[0]!.id, name: `${roster[0]!.firstName} ${roster[0]!.lastName}` };
    return getRosterPlayerByRoleWeight(available, defaultName, rng);
  };

  const selectActiveCardPlayer = (
    roster: RosterPlayer[] | undefined
  ): { id: string; name: string } | null => {
    if (!roster || roster.length === 0) return null;
    const available = roster.filter((p) => !sentOffPlayers.has(p.id));
    if (available.length === 0) return null;
    return getCardPlayerWeight(available, rng);
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

    const homeOffScale = Math.pow(0.9, homeRedCardsCount);
    const homeDefScale = Math.pow(0.85, homeRedCardsCount);
    const awayOffScale = Math.pow(0.9, awayRedCardsCount);
    const awayDefScale = Math.pow(0.85, awayRedCardsCount);

    const baseGoalProb = 0.13;
    const homeGoalProb =
      ((homeOffense * homeOffScale) / (homeOffense * homeOffScale + awayDefense * awayDefScale)) *
        baseGoalProb +
      (homeTactical === "all_out_attack" ? 0.015 : 0);
    const awayGoalProb =
      ((awayOffense * awayOffScale) / (awayOffense * awayOffScale + homeDefense * homeDefScale)) *
        baseGoalProb +
      (awayTactical === "all_out_attack" ? 0.015 : 0);

    if (rng() < homeGoalProb) {
      homeScore++;
      const scorer = selectActivePlayer(homeRoster, "Home Striker");
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
        const shooter = selectActivePlayer(homeRoster, "Home Attacker");
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

    if (rng() < awayGoalProb) {
      awayScore++;
      const scorer = selectActivePlayer(awayRoster, "Away Striker");
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
        const shooter = selectActivePlayer(awayRoster, "Away Attacker");
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

    if (rng() < 0.03) {
      const cardTeam = rng() < 0.5 ? "home" : "away";
      const roster = cardTeam === "home" ? homeRoster : awayRoster;
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

    if (rng() < 0.0015) {
      const cardTeam = rng() < 0.5 ? "home" : "away";
      const roster = cardTeam === "home" ? homeRoster : awayRoster;
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

    if (rng() < 0.005) {
      const injuryTeam = rng() < 0.5 ? "home" : "away";
      const roster = injuryTeam === "home" ? homeRoster : awayRoster;
      if (roster && roster.length > 0) {
        const player = selectActivePlayer(
          roster,
          `${injuryTeam === "home" ? "Home" : "Away"} Player`
        );
        if (player && player.id !== "generic") {
          sentOffPlayers.add(player.id);
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
        const desc = passiveEvents[Math.floor(rng() * passiveEvents.length)]!;
        trace.push({
          t,
          type: "tactic_shift",
          description: desc,
          team: rng() < 0.5 ? "home" : "away",
        });
      }
    }
  };

  for (let t = 5; t <= 90; t += 5) {
    runSoccerTick(t);
  }

  const isPlayoffOrBracket = archetype === "bracket" || isPlayoff;
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
      const roster = team === "home" ? homeRoster : awayRoster;
      const shooter = selectActivePlayer(roster, `${team === "home" ? "Home" : "Away"} Shooter`);
      const shooterRating =
        shooter.id !== "generic" && roster
          ? getPlayerOverall(roster.find((p) => p.id === shooter.id))
          : 65;
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

    let activeRound = 1;
    for (; activeRound <= 5; activeRound++) {
      if (runPenaltyKick("home", activeRound)) homeShootoutGoals++;
      if (runPenaltyKick("away", activeRound)) awayShootoutGoals++;

      const homeRemaining = 5 - activeRound;
      const awayRemaining = 5 - activeRound;
      if (homeShootoutGoals > awayShootoutGoals + awayRemaining) break;
      if (awayShootoutGoals > homeShootoutGoals + homeRemaining) break;
    }

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

  return { homeScore, awayScore, trace };
}
