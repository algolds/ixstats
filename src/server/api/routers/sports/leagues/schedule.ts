/**
 * Sports Leagues — Schedule, Matches & AI Commentary Router
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { generateSchedule, matchIntervalMs, raceIntervalMs } from "~/lib/sports";
import { isSystemOwner } from "~/lib/auth";
import { IxTime } from "~/lib/ixtime";
import { generateMatchReport, generateMatchPreview } from "~/lib/sports/commentary/narrator";
import { recalculateStandings } from "./helpers";

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
            homeTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                color: true,
                logo: true,
                wikiSlug: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                color: true,
                logo: true,
                wikiSlug: true,
              },
            },
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
        if (season.league.createdByUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this league" });
        }

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
        if (
          match.season.league.createdByUserId !== ctx.user.id &&
          !isSystemOwner(ctx.auth.userId)
        ) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this league" });
        }

        const updatedMatch = await ctx.db.sportMatch.update({
          where: { id: input.matchId },
          data: {
            homeScore: input.homeScore,
            awayScore: input.awayScore,
            status: "completed",
            resolvedIxTime: Date.now() / 1000,
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
        if (season.league.createdByUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this league" });
        }

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

        const teamIds = season.league.teams.map((t) => t.id);
        const startIxTime = IxTime.getCurrentIxTime();

        if (season.league.archetype === "circuit") {
          const schedule = generateSchedule({
            archetype: season.league.archetype as any,
            teamCount: teamIds.length,
            raceCount: (season.league.settings as Record<string, unknown> | null)?.raceCount as
              number | undefined,
          });
          const races = Array.isArray(schedule) ? schedule : [];
          for (const race of races) {
            const rRec = race as any;
            await ctx.db.sportRace.create({
              data: {
                seasonId: season.id,
                raceNumber: rRec.raceNumber as number,
                circuitName: (rRec.circuitName as string) ?? `Race ${rRec.raceNumber}`,
                status: "upcoming",
                raceIxTime:
                  startIxTime +
                  (rRec.raceNumber as number) * raceIntervalMs(season.league.settings),
              },
            });
          }
        } else if (season.league.archetype === "bracket") {
          const shuffled = [...season.league.teams].sort(() => Math.random() - 0.5);
          const pairs: Array<[any, any]> = [];
          for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
              pairs.push([shuffled[i], shuffled[i + 1]]);
            }
          }
          for (const [fighter1, fighter2] of pairs) {
            await ctx.db.sportBracket.create({
              data: {
                seasonId: season.id,
                round: 1,
                fighter1Id: fighter1.id,
                fighter2Id: fighter2.id,
                status: "scheduled",
                scheduledIxTime: startIxTime,
              },
            });
          }
        } else {
          const schedule = generateSchedule({
            archetype: season.league.archetype as any,
            teamCount: teamIds.length,
          });
          const matches = Array.isArray(schedule) ? schedule : [];
          for (const m of matches) {
            const mRec = m as any;
            await ctx.db.sportMatch.create({
              data: {
                seasonId: season.id,
                matchDay: (mRec.matchDay as number) ?? 1,
                homeTeamId: teamIds[(mRec.homeTeamIndex as number) ?? 0] ?? teamIds[0],
                awayTeamId:
                  teamIds[(mRec.awayTeamIndex as number) ?? 1] ?? teamIds[1] ?? teamIds[0],
                status: "scheduled",
                scheduledIxTime:
                  startIxTime +
                  ((mRec.matchDay as number) ?? 1) * matchIntervalMs(season.league.settings),
              },
            });
          }
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to regenerate schedule",
        });
      }
    }),

  generateMatchReport: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
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
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            playerStats: {
              include: {
                player: { select: { firstName: true, lastName: true } },
              },
            },
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

        const stats = match.matchStats as any;
        const events = stats?.trace ?? [];

        const report = await generateMatchReport({
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          homeScore: match.homeScore ?? 0,
          awayScore: match.awayScore ?? 0,
          sport: match.season.league.sportPreset,
          events: events,
          playerStats: match.playerStats as any[],
          config: input.config,
        });

        return { report };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate match report",
        });
      }
    }),

  generateMatchPreview: publicProcedure
    .input(
      z.object({
        homeTeamId: z.string(),
        awayTeamId: z.string(),
        sport: z.string(),
        standingsContext: z.string().optional(),
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
        const [homeTeam, awayTeam] = await Promise.all([
          ctx.db.sportTeam.findUnique({ where: { id: input.homeTeamId } }),
          ctx.db.sportTeam.findUnique({ where: { id: input.awayTeamId } }),
        ]);

        if (!homeTeam || !awayTeam) {
          throw new TRPCError({ code: "NOT_FOUND", message: "One or both teams not found" });
        }

        const preview = await generateMatchPreview(
          { name: homeTeam.name },
          { name: awayTeam.name },
          input.sport,
          input.standingsContext,
          input.config
        );

        return { preview };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate match preview",
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
