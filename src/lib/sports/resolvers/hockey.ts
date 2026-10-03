/**
 * Ice hockey resolver: 3 x 20-minute periods of 2-minute ticks (Line 1 / Line 2 shifts), minor
 * penalties (power plays), period-2 fight majors with the long-change defensive penalty, period-3
 * goalie pulls, a 5-minute 3-on-3 overtime and a penalty shootout.
 */

import type { SportResolverContext, SportMatchOutcome, RosterPlayer } from "./types";
import { createTrace, otherSide, sideLabel, SIDES, type Side } from "./common";
import {
  extractHockeyLines,
  getPlayerOverall,
  getRosterPlayerByRoleWeight,
  getCardPlayerWeight,
} from "./helpers";

interface TeamState {
  side: Side;
  roster?: RosterPlayer[];
  offense: number;
  defense: number;
  lines: ReturnType<typeof extractHockeyLines>;
  score: number;
  powerPlayMins: number;
  majorPenaltyMins: number;
  goaliePulled: boolean;
}

const INFRACTIONS = [
  "slashing",
  "hooking",
  "tripping",
  "cross-checking",
  "holding",
  "high-sticking",
];

/** Flavour text per scoring side. */
const GOAL_TEXT = {
  home: {
    goal: "snaps a one-timer past the netminder!",
    emptyNet: "sends the puck all the way down the ice into the empty net!",
    powerPlay: "capitalizes with the man-advantage!",
    overtime: "wins it on a 2-on-1 rush! Sudden death game over!",
    shootoutGoal: "with a silky deke — GOAL!",
    shootoutSave: "denied with a pad save!",
  },
  away: {
    goal: "buries a rebound for the away team!",
    emptyNet: "clears the zone and hits the empty cage!",
    powerPlay: "strikes on the power play!",
    overtime: "fires a laser off the crossbar and in! Away team wins in OT!",
    shootoutGoal: "beats the glove side — GOAL!",
    shootoutSave: "shot turned aside with the blocker!",
  },
} as const;

export function runHockeyMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng, homeTactical, awayTactical } = ctx;
  const { trace, push } = createTrace();

  const makeTeam = (
    side: Side,
    roster: RosterPlayer[] | undefined,
    offense: number,
    defense: number
  ): TeamState => ({
    side,
    roster,
    offense,
    defense,
    lines: extractHockeyLines(roster, offense),
    score: 0,
    powerPlayMins: 0,
    majorPenaltyMins: 0,
    goaliePulled: false,
  });
  const home = makeTeam("home", ctx.homeRoster, ctx.homeOffense, ctx.homeDefense);
  const away = makeTeam("away", ctx.awayRoster, ctx.awayOffense, ctx.awayDefense);
  const teams = [home, away] as const;
  const byName = { home, away };

  push(
    0,
    "tactic_shift",
    `Puck drop! Match underway. Home system: ${homeTactical.replace(/_/g, " ")}. Away system: ${awayTactical.replace(/_/g, " ")}.`,
    "home"
  );

  const minorPenalty = (t: number, period: number) => {
    if (!(rng() < 0.06 && home.powerPlayMins === 0 && away.powerPlayMins === 0)) return;
    const penalized = byName[rng() < 0.5 ? "home" : "away"];
    const infraction = INFRACTIONS[Math.floor(rng() * INFRACTIONS.length)] ?? "tripping";
    const beneficiary = byName[otherSide(penalized.side)];
    beneficiary.powerPlayMins = 2;
    const player = getCardPlayerWeight(penalized.roster, rng);
    push(
      t,
      "card",
      `PENALTY (P${period}): ${player ? player.name : `${sideLabel(penalized.side)} player`} assessed 2 mins for ${infraction}. ${sideLabel(beneficiary.side)} POWER PLAY!`,
      penalized.side,
      player
    );
  };

  const fightMajor = (t: number, period: number) => {
    if (
      period !== 2 ||
      !(rng() < 0.035 && home.majorPenaltyMins === 0 && away.majorPenaltyMins === 0)
    ) {
      return;
    }
    const playerH = getCardPlayerWeight(home.roster, rng);
    const playerA = getCardPlayerWeight(away.roster, rng);
    home.majorPenaltyMins = 5;
    away.majorPenaltyMins = 5;
    push(
      t,
      "injury",
      `FIGHT MAJOR (P2): Gloves dropped! ${playerH ? playerH.name : "Home forward"} and ${playerA ? playerA.name : "Away defenseman"} exchange blows at center ice. 5-minute majors assessed!`,
      "home",
      playerH
    );
  };

  const maybePullGoalie = (t: number) => {
    for (const trailing of teams) {
      const leader = byName[otherSide(trailing.side)];
      const deficit = leader.score - trailing.score;
      if (deficit > 0 && deficit <= 2 && !trailing.goaliePulled) {
        trailing.goaliePulled = true;
        push(
          t,
          "tactic_shift",
          `TACTIC SHIFT (P3 ${t}m): ${sideLabel(trailing.side)} coach signals to bench — Goalie pulled for the 6-on-5 extra attacker!`,
          trailing.side
        );
        return;
      }
    }
  };

  /** Per-side offense/defense for the active lines: long-change fatigue, power plays, goalie pull/goalie. */
  const shiftRatings = (period: number, activeLine: Record<Side, "line1" | "line2">) => {
    const shift = {
      home: { off: home.lines[activeLine.home].offense, def: home.lines[activeLine.home].defense },
      away: { off: away.lines[activeLine.away].offense, def: away.lines[activeLine.away].defense },
    };
    if (period === 2) {
      for (const side of SIDES) shift[side].def = Math.max(20, shift[side].def * 0.92);
    }
    for (const team of teams) {
      if (team.powerPlayMins > 0) {
        shift[team.side].off += 14;
        shift[otherSide(team.side)].def -= 10;
      }
    }
    for (const team of teams) {
      const s = shift[team.side];
      if (team.goaliePulled) s.off += 22;
      else s.def = s.def * 0.6 + team.lines.goalie.defense * 0.4;
    }
    return shift;
  };

  const scoreGoals = (t: number, period: number, goalProb: Record<Side, number>) => {
    for (const team of teams) {
      if (rng() >= goalProb[team.side]) continue;
      team.score++;
      const scorer = getRosterPlayerByRoleWeight(
        team.roster,
        `${sideLabel(team.side)} Attacker`,
        rng
      );
      const text = GOAL_TEXT[team.side];
      const where = `(P${period} ${t}m) ${scorer.name}`;
      let description = `GOAL! ${where} ${text.goal}`;
      if (byName[otherSide(team.side)].goaliePulled) {
        description = `EMPTY NET GOAL! ${where} ${text.emptyNet}`;
      } else if (team.powerPlayMins > 0) {
        description = `POWER PLAY GOAL! ${where} ${text.powerPlay}`;
        team.powerPlayMins = 0; // minor penalty ends on a power-play goal
      }
      push(t, "goal", description, team.side, scorer);
    }
  };

  const tick = (t: number) => {
    const period = t <= 20 ? 1 : t <= 40 ? 2 : 3;

    for (const team of teams) {
      team.powerPlayMins = Math.max(0, team.powerPlayMins - 2);
      team.majorPenaltyMins = Math.max(0, team.majorPenaltyMins - 2);
    }

    if (t === 20 || t === 40) {
      push(
        t,
        "tactic_shift",
        `END OF ${t === 20 ? "1ST" : "2ND"} PERIOD: Score is ${home.score}-${away.score}. Ice clean & ${t === 20 ? "1st" : "2nd"} intermission.`,
        "home"
      );
    }

    // Line shift selection (Line 1 ~55%, Line 2 ~45%)
    const activeLine = {
      home: rng() < 0.55 ? "line1" : "line2",
      away: rng() < 0.55 ? "line1" : "line2",
    } as const;

    minorPenalty(t, period);
    fightMajor(t, period);
    if (period === 3 && t >= 56) maybePullGoalie(t);

    const shift = shiftRatings(period, activeLine);
    const baseShotRate = 0.085;
    const goalProb = {
      home:
        (shift.home.off / (shift.home.off + shift.away.def)) * baseShotRate +
        (away.goaliePulled ? 0.09 : 0),
      away:
        (shift.away.off / (shift.away.off + shift.home.def)) * baseShotRate +
        (home.goaliePulled ? 0.09 : 0),
    };

    scoreGoals(t, period, goalProb);
  };

  for (let t = 2; t <= 60; t += 2) tick(t);

  if (home.score !== away.score) return { homeScore: home.score, awayScore: away.score, trace };

  // 5-minute 3-on-3 sudden-death overtime (61..65)
  push(
    60,
    "tactic_shift",
    `END OF REGULATION: 60 minutes complete tied ${home.score}-${away.score}. Proceeding to 5-Minute 3-on-3 Sudden Death Overtime!`,
    "home"
  );
  const otProb = (off: TeamState, def: TeamState) => {
    const attack = off.offense + 25;
    return (attack / (attack + Math.max(15, def.defense - 15))) * 0.28;
  };
  const overtimeProb = { home: otProb(home, away), away: otProb(away, home) };

  for (let otMin = 1; otMin <= 5; otMin++) {
    const winner = teams.find((team) => rng() < overtimeProb[team.side]);
    if (!winner) continue;
    winner.score++;
    const scorer = getRosterPlayerByRoleWeight(
      winner.roster,
      `${sideLabel(winner.side)} Attacker`,
      rng
    );
    push(
      60 + otMin,
      "goal",
      `OVERTIME WINNER! (OT ${otMin}m) ${scorer.name} ${GOAL_TEXT[winner.side].overtime}`,
      winner.side,
      scorer
    );
    return { homeScore: home.score, awayScore: away.score, trace };
  }

  if (home.score === away.score) {
    push(
      65,
      "tactic_shift",
      `OVERTIME COMPLETE: Still deadlocked at ${home.score}-${away.score}. Proceeding to Penalty Shootout!`,
      "home"
    );
    runShootout();
  }
  return { homeScore: home.score, awayScore: away.score, trace };

  function runShootout() {
    const goals = { home: 0, away: 0 };

    const shoot = (team: TeamState, round: number) => {
      const shooter = getRosterPlayerByRoleWeight(
        team.roster,
        `${sideLabel(team.side)} Shooter ${round}`,
        rng
      );
      const rating = team.roster
        ? getPlayerOverall(team.roster.find((p) => p.id === shooter.id))
        : 68;
      const goalie = byName[otherSide(team.side)].lines.goalie.defense;
      const scored = rng() < (rating / (rating + goalie)) * 0.68;
      if (scored) goals[team.side]++;
      return { shooter, scored };
    };

    for (let round = 1; round <= 3; round++) {
      for (const team of teams) {
        const { shooter, scored } = shoot(team, round);
        const text = GOAL_TEXT[team.side];
        push(
          65 + round,
          scored ? "goal" : "card",
          `SHOOTOUT R${round}: ${shooter.name} ${scored ? text.shootoutGoal : text.shootoutSave}`,
          team.side,
          shooter
        );
      }
    }

    // Sudden-death rounds while still tied
    for (let round = 4; goals.home === goals.away && round <= 10; round++) {
      const [h, a] = teams.map((team) => shoot(team, round).scored);
      push(
        65 + round,
        "tactic_shift",
        `SHOOTOUT Sudden Death R${round - 3}: Home ${h ? "SCORES (Goal!)" : "MISSED (No Goal)"} | Away ${a ? "SCORES (Goal!)" : "MISSED (No Goal)"}`,
        "home"
      );
    }

    const winner = goals.home > goals.away ? home : away;
    winner.score++;
    push(
      76,
      "goal",
      `FINAL: ${sideLabel(winner.side)} team secures the extra point, winning the shootout ${goals[winner.side]}-${goals[otherSide(winner.side)]}!`,
      winner.side
    );
  }
}
