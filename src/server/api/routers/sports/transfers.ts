/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getPreset, type SportPresetKey, type TeamRatingVector } from "~/lib/sports";
import { exchangeService } from "~/lib/exchange-service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line unused-imports/no-unused-vars
function simpleHash(seasonId: string, matchDay: number, matchIndex: number): number {
  return (
    seasonId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 31 + matchDay * 7 + matchIndex
  );
}

// eslint-disable-next-line unused-imports/no-unused-vars
function teamIndexHash(leagueId: string, teamIndex: number, playerIndex: number): number {
  return (
    leagueId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17 +
    teamIndex * 13 +
    playerIndex * 3
  );
}

// eslint-disable-next-line unused-imports/no-unused-vars
async function getTeamModifiers(team: any, db: any, effectsMap?: Map<string, any[]>) {
  if (!team.nationId) return undefined;

  let effects: any[] = [];
  if (effectsMap) {
    effects = effectsMap.get(team.nationId) ?? [];
  } else {
    effects = await db.storytellerEffect.findMany({
      where: {
        countryId: team.nationId,
        isActive: true,
      },
    });
  }

  let saintBlessing = 0;
  let countryScandal = 0;
  for (const e of effects) {
    if (e.inputType === "sports_saint_blessing") {
      saintBlessing += Math.abs(e.value);
    } else if (e.inputType === "sports_scandal") {
      countryScandal += Math.abs(e.value);
    }
  }

  return {
    saintName: (team as any).patronSaint || undefined,
    saintBlessing: saintBlessing > 0 ? saintBlessing : undefined,
    countryScandal: countryScandal > 0 ? countryScandal : undefined,
  };
}

const careerStageMultiplier: Record<string, number> = {
  rookie: 0.7,
  developing: 0.85,
  prime: 1.0,
  plateau: 0.95,
  declining: 0.75,
  retired: 0,
};

// eslint-disable-next-line unused-imports/no-unused-vars
function computeTeamRatingVector(
  players: Array<{
    isActive: boolean;
    ratings: Record<string, unknown> | null;
    careerStage: string;
    position?: string;
    id?: string;
  }>,
  coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }>,
  sportPresetKey: string = "soccer",
  formAdjustment = 0
): TeamRatingVector {
  const activePlayers = players.filter((p) => p.isActive && p.ratings);
  const preset = getPreset(sportPresetKey as SportPresetKey) || getPreset("soccer");

  // 1. Group players by position
  const positionGroups: Record<string, typeof activePlayers> = {};
  for (const player of activePlayers) {
    const pos = player.position || preset.positions[0] || "GK";
    positionGroups[pos] = positionGroups[pos] || [];
    positionGroups[pos].push(player);
  }

  // Sort each group by overall rating descending
  const getPlayerOverall = (p: any): number => {
    const ratings = p.ratings as Record<string, number>;
    if (!ratings) return 50;
    if (typeof ratings.overall === "number") return ratings.overall;
    const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  for (const pos of Object.keys(positionGroups)) {
    positionGroups[pos].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
  }

  // 2. Select starters based on startingSlots
  const starters: typeof activePlayers = [];
  const bench: typeof activePlayers = [];
  const slotsConfig = preset.startingSlots || {};

  const assignedPlayerIds = new Set<string>();

  // Assign players to their primary starting positions
  for (const [pos, count] of Object.entries(slotsConfig)) {
    const available = positionGroups[pos] || [];
    const startersForPos = available.slice(0, count as number);
    starters.push(...startersForPos);
    startersForPos.forEach((p) => p.id && assignedPlayerIds.add(p.id));
  }

  // Any active player not assigned is bench
  for (const player of activePlayers) {
    if (player.id && !assignedPlayerIds.has(player.id)) {
      bench.push(player);
    }
  }

  // 3. Compute ratings averages
  const computeAverageAttribute = (
    playerSet: typeof activePlayers,
    attributes: string[]
  ): number => {
    if (playerSet.length === 0) return 60;
    let sum = 0;
    let count = 0;
    for (const p of playerSet) {
      const mult = careerStageMultiplier[p.careerStage] ?? 0.8;
      const ratings = p.ratings as Record<string, number>;
      for (const attr of attributes) {
        if (ratings && typeof ratings[attr] === "number") {
          sum += ratings[attr] * mult;
          count++;
        }
      }
    }
    return count > 0 ? Math.round(sum / count) : 60;
  };

  const computeAverageOverall = (playerSet: typeof activePlayers): number => {
    if (playerSet.length === 0) return 60;
    let sum = 0;
    for (const p of playerSet) {
      const mult = careerStageMultiplier[p.careerStage] ?? 0.8;
      sum += getPlayerOverall(p) * mult;
    }
    return Math.round(sum / playerSet.length);
  };

  const overall = computeAverageOverall(starters);
  const offense = computeAverageAttribute(starters, preset.offenseAttributes);
  const defense = computeAverageAttribute(starters, preset.defenseAttributes);
  const depth = computeAverageOverall(bench);

  // Coach rating
  const activeCoaches = coaches.filter((c) => c.isActive && c.ratings);
  let coaching = 50;
  if (activeCoaches.length > 0) {
    const sum = activeCoaches.reduce((acc, c) => {
      const r = c.ratings as Record<string, number>;
      return acc + (r.strategy ?? 50);
    }, 0);
    coaching = Math.round(sum / activeCoaches.length);
  }

  return {
    overall,
    offense,
    defense,
    form: 50 + formAdjustment,
    depth,
    coaching,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsTransfersRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════

  listPlayerForTransfer: protectedProcedure
    .input(z.object({ playerId: z.string(), price: z.number().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.playerId },
          include: { team: true },
        });
        if (!player) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        }
        if (player.team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this player" });
        }
        return await (ctx.db as any).sportTransferListing.upsert({
          where: { playerId: input.playerId },
          update: { price: input.price, status: "open", teamId: player.teamId },
          create: {
            playerId: input.playerId,
            teamId: player.teamId,
            price: input.price,
            status: "open",
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list player",
        });
      }
    }),

  placeTransferBid: protectedProcedure
    .input(z.object({ listingId: z.string(), amount: z.number().min(1), bidderTeamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const listing = await (ctx.db as any).sportTransferListing.findUnique({
          where: { id: input.listingId },
        });
        if (!listing || listing.status !== "open") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not active" });
        }
        const bidderTeam = await ctx.db.sportTeam.findUnique({
          where: { id: input.bidderTeamId },
        });
        if (!bidderTeam || bidderTeam.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own the bidding team" });
        }
        await exchangeService.spend(
          ctx.user.id,
          input.amount,
          "SHARE_BUY",
          `TRANSFER_BID_ESCROW:${input.listingId}`,
          ctx.db as any
        );
        return await (ctx.db as any).sportTransferBid.create({
          data: {
            listingId: input.listingId,
            bidderTeamId: input.bidderTeamId,
            bidderUserId: ctx.user.id,
            amount: input.amount,
            status: "pending",
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to place bid",
        });
      }
    }),

  respondToTransferBid: protectedProcedure
    .input(z.object({ bidId: z.string(), action: z.enum(["accept", "reject"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bid = await (ctx.db as any).sportTransferBid.findUnique({
          where: { id: input.bidId },
          include: {
            listing: {
              include: {
                player: {
                  include: { team: true },
                },
              },
            },
          },
        });
        if (!bid || bid.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
        }
        const sellerTeam = bid.listing.player.team;
        if (sellerTeam.ownerUserId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not own this listing's player",
          });
        }
        if (input.action === "accept") {
          // Pay out seller
          await exchangeService.earn(
            ctx.user.id,
            bid.amount,
            "SHARE_SELL",
            `TRANSFER_ACCEPT:${bid.id}`,
            ctx.db as any
          );
          // Transfer player ownership
          await ctx.db.sportPlayer.update({
            where: { id: bid.listing.playerId },
            data: { teamId: bid.bidderTeamId },
          });
          // Update listing status
          await (ctx.db as any).sportTransferListing.update({
            where: { id: bid.listingId },
            data: { status: "completed" },
          });
          // Accept the bid
          await (ctx.db as any).sportTransferBid.update({
            where: { id: bid.id },
            data: { status: "accepted" },
          });
          // Reject other bids and refund escrow
          const otherBids = await (ctx.db as any).sportTransferBid.findMany({
            where: { listingId: bid.listingId, id: { not: bid.id }, status: "pending" },
          });
          for (const other of otherBids) {
            await exchangeService.earn(
              other.bidderUserId,
              other.amount,
              "ADMIN_ADJUSTMENT",
              `TRANSFER_BID_REFUND:${other.id}`,
              ctx.db as any
            );
            await (ctx.db as any).sportTransferBid.update({
              where: { id: other.id },
              data: { status: "rejected" },
            });
          }
          return { success: true, message: "Transfer completed successfully." };
        } else {
          // Reject bid and refund bidder
          await (ctx.db as any).sportTransferBid.update({
            where: { id: bid.id },
            data: { status: "rejected" },
          });
          await exchangeService.earn(
            bid.bidderUserId,
            bid.amount,
            "ADMIN_ADJUSTMENT",
            `TRANSFER_BID_REFUND:${bid.id}`,
            ctx.db as any
          );
          return { success: true, message: "Bid rejected and bidder refunded." };
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to respond to bid",
        });
      }
    }),

  getPlayerValuation: publicProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.playerId },
        });
        if (!player) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        }
        const ratings = (player.ratings as Record<string, any>) || {};
        const overall = ratings.overall || 50;
        const form = ratings.form || 50;
        const value = Math.max(100, Math.min(10000, overall * 50 * (1 + (form - 50) / 100)));
        return { valuation: Math.round(value) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate player value",
        });
      }
    }),

  getOpenTransferListings: publicProcedure.query(async ({ ctx }) => {
    try {
      return await (ctx.db as any).sportTransferListing.findMany({
        where: { status: "open" },
        include: {
          player: {
            include: { team: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch transfer listings",
      });
    }
  }),

  getTeamBids: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId, ownerUserId: ctx.user.id },
        });
        if (!team) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }
        const inboundBids = await (ctx.db as any).sportTransferBid.findMany({
          where: {
            listing: {
              teamId: input.teamId,
              status: "open",
            },
            status: "pending",
          },
          include: {
            listing: {
              include: {
                player: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        const outboundBids = await (ctx.db as any).sportTransferBid.findMany({
          where: {
            bidderTeamId: input.teamId,
          },
          include: {
            listing: {
              include: {
                player: {
                  include: {
                    team: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        return { inboundBids, outboundBids };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team bids",
        });
      }
    }),
});
