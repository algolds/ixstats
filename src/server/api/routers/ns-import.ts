/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { TRPCError } from "@trpc/server";

export const nsImportRouter = createTRPCRouter({
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
            const description = nsCard.slogan || nsCard.motto || `${nsCard.category || 'Unknown'} from ${nsCard.region || 'Unknown'}`;

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
                } : null,
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
                  marketValue: nsCard.market_value,
                  badge: nsCard.badge,
                  trophies: nsCard.trophies,
                },
                marketValue: parseFloat(nsCard.market_value),
                totalSupply: 1,
                level: 1,
                enhancements: null,
              },
            });
          }

          // Create or update card ownership for user
          const existingOwnership = await ctx.db.cardOwnership.findUnique({
            where: {
              userId_cardId: {
                userId: ctx.user.id,
                cardId: card.id,
              },
            },
          });

          if (existingOwnership) {
            // User already has this card, increment quantity
            await ctx.db.cardOwnership.update({
              where: { id: existingOwnership.id },
              data: {
                quantity: { increment: 1 },
              },
            });
          } else {
            // Create new ownership
            await ctx.db.cardOwnership.create({
              data: {
                userId: ctx.user.id,
                cardId: card.id,
                quantity: 1,
                acquiredMethod: "NS_IMPORT",
                isLeveledUp: false,
                hasAlternateArt: false,
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
          console.error(`[NS Import] Failed to import card ${nsCard.name}:`, error);
          skippedCards.push(nsCard.name);
        }
      }

      // Award bonus IxCredits for import
      const bonusAmount = Math.min(importedCards.length * 10, 500); // 10 IxC per card, max 500
      if (bonusAmount > 0) {
        await ctx.db.vaultTransaction.create({
          data: {
            id: `vtx_ns_import_${ctx.user.id}_${Date.now()}`,
            userId: ctx.user.id,
            type: "EARN",
            amount: bonusAmount,
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
});
