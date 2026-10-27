/**
 * The trade procedures (spec §2.3 Trade builder): offer a table, counter it on the same row, accept or reject it, or
 * withdraw it. The trade service holds the rules; these bound the input, name players for its notices by the identity
 * rule, and clear the vault caches the trade changed.
 */
import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { MAX_TRADE_CARDS_PER_SIDE, MAX_TRADE_CREDITS } from "~/lib/cards/trade/trade-table";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";
import {
  acceptTradeOffer,
  cancelTradeOffer,
  counterTradeOffer,
  createTradeOffer,
  rejectTradeOffer,
  type NameOf,
  type Party,
} from "~/server/modules/cards/trading/trade-service";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";

const side = z.array(z.string().min(1)).max(MAX_TRADE_CARDS_PER_SIDE).default([]);
const credits = z.number().int().min(0).max(MAX_TRADE_CREDITS).default(0);
const table = z.object({
  initiatorCardIds: side,
  recipientCardIds: side,
  initiatorCredits: credits,
  recipientCredits: credits,
});
const message = z.string().trim().max(500).optional();
const revision = z.number().int().min(0);

/** A trade is direct, so its notices name the sender by the identity rule (the vaultCards switch does not hide them). */
const nameOf: NameOf = async (userId) =>
  (await loadPlayerNames([userId])).get(userId)?.displayName ?? null;

const partyOf = (user: { id: string; clerkUserId: string }): Party => ({
  id: user.id,
  clerkUserId: user.clerkUserId,
});

export const tradingOffersRouter = createTRPCRouter({
  createtradeOffer: rateLimitedMutationProcedure
    .input(table.extend({ partnerId: z.string().min(1), message }))
    .mutation(async ({ ctx, input }) => {
      const { partnerId, message: note, ...tableInput } = input;
      const trade = await createTradeOffer(ctx.db, {
        initiator: partyOf(ctx.user),
        partnerId,
        table: tableInput,
        message: note,
        now: new Date(),
        nameOf,
      });
      await clearVaultCachesFor(ctx.db, [trade.initiatorId]);
      return trade;
    }),

  counterTrade: rateLimitedMutationProcedure
    .input(table.extend({ tradeId: z.string().min(1), revision, message }))
    .mutation(async ({ ctx, input }) => {
      const { tradeId, revision: seen, message: note, ...tableInput } = input;
      const trade = await counterTradeOffer(ctx.db, {
        user: partyOf(ctx.user),
        tradeId,
        revision: seen,
        table: tableInput,
        message: note,
        now: new Date(),
        nameOf,
      });
      await clearVaultCachesFor(ctx.db, [trade.initiatorId, trade.recipientId]);
      return trade;
    }),

  respondToTrade: rateLimitedMutationProcedure
    .input(z.object({ tradeId: z.string().min(1), action: z.enum(["ACCEPT", "REJECT"]), revision }))
    .mutation(async ({ ctx, input }) => {
      const user = partyOf(ctx.user);
      const now = new Date();
      if (input.action === "REJECT") {
        const trade = await rejectTradeOffer(ctx.db, { user, tradeId: input.tradeId, now });
        await clearVaultCachesFor(ctx.db, [trade.initiatorId, trade.recipientId]);
        return trade;
      }
      const { trade, royaltyRecipientIds } = await acceptTradeOffer(ctx.db, {
        user,
        tradeId: input.tradeId,
        revision: input.revision,
        now,
        nameOf,
      });
      // Both parties' credits and copies moved, and any nation owner was paid
      await clearVaultCachesFor(ctx.db, [
        trade.initiatorId,
        trade.recipientId,
        ...royaltyRecipientIds,
      ]);
      return trade;
    }),

  cancelTrade: rateLimitedMutationProcedure
    .input(z.object({ tradeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const trade = await cancelTradeOffer(ctx.db, {
        user: partyOf(ctx.user),
        tradeId: input.tradeId,
        now: new Date(),
      });
      await clearVaultCachesFor(ctx.db, [trade.initiatorId, trade.recipientId]);
      return trade;
    }),
});
