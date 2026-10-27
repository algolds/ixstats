import type { SportResolverContext, SportMatchOutcome, RosterPlayer } from "./types";
import { createTrace, otherSide, sideLabel, type Side } from "./common";
import { getPlayerOverall, getRosterPlayerByRoleWeight, getCardPlayerWeight } from "./helpers";
import { clamp } from "~/lib/utils";

interface TeamState {
  side: Side;
  roster?: RosterPlayer[];
  offense: number;
  defense: number;
  tactic: string;
  score: number;
  redCards: number;
}

type Named = { id: string; name: string };

const PASSIVE_EVENTS = [
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

const GOAL_TEXT = {
  home: {
    goal: "finds the back of the net!",
    shot: "fires a powerful shot, but the keeper makes a diving save!",
  },
  away: {
    goal: "strikes a clinical finish!",
    shot: "tests the goalkeeper from distance, but it's held safely.",
  },
} as const;

export function runSoccerMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng } = ctx;
  const { trace, push } = createTrace();

  const makeTeam = (
    side: Side,
    roster: RosterPlayer[] | undefined,
    offense: number,
    defense: number,
    tactic: string
  ): TeamState => ({
    side,
    roster,
    offense,
    defense,
    tactic,
    score: 0,
    redCards: 0,
  });
  const home = makeTeam("home", ctx.homeRoster, ctx.homeOffense, ctx.homeDefense, ctx.homeTactical);
  const away = makeTeam("away", ctx.awayRoster, ctx.awayOffense, ctx.awayDefense, ctx.awayTactical);
  const teams = [home, away] as const;
  const byName = { home, away };

  push(
    0,
    "tactic_shift",
    `Match begins. Home team using ${home.tactic.replace(/_/g, " ")} tactics. Away team using ${away.tactic.replace(/_/g, " ")} tactics.`,
    "home"
  );

  const yellowCards = new Map<string, number>();
  const sentOff = new Set<string>();

  const selectActivePlayer = (roster: RosterPlayer[] | undefined, defaultName: string): Named => {
    if (!roster || roster.length === 0) return { id: "generic", name: defaultName };
    const available = roster.filter((p) => !sentOff.has(p.id));
    if (available.length === 0) {
      return { id: roster[0]!.id, name: `${roster[0]!.firstName} ${roster[0]!.lastName}` };
    }
    return getRosterPlayerByRoleWeight(available, defaultName, rng);
  };

  const selectActiveCardPlayer = (roster: RosterPlayer[] | undefined): Named | null => {
    const available = roster?.filter((p) => !sentOff.has(p.id));
    return available?.length ? getCardPlayerWeight(available, rng) : null;
  };

  const sendOff = (team: TeamState, player: Named) => {
    sentOff.add(player.id);
    team.redCards++;
  };

  /** Late-game tactical switches: the trailing side goes all-out at 60', a 2+ goal leader parks the bus at 75'. */
  const adjustTactics = (t: number) => {
    for (const team of teams) {
      const opponent = byName[otherSide(team.side)];
      const label = sideLabel(team.side);
      if (t === 60 && opponent.score > team.score && team.tactic !== "all_out_attack") {
        team.tactic = "all_out_attack";
        push(
          t,
          "tactic_shift",
          `Tactical Shift: ${label} team switches to All-Out Attack to chase the game!`,
          team.side
        );
        return;
      }
      if (t === 75 && team.score - opponent.score >= 2 && team.tactic !== "park_the_bus") {
        team.tactic = "park_the_bus";
        push(
          t,
          "tactic_shift",
          `Tactical Shift: ${label} team switches to Park the Bus to lock down the victory.`,
          team.side
        );
        return;
      }
    }
  };

  const discipline = (t: number) => {
    if (rng() < 0.03) {
      const team = byName[rng() < 0.5 ? "home" : "away"];
      const player = selectActiveCardPlayer(team.roster);
      if (player) {
        const yellows = (yellowCards.get(player.id) ?? 0) + 1;
        yellowCards.set(player.id, yellows);
        if (yellows === 2) {
          sendOff(team, player);
          push(
            t,
            "card",
            `RED CARD! ${player.name} is sent off after receiving a second yellow card!`,
            team.side,
            player
          );
        } else {
          push(
            t,
            "card",
            `Yellow Card shown to ${player.name} for a rough tactical challenge.`,
            team.side,
            player
          );
        }
      }
    }

    if (rng() < 0.0015) {
      const team = byName[rng() < 0.5 ? "home" : "away"];
      const player = selectActiveCardPlayer(team.roster);
      if (player) {
        sendOff(team, player);
        push(
          t,
          "card",
          `STRAIGHT RED CARD! ${player.name} is sent off for violent conduct!`,
          team.side,
          player
        );
      }
    }

    if (rng() < 0.005) {
      const team = byName[rng() < 0.5 ? "home" : "away"];
      if (team.roster && team.roster.length > 0) {
        const player = selectActivePlayer(team.roster, `${sideLabel(team.side)} Player`);
        if (player.id !== "generic") {
          sentOff.add(player.id);
          push(
            t,
            "injury",
            `INJURY: ${player.name} is forced off the field with an injury!`,
            team.side,
            player
          );
        }
      }
    }
  };

  const tick = (t: number) => {
    const eventsBefore = trace.length;
    adjustTactics(t);

    const goalProb = (off: TeamState, def: TeamState) => {
      const attack = off.offense * Math.pow(0.9, off.redCards);
      const defend = def.defense * Math.pow(0.85, def.redCards);
      return (attack / (attack + defend)) * 0.13 + (off.tactic === "all_out_attack" ? 0.015 : 0);
    };
    const probs = { home: goalProb(home, away), away: goalProb(away, home) };

    for (const team of teams) {
      const text = GOAL_TEXT[team.side];
      if (rng() < probs[team.side]) {
        team.score++;
        const scorer = selectActivePlayer(team.roster, `${sideLabel(team.side)} Striker`);
        push(
          t,
          "goal",
          `GOAL! ${scorer.name} ${text.goal} Score: Home ${home.score} - Away ${away.score}`,
          team.side,
          scorer
        );
      } else if (rng() < 0.1) {
        const shooter = selectActivePlayer(team.roster, `${sideLabel(team.side)} Attacker`);
        push(t, "tactic_shift", `Shot! ${shooter.name} ${text.shot}`, team.side, shooter);
      }
    }

    discipline(t);

    if (trace.length === eventsBefore && rng() < 0.5) {
      const description = PASSIVE_EVENTS[Math.floor(rng() * PASSIVE_EVENTS.length)]!;
      push(t, "tactic_shift", description, rng() < 0.5 ? "home" : "away");
    }
  };

  const tied = () => home.score === away.score;
  const knockout = ctx.archetype === "bracket" || ctx.isPlayoff;

  for (let t = 5; t <= 90; t += 5) tick(t);

  if (knockout && tied()) {
    push(
      90,
      "tactic_shift",
      `END OF REGULATION: Tied at ${home.score}-${away.score}. Proceeding to 30 minutes of Extra Time.`,
      "home"
    );
    for (let t = 95; t <= 120; t += 5) tick(t);
  }

  if (knockout && tied()) {
    push(
      120,
      "tactic_shift",
      `END OF EXTRA TIME: Still tied at ${home.score}-${away.score}. Proceeding to Penalty Shootout!`,
      "home"
    );
    const goals = { home: 0, away: 0 };

    const penaltyKick = (team: TeamState, round: number) => {
      const shooter = selectActivePlayer(team.roster, `${sideLabel(team.side)} Shooter`);
      const rating =
        shooter.id !== "generic" && team.roster
          ? getPlayerOverall(team.roster.find((p) => p.id === shooter.id))
          : 65;
      const scored = rng() < clamp(0.75 + (rating - 70) / 600, 0.5, 0.95);
      if (scored) goals[team.side]++;
      push(
        121 + round,
        scored ? "goal" : "card",
        `PENALTY KICK (Round ${round}): ${shooter.name} ${scored ? "SCORES" : "MISSES"} for the ${team.side} team!`,
        team.side,
        shooter
      );
    };

    let round = 1;
    for (; round <= 5; round++) {
      penaltyKick(home, round);
      penaltyKick(away, round);
      const remaining = 5 - round;
      if (Math.abs(goals.home - goals.away) > remaining) break;
    }
    while (goals.home === goals.away && round < 15) {
      round++;
      penaltyKick(home, round);
      penaltyKick(away, round);
    }

    const winner = goals.home > goals.away ? home : away;
    winner.score++;
    push(
      140,
      "goal",
      `Shootout finished: ${sideLabel(winner.side)} team wins the shootout ${goals[winner.side]}-${goals[otherSide(winner.side)]}!`,
      winner.side
    );
  }

  return { homeScore: home.score, awayScore: away.score, trace };
}
