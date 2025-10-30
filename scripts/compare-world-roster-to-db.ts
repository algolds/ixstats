/**
 * Compare World Roster data to database
 * Identifies which countries are in World Roster vs database
 */
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const db = new PrismaClient();
const WORLD_ROSTER_PATH = "/ixwiki/public/projects/ixstats/public/World-Roster.xlsx";

interface WorldRosterCountry {
  Country: string;
  "Area (sq mi)": number;
  Population: number;
  "GDP PC": number;
}

async function compareData() {
  console.log("🔍 Comparing World Roster to Database\n");
  console.log("=".repeat(80));
  console.log("\n");

  // Read World Roster
  const workbook = XLSX.readFile(WORLD_ROSTER_PATH);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rosterData = XLSX.utils.sheet_to_json<WorldRosterCountry>(worksheet);

  // Filter valid countries (has name and area)
  const rosterCountries = rosterData.filter(
    (row) => row.Country && row["Area (sq mi)"] && row["Area (sq mi)"] > 0
  );

  console.log(`📊 World Roster: ${rosterCountries.length} valid countries\n`);

  // Get database countries
  const dbCountries = await db.country.findMany({
    select: {
      name: true,
      areaSqMi: true,
      currentPopulation: true,
    },
  });

  console.log(`💾 Database: ${dbCountries.length} countries\n`);
  console.log("=".repeat(80));
  console.log("\n");

  // Calculate totals
  let rosterTotalArea = 0;
  let dbTotalArea = 0;

  for (const country of rosterCountries) {
    rosterTotalArea += Number(country["Area (sq mi)"]);
  }

  for (const country of dbCountries) {
    dbTotalArea += country.areaSqMi;
  }

  console.log("📐 TOTALS\n");
  console.log(`   World Roster Total Area: ${rosterTotalArea.toLocaleString()} sq mi`);
  console.log(`   Database Total Area: ${dbTotalArea.toLocaleString()} sq mi`);
  console.log(`   Difference: ${Math.abs(rosterTotalArea - dbTotalArea).toLocaleString()} sq mi`);
  console.log(`   Database Coverage: ${((dbTotalArea / rosterTotalArea) * 100).toFixed(1)}%`);
  console.log("\n");

  // Create lookup maps
  const rosterMap = new Map();
  for (const country of rosterCountries) {
    const normalizedName = country.Country.toLowerCase().trim();
    rosterMap.set(normalizedName, {
      name: country.Country,
      area: Number(country["Area (sq mi)"]),
      population: Number(country.Population),
    });
  }

  const dbMap = new Map();
  for (const country of dbCountries) {
    const normalizedName = country.name.toLowerCase().trim();
    dbMap.set(normalizedName, {
      name: country.name,
      area: country.areaSqMi,
      population: country.currentPopulation,
    });
  }

  // Find matches and mismatches
  console.log("=".repeat(80));
  console.log("\n");
  console.log("🔍 MATCHING ANALYSIS\n");

  let perfectMatches = 0;
  let areaMismatches = [];
  let notInDb = [];
  let notInRoster = [];

  // Check roster countries
  for (const [key, rosterCountry] of rosterMap.entries()) {
    const dbCountry = dbMap.get(key);

    if (dbCountry) {
      const areaDiff = Math.abs(rosterCountry.area - dbCountry.area);
      const diffPercent = (areaDiff / rosterCountry.area) * 100;

      if (diffPercent < 0.01) {
        perfectMatches++;
      } else {
        areaMismatches.push({
          name: rosterCountry.name,
          rosterArea: rosterCountry.area,
          dbArea: dbCountry.area,
          diff: areaDiff,
          diffPercent,
        });
      }
    } else {
      notInDb.push(rosterCountry);
    }
  }

  // Check database countries not in roster
  for (const [key, dbCountry] of dbMap.entries()) {
    if (!rosterMap.has(key)) {
      notInRoster.push(dbCountry);
    }
  }

  console.log(`   ✅ Perfect Matches: ${perfectMatches}`);
  console.log(`   ⚠️  Area Mismatches: ${areaMismatches.length}`);
  console.log(`   ❌ In Roster, Not in DB: ${notInDb.length}`);
  console.log(`   ❓ In DB, Not in Roster: ${notInRoster.length}`);
  console.log("\n");

  if (areaMismatches.length > 0) {
    console.log("=".repeat(80));
    console.log("\n");
    console.log("⚠️  AREA MISMATCHES (Top 10)\n");
    areaMismatches
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10)
      .forEach((mismatch) => {
        console.log(`   ${mismatch.name}`);
        console.log(`      Roster: ${mismatch.rosterArea.toLocaleString()} sq mi`);
        console.log(`      DB: ${mismatch.dbArea.toLocaleString()} sq mi`);
        console.log(
          `      Diff: ${mismatch.diff.toLocaleString()} sq mi (${mismatch.diffPercent.toFixed(1)}%)`
        );
        console.log("");
      });
  }

  if (notInDb.length > 0) {
    console.log("=".repeat(80));
    console.log("\n");
    console.log(`❌ COUNTRIES IN ROSTER BUT NOT IN DATABASE (${notInDb.length})\n`);
    notInDb.slice(0, 20).forEach((country) => {
      console.log(
        `   ${country.name.padEnd(40)} ${country.area.toLocaleString().padStart(12)} sq mi`
      );
    });
    if (notInDb.length > 20) {
      console.log(`   ... and ${notInDb.length - 20} more`);
    }
    console.log("\n");
  }

  if (notInRoster.length > 0) {
    console.log("=".repeat(80));
    console.log("\n");
    console.log(`❓ COUNTRIES IN DATABASE BUT NOT IN ROSTER (${notInRoster.length})\n`);
    notInRoster.forEach((country) => {
      console.log(
        `   ${country.name.padEnd(40)} ${country.area.toLocaleString().padStart(12)} sq mi`
      );
    });
    console.log("\n");
  }

  console.log("=".repeat(80));
  console.log("\n");

  await db.$disconnect();
}

compareData().catch(console.error);
