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
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

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

  getLeagueHistory: publicProcedure
    .input(z.object({ leagueId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const seasons = await ctx.db.sportSeason.findMany({
          where: { leagueId: input.leagueId, status: "completed" },
          include: {
            champion: { select: { id: true, name: true } },
          },
          orderBy: { seasonNumber: "desc" },
        });

        return seasons.map((s) => ({
          seasonId: s.id,
          seasonNumber: s.seasonNumber,
          championTeamId: s.championTeamId,
          championTeamName: s.champion?.name ?? null,
          startIxTime: s.startIxTime,
          endIxTime: s.endIxTime,
        }));
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch league history",
        });
      }
    }),

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

  getRecords: publicProcedure
    .input(z.object({ leagueId: z.string(), recordType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const records = await ctx.db.sportSeasonRecord.findMany({
          where: {
            leagueId: input.leagueId,
            ...(input.recordType && { recordType: input.recordType }),
          },
          include: {
            season: { select: { seasonNumber: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        if (records.length === 0) {
          // Compute live records if none exist in DB
          const standings = await ctx.db.sportStanding.findMany({
            where: {
              season: {
                leagueId: input.leagueId,
                status: "completed",
              },
            },
            include: {
              team: { select: { id: true, name: true } },
              season: { select: { seasonNumber: true } },
            },
          });

          const teamWins: Record<string, { teamId: string; teamName: string; wins: number }> = {};
          for (const s of standings) {
            const key = s.teamId;
            if (!teamWins[key]) {
              teamWins[key] = { teamId: s.teamId, teamName: s.team.name, wins: 0 };
            }
            teamWins[key].wins += s.wins;
          }

          const mostWins = Object.values(teamWins)
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 5);

          // Count championships
          const seasons = await ctx.db.sportSeason.findMany({
            where: { leagueId: input.leagueId, status: "completed", championTeamId: { not: null } },
            select: { championTeamId: true },
          });
          const champCount: Record<string, number> = {};
          for (const s of seasons) {
            if (s.championTeamId) {
              champCount[s.championTeamId] = (champCount[s.championTeamId] ?? 0) + 1;
            }
          }
          const mostChampionships = Object.entries(champCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([teamId, count]) => ({ teamId, championships: count }));

          return {
            mostWins,
            mostChampionships,
            totalSeasons: standings.length > 0 ? new Set(standings.map((s) => s.seasonId)).size : 0,
          };
        }

        return records;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch records",
        });
      }
    }),

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
