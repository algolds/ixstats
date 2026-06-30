/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/exchange-service";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { teamWageBill } from "~/lib/sports";
import { IxTime } from "~/lib/ixtime";
import type { LiveTraceEvent } from "~/lib/sports/live-match";

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsTeamsRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  getTeams: publicProcedure
    .input(
      z.object({
        leagueId: z.string().optional(),
        nationId: z.string().optional(),
        ownerUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const teams = await ctx.db.sportTeam.findMany({
          where: {
            ...(input.leagueId && { leagueId: input.leagueId }),
            ...(input.nationId && { nationId: input.nationId }),
            ...(input.ownerUserId && { ownerUserId: input.ownerUserId }),
          },
          include: {
            league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
          },
          orderBy: { name: "asc" },
        });

        return teams;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch teams",
        });
      }
    }),

  getTeam: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const team = await ctx.db.sportTeam.findUnique({
        where: { id: input.id },
        include: {
          league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
          players: { where: { isActive: true }, orderBy: { position: "asc" } },
          coaches: { where: { isActive: true } },
          seasons: {
            include: {
              season: { select: { id: true, seasonNumber: true, status: true } },
            },
            orderBy: { season: { seasonNumber: "desc" } },
          },
          nation: { select: { id: true, name: true } },
        },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      return team;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch team",
      });
    }
  }),

  updateTeam: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        color: z.string().optional(),
        nationId: z.string().optional(),
        logo: z.string().nullable().optional(),
        coverImage: z.string().nullable().optional(),
        wikiSlug: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const team = await ctx.db.sportTeam.findUnique({ where: { id } });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
        if (team.ownerUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }

        return ctx.db.sportTeam.update({ where: { id }, data });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update team",
        });
      }
    }),

  claimTeam: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId },
          include: { league: true },
        });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }

        if (team.ownerUserId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Team is already claimed",
          });
        }

        // Fetch user's SPEND_BOOST transactions to verify purchased store upgrades
        const userTxs = await ctx.db.vaultTransaction.findMany({
          where: {
            vault: { userId: ctx.user.id },
            type: "SPEND_BOOST",
          },
        });

        const checkUpgradeOwned = (upgradeId: string): boolean => {
          return userTxs.some((tx) => {
            let meta = tx.metadata;
            if (typeof meta === "string") {
              try {
                meta = JSON.parse(meta);
              } catch {}
            }
            return meta && typeof meta === "object" && (meta as any).itemId === upgradeId;
          });
        };

        // 1. Verify MyClub Team License
        const ownsClubLicense = checkUpgradeOwned("upgrade_myclub_license");
        if (!ownsClubLicense) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You must purchase the MyClub Team License Token (5,000 Vault Credits) from the Vault Store to claim a team.",
          });
        }

        // 2. Verify MyLeague Franchise Pass for canonical leagues
        if (team.league?.isCanonical) {
          const ownsFranchisePass = checkUpgradeOwned("upgrade_myleague_franchise");
          if (!ownsFranchisePass) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "You must purchase the MyLeague Franchise Pass (2,500 Vault Credits) from the Vault Store to claim a team in an official canonical league.",
            });
          }
        }

        const spend = await exchangeService.spend(
          ctx.user.id,
          50,
          "CHARTER_FEE",
          `TEAM_CLAIM:${input.teamId}`,
          ctx.db as any
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance to claim team",
          });
        }

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { ownerUserId: ctx.user.id },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to claim team",
        });
      }
    }),

  updateTeamTactics: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        tacticalIntent: z.string(),
        attackFocus: z.number().min(0).max(100).optional(),
        teamIntensity: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const lineup = (team.lineup as Record<string, any>) ?? {};
        const updatedLineup = {
          ...lineup,
          attackFocus:
            input.attackFocus !== undefined ? input.attackFocus : (lineup.attackFocus ?? 50),
          teamIntensity:
            input.teamIntensity !== undefined ? input.teamIntensity : (lineup.teamIntensity ?? 50),
        };

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: {
            tacticalIntent: input.tacticalIntent,
            lineup: updatedLineup,
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update tactics" });
      }
    }),

  selectSponsor: protectedProcedure
    .input(z.object({ teamId: z.string(), sponsorType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const sponsors: Record<string, { name: string; baseFee: number; winBonus: number }> = {
          conservative: { name: "SafeState Insurance", baseFee: 100, winBonus: 0 },
          aggressive: { name: "Apex Energy Drink", baseFee: 10, winBonus: 25 },
          corporate: { name: "Globex Logistics", baseFee: 50, winBonus: 10 },
        };
        const sponsorData = sponsors[input.sponsorType];
        if (!sponsorData) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid sponsor type" });
        }

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { sponsor: sponsorData },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to select sponsor",
        });
      }
    }),

  trainPlayer: protectedProcedure
    .input(z.object({ playerId: z.string(), attributeFocus: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.playerId },
          include: { team: true },
        });
        if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        if (!player.team || player.team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const spend = await exchangeService.spend(
          ctx.user.id,
          25,
          "TRAINING_FEE",
          `PLAYER:${input.playerId}`,
          ctx.db as any
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance to train player",
          });
        }

        const ratings = (player.ratings as Record<string, number>) ?? {};
        const current = ratings[input.attributeFocus] ?? 50;
        const gain = Math.random() < 0.4 ? Math.floor(Math.random() * 3) + 1 : 1;
        const newVal = Math.min(99, current + gain);

        return ctx.db.sportPlayer.update({
          where: { id: input.playerId },
          data: { ratings: { ...ratings, [input.attributeFocus]: newVal } },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Training failed" });
      }
    }),

  teamTraining: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const spend = await exchangeService.spend(
          ctx.user.id,
          100,
          "TEAM_TRAINING",
          `TEAM:${input.teamId}`,
          ctx.db as any
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance to train team",
          });
        }

        const players = await ctx.db.sportPlayer.findMany({
          where: { teamId: input.teamId, isActive: true },
        });

        const updatePromises = players.map(async (player) => {
          const ratings = (player.ratings as Record<string, number>) ?? {};
          const keys = Object.keys(ratings).filter((k) => k !== "overall");
          if (keys.length === 0) return;
          const attr = keys[Math.floor(Math.random() * keys.length)];
          const gain = Math.random() < 0.3 ? 1 : 0;
          if (gain > 0) {
            await ctx.db.sportPlayer.update({
              where: { id: player.id },
              data: { ratings: { ...ratings, [attr]: Math.min(99, (ratings[attr] ?? 50) + gain) } },
            });
          }
        });
        await Promise.all(updatePromises);

        return { trained: players.length };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Team training failed" });
      }
    }),

  setLineup: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        starters: z.array(z.string()),
        captainId: z.string().optional(),
        formation: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }
        const lineup = {
          starters: input.starters,
          captainId: input.captainId ?? null,
          formation: input.formation ?? "4-4-2",
        };
        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { lineup },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set lineup" });
      }
    }),

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  /**
   * Matches involving the signed-in user's clubs that resolved recently enough to
   * still be "live broadcasting" in IxTime. Drives the Halo Live Activity. Cheap
   * (indexed on resolvedIxTime/team), safe to poll every ~30s.
   */
  getLiveActivities: protectedProcedure.query(async ({ ctx }) => {
    // ponytail: window is in IxTime; 10 IxMinutes ≈ 5 real minutes at the 2x clock.
    const LIVE_WINDOW_IXMS = 10 * 60 * 1000;
    const now = IxTime.getCurrentIxTime();

    const myTeams = await ctx.db.sportTeam.findMany({
      where: { ownerUserId: ctx.user.id },
      select: { id: true },
    });
    if (myTeams.length === 0) return [];
    const teamIds = myTeams.map((t) => t.id);

    const matches = await ctx.db.sportMatch.findMany({
      where: {
        status: "completed",
        resolvedIxTime: { gte: now - LIVE_WINDOW_IXMS, lte: now },
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      },
      include: {
        homeTeam: { select: { name: true, shortName: true, color: true } },
        awayTeam: { select: { name: true, shortName: true, color: true } },
        season: { select: { league: { select: { name: true, sportPreset: true } } } },
      },
      orderBy: { resolvedIxTime: "desc" },
      take: 5,
    });

    return matches.map((m) => ({
      matchId: m.id,
      leagueName: m.season.league.name,
      sportPreset: m.season.league.sportPreset,
      resolvedIxTime: m.resolvedIxTime!,
      windowMs: LIVE_WINDOW_IXMS,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      finalHomeScore: m.homeScore ?? 0,
      finalAwayScore: m.awayScore ?? 0,
      trace: ((m.matchStats as Record<string, unknown> | null)?.trace ?? []) as LiveTraceEvent[],
    }));
  }),

  /**
   * Recent results + a head-to-head overview for the latest match. Powers the
   * MyClub "Match Overview / Last 5 Results" card (shown when no game is live).
   */
  getClubResultsOverview: publicProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const recentMatches = await ctx.db.sportMatch.findMany({
        where: {
          status: "completed",
          OR: [{ homeTeamId: input.teamId }, { awayTeamId: input.teamId }],
        },
        include: {
          homeTeam: {
            select: { id: true, name: true, shortName: true, color: true, logo: true, city: true },
          },
          awayTeam: {
            select: { id: true, name: true, shortName: true, color: true, logo: true, city: true },
          },
          season: { select: { id: true, league: { select: { name: true } } } },
        },
        orderBy: [{ resolvedIxTime: "desc" }, { matchDay: "desc" }],
        take: 5,
      });

      const recent = recentMatches.map((m) => {
        const isHome = m.homeTeamId === input.teamId;
        const opp = isHome ? m.awayTeam : m.homeTeam;
        const teamScore = (isHome ? m.homeScore : m.awayScore) ?? 0;
        const oppScore = (isHome ? m.awayScore : m.homeScore) ?? 0;
        return {
          id: m.id,
          resolvedIxTime: m.resolvedIxTime,
          isHome,
          opponent: { name: opp.name, shortName: opp.shortName, color: opp.color, logo: opp.logo },
          teamScore,
          oppScore,
          result: teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D",
          leagueName: m.season.league.name,
        };
      });

      const latest = recentMatches[0];
      let lastMatch = null;
      let comparison = null;
      if (latest) {
        lastMatch = {
          home: {
            name: latest.homeTeam.name,
            city: latest.homeTeam.city,
            color: latest.homeTeam.color,
            logo: latest.homeTeam.logo,
          },
          away: {
            name: latest.awayTeam.name,
            city: latest.awayTeam.city,
            color: latest.awayTeam.color,
            logo: latest.awayTeam.logo,
          },
          homeScore: latest.homeScore ?? 0,
          awayScore: latest.awayScore ?? 0,
          leagueName: latest.season.league.name,
          resolvedIxTime: latest.resolvedIxTime,
        };

        // Both teams' standing in the latest match's season → comparison bars.
        const standings = await ctx.db.sportStanding.findMany({
          where: {
            seasonId: latest.season.id,
            teamId: { in: [latest.homeTeamId, latest.awayTeamId] },
          },
          select: { teamId: true, wins: true, losses: true, points: true },
        });
        const stat = (id: string) =>
          standings.find((s) => s.teamId === id) ?? { wins: 0, losses: 0, points: 0 };
        comparison = {
          home: stat(latest.homeTeamId),
          away: stat(latest.awayTeamId),
        };
      }

      return { lastMatch, comparison, recent };
    }),

  getMyClubs: protectedProcedure.query(async ({ ctx }) => {
    try {
      const teams = await ctx.db.sportTeam.findMany({
        where: { ownerUserId: ctx.user.id },
        include: {
          league: {
            select: { id: true, name: true, sportPreset: true, archetype: true, status: true },
          },
        },
        orderBy: { name: "asc" },
      });

      if (teams.length === 0) return [];

      const leagueIds = Array.from(new Set(teams.map((t) => t.leagueId)));
      const teamIds = teams.map((t) => t.id);

      // Batch query active seasons
      const activeSeasons = await ctx.db.sportSeason.findMany({
        where: { leagueId: { in: leagueIds }, status: "in_progress" },
        select: { id: true, leagueId: true, seasonNumber: true },
      });
      const activeSeasonMap = new Map(activeSeasons.map((s) => [s.leagueId, s]));

      // Batch query championship counts
      const champCounts = await ctx.db.sportSeason.groupBy({
        by: ["championTeamId"],
        where: { championTeamId: { in: teamIds }, status: "completed" },
        _count: { championTeamId: true },
      });
      const champCountMap = new Map(
        champCounts.map((c) => [c.championTeamId!, c._count.championTeamId])
      );

      // Fetch standings for all active seasons of interest
      const activeSeasonIds = activeSeasons.map((s) => s.id);
      const standings = activeSeasonIds.length > 0
        ? await ctx.db.sportStanding.findMany({
            where: { seasonId: { in: activeSeasonIds } },
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
            select: {
              teamId: true,
              wins: true,
              losses: true,
              draws: true,
              points: true,
              rank: true,
              id: true,
              seasonId: true,
            },
          })
        : [];

      // Group standings by seasonId to calculate rank/position
      const standingsBySeason = new Map<string, typeof standings>();
      for (const s of standings) {
        const list = standingsBySeason.get(s.seasonId) ?? [];
        list.push(s);
        standingsBySeason.set(s.seasonId, list);
      }

      return teams.map((t) => {
        const activeSeason = activeSeasonMap.get(t.leagueId) ?? null;
        let currentStandings = null;

        if (activeSeason) {
          const seasonStandings = standingsBySeason.get(activeSeason.id) ?? [];
          const index = seasonStandings.findIndex((s) => s.teamId === t.id);
          if (index !== -1) {
            const standing = seasonStandings[index]!;
            currentStandings = {
              ...standing,
              position: index + 1,
              rank: standing.rank ?? index + 1,
            };
          }
        }

        const championships = champCountMap.get(t.id) ?? 0;

        return {
          ...t,
          activeSeason: activeSeason
            ? { id: activeSeason.id, seasonNumber: activeSeason.seasonNumber }
            : null,
          currentStandings,
          championships,
        };
      });
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch my clubs",
      });
    }
  }),

  getMyClubOverview: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId, ownerUserId: ctx.user.id },
          include: {
            players: { where: { isActive: true }, orderBy: { position: "asc" } },
            coaches: { where: { isActive: true } },
            league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
          },
        });

        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Club not found or not owned by you" });
        }

        // Current season standings
        const activeSeason = await ctx.db.sportSeason.findFirst({
          where: { leagueId: team.leagueId, status: "in_progress" },
          select: { id: true, seasonNumber: true },
        });

        let currentStandings = null;
        let upcomingMatches: Array<unknown> = [];

        if (activeSeason) {
          currentStandings = await ctx.db.sportStanding.findUnique({
            where: { seasonId_teamId: { seasonId: activeSeason.id, teamId: team.id } },
          });

          upcomingMatches = await ctx.db.sportMatch.findMany({
            where: {
              seasonId: activeSeason.id,
              status: "scheduled",
              OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
            },
            include: {
              homeTeam: { select: { id: true, name: true, shortName: true } },
              awayTeam: { select: { id: true, name: true, shortName: true } },
            },
            orderBy: { matchDay: "asc" },
            take: 5,
          });
        }

        // Team history summary
        const seasonsCount = await ctx.db.sportTeamSeason.count({
          where: { teamId: team.id },
        });

        const championships = await ctx.db.sportSeason.count({
          where: { championTeamId: team.id, status: "completed" },
        });

        return {
          team,
          activeSeason,
          currentStandings,
          upcomingMatches,
          seasonsCount,
          championships,
          wageBill: teamWageBill(team.players as any[]),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch club overview",
        });
      }
    }),

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
