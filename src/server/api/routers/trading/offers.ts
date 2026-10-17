import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { TRADE_PARTIES_INCLUDE, assertTradingOpen } from "./_shared";
import { notificationAPI } from "~/lib/notifications/api";
import { getVaultConfig } from "~/lib/vault/vault-service";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { assertNoBoundCopies } from "~/lib/cards/bound";
import {
  claimPendingTradeTx,
  lockCardsTx,
  recordTradeTransfersTx,
  TradeStatus,
  transferCardsTx,
  transferCreditsTx,
  unlockCardsTx,
} from "~/lib/vault/trade-settlement";
import { clearVaultCaches } from "~/lib/vault/vault-cache";
import { refusesTradeOffer } from "~/server/shared/privacy-permissions";

const createtradeOfferSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  initiatorCardIds: z.array(z.string()).min(1, "At least one card must be offered"),
  recipientCardIds: z.array(z.string()).min(1, "At least one card must be requested"),
  initiatorCredits: z.number().int().min(0).default(0),
  recipientCredits: z.number().int().min(0).default(0),
  message: z.string().max(500).optional(),
});

const respondToTradeSchema = z.object({
  tradeId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "COUNTER"]),
  // For counter offers
  newInitiatorCardIds: z.array(z.string()).optional(),
  newRecipientCardIds: z.array(z.string()).optional(),
  newInitiatorCredits: z.number().int().min(0).optional(),
  newRecipientCredits: z.number().int().min(0).optional(),
  counterMessage: z.string().max(500).optional(),
});

export const tradingOffersRouter = createTRPCRouter({
  /**
   * Create a new trade offer
   */
  createtradeOffer: rateLimitedMutationProcedure
    .input(createtradeOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const initiatorDbId = ctx.user.id;

      const config = await getVaultConfig(ctx.db);
      assertTradingOpen(config);

      // Resolve recipient's clerkUserId to database CUID
      const recipientUser = await ctx.db.user.findUnique({
        where: { clerkUserId: input.recipientId },
      });
      if (!recipientUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipient user not found",
        });
      }
      const recipientDbId = recipientUser.id;

      // The recipient's trade-offer setting and block list (SL-4).
      if (await refusesTradeOffer(ctx.db, ctx.auth.userId, input.recipientId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This user is not accepting trade offers from you",
        });
      }

      // Verify initiator owns the cards they're offering
      const initiatorCards = await ctx.db.cardOwnership.findMany({
        where: {
          id: { in: input.initiatorCardIds },
          ownerId: initiatorDbId,
          isLocked: false,
        },
      });

      if (initiatorCards.length !== input.initiatorCardIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You don't own all the cards you're trying to trade",
        });
      }

      if (initiatorCards.some((c) => c.inscription !== null)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inscribed cards cannot be traded",
        });
      }

      // Verify recipient owns the cards being requested
      const recipientCards = await ctx.db.cardOwnership.findMany({
        where: {
          id: { in: input.recipientCardIds },
          ownerId: recipientDbId,
          isLocked: false,
        },
      });

      if (recipientCards.length !== input.recipientCardIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The recipient doesn't own all the requested cards",
        });
      }

      if (recipientCards.some((c) => c.inscription !== null)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inscribed cards cannot be traded",
        });
      }

      // Bound cards (trophies, achievement rewards) can't be traded (cards refresh §2.1)
      await assertNoBoundCopies(ctx.db, [...input.initiatorCardIds, ...input.recipientCardIds]);

      // Verify initiator has enough credits if offering any
      if (input.initiatorCredits > 0) {
        const vault = await ctx.db.myVault.findUnique({
          where: { userId: initiatorDbId },
        });

        if (!vault || vault.credits < input.initiatorCredits) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Insufficient credits",
          });
        }
      }

      // Create trade offer (expires in 24 hours) — atomically lock initiator's cards
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const trade = await ctx.db.$transaction(async (tx: any) => {
        await lockCardsTx(tx, input.initiatorCardIds, initiatorDbId);

        return await tx.tradeOffer.create({
          data: {
            initiatorId: initiatorDbId,
            recipientId: recipientDbId,
            initiatorCardIds: input.initiatorCardIds,
            recipientCardIds: input.recipientCardIds,
            initiatorCredits: input.initiatorCredits,
            recipientCredits: input.recipientCredits,
            message: input.message,
            status: "PENDING",
            expiresAt,
          },
          include: TRADE_PARTIES_INCLUDE,
        });
      });

      // Notify the recipient about the incoming trade offer
      try {
        const senderName = trade.initiator?.country?.name ?? "A player";
        await notificationAPI.create({
          title: "New Trade Offer",
          message: `${senderName} sent you a trade offer with ${input.initiatorCardIds.length} card(s)`,
          userId: input.recipientId,
          category: "economic",
          priority: "high",
          type: "info",
          source: "trading",
          href: "/vault",
          actionable: true,
          metadata: { tradeId: trade.id, cardCount: input.initiatorCardIds.length },
        });
      } catch (e) {
        console.warn("[Notifications] trading.createtradeOffer:", e);
      }

      await clearVaultCaches({ id: initiatorDbId, clerkUserId: ctx.auth?.userId });

      return trade;
    }),

  /**
   * Respond to a trade offer (accept/decline/counter)
   */
  respondToTrade: rateLimitedMutationProcedure
    .input(respondToTradeSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const config = await getVaultConfig(ctx.db);
      assertTradingOpen(config);

      // Get the trade offer
      const trade = await ctx.db.tradeOffer.findUnique({
        where: { id: input.tradeId },
        include: {
          initiator: true,
          recipient: true,
        },
      });

      if (!trade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade offer not found",
        });
      }

      // Verify user is the recipient
      if (trade.recipientId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not authorized to respond to this trade",
        });
      }

      // Check if trade is still valid
      if (trade.status !== TradeStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade is no longer pending",
        });
      }

      if (new Date() > trade.expiresAt) {
        // Auto-expire the trade (only if still PENDING) and release the initiator's cards
        await ctx.db.$transaction(async (tx: any) => {
          await tx.tradeOffer.updateMany({
            where: { id: input.tradeId, status: TradeStatus.PENDING },
            data: { status: TradeStatus.EXPIRED },
          });
          await unlockCardsTx(tx, trade.initiatorCardIds as string[], trade.initiatorId);
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade has expired",
        });
      }

      // Handle different actions
      if (input.action === "REJECT") {
        const result = await ctx.db.$transaction(async (tx: any) => {
          await claimPendingTradeTx(tx, input.tradeId, TradeStatus.REJECTED, new Date());
          await unlockCardsTx(tx, trade.initiatorCardIds as string[], trade.initiatorId);

          return await tx.tradeOffer.findUniqueOrThrow({ where: { id: input.tradeId } });
        });

        await clearVaultCaches(trade.initiator);

        return result;
      }

      if (input.action === "COUNTER") {
        // Create a counter-offer (new trade with roles reversed)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Use new values or fall back to original (swapped)
        const newInitiatorCardIds = (input.newInitiatorCardIds ??
          trade.recipientCardIds) as string[];
        const newRecipientCardIds = (input.newRecipientCardIds ??
          trade.initiatorCardIds) as string[];
        const newInitiatorCredits = input.newInitiatorCredits ?? trade.recipientCredits;
        const newRecipientCredits = input.newRecipientCredits ?? trade.initiatorCredits;

        // Verify ownership of cards in counter-offer
        const counterInitiatorCards = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: newInitiatorCardIds },
            ownerId: userId,
            isLocked: false,
          },
        });

        if (counterInitiatorCards.length !== newInitiatorCardIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cards in counter-offer",
          });
        }

        if (counterInitiatorCards.some((c) => c.inscription !== null)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Inscribed cards cannot be traded",
          });
        }

        const counterRecipientCards = await ctx.db.cardOwnership.findMany({
          where: {
            id: { in: newRecipientCardIds },
            ownerId: trade.initiatorId,
            isLocked: false,
          },
        });

        if (counterRecipientCards.length !== newRecipientCardIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cards in counter-offer",
          });
        }

        if (counterRecipientCards.some((c) => c.inscription !== null)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Inscribed cards cannot be traded",
          });
        }

        await assertNoBoundCopies(ctx.db, [...newInitiatorCardIds, ...newRecipientCardIds]);

        // Atomically unlock original offer's cards, lock counter-offer's cards, and create counter
        const result = await ctx.db.$transaction(async (tx: any) => {
          await claimPendingTradeTx(tx, input.tradeId, TradeStatus.REJECTED, new Date());
          await unlockCardsTx(tx, trade.initiatorCardIds as string[], trade.initiatorId);
          await lockCardsTx(tx, newInitiatorCardIds, userId);

          return await tx.tradeOffer.create({
            data: {
              initiatorId: userId,
              recipientId: trade.initiatorId,
              initiatorCardIds: newInitiatorCardIds,
              recipientCardIds: newRecipientCardIds,
              initiatorCredits: newInitiatorCredits,
              recipientCredits: newRecipientCredits,
              message: input.counterMessage,
              status: "PENDING",
              expiresAt,
              counterOfferFromId: input.tradeId,
            },
          });
        });

        await clearVaultCaches(trade.initiator, trade.recipient);

        return result;
      }

      // ACCEPT - Execute the trade atomically (every transition is a conditional write)
      const completedTrade = await ctx.db.$transaction(async (tx: any) => {
        // Cast Json card IDs to string arrays
        const initiatorCardIds = trade.initiatorCardIds as string[];
        const recipientCardIds = trade.recipientCardIds as string[];
        const now = new Date();

        await claimPendingTradeTx(tx, input.tradeId, TradeStatus.ACCEPTED, now);

        // Initiator cards were locked at offer time; recipient cards were not and must still be free
        await transferCardsTx(tx, {
          ids: initiatorCardIds,
          fromId: trade.initiatorId,
          toId: trade.recipientId,
          expectLocked: true,
          now,
        });
        await transferCardsTx(tx, {
          ids: recipientCardIds,
          fromId: trade.recipientId,
          toId: trade.initiatorId,
          expectLocked: false,
          now,
        });

        // Grant 25 XP per card traded to recipient and log transfer
        for (const ownershipId of initiatorCardIds) {
          await grantCardXp(
            tx,
            ownershipId,
            25,
            "TRADE",
            JSON.stringify({ tradeId: input.tradeId })
          );
        }
        await recordTradeTransfersTx(tx, {
          ids: initiatorCardIds,
          fromId: trade.initiatorId,
          toId: trade.recipientId,
        });

        // Grant 25 XP per card traded to initiator and log transfer
        for (const ownershipId of recipientCardIds) {
          await grantCardXp(
            tx,
            ownershipId,
            25,
            "TRADE",
            JSON.stringify({ tradeId: input.tradeId })
          );
        }
        await recordTradeTransfersTx(tx, {
          ids: recipientCardIds,
          fromId: trade.recipientId,
          toId: trade.initiatorId,
        });

        // Transfer credits (guarded debit + ledger rows for both sides; no-op when 0)
        await transferCreditsTx(tx, {
          fromUserId: trade.initiatorId,
          toUserId: trade.recipientId,
          amount: trade.initiatorCredits,
          tradeId: input.tradeId,
        });
        await transferCreditsTx(tx, {
          fromUserId: trade.recipientId,
          toUserId: trade.initiatorId,
          amount: trade.recipientCredits,
          tradeId: input.tradeId,
        });

        return await tx.tradeOffer.findUniqueOrThrow({ where: { id: input.tradeId } });
      });

      await clearVaultCaches(trade.initiator, trade.recipient);

      // Notify initiator that their trade was accepted
      try {
        await notificationAPI.create({
          title: "Trade Accepted",
          message: "Your trade offer has been accepted! Cards have been exchanged.",
          userId: trade.initiator.clerkUserId,
          category: "economic",
          priority: "high",
          type: "success",
          source: "trading",
          href: "/vault",
          metadata: { tradeId: input.tradeId },
        });
      } catch (e) {
        console.warn("[Notifications] trading.respondToTrade:", e);
      }

      return completedTrade;
    }),

  /**
   * Cancel a pending trade
   */
  cancelTrade: rateLimitedMutationProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const trade = await ctx.db.tradeOffer.findUnique({
        where: { id: input.tradeId },
      });

      if (!trade) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trade not found",
        });
      }

      // Only initiator can cancel
      if (trade.initiatorId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the trade initiator can cancel",
        });
      }

      if (trade.status !== TradeStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade is no longer pending",
        });
      }

      const result = await ctx.db.$transaction(async (tx: any) => {
        await claimPendingTradeTx(tx, input.tradeId, TradeStatus.CANCELLED, new Date());
        await unlockCardsTx(tx, trade.initiatorCardIds as string[], userId);

        return await tx.tradeOffer.findUniqueOrThrow({ where: { id: input.tradeId } });
      });

      await clearVaultCaches({ id: userId, clerkUserId: ctx.auth?.userId });

      return result;
    }),
});
