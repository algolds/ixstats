/**
 * Sports Leagues — Schedule, Matches & AI Commentary Router
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { persistSeasonSchedule } from "~/lib/sports";
import { IxTime } from "~/lib/ixtime";
import { recalculateStandings } from "./helpers";
import { TEAM_BADGE } from "~/server/api/routers/sports/_shared";
import { assertOwnsLeague } from "~/server/api/routers/sports/league-access";

export const leaguesScheduleRouter = createTRPCRouter({
  getSchedule: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: { select: { archetype: true } } },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        if (season.league.archetype === "circuit") {
          const races = await ctx.db.sportRace.findMany({
            where: { seasonId: input.seasonId },
            orderBy: { raceNumber: "asc" },
          });
          return { type: "circuit", races };
        }

        const matches = await ctx.db.sportMatch.findMany({
          where: { seasonId: input.seasonId },
          include: {
            homeTeam: TEAM_BADGE,
            awayTeam: TEAM_BADGE,
          },
          orderBy: [{ matchDay: "asc" }, { scheduledIxTime: "asc" }],
        });

        // Flag rivalry fixtures (one query, mapped in memory). Rivalries are
        // unordered team pairs, so key by sorted id pair.
        const teamIds = Array.from(new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
        const rivalries =
          teamIds.length > 0
            ? await (ctx.db as any).sportRivalry.findMany({
                where: {
                  OR: [{ team1Id: { in: teamIds } }, { team2Id: { in: teamIds } }],
                },
                select: { team1Id: true, team2Id: true, intensity: true },
              })
            : [];
        const rivalryMap = new Map<string, number>();
        for (const r of rivalries as Array<{
          team1Id: string;
          team2Id: string;
          intensity: number;
        }>) {
          rivalryMap.set([r.team1Id, r.team2Id].sort().join("|"), r.intensity);
        }
        const withRivalry = matches.map((m) => {
          const intensity = rivalryMap.get([m.homeTeamId, m.awayTeamId].sort().join("|")) ?? 0;
          return { ...m, isRivalry: intensity > 0, rivalryIntensity: intensity };
        });

        return { type: "fixture", matches: withRivalry };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch schedule",
        });
      }
    }),

  resetSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });
        if (!season) throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        assertOwnsLeague(ctx, season.league);

        await ctx.db.sportMatch.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportStanding.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportBracket.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportRace.deleteMany({ where: { seasonId: input.seasonId } });

        await ctx.db.sportSeason.update({
          where: { id: input.seasonId },
          data: { status: "upcoming", activeStage: 1, championTeamId: null },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to reset season" });
      }
    }),

  overrideMatchResult: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        homeScore: z.number().int().min(0),
        awayScore: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: { season: { include: { league: true } } },
        });
        if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        assertOwnsLeague(ctx, match.season.league);

        const updatedMatch = await ctx.db.sportMatch.update({
          where: { id: input.matchId },
          data: {
            homeScore: input.homeScore,
            awayScore: input.awayScore,
            status: "completed",
            resolvedIxTime: IxTime.getCurrentIxTime(),
          },
        });

        await recalculateStandings(ctx.db, match.seasonId);

        return updatedMatch;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to override match result",
        });
      }
    }),

  regenerateSchedule: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: {
            league: {
              include: { teams: true },
            },
          },
        });
        if (!season) throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        assertOwnsLeague(ctx, season.league);

        const completedMatch = await ctx.db.sportMatch.findFirst({
          where: { seasonId: input.seasonId, status: "completed" },
        });
        if (completedMatch) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot regenerate schedule once games have been played",
          });
        }

        await ctx.db.sportMatch.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportRace.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportBracket.deleteMany({ where: { seasonId: input.seasonId } });

        await persistSeasonSchedule(ctx.db, {
          seasonId: season.id,
          startIxTime: IxTime.getCurrentIxTime(),
          league: season.league,
          teams: season.league.teams,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to regenerate schedule",
        });
      }
    }),

  generateMatchCommentary: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        force: z.boolean().optional(),
        config: z
          .object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiUrl: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            reasoning: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: {
            season: {
              include: {
                league: { select: { sportPreset: true } },
              },
            },
          },
        });

        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const stats = (match.matchStats as Record<string, any>) ?? {};
        const events = stats.trace ?? [];

        if (events.length === 0) {
          return { commentary: [] };
        }

        // Cache-first: commentary is deterministic per match, so serve the stored
        // copy for free unless an owner explicitly forces a regenerate. This makes
        // reloads instant and bounds LLM cost to one call per match.
        const cached = stats.commentary as string[] | undefined;
        if (!input.force && cached && cached.length > 0) {
          return { commentary: cached };
        }

        // Generating fresh commentary hits a paid LLM — gate it behind auth so
        // anonymous traffic can only read the cache, never trigger new calls.
        if (!ctx.auth?.userId) {
          return { commentary: cached ?? [] };
        }

        const { narrateEvents, generateAudioBroadcast } =
          await import("~/lib/sports/commentary/narrator");
        const commentary = await narrateEvents(events, {
          sport: match.season.league.sportPreset,
          config: input.config,
        });

        const broadcastAudio = await generateAudioBroadcast(commentary, input.config);

        // Save back to database
        const updatedStats = {
          ...stats,
          commentary,
          ...(broadcastAudio && { broadcastAudio }),
        };

        await ctx.db.sportMatch.update({
          where: { id: input.matchId },
          data: {
            matchStats: updatedStats,
          },
        });

        return { commentary };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate match commentary",
        });
      }
    }),
});
