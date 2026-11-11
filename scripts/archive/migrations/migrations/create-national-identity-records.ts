#!/usr/bin/env npx tsx
import { createPrismaClient } from "~/server/prisma-client";

/**
 * Create National Identity Records Migration Script
 *
 * This script creates NationalIdentity records for all countries that don't have them.
 * It populates basic information from the Country table.
 */

const prisma = createPrismaClient();

interface Country {
  id: string;
  name: string;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  currencyName?: string | null;
  currencySymbol?: string | null;
  countryCode?: string | null;
}

async function createNationalIdentityRecords() {
  console.log("🔄 Starting NationalIdentity record creation...");

  try {
    // Get all countries without NationalIdentity records
    const countriesWithoutIdentity = await prisma.country.findMany({
      where: {
        nationalIdentity: null,
      },
      select: {
        id: true,
        name: true,
        governmentType: true,
        religion: true,
        leader: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(
      `📊 Found ${countriesWithoutIdentity.length} countries without NationalIdentity records`
    );

    if (countriesWithoutIdentity.length === 0) {
      console.log("✅ All countries already have NationalIdentity records!");
      return;
    }

    // Create NationalIdentity records
    let successCount = 0;
    let errorCount = 0;

    for (const country of countriesWithoutIdentity) {
      try {
        await prisma.nationalIdentity.create({
          data: {
            countryId: country.id,
            countryName: country.name,
            officialName: country.name, // Use name as official name initially
            governmentType: country.governmentType || "republic", // Default to republic
            currency: "Currency", // Default currency
            currencySymbol: "$", // Default currency symbol
            isoCode: "", // Empty initially - can be filled via builder/editor
            // Leave other fields empty for now - they can be filled via the builder/editor
          },
        });
        successCount++;
        console.log(`✅ Created NationalIdentity for ${country.name}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to create NationalIdentity for ${country.name}:`, error);
      }
    }

    console.log("\n📊 Migration Results:");
    console.log(`  ✅ Successfully created: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total processed: ${countriesWithoutIdentity.length}`);

    if (errorCount === 0) {
      console.log("\n🎉 All NationalIdentity records created successfully!");
      console.log("💡 Next steps:");
      console.log(
        "  - Countries can now use the builder/editor to populate detailed national identity information"
      );
      console.log("  - Run the validation script to verify data consistency");
    } else {
      console.log("\n⚠️  Some records failed to create. Check the errors above.");
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  await createNationalIdentityRecords();
}

// Run the script
main().catch((error) => {
  console.error("💥 Script failed:", error);
  process.exit(1);
});
