/**
 * Achievement Card Seeds
 *
 * Seeds commemorative SPECIAL cards that are awarded for major achievements.
 * These cards cannot be obtained through packs or trading - only through achievement unlock.
 * Unlocks that happened before the cards existed are backfilled (the award used to fail with
 * "Card not found").
 *
 * Runs as part of `bun run db:seed`, or on its own: bun prisma/seeds/achievement-cards.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  COMMEMORATIVE_CARD_DEFINITIONS,
  listAchievementCardRewards,
} from "../../src/lib/achievements/card-rewards";
import { awardAchievementCard } from "../../src/lib/cards/card-service";

export async function seedAchievementCards(prisma: PrismaClient) {
  console.log("🎴 Seeding Achievement Commemorative Cards...\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const cardDef of COMMEMORATIVE_CARD_DEFINITIONS) {
    try {
      const data = {
        title: cardDef.title,
        description: cardDef.description,
        artwork: cardDef.artwork,
        rarity: cardDef.rarity,
        cardType: cardDef.cardType,
        category: cardDef.category,
        season: cardDef.season,
        stats: cardDef.stats,
        totalSupply: cardDef.totalSupply,
        marketValue: cardDef.marketValue,
      };

      // Check if card already exists
      const existing = await prisma.card.findUnique({
        where: { id: cardDef.id },
      });

      if (existing) {
        await prisma.card.update({
          where: { id: cardDef.id },
          data: { ...data, updatedAt: new Date() },
        });
        console.log(`✅ Updated: ${cardDef.title} (${cardDef.rarity})`);
        updated++;
      } else {
        await prisma.card.create({
          data: { id: cardDef.id, ...data },
        });
        console.log(`✨ Created: ${cardDef.title} (${cardDef.rarity})`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Failed to seed ${cardDef.title}:`, error);
      skipped++;
    }
  }

  // Backfill: grant the card to everyone who already holds the achievement but not the card
  let backfilled = 0;
  for (const { achievementId, cardId } of listAchievementCardRewards()) {
    const unlocks = await prisma.userAchievement.findMany({
      where: { achievementId },
      select: { userId: true, title: true },
    });
    for (const unlock of unlocks) {
      // UserAchievement.userId is the Clerk id; ownerships use the database id
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: unlock.userId }, { clerkUserId: unlock.userId }] },
        select: { id: true },
      });
      if (!user) continue;
      const owned = await prisma.cardOwnership.findFirst({
        where: { ownerId: user.id, cardId },
        select: { id: true },
      });
      if (owned) continue;
      try {
        await awardAchievementCard(prisma, user.id, cardId, achievementId, unlock.title);
        backfilled++;
      } catch (error) {
        console.error(`❌ Failed to backfill ${cardId} for ${user.id}:`, error);
      }
    }
  }

  console.log("\n📊 Achievement Card Seeding Summary:");
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Backfilled: ${backfilled}`);
  console.log(`   Total:   ${COMMEMORATIVE_CARD_DEFINITIONS.length}`);
  console.log("\n✅ Achievement card seeding complete!");
}

// Run if called directly (ES Module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  seedAchievementCards(prisma)
    .catch((error) => {
      console.error("❌ Achievement card seeding failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
