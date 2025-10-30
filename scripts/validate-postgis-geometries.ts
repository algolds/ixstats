/**
 * PostGIS Geometry Validation Script
 *
 * Validates all imported map layer geometries in PostgreSQL:
 * - Checks ST_IsValid() for all geometries
 * - Verifies coordinate bounds (-180 to 180, -85.05 to 85.05)
 * - Checks for NULL geometries
 * - Validates SRID is 4326
 * - Checks geometry types
 * - Verifies spatial indexes exist
 *
 * Usage: DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" npx tsx scripts/validate-postgis-geometries.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MERCATOR_LAT_MIN = -85.05112878;
const MERCATOR_LAT_MAX = 85.05112878;

interface ValidationResult {
  layer: string;
  totalFeatures: number;
  nullGeometries: number;
  invalidGeometries: number;
  wrongSRID: number;
  outOfBounds: number;
  validGeometries: number;
  spatialIndexExists: boolean;
  geometryTypes: Record<string, number>;
  invalidFeatureIds: string[];
}

async function validateLayer(layerName: string): Promise<ValidationResult> {
  const tableName = `map_layer_${layerName}`;

  // Check if table exists
  const tableExists = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass('public."${tableName}"') IS NOT NULL as exists;`
  );

  if (!tableExists[0]?.exists) {
    throw new Error(`Table ${tableName} does not exist`);
  }

  // Get total feature count
  const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${tableName}";`
  );
  const totalFeatures = Number(countResult[0]?.count ?? 0);

  // Check for NULL geometries
  const nullGeomResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${tableName}" WHERE geometry IS NULL;`
  );
  const nullGeometries = Number(nullGeomResult[0]?.count ?? 0);

  // Check for invalid geometries using ST_IsValid()
  const invalidGeomResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${tableName}" WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry);`
  );
  const invalidGeometries = Number(invalidGeomResult[0]?.count ?? 0);

  // Check SRID
  const wrongSRIDResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${tableName}" WHERE geometry IS NOT NULL AND ST_SRID(geometry) != 4326;`
  );
  const wrongSRID = Number(wrongSRIDResult[0]?.count ?? 0);

  // Check for geometries beyond Web Mercator bounds
  const outOfBoundsResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "${tableName}"
     WHERE geometry IS NOT NULL AND (
       ST_YMax(ST_Envelope(geometry)) > ${MERCATOR_LAT_MAX} OR
       ST_YMin(ST_Envelope(geometry)) < ${MERCATOR_LAT_MIN}
     );`
  );
  const outOfBounds = Number(outOfBoundsResult[0]?.count ?? 0);

  // Get invalid feature IDs (for debugging)
  const invalidFeaturesResult = await db.$queryRawUnsafe<Array<{ country_id: string }>>(
    `SELECT COALESCE(country_id, ogc_fid::text) as country_id
     FROM "${tableName}"
     WHERE geometry IS NOT NULL AND NOT ST_IsValid(geometry)
     LIMIT 10;`
  );
  const invalidFeatureIds = invalidFeaturesResult.map((r) => r.country_id);

  // Get geometry types
  const geometryTypesResult = await db.$queryRawUnsafe<Array<{ type: string; count: bigint }>>(
    `SELECT ST_GeometryType(geometry) as type, COUNT(*) as count
     FROM "${tableName}"
     WHERE geometry IS NOT NULL
     GROUP BY ST_GeometryType(geometry)
     ORDER BY count DESC;`
  );
  const geometryTypes: Record<string, number> = {};
  geometryTypesResult.forEach((r) => {
    geometryTypes[r.type] = Number(r.count);
  });

  // Check for spatial index
  const spatialIndexResult = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
       AND tablename = '${tableName}'
       AND indexdef LIKE '%USING gist%'
     ) as exists;`
  );
  const spatialIndexExists = spatialIndexResult[0]?.exists ?? false;

  const validGeometries = totalFeatures - nullGeometries - invalidGeometries;

  return {
    layer: layerName,
    totalFeatures,
    nullGeometries,
    invalidGeometries,
    wrongSRID,
    outOfBounds,
    validGeometries,
    spatialIndexExists,
    geometryTypes,
    invalidFeatureIds,
  };
}

async function main() {
  console.log("🔍 Validating PostGIS Geometries\n");
  console.log("=".repeat(80));
  console.log("\n");

  const layers = ["political", "climate", "altitudes", "rivers", "lakes", "icecaps", "background"];
  const results: ValidationResult[] = [];

  for (const layer of layers) {
    try {
      console.log(`📊 Validating layer: ${layer}`);
      const result = await validateLayer(layer);
      results.push(result);

      const hasIssues =
        result.nullGeometries > 0 ||
        result.invalidGeometries > 0 ||
        result.wrongSRID > 0 ||
        result.outOfBounds > 0;

      if (hasIssues) {
        console.log(`   ❌ ISSUES FOUND:`);
        console.log(`      Total features: ${result.totalFeatures}`);
        console.log(`      Valid geometries: ${result.validGeometries}`);

        if (result.nullGeometries > 0) {
          console.log(`      ⚠️  NULL geometries: ${result.nullGeometries}`);
        }
        if (result.invalidGeometries > 0) {
          console.log(
            `      ⚠️  Invalid geometries (ST_IsValid = false): ${result.invalidGeometries}`
          );
          if (result.invalidFeatureIds.length > 0) {
            console.log(`         Invalid feature IDs: ${result.invalidFeatureIds.join(", ")}`);
          }
        }
        if (result.wrongSRID > 0) {
          console.log(`      ⚠️  Wrong SRID (not 4326): ${result.wrongSRID}`);
        }
        if (result.outOfBounds > 0) {
          console.log(`      ⚠️  Beyond Mercator bounds: ${result.outOfBounds}`);
        }
      } else {
        console.log(`   ✅ All geometries valid`);
        console.log(`      Total features: ${result.totalFeatures}`);
        console.log(`      Valid geometries: ${result.validGeometries}`);
      }

      // Show geometry types
      const typesList = Object.entries(result.geometryTypes)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");
      console.log(`      Geometry types: ${typesList}`);

      // Check spatial index
      if (result.spatialIndexExists) {
        console.log(`      ✅ Spatial index exists`);
      } else {
        console.log(`      ⚠️  Missing spatial index (performance will be poor!)`);
      }

      console.log("");
    } catch (error) {
      console.error(
        `   ❌ Error validating ${layer}:`,
        error instanceof Error ? error.message : String(error)
      );
      console.log("");
    }
  }

  // Overall summary
  console.log("=".repeat(80));
  console.log("📋 OVERALL VALIDATION SUMMARY\n");

  const totalFeatures = results.reduce((sum, r) => sum + r.totalFeatures, 0);
  const validGeometries = results.reduce((sum, r) => sum + r.validGeometries, 0);
  const totalIssues = {
    nullGeometries: results.reduce((sum, r) => sum + r.nullGeometries, 0),
    invalidGeometries: results.reduce((sum, r) => sum + r.invalidGeometries, 0),
    wrongSRID: results.reduce((sum, r) => sum + r.wrongSRID, 0),
    outOfBounds: results.reduce((sum, r) => sum + r.outOfBounds, 0),
  };

  const layersWithoutIndex = results.filter((r) => !r.spatialIndexExists).length;

  console.log(`Total features: ${totalFeatures.toLocaleString()}`);
  console.log(`Valid geometries: ${validGeometries.toLocaleString()}`);
  console.log("");

  const criticalIssues =
    totalIssues.nullGeometries + totalIssues.invalidGeometries + totalIssues.wrongSRID;

  if (criticalIssues > 0) {
    console.log("❌ CRITICAL ISSUES FOUND:");
    if (totalIssues.nullGeometries > 0) {
      console.log(`   - NULL geometries: ${totalIssues.nullGeometries}`);
    }
    if (totalIssues.invalidGeometries > 0) {
      console.log(`   - Invalid geometries: ${totalIssues.invalidGeometries}`);
    }
    if (totalIssues.wrongSRID > 0) {
      console.log(`   - Wrong SRID: ${totalIssues.wrongSRID}`);
    }
    console.log("");
    console.log("⚠️  These issues must be fixed before production use!");
  } else {
    console.log("✅ No critical geometry issues found!");
  }

  if (totalIssues.outOfBounds > 0) {
    console.log("");
    console.log(
      `⚠️  Warning: ${totalIssues.outOfBounds} features extend beyond Web Mercator bounds`
    );
    console.log("   This may cause issues with tile generation");
    console.log(
      "   Consider running clamp script: psql $DATABASE_URL -f scripts/clamp-mercator-coordinates.sql"
    );
  }

  if (layersWithoutIndex > 0) {
    console.log("");
    console.log(`⚠️  Performance Warning: ${layersWithoutIndex} layers missing spatial indexes`);
    console.log("   Vector tile generation will be VERY slow!");
    console.log("   Run: psql $DATABASE_URL -f scripts/create-vector-tile-indexes.sql");
  } else {
    console.log("");
    console.log("✅ All layers have spatial indexes (good performance expected)");
  }

  console.log("");

  // Exit with error if critical issues found
  if (criticalIssues > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
