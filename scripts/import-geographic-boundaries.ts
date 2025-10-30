import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * ⚠️ DEPRECATION NOTICE ⚠️
 *
 * This script is superseded by `unify-world-roster-and-map-data.ts` which:
 * - Uses World-Roster.xlsx as the canonical source of truth for country areas
 * - Calculates IxEarth scale factor dynamically from matched countries
 * - Integrates all country data in a single unified import
 *
 * This script is kept for reference but should NOT be used for production imports.
 * Use unify-world-roster-and-map-data.ts instead.
 *
 * Original hardcoded scale factor (now deprecated): 1.183x
 * The actual scale factor should be calculated dynamically based on the ratio of:
 * - Total canonical areas from World Roster
 * - Total calculated areas from PostGIS geography
 */

interface ImportedCountry {
  name: string;
  geojson: any;
}

async function importGeographicData() {
  console.error("⚠️  This script is DEPRECATED!");
  console.error("⚠️  Please use: scripts/unify-world-roster-and-map-data.ts");
  console.error(
    "⚠️  That script calculates the scale factor dynamically from World Roster data.\n"
  );
  process.exit(1);

  try {
    // Check if temp table exists
    const tempTableCheck = await db.$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'temp_political_import'
      ) as exists
    `;

    if (!tempTableCheck[0].exists) {
      console.error("❌ Error: temp_political_import table not found.");
      console.log("Please run the ogr2ogr import first:");
      console.log("cd /ixwiki/public/projects/maps/scripting/geojson_4326");
      console.log(
        'ogr2ogr -f "PostgreSQL" PG:"host=localhost port=5433 dbname=ixstats user=postgres" political.geojson -nln temp_political_import -overwrite'
      );
      process.exit(1);
    }

    // Fetch imported GeoJSON data
    const importedCountries = await db.$queryRaw<ImportedCountry[]>`
      SELECT
        COALESCE(id, 'Unknown') as name,
        ST_AsGeoJSON(wkb_geometry)::json as geojson
      FROM temp_political_import
      WHERE wkb_geometry IS NOT NULL AND id IS NOT NULL
    `;

    console.log(`Found ${importedCountries.length} countries in GeoJSON import\n`);

    let matched = 0;
    let updated = 0;
    const unmatched: string[] = [];
    const errors: Array<{ country: string; error: string }> = [];

    for (const geoCountry of importedCountries) {
      try {
        // Fuzzy match to existing Country
        const existing = await db.country.findFirst({
          where: {
            OR: [
              { name: { equals: geoCountry.name, mode: "insensitive" } },
              { name: { contains: geoCountry.name, mode: "insensitive" } },
              { slug: { contains: geoCountry.name.toLowerCase().replace(/\s+/g, "-") } },
            ],
          },
          select: {
            id: true,
            name: true,
            currentPopulation: true,
            currentTotalGdp: true,
          },
        });

        if (existing) {
          matched++;

          // Calculate area and coastline using PostGIS
          // Note: PostGIS uses Earth's WGS84 ellipsoid, so we multiply by IxEarth scale factor
          const geoMetrics = await db.$queryRaw<
            [
              {
                area_sq_mi: number;
                area_sq_km: number;
                coastline_km: number;
                centroid: any;
                bbox: any;
              },
            ]
          >`
            WITH geom AS (
              SELECT ST_GeomFromGeoJSON(${JSON.stringify(geoCountry.geojson)}::text)::geography as geog
            )
            SELECT
              ROUND((ST_Area((SELECT geog FROM geom)) / 2589988.11 * ${IXEARTH_SCALE_FACTOR})::numeric, 2) as area_sq_mi,
              ROUND((ST_Area((SELECT geog FROM geom)) / 1000000 * ${IXEARTH_SCALE_FACTOR})::numeric, 2) as area_sq_km,
              ROUND((ST_Length(ST_Boundary((SELECT geog FROM geom)::geometry)) / 1000 * ${Math.sqrt(IXEARTH_SCALE_FACTOR)})::numeric, 2) as coastline_km,
              ST_AsGeoJSON(ST_Centroid((SELECT geog FROM geom)::geometry))::json as centroid,
              ARRAY[
                ST_XMin((SELECT geog FROM geom)::geometry),
                ST_YMin((SELECT geog FROM geom)::geometry),
                ST_XMax((SELECT geog FROM geom)::geometry),
                ST_YMax((SELECT geog FROM geom)::geometry)
              ] as bbox
          `;

          const { area_sq_mi, coastline_km, centroid, bbox } = geoMetrics[0];

          // Update country with geographic data
          await db.country.update({
            where: { id: existing.id },
            data: {
              geometry: geoCountry.geojson,
              centroid,
              boundingBox: bbox,
              areaSqMi: area_sq_mi,
              landArea: area_sq_mi,
              coastlineKm: coastline_km,
              // Recalculate density metrics
              populationDensity: existing.currentPopulation / area_sq_mi,
              gdpDensity: existing.currentTotalGdp / area_sq_mi,
            },
          });

          updated++;
          console.log(
            `✓ ${geoCountry.name.padEnd(30)} → ${existing.name.padEnd(30)} (${area_sq_mi.toLocaleString()} sq mi)`
          );
        } else {
          unmatched.push(geoCountry.name);
          console.log(`✗ ${geoCountry.name} - no match found`);
        }
      } catch (error) {
        errors.push({
          country: geoCountry.name,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`❌ Error processing ${geoCountry.name}: ${error}`);
      }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("✅ Import Summary:");
    console.log(`   Total in GeoJSON: ${importedCountries.length}`);
    console.log(`   Matched: ${matched}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Unmatched: ${unmatched.length}`);
    console.log(`   Errors: ${errors.length}`);

    if (unmatched.length > 0) {
      console.log(`\n⚠️  Unmatched countries (${unmatched.length}):`);
      unmatched.slice(0, 20).forEach((name) => console.log(`   - ${name}`));
      if (unmatched.length > 20) {
        console.log(`   ... and ${unmatched.length - 20} more`);
      }
    }

    if (errors.length > 0) {
      console.log(`\n❌ Errors (${errors.length}):`);
      errors.forEach(({ country, error }) => {
        console.log(`   - ${country}: ${error}`);
      });
    }

    console.log(`\n✅ Geographic data import complete!`);
  } catch (error) {
    console.error("❌ Fatal error during import:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

importGeographicData();
