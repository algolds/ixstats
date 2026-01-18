/**
 * Initialize Missing Country Data
 *
 * This script populates missing NationalIdentity and GovernmentStructure records
 * for countries that were created but never completed the builder process.
 *
 * Run with: npx tsx scripts/initialize-missing-country-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Starting country data initialization...\n");

  // Get all countries
  const countries = await prisma.country.findMany({
    select: {
      id: true,
      name: true,
      governmentType: true,
      leader: true,
      currentTotalGdp: true,
      nationalIdentity: true,
      governmentStructure: true,
    },
  });

  console.log(`📊 Found ${countries.length} total countries`);

  let identityCreated = 0;
  let governmentCreated = 0;

  // Initialize NationalIdentity for countries that don't have it
  for (const country of countries) {
    if (!country.nationalIdentity) {
      try {
        await prisma.nationalIdentity.create({
          data: {
            countryId: country.id,
            countryName: country.name,
            governmentType: country.governmentType || undefined,
            // Copy leader to a custom field if needed, or leave blank
            // Most other fields will be populated by users via the builder
          },
        });
        identityCreated++;
        console.log(`  ✅ Created NationalIdentity for: ${country.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create NationalIdentity for ${country.name}:`, error);
      }
    }
  }

  // Initialize GovernmentStructure for countries that don't have it
  for (const country of countries) {
    if (!country.governmentStructure) {
      try {
        const defaultBudget = country.currentTotalGdp
          ? Math.round(country.currentTotalGdp * 0.25) // Default to 25% of GDP
          : 1000000000; // Fallback to 1 billion

        await prisma.governmentStructure.create({
          data: {
            countryId: country.id,
            governmentName: `Government of ${country.name}`,
            governmentType: country.governmentType || "Other",
            totalBudget: defaultBudget,
            fiscalYear: "Calendar Year",
            budgetCurrency: "USD",
            // Optional fields left as defaults or null
            headOfState: country.leader || undefined,
          },
        });
        governmentCreated++;
        console.log(`  ✅ Created GovernmentStructure for: ${country.name}`);
      } catch (error) {
        console.error(`  ❌ Failed to create GovernmentStructure for ${country.name}:`, error);
      }
    }
  }

  console.log("\n📈 Initialization Summary:");
  console.log(`  - NationalIdentity records created: ${identityCreated}`);
  console.log(`  - GovernmentStructure records created: ${governmentCreated}`);
  console.log(`  - Total countries: ${countries.length}`);

  // Verify final counts
  const finalIdentityCount = await prisma.nationalIdentity.count();
  const finalGovernmentCount = await prisma.governmentStructure.count();

  console.log("\n✅ Final Database State:");
  console.log(`  - Countries with NationalIdentity: ${finalIdentityCount}/${countries.length}`);
  console.log(`  - Countries with GovernmentStructure: ${finalGovernmentCount}/${countries.length}`);

  if (finalIdentityCount === countries.length && finalGovernmentCount === countries.length) {
    console.log("\n🎉 SUCCESS: All countries have complete baseline data!");
  } else {
    console.log("\n⚠️  WARNING: Some countries still missing data. Review errors above.");
  }
}

main()
  .catch((error) => {
    console.error("❌ Fatal error during initialization:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
