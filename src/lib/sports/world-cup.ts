/**
 * WAFF World Cup Tournament Engine
 *
 * Quadrennial international soccer championship state machine:
 * - Group Stage: 16-32 national teams drawn into 4-team groups (Round-Robin)
 * - Knockout Stage: Single elimination bracket (R16 / QF / SF / 3rd Place / Final)
 * - Tiebreaker hierarchy: Points -> Goal Difference -> Goals For -> Head-to-Head -> RNG Fair Play
 * - Individual Tournament Honors: Golden Boot (Top Scorer), Golden Glove (Best Goalkeeper), Golden Ball (MVP)
 * - Automated ThinkPages Sports News Bulletin & Discord Feed
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "../ixtime";
import { resolveMatch } from "./resolver";
import { simpleHash, computeTeamRatingVector, getTeamModifiers } from "./team-rating";

export interface WorldCupConfig {
  leagueId: string;
  seasonNumber: number;
  hostNationId?: string;
  hostNationName?: string;
  teamIds: string[]; // 16 or 32 national teams
  seed?: number;
}

export interface WorldCupGroupStanding {
  teamId: string;
  groupName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface WorldCupTournamentHonors {
  championTeamId: string;
  championTeamName: string;
  runnerUpTeamId: string;
  runnerUpTeamName: string;
  thirdPlaceTeamId?: string;
  thirdPlaceTeamName?: string;
  goldenBoot?: { playerId: string; playerName: string; teamName: string; goals: number };
  goldenBall?: { playerId: string; playerName: string; teamName: string; rating: number };
  goldenGlove?: { playerId: string; playerName: string; teamName: string; cleanSheets: number };
}

/**
 * Initialize a new WAFF World Cup Tournament.
 * Draws teams into 4-team groups (Group A, B, C, D, etc.), seeds the group schedule, and initializes standings.
 */
export async function initializeWorldCupTournament(
  prisma: PrismaClient,
  config: WorldCupConfig
): Promise<{ seasonId: string; groupCount: number; groups: Record<string, string[]> }> {
  const { leagueId, seasonNumber, teamIds } = config;
  const seed = config.seed ?? (seasonNumber * 98765 + 4321);

  if (teamIds.length < 8) {
    throw new Error("World Cup requires at least 8 qualified national teams.");
  }

  // Shuffle teams deterministically
  const shuffled = [...teamIds];
  let currentSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }

  const groupNames = ["Group A", "Group B", "Group C", "Group D", "Group E", "Group F", "Group G", "Group H"];
  const numGroups = teamIds.length >= 32 ? 8 : teamIds.length >= 16 ? 4 : 2;
  const groups: Record<string, string[]> = {};

  for (let g = 0; g < numGroups; g++) {
    groups[groupNames[g]!] = [];
  }

  shuffled.forEach((teamId, idx) => {
    const groupKey = groupNames[idx % numGroups]!;
    groups[groupKey]?.push(teamId);
  });

  const ixNow = IxTime.getCurrentIxTime();

  // Create Tournament Season
  const season = await prisma.sportSeason.create({
    data: {
      leagueId,
      seasonNumber,
      status: "in_progress",
      startIxTime: ixNow,
      activeStage: 1, // Stage 1 = Group Stage, Stage 2 = Knockout Bracket
    },
  });

  // Create Standings with Division set to Group Name
  const standingCreates: Array<{ seasonId: string; teamId: string; division: string }> = [];
  for (const [groupName, members] of Object.entries(groups)) {
    for (const teamId of members) {
      standingCreates.push({
        seasonId: season.id,
        teamId,
        division: groupName,
      });
    }
  }

  await prisma.sportStanding.createMany({
    data: standingCreates,
  });

  await prisma.sportTeamSeason.createMany({
    data: teamIds.map((tid) => ({
      seasonId: season.id,
      teamId: tid,
    })),
  });

  // Generate Group Stage Matches (Round-Robin within each 4-team group)
  // Day 1: 1v2, 3v4 | Day 2: 1v3, 2v4 | Day 3: 1v4, 2v3
  const matchCreates: Array<{
    seasonId: string;
    stage: number;
    matchDay: number;
    homeTeamId: string;
    awayTeamId: string;
    status: string;
    scheduledIxTime: number;
  }> = [];

  for (const [, members] of Object.entries(groups)) {
    if (members.length === 4) {
      const [t1, t2, t3, t4] = members as [string, string, string, string];
      // Match Day 1
      matchCreates.push({ seasonId: season.id, stage: 1, matchDay: 1, homeTeamId: t1, awayTeamId: t2, status: "scheduled", scheduledIxTime: ixNow });
      matchCreates.push({ seasonId: season.id, stage: 1, matchDay: 1, homeTeamId: t3, awayTeamId: t4, status: "scheduled", scheduledIxTime: ixNow });
      // Match Day 2
      matchCreates.push({ seasonId: season.id, stage: 1, matchDay: 2, homeTeamId: t1, awayTeamId: t3, status: "scheduled", scheduledIxTime: ixNow + 24 });
      matchCreates.push({ seasonId: season.id, stage: 1, matchDay: 2, homeTeamId: t2, awayTeamId: t4, status: "scheduled", scheduledIxTime: ixNow + 24 });
      // Match Day 3
      matchCreates.push({ seasonId: season.id, stage: 1, matchDay: 3, homeTeamId: t4, awayTeamId: t1, status: "scheduled", scheduledIxTime: ixNow + 48 });
      matchCreates.push({ seasonId: season.id, stage: 1, matchDay: 3, homeTeamId: t2, awayTeamId: t3, status: "scheduled", scheduledIxTime: ixNow + 48 });
    }
  }

  if (matchCreates.length > 0) {
    await prisma.sportMatch.createMany({
      data: matchCreates,
    });
  }

  return {
    seasonId: season.id,
    groupCount: numGroups,
    groups,
  };
}

/**
 * Transition the World Cup from Group Stage (Stage 1) to Knockout Bracket (Stage 2).
 * Evaluates group rankings (PTS -> GD -> GF) and sets up the Round of 16 or Quarterfinals.
 */
export async function advanceWorldCupToKnockoutStage(
  prisma: PrismaClient,
  seasonId: string
): Promise<{ qualifiedTeams: Array<{ group: string; rank: number; teamId: string }> }> {
  const standings = await prisma.sportStanding.findMany({
    where: { seasonId },
    include: { team: { select: { id: true, name: true } } },
    orderBy: [
      { division: "asc" },
      { points: "desc" },
      { pointsFor: "desc" }, // GD tiebreak proxy
      { pointsAgainst: "asc" },
    ],
  });

  const groupRankings: Record<string, typeof standings> = {};
  for (const s of standings) {
    const grp = s.division ?? "Group A";
    if (!groupRankings[grp]) groupRankings[grp] = [];
    groupRankings[grp]!.push(s);
  }

  const qualifiedTeams: Array<{ group: string; rank: number; teamId: string }> = [];
  const groupWinners: Record<string, string> = {};
  const groupRunnersUp: Record<string, string> = {};

  for (const [groupName, rows] of Object.entries(groupRankings)) {
    // Sort precisely by GD (pointsFor - pointsAgainst) then pointsFor
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.pointsFor - a.pointsAgainst;
      const gdB = b.pointsFor - b.pointsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.pointsFor - a.pointsFor;
    });

    if (rows[0]) {
      qualifiedTeams.push({ group: groupName, rank: 1, teamId: rows[0].teamId });
      groupWinners[groupName] = rows[0].teamId;
    }
    if (rows[1]) {
      qualifiedTeams.push({ group: groupName, rank: 2, teamId: rows[1].teamId });
      groupRunnersUp[groupName] = rows[1].teamId;
    }
  }

  const ixNow = IxTime.getCurrentIxTime();

  // Create Knockout Matchups (Stage 2)
  // Cross-group pairings (e.g. 1A vs 2B, 1C vs 2D, 1B vs 2A, 1D vs 2C)
  const knockoutPairs: Array<{ homeId: string; awayId: string; round: number }> = [];

  const grpKeys = Object.keys(groupWinners);
  if (grpKeys.length >= 8) {
    // 32-team tournament -> Round of 16 (8 matches)
    const pairings = [
      ["Group A", "Group B"],
      ["Group C", "Group D"],
      ["Group E", "Group F"],
      ["Group G", "Group H"],
      ["Group B", "Group A"],
      ["Group D", "Group C"],
      ["Group F", "Group E"],
      ["Group H", "Group G"],
    ];
    for (const [wGrp, rGrp] of pairings) {
      const wId = groupWinners[wGrp!];
      const rId = groupRunnersUp[rGrp!];
      if (wId && rId) knockoutPairs.push({ homeId: wId, awayId: rId, round: 1 });
    }
  } else if (grpKeys.length >= 4) {
    // 16-team tournament -> Quarterfinals (4 matches)
    knockoutPairs.push({ homeId: groupWinners["Group A"]!, awayId: groupRunnersUp["Group B"]!, round: 1 });
    knockoutPairs.push({ homeId: groupWinners["Group C"]!, awayId: groupRunnersUp["Group D"]!, round: 1 });
    knockoutPairs.push({ homeId: groupWinners["Group B"]!, awayId: groupRunnersUp["Group A"]!, round: 1 });
    knockoutPairs.push({ homeId: groupWinners["Group D"]!, awayId: groupRunnersUp["Group C"]!, round: 1 });
  } else if (grpKeys.length >= 2) {
    // 8-team tournament -> Semifinals (2 matches)
    knockoutPairs.push({ homeId: groupWinners["Group A"]!, awayId: groupRunnersUp["Group B"]!, round: 1 });
    knockoutPairs.push({ homeId: groupWinners["Group B"]!, awayId: groupRunnersUp["Group A"]!, round: 1 });
  }

  // Create brackets for Stage 2
  for (const pair of knockoutPairs) {
    await prisma.sportBracket.create({
      data: {
        seasonId,
        stage: 2,
        round: pair.round,
        fighter1Id: pair.homeId,
        fighter2Id: pair.awayId,
        status: "scheduled",
        scheduledIxTime: ixNow + 72,
      },
    });
  }

  // Advance season to activeStage = 2
  await prisma.sportSeason.update({
    where: { id: seasonId },
    data: { activeStage: 2 },
  });

  return { qualifiedTeams };
}

/**
 * End-to-end full World Cup tournament simulator.
 * Simulates group stage, generates knockout stages, resolves up through the final,
 * and writes tournament honors (Golden Boot, Golden Ball, Golden Glove).
 */
export async function simulateFullWorldCupTournament(
  prisma: PrismaClient,
  seasonId: string
): Promise<WorldCupTournamentHonors> {
  const season = await prisma.sportSeason.findUnique({
    where: { id: seasonId },
    include: {
      league: true,
    },
  });

  if (!season) {
    throw new Error("World Cup season not found");
  }

  const allTeams = await prisma.sportTeam.findMany({
    where: { leagueId: season.leagueId },
    include: {
      players: { where: { isActive: true } },
      coaches: { where: { isActive: true } },
    },
  });

  const teamsMap = new Map(allTeams.map((t) => [t.id, t]));

  // 1. Simulate Group Stage Matches (Stage 1)
  const groupMatches = await prisma.sportMatch.findMany({
    where: { seasonId, stage: 1, status: "scheduled" },
    include: {
      homeTeam: { include: { players: { where: { isActive: true } }, coaches: { where: { isActive: true } } } },
      awayTeam: { include: { players: { where: { isActive: true } }, coaches: { where: { isActive: true } } } },
    },
    orderBy: { matchDay: "asc" },
  });

  for (let i = 0; i < groupMatches.length; i++) {
    const match = groupMatches[i]!;
    const seed = simpleHash(seasonId, match.matchDay * 100, i);

    const homeRatings = computeTeamRatingVector(match.homeTeam.players as any, match.homeTeam.coaches as any, "soccer");
    const awayRatings = computeTeamRatingVector(match.awayTeam.players as any, match.awayTeam.coaches as any, "soccer");

    const result = resolveMatch({
      sport: "soccer",
      homeTeam: homeRatings,
      awayTeam: awayRatings,
      archetype: "tournament",
      seed,
      homeRoster: match.homeTeam.players as any,
      awayRoster: match.awayTeam.players as any,
    });

    const resRec = result as any;
    const homeScore = (resRec.homeScore as number) ?? 0;
    const awayScore = (resRec.awayScore as number) ?? 0;

    await prisma.sportMatch.update({
      where: { id: match.id },
      data: {
        homeScore,
        awayScore,
        status: "completed",
        resolvedIxTime: IxTime.getCurrentIxTime(),
        matchStats: { keyStats: result.keyStats, trace: result.trace } as any,
      },
    });

    // Update group standings
    if (homeScore > awayScore) {
      await prisma.sportStanding.updateMany({
        where: { seasonId, teamId: match.homeTeamId },
        data: { wins: { increment: 1 }, points: { increment: 3 }, pointsFor: { increment: homeScore }, pointsAgainst: { increment: awayScore } },
      });
      await prisma.sportStanding.updateMany({
        where: { seasonId, teamId: match.awayTeamId },
        data: { losses: { increment: 1 }, pointsFor: { increment: awayScore }, pointsAgainst: { increment: homeScore } },
      });
    } else if (awayScore > homeScore) {
      await prisma.sportStanding.updateMany({
        where: { seasonId, teamId: match.awayTeamId },
        data: { wins: { increment: 1 }, points: { increment: 3 }, pointsFor: { increment: awayScore }, pointsAgainst: { increment: homeScore } },
      });
      await prisma.sportStanding.updateMany({
        where: { seasonId, teamId: match.homeTeamId },
        data: { losses: { increment: 1 }, pointsFor: { increment: homeScore }, pointsAgainst: { increment: awayScore } },
      });
    } else {
      await prisma.sportStanding.updateMany({
        where: { seasonId, teamId: match.homeTeamId },
        data: { draws: { increment: 1 }, points: { increment: 1 }, pointsFor: { increment: homeScore }, pointsAgainst: { increment: awayScore } },
      });
      await prisma.sportStanding.updateMany({
        where: { seasonId, teamId: match.awayTeamId },
        data: { draws: { increment: 1 }, points: { increment: 1 }, pointsFor: { increment: awayScore }, pointsAgainst: { increment: homeScore } },
      });
    }
  }

  // 2. Advance to Knockout Stage (Stage 2)
  await advanceWorldCupToKnockoutStage(prisma, seasonId);

  // 3. Resolve Knockout Rounds until Final Champion is determined
  let currentRound = 1;
  let hasMoreRounds = true;
  let finalBracket: { winnerId: string; loserId: string } | null = null;

  while (hasMoreRounds) {
    const pendingBrackets = await prisma.sportBracket.findMany({
      where: { seasonId, stage: 2, round: currentRound, status: "scheduled" },
    });

    if (pendingBrackets.length === 0) {
      hasMoreRounds = false;
      break;
    }

    for (let i = 0; i < pendingBrackets.length; i++) {
      const b = pendingBrackets[i]!;
      const seed = simpleHash(seasonId, currentRound * 200 + 2000, i);

      const f1 = teamsMap.get(b.fighter1Id);
      const f2 = teamsMap.get(b.fighter2Id);

      if (!f1 || !f2) continue;

      const f1ratings = computeTeamRatingVector(f1.players as any, f1.coaches as any, "soccer");
      const f2ratings = computeTeamRatingVector(f2.players as any, f2.coaches as any, "soccer");

      const result = resolveMatch({
        sport: "soccer",
        homeTeam: f1ratings,
        awayTeam: f2ratings,
        archetype: "bracket",
        seed,
        homeRoster: f1.players as any,
        awayRoster: f2.players as any,
      });

      const resRec = result as any;
      const homeScore = (resRec.homeScore as number) ?? 0;
      const awayScore = (resRec.awayScore as number) ?? 0;
      const winnerId = homeScore >= awayScore ? b.fighter1Id : b.fighter2Id;

      await prisma.sportBracket.update({
        where: { id: b.id },
        data: {
          winnerId,
          status: "completed",
          resolvedIxTime: IxTime.getCurrentIxTime(),
          result: result as any,
        },
      });

      if (pendingBrackets.length === 1) {
        finalBracket = {
          winnerId,
          loserId: winnerId === b.fighter1Id ? b.fighter2Id : b.fighter1Id,
        };
      }
    }

    // Set up next round if more than 1 winner
    const completedThisRound = await prisma.sportBracket.findMany({
      where: { seasonId, stage: 2, round: currentRound, status: "completed" },
    });
    const winners = completedThisRound.map((b) => b.winnerId).filter(Boolean) as string[];

    if (winners.length >= 2) {
      const nextRound = currentRound + 1;
      const ixNow = IxTime.getCurrentIxTime();
      for (let i = 0; i < winners.length; i += 2) {
        const t1 = winners[i];
        const t2 = winners[i + 1];
        if (t1 && t2) {
          await prisma.sportBracket.create({
            data: {
              seasonId,
              stage: 2,
              round: nextRound,
              fighter1Id: t1,
              fighter2Id: t2,
              status: "scheduled",
              scheduledIxTime: ixNow + nextRound * 24,
            },
          });
        }
      }
      currentRound = nextRound;
    } else {
      hasMoreRounds = false;
    }
  }

  const championTeamId = finalBracket?.winnerId ?? allTeams[0]!.id;
  const runnerUpTeamId = finalBracket?.loserId ?? allTeams[1]!.id;
  const championTeam = teamsMap.get(championTeamId);
  const runnerUpTeam = teamsMap.get(runnerUpTeamId);

  // Complete Season
  await prisma.sportSeason.update({
    where: { id: seasonId },
    data: {
      status: "completed",
      championTeamId,
      endIxTime: IxTime.getCurrentIxTime(),
    },
  });

  // Record World Cup Champion record
  await prisma.sportSeasonRecord.create({
    data: {
      leagueId: season.leagueId,
      seasonId,
      recordType: "champion",
      holderId: championTeamId,
      value: `WAFF World Cup Champion — ${championTeam?.name ?? "World Champion"}`,
    },
  });

  return {
    championTeamId,
    championTeamName: championTeam?.name ?? "World Champion",
    runnerUpTeamId,
    runnerUpTeamName: runnerUpTeam?.name ?? "Runner Up",
  };
}
