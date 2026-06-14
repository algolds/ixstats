/**
 * Lore Cards tRPC Router
 *
 * Handles user-requested lore card generation from wiki articles
 * - Users pay 50 IxC to request specific wiki articles become lore cards
 * - Admins review and approve/reject requests
 * - System generates approved cards using wiki-lore-card-generator
 *
 * Features:
 * - User request submission with IxCredits payment
 * - Admin approval queue and review
 * - Automatic card generation on approval
 * - Request history and status tracking
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { vaultService } from "~/lib/vault-service";

const LORE_CARD_REQUEST_COST = 50; // IxCredits

/**
 * Lore Cards Router
 */
export const loreCardsUserRouter = createTRPCRouter({
  /**
   * Get the current user's lore request tokens balance
   */
  getLoreTokensBalance: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) {
      return { balance: 0 };
    }
    const balance = await vaultService.getLoreTokensBalance(userId, ctx.db as any);
    return { balance };
  }),

  /**
   * Request a lore card for a specific wiki article
   * Costs 50 IxCredits or 1 Lore Request Token
   */
  requestLoreCard: protectedProcedure
    .input(
      z.object({
        articleTitle: z.string().min(1).max(200),
        wikiSource: z.enum(["ixwiki", "iiwiki"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.user?.id;
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "You must be logged in to request lore cards",
          });
        }

        // Get user's vault to check balance
        const vault = await ctx.db.myVault.findUnique({
          where: { userId },
        });

        if (!vault) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vault not found. Please initialize your vault first.",
          });
        }

        // Check token balance first
        const tokens = await vaultService.getLoreTokensBalance(userId, ctx.db as any);
        const useToken = tokens > 0;

        if (!useToken && vault.credits < LORE_CARD_REQUEST_COST) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient IxCredits. You need ${LORE_CARD_REQUEST_COST} IxC to request a lore card (current balance: ${vault.credits} IxC)`,
          });
        }

        // Check if article already has a card
        const existingCard = await ctx.db.card.findFirst({
          where: {
            wikiArticleTitle: input.articleTitle,
            wikiSource: input.wikiSource,
            cardType: "LORE",
          },
        });

        if (existingCard) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A lore card already exists for this article",
          });
        }

        // Check if there's already a pending request for this article
        const existingRequest = await ctx.db.loreCardRequest.findFirst({
          where: {
            articleTitle: input.articleTitle,
            wikiSource: input.wikiSource,
            status: {
              in: ["PENDING", "APPROVED"],
            },
          },
        });

        if (existingRequest) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `A request for this article is already ${existingRequest.status.toLowerCase()}`,
          });
        }

        // Deduct IxCredits and log transaction if not using token
        if (!useToken) {
          await ctx.db.$transaction(async (tx) => {
            const freshVault = await tx.myVault.findUnique({
              where: { userId },
            });

            if (!freshVault) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Vault not found. Please initialize your vault first.",
              });
            }

            if (freshVault.credits < LORE_CARD_REQUEST_COST) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Insufficient IxCredits. You need ${LORE_CARD_REQUEST_COST} IxC to request a lore card (current balance: ${freshVault.credits} IxC)`,
              });
            }

            const updated = await tx.myVault.update({
              where: { userId },
              data: {
                credits: {
                  decrement: LORE_CARD_REQUEST_COST,
                },
              },
            });

            // Log transaction inside transaction callback
            await tx.vaultTransaction.create({
              data: {
                vaultId: freshVault.id,
                credits: -LORE_CARD_REQUEST_COST,
                balanceAfter: updated.credits,
                type: "EXPENSE",
                source: "LORE_CARD_REQUEST",
                metadata: {
                  articleTitle: input.articleTitle,
                  wikiSource: input.wikiSource,
                  useToken: false,
                },
              },
            });
          });
        } else {
          // Log transaction for token use
          await ctx.db.vaultTransaction.create({
            data: {
              vaultId: vault.id,
              credits: 0,
              balanceAfter: vault.credits,
              type: "EXPENSE",
              source: "LORE_CARD_REQUEST",
              metadata: {
                articleTitle: input.articleTitle,
                wikiSource: input.wikiSource,
                useToken: true,
              },
            },
          });
        }

        // Create request
        const request = await ctx.db.loreCardRequest.create({
          data: {
            userId,
            wikiSource: input.wikiSource,
            articleTitle: input.articleTitle,
            status: "PENDING",
          },
        });

        console.log(
          `[Lore Cards] User ${userId} requested lore card for "${input.articleTitle}" (${input.wikiSource}) using ${useToken ? "token" : "credits"}`
        );

        return {
          success: true,
          requestId: request.id,
          cost: useToken ? 0 : LORE_CARD_REQUEST_COST,
          useToken,
          message: useToken
            ? "Lore card request submitted for admin review (Free with Token)"
            : "Lore card request submitted for admin review",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in requestLoreCard:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit lore card request",
        });
      }
    }),

  /**
   * Get user's lore card request history
   */
  getMyRequests: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).optional().default(20),
          offset: z.number().int().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.user?.id;
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "You must be logged in to view your requests",
          });
        }

        const requests = await ctx.db.loreCardRequest.findMany({
          where: { userId },
          orderBy: { requestedAt: "desc" },
          take: input?.limit ?? 20,
          skip: input?.offset ?? 0,
        });

        const total = await ctx.db.loreCardRequest.count({
          where: { userId },
        });

        return {
          requests,
          total,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in getMyRequests:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch your lore card requests",
        });
      }
    }),
});
