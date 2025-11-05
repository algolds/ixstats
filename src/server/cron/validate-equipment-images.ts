// src/server/cron/validate-equipment-images.ts
/**
 * Cron Job: Validate Equipment Images
 *
 * Scheduled validation of military equipment images from Wikimedia Commons.
 * Tests URLs, detects broken links, and attempts auto-resolution.
 */

import { PrismaClient } from "@prisma/client";
import {
  resolveEquipmentImage,
  batchResolveImages,
} from "~/server/services/wikimedia-equipment-image-resolver";

const prisma = new PrismaClient();

export interface ValidationJobResult {
  success: boolean;
  timestamp: Date;
  total: number;
  validated: number;
  broken: number;
  fixed: number;
  failed: number;
  errors: string[];
}

export interface ValidationStats {
  total: number;
  withImages: number;
  withoutImages: number;
  recentlyValidated: number;
  needsValidation: number;
}

/**
 * Main validation cron job
 * Validates all equipment images and attempts auto-resolution for broken URLs
 */
export async function validateEquipmentImagesJob(): Promise<ValidationJobResult> {
  const result: ValidationJobResult = {
    success: false,
    timestamp: new Date(),
    total: 0,
    validated: 0,
    broken: 0,
    fixed: 0,
    failed: 0,
    errors: [],
  };

  try {
    console.log("[CRON] Starting equipment image validation job...");

    // Get all equipment with images
    const equipment = await prisma.militaryEquipmentCatalog.findMany({
      where: {
        imageUrl: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        category: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "asc" }, // Validate oldest first
    });

    result.total = equipment.length;
    console.log(`[CRON] Found ${equipment.length} equipment items with images`);

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < equipment.length; i += batchSize) {
      const batch = equipment.slice(i, i + batchSize);

      for (const item of batch) {
        try {
          // Validate image URL
          const isValid = await validateImageUrl(item.imageUrl!);

          if (isValid) {
            result.validated++;
            console.log(`[CRON] ✅ Valid: ${item.name}`);
          } else {
            result.broken++;
            console.log(`[CRON] ❌ Broken: ${item.name} - ${item.imageUrl}`);

            // Attempt auto-resolution
            console.log(`[CRON] 🔧 Attempting auto-fix for: ${item.name}`);
            const resolved = await resolveEquipmentImage(item.id);

            if (resolved.success && resolved.imageUrl) {
              result.fixed++;
              console.log(`[CRON] ✅ Auto-fixed: ${item.name} -> ${resolved.imageUrl}`);
            } else {
              result.failed++;
              console.log(`[CRON] ❌ Auto-fix failed: ${item.name}`);
              result.errors.push(`Failed to resolve: ${item.name} (${item.id})`);
            }
          }
        } catch (error) {
          result.errors.push(
            `Error validating ${item.name}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          console.error(`[CRON] Error validating ${item.name}:`, error);
        }
      }

      // Rate limit: wait 2 seconds between batches
      if (i + batchSize < equipment.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    result.success = true;
    console.log("[CRON] Validation job completed successfully");
    console.log(
      `[CRON] Results: ${result.validated} valid, ${result.broken} broken, ${result.fixed} fixed, ${result.failed} failed`
    );

    // Send Discord notification if configured
    if (process.env.DISCORD_WEBHOOK_URL) {
      await sendDiscordNotification(result);
    }

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(
      `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    console.error("[CRON] Validation job failed:", error);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Get validation statistics
 */
export async function getValidationStats(): Promise<ValidationStats> {
  try {
    const [total, withImages, recentlyValidated] = await Promise.all([
      prisma.militaryEquipmentCatalog.count(),
      prisma.militaryEquipmentCatalog.count({
        where: { imageUrl: { not: null } },
      }),
      prisma.militaryEquipmentCatalog.count({
        where: {
          imageUrl: { not: null },
          updatedAt: {
            // Updated within last 7 days
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const withoutImages = total - withImages;
    const needsValidation = withImages - recentlyValidated;

    return {
      total,
      withImages,
      withoutImages,
      recentlyValidated,
      needsValidation,
    };
  } catch (error) {
    console.error("[CRON] Failed to get validation stats:", error);
    throw error;
  }
}

/**
 * Validate image URL accessibility
 */
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "IxStats/1.0 (https://ixwiki.com; contact@ixwiki.com)",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    return response.status === 200;
  } catch (error) {
    console.error(`[CRON] URL validation failed for ${url}:`, error);
    return false;
  }
}

/**
 * Send Discord webhook notification
 */
async function sendDiscordNotification(result: ValidationJobResult): Promise<void> {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const embed = {
      title: "🖼️ Weekly Equipment Image Validation",
      color: result.broken > result.validated * 0.1 ? 0xff0000 : 0x00ff00, // Red if >10% broken
      fields: [
        {
          name: "📊 Total Equipment",
          value: result.total.toString(),
          inline: true,
        },
        {
          name: "✅ Valid",
          value: `${result.validated} (${result.total > 0 ? ((result.validated / result.total) * 100).toFixed(1) : 0}%)`,
          inline: true,
        },
        {
          name: "❌ Broken",
          value: `${result.broken} (${result.total > 0 ? ((result.broken / result.total) * 100).toFixed(1) : 0}%)`,
          inline: true,
        },
        {
          name: "🔧 Auto-fixed",
          value: result.fixed.toString(),
          inline: true,
        },
        {
          name: "⚠️ Failed to Fix",
          value: result.failed.toString(),
          inline: true,
        },
        {
          name: "📅 Timestamp",
          value: result.timestamp.toISOString(),
          inline: false,
        },
      ],
      footer: {
        text: result.success ? "Validation completed successfully" : "Validation completed with errors",
      },
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    console.log("[CRON] Discord notification sent");
  } catch (error) {
    console.error("[CRON] Failed to send Discord notification:", error);
  }
}
