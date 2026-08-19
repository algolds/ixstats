/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import {
  generateSchedule,
  matchIntervalMs,
  raceIntervalMs,
  transitionSeasonAction,
  type ArchetypeType,
} from "~/lib/sports";

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsSeasonsLifecycleRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  collectMatchRevenue: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const ticketRevenue =
          team.stadiumCapacity * team.ticketPrice * 0.6 * (team.popularity / 100);
        const sponsorIncome = (team.sponsor as any)?.baseFee ?? 0;
        const totalIncome = Math.round(ticketRevenue + sponsorIncome);

        const currentBudget = team.budget ?? 0;
        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { budget: currentBudget + totalIncome },
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

  startSeason: protectedProcedure
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

        if (league.archetype === "circuit") {
          // Generate race calendar
          const schedule = generateSchedule({
            archetype: league.archetype as ArchetypeType,
            teamCount: teamIds.length,
            raceCount: (league.settings as Record<string, unknown> | null)?.raceCount as
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
                  startIxTime + (rRec.raceNumber as number) * raceIntervalMs(league.settings),
              },
            });
          }
        } else if (league.archetype === "bracket") {
          // Create initial bracket matchups: seed teams by index, pair 1vN, 2v(N-1), etc.
          const shuffled = [...league.teams].sort(() => Math.random() - 0.5);
          const pairs: Array<[(typeof league.teams)[0], (typeof league.teams)[0]]> = [];
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
          // League or division_conference archetype: generate match schedule
          const schedule = generateSchedule({
            archetype: league.archetype as ArchetypeType,
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
                  startIxTime + ((mRec.matchDay as number) ?? 1) * matchIntervalMs(league.settings),
              },
            });
          }
        }

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
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
          },
          matches: {
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
            homeTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logo: true,
                color: true,
                wikiSlug: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logo: true,
                color: true,
                wikiSlug: true,
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
          const playerMap = new Map<string, { goals: number; assists: number; shots: number }>();
          const actorNames = new Map<string, string>();

          for (let i = 0; i < trace.length; i++) {
            const event = trace[i];
            const actorId = event.actorId;
            if (!actorId) continue;

            if (event.actorName) {
              actorNames.set(actorId, event.actorName);
            }

            if (!playerMap.has(actorId)) {
              playerMap.set(actorId, { goals: 0, assists: 0, shots: 0 });
            }

            const pStat = playerMap.get(actorId)!;

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
          for (let i = 0; i < trace.length; i++) {
            const event = trace[i];
            if (event.type === "goal" && event.actorId) {
              const scorerId = event.actorId;
              const candidates = Array.from(playerMap.keys()).filter((id) => id !== scorerId);
              if (candidates.length > 0) {
                const idx = (i * 7) % candidates.length;
                const candidateId = candidates[idx];
                playerMap.get(candidateId)!.assists++;
              }
            }
          }

          const playerIds = Array.from(playerMap.keys());
          const dbPlayers = await ctx.db.sportPlayer.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, firstName: true, lastName: true, position: true },
          });

          const dbPlayersMap = new Map(dbPlayers.map((p) => [p.id, p]));

          playerStats = playerIds.map((id) => {
            const dbPlayer = dbPlayersMap.get(id);
            const fullName = actorNames.get(id) || "Player";
            const parts = fullName.split(" ");
            const firstName = dbPlayer?.firstName || parts[0] || "Unknown";
            const lastName = dbPlayer?.lastName || parts.slice(1).join(" ") || "Player";
            const position = dbPlayer?.position || "MID";

            return {
              id: `temp-${id}`,
              matchId: input.matchId,
              playerId: id,
              stats: playerMap.get(id) || { goals: 0, assists: 0, shots: 0 },
              createdAt: new Date(),
              player: {
                firstName,
                lastName,
                position,
              },
            } as any;
          });
        }

        return {
          ...match,
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

  transitionToNextSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
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

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
