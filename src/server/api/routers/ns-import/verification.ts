/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

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

export const nsImportVerificationRouter = createTRPCRouter({
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

  // ─── Bulk Import Endpoints ────────────────────────────────────────

  // ─── Pause / Play / Stop controls ───

  // ─── Region Discovery ────────────────────────────────────────────

  /**
   * Check if user has already verified/imported any NS nation
   */
  hasImported: protectedProcedure.query(async ({ ctx }) => {
    // Check if they have verified ownership of any nation
    const verification = await ctx.db.nSVerification.findFirst({
      where: {
        userId: ctx.user.id,
        verified: true,
      },
    });
    if (verification) return true;

    // Check if they have any card from NS_IMPORT type
    const cardCount = await ctx.db.cardOwnership.count({
      where: {
        userId: ctx.user.id,
        cards: {
          cardType: "NS_IMPORT",
        },
      },
    });
    return cardCount > 0;
  }),
});
