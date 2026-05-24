/**
 * Setup PostGIS triggers for map_layers table.
 * Auto-syncs JSON geometry to PostGIS native geometry column.
 *
 * Run: npx tsx scripts/migrations/setup-map-triggers.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up PostGIS triggers for map_layers...");

  // Check PostGIS is available
  try {
    const result = await prisma.$queryRawUnsafe<{ postgis_version: string }[]>(
      "SELECT PostGIS_Version() as postgis_version"
    );
    console.log(`PostGIS version: ${result[0]?.postgis_version}`);
  } catch (error) {
    console.error("PostGIS extension not found. Attempting to create...");
    try {
      await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS postgis");
      console.log("PostGIS extension created.");
    } catch (err) {
      console.error("Failed to create PostGIS extension:", err);
      process.exit(1);
    }
  }

  // Create sync trigger function for map_layers
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_map_layer_geom()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.geometry IS NOT NULL THEN
        BEGIN
          NEW.geom_postgis = ST_GeomFromGeoJSON(NEW.geometry::text);
        EXCEPTION WHEN OTHERS THEN
          -- If geometry is invalid, set to NULL rather than failing
          NEW.geom_postgis = NULL;
          RAISE WARNING 'Invalid geometry for map_layer %: %', NEW.id, SQLERRM;
        END;
      ELSE
        NEW.geom_postgis = NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("Created sync_map_layer_geom() function");

  // Create trigger
  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS map_layer_geom_sync ON map_layers;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER map_layer_geom_sync
      BEFORE INSERT OR UPDATE OF geometry ON map_layers
      FOR EACH ROW EXECUTE FUNCTION sync_map_layer_geom();
  `);
  console.log("Created map_layer_geom_sync trigger");

  // Verify existing triggers on Country table
  const existingTriggers = await prisma.$queryRawUnsafe<
    { trigger_name: string; event_object_table: string }[]
  >(`
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE event_object_table IN ('Country', 'map_layers', 'territories', 'subdivisions', 'cities', 'points_of_interest')
    ORDER BY event_object_table, trigger_name
  `);

  console.log("\nActive PostGIS triggers:");
  for (const t of existingTriggers) {
    console.log(`  ${t.event_object_table}.${t.trigger_name}`);
  }

  // Verify table was created
  const tableCheck = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    "SELECT COUNT(*) as count FROM map_layers"
  );
  console.log(`\nmap_layers table exists with ${tableCheck[0]?.count} rows`);

  const editTableCheck = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    "SELECT COUNT(*) as count FROM map_edit_requests"
  );
  console.log(`map_edit_requests table exists with ${editTableCheck[0]?.count} rows`);

  console.log("\nDone! PostGIS triggers are set up.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
