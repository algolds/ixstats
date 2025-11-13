/**
 * Achievement Card Seeds
 *
 * Seeds commemorative SPECIAL cards that are awarded for major achievements.
 * These cards cannot be obtained through packs or trading - only through achievement unlock.
 *
 * Run with: tsx prisma/seeds/achievement-cards.ts
 */

import { PrismaClient } from "@prisma/client";
import { COMMEMORATIVE_CARD_DEFINITIONS } from "../../src/lib/achievement-card-rewards";

const prisma = new PrismaClient();

async function main() {
  console.log("🎴 Seeding Achievement Commemorative Cards...\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const cardDef of COMMEMORATIVE_CARD_DEFINITIONS) {
    try {
      // Check if card already exists
      const existing = await prisma.card.findUnique({
        where: { id: cardDef.id },
      });

      if (existing) {
        // Update existing card
        await prisma.card.update({
          where: { id: cardDef.id },
          data: {
            title: cardDef.title,
            description: cardDef.description,
            artwork: cardDef.artwork,
            rarity: cardDef.rarity,
            cardType: cardDef.cardType,
            season: cardDef.season,
            stats: cardDef.stats,
            totalSupply: cardDef.totalSupply,
            marketValue: cardDef.marketValue,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ Updated: ${cardDef.title} (${cardDef.rarity})`);
        updated++;
      } else {
        // Create new card
        await prisma.card.create({
          data: {
            id: cardDef.id,
            title: cardDef.title,
            description: cardDef.description,
            artwork: cardDef.artwork,
            rarity: cardDef.rarity,
            cardType: cardDef.cardType,
            season: cardDef.season,
            stats: cardDef.stats,
            totalSupply: cardDef.totalSupply,
            marketValue: cardDef.marketValue,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`✨ Created: ${cardDef.title} (${cardDef.rarity})`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Failed to seed ${cardDef.title}:`, error);
      skipped++;
    }
  }

  console.log("\n📊 Achievement Card Seeding Summary:");
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${COMMEMORATIVE_CARD_DEFINITIONS.length}`);
  console.log("\n✅ Achievement card seeding complete!");
}

main()
  .catch((error) => {
    console.error("❌ Achievement card seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
