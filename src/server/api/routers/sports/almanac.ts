/**
 * MySports Almanac & Archival Engine Router (PRD §14.3, §33, §34, Plan 321)
 * Provides comprehensive, immutable historical archives across past seasons,
 * championship titles, all-time records, and athlete career logs.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

/** Season awards written by transition.ts, keyed by SportSeasonRecord.recordType. */
const PLAYER_AWARD_LABELS: Record<string, string> = {
  top_scorer: "Top Scorer",
  most_assists: "Most Assists",
  mvp: "MVP",
};

function statCount(stats: Prisma.JsonValue | null, key: "goals" | "assists"): number {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return 0;
  const value = stats[key];
  return typeof value === "number" ? value : 0;
}

interface CareerSeason {
  seasonId: string;
  seasonNumber: number;
  matches: number;
  goals: number;
  assists: number;
  awards: string[];
}

function buildCareerLog(
  matchStats: Array<{
    stats: Prisma.JsonValue | null;
    match: { seasonId: string; season: { seasonNumber: number } };
  }>,
  awards: Array<{ seasonId: string; recordType: string }>
) {
  const bySeason = new Map<string, CareerSeason>();
  for (const { stats, match } of matchStats) {
    const row = bySeason.get(match.seasonId) ?? {
      seasonId: match.seasonId,
      seasonNumber: match.season.seasonNumber,
      matches: 0,
      goals: 0,
      assists: 0,
      awards: [],
    };
    row.matches++;
    row.goals += statCount(stats, "goals");
    row.assists += statCount(stats, "assists");
    bySeason.set(match.seasonId, row);
  }
  for (const award of awards) {
    bySeason.get(award.seasonId)?.awards.push(PLAYER_AWARD_LABELS[award.recordType] ?? award.recordType);
  }

  const seasons = Array.from(bySeason.values()).sort((a, b) => b.seasonNumber - a.seasonNumber);
  const totals = seasons.reduce(
    (acc, s) => ({
      matches: acc.matches + s.matches,
      goals: acc.goals + s.goals,
      assists: acc.assists + s.assists,
    }),
    { matches: 0, goals: 0, assists: 0 }
  );
  return { seasons, totals };
}

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
   * Season-by-season career log for an athlete (SportsFocusPanel career section).
   * `matches` counts the matches where the athlete has a stat line (a shot, goal or assist).
   */
  getAthleteCareerHistory: publicProcedure
    .input(z.object({ athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [matchStats, awards] = await Promise.all([
        ctx.db.sportMatchStat.findMany({
          where: { playerId: input.athleteId },
          select: {
            stats: true,
            match: { select: { seasonId: true, season: { select: { seasonNumber: true } } } },
          },
        }),
        ctx.db.sportSeasonRecord.findMany({
          where: {
            holderId: input.athleteId,
            recordType: { in: Object.keys(PLAYER_AWARD_LABELS) },
          },
          select: { seasonId: true, recordType: true },
        }),
      ]);
      return buildCareerLog(matchStats, awards);
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
