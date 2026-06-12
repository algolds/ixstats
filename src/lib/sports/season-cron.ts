/**
 * IxTime Sports Season Auto-Advance Cron
 *
 * Runs periodically (every 6 hours in production) to advance in-progress
 * sports seasons by one match day, race, or bracket round.
 *
 * In dev mode, seasons are advanced manually via the "Simulate" UI buttons.
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";
import { resolveMatch, resolveRace, createRNG } from "./resolver";
import type { TeamRatingVector } from "./resolver";
import { transitionToNextStage } from "./transition";

type Prisma = PrismaClient;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function computePlayerAvg(ratings: Record<string, number>): number {
  const values = Object.values(ratings);
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function defaultRatingVector(): TeamRatingVector {
  return { overall: 50, offense: 50, defense: 50, form: 50, depth: 50, coaching: 50 };
}

// ─── Season completion ──────────────────────────────────────────────

async function completeSeason(
  prisma: Prisma,
  season: { id: string; leagueId: string; league: { archetype: string; sportPreset: string } }
): Promise<void> {
  const ixNow = IxTime.getCurrentIxTime();

  await prisma.sportSeason.update({
    where: { id: season.id },
    data: { status: "completed", endIxTime: ixNow },
  });

  // Determine champion based on archetype
  if (season.league.archetype === "league" || season.league.archetype === "division_conference") {
    const standings = await prisma.sportStanding.findMany({
      where: { seasonId: season.id },
      orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
      select: {
        teamId: true,
        points: true,
        wins: true,
        draws: true,
        losses: true,
        pointsFor: true,
        pointsAgainst: true,
      },
    });

    if (standings.length > 0) {
      const champion = standings[0]!;
      await prisma.sportSeason.update({
        where: { id: season.id },
        data: { championTeamId: champion.teamId },
      });

      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: season.leagueId,
          seasonId: season.id,
          recordType: "champion",
          holderId: champion.teamId,
          value: `Season Champion (${champion.wins}W-${champion.draws}D-${champion.losses}L, ${champion.points} pts)`,
        },
      });

      if (standings.length >= 2) {
        await prisma.sportSeasonRecord.create({
          data: {
            leagueId: season.leagueId,
            seasonId: season.id,
            recordType: "runner_up",
            holderId: standings[1]!.teamId,
            value: `Season Runner-up (${standings[1]!.wins}W-${standings[1]!.draws}D-${standings[1]!.losses}L, ${standings[1]!.points} pts)`,
          },
        });
      }
    }
  }

  if (season.league.archetype === "bracket") {
    const lastRound = await prisma.sportBracket.findFirst({
      where: { seasonId: season.id, status: "completed" },
      orderBy: { round: "desc" },
      select: { winnerId: true },
    });

    if (lastRound?.winnerId) {
      const championTeam = await prisma.sportTeam.findUnique({
        where: { id: lastRound.winnerId },
        include: {
          players: { where: { isActive: true }, take: 1 },
        },
      });

      if (championTeam) {
        const championPlayer = championTeam.players[0];
        const fighterName = championPlayer
          ? `${championPlayer.firstName} ${championPlayer.lastName}`
          : championTeam.name;

        await prisma.sportSeason.update({
          where: { id: season.id },
          data: { championTeamId: championTeam.id },
        });

        await prisma.sportSeasonRecord.create({
          data: {
            leagueId: season.leagueId,
            seasonId: season.id,
            recordType: "champion",
            holderId: championTeam.id,
            value: `${fighterName} — Bracket Champion`,
          },
        });
      }
    }
  }

  if (season.league.archetype === "circuit") {
    // Determine constructor champion from race results
    const races = await prisma.sportRace.findMany({
      where: { seasonId: season.id, status: "completed" },
      select: { results: true },
    });

    const constructorPoints = new Map<string, number>();

    for (const race of races) {
      const results = (race.results as any[]) ?? [];
      for (const pos of results) {
        constructorPoints.set(
          pos.teamId,
          (constructorPoints.get(pos.teamId) ?? 0) + (pos.points ?? 0)
        );
      }
    }

    let bestTeamId = "";
    let bestPoints = -1;
    for (const [teamId, points] of constructorPoints) {
      if (points > bestPoints) {
        bestPoints = points;
        bestTeamId = teamId;
      }
    }

    if (bestTeamId) {
      await prisma.sportSeason.update({
        where: { id: season.id },
        data: { championTeamId: bestTeamId },
      });

      await prisma.sportSeasonRecord.create({
        data: {
          leagueId: season.leagueId,
          seasonId: season.id,
          recordType: "constructors_champion",
          holderId: bestTeamId,
          value: `Constructors Champion — ${bestPoints} pts`,
        },
      });
    }
  }

  // Automatically transition to the next season
  try {
    const { transitionSeasonAction } = await import("./transition");
    await transitionSeasonAction(prisma, season.id);
  } catch (error) {
    console.error(
      `[Cron] Sports: Failed to automatically transition completed season ${season.id}:`,
      error instanceof Error ? error.message : error
    );
  }
}

// ─── League / Division Conference advance ───────────────────────────

async function advanceLeagueMatchDay(
  prisma: Prisma,
  season: { id: string; leagueId: string; league: { archetype: string; sportPreset: string } }
): Promise<boolean> {
  // Find the earliest match day with scheduled matches
  const scheduledMatches = await prisma.sportMatch.findMany({
    where: {
      seasonId: season.id,
      status: "scheduled",
      stage: (season as any).activeStage ?? 1,
    } as any,
    orderBy: { matchDay: "asc" },
    take: 100,
    select: { matchDay: true },
  });

  if (scheduledMatches.length === 0) return false;

  const targetMatchDay = scheduledMatches[0]!.matchDay;

  const matches = await prisma.sportMatch.findMany({
    where: {
      seasonId: season.id,
      matchDay: targetMatchDay,
      status: "scheduled",
      stage: (season as any).activeStage ?? 1,
    } as any,
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (matches.length === 0) return false;

  // Get team rating vectors from team seasons
  const teamSeasons = await prisma.sportTeamSeason.findMany({
    where: { seasonId: season.id },
    select: { teamId: true, ratingVector: true },
  });
  const ratingMap = new Map<string, TeamRatingVector>();
  for (const ts of teamSeasons) {
    const rv = (ts.ratingVector ?? {}) as Record<string, number>;
    ratingMap.set(ts.teamId, {
      overall: rv.overall ?? 50,
      offense: rv.offense ?? 50,
      defense: rv.defense ?? 50,
      form: rv.form ?? 50,
      depth: rv.depth ?? 50,
      coaching: rv.coaching ?? 50,
    });
  }

  const gotchas = new Map<string, { wins: number; losses: number; draws: number }>();
  for (const m of matches) {
    const homeRatings = ratingMap.get(m.homeTeamId) ?? defaultRatingVector();
    const awayRatings = ratingMap.get(m.awayTeamId) ?? defaultRatingVector();
    const matchSeed = hashString(m.id) + targetMatchDay * 7919;

    const result = resolveMatch({
      sport: season.league.sportPreset,
      homeTeam: homeRatings,
      awayTeam: awayRatings,
      archetype: season.league.archetype,
      seed: matchSeed,
    });

    const ixNow = IxTime.getCurrentIxTime();

    await prisma.sportMatch.update({
      where: { id: m.id },
      data: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: "completed",
        resolvedIxTime: ixNow,
        matchStats: {
          keyStats: result.keyStats,
          evaluation: result.evaluation,
          trace: result.trace,
        } as any,
        homeRatingBefore: { ...homeRatings },
        awayRatingBefore: { ...awayRatings },
        homeRatingAfter: {
          ...homeRatings,
          overall: Math.round((homeRatings.overall + result.homeRatingDelta) * 100) / 100,
        },
        awayRatingAfter: {
          ...awayRatings,
          overall: Math.round((awayRatings.overall + result.awayRatingDelta) * 100) / 100,
        },
      },
    });

    // Update team season rating vectors
    await prisma.sportTeamSeason.updateMany({
      where: { seasonId: season.id, teamId: m.homeTeamId },
      data: {
        ratingVector: {
          ...homeRatings,
          overall: Math.round((homeRatings.overall + result.homeRatingDelta) * 100) / 100,
        },
      },
    });
    await prisma.sportTeamSeason.updateMany({
      where: { seasonId: season.id, teamId: m.awayTeamId },
      data: {
        ratingVector: {
          ...awayRatings,
          overall: Math.round((awayRatings.overall + result.awayRatingDelta) * 100) / 100,
        },
      },
    });

    // Track result for standings
    const homeRec = gotchas.get(m.homeTeamId) ?? { wins: 0, losses: 0, draws: 0 };
    const awayRec = gotchas.get(m.awayTeamId) ?? { wins: 0, losses: 0, draws: 0 };

    if (result.winner === "home") {
      homeRec.wins++;
      awayRec.losses++;
    } else if (result.winner === "away") {
      awayRec.wins++;
      homeRec.losses++;
    } else {
      homeRec.draws++;
      awayRec.draws++;
    }
    gotchas.set(m.homeTeamId, homeRec);
    gotchas.set(m.awayTeamId, awayRec);
  }

  // Update standings
  for (const [teamId, rec] of gotchas) {
    const existing = await prisma.sportStanding.findUnique({
      where: { seasonId_teamId: { seasonId: season.id, teamId } },
    });

    if (existing) {
      const pointsForWin = season.league.archetype === "league" ? 3 : 2;
      const newPoints = existing.points + rec.wins * pointsForWin + rec.draws;

      await prisma.sportStanding.update({
        where: { id: existing.id },
        data: {
          wins: existing.wins + rec.wins,
          losses: existing.losses + rec.losses,
          draws: existing.draws + rec.draws,
          points: newPoints,
        },
      });
    } else {
      const pointsForWin = season.league.archetype === "league" ? 3 : 2;
      await prisma.sportStanding.create({
        data: {
          seasonId: season.id,
          teamId,
          wins: rec.wins,
          losses: rec.losses,
          draws: rec.draws,
          points: rec.wins * pointsForWin + rec.draws,
        },
      });
    }
  }

  // Re-rank standings
  const allStandings = await prisma.sportStanding.findMany({
    where: { seasonId: season.id },
    orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
  });

  for (let i = 0; i < allStandings.length; i++) {
    await prisma.sportStanding.update({
      where: { id: allStandings[i]!.id },
      data: { rank: i + 1 },
    });
  }

  // Check if season is complete
  const remainingScheduled = await prisma.sportMatch.count({
    where: {
      seasonId: season.id,
      status: "scheduled",
      stage: (season as any).activeStage ?? 1,
    } as any,
  });

  if (remainingScheduled === 0) {
    const transitioned = await transitionToNextStage(prisma, season.id);
    if (!transitioned) {
      await completeSeason(prisma, season);
    }
  }

  return true;
}

// ─── Circuit advance ────────────────────────────────────────────────

async function advanceCircuitRace(
  prisma: Prisma,
  season: { id: string; leagueId: string; league: { archetype: string; sportPreset: string } }
): Promise<boolean> {
  // Find the next upcoming or qualifying_complete race
  let race = await prisma.sportRace.findFirst({
    where: { seasonId: season.id, status: "upcoming" },
    orderBy: { raceNumber: "asc" },
  });

  if (!race) {
    // Try qualifying_complete
    race = await prisma.sportRace.findFirst({
      where: { seasonId: season.id, status: "qualifying_complete" },
      orderBy: { raceNumber: "asc" },
    });
  }

  if (!race) return false;

  // Get all drivers for the season's teams
  const teams = await prisma.sportTeam.findMany({
    where: {
      leagueId: season.leagueId,
      players: { some: { position: "driver", isActive: true } },
    },
    include: {
      players: {
        where: { position: "driver", isActive: true },
        select: { id: true, ratings: true },
      },
    },
  });

  const allDrivers: Array<{
    driverId: string;
    teamId: string;
    pace: number;
    consistency: number;
    wetSkill: number;
    overtaking: number;
    tyreManagement: number;
    starts: number;
  }> = [];

  for (const team of teams) {
    for (const driver of team.players) {
      const r = (driver.ratings ?? {}) as Record<string, number>;
      allDrivers.push({
        driverId: driver.id,
        teamId: team.id,
        pace: r.pace ?? 50,
        consistency: r.consistency ?? 50,
        wetSkill: r.wetSkill ?? 50,
        overtaking: r.overtaking ?? 50,
        tyreManagement: r.tyreManagement ?? 50,
        starts: r.starts ?? 50,
      });
    }
  }

  if (allDrivers.length === 0) return false;

  const raceSeed = hashString(race.id) + race.raceNumber * 7919;
  const rng = createRNG(raceSeed);
  const isWet = rng() < 0.2;

  const result = resolveRace({
    drivers: allDrivers,
    seed: raceSeed + 1,
    isWet,
  });

  const ixNow = IxTime.getCurrentIxTime();

  await prisma.sportRace.update({
    where: { id: race.id },
    data: {
      status: "completed",
      raceIxTime: race.raceIxTime ?? ixNow,
      grid:
        race.grid ??
        JSON.stringify(
          allDrivers.map((d, idx) => ({
            driverId: d.driverId,
            teamId: d.teamId,
            gridPosition: idx + 1,
          }))
        ),
      results: JSON.stringify(result.positions),
      weather: isWet ? "wet" : "dry",
    },
  });

  // Check if season complete
  const remainingRaces = await prisma.sportRace.count({
    where: { seasonId: season.id, status: { in: ["upcoming", "qualifying_complete"] } },
  });

  if (remainingRaces === 0) {
    await completeSeason(prisma, season);
  }

  return true;
}

// ─── Bracket advance ────────────────────────────────────────────────

async function advanceBracketRound(
  prisma: Prisma,
  season: { id: string; leagueId: string; league: { archetype: string; sportPreset: string } }
): Promise<boolean> {
  // Find the earliest round with scheduled brackets
  const scheduledBrackets = await prisma.sportBracket.findMany({
    where: {
      seasonId: season.id,
      status: "scheduled",
      stage: (season as any).activeStage ?? 1,
    } as any,
    orderBy: { round: "asc" },
    select: { round: true },
  });

  if (scheduledBrackets.length === 0) return false;

  const targetRound = scheduledBrackets[0]!.round;

  const brackets = await prisma.sportBracket.findMany({
    where: {
      seasonId: season.id,
      round: targetRound,
      status: "scheduled",
      stage: (season as any).activeStage ?? 1,
    } as any,
  });

  for (const bracket of brackets) {
    const fighter1Team = await prisma.sportTeam.findUnique({
      where: { id: bracket.fighter1Id },
      include: {
        players: { where: { isActive: true } },
      },
    });
    const fighter2Team = await prisma.sportTeam.findUnique({
      where: { id: bracket.fighter2Id },
      include: {
        players: { where: { isActive: true } },
      },
    });

    if (!fighter1Team || !fighter2Team) continue;

    const fighter1 = fighter1Team.players[0];
    const fighter2 = fighter2Team.players[0];

    if (!fighter1 || !fighter2) continue;

    const r1 = (fighter1.ratings ?? {}) as Record<string, number>;
    const r2 = (fighter2.ratings ?? {}) as Record<string, number>;

    const homeRatings: TeamRatingVector = {
      overall: computePlayerAvg(r1),
      offense: r1.power ?? 50,
      defense: r1.defense ?? 50,
      form: 50,
      depth: 50,
      coaching: 50,
    };
    const awayRatings: TeamRatingVector = {
      overall: computePlayerAvg(r2),
      offense: r2.power ?? 50,
      defense: r2.defense ?? 50,
      form: 50,
      depth: 50,
      coaching: 50,
    };

    const matchSeed = hashString(bracket.id) + targetRound * 7919;
    const isChampionship =
      bracket.round === Math.max(...scheduledBrackets.map((b) => b.round)) &&
      (await prisma.sportBracket.count({
        where: {
          seasonId: season.id,
          round: { gt: targetRound },
          stage: (season as any).activeStage ?? 1,
        } as any,
      })) === 0;

    const result = resolveMatch({
      sport: season.league.sportPreset,
      homeTeam: homeRatings,
      awayTeam: awayRatings,
      archetype: "bracket",
      seed: matchSeed,
      context: { isChampionship, isPlayoff: !isChampionship },
    });

    const ixNow = IxTime.getCurrentIxTime();
    const winnerId = result.winner === "home" ? bracket.fighter1Id : bracket.fighter2Id;

    await prisma.sportBracket.update({
      where: { id: bracket.id },
      data: {
        winnerId,
        status: "completed",
        resolvedIxTime: ixNow,
        result: {
          winner: winnerId,
          method: result.winner === "home" ? "decision" : "decision",
        } as any,
      },
    });
  }

  // When all brackets in current round are done, create next round brackets
  const stillScheduled = await prisma.sportBracket.count({
    where: {
      seasonId: season.id,
      round: targetRound,
      status: "scheduled",
      stage: (season as any).activeStage ?? 1,
    } as any,
  });

  if (stillScheduled === 0) {
    // Get winners from this round
    const completedBrackets = await prisma.sportBracket.findMany({
      where: {
        seasonId: season.id,
        round: targetRound,
        status: "completed",
        stage: (season as any).activeStage ?? 1,
      } as any,
      select: { winnerId: true },
    });

    const winners = completedBrackets.map((b) => b.winnerId).filter(Boolean) as string[];

    // If more than one winner, create next round
    if (winners.length >= 2) {
      const nextRound = targetRound + 1;
      const ixNow = IxTime.getCurrentIxTime();

      // Cross-pair winners: 1st vs last, 2nd vs 2nd-last
      const pow2 = Math.pow(2, Math.ceil(Math.log2(winners.length)));
      const half = pow2 / 2;
      for (let i = 0; i < half; i++) {
        const a = i < winners.length ? winners[i]! : null;
        const b = pow2 - 1 - i < winners.length ? winners[pow2 - 1 - i]! : null;
        if (a && b) {
          await prisma.sportBracket.create({
            data: {
              seasonId: season.id,
              round: nextRound,
              weightClass: "heavyweight",
              fighter1Id: a,
              fighter2Id: b,
              status: "scheduled",
              scheduledIxTime: ixNow + 2880,
              stage: (season as any).activeStage ?? 1,
            } as any,
          });
        }
      }
    } else {
      // Season complete check for next stage
      const transitioned = await transitionToNextStage(prisma, season.id);
      if (!transitioned) {
        await completeSeason(prisma, season);
      }
    }
  }

  return true;
}

// ─── Main Entry Point ───────────────────────────────────────────────

export async function advanceSportsSeasons(prisma: Prisma): Promise<number> {
  let advanced = 0;

  const activeSeasons = await prisma.sportSeason.findMany({
    where: { status: "in_progress" },
    include: {
      league: { select: { id: true, archetype: true, sportPreset: true, settings: true } },
    },
  });

  for (const season of activeSeasons) {
    try {
      let advancedSeason = false;

      let activeArchetype = season.league.archetype;
      const settings = (season as any).settings ?? (season.league as any).settings ?? {};
      const stages = (settings as any).stages;
      if (stages && Array.isArray(stages)) {
        const activeStage = stages.find((s: any) => s.id === (season as any).activeStage);
        if (activeStage && activeStage.type) {
          activeArchetype = activeStage.type;
        }
      }

      switch (activeArchetype) {
        case "league":
        case "division_conference":
        case "round_robin":
          advancedSeason = await advanceLeagueMatchDay(prisma, season);
          break;
        case "circuit":
          advancedSeason = await advanceCircuitRace(prisma, season);
          break;
        case "bracket":
        case "golden_box":
          advancedSeason = await advanceBracketRound(prisma, season);
          break;
      }

      if (advancedSeason) {
        advanced++;
      }
    } catch (error) {
      console.error(
        `[Cron] Sports: Failed to advance season ${season.id} (${season.league.archetype}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return advanced;
}
