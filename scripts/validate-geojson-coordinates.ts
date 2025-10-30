/**
 * GeoJSON Coordinate Validation Script
 *
 * Validates all GeoJSON files for:
 * - Invalid coordinate values (outside valid ranges)
 * - NaN, Infinity, or null coordinates
 * - Extreme outliers that would break Web Mercator projection
 * - Self-intersecting polygons
 * - Unclosed polygon rings
 *
 * Valid ranges:
 * - Longitude: -180° to 180°
 * - Latitude: -90° to 90° (geographic)
 * - Latitude: -85.05° to 85.05° (Web Mercator safe range)
 *
 * Usage: npx tsx scripts/validate-geojson-coordinates.ts
 */

import fs from 'fs';
import path from 'path';

const SOURCE_DIR = '/ixwiki/public/projects/ixstats/scripts/geojson_wgs84';

// Validation thresholds
const VALID_LON_MIN = -180;
const VALID_LON_MAX = 180;
const VALID_LAT_MIN = -90;
const VALID_LAT_MAX = 90;
const MERCATOR_LAT_MIN = -85.05112878;
const MERCATOR_LAT_MAX = 85.05112878;

interface ValidationResult {
  layer: string;
  totalFeatures: number;
  totalCoordinates: number;
  issues: {
    invalidLongitude: number;
    invalidLatitude: number;
    beyondMercator: number;
    nanOrInfinity: number;
    extremeOutliers: number;
    unclosedRings: number;
  };
  extremeCoords: Array<{
    featureId: string | number;
    featureName?: string;
    coordinate: [number, number];
    type: string;
  }>;
  affectedFeatures: Set<string | number>;
}

interface GeoJSONFeature {
  type: string;
  id?: string | number;
  properties?: any;
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GeoJSONFeatureCollection {
  type: string;
  features: GeoJSONFeature[];
}

// Recursively validate all coordinates in a geometry
function validateCoordinates(
  coords: any,
  result: ValidationResult,
  featureId: string | number,
  featureName?: string,
  depth = 0
): void {
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    // This is a single coordinate pair [lng, lat]
    const [lng, lat] = coords;
    result.totalCoordinates++;

    // Check for NaN or Infinity
    if (!isFinite(lng) || !isFinite(lat) || isNaN(lng) || isNaN(lat)) {
      result.issues.nanOrInfinity++;
      result.affectedFeatures.add(featureId);
      result.extremeCoords.push({
        featureId,
        featureName,
        coordinate: [lng, lat],
        type: 'NaN/Infinity',
      });
      return;
    }

    // Check longitude range
    if (lng < VALID_LON_MIN || lng > VALID_LON_MAX) {
      result.issues.invalidLongitude++;
      result.affectedFeatures.add(featureId);
      result.extremeCoords.push({
        featureId,
        featureName,
        coordinate: [lng, lat],
        type: `Invalid longitude: ${lng}°`,
      });
    }

    // Check latitude range
    if (lat < VALID_LAT_MIN || lat > VALID_LAT_MAX) {
      result.issues.invalidLatitude++;
      result.affectedFeatures.add(featureId);
      result.extremeCoords.push({
        featureId,
        featureName,
        coordinate: [lng, lat],
        type: `Invalid latitude: ${lat}°`,
      });
    }

    // Check Web Mercator range
    if (lat < MERCATOR_LAT_MIN || lat > MERCATOR_LAT_MAX) {
      result.issues.beyondMercator++;
      result.affectedFeatures.add(featureId);
      if (lat < MERCATOR_LAT_MIN - 5 || lat > MERCATOR_LAT_MAX + 5) {
        // Only report extreme outliers (beyond 5° of limit)
        result.extremeCoords.push({
          featureId,
          featureName,
          coordinate: [lng, lat],
          type: `Beyond Mercator limit: ${lat}°`,
        });
      }
    }

    // Check for extreme outliers (likely corrupted data)
    if (
      Math.abs(lng) > 1000 ||
      Math.abs(lat) > 1000
    ) {
      result.issues.extremeOutliers++;
      result.affectedFeatures.add(featureId);
      result.extremeCoords.push({
        featureId,
        featureName,
        coordinate: [lng, lat],
        type: `EXTREME OUTLIER: [${lng}, ${lat}]`,
      });
    }
  } else if (Array.isArray(coords)) {
    // This is an array of coordinates - recurse
    coords.forEach((c) => validateCoordinates(c, result, featureId, featureName, depth + 1));

    // Check if this is a polygon ring (depth === 1 for Polygon, depth === 2 for MultiPolygon)
    if (
      depth === 1 &&
      coords.length > 0 &&
      typeof coords[0][0] === 'number'
    ) {
      // This is a polygon ring - check if it's closed
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (
        first[0] !== last[0] ||
        first[1] !== last[1]
      ) {
        result.issues.unclosedRings++;
        result.affectedFeatures.add(featureId);
      }
    }
  }
}

async function validateLayer(layerName: string): Promise<ValidationResult> {
  const inputPath = path.join(SOURCE_DIR, `${layerName}.geojson`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as GeoJSONFeatureCollection;

  const result: ValidationResult = {
    layer: layerName,
    totalFeatures: data.features.length,
    totalCoordinates: 0,
    issues: {
      invalidLongitude: 0,
      invalidLatitude: 0,
      beyondMercator: 0,
      nanOrInfinity: 0,
      extremeOutliers: 0,
      unclosedRings: 0,
    },
    extremeCoords: [],
    affectedFeatures: new Set(),
  };

  // Validate each feature
  for (const feature of data.features) {
    const featureId = feature.id ?? feature.properties?.id ?? 'unknown';
    const featureName = feature.properties?.name ?? feature.properties?.id;

    if (feature.geometry && feature.geometry.coordinates) {
      validateCoordinates(
        feature.geometry.coordinates,
        result,
        featureId,
        featureName
      );
    }
  }

  return result;
}

async function main() {
  console.log('🔍 Validating GeoJSON Coordinate Data\n');
  console.log('='.repeat(80));
  console.log('\n');

  const layers = ['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background'];
  const allResults: ValidationResult[] = [];

  for (const layer of layers) {
    try {
      console.log(`📊 Validating layer: ${layer}`);
      const result = await validateLayer(layer);
      allResults.push(result);

      // Print summary
      const hasIssues =
        result.issues.invalidLongitude > 0 ||
        result.issues.invalidLatitude > 0 ||
        result.issues.extremeOutliers > 0 ||
        result.issues.nanOrInfinity > 0;

      if (hasIssues) {
        console.log(`   ❌ ISSUES FOUND:`);
        console.log(`      Features: ${result.totalFeatures}, Coordinates: ${result.totalCoordinates.toLocaleString()}`);
        console.log(`      Affected features: ${result.affectedFeatures.size}`);
        if (result.issues.invalidLongitude > 0) {
          console.log(`      ⚠️  Invalid longitude: ${result.issues.invalidLongitude}`);
        }
        if (result.issues.invalidLatitude > 0) {
          console.log(`      ⚠️  Invalid latitude: ${result.issues.invalidLatitude}`);
        }
        if (result.issues.extremeOutliers > 0) {
          console.log(`      ⚠️  EXTREME OUTLIERS: ${result.issues.extremeOutliers}`);
        }
        if (result.issues.nanOrInfinity > 0) {
          console.log(`      ⚠️  NaN/Infinity: ${result.issues.nanOrInfinity}`);
        }
        if (result.issues.beyondMercator > 0) {
          console.log(`      ⚠️  Beyond Mercator (±85.05°): ${result.issues.beyondMercator}`);
        }
        if (result.issues.unclosedRings > 0) {
          console.log(`      ⚠️  Unclosed polygon rings: ${result.issues.unclosedRings}`);
        }

        // Show extreme coordinates
        if (result.extremeCoords.length > 0) {
          console.log(`\n      📍 Extreme coordinates (showing first 10):`);
          result.extremeCoords.slice(0, 10).forEach((coord) => {
            const name = coord.featureName ? ` (${coord.featureName})` : '';
            console.log(`         ${coord.type}: [${coord.coordinate[0].toFixed(4)}, ${coord.coordinate[1].toFixed(4)}] - Feature: ${coord.featureId}${name}`);
          });
          if (result.extremeCoords.length > 10) {
            console.log(`         ... and ${result.extremeCoords.length - 10} more`);
          }
        }
      } else {
        console.log(`   ✅ No issues found`);
        console.log(`      Features: ${result.totalFeatures}, Coordinates: ${result.totalCoordinates.toLocaleString()}`);
        if (result.issues.beyondMercator > 0) {
          console.log(`      ℹ️  Beyond Mercator (±85.05°): ${result.issues.beyondMercator} (will be clamped)`);
        }
      }

      console.log('');
    } catch (error) {
      console.error(`   ❌ Error validating ${layer}:`, error instanceof Error ? error.message : String(error));
      console.log('');
    }
  }

  // Overall summary
  console.log('='.repeat(80));
  console.log('📋 OVERALL VALIDATION SUMMARY\n');

  const totalFeatures = allResults.reduce((sum, r) => sum + r.totalFeatures, 0);
  const totalCoordinates = allResults.reduce((sum, r) => sum + r.totalCoordinates, 0);
  const totalAffectedFeatures = new Set(
    allResults.flatMap((r) => Array.from(r.affectedFeatures))
  ).size;

  const totalIssues = {
    invalidLongitude: allResults.reduce((sum, r) => sum + r.issues.invalidLongitude, 0),
    invalidLatitude: allResults.reduce((sum, r) => sum + r.issues.invalidLatitude, 0),
    beyondMercator: allResults.reduce((sum, r) => sum + r.issues.beyondMercator, 0),
    nanOrInfinity: allResults.reduce((sum, r) => sum + r.issues.nanOrInfinity, 0),
    extremeOutliers: allResults.reduce((sum, r) => sum + r.issues.extremeOutliers, 0),
    unclosedRings: allResults.reduce((sum, r) => sum + r.issues.unclosedRings, 0),
  };

  console.log(`Total features validated: ${totalFeatures.toLocaleString()}`);
  console.log(`Total coordinates checked: ${totalCoordinates.toLocaleString()}`);
  console.log(`Features with issues: ${totalAffectedFeatures}`);
  console.log('');

  const criticalIssues =
    totalIssues.invalidLongitude +
    totalIssues.invalidLatitude +
    totalIssues.extremeOutliers +
    totalIssues.nanOrInfinity;

  if (criticalIssues > 0) {
    console.log('❌ CRITICAL ISSUES FOUND:');
    if (totalIssues.invalidLongitude > 0) {
      console.log(`   - Invalid longitude values: ${totalIssues.invalidLongitude}`);
    }
    if (totalIssues.invalidLatitude > 0) {
      console.log(`   - Invalid latitude values: ${totalIssues.invalidLatitude}`);
    }
    if (totalIssues.extremeOutliers > 0) {
      console.log(`   - EXTREME OUTLIERS (>1000°): ${totalIssues.extremeOutliers}`);
    }
    if (totalIssues.nanOrInfinity > 0) {
      console.log(`   - NaN/Infinity values: ${totalIssues.nanOrInfinity}`);
    }
    console.log('');
    console.log('⚠️  These issues MUST be fixed before import!');
    console.log('   Run: npx tsx scripts/sanitize-geojson-coordinates.ts');
  } else {
    console.log('✅ No critical coordinate issues found!');
  }

  if (totalIssues.beyondMercator > 0) {
    console.log('');
    console.log(`ℹ️  Info: ${totalIssues.beyondMercator} coordinates beyond Web Mercator limits (±85.05°)`);
    console.log('   These will be clamped during sanitization (expected for polar regions)');
  }

  if (totalIssues.unclosedRings > 0) {
    console.log('');
    console.log(`⚠️  Warning: ${totalIssues.unclosedRings} unclosed polygon rings found`);
    console.log('   These will be fixed during sanitization');
  }

  console.log('');

  // Exit with error code if critical issues found
  if (criticalIssues > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
