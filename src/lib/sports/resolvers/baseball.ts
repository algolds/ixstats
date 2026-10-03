import type { SportResolverContext, SportMatchOutcome, RosterPlayer } from "./types";
import { actorOf, createTrace, fullName, sideLabel, type Side } from "./common";
import { extractBaseballRoster, getPlayerOverall } from "./helpers";

type HalfLabel = "Top" | "Bottom";

interface TeamState {
  side: Side;
  score: number;
  orderIdx: number;
  roster?: RosterPlayer[];
  offense: number;
  line: ReturnType<typeof extractBaseballRoster>;
  pitcher: RosterPlayer;
  pitcherType: "SP" | "RP" | "CP";
  fatigue: number;
}

const WALK_PROB = 0.08;
const STRIKEOUT_PROB = 0.18;
const MAX_INNING = 15;
/** [upper roll bound, hit type, bases advanced]; anything above the last bound is a home run. */
const HIT_TYPES = [
  [0.65, "single", 1],
  [0.85, "double", 2],
  [0.95, "triple", 3],
] as const;

export function runBaseballMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng } = ctx;
  const { trace, push } = createTrace();

  const makeTeam = (side: Side, roster: RosterPlayer[] | undefined, offense: number): TeamState => {
    const line = extractBaseballRoster(roster, offense);
    return {
      side,
      score: 0,
      orderIdx: 0,
      roster,
      offense,
      line,
      pitcher: line.sp,
      pitcherType: "SP",
      fatigue: 0,
    };
  };
  const home = makeTeam("home", ctx.homeRoster, ctx.homeOffense);
  const away = makeTeam("away", ctx.awayRoster, ctx.awayOffense);

  const scoreLine = () => `Score: Home ${home.score} - Away ${away.score}`;

  push(
    0,
    "tactic_shift",
    `Play ball! Match begins. Home Pitcher: SP ${fullName(home.line.sp)} | Away Pitcher: SP ${fullName(away.line.sp)}.`,
    "home"
  );

  const changePitcher = (inning: number, label: HalfLabel, pit: TeamState, bat: TeamState) => {
    const { sp, rp, cp } = pit.line;
    if (pit.pitcherType === "SP" && inning >= 6 && (pit.fatigue >= 75 || bat.score >= 4)) {
      pit.pitcher = rp;
      pit.pitcherType = "RP";
      pit.fatigue = 0;
      push(
        inning,
        "tactic_shift",
        `[${label} ${inning}] PITCHING CHANGE: RP ${fullName(rp)} enters the game, replacing SP ${fullName(sp)}.`,
        pit.side,
        actorOf(rp)
      );
    }
    const lead = pit.score - bat.score;
    if (pit.pitcherType === "RP" && inning === 9 && lead > 0 && lead <= 3) {
      pit.pitcher = cp;
      pit.pitcherType = "CP";
      pit.fatigue = 0;
      push(
        inning,
        "tactic_shift",
        `[${label} ${inning}] PITCHING CHANGE: Closer CP ${fullName(cp)} enters the game to close it out.`,
        pit.side,
        actorOf(cp)
      );
    }
  };

  /** Next batter in the order, and the hit probability against the (tiring) pitcher. */
  const faceBatter = (bat: TeamState, pit: TeamState) => {
    const batter: RosterPlayer = bat.roster?.[bat.orderIdx % (bat.roster.length || 9)] ?? {
      id: `${bat.side}_batter_${bat.orderIdx}`,
      firstName: sideLabel(bat.side),
      lastName: `Batter ${bat.orderIdx + 1}`,
      position: "OF",
      ratings: { overall: bat.offense },
    };
    bat.orderIdx++;
    const pitcherOverall = Math.max(
      30,
      getPlayerOverall(pit.pitcher) - Math.round(pit.fatigue / 3)
    );
    pit.fatigue += 1.2;
    return { batter, hitProb: 0.26 + (getPlayerOverall(batter) - pitcherOverall) / 600 };
  };

  const playHalf = (inning: number, label: HalfLabel, bat: TeamState, pit: TeamState) => {
    changePitcher(inning, label, pit, bat);
    const tag = `[${label} ${inning}]`;
    let outs = 0;
    let bases = [false, false, false];

    while (outs < 3) {
      const { batter, hitProb } = faceBatter(bat, pit);
      const roll = rng();

      if (roll < hitProb) {
        const hitRoll = rng();
        const [, hitType, advance] = HIT_TYPES.find(([bound]) => hitRoll < bound) ?? [
          1,
          "home run",
          4,
        ];
        let runs = 0;
        if (advance === 4) {
          runs = 1 + bases.filter(Boolean).length;
          bases = [false, false, false];
        } else {
          for (let b = 2; b >= 0; b--) {
            if (!bases[b]) continue;
            bases[b] = false;
            if (b + advance >= 3) runs++;
            else bases[b + advance] = true;
          }
          bases[advance - 1] = true;
        }
        if (runs > 0) {
          bat.score += runs;
          pit.fatigue += runs * 4;
          push(
            inning,
            "goal",
            advance === 4
              ? `${tag} HOME RUN! ${fullName(batter)} crushes a deep blast! ${runs} run(s) score. ${scoreLine()}`
              : `${tag} RBI Hit! ${fullName(batter)} hits a ${hitType}! ${scoreLine()}`,
            bat.side,
            actorOf(batter)
          );
        }
      } else if (roll < hitProb + WALK_PROB) {
        if (bases.every(Boolean)) {
          bat.score++;
          pit.fatigue += 4;
          push(
            inning,
            "goal",
            `${tag} Walk scores a run! ${fullName(batter)} walks. ${scoreLine()}`,
            bat.side,
            actorOf(batter)
          );
        } else {
          bases[bases.indexOf(false)] = true;
        }
      } else {
        outs++;
        if (roll < hitProb + WALK_PROB + STRIKEOUT_PROB && rng() < 0.25) {
          push(
            inning,
            "card",
            `${tag} Strikeout! ${fullName(pit.pitcher)} strikes out ${fullName(batter)}.`,
            pit.side,
            actorOf(pit.pitcher)
          );
        }
      }

      const batterReached = roll < hitProb + WALK_PROB;
      if (label === "Bottom" && batterReached && inning === 9 && bat.score > pit.score) {
        push(inning, "goal", "Walk-off victory for the home team!", "home");
        break;
      }
    }
  };

  const playExtraHalf = (inning: number, label: HalfLabel, bat: TeamState, pit: TeamState) => {
    for (let outs = 0; outs < 3;) {
      if (rng() >= faceBatter(bat, pit).hitProb) {
        outs++;
        continue;
      }
      bat.score++;
      push(
        inning,
        "goal",
        `[${label} ${inning}] Extra Innings ${label === "Top" ? "RBI" : "Walk-off"} Hit! ${scoreLine()}`,
        bat.side
      );
      if (label === "Bottom" && bat.score > pit.score) break;
    }
  };

  for (let inning = 1; inning <= 9; inning++) {
    playHalf(inning, "Top", away, home);
    if (inning === 9 && home.score > away.score) {
      push(inning, "tactic_shift", "Bottom 9th not played as Home team leads.", "home");
      break;
    }
    playHalf(inning, "Bottom", home, away);
  }

  for (let inning = 10; home.score === away.score && inning <= MAX_INNING; inning++) {
    push(
      inning,
      "tactic_shift",
      `Tied at ${home.score}-${away.score}. Proceeding to Inning ${inning}!`,
      "home"
    );
    playExtraHalf(inning, "Top", away, home);
    playExtraHalf(inning, "Bottom", home, away);
  }

  return { homeScore: home.score, awayScore: away.score, trace };
}
