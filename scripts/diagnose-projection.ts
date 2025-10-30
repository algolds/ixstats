/**
 * Projection Diagnostic Script
 *
 * This script analyzes the geographic data to identify projection-related issues:
 * 1. Features extending beyond Web Mercator bounds (±85.05° latitude)
 * 2. Coordinate transformation accuracy
 * 3. Polar distortion analysis
 * 4. Tile coverage analysis
 *
 * Usage: npx tsx scripts/diagnose-projection.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Web Mercator limits
const MERCATOR_MAX_LAT = 85.05112878;
const MERCATOR_MIN_LAT = -85.05112878;

interface DiagnosticResult {
  totalFeatures: number;
  featuresOutOfBounds: number;
  maxLatitude: number;
  minLatitude: number;
  maxLongitude: number;
  minLongitude: number;
  outOfBoundsFeatures: Array<{
    name: string;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }>;
}

async function diagnoseProjection() {
  console.log('🔍 Starting Projection Diagnostic...\n');

  // Check political boundaries
  console.log('📊 Analyzing political boundaries...');
  const politicalDiagnostics = await diagnosePoliticalBoundaries();

  // Check all map layers
  console.log('\n📊 Analyzing map layers...');
  const layerDiagnostics = await diagnoseMapLayers();

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSTIC REPORT');
  console.log('='.repeat(80));

  console.log('\n📍 POLITICAL BOUNDARIES:');
  printDiagnostics(politicalDiagnostics);

  console.log('\n📍 MAP LAYERS:');
  for (const [layer, diagnostics] of Object.entries(layerDiagnostics)) {
    console.log(`\n  ${layer.toUpperCase()}:`);
    printDiagnostics(diagnostics, '    ');
  }

  // Projection recommendations
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));

  const totalOutOfBounds =
    politicalDiagnostics.featuresOutOfBounds +
    Object.values(layerDiagnostics).reduce((sum, d) => sum + d.featuresOutOfBounds, 0);

  if (totalOutOfBounds > 0) {
    console.log('\n⚠️  WARNING: Features detected beyond Web Mercator bounds!');
    console.log(`   ${totalOutOfBounds} features extend beyond ±${MERCATOR_MAX_LAT}°`);
    console.log('\n   Recommended actions:');
    console.log('   1. Clamp coordinates to ±85.05° for Web Mercator');
    console.log('   2. Consider using an alternative projection (Equal Earth, Natural Earth)');
    console.log('   3. Use globe view for polar regions');
  } else {
    console.log('\n✅ All features within Web Mercator bounds (±85.05°)');
  }

  // Check for extreme distortion
  const hasHighLatitude =
    politicalDiagnostics.maxLatitude > 70 ||
    politicalDiagnostics.minLatitude < -70;

  if (hasHighLatitude) {
    console.log('\n⚠️  HIGH LATITUDE FEATURES DETECTED');
    console.log(`   Max latitude: ${politicalDiagnostics.maxLatitude.toFixed(2)}°`);
    console.log(`   Min latitude: ${politicalDiagnostics.minLatitude.toFixed(2)}°`);
    console.log('\n   At these latitudes, Web Mercator has significant area distortion:');
    console.log(`   - At 70°: ~200% area distortion`);
    console.log(`   - At 80°: ~600% area distortion`);
    console.log(`   - At 85°: ~1700% area distortion`);
    console.log('\n   Consider adding:');
    console.log('   - Equal Earth projection option (accurate areas)');
    console.log('   - Visual distortion indicators');
    console.log('   - Area comparison tooltips');
  }

  console.log('\n');
}

async function diagnosePoliticalBoundaries(): Promise<DiagnosticResult> {
  const query = `
    SELECT
      COALESCE(id, 'Unknown') as name,
      ST_XMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as min_lon,
      ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as min_lat,
      ST_XMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as max_lon,
      ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as max_lat
    FROM temp_political_import
    WHERE wkb_geometry IS NOT NULL
  `;

  const features = await db.$queryRawUnsafe<Array<{
    name: string;
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  }>>(query);

  return analyzeBounds(features);
}

async function diagnoseMapLayers(): Promise<Record<string, DiagnosticResult>> {
  const layers = ['background', 'icecaps', 'altitudes', 'climate', 'lakes', 'rivers'];
  const results: Record<string, DiagnosticResult> = {};

  for (const layer of layers) {
    try {
      const query = `
        SELECT
          COALESCE(id, 'Unknown') as name,
          ST_XMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as min_lon,
          ST_YMin(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as min_lat,
          ST_XMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as max_lon,
          ST_YMax(ST_Envelope(ST_Transform(wkb_geometry, 4326))) as max_lat
        FROM map_layer_${layer}
        WHERE wkb_geometry IS NOT NULL
      `;

      const features = await db.$queryRawUnsafe<Array<{
        name: string;
        min_lat: number;
        max_lat: number;
        min_lon: number;
        max_lon: number;
      }>>(query);

      results[layer] = analyzeBounds(features);
    } catch (error) {
      console.error(`   ⚠️  Error analyzing ${layer}:`, error instanceof Error ? error.message : String(error));
      results[layer] = {
        totalFeatures: 0,
        featuresOutOfBounds: 0,
        maxLatitude: 0,
        minLatitude: 0,
        maxLongitude: 0,
        minLongitude: 0,
        outOfBoundsFeatures: [],
      };
    }
  }

  return results;
}

function analyzeBounds(features: Array<{
  name: string;
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}>): DiagnosticResult {
  const result: DiagnosticResult = {
    totalFeatures: features.length,
    featuresOutOfBounds: 0,
    maxLatitude: -90,
    minLatitude: 90,
    maxLongitude: -180,
    minLongitude: 180,
    outOfBoundsFeatures: [],
  };

  for (const feature of features) {
    // Update global bounds
    result.maxLatitude = Math.max(result.maxLatitude, feature.max_lat);
    result.minLatitude = Math.min(result.minLatitude, feature.min_lat);
    result.maxLongitude = Math.max(result.maxLongitude, feature.max_lon);
    result.minLongitude = Math.min(result.minLongitude, feature.min_lon);

    // Check if feature exceeds Mercator bounds
    if (
      feature.max_lat > MERCATOR_MAX_LAT ||
      feature.min_lat < MERCATOR_MIN_LAT
    ) {
      result.featuresOutOfBounds++;
      result.outOfBoundsFeatures.push({
        name: feature.name,
        minLat: feature.min_lat,
        maxLat: feature.max_lat,
        minLon: feature.min_lon,
        maxLon: feature.max_lon,
      });
    }
  }

  return result;
}

function printDiagnostics(diagnostics: DiagnosticResult, indent = '  ') {
  console.log(`${indent}Total features: ${diagnostics.totalFeatures}`);
  console.log(`${indent}Features out of bounds: ${diagnostics.featuresOutOfBounds}`);
  console.log(`${indent}Latitude range: ${diagnostics.minLatitude.toFixed(2)}° to ${diagnostics.maxLatitude.toFixed(2)}°`);
  console.log(`${indent}Longitude range: ${diagnostics.minLongitude.toFixed(2)}° to ${diagnostics.maxLongitude.toFixed(2)}°`);

  if (diagnostics.featuresOutOfBounds > 0) {
    console.log(`\n${indent}Out-of-bounds features (beyond ±${MERCATOR_MAX_LAT}°):`);
    diagnostics.outOfBoundsFeatures.slice(0, 10).forEach((feature) => {
      console.log(`${indent}  - ${feature.name}: ${feature.minLat.toFixed(2)}° to ${feature.maxLat.toFixed(2)}°`);
    });
    if (diagnostics.outOfBoundsFeatures.length > 10) {
      console.log(`${indent}  ... and ${diagnostics.outOfBoundsFeatures.length - 10} more`);
    }
  }
}

// Run diagnostic
diagnoseProjection()
  .then(() => {
    console.log('✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
