/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure, adminProcedure } from "../trpc";
import { nsApiClient, type NSCard } from "~/lib/ns-api-client";
import { nsImportService } from "~/lib/ns-import-service";
import { SyncHealthMonitor } from "~/lib/ns-sync-monitor";
import { checkpointManager } from "~/lib/ns-sync-checkpoint";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

const SYNC_TYPE = "NS_CARD_SYNC";

// ─── Background Processing Functions ──────────────────────────────

/**
 * Process a single nation's deck: fetch cards, deduplicate, upsert into DB.
 * Returns counts of created/updated cards and any errors.
 */
async function processNationDeck(
  db: PrismaClient,
  nationName: string,
  regionName: string
): Promise<{ cardsCreated: number; cardsUpdated: number; errors: string[] }> {
  let cardsCreated = 0;
  let cardsUpdated = 0;
  const errors: string[] = [];

  const deckData = await nsApiClient.fetchDeck(nationName);
  if (!deckData || deckData.cards.length === 0) {
    return { cardsCreated, cardsUpdated, errors };
  }

  // Deduplicate cards in the deck
  const uniqueCards = new Map<string, (typeof deckData.cards)[0]>();
  for (const card of deckData.cards) {
    const key = `${card.id}-${card.season}`;
    if (!uniqueCards.has(key)) uniqueCards.set(key, card);
  }

  for (const [, nsCard] of uniqueCards) {
    try {
      const nsCardId = parseInt(nsCard.id);
      const nsSeason = parseInt(nsCard.season);
      if (isNaN(nsCardId) || isNaN(nsSeason)) continue;

      const existing = await db.card.findFirst({
        where: { nsCardId, nsSeason },
      });

      if (existing) {
        const newMarketValue = Math.max(1, parseFloat(nsCard.market_value || "0"));
        if (Math.abs(existing.marketValue - newMarketValue) > 0.01) {
          await db.card.update({
            where: { id: existing.id },
            data: {
              marketValue: newMarketValue,
              stats: {
                ...((existing.stats as Record<string, unknown>) || {}),
                region: nsCard.region || (existing.stats as any)?.region,
                marketValue: nsCard.market_value,
              },
            },
          });
          cardsUpdated++;
        }
        continue;
      }

      // Fetch detailed info for new cards missing a name
      if (!nsCard.name) {
        const info = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
        if (info) Object.assign(nsCard, info);
      }

      const name = nsCard.name;
      if (!name) continue;

      const description =
        nsCard.description ||
        nsCard.slogan ||
        nsCard.motto ||
        `${nsCard.category || "Unknown"} from ${nsCard.region || "Unknown"}`;
      const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

      await db.card.create({
        data: {
          id: `card_ns_${nsCard.id}_s${nsCard.season}`,
          title: name,
          description,
          artwork,
          artworkVariants: nsCard.flag
            ? {
                original: nsCard.flag,
                thumbnail: nsCard.flag,
                large: nsCard.flag,
                flagUrl: nsCard.flag,
              }
            : undefined,
          cardType: "NS_IMPORT",
          rarity: nsCard.rarity || "COMMON",
          season: nsSeason,
          nsCardId,
          nsSeason,
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
            nsData: { ...nsCard },
            importedFrom: `region:${regionName}`,
            importedAt: new Date().toISOString(),
          },
          marketValue: Math.max(1, parseFloat(nsCard.market_value || "0")),
          totalSupply: 1,
          level: 1,
        },
      });
      cardsCreated++;
    } catch (cardError) {
      const msg = cardError instanceof Error ? cardError.message : String(cardError);
      if (!msg.includes("Unique constraint")) {
        errors.push(`Card ${nsCard.id}: ${msg}`);
      }
    }
  }

  return { cardsCreated, cardsUpdated, errors };
}

/**
 * Process nations in a region in the background.
 * Saves progress to SyncLog after every nation so it can be resumed
 * if the server restarts. The full nation list is stored in metadata.
 *
 * @param startFromIndex - Index into the nations array to resume from (0 = start)
 * @param initialCounts  - Accumulated counts to resume from
 */
async function processRegionNationsInBackground(
  db: PrismaClient,
  syncLogId: string,
  nations: string[],
  regionName: string,
  startFromIndex = 0,
  initialCounts = { cardsCreated: 0, cardsUpdated: 0, errors: [] as string[] }
) {
  let nationsProcessed = startFromIndex;
  let cardsCreated = initialCounts.cardsCreated;
  let cardsUpdated = initialCounts.cardsUpdated;
  const errors: string[] = [...initialCounts.errors];

  if (startFromIndex > 0) {
    console.log(
      `[NS Import] Resuming region ${regionName} from nation ${startFromIndex}/${nations.length} (${cardsCreated} cards already created)`
    );
  }

  for (let i = startFromIndex; i < nations.length; i++) {
    const nationName = nations[i]!;
    try {
      const result = await processNationDeck(db, nationName, regionName);
      cardsCreated += result.cardsCreated;
      cardsUpdated += result.cardsUpdated;
      errors.push(...result.errors);
    } catch (nationError) {
      const msg = nationError instanceof Error ? nationError.message : String(nationError);
      errors.push(`Nation ${nationName}: ${msg}`);
    }

    nationsProcessed = i + 1;

    // Save progress after EVERY nation so we can resume precisely
    await db.syncLog.update({
      where: { id: syncLogId },
      data: {
        itemsProcessed: nationsProcessed,
        cardsProcessed: cardsCreated + cardsUpdated,
        cardsCreated,
        cardsUpdated,
        metadata: {
          regionName,
          totalNations: nations.length,
          nations, // Full nation list stored for resume
          nationsProcessed,
          cardsCreated,
          cardsUpdated,
          errorCount: errors.length,
          lastProcessedIndex: i,
        },
      },
    });
  }

  // Final update — mark complete
  await db.syncLog.update({
    where: { id: syncLogId },
    data: {
      status: errors.length > nations.length / 2 ? "FAILED" : "SUCCESS",
      itemsProcessed: nationsProcessed,
      itemsFailed: errors.length,
      cardsProcessed: cardsCreated + cardsUpdated,
      cardsCreated,
      cardsUpdated,
      errorMessage: errors.length > 0 ? errors.slice(0, 20).join("; ") : null,
      completedAt: new Date(),
      metadata: {
        regionName,
        totalNations: nations.length,
        nations, // Keep for reference
        nationsProcessed,
        cardsCreated,
        cardsUpdated,
        errorCount: errors.length,
      },
    },
  });

  console.log(
    `[NS Import] Region ${regionName} complete: ${nationsProcessed} nations, ${cardsCreated} created, ${cardsUpdated} updated, ${errors.length} errors`
  );
}

/**
 * Process a full season card dump in the background.
 * Parses pre-supplied XML data and batch-upserts all cards.
 */
async function processSeasonDumpInBackground(
  db: PrismaClient,
  syncLogId: string,
  season: number,
  xmlData: string
) {
  try {
    console.log(
      `[NS Import] Parsing season ${season} card dump (${(xmlData.length / 1024 / 1024).toFixed(2)} MB)...`
    );
    const parsedCards = await nsApiClient.parseNSDump(xmlData);

    console.log(`[NS Import] Parsed ${parsedCards.length} cards from season ${season} dump`);

    let cardsCreated = 0;
    let cardsUpdated = 0;
    let errorCount = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < parsedCards.length; i += BATCH_SIZE) {
      const batch = parsedCards.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (nsCard: NSCard) => {
          const nsCardId = parseInt(nsCard.id);
          const nsSeason = parseInt(nsCard.season);
          if (isNaN(nsCardId) || isNaN(nsSeason)) return;

          const name = nsCard.name || `Nation ${nsCard.id}`;
          const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

          await db.card.upsert({
            where: {
              nsCardId_nsSeason: { nsCardId, nsSeason },
            },
            update: {
              title: name,
              marketValue: parseFloat(nsCard.market_value || "0"),
              rarity: nsCard.rarity || "COMMON",
              stats: {
                region: nsCard.region,
                category: nsCard.cardcategory || nsCard.category,
                marketValue: nsCard.market_value,
                badge: nsCard.badge,
                trophies: nsCard.trophies,
              },
            },
            create: {
              id: `card_ns_${nsCard.id}_s${nsCard.season}`,
              title: name,
              description:
                nsCard.slogan ||
                `${nsCard.cardcategory || "Nation"} from ${nsCard.region || "Unknown"}`,
              artwork,
              cardType: "NS_IMPORT",
              rarity: nsCard.rarity || "COMMON",
              season: nsSeason,
              nsCardId,
              nsSeason,
              stats: {
                region: nsCard.region,
                category: nsCard.cardcategory || nsCard.category,
                marketValue: nsCard.market_value,
                badge: nsCard.badge,
                trophies: nsCard.trophies,
              },
              metadata: {
                nsData: nsCard,
                importedFrom: `dump:season_${season}`,
                importedAt: new Date().toISOString(),
              },
              marketValue: parseFloat(nsCard.market_value || "0"),
              totalSupply: 1,
              level: 1,
            },
          });
        })
      );

      cardsCreated += results.filter((r) => r.status === "fulfilled").length;
      errorCount += results.filter((r) => r.status === "rejected").length;

      const cardsProcessed = Math.min(i + BATCH_SIZE, parsedCards.length);

      // Save checkpoint every 500 cards
      if (cardsProcessed % 500 === 0 || cardsProcessed === parsedCards.length) {
        await checkpointManager.saveCheckpoint({
          season,
          status: "IN_PROGRESS",
          cardsProcessed,
          totalCards: parsedCards.length,
          lastProcessedCardId: batch[batch.length - 1]?.id || null,
          errorCount,
          startedAt: new Date(),
          lastCheckpointAt: new Date(),
          completedAt: null,
        });
      }

      // Update sync log every 1000 cards
      if (cardsProcessed % 1000 === 0 || cardsProcessed === parsedCards.length) {
        await db.syncLog.update({
          where: { id: syncLogId },
          data: {
            itemsProcessed: cardsProcessed,
            cardsProcessed,
            cardsCreated,
            itemsFailed: errorCount,
            metadata: {
              season,
              totalCards: parsedCards.length,
              cardsProcessed,
              cardsCreated,
              errorCount,
            },
          },
        });
      }
    }

    // Mark complete
    await checkpointManager.markCompleted(season);
    await db.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: "SUCCESS",
        itemsProcessed: parsedCards.length,
        cardsProcessed: parsedCards.length,
        cardsCreated,
        cardsUpdated,
        itemsFailed: errorCount,
        completedAt: new Date(),
        metadata: {
          season,
          totalCards: parsedCards.length,
          cardsCreated,
          cardsUpdated,
          errorCount,
        },
      },
    });

    console.log(
      `[NS Import] Season ${season} dump complete: ${cardsCreated} processed, ${errorCount} errors`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[NS Import] Season dump failed:`, msg);

    await checkpointManager.markFailed(season, msg);
    await db.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: "FAILED",
        errorMessage: msg,
        completedAt: new Date(),
      },
    });
  }
}

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
      let deckData;
      try {
        deckData = await nsApiClient.fetchDeck(input.nationName);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "RATE_LIMIT") {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "NationStates API rate limit exceeded. Please wait a few minutes and try again.",
          });
        }
        if (msg === "SERVER_ERROR") {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "NationStates API is currently unavailable. Please try again later.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `NationStates API error: ${msg}`,
        });
      }

      if (!deckData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to fetch deck from NationStates (Unknown Nation or Empty Deck)",
        });
      }

      // Deduplicate cards and track quantities
      const cardMap = new Map<string, { card: (typeof deckData.cards)[0]; quantity: number }>();

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

      console.log(
        `[NS Import] Deduplicated ${deckData.cards.length} cards to ${uniqueCards.length} unique cards`
      );

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
      const isVerified = await nsApiClient.verifyOwnership(verification.nationName, input.checksum);

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
      let deckData;
      try {
        deckData = await nsApiClient.fetchDeck(nationName);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "RATE_LIMIT") {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "NationStates API rate limit exceeded. Please wait a few minutes and try again.",
          });
        }
        if (msg === "SERVER_ERROR") {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "NationStates API is currently unavailable. Please try again later.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `NationStates API error: ${msg}`,
        });
      }

      if (!deckData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed to fetch deck from NationStates (Unknown Nation or Empty Deck).",
        });
      }

      if (deckData.cards.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This nation has no cards in their deck.",
        });
      }

      const importedCardIds: string[] = [];
      const importedCardData: {
        id: string;
        title: string;
        artwork: string;
        rarity: string;
        season: number;
        marketValue: number;
      }[] = [];
      const skippedCards: string[] = [];

      // Process cards in batches
      for (const nsCard of deckData.cards) {
        try {
          // Fetch full card info since deck API may only provide id, season, rarity
          if (
            !nsCard.name ||
            !nsCard.market_value ||
            nsCard.market_value === "0" ||
            nsCard.market_value === "0.00"
          ) {
            console.log(`[NS Import] Fetching card info for ${nsCard.id} S${nsCard.season}`);
            const cardInfo = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
            if (cardInfo) {
              // Only overwrite fields that cardInfo actually provides
              Object.assign(nsCard, cardInfo);
            }
          }

          // Skip if we still don't have a name
          if (!nsCard.name) {
            console.error(
              `[NS Import] Could not fetch name for card ${nsCard.id} S${nsCard.season}`
            );
            skippedCards.push(`Card ${nsCard.id} S${nsCard.season}`);
            continue;
          }

          const parsedMarketValue = Math.max(1, parseFloat(nsCard.market_value || "0"));

          // Check if card definition exists, create if not
          let card = await ctx.db.card.findFirst({
            where: {
              nsCardId: parseInt(nsCard.id),
              nsSeason: parseInt(nsCard.season),
            },
          });

          // Update existing card if it has stale/zero market value
          if (card && card.marketValue === 0 && parsedMarketValue > 0) {
            card = await ctx.db.card.update({
              where: { id: card.id },
              data: {
                marketValue: parsedMarketValue,
                stats: {
                  ...((card.stats as Record<string, unknown>) || {}),
                  marketValue: nsCard.market_value,
                },
              },
            });
          }

          if (!card) {
            // Create new card definition
            const description =
              nsCard.description ||
              nsCard.slogan ||
              nsCard.motto ||
              `${nsCard.category || "Unknown"} from ${nsCard.region || "Unknown"}`;

            // Use NS flag as artwork, fallback to placeholder
            const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

            card = await ctx.db.card.create({
              data: {
                id: `card_ns_${nsCard.id}_s${nsCard.season}`,
                title: nsCard.name,
                description: description,
                artwork: artwork,
                artworkVariants: nsCard.flag
                  ? {
                      original: nsCard.flag,
                      thumbnail: nsCard.flag,
                      large: nsCard.flag,
                      flagUrl: nsCard.flag,
                    }
                  : undefined,
                cardType: "NS_IMPORT",
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
                marketValue: parsedMarketValue,
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
              orderBy: { serialNumber: "desc" },
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

          importedCardIds.push(card.id);
          importedCardData.push({
            id: card.id,
            title: card.title,
            artwork: card.artwork,
            rarity: card.rarity,
            season: card.season ?? parseInt(nsCard.season),
            marketValue: card.marketValue,
          });

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
      const bonusAmount = Math.min(importedCardIds.length * 10, 500); // 10 IxC per card, max 500
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
              cardsImported: importedCardIds.length,
            },
          },
        });
      }

      return {
        success: true,
        cardsImported: importedCardIds.length,
        cardsSkipped: skippedCards.length,
        bonusCredits: bonusAmount,
        nation: nationName,
        cards: importedCardData,
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
        where: {
          syncType_season: {
            syncType: SYNC_TYPE,
            season: input.season,
          },
        },
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

      const cp = (checkpoint.checkpoint as any) || {};
      const cardsProcessed = Number(cp.cardsProcessed ?? 0);
      const totalCards = Number(cp.totalCards ?? 0);
      const errorCount = Number(cp.errorCount ?? 0);
      const lastCheckpoint = cp.lastCheckpointAt
        ? new Date(cp.lastCheckpointAt)
        : new Date(checkpoint.updatedAt);
      const completedAt = cp.completedAt ? new Date(cp.completedAt) : null;

      const progress = totalCards > 0 ? (cardsProcessed / totalCards) * 100 : 0;

      return {
        season: input.season,
        status: (cp.status as string) || "IN_PROGRESS",
        cardsProcessed,
        totalCards,
        progress,
        errorCount,
        lastCheckpoint,
        completedAt,
        lastProcessedCardId: checkpoint.lastCardId ?? null,
      };
    }),

  /**
   * Admin: Get comprehensive sync health across all seasons
   */
  getSyncHealth: adminProcedure.query(async () => {
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
          const description =
            cardInfo.description ||
            cardInfo.slogan ||
            cardInfo.motto ||
            `${cardInfo.category || "Unknown"} from ${cardInfo.region || "Unknown"}`;

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
              cardType: "NS_IMPORT",
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
        where: { syncType: SYNC_TYPE, season },
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
        syncTypeFilter: z.enum(["all", "season", "region", "dump"]).optional().default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      let where: Record<string, unknown>;
      if (input.season) {
        where = { syncType: `NS_SEASON_${input.season}` };
      } else if (input.syncTypeFilter === "region") {
        where = { syncType: { startsWith: "NS_REGION_" } };
      } else if (input.syncTypeFilter === "dump") {
        where = { syncType: { startsWith: "NS_SEASON_DUMP_" } };
      } else if (input.syncTypeFilter === "season") {
        where = {
          syncType: { startsWith: "NS_SEASON_" },
          NOT: { syncType: { startsWith: "NS_SEASON_DUMP_" } },
        };
      } else {
        where = { syncType: { startsWith: "NS_" } };
      }

      const logs = await ctx.db.syncLog.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });

      return logs.map((log) => ({
        id: log.id,
        syncType: log.syncType,
        season: log.season,
        status: log.status,
        cardsProcessed: log.cardsProcessed ?? 0,
        cardsCreated: log.cardsCreated ?? 0,
        cardsUpdated: log.cardsUpdated ?? 0,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        duration: log.completedAt ? log.completedAt.getTime() - log.startedAt.getTime() : null,
      }));
    }),

  /**
   * Get user's import history
   */
  getMyImportHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get user's vault transactions for NS imports
      const vault = await ctx.db.myVault.findUnique({
        where: { userId: ctx.user.id },
        include: {
          transactions: {
            where: {
              source: "ns_import_bonus",
            },
            orderBy: { createdAt: "desc" },
            take: input.limit,
          },
        },
      });

      const imports = vault?.transactions || [];

      return imports.map((tx) => ({
        id: tx.id,
        nationName: (tx.metadata as any)?.nationName || "Unknown",
        cardsImported: (tx.metadata as any)?.cardsImported || 0,
        totalValue: (tx.metadata as any)?.totalValue || 0,
        bonusCredits: tx.credits,
        importedAt: tx.createdAt,
      }));
    }),

  /**
   * Get import statistics
   */
  getImportStats: protectedProcedure.query(async ({ ctx }) => {
    // Count NS import transactions
    const vault = await ctx.db.myVault.findUnique({
      where: { userId: ctx.user.id },
      include: {
        transactions: {
          where: {
            source: "ns_import_bonus",
          },
        },
      },
    });

    const imports = vault?.transactions || [];
    const totalImports = imports.length;
    const lastImport = imports[0]?.createdAt || null;

    // Count imported cards
    const importedCards = await ctx.db.cardOwnership.findMany({
      where: {
        userId: ctx.user.id,
        cards: {
          cardType: "NS_IMPORT",
        },
      },
      include: {
        cards: true,
      },
    });

    const totalCards = importedCards.reduce((sum, ownership) => sum + ownership.quantity, 0);
    const totalValue = importedCards.reduce(
      (sum, ownership) => sum + (ownership.cards.marketValue || 0),
      0
    );

    return {
      totalImports,
      totalCards,
      totalValue,
      lastImport,
    };
  }),

  /**
   * Preview deck before import (for step wizard)
   */
  previewDeck: protectedProcedure
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

      // Deduplicate and count unique cards
      const cardMap = new Map<string, { rarity: string; value: number }>();

      for (const card of deckData.cards) {
        const key = `${card.id}-${card.season}`;
        if (!cardMap.has(key)) {
          cardMap.set(key, {
            rarity: card.rarity,
            value: parseFloat(card.market_value || "0"),
          });
        }
      }

      // Count by rarity
      const rarityCount: Record<string, number> = {};
      let totalValue = 0;

      for (const { rarity, value } of cardMap.values()) {
        rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
        totalValue += value;
      }

      return {
        nation: deckData.nation,
        totalCards: deckData.num_cards,
        uniqueCards: cardMap.size,
        deckValue: deckData.deck_value,
        estimatedIxCredits: Math.min(cardMap.size * 10, 500),
        rarityBreakdown: rarityCount,
      };
    }),

  // ─── Bulk Import Endpoints ────────────────────────────────────────

  /**
   * Admin: Fetch and import all cards from a specific NS region
   * Returns immediately — processing runs in the background
   */
  fetchRegionCards: adminProcedure
    .input(
      z.object({
        regionName: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { regionName } = input;

      // Fetch nation list (single API call)
      const nations = await nsApiClient.fetchRegionNations(regionName);

      if (!nations || nations.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No nations found in region "${regionName}"`,
        });
      }

      // Create sync log entry for tracking (includes full nation list for resume)
      const syncLog = await ctx.db.syncLog.create({
        data: {
          syncType: `NS_REGION_${regionName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
          status: "IN_PROGRESS",
          season: null,
          itemsProcessed: 0,
          itemsFailed: 0,
          metadata: {
            regionName,
            totalNations: nations.length,
            nations, // Store full list so we can resume after restart
            nationsProcessed: 0,
            cardsCreated: 0,
            cardsUpdated: 0,
            errorCount: 0,
            lastProcessedIndex: -1,
            startedBy: ctx.user.id,
          },
          startedAt: new Date(),
        },
      });

      // Fire-and-forget background processing
      processRegionNationsInBackground(
        ctx.db as unknown as PrismaClient,
        syncLog.id,
        nations,
        regionName
      ).catch((error) => {
        console.error(`[NS Import] Background region fetch failed:`, error);
      });

      return {
        success: true,
        syncLogId: syncLog.id,
        nationsFound: nations.length,
        message: `Started importing cards from ${nations.length} nations in ${regionName}`,
      };
    }),

  /**
   * Admin: Import full season card dump from NationStates
   * Downloads the gzipped XML dump and batch-upserts all cards
   * Returns immediately — processing runs in the background
   */
  importSeasonDump: adminProcedure
    .input(
      z.object({
        season: z.number().int().min(1).max(4),
        // Base64-encoded gzipped XML, or raw XML string
        fileData: z.string().min(100),
        isGzipped: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { season, fileData, isGzipped } = input;

      let xmlData: string;
      try {
        const buffer = Buffer.from(fileData, "base64");
        if (isGzipped) {
          const zlib = await import("zlib");
          const { promisify } = await import("util");
          const gunzip = promisify(zlib.gunzip);
          const decompressed = await gunzip(buffer);
          xmlData = decompressed.toString("utf-8");
        } else {
          xmlData = buffer.toString("utf-8");
        }
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to decompress file: ${error instanceof Error ? error.message : "Invalid data"}`,
        });
      }

      if (!xmlData.includes("<CARD>")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File does not appear to contain NS card data (no <CARD> elements found)",
        });
      }

      // Create sync log
      const syncLog = await ctx.db.syncLog.create({
        data: {
          syncType: `NS_SEASON_DUMP_${season}`,
          status: "IN_PROGRESS",
          season,
          itemsProcessed: 0,
          itemsFailed: 0,
          metadata: {
            operation: "season_dump",
            season,
            startedBy: ctx.user.id,
            fileSize: xmlData.length,
          },
          startedAt: new Date(),
        },
      });

      // Fire-and-forget background processing
      processSeasonDumpInBackground(
        ctx.db as unknown as PrismaClient,
        syncLog.id,
        season,
        xmlData
      ).catch((error) => {
        console.error(`[NS Import] Background season dump failed:`, error);
      });

      return {
        success: true,
        syncLogId: syncLog.id,
        message: `Started importing season ${season} card dump (${(xmlData.length / 1024 / 1024).toFixed(1)} MB XML). This may take several minutes.`,
      };
    }),

  /**
   * Admin: Get status of a specific sync operation
   * Used by frontend to poll progress of background jobs
   */
  getRegionSyncStatus: adminProcedure
    .input(
      z.object({
        syncLogId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const log = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!log) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sync log not found",
        });
      }

      const meta = (log.metadata as Record<string, unknown>) || {};
      return {
        id: log.id,
        syncType: log.syncType,
        status: log.status,
        itemsProcessed: log.itemsProcessed,
        cardsProcessed: log.cardsProcessed ?? 0,
        cardsCreated: log.cardsCreated ?? 0,
        cardsUpdated: log.cardsUpdated ?? 0,
        errorCount: log.itemsFailed,
        totalNations: (meta.totalNations as number) ?? 0,
        regionName: (meta.regionName as string) ?? null,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        errorMessage: log.errorMessage,
      };
    }),

  // ─── Resume / Interrupted Jobs ─────────────────────────────────

  /**
   * Get any interrupted (IN_PROGRESS) region import jobs that can be resumed.
   * These are SyncLogs with status IN_PROGRESS and a nations list in metadata.
   */
  getInterruptedJobs: adminProcedure.query(async ({ ctx }) => {
    const jobs = await ctx.db.syncLog.findMany({
      where: {
        status: "IN_PROGRESS",
        syncType: { startsWith: "NS_REGION_" },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    return jobs
      .filter((job) => {
        const meta = job.metadata as Record<string, any> | null;
        return meta?.nations && Array.isArray(meta.nations) && meta.nations.length > 0;
      })
      .map((job) => {
        const meta = job.metadata as Record<string, any>;
        return {
          id: job.id,
          syncType: job.syncType,
          regionName: (meta.regionName as string) ?? "Unknown",
          totalNations: (meta.totalNations as number) ?? 0,
          nationsProcessed: job.itemsProcessed ?? 0,
          cardsCreated: job.cardsCreated ?? 0,
          cardsUpdated: job.cardsUpdated ?? 0,
          errorCount: job.itemsFailed ?? 0,
          startedAt: job.startedAt,
          lastProcessedIndex: (meta.lastProcessedIndex as number) ?? -1,
        };
      });
  }),

  /**
   * Resume an interrupted region import job.
   * Reads the nation list and progress from the SyncLog, then continues
   * background processing from where it left off.
   */
  resumeRegionFetch: adminProcedure
    .input(z.object({ syncLogId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const syncLog = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!syncLog) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sync job not found" });
      }

      if (syncLog.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job is already ${syncLog.status}, cannot resume`,
        });
      }

      const meta = syncLog.metadata as Record<string, any> | null;
      const nations = meta?.nations as string[] | undefined;
      const regionName = meta?.regionName as string | undefined;

      if (!nations || !Array.isArray(nations) || nations.length === 0 || !regionName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Job metadata is missing the nation list — cannot resume. Start a new import instead.",
        });
      }

      // Resume from the nation after the last fully processed one
      const lastProcessedIndex = (meta?.lastProcessedIndex as number) ?? -1;
      const resumeFromIndex = lastProcessedIndex + 1;

      if (resumeFromIndex >= nations.length) {
        // Already done — just mark complete
        await ctx.db.syncLog.update({
          where: { id: syncLog.id },
          data: { status: "SUCCESS", completedAt: new Date() },
        });
        return {
          success: true,
          syncLogId: syncLog.id,
          message: `Job was already complete (${nations.length} nations processed).`,
          resumed: false,
        };
      }

      console.log(
        `[NS Import] Resuming region "${regionName}" from nation ${resumeFromIndex}/${nations.length} ` +
          `(${syncLog.cardsCreated ?? 0} cards already created)`
      );

      // Fire-and-forget background processing, continuing from where we left off
      processRegionNationsInBackground(
        ctx.db as unknown as PrismaClient,
        syncLog.id,
        nations,
        regionName,
        resumeFromIndex,
        {
          cardsCreated: syncLog.cardsCreated ?? 0,
          cardsUpdated: syncLog.cardsUpdated ?? 0,
          errors: [],
        }
      ).catch((error) => {
        console.error(`[NS Import] Background resume failed:`, error);
      });

      return {
        success: true,
        syncLogId: syncLog.id,
        message: `Resumed: continuing from nation ${resumeFromIndex + 1}/${nations.length} in "${regionName}"`,
        resumed: true,
        remaining: nations.length - resumeFromIndex,
      };
    }),

  // ─── Region Discovery ────────────────────────────────────────────

  /**
   * Discover the largest NS regions by nation count.
   * Fetches regions tagged "massive" and "enormous" from the World API,
   * then queries each for nation count. Returns top N sorted by size.
   */
  discoverTopRegions: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(15),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const limit = input?.limit ?? 15;

      console.log(`[NS Import] Discovering top regions (limit: ${limit})...`);

      // Fetch regions with the largest size tags
      // "massive" = 2501+ nations, "enormous" = 501-2500 nations
      const massiveRegions = await nsApiClient.fetchRegionsByTag("massive");
      const enormousRegions = await nsApiClient.fetchRegionsByTag("enormous");

      const allRegionNames = new Set<string>();
      if (massiveRegions) massiveRegions.forEach((r) => allRegionNames.add(r));
      if (enormousRegions) enormousRegions.forEach((r) => allRegionNames.add(r));

      if (allRegionNames.size === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch region lists from NS API",
        });
      }

      console.log(
        `[NS Import] Found ${allRegionNames.size} large regions, querying nation counts...`
      );

      // Query nation counts - limit concurrent requests to stay within rate limits
      const regionData: { id: string; name: string; numnations: number }[] = [];

      for (const regionId of allRegionNames) {
        const info = await nsApiClient.fetchRegionNationCount(regionId);
        if (info) {
          regionData.push({
            id: regionId,
            name: info.name,
            numnations: info.numnations,
          });
        }
      }

      // Sort by nation count descending and take top N
      regionData.sort((a, b) => b.numnations - a.numnations);
      const topRegions = regionData.slice(0, limit);

      console.log(
        `[NS Import] Top ${topRegions.length} regions:`,
        topRegions.map((r) => `${r.name} (${r.numnations})`).join(", ")
      );

      return {
        regions: topRegions,
        totalScanned: regionData.length,
      };
    }),

  /**
   * Batch-update gameplay stats (economic/diplomatic/military/social)
   * for all NS_IMPORT cards that don't have them yet.
   */
  batchUpdateCardStats: adminProcedure
    .input(
      z
        .object({
          forceAll: z.boolean().optional().default(false),
        })
        .optional()
        .default({})
    )
    .mutation(async ({ ctx, input }) => {
      const BATCH = 100;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Get all NS_IMPORT cards
      const cards = await ctx.db.card.findMany({
        where: { cardType: "NS_IMPORT" },
        select: { id: true, nsCardId: true, stats: true },
      });

      console.log(
        `[NS Import] Batch updating stats for ${cards.length} NS cards (forceAll=${input.forceAll})`
      );

      for (let i = 0; i < cards.length; i += BATCH) {
        const batch = cards.slice(i, i + BATCH);
        const updates = [];

        for (const card of batch) {
          const existingStats = card.stats as Record<string, unknown> | null;
          if (!existingStats) {
            skipped++;
            continue;
          }

          // Skip if already has gameplay stats (unless forceAll)
          if (!input.forceAll && typeof existingStats.economic === "number") {
            skipped++;
            continue;
          }

          const gameplayStats = nsImportService.generateCardStats(
            {
              govt: existingStats.govt as string | undefined,
              marketValue: existingStats.marketValue as string | undefined,
              badge: existingStats.badge as string | undefined,
              trophies: existingStats.trophies as string | undefined,
              region: existingStats.region as string | undefined,
              category: existingStats.category as string | undefined,
              cardcategory: existingStats.cardcategory as string | undefined,
            },
            card.nsCardId ?? undefined
          );

          updates.push(
            ctx.db.card.update({
              where: { id: card.id },
              data: {
                stats: { ...existingStats, ...gameplayStats },
              },
            })
          );
        }

        if (updates.length > 0) {
          try {
            await Promise.all(updates);
            updated += updates.length;
          } catch (err) {
            errors += updates.length;
            console.error(`[NS Import] Batch error at offset ${i}:`, err);
          }
        }

        if ((i + BATCH) % 1000 === 0 || i + BATCH >= cards.length) {
          console.log(
            `[NS Import] Progress: ${Math.min(i + BATCH, cards.length)}/${cards.length} (updated: ${updated}, skipped: ${skipped})`
          );
        }
      }

      console.log(
        `[NS Import] Batch stats complete: ${updated} updated, ${skipped} skipped, ${errors} errors`
      );
      return { updated, skipped, errors, total: cards.length };
    }),

  /**
   * Refresh market values for user's 0-value NS cards by re-fetching from NS API,
   * then recalculate deckValue from actual card values.
   */
  refreshCardValues: protectedProcedure.mutation(async ({ ctx }) => {
    // Find all NS_IMPORT cards owned by the current user with 0 market value
    const ownerships = await ctx.db.cardOwnership.findMany({
      where: { userId: ctx.user.id },
      select: {
        cardId: true,
        cards: {
          select: {
            id: true,
            nsCardId: true,
            nsSeason: true,
            marketValue: true,
            cardType: true,
            stats: true,
          },
        },
      },
    });

    let refreshed = 0;
    let failed = 0;

    // Fix 0-value NS cards by re-fetching from NS API
    const zeroValueCards = ownerships.filter(
      (o) =>
        o.cards.cardType === "NS_IMPORT" &&
        o.cards.marketValue === 0 &&
        o.cards.nsCardId &&
        o.cards.nsSeason
    );

    for (const ownership of zeroValueCards) {
      try {
        const info = await nsApiClient.fetchCardInfo(
          String(ownership.cards.nsCardId),
          String(ownership.cards.nsSeason)
        );
        if (info?.market_value) {
          const newValue = Math.max(1, parseFloat(info.market_value));
          if (newValue > 0) {
            await ctx.db.card.update({
              where: { id: ownership.cards.id },
              data: {
                marketValue: newValue,
                stats: {
                  ...((ownership.cards.stats as Record<string, unknown>) || {}),
                  marketValue: info.market_value,
                },
              },
            });
            refreshed++;
          }
        }
      } catch {
        failed++;
      }
    }

    // Recalculate deck value from actual card values
    const allOwned = await ctx.db.cardOwnership.findMany({
      where: { userId: ctx.user.id },
      select: { cards: { select: { marketValue: true } } },
    });

    const totalDeckValue = allOwned.reduce((sum, o) => sum + Math.max(1, o.cards.marketValue), 0);
    const totalCards = allOwned.length;

    await ctx.db.user.update({
      where: { id: ctx.user.id },
      data: {
        deckValue: totalDeckValue,
        totalCards: totalCards,
      },
    });

    return {
      refreshed,
      failed,
      totalCards,
      deckValue: totalDeckValue,
      zeroValueChecked: zeroValueCards.length,
    };
  }),
});
