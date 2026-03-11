/**
 * Fix Baseline Dates Script
 *
 * The World-Roster spreadsheet data is valid for IxTime 2040.
 * But baselineDate was stored as a real-world timestamp (2026-02-19),
 * causing the growth calculator to apply ~15 years of growth instead of ~1.2.
 *
 * This script:
 *  1. Sets baselineDate = IxTime January 1, 2040 for all countries
 *  2. Fixes projected2040* fields (baseline IS 2040, so projected = baseline)
 *
 * Usage:
 *   npx tsx scripts/fix-baseline-dates.ts             # Live fix
 *   npx tsx scripts/fix-baseline-dates.ts --dry-run    # Preview only
 */

process.env.SKIP_ENV_VALIDATION = "1";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// IxTime January 1, 2040 - the date the World-Roster data represents
const IXTIME_2040 = new Date("2040-01-01T00:00:00.000Z");

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("=== Fix Baseline Dates ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Target baselineDate: ${IXTIME_2040.toISOString()} (IxTime 2040)`);
  console.log("");

  // Show current state for sample countries
  const samples = await prisma.country.findMany({
    where: { name: { in: ["Urcea", "Caphiria", "Burgundie", "Cartadania", "Kiravia"] } },
    select: {
      name: true,
      baselineDate: true,
      baselinePopulation: true,
      currentPopulation: true,
      projected2040Population: true,
      baselineGdpPerCapita: true,
      currentGdpPerCapita: true,
      projected2040GdpPerCapita: true,
    },
    orderBy: { name: "asc" },
  });

  console.log("─── Before Fix (sample countries) ───");
  for (const c of samples) {
    console.log(`  ${c.name}:`);
    console.log(`    baselineDate:          ${c.baselineDate.toISOString()}`);
    console.log(`    baselinePopulation:    ${Math.round(c.baselinePopulation).toLocaleString()}`);
    console.log(`    currentPopulation:     ${Math.round(c.currentPopulation).toLocaleString()}`);
    console.log(`    projected2040Pop:      ${Math.round(c.projected2040Population).toLocaleString()}`);
    console.log(`    baselineGdpPerCapita:  $${c.baselineGdpPerCapita.toFixed(2)}`);
    console.log(`    currentGdpPerCapita:   $${c.currentGdpPerCapita.toFixed(2)}`);
    console.log(`    projected2040GdpPC:    $${c.projected2040GdpPerCapita.toFixed(2)}`);
  }
  console.log("");

  // Step 1: Update baselineDate for all countries
  console.log("─── Step 1: Update baselineDate to IxTime 2040 ───");
  const totalCountries = await prisma.country.count();
  console.log(`  Updating ${totalCountries} countries...`);

  if (!dryRun) {
    await prisma.country.updateMany({
      data: {
        baselineDate: IXTIME_2040,
        lastCalculated: IXTIME_2040,
      },
    });
    console.log(`  ✓ Updated baselineDate for ${totalCountries} countries`);
  } else {
    console.log(`  [DRY] Would update baselineDate for ${totalCountries} countries`);
  }

  // Step 2: Fix projected2040 fields
  // Since baseline data IS for 2040, projected2040 = baseline
  console.log("\n─── Step 2: Fix projected2040* fields ───");

  const allCountries = await prisma.country.findMany({
    select: {
      id: true,
      name: true,
      baselinePopulation: true,
      baselineGdpPerCapita: true,
      projected2040Population: true,
      projected2040Gdp: true,
      projected2040GdpPerCapita: true,
    },
    orderBy: { name: "asc" },
  });

  let fixedCount = 0;
  for (const c of allCountries) {
    const correctProjected2040Pop = c.baselinePopulation;
    const correctProjected2040GdpPC = c.baselineGdpPerCapita;
    const correctProjected2040Gdp = c.baselinePopulation * c.baselineGdpPerCapita;

    const popDiff = Math.abs(c.projected2040Population - correctProjected2040Pop);
    const needsFix = popDiff > 1000; // Only fix if significantly different

    if (needsFix) {
      if (!dryRun) {
        await prisma.country.update({
          where: { id: c.id },
          data: {
            projected2040Population: correctProjected2040Pop,
            projected2040Gdp: correctProjected2040Gdp,
            projected2040GdpPerCapita: correctProjected2040GdpPC,
          },
        });
      }
      fixedCount++;
    }
  }
  console.log(`  ${dryRun ? "[DRY] Would fix" : "✓ Fixed"} projected2040 fields for ${fixedCount}/${totalCountries} countries`);

  // Show what the corrected state will look like
  console.log("\n─── Expected Results After Sync ───");
  for (const c of samples) {
    const growthRate =
      (
        await prisma.country.findFirst({
          where: { name: c.name },
          select: { populationGrowthRate: true },
        })
      )?.populationGrowthRate || 0;

    // Approximate: ~1.2 years of growth from Jan 2040 to ~March 2041
    const yearsGrowth = 1.2;
    const expectedPop = c.baselinePopulation * Math.pow(1 + growthRate, yearsGrowth);
    console.log(
      `  ${c.name}: baseline ${Math.round(c.baselinePopulation).toLocaleString()} → ~${Math.round(expectedPop).toLocaleString()} (after ${yearsGrowth.toFixed(1)} years @ ${(growthRate * 100).toFixed(2)}%)`
    );
  }

  console.log("\n=== Done ===");
  console.log("Next step: run `npx tsx scripts/sync-current-stats.ts` to recalculate all current values");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
