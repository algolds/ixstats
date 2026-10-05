/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  assertCanManageLeague,
  viewerCanManageLeague,
} from "~/server/api/routers/sports/league-access";
import { IxTime } from "~/lib/ixtime";
import { computeMatchRevenue } from "~/lib/sports/match-revenue";
import { TEAM_BADGE, requireOwnedTeam } from "~/server/api/routers/sports/_shared";
import { persistSeasonSchedule, transitionSeasonAction } from "~/lib/sports";

/** Completed matches of `teamId` whose revenue that side hasn't collected yet. */
function uncollectedMatches(
  db: Pick<PrismaClient, "sportMatch"> | Prisma.TransactionClient,
  teamId: string
) {
  return db.sportMatch.findMany({
    where: {
      status: "completed",
      OR: [
        { homeTeamId: teamId, homeRevenueCollectedAt: null },
        { awayTeamId: teamId, awayRevenueCollectedAt: null },
      ],
    },
    select: { id: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });
}

type TraceEvent = { actorId?: string; actorName?: string; type?: string; description?: unknown };

/** Rebuild per-player goals/assists/shots from a match trace when no stored player stats exist. */
async function playerStatsFromTrace(db: PrismaClient, matchId: string, trace: TraceEvent[]) {
  const playerMap = new Map<string, { goals: number; assists: number; shots: number }>();
  const actorNames = new Map<string, string>();

  for (const event of trace) {
    const actorId = event.actorId;
    if (!actorId) continue;

    if (event.actorName) actorNames.set(actorId, event.actorName);
    const pStat = playerMap.get(actorId) ?? { goals: 0, assists: 0, shots: 0 };
    playerMap.set(actorId, pStat);

    if (event.type === "goal") {
      pStat.goals++;
    } else if (
      event.type === "tactic_shift" &&
      typeof event.description === "string" &&
      event.description.toLowerCase().includes("shot")
    ) {
      pStat.shots++;
    }
  }

  // Assign assists to teammates
  trace.forEach((event, i) => {
    if (event.type !== "goal" || !event.actorId) return;
    const candidates = Array.from(playerMap.keys()).filter((id) => id !== event.actorId);
    if (candidates.length > 0) {
      playerMap.get(candidates[(i * 7) % candidates.length]!)!.assists++;
    }
  });

  const playerIds = Array.from(playerMap.keys());
  const dbPlayers = await db.sportPlayer.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });
  const dbPlayersMap = new Map(dbPlayers.map((p) => [p.id, p]));

  return playerIds.map((id) => {
    const dbPlayer = dbPlayersMap.get(id);
    const parts = (actorNames.get(id) || "Player").split(" ");
    return {
      id: `temp-${id}`,
      matchId,
      playerId: id,
      stats: playerMap.get(id) || { goals: 0, assists: 0, shots: 0 },
      createdAt: new Date(),
      player: {
        firstName: dbPlayer?.firstName || parts[0] || "Unknown",
        lastName: dbPlayer?.lastName || parts.slice(1).join(" ") || "Player",
        position: dbPlayer?.position || "MID",
      },
    } as any;
  });
}

export const sportsSeasonsLifecycleRouter = createTRPCRouter({
  // ═══ Team Management ═════════════════════════════════════════════════════════

  /** What the caller's club would collect now: completed matches it hasn't been paid for yet. */
  previewMatchRevenue: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await requireOwnedTeam(ctx.db, input.teamId, ctx.user.id, "own");
      return computeMatchRevenue(team, await uncollectedMatches(ctx.db, team.id));
    }),

  /**
   * Pay the club for completed matches it hasn't collected yet (SL-14): ticket revenue and the
   * sponsor base fee per home match, the sponsor win bonus per win. Each match pays once.
   */
  collectMatchRevenue: rateLimitedMutationProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.$transaction(async (tx) => {
          // Serialize collections per team so two clicks can't both pay the same matches
          await tx.$queryRaw`SELECT id FROM "sport_teams" WHERE id = ${input.teamId} FOR UPDATE`;
          const team = await requireOwnedTeam(tx, input.teamId, ctx.user.id, "own");

          const matches = await uncollectedMatches(tx, team.id);
          const revenue = computeMatchRevenue(team, matches);
          if (matches.length === 0) {
            return { ...revenue, matchesCollected: 0, budget: team.budget ?? 0 };
          }

          const now = new Date();
          const homeIds = matches.filter((m) => m.homeTeamId === team.id).map((m) => m.id);
          const awayIds = matches.filter((m) => m.awayTeamId === team.id).map((m) => m.id);
          if (homeIds.length > 0) {
            await tx.sportMatch.updateMany({
              where: { id: { in: homeIds } },
              data: { homeRevenueCollectedAt: now },
            });
          }
          if (awayIds.length > 0) {
            await tx.sportMatch.updateMany({
              where: { id: { in: awayIds } },
              data: { awayRevenueCollectedAt: now },
            });
          }
          const updated = await tx.sportTeam.update({
            where: { id: team.id },
            data: { budget: { increment: revenue.total } },
          });
          return { ...revenue, matchesCollected: matches.length, budget: updated.budget ?? 0 };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to collect revenue",
        });
      }
    }),

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  startSeason: rateLimitedMutationProcedure
    .input(z.object({ leagueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: input.leagueId },
          include: { teams: true },
        });

        if (!league) {
          throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
        }
        assertCanManageLeague(ctx, league);

        if (league.teams.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "League has no teams",
          });
        }

        // Check for in-progress seasons
        const activeSeason = await ctx.db.sportSeason.findFirst({
          where: { leagueId: input.leagueId, status: "in_progress" },
        });
        if (activeSeason) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "League already has an in-progress season",
          });
        }

        const maxSeason = await ctx.db.sportSeason.findFirst({
          where: { leagueId: input.leagueId },
          orderBy: { seasonNumber: "desc" },
          select: { seasonNumber: true },
        });
        const seasonNumber = (maxSeason?.seasonNumber ?? 0) + 1;

        const startIxTime = IxTime.getCurrentIxTime();

        const season = await ctx.db.sportSeason.create({
          data: {
            leagueId: input.leagueId,
            seasonNumber,
            status: "in_progress",
            startIxTime,
          },
        });

        // Create standings records
        const teamIds = league.teams.map((t) => t.id);
        await ctx.db.sportStanding.createMany({
          data: league.teams.map((t) => ({
            seasonId: season.id,
            teamId: t.id,
          })),
        });

        // Create team season records
        await ctx.db.sportTeamSeason.createMany({
          data: teamIds.map((teamId) => ({
            seasonId: season.id,
            teamId,
          })),
        });

        await persistSeasonSchedule(ctx.db, {
          seasonId: season.id,
          startIxTime,
          league,
          teams: league.teams,
        });

        return season;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start season",
        });
      }
    }),

  getSeason: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const season = await ctx.db.sportSeason.findUnique({
        where: { id: input.id },
        include: {
          league: {
            select: {
              id: true,
              name: true,
              sportPreset: true,
              archetype: true,
              promotionCount: true,
              relegationCount: true,
            },
          },
          standings: {
            include: {
              team: TEAM_BADGE,
            },
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
          },
          matches: {
            include: {
              homeTeam: TEAM_BADGE,
              awayTeam: TEAM_BADGE,
            },
            orderBy: [{ matchDay: "asc" }, { scheduledIxTime: "asc" }],
          },
          brackets: {
            orderBy: { round: "asc" },
          },
          races: {
            orderBy: { raceNumber: "asc" },
          },
          champion: { select: { id: true, name: true, logo: true, color: true } },
        },
      });

      if (!season) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
      }

      return season;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch season",
      });
    }
  }),

  getMatchDetails: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: {
            homeTeam: TEAM_BADGE,
            awayTeam: TEAM_BADGE,
            season: {
              select: {
                id: true,
                seasonNumber: true,
                league: {
                  select: {
                    id: true,
                    name: true,
                    sportPreset: true,
                    archetype: true,
                    createdByUserId: true,
                  },
                },
              },
            },
            playerStats: {
              include: {
                player: {
                  select: { firstName: true, lastName: true, position: true },
                },
              },
            },
          },
        });

        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const stats = match.matchStats as any;
        let playerStats = match.playerStats || [];
        const trace = stats?.trace as any[];

        if (playerStats.length === 0 && Array.isArray(trace) && trace.length > 0) {
          playerStats = await playerStatsFromTrace(ctx.db, input.matchId, trace);
        }

        return {
          ...match,
          viewerCanManage: viewerCanManageLeague(ctx, match.season.league),
          playerStats,
          evaluation: stats?.evaluation ?? null,
          trace: stats?.trace ?? null,
          commentary: stats?.commentary ?? null,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch match details",
        });
      }
    }),

  transitionToNextSeason: rateLimitedMutationProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const season = await ctx.db.sportSeason.findUnique({
        where: { id: input.seasonId },
        select: { league: { select: { createdByUserId: true } } },
      });
      if (!season) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
      }
      assertCanManageLeague(ctx, season.league);

      try {
        const result = await transitionSeasonAction(ctx.db as any, input.seasonId);
        return result;
      } catch (error) {
        console.error("Transition to next season error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to transition season",
        });
      }
    }),
});
