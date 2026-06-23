import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// Re-create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedCardPacks() {
  console.log("📦 Seeding card packs...");

  if (process.env.NODE_ENV === "production") {
    console.log("ℹ️  Running card pack seeding in production mode (non-destructive)...");
  }

  try {
    // 1. Read JSON file
    const jsonPath = path.join(__dirname, "data", "card-packs.json");
    const fileContent = fs.readFileSync(jsonPath, "utf8");
    const packsData = JSON.parse(fileContent);

    // 2. Upsert all card packs
    let seededCount = 0;
    for (const pack of packsData) {
      const packPayload = {
        name: pack.name,
        description: pack.description,
        artwork: pack.artwork,
        packType: pack.packType,
        priceCredits: pack.priceCredits,
        cardCount: pack.cardCount,
        guaranteedRarity: pack.guaranteedRarity || null,
        isActive: pack.isActive,
        commonOdds: pack.commonOdds,
        uncommonOdds: pack.uncommonOdds,
        rareOdds: pack.rareOdds,
        ultraRareOdds: pack.ultraRareOdds,
        epicOdds: pack.epicOdds,
        legendaryOdds: pack.legendaryOdds,
        season: pack.season,
        cardType: pack.cardType,
        themeFilter: pack.themeFilter || undefined,
        limitedQuantity: pack.limitedQuantity,
        purchaseLimit: pack.purchaseLimit,
        expiresAt: pack.expiresAt ? new Date(pack.expiresAt) : null,
        pdsConfig: pack.pdsConfig || undefined,
      };

      await prisma.cardPack.upsert({
        where: { id: pack.id },
        update: packPayload,
        create: {
          id: pack.id,
          ...packPayload,
        },
      });
      console.log(`✨ Seeded card pack: ${pack.name} (${pack.packType})`);
      seededCount++;
    }

    console.log(`✅ Seeded ${seededCount} card packs successfully!`);
  } catch (error) {
    console.error("❌ Failed to seed card packs:", error);
    throw error;
  }
}

// Run immediately if executed directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith("card-packs.ts") || process.argv[1].endsWith("card-packs"))
) {
  seedCardPacks()
    .catch((error) => {
      console.error("❌ Direct card pack seeding execution failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
