import type { SportResolverContext, SportMatchOutcome, RosterPlayer } from "./types";
import { actorOf, createTrace, fullName, otherSide, sideLabel, type Side } from "./common";
import {
  extractBasketballRoster,
  getPlayerOverall,
  getRosterPlayerByRoleWeight,
  getCardPlayerWeight,
} from "./helpers";
import { clamp } from "~/lib/utils";

interface TeamState {
  side: Side;
  roster?: RosterPlayer[];
  starters: RosterPlayer[];
  offense: number;
  defense: number;
  coaching: number;
  score: number;
}

const QUARTER_NAMES = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];
const USAGE_WEIGHTS = [0.25, 0.25, 0.2, 0.15, 0.15];
const POSSESSIONS_PER_QUARTER = 24;

export function runBasketballMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng } = ctx;
  const { trace, push } = createTrace();

  const makeTeam = (
    side: Side,
    roster: RosterPlayer[] | undefined,
    offense: number,
    defense: number,
    coaching: number
  ): TeamState => {
    const { pg, sg, sf, pf, c } = extractBasketballRoster(roster, offense);
    return { side, roster, starters: [pg, sg, sf, pf, c], offense, defense, coaching, score: 0 };
  };
  const home = makeTeam(
    "home",
    ctx.homeRoster,
    ctx.homeOffense,
    ctx.homeDefense,
    ctx.homeTeamModified.coaching
  );
  const away = makeTeam(
    "away",
    ctx.awayRoster,
    ctx.awayOffense,
    ctx.awayDefense,
    ctx.awayTeamModified.coaching
  );
  const teams = { home, away };
  const scoreLine = () => `Score: Home ${home.score} - Away ${away.score}`;

  push(
    0,
    "tactic_shift",
    `Tip-off! Match begins. Home: PG ${fullName(home.starters[0]!)} | Away: PG ${fullName(away.starters[0]!)}.`,
    "home"
  );

  const freeThrows = (shooter: RosterPlayer, count: number): number => {
    const ftProb = clamp(0.75 + (getPlayerOverall(shooter) - 65) / 300, 0.45, 0.95);
    let made = 0;
    for (let i = 0; i < count; i++) {
      if (rng() < ftProb) made++;
    }
    return made;
  };

  /** Usage-weighted shooter, then whether the attempt is a three and its make probability. */
  const prepareShot = (off: TeamState, def: TeamState) => {
    let usageRoll = rng();
    let shooter = off.starters[0]!;
    for (let i = 0; i < off.starters.length; i++) {
      usageRoll -= USAGE_WEIGHTS[i]!;
      if (usageRoll <= 0) {
        shooter = off.starters[i]!;
        break;
      }
    }
    const isThree = rng() < 0.35;
    const shootProb = (isThree ? 0.35 : 0.47) + (off.offense - def.defense) / 300;
    return { shooter, isThree, shootProb };
  };

  const possession = (
    off: TeamState,
    def: TeamState,
    q: number,
    posTime: number,
    clock: string
  ) => {
    const tag = `[Q${q} ${clock}]`;

    if (rng() < 0.12 - off.coaching / 1000) {
      const turnoverPlayer = getRosterPlayerByRoleWeight(
        off.roster,
        `${sideLabel(off.side)} Player`,
        rng
      );
      const stealPlayer = getCardPlayerWeight(def.roster, rng);
      if (rng() < 0.5 && stealPlayer) {
        push(
          posTime,
          "card",
          `${tag} Steal! ${stealPlayer.name} intercepts a pass from ${turnoverPlayer.name}.`,
          def.side,
          stealPlayer
        );
      } else {
        push(
          posTime,
          "card",
          `${tag} Turnover: ${turnoverPlayer.name} commits a bad pass out of bounds.`,
          off.side,
          turnoverPlayer
        );
      }
      return;
    }

    const { shooter, isThree, shootProb } = prepareShot(off, def);
    const name = fullName(shooter);
    const points = isThree ? 3 : 2;

    if (rng() < (isThree ? 0.06 : 0.12)) {
      if (rng() < shootProb) {
        const ftMade = freeThrows(shooter, 1);
        off.score += points + ftMade;
        push(
          posTime,
          "goal",
          `${tag} BASKET & ONE! ${name} scores a ${points}pt shot and is fouled. FT: ${ftMade ? "GOOD" : "MISSED"}. ${scoreLine()}`,
          off.side,
          actorOf(shooter)
        );
      } else {
        const ftCount = points;
        const ftsMade = freeThrows(shooter, ftCount);
        off.score += ftsMade;
        push(
          posTime,
          "goal",
          `${tag} FOUL on the shot! ${name} is fouled while shooting. FTs: ${ftsMade}/${ftCount}. ${scoreLine()}`,
          off.side,
          actorOf(shooter)
        );
      }
    } else if (rng() < shootProb) {
      off.score += points;
      push(
        posTime,
        "goal",
        `${tag} BASKET! ${name} hits a ${isThree ? "three-pointer" : "mid-range jumper"}. ${scoreLine()}`,
        off.side,
        actorOf(shooter)
      );
    } else if (rng() < 0.25) {
      const rebounder = getRosterPlayerByRoleWeight(
        off.roster,
        `${sideLabel(off.side)} Rebounder`,
        rng
      );
      push(
        posTime,
        "tactic_shift",
        `${tag} Offensive Rebound secured by ${rebounder.name}.`,
        off.side,
        rebounder
      );
      if (rng() < 0.45) {
        off.score += 2;
        push(
          posTime,
          "goal",
          `${tag} BASKET! ${rebounder.name} scores on a quick putback! ${scoreLine()}`,
          off.side,
          rebounder
        );
      }
    }
  };

  for (let q = 1; q <= 4; q++) {
    const startT = (q - 1) * 12;
    push(startT, "tactic_shift", `Start of the ${QUARTER_NAMES[q - 1]}.`, "home");

    for (let pos = 1; pos <= POSSESSIONS_PER_QUARTER; pos++) {
      const posTime = startT + Math.round((pos / POSSESSIONS_PER_QUARTER) * 11);
      const seconds = Math.floor(rng() * 60);
      const clock = `${posTime}:${String(seconds).padStart(2, "0")}`;
      possession(home, away, q, posTime, clock);
      possession(away, home, q, posTime, clock);
    }

    push(
      q * 12,
      "tactic_shift",
      `End of the ${QUARTER_NAMES[q - 1]}. Current Score: Home ${home.score} - Away ${away.score}`,
      "home"
    );
  }

  for (let ot = 1; home.score === away.score && ot <= 5; ot++) {
    const otTime = 48 + ot * 5;
    push(
      otTime - 5,
      "tactic_shift",
      `END OF REGULATION/OT: Tied at ${home.score}-${away.score}. Proceeding to 5-minute Overtime (OT ${ot}).`,
      "home"
    );

    for (let pos = 1; pos <= 10; pos++) {
      const off = pos % 2 === 0 ? home : away;
      const def = teams[otherSide(off.side)];
      const tag = `[OT ${ot}]`;

      if (rng() < 0.1) {
        const player = getRosterPlayerByRoleWeight(
          off.roster,
          `${sideLabel(off.side)} Player`,
          rng
        );
        push(otTime, "card", `${tag} Turnover: ${player.name} loses possession.`, off.side, player);
        continue;
      }

      const { shooter, isThree, shootProb } = prepareShot(off, def);
      const name = fullName(shooter);
      const points = isThree ? 3 : 2;
      if (rng() < 0.1) {
        const ftsMade = freeThrows(shooter, points);
        off.score += ftsMade;
        push(
          otTime,
          "goal",
          `${tag} Shooting Foul! ${name} shoots free throws: ${ftsMade}/${points}. ${scoreLine()}`,
          off.side,
          actorOf(shooter)
        );
      } else if (rng() < shootProb) {
        off.score += points;
        push(
          otTime,
          "goal",
          `${tag} BASKET! ${name} hits a ${points}pt shot. ${scoreLine()}`,
          off.side,
          actorOf(shooter)
        );
      }
    }
  }

  return { homeScore: home.score, awayScore: away.score, trace };
}
