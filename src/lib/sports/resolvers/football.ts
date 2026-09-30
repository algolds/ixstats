import type { EventTraceStep } from "../types";
import type { SportResolverContext, SportMatchOutcome } from "./types";
import { extractFootballRoster } from "./helpers";

export function runFootballMatch(ctx: SportResolverContext): SportMatchOutcome {
  const {
    rng,
    homeOffense,
    awayOffense,
    homeTeamModified,
    awayTeamModified,
    homeRoster,
    awayRoster,
  } = ctx;

  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeLine = extractFootballRoster(homeRoster, homeOffense);
  const awayLine = extractFootballRoster(awayRoster, awayOffense);

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
            const gains = Math.floor(rng() * 12) + (rng() < 0.15 ? Math.floor(rng() * 25) + 15 : 4);
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
        const koReturn = 15 + Math.floor(rng() * 15) + (rng() < 0.01 ? 75 : 0);
        if (koReturn >= 90) {
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
      description: `END OF REGULATION: Tied at ${homeScore}-${awayScore}. Proceeding to Overtime under possession rules.`,
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
            trace.push({
              t: 65,
              type: "goal",
              description: `OVERTIME: Touchdown walk-off wins the game!`,
              team: activeOffTeam,
            });
            otCompleted = true;
          } else if (currentScore === "fg") {
            firstDriveScore = "none";
          } else {
            trace.push({
              t: 65,
              type: "goal",
              description: `OVERTIME: Defense stands! First possession team wins.`,
              team: firstPossessionTeam,
            });
            otCompleted = true;
          }
        } else {
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

  return { homeScore, awayScore, trace };
}
