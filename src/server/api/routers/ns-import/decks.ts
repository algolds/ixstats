/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";
import { getVaultConfig, vaultService } from "~/lib/vault-service";

const SYNC_TYPE = "NS_CARD_SYNC";
const activeRunningJobs = new Set<string>();

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
  activeRunningJobs.add(syncLogId);
  try {
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
      // Check if the job was paused or stopped/cancelled in the DB
      const currentJob = await db.syncLog.findUnique({
        where: { id: syncLogId },
        select: { status: true },
      });
      if (currentJob?.status === "PAUSED") {
        console.log(
          `[NS Import] Region ${regionName} fetch paused at nation index ${i}/${nations.length}`
        );
        return; // Exit graceful pause
      }
      if (currentJob?.status === "FAILED") {
        console.log(
          `[NS Import] Region ${regionName} fetch stopped at nation index ${i}/${nations.length}`
        );
        return; // Exit stopped job
      }

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
  } finally {
    activeRunningJobs.delete(syncLogId);
  }
}

export const nsImportDecksRouter = createTRPCRouter({
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
            message:
              "NationStates API rate limit exceeded. Please wait a few minutes and try again.",
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
            message:
              "NationStates API rate limit exceeded. Please wait a few minutes and try again.",
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

      // Get vault config and calculate user's maximum capacity limit
      const config = await getVaultConfig(ctx.db as any);
      const capacityBoost = await vaultService.getCardCapacityBoost(ctx.user.id, ctx.db as any);
      const maxCards = 150 + capacityBoost;

      // Check if user is exempt (role level <= 20 and exemption toggle is enabled)
      const userRoleLevel = ctx.user.role?.level ?? 100;
      const isExempt = config.exemptStaffFromLimit && userRoleLevel <= 20;

      const currentCardsCount = await ctx.db.cardOwnership.count({
        where: { userId: ctx.user.id },
      });

      // Process cards in batches
      for (const nsCard of deckData.cards) {
        // Enforce inventory capacity limit check (only if not exempt)
        if (!isExempt && currentCardsCount + importedCardIds.length >= maxCards) {
          console.warn(
            `[NS Import] User ${ctx.user.id} hit capacity limit of ${maxCards} cards during deck import.`
          );
          const cardLabel = nsCard.name ? `${nsCard.name}` : `Card ${nsCard.id} S${nsCard.season}`;
          skippedCards.push(`${cardLabel} (Inventory Full)`);
          continue;
        }
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
            artwork: card.artwork ?? "",
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

  // ─── Pause / Play / Stop controls ───

  // ─── Region Discovery ────────────────────────────────────────────
});
