/**
 * MySports Almanac & Archival Engine Router (PRD §14.3, §33, §34, Plan 321)
 * Provides comprehensive, immutable historical archives across past seasons,
 * championship titles, all-time records, and athlete career logs.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const sportsAlmanacRouter = createTRPCRouter({
  /**
   * Get full historical roll-of-honor and season archive for a league/competition
   */
  getLeagueArchive: publicProcedure
    .input(z.object({ leagueId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const seasons = await ctx.db.sportSeason.findMany({
          where: { leagueId: input.leagueId },
          include: {
            champion: {
              select: {
                id: true,
                name: true,
                shortName: true,
                color: true,
                logo: true,
                wikiSlug: true,
              },
            },
            standings: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    color: true,
                    logo: true,
                  },
                },
              },
              orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
            },
            matches: {
              where: { status: "completed" },
              select: {
                id: true,
                homeScore: true,
                awayScore: true,
                homeTeamId: true,
                awayTeamId: true,
              },
            },
          },
          orderBy: { seasonNumber: "desc" },
        });

        const archive = seasons.map((season) => {
          const totalMatches = season.matches.length;
          const totalGoals = season.matches.reduce(
            (acc, m) => acc + (m.homeScore ?? 0) + (m.awayScore ?? 0),
            0
          );

          const runnerUpStanding = season.standings[1];
          const runnerUp = runnerUpStanding
            ? {
                teamId: runnerUpStanding.teamId,
                teamName: runnerUpStanding.team.name,
                points: runnerUpStanding.points,
              }
            : null;

          return {
            seasonId: season.id,
            seasonNumber: season.seasonNumber,
            status: season.status,
            startIxTime: season.startIxTime,
            endIxTime: season.endIxTime,
            champion: season.champion
              ? {
                  teamId: season.champion.id,
                  teamName: season.champion.name,
                  shortName: season.champion.shortName,
                  color: season.champion.color,
                  logo: season.champion.logo,
                  wikiSlug: season.champion.wikiSlug,
                }
              : null,
            runnerUp,
            totalMatches,
            totalGoals,
            standingsCount: season.standings.length,
            standings: season.standings.map((s, idx) => ({
              position: idx + 1,
              teamId: s.teamId,
              teamName: s.team.name,
              shortName: s.team.shortName,
              logo: s.team.logo,
              color: s.team.color,
              played: s.wins + s.losses + s.draws,
              wins: s.wins,
              losses: s.losses,
              draws: s.draws,
              points: s.points,
              pointsFor: s.pointsFor,
              pointsAgainst: s.pointsAgainst,
            })),
          };
        });

        return archive;
      } catch (error) {
        console.error("Failed to fetch league archive:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load league archive",
        });
      }
    }),

  /**
   * Get career season-by-season progression log for an athlete
   */
  getAthleteCareerHistory: publicProcedure
    .input(z.object({ athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.athleteId },
          include: {
            team: {
              include: {
                league: true,
              },
            },
            matchStats: {
              include: {
                match: {
                  include: {
                    season: true,
                  },
                },
              },
            },
          },
        });

        if (!player) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Athlete not found" });
        }

        // Group match stats by season
        const seasonMap = new Map<
          string,
          {
            seasonNumber: number;
            seasonId: string;
            teamId: string;
            teamName: string;
            teamColor: string;
            appearances: number;
            goals: number;
            assists: number;
            shots: number;
          }
        >();

        for (const ms of player.matchStats) {
          const season = ms.match?.season;
          if (!season) continue;

          const statsObj = (ms.stats as Record<string, any>) || {};
          const existing = seasonMap.get(season.id) ?? {
            seasonNumber: season.seasonNumber,
            seasonId: season.id,
            teamId: player.teamId,
            teamName: player.team?.name ?? "Club",
            teamColor: player.team?.color ?? "#3b82f6",
            appearances: 0,
            goals: 0,
            assists: 0,
            shots: 0,
          };

          existing.appearances++;
          existing.goals += Number(statsObj.goals ?? 0);
          existing.assists += Number(statsObj.assists ?? 0);
          existing.shots += Number(statsObj.shots ?? 0);

          seasonMap.set(season.id, existing);
        }

        const careerLog = Array.from(seasonMap.values()).sort(
          (a, b) => b.seasonNumber - a.seasonNumber
        );

        // Calculate totals
        const careerTotals = careerLog.reduce(
          (acc, row) => ({
            appearances: acc.appearances + row.appearances,
            goals: acc.goals + row.goals,
            assists: acc.assists + row.assists,
            shots: acc.shots + row.shots,
          }),
          { appearances: 0, goals: 0, assists: 0, shots: 0 }
        );

        return {
          athleteId: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          careerStage: player.careerStage,
          currentTeam: player.team
            ? {
                id: player.team.id,
                name: player.team.name,
                color: player.team.color,
                logo: player.team.logo,
                leagueName: player.team.league.name,
              }
            : null,
          careerLog,
          careerTotals,
        };
      } catch (error) {
        console.error("Failed to fetch athlete career history:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load athlete career log",
        });
      }
    }),

  /**
   * Get all-time records and leaderboards for a competition
   */
  getAllTimeRecords: publicProcedure
    .input(z.object({ leagueId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const completedSeasons = await ctx.db.sportSeason.findMany({
          where: { leagueId: input.leagueId, status: "completed" },
          include: {
            champion: { select: { id: true, name: true, logo: true, color: true } },
            standings: {
              include: { team: { select: { id: true, name: true, logo: true, color: true } } },
            },
            matches: {
              where: { status: "completed" },
              include: {
                homeTeam: { select: { id: true, name: true } },
                awayTeam: { select: { id: true, name: true } },
              },
            },
          },
        });

        // 1. Most Championship Titles
        const titleCounts = new Map<
          string,
          { teamId: string; teamName: string; logo: string | null; color: string; titles: number }
        >();
        for (const s of completedSeasons) {
          if (s.champion) {
            const existing = titleCounts.get(s.champion.id) ?? {
              teamId: s.champion.id,
              teamName: s.champion.name,
              logo: s.champion.logo,
              color: s.champion.color,
              titles: 0,
            };
            existing.titles++;
            titleCounts.set(s.champion.id, existing);
          }
        }
        const topChampions = Array.from(titleCounts.values()).sort((a, b) => b.titles - a.titles);

        // 2. Highest Scoring Match
        let highestScoringMatch: {
          matchId: string;
          homeName: string;
          awayName: string;
          homeScore: number;
          awayScore: number;
          totalGoals: number;
          seasonNumber?: number;
        } | null = null;

        for (const s of completedSeasons) {
          for (const m of s.matches) {
            const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
            if (!highestScoringMatch || total > highestScoringMatch.totalGoals) {
              highestScoringMatch = {
                matchId: m.id,
                homeName: m.homeTeam.name,
                awayName: m.awayTeam.name,
                homeScore: m.homeScore ?? 0,
                awayScore: m.awayScore ?? 0,
                totalGoals: total,
                seasonNumber: s.seasonNumber,
              };
            }
          }
        }

        // 3. All-Time Team Points Leaderboard
        const allTimeTeamStats = new Map<
          string,
          {
            teamId: string;
            teamName: string;
            logo: string | null;
            color: string;
            played: number;
            wins: number;
            points: number;
            goalsFor: number;
          }
        >();

        for (const s of completedSeasons) {
          for (const st of s.standings) {
            const existing = allTimeTeamStats.get(st.teamId) ?? {
              teamId: st.teamId,
              teamName: st.team.name,
              logo: st.team.logo,
              color: st.team.color,
              played: 0,
              wins: 0,
              points: 0,
              goalsFor: 0,
            };
            const wins = st.wins ?? 0;
            const losses = st.losses ?? 0;
            existing.played += wins + losses + st.draws;
            existing.wins += wins;
            existing.points += st.points;
            existing.goalsFor += st.pointsFor;
            allTimeTeamStats.set(st.teamId, existing);
          }
        }

        const teamLeaderboard = Array.from(allTimeTeamStats.values()).sort(
          (a, b) => b.points - a.points
        );

        return {
          totalCompletedSeasons: completedSeasons.length,
          topChampions,
          highestScoringMatch,
          teamLeaderboard,
        };
      } catch (error) {
        console.error("Failed to calculate all-time records:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute all-time records",
        });
      }
    }),
});
