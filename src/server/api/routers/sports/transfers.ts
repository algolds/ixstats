/**
 * MyLeague — Sports Transfers Router
 *
 * tRPC router for transfer listings, player market bids, escrows, and negotiations.
 *
 * Escrow safety: every listing, bid and answer runs in one transaction that first locks the
 * listed player (`transfer-escrow.ts`), then re-reads what it acts on. A bid is claimed with a
 * conditional update (pending → accepted/rejected) and an accepted listing likewise (open →
 * completed), so a second answer matches nothing and pays nothing; every payout and refund
 * also carries the bid's idempotency key (`TRANSFER_ACCEPT:<bidId>`, `TRANSFER_BID_REFUND:<bidId>`).
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/vault/exchange-service";
import { assertSportsEconomyOpen } from "~/server/api/routers/sports/_shared";
import {
  MAX_TRANSFER_SOVEREIGNS,
  lockTransferClub,
  lockTransferPlayer,
  refundTransferBidTx,
} from "~/server/api/routers/sports/transfer-escrow";

const transferSovereigns = z.number().int().min(1).max(MAX_TRANSFER_SOVEREIGNS);

export const sportsTransfersRouter = createTRPCRouter({
  listPlayerForTransfer: rateLimitedMutationProcedure
    .input(z.object({ playerId: z.string(), price: transferSovereigns }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.$transaction(async (tx) => {
          // Under the player's lock, so a relisting can't reopen a listing an accept is closing
          await lockTransferPlayer(tx, input.playerId);
          const player = await tx.sportPlayer.findUnique({
            where: { id: input.playerId },
            include: { team: true },
          });
          if (!player) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
          }
          if (!player.team || player.team.ownerUserId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this player" });
          }
          return tx.sportTransferListing.upsert({
            where: { playerId: input.playerId },
            update: { price: input.price, status: "open", teamId: player.teamId },
            create: {
              playerId: input.playerId,
              teamId: player.teamId,
              price: input.price,
              status: "open",
            },
          });
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list player",
        });
      }
    }),

  placeTransferBid: rateLimitedMutationProcedure
    .input(
      z.object({ listingId: z.string(), amount: transferSovereigns, bidderTeamId: z.string() })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const listing = await ctx.db.sportTransferListing.findUnique({
          where: { id: input.listingId },
          select: { playerId: true, status: true },
        });
        if (!listing || listing.status !== "open") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not active" });
        }
        await assertSportsEconomyOpen(ctx.db);
        return await ctx.db.$transaction(async (tx) => {
          await lockTransferClub(tx, input.bidderTeamId);
          const bidderTeam = await tx.sportTeam.findUnique({
            where: { id: input.bidderTeamId },
          });
          if (!bidderTeam || bidderTeam.ownerUserId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You do not own the bidding team" });
          }

          // Re-read the listing under the player's lock: an accept may have closed it meanwhile
          await lockTransferPlayer(tx, listing.playerId);
          const current = await tx.sportTransferListing.findUnique({
            where: { id: input.listingId },
            include: { player: { select: { team: { select: { id: true, ownerUserId: true } } } } },
          });
          if (!current || current.status !== "open") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not active" });
          }
          const seller = current.player.team;
          if (seller.id === bidderTeam.id || seller.ownerUserId === ctx.user.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You cannot bid on your own player",
            });
          }

          const spend = await exchangeService.spend(
            ctx.user.id,
            input.amount,
            "SHARE_BUY",
            `TRANSFER_BID_ESCROW:${input.listingId}`,
            tx
          );
          if (!spend.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: spend.message ?? "Insufficient balance to place bid",
            });
          }
          return tx.sportTransferBid.create({
            data: {
              listingId: input.listingId,
              bidderTeamId: input.bidderTeamId,
              bidderUserId: ctx.user.id,
              amount: input.amount,
              status: "pending",
            },
          });
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to place bid",
        });
      }
    }),

  respondToTransferBid: rateLimitedMutationProcedure
    .input(z.object({ bidId: z.string(), action: z.enum(["accept", "reject"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bid = await ctx.db.sportTransferBid.findUnique({
          where: { id: input.bidId },
          include: { listing: { select: { playerId: true } } },
        });
        if (!bid || bid.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
        }
        await assertSportsEconomyOpen(ctx.db);
        return await ctx.db.$transaction(async (tx) => {
          await lockTransferClub(tx, bid.bidderTeamId);
          await lockTransferPlayer(tx, bid.listing.playerId);
          // Re-read under the lock: the bid may have been answered meanwhile, and the seller is
          // whoever owns the player now
          const current = await tx.sportTransferBid.findUnique({
            where: { id: bid.id },
            include: { listing: { include: { player: { include: { team: true } } } } },
          });
          if (!current || current.status !== "pending") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
          }
          const listing = current.listing;
          const sellerTeam = listing.player.team;
          if (!sellerTeam || sellerTeam.ownerUserId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not own this listing's player",
            });
          }

          if (input.action === "reject") {
            if (!(await refundTransferBidTx(tx, bid, "rejected"))) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
            }
            return { success: true, message: "Bid rejected and bidder refunded." };
          }

          // Claim the bid, then the listing: a second accept, or one racing a reject or an
          // accept of another bid, matches nothing here and pays nothing
          const claimed = await tx.sportTransferBid.updateMany({
            where: { id: bid.id, status: "pending" },
            data: { status: "accepted" },
          });
          if (claimed.count !== 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
          }
          const closed = await tx.sportTransferListing.updateMany({
            where: { id: listing.id, status: "open" },
            data: { status: "completed" },
          });
          if (closed.count !== 1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not active" });
          }

          // Pay out seller
          const payout = `TRANSFER_ACCEPT:${bid.id}`;
          const earnResult = await exchangeService.earn(
            ctx.user.id,
            bid.amount,
            "SHARE_SELL",
            payout,
            tx,
            undefined,
            { idempotencyKey: payout }
          );
          if (!earnResult.success) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: earnResult.message ?? "Failed to pay out seller",
            });
          }

          // Transfer player ownership
          await tx.sportPlayer.update({
            where: { id: listing.playerId },
            data: { teamId: bid.bidderTeamId },
          });

          // Reject other bids and refund escrow
          const otherBids = await tx.sportTransferBid.findMany({
            where: { listingId: listing.id, status: "pending" },
          });
          for (const other of otherBids) {
            await refundTransferBidTx(tx, other, "rejected");
          }

          return { success: true, message: "Transfer completed successfully." };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to respond to bid",
        });
      }
    }),

  getOpenTransferListings: publicProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.sportTransferListing.findMany({
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
        const inboundBids = await ctx.db.sportTransferBid.findMany({
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
        const outboundBids = await ctx.db.sportTransferBid.findMany({
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
