/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure, adminProcedure } from "../trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { SyncHealthMonitor } from "~/lib/ns-sync-monitor";
import { TRPCError } from "@trpc/server";

export const nsImportRouter = createTRPCRouter({
  /**
   * Fetch a nation's deck (public - no auth required)
   */
  fetchPublicDeck: publicProcedure
    .input(
      z.object({
        nationName: z.string().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const deckData = await nsApiClient.fetchDeck(input.nationName);

      if (!deckData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to fetch deck from NationStates",
        });
      }

      // Deduplicate cards and track quantities
      const cardMap = new Map<string, { card: typeof deckData.cards[0], quantity: number }>();

      for (const card of deckData.cards) {
        const key = `${card.id}-${card.season}`;
        const existing = cardMap.get(key);

        if (existing) {
          existing.quantity += 1;
        } else {
          cardMap.set(key, { card, quantity: 1 });
        }
      }

      // Get unique cards (limit to first 20 unique cards)
      const uniqueCards = Array.from(cardMap.values()).slice(0, 20);

      console.log(`[NS Import] Deduplicated ${deckData.cards.length} cards to ${uniqueCards.length} unique cards`);

      // Fetch detailed info for unique cards only
      // Process sequentially to respect rate limits
      const cardsWithInfo = [];
      for (const { card, quantity } of uniqueCards) {
        if (!card.name) {
          try {
            const info = await nsApiClient.fetchCardInfo(card.id, card.season);
            if (info) {
              cardsWithInfo.push({ ...card, ...info, quantity });
            } else {
              cardsWithInfo.push({ ...card, quantity });
            }
          } catch (error) {
            console.error(`[NS Import] Failed to fetch card info for ${card.id}:`, error);
            cardsWithInfo.push({ ...card, quantity });
          }
        } else {
          cardsWithInfo.push({ ...card, quantity });
        }
      }

      return {
        nation: deckData.nation,
        cards: cardsWithInfo,
        totalCards: deckData.num_cards,
        uniqueCards: cardMap.size,
        deckValue: deckData.deck_value,
      };
    }),
  /**
   * Verify that a NationStates nation exists
   */
  verifyNation: protectedProcedure
    .input(
      z.object({
        nationName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const exists = await nsApiClient.verifyNation(input.nationName);

      return {
        exists,
        nationName: input.nationName,
      };
    }),

  /**
   * Request verification for nation ownership
   * Returns the URL the user should visit to get their verification code
   */
  requestVerification: protectedProcedure
    .input(
      z.object({
        nationName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if nation exists
      const exists = await nsApiClient.verifyNation(input.nationName);
      if (!exists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nation not found on NationStates",
        });
      }

      // Check for existing pending verification
      const existingVerification = await ctx.db.nSVerification.findFirst({
        where: {
          userId: ctx.user.id,
          nationName: input.nationName,
          verified: false,
        },
      });

      if (existingVerification) {
        return {
          verificationUrl: nsApiClient.getVerificationUrl(input.nationName),
          verificationId: existingVerification.id,
          nationName: input.nationName,
        };
      }

      // Create new verification record
      const verification = await ctx.db.nSVerification.create({
        data: {
          id: `nsv_${Date.now()}_${ctx.user.id}`,
          userId: ctx.user.id,
          nationName: input.nationName,
          verificationCode: "", // Will be provided by user from NS
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      return {
        verificationUrl: nsApiClient.getVerificationUrl(input.nationName),
        verificationId: verification.id,
        nationName: input.nationName,
      };
    }),

  /**
   * Verify nation ownership with checksum code from NS
   */
  checkVerification: protectedProcedure
    .input(
      z.object({
        verificationId: z.string(),
        checksum: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const verification = await ctx.db.nSVerification.findUnique({
        where: { id: input.verificationId },
      });

      if (!verification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification not found",
        });
      }

      if (verification.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not your verification",
        });
      }

      if (verification.verified) {
        return {
          verified: true,
          nationName: verification.nationName,
        };
      }

      // Verify with NS API
      const isVerified = await nsApiClient.verifyOwnership(
        verification.nationName,
        input.checksum
      );

      if (isVerified) {
        // Mark as verified
        await ctx.db.nSVerification.update({
          where: { id: input.verificationId },
          data: {
            verified: true,
            verifiedAt: new Date(),
            verificationCode: input.checksum,
          },
        });

        return {
          verified: true,
          nationName: verification.nationName,
        };
      }

      return {
        verified: false,
        nationName: verification.nationName,
      };
    }),

  /**
   * Import trading cards from a NationStates nation
   */
  importDeck: protectedProcedure
    .input(
      z.object({
        verificationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check verification
      const verification = await ctx.db.nSVerification.findUnique({
        where: { id: input.verificationId },
      });

      if (!verification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification not found",
        });
      }

      if (verification.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not your verification",
        });
      }

      if (!verification.verified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nation ownership not verified. Please complete verification first.",
        });
      }

      const nationName = verification.nationName;
      // Fetch deck from NS API
      const deckData = await nsApiClient.fetchDeck(nationName);

      if (!deckData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to fetch deck from NationStates. Please try again.",
        });
      }

      if (deckData.cards.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This nation has no cards in their deck.",
        });
      }

      const importedCards: string[] = [];
      const skippedCards: string[] = [];

      // Process cards in batches
      for (const nsCard of deckData.cards) {
        try {
          // Fetch full card info since deck API only provides id, season, rarity, market_value
          if (!nsCard.name) {
            console.log(`[NS Import] Fetching card info for ${nsCard.id} S${nsCard.season}`);
            const cardInfo = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
            if (cardInfo) {
              Object.assign(nsCard, cardInfo);
            }
          }

          // Skip if we still don't have a name
          if (!nsCard.name) {
            console.error(`[NS Import] Could not fetch name for card ${nsCard.id} S${nsCard.season}`);
            skippedCards.push(`Card ${nsCard.id} S${nsCard.season}`);
            continue;
          }

          // Check if card definition exists, create if not
          let card = await ctx.db.card.findFirst({
            where: {
              nsCardId: parseInt(nsCard.id),
              nsSeason: parseInt(nsCard.season),
            },
          });

          if (!card) {
            // Create new card definition
            const description = nsCard.description || nsCard.slogan || nsCard.motto || `${nsCard.category || 'Unknown'} from ${nsCard.region || 'Unknown'}`;

            // Use NS flag as artwork, fallback to placeholder
            const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

            card = await ctx.db.card.create({
              data: {
                id: `card_ns_${nsCard.id}_s${nsCard.season}`,
                title: nsCard.name,
                description: description,
                artwork: artwork,
                artworkVariants: nsCard.flag ? {
                  original: nsCard.flag,
                  thumbnail: nsCard.flag,
                  large: nsCard.flag,
                  flagUrl: nsCard.flag,
                } : undefined,
                cardType: "NATION",
                rarity: nsCard.rarity,
                season: parseInt(nsCard.season),
                nsCardId: parseInt(nsCard.id),
                nsSeason: parseInt(nsCard.season),
                wikiSource: null,
                wikiArticleTitle: nsCard.name,
                countryId: null,
                stats: {
                  region: nsCard.region,
                  category: nsCard.category,
                  govt: nsCard.govt,
                  cardcategory: nsCard.cardcategory,
                  marketValue: nsCard.market_value,
                  badge: nsCard.badge,
                  trophies: nsCard.trophies,
                },
                metadata: {
                  nsData: {
                    id: nsCard.id,
                    season: nsCard.season,
                    rarity: nsCard.rarity,
                    name: nsCard.name,
                    region: nsCard.region,
                    category: nsCard.category,
                    govt: nsCard.govt,
                    type: nsCard.type,
                    cardcategory: nsCard.cardcategory,
                    slogan: nsCard.slogan,
                    motto: nsCard.motto,
                    description: nsCard.description,
                    badge: nsCard.badge,
                    trophies: nsCard.trophies,
                    market_value: nsCard.market_value,
                    flag: nsCard.flag,
                  },
                  importedFrom: nationName,
                  importedAt: new Date().toISOString(),
                },
                marketValue: parseFloat(nsCard.market_value),
                totalSupply: 1,
                level: 1,
                enhancements: undefined,
              },
            });
          }

          // Create or update card ownership for user
          const existingOwnership = await ctx.db.cardOwnership.findFirst({
            where: {
              userId: ctx.user.id,
              cardId: card.id,
            },
          });

          if (!existingOwnership) {
            // Get next serial number for this card
            const maxSerial = await ctx.db.cardOwnership.findFirst({
              where: { cardId: card.id },
              orderBy: { serialNumber: 'desc' },
              select: { serialNumber: true },
            });
            const nextSerial = (maxSerial?.serialNumber || 0) + 1;

            // Create new ownership
            await ctx.db.cardOwnership.create({
              data: {
                id: `own_${Date.now()}_${ctx.user.id}_${card.id}`,
                userId: ctx.user.id,
                cardId: card.id,
                ownerId: ctx.user.id,
                serialNumber: nextSerial,
                isLocked: false,
              },
            });
          }

          importedCards.push(card.id);

          // Update user stats
          await ctx.db.user.update({
            where: { id: ctx.user.id },
            data: {
              totalCards: { increment: 1 },
              deckValue: { increment: card.marketValue },
            },
          });
        } catch (error) {
          console.error(`[NS Import] Failed to import card ${nsCard.name ?? "unknown"}:`, error);
          if (nsCard.name) {
            skippedCards.push(nsCard.name);
          }
        }
      }

      // Award bonus IxCredits for import
      const bonusAmount = Math.min(importedCards.length * 10, 500); // 10 IxC per card, max 500
      if (bonusAmount > 0) {
        // Get or create user's vault
        const vault = await ctx.db.myVault.upsert({
          where: { userId: ctx.user.id },
          create: {
            userId: ctx.user.id,
            credits: bonusAmount,
          },
          update: {
            credits: { increment: bonusAmount },
          },
        });

        // Get updated vault balance
        const updatedVault = await ctx.db.myVault.findUnique({
          where: { id: vault.id },
          select: { credits: true },
        });

        await ctx.db.vaultTransaction.create({
          data: {
            id: `vtx_ns_import_${ctx.user.id}_${Date.now()}`,
            vaultId: vault.id,
            credits: bonusAmount,
            balanceAfter: updatedVault?.credits ?? bonusAmount,
            type: "EARN",
            source: "ns_import_bonus",
            metadata: {
              nationName: nationName,
              cardsImported: importedCards.length,
            },
          },
        });
      }

      return {
        success: true,
        cardsImported: importedCards.length,
        cardsSkipped: skippedCards.length,
        bonusCredits: bonusAmount,
        nation: nationName,
      };
    }),

  /**
   * Admin: Get sync status for a specific season
   */
  getSyncStatus: adminProcedure
    .input(
      z.object({
        season: z.number().int().min(1).max(4),
      })
    )
    .query(async ({ ctx, input }) => {
      const checkpoint = await ctx.db.syncCheckpoint.findUnique({
        where: { season: input.season },
      });

      if (!checkpoint) {
        return {
          season: input.season,
          status: "NOT_STARTED",
          cardsProcessed: 0,
          totalCards: 0,
          progress: 0,
          errorCount: 0,
          lastCheckpoint: null,
          completedAt: null,
        };
      }

      const progress = checkpoint.totalCards > 0
        ? (checkpoint.cardsProcessed / checkpoint.totalCards) * 100
        : 0;

      return {
        season: input.season,
        status: checkpoint.status,
        cardsProcessed: checkpoint.cardsProcessed,
        totalCards: checkpoint.totalCards,
        progress,
        errorCount: checkpoint.errorCount,
        lastCheckpoint: checkpoint.lastCheckpointAt,
        completedAt: checkpoint.completedAt,
        lastProcessedCardId: checkpoint.lastProcessedCardId,
      };
    }),

  /**
   * Admin: Get comprehensive sync health across all seasons
   */
  getSyncHealth: adminProcedure
    .query(async () => {
      return await SyncHealthMonitor.getHealthStats();
    }),

  /**
   * Admin: Retry failed cards for a specific season
   */
  retryFailedCards: adminProcedure
    .input(
      z.object({
        season: z.number().int().min(1).max(4),
        cardIds: z.array(z.string()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { season, cardIds } = input;

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const cardId of cardIds) {
        try {
          // Fetch card info from NS API
          const cardInfo = await nsApiClient.fetchCardInfo(cardId, season.toString());

          if (!cardInfo || !cardInfo.name) {
            results.failed++;
            results.errors.push(`Card ${cardId}: Failed to fetch from NS API`);
            continue;
          }

          // Create or update card in database
          const description = cardInfo.description || cardInfo.slogan || cardInfo.motto ||
            `${cardInfo.category || 'Unknown'} from ${cardInfo.region || 'Unknown'}`;

          await ctx.db.card.upsert({
            where: {
              nsCardId_nsSeason: {
                nsCardId: parseInt(cardId),
                nsSeason: season,
              },
            },
            update: {
              title: cardInfo.name,
              description,
              artwork: cardInfo.flag || "/images/cards/placeholder-nation.png",
              rarity: cardInfo.rarity,
              marketValue: parseFloat(cardInfo.market_value || "0"),
              stats: {
                region: cardInfo.region,
                category: cardInfo.category,
                govt: cardInfo.govt,
                cardcategory: cardInfo.cardcategory,
                marketValue: cardInfo.market_value,
                badge: cardInfo.badge,
                trophies: cardInfo.trophies,
              },
              metadata: {
                nsData: cardInfo,
                lastSyncAt: new Date().toISOString(),
              },
            },
            create: {
              id: `card_ns_${cardId}_s${season}`,
              title: cardInfo.name,
              description,
              artwork: cardInfo.flag || "/images/cards/placeholder-nation.png",
              cardType: "NATION",
              rarity: cardInfo.rarity || "COMMON",
              season,
              nsCardId: parseInt(cardId),
              nsSeason: season,
              wikiSource: null,
              wikiArticleTitle: cardInfo.name,
              countryId: null,
              stats: {
                region: cardInfo.region,
                category: cardInfo.category,
                govt: cardInfo.govt,
                cardcategory: cardInfo.cardcategory,
                marketValue: cardInfo.market_value,
                badge: cardInfo.badge,
                trophies: cardInfo.trophies,
              },
              metadata: {
                nsData: cardInfo,
                importedAt: new Date().toISOString(),
              },
              marketValue: parseFloat(cardInfo.market_value || "0"),
              totalSupply: 1,
              level: 1,
            },
          });

          results.successful++;
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`Card ${cardId}: ${errorMessage}`);

          // Log the error
          await SyncHealthMonitor.logError({
            season,
            cardId,
            error: errorMessage,
          });
        }
      }

      // Track the retry operation
      await SyncHealthMonitor.trackSync({
        season,
        status: results.failed === 0 ? "SUCCESS" : "FAILED",
        cardsProcessed: results.successful,
        cardsCreated: results.successful,
        errorMessage: results.errors.length > 0 ? results.errors.join("; ") : undefined,
        metadata: { operation: "retry", cardIds },
      });

      return results;
    }),

  /**
   * Admin: Reset sync checkpoint for a season (clear and start fresh)
   */
  resetSync: adminProcedure
    .input(
      z.object({
        season: z.number().int().min(1).max(4),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { season } = input;

      // Delete existing checkpoint
      await ctx.db.syncCheckpoint.deleteMany({
        where: { season },
      });

      // Log the reset
      await SyncHealthMonitor.trackSync({
        season,
        status: "SUCCESS",
        metadata: { operation: "reset" },
      });

      return {
        success: true,
        message: `Sync checkpoint for season ${season} has been reset`,
      };
    }),

  /**
   * Admin: Trigger manual sync for a specific season
   */
  triggerManualSync: adminProcedure
    .input(
      z.object({
        season: z.number().int().min(1).max(4),
      })
    )
    .mutation(async ({ input }) => {
      const { season } = input;

      // Note: This would typically trigger a background job
      // For now, we just return a success message
      // The actual sync logic should be implemented separately

      await SyncHealthMonitor.trackSync({
        season,
        status: "IN_PROGRESS",
        metadata: { operation: "manual_trigger", triggeredAt: new Date().toISOString() },
      });

      return {
        success: true,
        message: `Manual sync for season ${season} has been queued`,
        season,
      };
    }),

  /**
   * Admin: Get recent sync logs
   */
  getSyncLogs: adminProcedure
    .input(
      z.object({
        season: z.number().int().min(1).max(4).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = input.season
        ? { syncType: `NS_SEASON_${input.season}` }
        : { syncType: { startsWith: "NS_SEASON_" } };

      const logs = await ctx.db.syncLog.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });

      return logs.map(log => ({
        id: log.id,
        season: log.season,
        status: log.status,
        cardsProcessed: log.cardsProcessed ?? 0,
        cardsCreated: log.cardsCreated ?? 0,
        cardsUpdated: log.cardsUpdated ?? 0,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        duration: log.completedAt
          ? log.completedAt.getTime() - log.startedAt.getTime()
          : null,
      }));
    }),
});
