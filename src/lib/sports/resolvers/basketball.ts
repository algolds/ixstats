import type { EventTraceStep } from "../types";
import type { SportResolverContext, SportMatchOutcome } from "./types";
import {
  extractBasketballRoster,
  getPlayerOverall,
  getRosterPlayerByRoleWeight,
  getCardPlayerWeight,
} from "./helpers";
import { clamp } from "~/lib/utils";

export function runBasketballMatch(ctx: SportResolverContext): SportMatchOutcome {
  const {
    rng,
    homeOffense,
    homeDefense,
    awayOffense,
    awayDefense,
    homeTeamModified,
    awayTeamModified,
    homeRoster,
    awayRoster,
  } = ctx;

  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeLine = extractBasketballRoster(homeRoster, homeOffense);
  const awayLine = extractBasketballRoster(awayRoster, awayOffense);

  trace.push({
    t: 0,
    type: "tactic_shift",
    description: `Tip-off! Match begins. Home: PG ${homeLine.pg.firstName} ${homeLine.pg.lastName} | Away: PG ${awayLine.pg.firstName} ${awayLine.pg.lastName}.`,
    team: "home",
  });

  const quarters = [1, 2, 3, 4];
  const quarterNames = ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"];

  let _homeTeamFouls = 0;
  let _awayTeamFouls = 0;

  const runFreeThrows = (shooter: any, _team: "home" | "away", count: number): number => {
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

    _homeTeamFouls = 0;
    _awayTeamFouls = 0;

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
          const homeTurnoverPlayer = getRosterPlayerByRoleWeight(homeRoster, "Home Player", rng);
          const awayStealPlayer = getCardPlayerWeight(awayRoster, rng);
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
          let shooter = players[0]!;
          for (let i = 0; i < players.length; i++) {
            usageRoll -= usageWeights[i]!;
            if (usageRoll <= 0) {
              shooter = players[i]!;
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
            _awayTeamFouls++;
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
                const reber = getRosterPlayerByRoleWeight(homeRoster, "Home Rebounder", rng);
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
          const awayTurnoverPlayer = getRosterPlayerByRoleWeight(awayRoster, "Away Player", rng);
          const homeStealPlayer = getCardPlayerWeight(homeRoster, rng);
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
          let shooter = players[0]!;
          for (let i = 0; i < players.length; i++) {
            usageRoll -= usageWeights[i]!;
            if (usageRoll <= 0) {
              shooter = players[i]!;
              break;
            }
          }

          const isThree = rng() < 0.35;
          const baseProb = isThree ? 0.35 : 0.47;
          const diffMod = (awayOffense - homeDefense) / 300;
          const shootProb = baseProb + diffMod;

          const isFouled = rng() < (isThree ? 0.06 : 0.12);

          if (isFouled) {
            _homeTeamFouls++;
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
                const reber = getRosterPlayerByRoleWeight(awayRoster, "Away Rebounder", rng);
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

    for (let pos = 1; pos <= 10; pos++) {
      const team = pos % 2 === 0 ? "home" : "away";
      const offLine = team === "home" ? homeLine : awayLine;
      const offOffense = team === "home" ? homeOffense : awayOffense;
      const defDefense = team === "home" ? awayDefense : homeDefense;

      if (rng() < 0.1) {
        const toPlayer = getRosterPlayerByRoleWeight(
          team === "home" ? homeRoster : awayRoster,
          `${team === "home" ? "Home" : "Away"} Player`,
          rng
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
        const players = [offLine.pg, offLine.sg, offLine.sf, offLine.pf, offLine.c];
        const usageWeights = [0.25, 0.25, 0.2, 0.15, 0.15];
        let usageRoll = rng();
        let shooter = players[0]!;
        for (let i = 0; i < players.length; i++) {
          usageRoll -= usageWeights[i]!;
          if (usageRoll <= 0) {
            shooter = players[i]!;
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
            actorName: `${shooter.firstName} ${shooter.lastName}`,
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

  return { homeScore, awayScore, trace };
}
