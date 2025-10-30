#!/usr/bin/env tsx
/**
 * PostgreSQL to SQLite Production Sync Script
 *
 * Synchronizes geographic data from PostgreSQL to SQLite prod.db
 * - Adds new geographic columns to Country table (geometry, centroid, boundingBox, coastlineKm)
 * - Creates Territory and BorderHistory tables if they don't exist
 * - Copies all countries with geographic data from PostgreSQL to prod.db
 * - Preserves all existing data while updating geographic fields
 */

import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create SQLite connection using better-sqlite3
const sqlitePath = join(__dirname, "../prisma/prod.db");
const sqlite = new Database(sqlitePath, { readonly: false });

// Create PostgreSQL client
const postgres = new PrismaClient({
  datasourceUrl: "postgresql://postgres:postgres@localhost:5433/ixstats",
});

// Sync statistics
const stats = {
  countriesWithGeometry: 0,
  countriesUpdated: 0,
  countriesSkipped: 0,
  territoriesCreated: 0,
  borderHistoryCreated: 0,
  errors: [] as Array<{ country: string; error: string }>,
};

/**
 * Step 1: Alter Country table to add new geographic columns
 */
async function addGeographicColumns() {
  console.log("\n📐 Step 1: Adding geographic columns to Country table...");

  try {
    // Check if columns already exist
    const tableInfo = sqlite.prepare("PRAGMA table_info(Country)").all() as Array<{ name: string }>;
    const existingColumns = new Set(tableInfo.map((col) => col.name));

    const columnsToAdd = [
      { name: "geometry", type: "TEXT" },
      { name: "centroid", type: "TEXT" },
      { name: "boundingBox", type: "TEXT" },
      { name: "coastlineKm", type: "REAL" },
    ];

    for (const column of columnsToAdd) {
      if (existingColumns.has(column.name)) {
        console.log(`   ⏭️  Column '${column.name}' already exists, skipping`);
      } else {
        const sql = `ALTER TABLE Country ADD COLUMN ${column.name} ${column.type}`;
        sqlite.prepare(sql).run();
        console.log(`   ✓ Added column '${column.name}' (${column.type})`);
      }
    }

    console.log("✅ Geographic columns ready");
  } catch (error) {
    console.error("❌ Error adding geographic columns:", error);
    throw error;
  }
}

/**
 * Step 2: Create Territory table if it doesn't exist
 */
async function createTerritoryTable() {
  console.log("\n🗺️  Step 2: Creating Territory table...");

  try {
    // Check if table exists
    const tableExists = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='territories'")
      .get();

    if (tableExists) {
      console.log('   ⏭️  Table "territories" already exists, skipping');
      return;
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS "territories" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "countryId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "geometry" TEXT NOT NULL,
        "isMainland" INTEGER NOT NULL DEFAULT 0,
        "areaSqKm" REAL,
        FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE
      )
    `;

    sqlite.prepare(sql).run();

    // Create indexes
    sqlite
      .prepare(
        'CREATE INDEX IF NOT EXISTS "territories_countryId_idx" ON "territories"("countryId")'
      )
      .run();

    console.log("✅ Territory table created");
  } catch (error) {
    console.error("❌ Error creating Territory table:", error);
    throw error;
  }
}

/**
 * Step 3: Create BorderHistory table if it doesn't exist
 */
async function createBorderHistoryTable() {
  console.log("\n📜 Step 3: Creating BorderHistory table...");

  try {
    // Check if table exists
    const tableExists = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='border_history'")
      .get();

    if (tableExists) {
      console.log('   ⏭️  Table "border_history" already exists, skipping');
      return;
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS "border_history" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "countryId" TEXT NOT NULL,
        "geometry" TEXT NOT NULL,
        "changedBy" TEXT NOT NULL,
        "changedAt" INTEGER NOT NULL,
        "reason" TEXT,
        "oldAreaSqMi" REAL,
        "newAreaSqMi" REAL,
        "areaDeltaSqMi" REAL,
        FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE
      )
    `;

    sqlite.prepare(sql).run();

    // Create indexes
    sqlite
      .prepare(
        'CREATE INDEX IF NOT EXISTS "border_history_countryId_changedAt_idx" ON "border_history"("countryId", "changedAt")'
      )
      .run();

    console.log("✅ BorderHistory table created");
  } catch (error) {
    console.error("❌ Error creating BorderHistory table:", error);
    throw error;
  }
}

/**
 * Step 4: Sync country data from PostgreSQL to SQLite
 */
async function syncCountryData() {
  console.log("\n🔄 Step 4: Syncing country data from PostgreSQL to SQLite...");

  try {
    // Fetch all countries with geographic data from PostgreSQL
    const pgCountries = await postgres.country.findMany({
      where: {
        geometry: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        geometry: true,
        centroid: true,
        boundingBox: true,
        coastlineKm: true,
        areaSqMi: true,
      },
    });

    console.log(`\nFound ${pgCountries.length} countries with geometry in PostgreSQL\n`);
    stats.countriesWithGeometry = pgCountries.length;

    // Prepare SQLite update statement
    const updateStmt = sqlite.prepare(`
      UPDATE Country
      SET
        geometry = ?,
        centroid = ?,
        boundingBox = ?,
        coastlineKm = ?,
        areaSqMi = ?
      WHERE id = ?
    `);

    // Use a transaction for better performance
    const updateMany = sqlite.transaction((countries) => {
      for (const country of countries) {
        try {
          // Serialize JSON fields to strings for SQLite
          const geometryJson = country.geometry ? JSON.stringify(country.geometry) : null;
          const centroidJson = country.centroid ? JSON.stringify(country.centroid) : null;
          const boundingBoxJson = country.boundingBox ? JSON.stringify(country.boundingBox) : null;

          const result = updateStmt.run(
            geometryJson,
            centroidJson,
            boundingBoxJson,
            country.coastlineKm,
            country.areaSqMi,
            country.id
          );

          if (result.changes > 0) {
            stats.countriesUpdated++;
            const areaSqMi = country.areaSqMi?.toLocaleString() || "N/A";
            const coastlineKm = country.coastlineKm?.toLocaleString() || "N/A";
            console.log(
              `   ✓ ${country.name.padEnd(35)} → ${areaSqMi.padStart(12)} sq mi, ${coastlineKm.padStart(10)} km coastline`
            );
          } else {
            stats.countriesSkipped++;
            console.log(`   ⏭️  ${country.name} - not found in SQLite, skipped`);
          }
        } catch (error) {
          stats.errors.push({
            country: country.name,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`   ❌ ${country.name} - ${error}`);
        }
      }
    });

    // Execute the transaction
    updateMany(pgCountries);

    console.log("\n✅ Country data sync complete");
  } catch (error) {
    console.error("❌ Error syncing country data:", error);
    throw error;
  }
}

/**
 * Step 5: Sync Territory data (if any exists in PostgreSQL)
 */
async function syncTerritoryData() {
  console.log("\n🏝️  Step 5: Syncing Territory data...");

  try {
    // Fetch all territories from PostgreSQL
    const pgTerritories = await postgres.territory.findMany({
      select: {
        id: true,
        countryId: true,
        name: true,
        geometry: true,
        isMainland: true,
        areaSqKm: true,
      },
    });

    if (pgTerritories.length === 0) {
      console.log("   ⏭️  No territories found in PostgreSQL, skipping");
      return;
    }

    console.log(`\nFound ${pgTerritories.length} territories in PostgreSQL`);

    // Prepare SQLite insert statement
    const insertStmt = sqlite.prepare(`
      INSERT OR REPLACE INTO territories (id, countryId, name, geometry, isMainland, areaSqKm)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((territories) => {
      for (const territory of territories) {
        try {
          const geometryJson = JSON.stringify(territory.geometry);
          insertStmt.run(
            territory.id,
            territory.countryId,
            territory.name,
            geometryJson,
            territory.isMainland ? 1 : 0,
            territory.areaSqKm
          );
          stats.territoriesCreated++;
        } catch (error) {
          console.error(`   ❌ ${territory.name} - ${error}`);
        }
      }
    });

    insertMany(pgTerritories);

    console.log(`✅ Synced ${stats.territoriesCreated} territories`);
  } catch (error) {
    console.error("❌ Error syncing territory data:", error);
    throw error;
  }
}

/**
 * Step 6: Sync BorderHistory data (if any exists in PostgreSQL)
 */
async function syncBorderHistoryData() {
  console.log("\n📝 Step 6: Syncing BorderHistory data...");

  try {
    // Fetch all border history records from PostgreSQL
    const pgBorderHistory = await postgres.borderHistory.findMany({
      select: {
        id: true,
        countryId: true,
        geometry: true,
        changedBy: true,
        changedAt: true,
        reason: true,
        oldAreaSqMi: true,
        newAreaSqMi: true,
        areaDeltaSqMi: true,
      },
    });

    if (pgBorderHistory.length === 0) {
      console.log("   ⏭️  No border history found in PostgreSQL, skipping");
      return;
    }

    console.log(`\nFound ${pgBorderHistory.length} border history records in PostgreSQL`);

    // Prepare SQLite insert statement
    const insertStmt = sqlite.prepare(`
      INSERT OR REPLACE INTO border_history (id, countryId, geometry, changedBy, changedAt, reason, oldAreaSqMi, newAreaSqMi, areaDeltaSqMi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        try {
          const geometryJson = JSON.stringify(record.geometry);
          insertStmt.run(
            record.id,
            record.countryId,
            geometryJson,
            record.changedBy,
            record.changedAt.getTime(),
            record.reason,
            record.oldAreaSqMi,
            record.newAreaSqMi,
            record.areaDeltaSqMi
          );
          stats.borderHistoryCreated++;
        } catch (error) {
          console.error(`   ❌ Record ${record.id} - ${error}`);
        }
      }
    });

    insertMany(pgBorderHistory);

    console.log(`✅ Synced ${stats.borderHistoryCreated} border history records`);
  } catch (error) {
    console.error("❌ Error syncing border history data:", error);
    throw error;
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log("🚀 PostgreSQL → SQLite Geographic Data Sync");
  console.log("=".repeat(80));

  try {
    // Step 1: Add geographic columns to Country table
    await addGeographicColumns();

    // Step 2: Create Territory table
    await createTerritoryTable();

    // Step 3: Create BorderHistory table
    await createBorderHistoryTable();

    // Step 4: Sync country data
    await syncCountryData();

    // Step 5: Sync territory data
    await syncTerritoryData();

    // Step 6: Sync border history data
    await syncBorderHistoryData();

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("✅ Sync Summary:");
    console.log(`   Countries with geometry in PostgreSQL: ${stats.countriesWithGeometry}`);
    console.log(`   Countries updated in SQLite: ${stats.countriesUpdated}`);
    console.log(`   Countries skipped (not found): ${stats.countriesSkipped}`);
    console.log(`   Territories synced: ${stats.territoriesCreated}`);
    console.log(`   Border history records synced: ${stats.borderHistoryCreated}`);
    console.log(`   Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (${stats.errors.length}):`);
      stats.errors.forEach(({ country, error }) => {
        console.log(`   - ${country}: ${error}`);
      });
    }

    console.log("\n✅ Geographic data sync complete!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ Fatal error during sync:", error);
    process.exit(1);
  } finally {
    sqlite.close();
    await postgres.$disconnect();
  }
}

// Run the sync
main();
