/**
 * Nation Card Value Tracking Cron Job
 *
 * Runs every 6 hours to track the market value of NATION cards.
 *
 * Features:
 * - Tracks market value changes for NATION cards over time
 * - Detects significant value changes (> 20%)
 * - Logs comprehensive market data to CardValueHistory
 *
 * A card's value comes from its rarity and type (getCardMarketValue); no nation figure feeds it.
 *
 * Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
 *
 * Usage:
 *   import { updateCardValues } from '~/lib/nation-card-value-update-cron';
 *   await updateCardValues(); // Run every 6 hours
 */

import { db } from "~/server/db";
import { getCardMarketValue } from "~/lib/cards/card-service";

/**
 * Result interface for value update operation
 */
interface ValueUpdateResult {
  success: boolean;
  cardsUpdated: number;
  significantChanges: number;
  errors: number;
}

/**
 * Update card values for all NATION cards
 * Tracks value history and flags large moves
 */
export async function updateCardValues(): Promise<ValueUpdateResult> {
  console.log("[Card Value Cron] Starting value update cycle...");
  const startTime = Date.now();

  let cardsUpdated = 0;
  let significantChanges = 0;
  let errorCount = 0;

  try {
    // Get all NATION cards with country associations
    const nationCards = await db.card.findMany({
      where: {
        cardType: "NATION",
        countryId: { not: null },
      },
      include: {
        CardOwnership: {
          select: {
            userId: true,
            lastSalePrice: true,
          },
        },
        valueHistory: {
          orderBy: { recordedAt: "desc" },
          take: 1, // The latest entry, for the change since the last run
        },
      },
    });

    console.log(`[Card Value Cron] Found ${nationCards.length} nation cards to process`);

    // Process each card
    for (const card of nationCards) {
      try {
        // Calculate current market value
        const currentValue = await getCardMarketValue(db as any, card.id);

        // Save value history entry
        await db.cardValueHistory.create({
          data: {
            cardId: card.id,
            value: currentValue,
          },
        });

        // Calculate value change percentage
        const previousValue =
          card.valueHistory.length > 0 ? card.valueHistory[0]!.value : currentValue;
        const valueChange =
          previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

        // Log significant value changes
        if (Math.abs(valueChange) > 20) {
          significantChanges++;
          console.log(
            `[Card Value Cron] ⚠ Significant value change: ${card.title} ` +
              `${valueChange > 0 ? "+" : ""}${valueChange.toFixed(1)}% ` +
              `(${previousValue.toFixed(2)} → ${currentValue.toFixed(2)} IxC)`
          );
        }

        // Update card market value in main table
        await db.card.update({
          where: { id: card.id },
          data: {
            marketValue: currentValue,
            updatedAt: new Date(),
          },
        });

        cardsUpdated++;
      } catch (error) {
        console.error(`[Card Value Cron] Error processing card ${card.id}:`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    const summary: ValueUpdateResult = {
      success: true,
      cardsUpdated,
      significantChanges,
      errors: errorCount,
    };

    console.log(
      `[Card Value Cron] ✓ Update cycle complete in ${duration}ms\n` +
        `  Cards Updated: ${summary.cardsUpdated}\n` +
        `  Significant Changes: ${summary.significantChanges}\n` +
        `  Errors: ${summary.errors}`
    );

    return summary;
  } catch (error) {
    console.error("[Card Value Cron] ✗ Critical error during update:", error);
    return {
      success: false,
      cardsUpdated,
      significantChanges,
      errors: errorCount + 1,
    };
  }
}
