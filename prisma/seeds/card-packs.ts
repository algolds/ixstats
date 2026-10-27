import { PrismaClient } from "@prisma/client";
import type { CardType, PackType, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// Re-create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeedPack {
  id: string;
  name: string;
  description: string | null;
  artwork: string | null;
  packType: PackType;
  priceCredits: number;
  cardCount: number;
  guaranteedRarity: string | null;
  isActive: boolean;
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
  season: number | null;
  cardType: CardType | null;
  themeFilter: Prisma.InputJsonValue | null;
  limitedQuantity: number | null;
  purchaseLimit: number | null;
  expiresAt: string | null;
  /** The pack art recipe for scripts/setup/generate-pack-assets.ts; there is no such column. */
  pdsConfig?: Prisma.InputJsonValue;
}

/**
 * Creates the packs the database lacks and leaves every existing pack as an admin edited it (cards refresh §3).
 */
export async function seedCardPacks() {
  console.log("📦 Seeding card packs (create-only)...");

  try {
    const jsonPath = path.join(__dirname, "data", "card-packs.json");
    const packs = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as SeedPack[];
    const { count } = await prisma.cardPack.createMany({
      data: packs.map(({ themeFilter, expiresAt, pdsConfig: _art, ...pack }) => ({
        ...pack,
        themeFilter: themeFilter ?? undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })),
      skipDuplicates: true,
    });
    console.log(
      `✅ Created ${count} card pack(s); ${packs.length - count} already existed and were left alone.`
    );
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
