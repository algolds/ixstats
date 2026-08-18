/**
 * P2P Trading Router
 *
 * Provides endpoints for peer-to-peer card trading:
 * - Create trade offers
 * - Accept/decline/counter trades
 * - View active trades
 * - View trade history
 * - Cancel pending trades
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { getVaultConfig } from "~/lib/vault";
import { grantCardXp } from "~/lib/card-xp-utils";

/**
 * Trade offer creation schema
 */
const _createtradeOfferSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  initiatorCardIds: z.array(z.string()).min(1, "At least one card must be offered"),
  recipientCardIds: z.array(z.string()).min(1, "At least one card must be requested"),
  initiatorCredits: z.number().int().min(0).default(0),
  recipientCredits: z.number().int().min(0).default(0),
  message: z.string().max(500).optional(),
});

/**
 * Trade response schema
 */
const _respondToTradeSchema = z.object({
  tradeId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "COUNTER"]),
  // For counter offers
  newInitiatorCardIds: z.array(z.string()).optional(),
  newRecipientCardIds: z.array(z.string()).optional(),
  newInitiatorCredits: z.number().int().min(0).optional(),
  newRecipientCredits: z.number().int().min(0).optional(),
  counterMessage: z.string().max(500).optional(),
});

type _CreateTradeOfferInput = z.infer<typeof _createtradeOfferSchema>;
type _RespondToTradeInput = z.infer<typeof _respondToTradeSchema>;

export const tradingSocialRouter = createTRPCRouter({
  /**
   * Gift a card to another player
   */
  giftCard: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().min(1, "Recipient ID is required"),
        cardId: z.string().min(1, "Card ID is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const initiatorDbId = ctx.user.id;

      const config = await getVaultConfig(ctx.db);
      if (config.isMaintenanceMode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vault economy is currently in maintenance mode.",
        });
      }
      if (!config.isTradingEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gifting/trading is currently disabled globally.",
        });
      }

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

      if (recipientDbId === initiatorDbId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot gift a card to yourself",
        });
      }

      // Verify initiator owns the card and it is not locked/inscribed
      const ownership = (await ctx.db.cardOwnership.findFirst({
        where: {
          id: input.cardId,
          ownerId: initiatorDbId,
          isLocked: false,
        },
      })) as any;

      if (!ownership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You do not own this card or it is locked",
        });
      }

      if (ownership.inscription !== null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inscribed cards cannot be gifted",
        });
      }

      const now = new Date();

      // Execute 1-way trade (gift) atomically
      const trade = await ctx.db.$transaction(async (tx: any) => {
        // Create accepted trade offer record for logging
        const tradeOffer = await tx.tradeOffer.create({
          data: {
            initiatorId: initiatorDbId,
            recipientId: recipientDbId,
            initiatorCardIds: [ownership.id],
            recipientCardIds: [],
            initiatorCredits: 0,
            recipientCredits: 0,
            status: "ACCEPTED",
            respondedAt: now,
            expiresAt: now,
            message: "Gift",
          },
        });

        // Transfer card ownership
        await tx.cardOwnership.update({
          where: { id: ownership.id },
          data: {
            ownerId: recipientDbId,
            userId: recipientDbId,
            isLocked: false,
            acquiredAt: now,
            lastSaleDate: now,
          },
        });

        // Log provenance event
        await tx.cardTransferEvent.create({
          data: {
            ownershipId: ownership.id,
            fromUserId: initiatorDbId,
            toUserId: recipientDbId,
            action: "GIFT",
          },
        });

        // Grant 25 XP
        await grantCardXp(tx, ownership.id, 25, "GIFT", JSON.stringify({ tradeId: tradeOffer.id }));

        return tradeOffer;
      });

      // Notify the recipient
      try {
        const sender = await ctx.db.user.findUnique({
          where: { id: initiatorDbId },
          include: { country: true },
        });
        const senderName = sender?.country?.name ?? "A player";
        await notificationAPI.create({
          title: "Card Gift Received",
          message: `${senderName} gifted you a card!`,
          userId: input.recipientId,
          category: "economic",
          priority: "high",
          type: "success",
          source: "trading",
          href: "/vault",
        });
      } catch (e) {
        console.warn("[Notifications] giftCard:", e);
      }

      return trade;
    }),

  /**
   * Search potential trading partners by country name or username
   */
  searchTradingPartners: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      if (query.length < 2) return [];

      const currentUserId = ctx.user.id;

      const users = await ctx.db.user.findMany({
        where: {
          id: { not: currentUserId },
          isActive: true,
          OR: [
            {
              country: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { leader: { contains: query, mode: "insensitive" } },
                ],
              },
            },
            {
              forumUsername: { contains: query, mode: "insensitive" },
            },
            {
              wikiUsername: { contains: query, mode: "insensitive" },
            },
            {
              discordUsername: { contains: query, mode: "insensitive" },
            },
          ],
        },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              leader: true,
              economicTier: true,
              flag: true,
            },
          },
        },
        take: 15,
      });

      return users.map((user) => ({
        id: user.clerkUserId,
        dbId: user.id,
        countryName: user.country?.name || "Unknown Country",
        leader: user.country?.leader || "Unknown Leader",
        economicTier: user.country?.economicTier || "Unknown",
        username:
          user.forumUsername || user.wikiUsername || user.discordUsername || "Unnamed Player",
        flag: user.country?.flag || null,
      }));
    }),
});
