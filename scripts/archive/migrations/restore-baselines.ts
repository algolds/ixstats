/**
 * Restore Country Baselines Script
 *
 * Compares database country baselines against public/World-Roster.xlsx.
 * If differences are found, it restores baseline fields and growth parameters.
 *
 * Usage:
 *   bun scripts/restore-baselines.ts             # Dry run (default)
 *   bun scripts/restore-baselines.ts --live      # Live updates
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import XLSX from "xlsx";

const db = new PrismaClient();
const WORLD_ROSTER_PATH = "/ixwiki/public/projects/ixstats/public/World-Roster.xlsx";

interface WorldRosterCountry {
  Country: string;
  Population: number;
  "GDP PC": number;
  "Area (sq mi)": number;
  "Max GDPPC Grow Rt": number;
  "Adj GDPPC Growth": number;
  "Pop Growth Rate": number;
  "Actual GDP Growth": number;
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const dryRun = !live;

  console.log("=== Restore Country Baselines and Growth Rates ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (no database writes)" : "LIVE (updating database)"}`);
  console.log(`Roster File: ${WORLD_ROSTER_PATH}\n`);

  if (!fs.existsSync(WORLD_ROSTER_PATH)) {
    console.error(`Error: File not found at ${WORLD_ROSTER_PATH}`);
    process.exit(1);
  }

  // Load workbook using buffer to avoid bun xlsx.readFile compatibility issues
  const buf = fs.readFileSync(WORLD_ROSTER_PATH);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("Error: Workbook has no sheets");
    process.exit(1);
  }
  const worksheet = workbook.Sheets[sheetName];
  const rosterData = XLSX.utils.sheet_to_json<WorldRosterCountry>(worksheet);

  // Map normalized country name to roster data
  const rosterMap = new Map<string, WorldRosterCountry>();
  for (const row of rosterData) {
    if (row.Country) {
      // Normalize name: trim trailing/leading whitespace
      const norm = row.Country.trim().toLowerCase();
      rosterMap.set(norm, row);
    }
  }

  // Fetch all countries in DB
  const dbCountries = await db.country.findMany({
    select: {
      id: true,
      name: true,
      baselinePopulation: true,
      baselineGdpPerCapita: true,
      populationGrowthRate: true,
      adjustedGdpGrowth: true,
      actualGdpGrowth: true,
      realGDPGrowthRate: true,
      maxGdpGrowthRate: true,
      inflationRate: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${dbCountries.length} countries in DB and ${rosterMap.size} in roster.\n`);

  let checkedCount = 0;
  let mismatchCount = 0;

  for (const country of dbCountries) {
    const normName = country.name.trim().toLowerCase();
    const rosterMatch = rosterMap.get(normName);

    if (!rosterMatch) {
      // Custom/new country or sandbox not in Excel
      continue;
    }

    checkedCount++;
    const expectedPop = Number(rosterMatch.Population);
    const expectedGdpPc = Number(rosterMatch["GDP PC"]);
    const expectedPopGrowth = Number(rosterMatch["Pop Growth Rate"]);
    const expectedGdpGrowth = Number(rosterMatch["Adj GDPPC Growth"]);
    const expectedActualGdpGrowth = Number(rosterMatch["Actual GDP Growth"]);
    const expectedMaxGdpGrowth = Number(rosterMatch["Max GDPPC Grow Rt"]);

    const popDiff = Math.abs(country.baselinePopulation - expectedPop);
    const gdpDiff = Math.abs(country.baselineGdpPerCapita - expectedGdpPc);
    const popGrowthDiff = Math.abs(country.populationGrowthRate - expectedPopGrowth);
    const gdpGrowthDiff = Math.abs(country.adjustedGdpGrowth - expectedGdpGrowth);

    // If difference in baselines OR growth parameters is significant
    if (popDiff > 1 || gdpDiff > 0.01 || popGrowthDiff > 0.0001 || gdpGrowthDiff > 0.0001) {
      mismatchCount++;
      console.log(`[MISMATCH] "${country.name}"`);
      console.log(
        `  Population Baseline: DB = ${country.baselinePopulation.toLocaleString()} | Excel = ${expectedPop.toLocaleString()}`
      );
      console.log(
        `  GDP/Capita Baseline: DB = $${country.baselineGdpPerCapita.toFixed(2)} | Excel = $${expectedGdpPc.toFixed(2)}`
      );
      console.log(
        `  Pop Growth Rate:     DB = ${(country.populationGrowthRate * 100).toFixed(4)}% | Excel = ${(expectedPopGrowth * 100).toFixed(4)}%`
      );
      console.log(
        `  GDP Growth Rate:     DB = ${(country.adjustedGdpGrowth * 100).toFixed(4)}% | Excel = ${(expectedGdpGrowth * 100).toFixed(4)}%`
      );

      if (!dryRun) {
        const correctProjected2040Gdp = expectedPop * expectedGdpPc;
        await db.country.update({
          where: { id: country.id },
          data: {
            baselinePopulation: expectedPop,
            baselineGdpPerCapita: expectedGdpPc,
            projected2040Population: expectedPop,
            projected2040GdpPerCapita: expectedGdpPc,
            projected2040Gdp: correctProjected2040Gdp,
            populationGrowthRate: expectedPopGrowth,
            adjustedGdpGrowth: expectedGdpGrowth,
            actualGdpGrowth: expectedActualGdpGrowth,
            realGDPGrowthRate: expectedGdpGrowth, // matching decimal format
            maxGdpGrowthRate: expectedMaxGdpGrowth,
            inflationRate: 0.02, // default 2%
          },
        });
        console.log(
          `  ✓ Restored all baselines, projections, and growth rates for ${country.name} in DB.`
        );
      } else {
        console.log(
          `  [DRY RUN] Would restore all baselines, projections, and growth rates for ${country.name}.`
        );
      }
      console.log("");
    }
  }

  console.log("=========================================");
  console.log(`Checked countries: ${checkedCount}`);
  console.log(`Mismatched countries: ${mismatchCount}`);
  console.log(`Mode: ${dryRun ? "DRY RUN - no database writes" : "LIVE - database updated"}`);
  console.log("=========================================");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error during execution:", err);
  process.exit(1);
});
