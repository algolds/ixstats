import type { SportResolverContext, SportMatchOutcome, RosterPlayer } from "./types";
import { actorOf, createTrace, fullName, otherSide, sideLabel, type Side } from "./common";
import { extractFootballRoster } from "./helpers";
import { clamp } from "~/lib/utils";
import type { TeamRatingVector } from "../types";

type DriveResult = "td" | "fg" | "none" | "turnover";

interface TeamState {
  side: Side;
  ratings: TeamRatingVector;
  line: ReturnType<typeof extractFootballRoster>;
  score: number;
}

const QUARTER_NAMES = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];
const DRIVES_PER_QUARTER = 5;

export function runFootballMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng } = ctx;
  const { trace, push } = createTrace();

  const makeTeam = (
    side: Side,
    roster: RosterPlayer[] | undefined,
    offense: number,
    ratings: TeamRatingVector
  ): TeamState => ({ side, ratings, line: extractFootballRoster(roster, offense), score: 0 });
  const home = makeTeam("home", ctx.homeRoster, ctx.homeOffense, ctx.homeTeamModified);
  const away = makeTeam("away", ctx.awayRoster, ctx.awayOffense, ctx.awayTeamModified);
  const teams = { home, away };
  const scoreLine = () => `Score: Home ${home.score} - Away ${away.score}`;

  push(
    0,
    "tactic_shift",
    `Kickoff! Match begins. Home QB: ${fullName(home.line.qb)} | Away QB: ${fullName(away.line.qb)}.`,
    "home"
  );

  let possession: Side = rng() < 0.5 ? "home" : "away";
  let yardline = 25;

  const runDrive = (q: number, clock: string, driveTime: number): DriveResult => {
    const off = teams[possession];
    const def = teams[otherSide(possession)];
    const { qb, rb, wr, k, p } = off.line;
    const tag = `[Q${q} ${clock}]`;
    let down = 1;
    let yardsToGo = 10;
    let finished = false;
    let scoringPlay: DriveResult = "none";

    const advance = (gain: number) => {
      if (gain >= yardsToGo) {
        down = 1;
        yardsToGo = 10;
      } else {
        down++;
        yardsToGo -= gain;
      }
    };
    const turnover = (description: string, culprit: RosterPlayer) => {
      push(driveTime, "tactic_shift", `${tag} ${description}`, off.side, actorOf(culprit));
      possession = def.side;
      finished = true;
      scoringPlay = "turnover";
    };

    while (down <= 4 && !finished) {
      if (rng() < 0.55) {
        const intRoll = rng();
        const sackRoll = rng();
        const compRoll = rng();

        if (sackRoll < 0.06) {
          const loss = Math.floor(rng() * 6) + 4;
          yardline -= loss;
          down++;
          yardsToGo += loss;
        } else if (intRoll < 0.025) {
          turnover(`INTERCEPTION! ${fullName(qb)} pass intercepted by defense!`, qb);
          yardline = clamp(100 - (yardline + Math.floor(rng() * 15)), 20, 80);
        } else if (compRoll < 0.58 + (off.ratings.offense - def.ratings.defense) / 500) {
          const gains = Math.floor(rng() * 12) + (rng() < 0.15 ? Math.floor(rng() * 25) + 15 : 4);
          yardline += gains;
          if (gains > 25) {
            push(
              driveTime,
              "tactic_shift",
              `${tag} Deep Pass! ${fullName(qb)} completes a ${gains}-yard pass to ${fullName(wr)}!`,
              off.side,
              actorOf(qb)
            );
          }
          advance(gains);
        } else {
          down++;
        }
      } else if (rng() < 0.015) {
        turnover(`FUMBLE! ${fullName(rb)} fumbles the ball, recovered by defense!`, rb);
        yardline = clamp(100 - yardline, 20, 80);
      } else {
        const gains = Math.max(
          -3,
          2 +
            Math.floor(rng() * 6) +
            (rng() < 0.1 ? Math.floor(rng() * 15) : 0) +
            Math.round((off.ratings.offense - def.ratings.defense) / 100)
        );
        yardline += gains;
        advance(gains);
      }

      if (yardline >= 100) {
        const extraPoint = rng() < 0.96 ? 1 : 0;
        off.score += 6 + extraPoint;
        push(
          driveTime,
          "goal",
          `${tag} TOUCHDOWN! ${fullName(rb)} punches it into the endzone! PAT: ${extraPoint ? "Good" : "No Good"}. ${scoreLine()}`,
          off.side,
          actorOf(rb)
        );

        possession = def.side;
        const koReturn = 15 + Math.floor(rng() * 15) + (rng() < 0.01 ? 75 : 0);
        if (koReturn >= 90) {
          def.score += 7;
          push(
            driveTime,
            "goal",
            `${tag} KICKOFF RETURN TOUCHDOWN! Sensational special teams score! ${scoreLine()}`,
            def.side
          );
          possession = off.side;
          yardline = 25;
        } else {
          yardline = koReturn;
        }
        finished = true;
        scoringPlay = "td";
      }

      if (down === 4 && !finished) {
        if (yardline >= 65) {
          const fgDist = 100 - yardline + 17;
          if (rng() < 0.9 - (fgDist - 20) * 0.012) {
            off.score += 3;
            push(
              driveTime,
              "goal",
              `${tag} FIELD GOAL! ${fullName(k)} converts a ${fgDist}-yard field goal. ${scoreLine()}`,
              off.side,
              actorOf(k)
            );
            scoringPlay = "fg";
          } else {
            push(
              driveTime,
              "tactic_shift",
              `${tag} Field Goal Missed! ${fullName(k)} pushes a ${fgDist}-yard kick wide.`,
              off.side,
              actorOf(k)
            );
          }
          yardline = 100 - Math.max(20, yardline - 7);
        } else {
          const puntDist = Math.floor(rng() * 15) + 35;
          const puntReturn = Math.floor(rng() * 8);
          yardline = clamp(100 - (yardline + puntDist - puntReturn), 10, 90);
          push(
            driveTime,
            "tactic_shift",
            `${tag} Punt: ${fullName(p)} punts the ball ${puntDist} yards. Returned ${puntReturn} yards.`,
            off.side,
            actorOf(p)
          );
        }
        possession = def.side;
        finished = true;
      }
    }
    return scoringPlay;
  };

  for (let q = 1; q <= 4; q++) {
    const startT = (q - 1) * 15;
    push(
      startT,
      "tactic_shift",
      `Start of the ${QUARTER_NAMES[q - 1]}. Possession: ${sideLabel(possession)} team.`,
      possession
    );

    for (let drive = 1; drive <= DRIVES_PER_QUARTER; drive++) {
      const driveTime = startT + Math.round((drive / DRIVES_PER_QUARTER) * 14);
      const seconds = Math.floor(rng() * 60);
      runDrive(q, `${driveTime}:${String(seconds).padStart(2, "0")}`, driveTime);
    }

    push(
      q * 15,
      "tactic_shift",
      `End of the ${QUARTER_NAMES[q - 1]}. Current Score: Home ${home.score} - Away ${away.score}`,
      "home"
    );
  }

  if (home.score === away.score) {
    push(
      60,
      "tactic_shift",
      `END OF REGULATION: Tied at ${home.score}-${away.score}. Proceeding to Overtime under possession rules.`,
      possession
    );

    const firstPossession = possession;
    let firstDriveFg = false;
    for (let drive = 1; drive < 6; drive++) {
      const offTeam = possession;
      const play = runDrive(5, `OT drive ${drive}`, 60 + drive);
      const scored = play === "td" || play === "fg";

      let ending: [string, Side] | null = null;
      if (drive === 1) {
        if (play === "td") ending = ["Walk-off Touchdown! Game ends.", offTeam];
        firstDriveFg = play === "fg";
      } else if (drive === 2 && firstDriveFg) {
        if (play === "td") ending = ["Touchdown walk-off wins the game!", offTeam];
        else if (!scored) ending = ["Defense stands! First possession team wins.", firstPossession];
      } else if (scored) {
        ending = [
          drive === 2 ? "Walk-off score! Game ends." : "Sudden death walk-off score! Game ends.",
          offTeam,
        ];
      }
      if (ending) {
        push(65, "goal", `OVERTIME: ${ending[0]}`, ending[1]);
        break;
      }
    }
  }

  return { homeScore: home.score, awayScore: away.score, trace };
}
