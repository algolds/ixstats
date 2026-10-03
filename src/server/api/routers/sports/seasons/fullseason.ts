import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { assertCanManageLeague } from "~/server/api/routers/sports/league-access";
import { IxTime } from "~/lib/ixtime";
import { resolveRace, loadLeagueDrivers, transitionToNextStage, simpleHash } from "~/lib/sports";
import { outcomeFromScores, resolveMatchPredictions } from "~/lib/sports/predictions";
import {
  SIM_MATCH_INCLUDE,
  SIM_TEAM_INCLUDE,
  loadEffectsMap,
  simulateAndPersistBout,
  simulateAndPersistMatch,
} from "~/lib/sports/simulate-and-persist";

type SeasonWithLeague = Prisma.SportSeasonGetPayload<{ include: { league: true } }>;
type BoutInput = Parameters<typeof simulateAndPersistBout>[1];
type EffectsMap = NonNullable<BoutInput["effectsMap"]>;
type TeamsMap = Map<string, BoutInput["fighter1"]>;

const findSeason = (db: PrismaClient, seasonId: string) =>
  db.sportSeason.findUnique({ where: { id: seasonId }, include: { league: true } });

/** Resolve every remaining race and award points to the top 10 finishers. */
async function simulateCircuitSeason(db: PrismaClient, season: SeasonWithLeague) {
  const races = await db.sportRace.findMany({
    where: { seasonId: season.id, status: { in: ["upcoming", "qualifying_complete"] } },
    orderBy: { raceNumber: "asc" },
  });
  const allDrivers = await loadLeagueDrivers(db, season.leagueId);

  for (const race of races) {
    const raceResult = resolveRace({
      drivers: allDrivers,
      seed: simpleHash(season.id, race.raceNumber, 0),
      isWet: false,
    });

    await db.sportRace.update({
      where: { id: race.id },
      data: { status: "completed", results: raceResult.positions as any },
    });

    for (const r of raceResult.positions.slice(0, 10)) {
      if (r.points > 0) {
        await db.sportStanding.updateMany({
          where: { seasonId: season.id, teamId: r.teamId },
          data: { points: { increment: r.points }, pointsFor: { increment: r.points } },
        });
      }
    }
  }
}

/** Simulate this stage's scheduled matches day by day (each day atomic), then settle predictions. */
async function simulateStageMatches(
  db: PrismaClient,
  season: SeasonWithLeague,
  stage: number,
  effectsMap: EffectsMap
) {
  const scheduledDays = await db.sportMatch.findMany({
    where: { seasonId: season.id, stage, status: "scheduled" },
    select: { matchDay: true },
    distinct: ["matchDay"],
    orderBy: { matchDay: "asc" },
  });

  for (const { matchDay } of scheduledDays) {
    const matches = await db.sportMatch.findMany({
      where: { seasonId: season.id, stage, matchDay, status: "scheduled" },
      include: SIM_MATCH_INCLUDE,
    });

    const completed = await db.$transaction(async (tx) => {
      const done: Array<{ matchId: string; homeScore: number; awayScore: number }> = [];
      for (const match of matches) {
        const sim = await simulateAndPersistMatch(tx, {
          match,
          league: season.league,
          effectsMap,
        });
        if (!sim) continue; // completed by a concurrent run
        done.push({ matchId: match.id, homeScore: sim.homeScore, awayScore: sim.awayScore });
      }
      return done;
    });

    // Settle predictions on every match this day completed (as match day does).
    for (const m of completed) {
      await resolveMatchPredictions(db, m.matchId, outcomeFromScores(m.homeScore, m.awayScore));
    }
  }
}

/** Pair winners first-vs-last, second-vs-second-last into the next round's brackets. */
async function createNextRound(
  db: PrismaClient,
  where: { seasonId: string; stage: number },
  nextRound: number,
  winners: string[]
) {
  const scheduledIxTime = IxTime.getCurrentIxTime();
  const pow2 = 2 ** Math.ceil(Math.log2(winners.length));
  for (let i = 0; i < pow2 / 2; i++) {
    const fighter1Id = winners[i];
    const fighter2Id = winners[pow2 - 1 - i];
    if (!fighter1Id || !fighter2Id) continue;
    await db.sportBracket.create({
      data: {
        ...where,
        round: nextRound,
        weightClass: "heavyweight",
        fighter1Id,
        fighter2Id,
        status: "scheduled",
        scheduledIxTime,
      },
    });
  }
}

/** Play out each bracket round of a stage, generating the next round until one winner remains. */
async function simulateStageBrackets(
  db: PrismaClient,
  season: SeasonWithLeague,
  stage: number,
  teamsMap: TeamsMap,
  effectsMap: EffectsMap
) {
  const stageWhere = { seasonId: season.id, stage };

  for (let round = 1; ; round++) {
    const roundWhere = { ...stageWhere, round };
    const pending = await db.sportBracket.findMany({
      where: { ...roundWhere, status: "scheduled" },
    });

    if (pending.length === 0) {
      const completedInRound = await db.sportBracket.count({
        where: { ...roundWhere, status: "completed" },
      });
      if (completedInRound === 0) return;
    }

    // Same seeded, snapshotted, atomically-claimed bout path as the IxTime cron.
    for (const bout of pending) {
      const fighter1 = teamsMap.get(bout.fighter1Id);
      const fighter2 = teamsMap.get(bout.fighter2Id);
      if (!fighter1 || !fighter2) continue;
      await simulateAndPersistBout(db, {
        bout,
        fighter1,
        fighter2,
        sportPreset: season.league.sportPreset,
        effectsMap,
      });
    }

    // After resolving this round, generate the next round's matchups if there are 2+ winners.
    const completedBrackets = await db.sportBracket.findMany({
      where: { ...roundWhere, status: "completed" },
      select: { winnerId: true },
    });
    const winners = completedBrackets.map((b) => b.winnerId).filter(Boolean) as string[];
    if (winners.length < 2) return;

    const nextRoundCount = await db.sportBracket.count({
      where: { ...stageWhere, round: round + 1 },
    });
    if (nextRoundCount === 0) await createNextRound(db, stageWhere, round + 1, winners);
  }
}

/** League, knockout or multi-stage tournament: simulate stage after stage; returns the final season row. */
async function simulateStagedSeason(db: PrismaClient, initial: SeasonWithLeague) {
  const allTeams = await db.sportTeam.findMany({
    where: { leagueId: initial.leagueId },
    include: SIM_TEAM_INCLUDE,
  });
  const teamsMap: TeamsMap = new Map(allTeams.map((t) => [t.id, t]));

  // Pre-fetch storyteller effects for all involved teams
  const effectsMap = await loadEffectsMap(
    db,
    allTeams.map((t) => t.nationId)
  );

  let season: SeasonWithLeague | null = initial;
  while (season) {
    const stage = season.activeStage ?? 1;
    await simulateStageMatches(db, season, stage, effectsMap);
    await simulateStageBrackets(db, season, stage, teamsMap, effectsMap);

    // Once the stage is complete, move on to the next one (if any).
    const transitioned = await transitionToNextStage(db as any, initial.id);
    if (!transitioned) return season;
    season = await findSeason(db, initial.id);
  }
  return null;
}

/** The team that won the bracket's final round, or topped the standings. */
async function findChampionTeamId(db: PrismaClient, seasonId: string, archetype: string) {
  if (archetype === "bracket") {
    const finalRound = await db.sportBracket.findFirst({
      where: { seasonId },
      orderBy: { round: "desc" },
    });
    return finalRound?.winnerId ?? null;
  }
  const topStanding = await db.sportStanding.findFirst({
    where: { seasonId },
    orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
  });
  return topStanding?.teamId ?? null;
}

export const sportsSeasonsFullseasonRouter = createTRPCRouter({
  simulateFullSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const startSeason = await findSeason(ctx.db, input.seasonId);
        if (!startSeason) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }
        assertCanManageLeague(ctx, startSeason.league);

        const currentSeason =
          startSeason.league.archetype === "circuit"
            ? await simulateCircuitSeason(ctx.db, startSeason).then(() => startSeason)
            : await simulateStagedSeason(ctx.db, startSeason);
        if (!currentSeason) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found at finalization" });
        }

        const league = await ctx.db.sportLeague.findUnique({
          where: { id: currentSeason.leagueId },
          include: { teams: { select: { id: true, name: true } } },
        });
        const championTeamId = await findChampionTeamId(
          ctx.db,
          input.seasonId,
          currentSeason.league.archetype
        );

        await ctx.db.sportSeason.update({
          where: { id: input.seasonId },
          data: { status: "completed", endIxTime: IxTime.getCurrentIxTime(), championTeamId },
        });

        return {
          seasonId: input.seasonId,
          status: "completed",
          championTeamId,
          championTeamName: league?.teams.find((t) => t.id === championTeamId)?.name ?? null,
        };
      } catch (error) {
        console.error("Full season simulation error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate full season: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
});
