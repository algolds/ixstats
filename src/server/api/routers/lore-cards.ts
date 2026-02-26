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
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { wikiLoreCardGenerator } from "~/lib/wiki-lore-card-generator";
import type { WikiSource } from "~/lib/mediawiki-config";

const LORE_CARD_REQUEST_COST = 50; // IxCredits

/**
 * Lore Cards Router
 */
export const loreCardsRouter = createTRPCRouter({
  /**
   * Request a lore card for a specific wiki article
   * Costs 50 IxCredits
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

        if (vault.credits < LORE_CARD_REQUEST_COST) {
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

        // Deduct IxCredits
        await ctx.db.myVault.update({
          where: { userId },
          data: {
            credits: {
              decrement: LORE_CARD_REQUEST_COST,
            },
          },
        });

        // Log transaction
        await ctx.db.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            credits: -LORE_CARD_REQUEST_COST,
            balanceAfter: vault.credits - LORE_CARD_REQUEST_COST,
            type: "EXPENSE",
            source: "LORE_CARD_REQUEST",
            metadata: {
              articleTitle: input.articleTitle,
              wikiSource: input.wikiSource,
            },
          },
        });

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
          `[Lore Cards] User ${userId} requested lore card for "${input.articleTitle}" (${input.wikiSource})`
        );

        return {
          success: true,
          requestId: request.id,
          cost: LORE_CARD_REQUEST_COST,
          message: "Lore card request submitted for admin review",
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

  /**
   * Get pending lore card request queue (admin only)
   */
  getRequestQueue: adminProcedure
    .input(
      z
        .object({
          status: z
            .enum(["PENDING", "APPROVED", "REJECTED", "GENERATED"])
            .optional(),
          limit: z.number().int().min(1).max(100).optional().default(50),
          offset: z.number().int().min(0).optional().default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const where = input?.status ? { status: input.status } : {};

        const requests = await ctx.db.loreCardRequest.findMany({
          where,
          orderBy: { requestedAt: "desc" },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0,
        });

        const total = await ctx.db.loreCardRequest.count({
          where,
        });

        return {
          requests,
          total,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in getRequestQueue:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch lore card request queue",
        });
      }
    }),

  /**
   * Approve a lore card request (admin only)
   */
  approveRequest: adminProcedure
    .input(
      z.object({
        requestId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const adminUserId = ctx.user?.id;
        if (!adminUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
        }

        const request = await ctx.db.loreCardRequest.findUnique({
          where: { id: input.requestId },
        });

        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        if (request.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Request is already ${request.status.toLowerCase()}`,
          });
        }

        // Update request status
        await ctx.db.loreCardRequest.update({
          where: { id: input.requestId },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedBy: adminUserId,
          },
        });

        console.log(
          `[Lore Cards] Admin ${adminUserId} approved request ${input.requestId}`
        );

        return {
          success: true,
          message: "Request approved. Generating lore card...",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in approveRequest:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to approve request",
        });
      }
    }),

  /**
   * Reject a lore card request (admin only)
   */
  rejectRequest: adminProcedure
    .input(
      z.object({
        requestId: z.string().cuid(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const adminUserId = ctx.user?.id;
        if (!adminUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
        }

        const request = await ctx.db.loreCardRequest.findUnique({
          where: { id: input.requestId },
        });

        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        if (request.status !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Request is already ${request.status.toLowerCase()}`,
          });
        }

        // Update request status
        await ctx.db.loreCardRequest.update({
          where: { id: input.requestId },
          data: {
            status: "REJECTED",
            reviewedAt: new Date(),
            reviewedBy: adminUserId,
            rejectionReason: input.reason,
          },
        });

        // Refund IxCredits to user
        await ctx.db.myVault.update({
          where: { userId: request.userId },
          data: {
            credits: {
              increment: LORE_CARD_REQUEST_COST,
            },
          },
        });

        // Log refund transaction
        const vault = await ctx.db.myVault.findUnique({
          where: { userId: request.userId },
        });

        if (vault) {
          await ctx.db.vaultTransaction.create({
            data: {
              vaultId: vault.id,
              credits: LORE_CARD_REQUEST_COST,
              balanceAfter: vault.credits,
              type: "INCOME",
              source: "REFUND",
              metadata: {
                articleTitle: request.articleTitle,
                reason: "Lore card request rejected",
              },
            },
          });
        }

        console.log(
          `[Lore Cards] Admin ${adminUserId} rejected request ${input.requestId}. User refunded ${LORE_CARD_REQUEST_COST} IxC`
        );

        return {
          success: true,
          message: "Request rejected and user refunded",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in rejectRequest:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reject request",
        });
      }
    }),

  /**
   * Generate lore card from approved request (admin only)
   */
  generateRequestedCard: adminProcedure
    .input(
      z.object({
        requestId: z.string().cuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const adminUserId = ctx.user?.id;
        if (!adminUserId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Admin authentication required",
          });
        }

        const request = await ctx.db.loreCardRequest.findUnique({
          where: { id: input.requestId },
        });

        if (!request) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Request not found",
          });
        }

        if (request.status !== "APPROVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Request must be approved before generating card",
          });
        }

        // Generate lore card (require image for production cards)
        const candidate = await wikiLoreCardGenerator.generateCard(
          request.articleTitle,
          request.wikiSource as WikiSource,
          { requireImage: true }
        );

        if (!candidate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Failed to generate card. Article may not exist or quality may be too low.",
          });
        }

        // Create card in database
        const cardId = await wikiLoreCardGenerator.createCard(candidate);

        // Update request status
        await ctx.db.loreCardRequest.update({
          where: { id: input.requestId },
          data: {
            status: "GENERATED",
            cardId,
            generatedAt: new Date(),
          },
        });

        console.log(
          `[Lore Cards] Admin ${adminUserId} generated card ${cardId} from request ${input.requestId}`
        );

        return {
          success: true,
          cardId,
          card: candidate,
          message: "Lore card generated successfully",
        };
      } catch (error) {
        console.error("[Lore Cards] Error in generateRequestedCard:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate lore card",
        });
      }
    }),

  /**
   * Get statistics about lore card requests (admin only)
   */
  getRequestStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const [total, pending, approved, rejected, generated] =
        await Promise.all([
          ctx.db.loreCardRequest.count(),
          ctx.db.loreCardRequest.count({ where: { status: "PENDING" } }),
          ctx.db.loreCardRequest.count({ where: { status: "APPROVED" } }),
          ctx.db.loreCardRequest.count({ where: { status: "REJECTED" } }),
          ctx.db.loreCardRequest.count({ where: { status: "GENERATED" } }),
        ]);

      return {
        total,
        pending,
        approved,
        rejected,
        generated,
      };
    } catch (error) {
      console.error("[Lore Cards] Error in getRequestStats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch lore card request statistics",
      });
    }
  }),

  /**
   * Get all lore cards for public gallery (public endpoint)
   */
  getAllLoreCards: rateLimitedPublicProcedure
    .input(
      z.object({
        wikiSource: z.enum(["ixwiki", "iiwiki", "all"]).optional().default("all"),
        rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY", "all"]).optional().default("all"),
        category: z.string().optional(),
        season: z.number().int().min(1).optional(),
        search: z.string().min(1).max(200).optional(),
        sortBy: z.enum(["rarity", "season", "dateAdded", "marketValue", "title"]).optional().default("dateAdded"),
        limit: z.number().int().min(1).max(100).optional().default(20),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Build where clause
        const where: any = {
          cardType: "LORE",
        };

        // Wiki source filter
        if (input.wikiSource !== "all") {
          where.wikiSource = input.wikiSource;
        }

        // Rarity filter
        if (input.rarity !== "all") {
          where.rarity = input.rarity;
        }

        // Season filter
        if (input.season) {
          where.season = input.season;
        }

        // Category filter (stored in metadata)
        if (input.category) {
          where.metadata = {
            path: ["category"],
            equals: input.category,
          };
        }

        // Search filter
        if (input.search) {
          where.OR = [
            { title: { contains: input.search, mode: "insensitive" } },
            { wikiArticleTitle: { contains: input.search, mode: "insensitive" } },
          ];
        }

        // Build orderBy
        let orderBy: any = { createdAt: "desc" }; // dateAdded
        if (input.sortBy === "rarity") {
          orderBy = { rarity: "desc" };
        } else if (input.sortBy === "season") {
          orderBy = { season: "desc" };
        } else if (input.sortBy === "marketValue") {
          orderBy = { marketValue: "desc" };
        } else if (input.sortBy === "title") {
          orderBy = { title: "asc" };
        }

        // Fetch cards
        const [cards, total] = await Promise.all([
          ctx.db.card.findMany({
            where,
            orderBy,
            take: input.limit,
            skip: input.offset,
            select: {
              id: true,
              title: true,
              description: true,
              artwork: true,
              artworkVariants: true,
              rarity: true,
              season: true,
              cardType: true,
              wikiSource: true,
              wikiArticleTitle: true,
              stats: true,
              marketValue: true,
              totalSupply: true,
              level: true,
              metadata: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          ctx.db.card.count({ where }),
        ]);

        return {
          cards,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[Lore Cards] Error in getAllLoreCards:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch lore cards",
        });
      }
    }),
});
