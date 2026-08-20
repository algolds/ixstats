/**
 * Sync Current Stats Script
 *
 * Recalculates all country stats from baseline -> current IxTime
 * and updates the database. Use after server downtime to bring
 * cached current* values up to date.
 *
 * Usage:
 *   bunx tsx scripts/sync-current-stats.ts                  # Update all countries
 *   bunx tsx scripts/sync-current-stats.ts --dry-run        # Preview without writing
 *   bunx tsx scripts/sync-current-stats.ts --country "Name" # Update single country
 */

// Must be set before any imports that touch ~/env
process.env.SKIP_ENV_VALIDATION = "1";

import { PrismaClient } from "@prisma/client";
import { IxTime } from "../src/lib/ixtime";
import { IxStatsCalculator } from "../src/lib/calculations";
import { getDefaultEconomicConfig, getEconomicConfigFromDB } from "../src/lib/config-service";
import { calculateAllVitalityScores } from "../src/lib/vitality-calculator";
import type { BaseCountryData } from "../src/types/ixstats";

const prisma = new PrismaClient();

// --- Helpers duplicated from src/server/api/routers/countries.ts (private to router) ---

const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  return Math.min(Math.max(numValue, -0.5), 0.5);
};

const validateNumber = (value: number | null | undefined, max = 1e18, min = 0): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return min > 0 ? min : 0;
  return Math.min(Math.max(numValue, min), max);
};

const prepareBaseCountryData = (country: any): BaseCountryData => ({
  country: country.name,
  continent: country.continent,
  region: country.region,
  governmentType: country.governmentType,
  religion: country.religion,
  leader: country.leader,
  population: country.baselinePopulation,
  gdpPerCapita: country.baselineGdpPerCapita,
  landArea: country.landArea,
  areaSqMi: country.areaSqMi,
  maxGdpGrowthRate: validateGrowthRate(country.maxGdpGrowthRate),
  adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth),
  populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
  projected2040Population: country.projected2040Population || 0,
  projected2040Gdp: country.projected2040Gdp || 0,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
  actualGdpGrowth: validateGrowthRate(country.actualGdpGrowth),
  localGrowthFactor: country.localGrowthFactor || 1.0,
});

// --- Formatting helpers ---

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const fmtCurrency = (n: number) => "$" + fmtNum(n);

const fmtPct = (n: number) => (n * 100).toFixed(2) + "%";

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const countryIdx = args.indexOf("--country");
  const countryFilter = countryIdx >= 0 ? args[countryIdx + 1] : null;

  // IxTime diagnostics
  const now = IxTime.getCurrentIxTime();
  const nowDate = new Date(now);
  const yearsSinceEpoch = IxTime.getYearsSinceGameEpoch(now);
  const gameYear = IxTime.getCurrentGameYear(now);

  console.log("=== IxStats Current Stats Sync ===");
  console.log(`Real time:              ${new Date().toISOString()}`);
  console.log(`IxTime:                 ${nowDate.toISOString()}`);
  console.log(`Game year:              ${gameYear}`);
  console.log(`Years since epoch:      ${yearsSinceEpoch.toFixed(4)}`);
  console.log(`IxTime formatted:       ${IxTime.formatIxTime(now, true)}`);
  console.log(`Mode:                   ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  if (countryFilter) console.log(`Filter:                 ${countryFilter}`);
  console.log("");

  // Fetch countries
  const whereClause: any = countryFilter
    ? { name: { equals: countryFilter, mode: "insensitive" } }
    : {};

  const countries = await prisma.country.findMany({
    where: whereClause,
    include: {
      storytellerEffects: {
        where: { isActive: true },
        orderBy: { ixTimeTimestamp: "desc" as const },
      },
    },
    orderBy: { name: "asc" },
  });

  if (countries.length === 0) {
    console.log("No countries found.");
    return;
  }

  console.log(`Found ${countries.length} countries to process.\n`);

  // Read config from database (live wiring) with fallback to defaults
  const econCfg = await getEconomicConfigFromDB(prisma);
  const startTime = Date.now();
  let updated = 0;
  let errors = 0;

  for (const c of countries) {
    try {
      const calc = new IxStatsCalculator(econCfg, c.baselineDate.getTime());
      const base = prepareBaseCountryData(c);
      const baselineStats = calc.initializeCountryStats(base);

      const effects = (c.storytellerEffects as any[]).map((i: any) => ({
        ...i,
        ixTimeTimestamp: i.ixTimeTimestamp.getTime(),
      }));

      const res = calc.calculateTimeProgression(baselineStats, now, effects);

      const newData = {
        currentPopulation: validateNumber(res.newStats.currentPopulation, 1e11),
        currentGdpPerCapita: validateNumber(res.newStats.currentGdpPerCapita, 1e7, 1),
        currentTotalGdp: validateNumber(res.newStats.currentTotalGdp, 1e18, 1),
        economicTier: res.newStats.economicTier.toString(),
        populationTier: res.newStats.populationTier.toString(),
        adjustedGdpGrowth: validateGrowthRate(res.newStats.adjustedGdpGrowth),
        actualGdpGrowth: validateGrowthRate(res.newStats.actualGdpGrowth),
        populationGrowthRate: validateGrowthRate(res.newStats.populationGrowthRate),
        populationDensity: res.newStats.populationDensity
          ? validateNumber(res.newStats.populationDensity, 1e7)
          : null,
        gdpDensity: res.newStats.gdpDensity ? validateNumber(res.newStats.gdpDensity, 1e12) : null,
      };

      const vitalityScores = calculateAllVitalityScores({
        ...c,
        ...newData,
      });

      // Log before/after
      const lastCalc = c.lastCalculated
        ? new Date(c.lastCalculated).toISOString().split("T")[0]
        : "never";
      const popDelta =
        ((newData.currentPopulation - c.currentPopulation) / c.currentPopulation) * 100;
      const gdpDelta =
        ((newData.currentGdpPerCapita - c.currentGdpPerCapita) / c.currentGdpPerCapita) * 100;
      const totalGdpDelta =
        ((newData.currentTotalGdp - c.currentTotalGdp) / c.currentTotalGdp) * 100;

      console.log(`--- ${c.name} (last calculated: ${lastCalc}) ---`);
      console.log(
        `  Population:    ${fmtNum(c.currentPopulation).padStart(16)} -> ${fmtNum(newData.currentPopulation).padStart(16)}  (${popDelta >= 0 ? "+" : ""}${popDelta.toFixed(2)}%)`
      );
      console.log(
        `  GDP/Capita:    ${fmtCurrency(c.currentGdpPerCapita).padStart(16)} -> ${fmtCurrency(newData.currentGdpPerCapita).padStart(16)}  (${gdpDelta >= 0 ? "+" : ""}${gdpDelta.toFixed(2)}%)`
      );
      console.log(
        `  Total GDP:     ${fmtCurrency(c.currentTotalGdp).padStart(16)} -> ${fmtCurrency(newData.currentTotalGdp).padStart(16)}  (${totalGdpDelta >= 0 ? "+" : ""}${totalGdpDelta.toFixed(2)}%)`
      );
      console.log(
        `  Econ Tier:     ${c.economicTier.padStart(16)} -> ${newData.economicTier.padStart(16)}`
      );
      console.log(
        `  Pop Tier:      ${c.populationTier.padStart(16)} -> ${newData.populationTier.padStart(16)}`
      );
      console.log(
        `  Growth Rate:   ${fmtPct(c.adjustedGdpGrowth).padStart(16)} -> ${fmtPct(newData.adjustedGdpGrowth).padStart(16)}`
      );
      console.log("");

      if (!dryRun) {
        await prisma.country.update({
          where: { id: c.id },
          data: {
            currentPopulation: newData.currentPopulation,
            currentGdpPerCapita: newData.currentGdpPerCapita,
            currentTotalGdp: newData.currentTotalGdp,
            economicTier: newData.economicTier,
            populationTier: newData.populationTier,
            populationDensity: newData.populationDensity,
            gdpDensity: newData.gdpDensity,
            adjustedGdpGrowth: newData.adjustedGdpGrowth,
            actualGdpGrowth: newData.actualGdpGrowth,
            populationGrowthRate: newData.populationGrowthRate,
            economicVitality: vitalityScores.economicVitality,
            populationWellbeing: vitalityScores.populationWellbeing,
            diplomaticStanding: vitalityScores.diplomaticStanding,
            governmentalEfficiency: vitalityScores.governmentalEfficiency,
            overallNationalHealth: vitalityScores.overallNationalHealth,
            lastCalculated: new Date(now),
          },
        });

        await prisma.historicalDataPoint.create({
          data: {
            countryId: c.id,
            ixTimeTimestamp: new Date(now),
            population: newData.currentPopulation,
            gdpPerCapita: newData.currentGdpPerCapita,
            totalGdp: newData.currentTotalGdp,
            populationGrowthRate: newData.populationGrowthRate,
            gdpGrowthRate: newData.adjustedGdpGrowth,
            landArea: c.landArea,
            populationDensity: newData.populationDensity,
            gdpDensity: newData.gdpDensity,
          },
        });
      }

      updated++;
    } catch (error) {
      console.error(
        `ERROR processing ${c.name}: ${error instanceof Error ? error.message : String(error)}`
      );
      errors++;
    }
  }

  // Create calculation log
  if (!dryRun && updated > 0) {
    try {
      await prisma.calculationLog.create({
        data: {
          timestamp: new Date(),
          ixTimeTimestamp: new Date(now),
          countriesUpdated: updated,
          executionTimeMs: Date.now() - startTime,
          globalGrowthFactor: econCfg.globalGrowthFactor,
          notes: `Stats sync after server downtime (~63 days). Updated ${updated} countries.`,
        },
      });
    } catch (error) {
      console.warn("Failed to create calculation log:", error);
    }
  }

  console.log("=== Summary ===");
  console.log(`Countries processed: ${updated}`);
  console.log(`Errors:              ${errors}`);
  console.log(`Execution time:      ${Date.now() - startTime}ms`);
  console.log(
    `Mode:                ${dryRun ? "DRY RUN - no changes written" : "LIVE - database updated"}`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Fatal error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
