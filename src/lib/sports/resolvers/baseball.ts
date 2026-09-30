import type { EventTraceStep } from "../types";
import type { SportResolverContext, SportMatchOutcome } from "./types";
import { extractBaseballRoster, getPlayerOverall } from "./helpers";

export function runBaseballMatch(ctx: SportResolverContext): SportMatchOutcome {
  const { rng, homeOffense, awayOffense, homeRoster, awayRoster } = ctx;

  const trace: EventTraceStep[] = [];
  let homeScore = 0;
  let awayScore = 0;

  const homeLine = extractBaseballRoster(homeRoster, homeOffense);
  const awayLine = extractBaseballRoster(awayRoster, awayOffense);

  trace.push({
    t: 0,
    type: "tactic_shift",
    description: `Play ball! Match begins. Home Pitcher: SP ${homeLine.sp.firstName} ${homeLine.sp.lastName} | Away Pitcher: SP ${awayLine.sp.firstName} ${awayLine.sp.lastName}.`,
    team: "home",
  });

  const inningsCount = 9;
  let homeOrderIdx = 0;
  let awayOrderIdx = 0;

  let homeActivePitcher = homeLine.sp;
  let awayActivePitcher = awayLine.sp;
  let homePitcherType: "SP" | "RP" | "CP" = "SP";
  let awayPitcherType: "SP" | "RP" | "CP" = "SP";
  let homePitcherFatigue = 0;
  let awayPitcherFatigue = 0;

  for (let inning = 1; inning <= inningsCount; inning++) {
    // 1. Top of the inning (Away batting, Home pitching)
    {
      let outs = 0;
      let bases = [false, false, false];

      if (homePitcherType === "SP" && inning >= 6 && (homePitcherFatigue >= 75 || awayScore >= 4)) {
        homeActivePitcher = homeLine.rp;
        homePitcherType = "RP";
        homePitcherFatigue = 0;
        trace.push({
          t: inning,
          type: "tactic_shift",
          description: `[Top ${inning}] PITCHING CHANGE: RP ${homeLine.rp.firstName} ${homeLine.rp.lastName} enters the game, replacing SP ${homeLine.sp.firstName} ${homeLine.sp.lastName}.`,
          actorId: homeLine.rp.id,
          actorName: `${homeLine.rp.firstName} ${homeLine.rp.lastName}`,
          team: "home",
        });
      }
      if (
        homePitcherType === "RP" &&
        inning === 9 &&
        homeScore > awayScore &&
        homeScore - awayScore <= 3
      ) {
        homeActivePitcher = homeLine.cp;
        homePitcherType = "CP";
        homePitcherFatigue = 0;
        trace.push({
          t: inning,
          type: "tactic_shift",
          description: `[Top ${inning}] PITCHING CHANGE: Closer CP ${homeLine.cp.firstName} ${homeLine.cp.lastName} enters the game to close it out.`,
          actorId: homeLine.cp.id,
          actorName: `${homeLine.cp.firstName} ${homeLine.cp.lastName}`,
          team: "home",
        });
      }

      while (outs < 3) {
        const awayBatter = awayRoster?.[awayOrderIdx % (awayRoster.length || 9)] ?? {
          id: `away_batter_${awayOrderIdx}`,
          firstName: "Away",
          lastName: `Batter ${awayOrderIdx + 1}`,
          position: "OF",
          ratings: { overall: awayOffense },
        };
        awayOrderIdx++;

        const batterOverall = getPlayerOverall(awayBatter);
        const pitcherOverall = Math.max(
          30,
          getPlayerOverall(homeActivePitcher) - Math.round(homePitcherFatigue / 3)
        );

        homePitcherFatigue += 1.2;

        const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
        const walkProb = 0.08;
        const kProb = 0.18;

        const roll = rng();
        if (roll < hitProb) {
          const hitTypeRoll = rng();
          let basesToAdvance = 1;
          let hitType = "single";

          if (hitTypeRoll < 0.65) {
            basesToAdvance = 1;
            hitType = "single";
          } else if (hitTypeRoll < 0.85) {
            basesToAdvance = 2;
            hitType = "double";
          } else if (hitTypeRoll < 0.95) {
            basesToAdvance = 3;
            hitType = "triple";
          } else {
            basesToAdvance = 4;
            hitType = "home run";
          }

          let runsScored = 0;
          if (basesToAdvance === 4) {
            runsScored = 1 + bases.filter(Boolean).length;
            bases = [false, false, false];
            awayScore += runsScored;
            homePitcherFatigue += runsScored * 4;
            trace.push({
              t: inning,
              type: "goal",
              description: `[Top ${inning}] HOME RUN! ${awayBatter.firstName} ${awayBatter.lastName} crushes a deep blast! ${runsScored} run(s) score. Score: Home ${homeScore} - Away ${awayScore}`,
              actorId: awayBatter.id,
              actorName: `${awayBatter.firstName} ${awayBatter.lastName}`,
              team: "away",
            });
          } else {
            for (let b = 2; b >= 0; b--) {
              if (bases[b]) {
                if (b + basesToAdvance >= 3) {
                  runsScored++;
                  bases[b] = false;
                } else {
                  bases[b + basesToAdvance] = true;
                  bases[b] = false;
                }
              }
            }
            bases[basesToAdvance - 1] = true;
            if (runsScored > 0) {
              awayScore += runsScored;
              homePitcherFatigue += runsScored * 4;
              trace.push({
                t: inning,
                type: "goal",
                description: `[Top ${inning}] RBI Hit! ${awayBatter.firstName} ${awayBatter.lastName} hits a ${hitType}! Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: awayBatter.id,
                actorName: `${awayBatter.firstName} ${awayBatter.lastName}`,
                team: "away",
              });
            }
          }
        } else if (roll < hitProb + walkProb) {
          let runsScored = 0;
          if (bases[0] && bases[1] && bases[2]) {
            runsScored = 1;
            awayScore++;
            homePitcherFatigue += 4;
          } else if (bases[0] && bases[1]) {
            bases[2] = true;
          } else if (bases[0]) {
            bases[1] = true;
          } else {
            bases[0] = true;
          }
          if (runsScored > 0) {
            trace.push({
              t: inning,
              type: "goal",
              description: `[Top ${inning}] Walk scores a run! ${awayBatter.firstName} ${awayBatter.lastName} walks. Score: Home ${homeScore} - Away ${awayScore}`,
              actorId: awayBatter.id,
              actorName: `${awayBatter.firstName} ${awayBatter.lastName}`,
              team: "away",
            });
          }
        } else if (roll < hitProb + walkProb + kProb) {
          outs++;
          if (rng() < 0.25) {
            trace.push({
              t: inning,
              type: "card",
              description: `[Top ${inning}] Strikeout! ${homeActivePitcher.firstName} ${homeActivePitcher.lastName} strikes out ${awayBatter.firstName} ${awayBatter.lastName}.`,
              actorId: homeActivePitcher.id,
              actorName: `${homeActivePitcher.firstName} ${homeActivePitcher.lastName}`,
              team: "home",
            });
          }
        } else {
          outs++;
        }
      }
    }

    // Bottom of the inning
    if (inning === 9 && homeScore > awayScore) {
      trace.push({
        t: inning,
        type: "tactic_shift",
        description: `Bottom 9th not played as Home team leads.`,
        team: "home",
      });
      break;
    }

    {
      let outs = 0;
      let bases = [false, false, false];

      if (awayPitcherType === "SP" && inning >= 6 && (awayPitcherFatigue >= 75 || homeScore >= 4)) {
        awayActivePitcher = awayLine.rp;
        awayPitcherType = "RP";
        awayPitcherFatigue = 0;
        trace.push({
          t: inning,
          type: "tactic_shift",
          description: `[Bottom ${inning}] PITCHING CHANGE: RP ${awayLine.rp.firstName} ${awayLine.rp.lastName} enters the game, replacing SP ${awayLine.sp.firstName} ${awayLine.sp.lastName}.`,
          actorId: awayLine.rp.id,
          actorName: `${awayLine.rp.firstName} ${awayLine.rp.lastName}`,
          team: "away",
        });
      }
      if (
        awayPitcherType === "RP" &&
        inning === 9 &&
        awayScore > homeScore &&
        awayScore - homeScore <= 3
      ) {
        awayActivePitcher = awayLine.cp;
        awayPitcherType = "CP";
        awayPitcherFatigue = 0;
        trace.push({
          t: inning,
          type: "tactic_shift",
          description: `[Bottom ${inning}] PITCHING CHANGE: Closer CP ${awayLine.cp.firstName} ${awayLine.cp.lastName} enters the game to close it out.`,
          actorId: awayLine.cp.id,
          actorName: `${awayLine.cp.firstName} ${awayLine.cp.lastName}`,
          team: "away",
        });
      }

      while (outs < 3) {
        const homeBatter = homeRoster?.[homeOrderIdx % (homeRoster.length || 9)] ?? {
          id: `home_batter_${homeOrderIdx}`,
          firstName: "Home",
          lastName: `Batter ${homeOrderIdx + 1}`,
          position: "OF",
          ratings: { overall: homeOffense },
        };
        homeOrderIdx++;

        const batterOverall = getPlayerOverall(homeBatter);
        const pitcherOverall = Math.max(
          30,
          getPlayerOverall(awayActivePitcher) - Math.round(awayPitcherFatigue / 3)
        );

        awayPitcherFatigue += 1.2;

        const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
        const walkProb = 0.08;
        const kProb = 0.18;

        const roll = rng();
        if (roll < hitProb) {
          const hitTypeRoll = rng();
          let basesToAdvance = 1;
          let hitType = "single";

          if (hitTypeRoll < 0.65) {
            basesToAdvance = 1;
            hitType = "single";
          } else if (hitTypeRoll < 0.85) {
            basesToAdvance = 2;
            hitType = "double";
          } else if (hitTypeRoll < 0.95) {
            basesToAdvance = 3;
            hitType = "triple";
          } else {
            basesToAdvance = 4;
            hitType = "home run";
          }

          let runsScored = 0;
          if (basesToAdvance === 4) {
            runsScored = 1 + bases.filter(Boolean).length;
            bases = [false, false, false];
            homeScore += runsScored;
            awayPitcherFatigue += runsScored * 4;
            trace.push({
              t: inning,
              type: "goal",
              description: `[Bottom ${inning}] HOME RUN! ${homeBatter.firstName} ${homeBatter.lastName} crushes a deep blast! ${runsScored} run(s) score. Score: Home ${homeScore} - Away ${awayScore}`,
              actorId: homeBatter.id,
              actorName: `${homeBatter.firstName} ${homeBatter.lastName}`,
              team: "home",
            });
          } else {
            for (let b = 2; b >= 0; b--) {
              if (bases[b]) {
                if (b + basesToAdvance >= 3) {
                  runsScored++;
                  bases[b] = false;
                } else {
                  bases[b + basesToAdvance] = true;
                  bases[b] = false;
                }
              }
            }
            bases[basesToAdvance - 1] = true;
            if (runsScored > 0) {
              homeScore += runsScored;
              awayPitcherFatigue += runsScored * 4;
              trace.push({
                t: inning,
                type: "goal",
                description: `[Bottom ${inning}] RBI Hit! ${homeBatter.firstName} ${homeBatter.lastName} hits a ${hitType}! Score: Home ${homeScore} - Away ${awayScore}`,
                actorId: homeBatter.id,
                actorName: `${homeBatter.firstName} ${homeBatter.lastName}`,
                team: "home",
              });
            }
          }

          if (inning === 9 && homeScore > awayScore) {
            trace.push({
              t: inning,
              type: "goal",
              description: `Walk-off victory for the home team!`,
              team: "home",
            });
            break;
          }
        } else if (roll < hitProb + walkProb) {
          let runsScored = 0;
          if (bases[0] && bases[1] && bases[2]) {
            runsScored = 1;
            homeScore++;
            awayPitcherFatigue += 4;
          } else if (bases[0] && bases[1]) {
            bases[2] = true;
          } else if (bases[0]) {
            bases[1] = true;
          } else {
            bases[0] = true;
          }
          if (runsScored > 0) {
            trace.push({
              t: inning,
              type: "goal",
              description: `[Bottom ${inning}] Walk scores a run! ${homeBatter.firstName} ${homeBatter.lastName} walks. Score: Home ${homeScore} - Away ${awayScore}`,
              actorId: homeBatter.id,
              actorName: `${homeBatter.firstName} ${homeBatter.lastName}`,
              team: "home",
            });
          }
          if (inning === 9 && homeScore > awayScore) {
            trace.push({
              t: inning,
              type: "goal",
              description: `Walk-off victory for the home team!`,
              team: "home",
            });
            break;
          }
        } else if (roll < hitProb + walkProb + kProb) {
          outs++;
          if (rng() < 0.25) {
            trace.push({
              t: inning,
              type: "card",
              description: `[Bottom ${inning}] Strikeout! ${awayActivePitcher.firstName} ${awayActivePitcher.lastName} strikes out ${homeBatter.firstName} ${homeBatter.lastName}.`,
              actorId: awayActivePitcher.id,
              actorName: `${awayActivePitcher.firstName} ${awayActivePitcher.lastName}`,
              team: "away",
            });
          }
        } else {
          outs++;
        }
      }
    }
  }

  // Extra Innings if tied
  let extraInning = 9;
  while (homeScore === awayScore && extraInning < 15) {
    extraInning++;
    trace.push({
      t: extraInning,
      type: "tactic_shift",
      description: `Tied at ${homeScore}-${awayScore}. Proceeding to Inning ${extraInning}!`,
      team: "home",
    });

    // Top Half
    {
      let outs = 0;
      while (outs < 3) {
        const awayBatter = awayRoster?.[awayOrderIdx % (awayRoster.length || 9)] ?? {
          id: `away_batter_${awayOrderIdx}`,
          firstName: "Away",
          lastName: `Batter ${awayOrderIdx + 1}`,
          position: "OF",
          ratings: { overall: awayOffense },
        };
        awayOrderIdx++;
        const batterOverall = getPlayerOverall(awayBatter);
        const pitcherOverall = Math.max(
          30,
          getPlayerOverall(homeActivePitcher) - Math.round(homePitcherFatigue / 3)
        );
        homePitcherFatigue += 1.2;

        const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
        if (rng() < hitProb) {
          awayScore++;
          trace.push({
            t: extraInning,
            type: "goal",
            description: `[Top ${extraInning}] Extra Innings RBI Hit! Score: Home ${homeScore} - Away ${awayScore}`,
            team: "away",
          });
        } else {
          outs++;
        }
      }
    }

    // Bottom Half
    {
      let outs = 0;
      while (outs < 3) {
        const homeBatter = homeRoster?.[homeOrderIdx % (homeRoster.length || 9)] ?? {
          id: `home_batter_${homeOrderIdx}`,
          firstName: "Home",
          lastName: `Batter ${homeOrderIdx + 1}`,
          position: "OF",
          ratings: { overall: homeOffense },
        };
        homeOrderIdx++;
        const batterOverall = getPlayerOverall(homeBatter);
        const pitcherOverall = Math.max(
          30,
          getPlayerOverall(awayActivePitcher) - Math.round(awayPitcherFatigue / 3)
        );
        awayPitcherFatigue += 1.2;

        const hitProb = 0.26 + (batterOverall - pitcherOverall) / 600;
        if (rng() < hitProb) {
          homeScore++;
          trace.push({
            t: extraInning,
            type: "goal",
            description: `[Bottom ${extraInning}] Extra Innings Walk-off Hit! Score: Home ${homeScore} - Away ${awayScore}`,
            team: "home",
          });
          if (homeScore > awayScore) break;
        } else {
          outs++;
        }
      }
    }
  }

  return { homeScore, awayScore, trace };
}
