/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/vault/exchange-service";

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
        const spend = await exchangeService.spend(
          ctx.user.id,
          input.amount,
          "SHARE_BUY",
          `TRANSFER_BID_ESCROW:${input.listingId}`,
          ctx.db as any
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance to place bid",
          });
        }
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
          return await ctx.db.$transaction(async (tx) => {
            // Pay out seller
            const earnResult = await exchangeService.earn(
              ctx.user.id,
              bid.amount,
              "SHARE_SELL",
              `TRANSFER_ACCEPT:${bid.id}`,
              tx as any
            );
            if (!earnResult.success) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: earnResult.message ?? "Failed to pay out seller",
              });
            }

            // Transfer player ownership
            await tx.sportPlayer.update({
              where: { id: bid.listing.playerId },
              data: { teamId: bid.bidderTeamId },
            });

            // Update listing status
            await (tx as any).sportTransferListing.update({
              where: { id: bid.listingId },
              data: { status: "completed" },
            });

            // Accept the bid
            await (tx as any).sportTransferBid.update({
              where: { id: bid.id },
              data: { status: "accepted" },
            });

            // Reject other bids and refund escrow
            const otherBids = await (tx as any).sportTransferBid.findMany({
              where: { listingId: bid.listingId, id: { not: bid.id }, status: "pending" },
            });

            for (const other of otherBids) {
              const refundResult = await exchangeService.earn(
                other.bidderUserId,
                other.amount,
                "ADMIN_ADJUSTMENT",
                `TRANSFER_BID_REFUND:${other.id}`,
                tx as any
              );
              if (!refundResult.success) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: refundResult.message ?? `Failed to refund bid ${other.id}`,
                });
              }
              await (tx as any).sportTransferBid.update({
                where: { id: other.id },
                data: { status: "rejected" },
              });
            }

            return { success: true, message: "Transfer completed successfully." };
          });
        } else {
          return await ctx.db.$transaction(async (tx) => {
            // Reject bid and refund bidder
            await (tx as any).sportTransferBid.update({
              where: { id: bid.id },
              data: { status: "rejected" },
            });

            const refundResult = await exchangeService.earn(
              bid.bidderUserId,
              bid.amount,
              "ADMIN_ADJUSTMENT",
              `TRANSFER_BID_REFUND:${bid.id}`,
              tx as any
            );
            if (!refundResult.success) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: refundResult.message ?? "Failed to refund bidder",
              });
            }

            return { success: true, message: "Bid rejected and bidder refunded." };
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to respond to bid",
        });
      }
    }),

  // Bidder withdraws their own pending bid; escrow is refunded.
  withdrawTransferBid: protectedProcedure
    .input(z.object({ bidId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bid = await (ctx.db as any).sportTransferBid.findUnique({
          where: { id: input.bidId },
        });
        if (!bid || bid.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
        }
        if (bid.bidderUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your bid" });
        }
        await exchangeService.earn(
          ctx.user.id,
          bid.amount,
          "ADMIN_ADJUSTMENT",
          `TRANSFER_BID_REFUND:${bid.id}`,
          ctx.db as any
        );
        await (ctx.db as any).sportTransferBid.update({
          where: { id: bid.id },
          data: { status: "withdrawn" },
        });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to withdraw bid" });
      }
    }),

  // Seller cancels a listing; all pending bids are refunded and rejected.
  cancelTransferListing: protectedProcedure
    .input(z.object({ listingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const listing = await (ctx.db as any).sportTransferListing.findUnique({
          where: { id: input.listingId },
          include: { player: { include: { team: true } } },
        });
        if (!listing || listing.status !== "open") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not active" });
        }
        if (listing.player.team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this listing" });
        }
        const pendingBids = await (ctx.db as any).sportTransferBid.findMany({
          where: { listingId: listing.id, status: "pending" },
        });
        for (const b of pendingBids) {
          await exchangeService.earn(
            b.bidderUserId,
            b.amount,
            "ADMIN_ADJUSTMENT",
            `TRANSFER_BID_REFUND:${b.id}`,
            ctx.db as any
          );
          await (ctx.db as any).sportTransferBid.update({
            where: { id: b.id },
            data: { status: "rejected" },
          });
        }
        await (ctx.db as any).sportTransferListing.update({
          where: { id: listing.id },
          data: { status: "cancelled" },
        });
        return { success: true, refunded: pendingBids.length };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to cancel listing" });
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
    } catch {
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
