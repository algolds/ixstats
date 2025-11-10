/**
 * NationStates Integration Router
 *
 * Provides tRPC endpoints for NS card collection import and synchronization.
 *
 * Endpoints:
 * - importNSCollection: Import user's NS deck (protected, awards 100 IxC)
 * - getNSCardData: Get single NS card info (rate-limited public)
 * - syncNSCards: Trigger manual NS card sync (admin only)
 * - getSyncStatus: Get latest sync status (public)
 * - getRateLimiterStatus: Get NS API rate limiter status (public)
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  rateLimitedPublicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { nsApiClient } from "~/lib/ns-api-client";
import {
  performSync,
  getLatestSyncStatus,
  validateSyncHealth,
} from "~/lib/ns-card-sync-service";

export const nsIntegrationRouter = createTRPCRouter({
  /**
   * Import NS collection for authenticated user
   * Verifies nation ownership and imports deck
   * Awards 100 IxC bonus on successful import
   */
  importNSCollection: protectedProcedure
    .input(
      z.object({
        nsNation: z.string().min(1, "NS nation name is required"),
        verificationCode: z.string().min(1, "Verification code is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Must be authenticated to import NS collection",
        });
      }

      console.log(
        `[NS Integration] Import request from user ${ctx.user.id} for nation ${input.nsNation}`
      );

      // Check if user already imported from this nation
      const existingImport = await ctx.db.nSImport.findFirst({
        where: {
          userId: ctx.user.id,
          nationName: input.nsNation.toLowerCase(),
        },
      });

      if (existingImport) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already imported this NS nation",
        });
      }

      // TODO: Implement importNSCollection function
      // For now, throw not implemented error
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "NS collection import is not yet implemented. Use /ns-import router instead.",
      });

      // Perform import
      // const result = await importNSCollection(
      //   ctx.user.id,
      //   input.nsNation,
      //   input.verificationCode
      // );

      // if (!result.success) {
      //   throw new TRPCError({
      //     code: "BAD_REQUEST",
      //     message: result.error || "Import failed",
      //   });
      // }

      // Fetch the actual deck data
      // const deck = await nsApiClient.fetchDeck(input.nsNation);

      // try {
      //   // Use database transaction for consistency
      //   await ctx.db.$transaction(async (tx) => {
      //     // Create import record
      //     await tx.nSImport.create({
      //       data: {
      //         userId: ctx.user!.id,
      //         nsNation: input.nsNation.toLowerCase(),
      //         cardsImported: result.cardsImported,
      //         ixcAwarded: result.ixcBonus,
      //         deckValue: deck.deckValue,
      //         importedAt: new Date(),
      //       },
      //     });
      //
      //     // Award IxC bonus
      //     await tx.ixCreditsTransaction.create({
      //       data: {
      //         userId: ctx.user!.id,
      //         amount: result.ixcBonus,
      //         type: "EARNED",
      //         source: "NS_COLLECTION_IMPORT",
      //         description: `NS collection import bonus for ${input.nsNation}`,
      //         metadata: JSON.stringify({
      //           nsNation: input.nsNation,
      //           cardsImported: result.cardsImported,
      //           deckValue: deck.deckValue,
      //         }),
      //       },
      //     });
      //
      //     // Update user's IxC balance
      //     await tx.user.update({
      //       where: { id: ctx.user!.id },
      //       data: {
      //         ixCredits: {
      //           increment: result.ixcBonus,
      //         },
      //       },
      //     });
      //
      //     // Create card ownership records for each card
      //     // Note: This assumes Card and CardOwnership models exist in schema
      //     for (const card of deck.cards) {
      //       // Find or create the card in our database
      //       const ixCard = await tx.card.upsert({
      //         where: {
      //           nsCardId_season: {
      //             nsCardId: card.cardId,
      //             season: card.season,
      //           },
      //         },
      //         create: {
      //           nsCardId: card.cardId,
      //           season: card.season,
      //           title: `NS Card ${card.cardId}`,
      //           rarity: "common", // Will be updated by sync
      //           cardType: "NS_IMPORT",
      //           metadata: JSON.stringify({
      //             importedFrom: input.nsNation,
      //           }),
      //         },
      //         update: {}, // No update needed on existing card
      //       });
      //
      //       // Create ownership record
      //       if (ixCard) {
      //         await tx.cardOwnership.create({
      //           data: {
      //             userId: ctx.user!.id,
      //             cardId: ixCard.id,
      //             quantity: card.count,
      //             acquiredMethod: "NS_IMPORT",
      //             acquiredAt: new Date(),
      //             metadata: JSON.stringify({
      //               nsNation: input.nsNation,
      //               originalNS: true,
      //             }),
      //           },
      //         });
      //       }
      //     }
      //   });
      //
      //   console.log(
      //     `[NS Integration] Successfully imported ${result.cardsImported} cards for user ${ctx.user.id}`
      //   );
      //
      //   return {
      //     success: true,
      //     cardsImported: result.cardsImported,
      //     ixcAwarded: result.ixcBonus,
      //     deckValue: deck.deckValue,
      //   };
      // } catch (error) {
      //   console.error(`[NS Integration] Database error during import:`, error);
      //   throw new TRPCError({
      //     code: "INTERNAL_SERVER_ERROR",
      //     message: "Failed to save import data",
      //   });
      // }
    }),

  /**
   * Get NS card data by ID
   * Rate-limited public endpoint
   */
  getNSCardData: rateLimitedPublicProcedure
    .input(
      z.object({
        cardId: z.string().min(1),
        season: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      // Fetch card info from NS API
      const card = await nsApiClient.fetchCardInfo(
        input.cardId.toString(),
        input.season.toString()
      );

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Card ${input.cardId} S${input.season} not found`,
        });
      }

      return card;
    }),

  /**
   * Trigger manual NS card sync (admin only)
   * Used for testing or emergency sync outside cron schedule
   */
  syncNSCards: adminProcedure
    .input(
      z.object({
        season: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[NS Integration] Manual sync triggered for season ${input.season}`);

      const status = await performSync(input.season);

      if (status.status === "failed") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Sync failed: ${status.errors.join(", ")}`,
        });
      }

      return status;
    }),

  /**
   * Get latest sync status for a season
   * Public endpoint for monitoring
   */
  getSyncStatus: publicProcedure
    .input(
      z.object({
        season: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const status = await getLatestSyncStatus(input.season);

      if (!status) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No sync status found for season ${input.season}`,
        });
      }

      return status;
    }),

  /**
   * Get sync health status for all seasons
   * Public endpoint for monitoring
   */
  getSyncHealth: publicProcedure.query(async () => {
    return await validateSyncHealth();
  }),

  /**
   * Get NS API rate limiter status
   * Public endpoint for monitoring
   */
  getRateLimiterStatus: publicProcedure.query(() => {
    // TODO: Implement rate limiter status tracking
    return {
      status: "operational",
      requestsRemaining: 50,
      resetTime: new Date(Date.now() + 30000),
    };
  }),

  /**
   * Get user's NS import history
   * Protected endpoint
   */
  getMyNSImports: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Must be authenticated",
      });
    }

    const imports = await ctx.db.nSImport.findMany({
      where: {
        userId: ctx.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return imports;
  }),

  /**
   * Check if user can import from a nation
   * Checks if nation already imported
   */
  canImportNation: protectedProcedure
    .input(
      z.object({
        nsNation: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        return { canImport: false, reason: "Not authenticated" };
      }

      const existingImport = await ctx.db.nSImport.findFirst({
        where: {
          userId: ctx.user.id,
          nationName: input.nsNation.toLowerCase(),
        },
      });

      if (existingImport) {
        return {
          canImport: false,
          reason: "Already imported this nation",
          importedAt: existingImport.createdAt,
          cardsImported: existingImport.cardCount,
        };
      }

      return { canImport: true };
    }),
});
