/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsStandingsRouter = createTRPCRouter({
  // ═══ Season & Simulation ════════════════════════════════════════════════════

  getStandings: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const standings = await ctx.db.sportStanding.findMany({
          where: { seasonId: input.seasonId },
          include: {
            team: {
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
          orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
        });

        return standings.map((s, i) => ({ ...s, position: i + 1 }));
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch standings",
        });
      }
    }),

  getBracket: publicProcedure
    .input(z.object({ seasonId: z.string(), weightClass: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const brackets = await ctx.db.sportBracket.findMany({
          where: {
            seasonId: input.seasonId,
            ...(input.weightClass && { weightClass: input.weightClass }),
          },
          orderBy: { round: "asc" },
        });

        return brackets;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch bracket",
        });
      }
    }),

  getRaceResults: publicProcedure
    .input(z.object({ seasonId: z.string(), raceNumber: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const races = await ctx.db.sportRace.findMany({
          where: {
            seasonId: input.seasonId,
            ...(input.raceNumber !== undefined && { raceNumber: input.raceNumber }),
          },
          orderBy: { raceNumber: "asc" },
        });

        return races;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch race results",
        });
      }
    }),

  // ═══ History & Records ══════════════════════════════════════════════════════

  getTeamHistory: publicProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const teamSeasons = await ctx.db.sportTeamSeason.findMany({
          where: { teamId: input.teamId },
          include: {
            season: {
              select: { id: true, seasonNumber: true, status: true, championTeamId: true },
            },
          },
          orderBy: { season: { seasonNumber: "desc" } },
        });

        // Batch all standings for this team's seasons in one query (was 2 per season).
        const seasonIds = teamSeasons.map((ts) => ts.seasonId);
        const allStandings = await ctx.db.sportStanding.findMany({
          where: { seasonId: { in: seasonIds } },
          orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
        });

        const bySeason = new Map<string, typeof allStandings>();
        for (const s of allStandings) {
          const list = bySeason.get(s.seasonId) ?? [];
          list.push(s);
          bySeason.set(s.seasonId, list);
        }

        const history = teamSeasons.map((ts) => {
          const seasonStandings = bySeason.get(ts.seasonId) ?? [];
          const position = seasonStandings.findIndex((s) => s.teamId === input.teamId) + 1;
          const standing = seasonStandings.find((s) => s.teamId === input.teamId);

          return {
            seasonNumber: ts.season.seasonNumber,
            seasonId: ts.seasonId,
            status: ts.season.status,
            wins: standing?.wins ?? 0,
            losses: standing?.losses ?? 0,
            draws: standing?.draws ?? 0,
            points: standing?.points ?? 0,
            pointsFor: standing?.pointsFor ?? 0,
            pointsAgainst: standing?.pointsAgainst ?? 0,
            position: position > 0 ? position : null,
            isChampion: ts.season.championTeamId === input.teamId,
          };
        });

        return history;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team history",
        });
      }
    }),

  getLiveMatches: publicProcedure
    .input(z.object({ teamId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const teamId = input?.teamId;
        const matches = await ctx.db.sportMatch.findMany({
          where: {
            status: { in: ["in_progress", "completed", "scheduled"] },
            ...(teamId ? { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } : {}),
          },
          select: {
            id: true,
            homeTeamId: true,
            awayTeamId: true,
            homeScore: true,
            awayScore: true,
            status: true,
            matchStats: true,
            homeTeam: { select: { id: true, name: true, shortName: true, color: true } },
            awayTeam: { select: { id: true, name: true, shortName: true, color: true } },
          },
          // Scheduled matches have a null resolvedIxTime; keep them behind finished ones.
          orderBy: { resolvedIxTime: { sort: "desc", nulls: "last" } },
          take: 10,
        });

        return matches.map((m) => {
          const stats = (m.matchStats as Record<string, unknown> | null) ?? {};
          return {
            id: m.id,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            trace: stats.trace ?? [],
            finalHomeScore: m.homeScore,
            finalAwayScore: m.awayScore,
            status: m.status,
          };
        });
      } catch (_err) {
        return [];
      }
    }),
});
