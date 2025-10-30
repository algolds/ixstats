/**
 * Smart Dateline Geometry Fixer
 *
 * Fixes geometries that cross or are near the dateline without breaking topology.
 *
 * Strategy:
 * 1. For geometries where ALL coordinates are >180° (e.g., Oyashima at 183°):
 *    - Subtract 360° from ALL coordinates to move to equivalent negative longitude
 *    - This preserves the geometry topology perfectly
 *
 * 2. For geometries that actually cross the dateline (some >180°, some <180°):
 *    - Leave them as-is or use more sophisticated splitting
 *
 * This avoids the topology errors from ogr2ogr -wrapdateline while fixing
 * the world-spanning geometry issue.
 */

import fs from 'fs';
import path from 'path';

const SOURCE_DIR = '/ixwiki/public/projects/ixstats/scripts/geojson_wgs84';
const OUTPUT_DIR = '/ixwiki/public/projects/ixstats/scripts/geojson_dateline_fixed';

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

/**
 * Recursively shift all coordinates in a coordinate array by subtracting 360
 */
function shiftCoordinates(coords: any): any {
  if (!Array.isArray(coords)) {
    return coords;
  }

  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    // This is a single coordinate pair [lng, lat]
    return [coords[0] - 360, coords[1]];
  } else {
    // This is an array of coordinates - recurse
    return coords.map(c => shiftCoordinates(c));
  }
}

/**
 * Fix MultiPolygon geometries by processing each polygon separately
 */
function fixMultiPolygonCoordinates(multiPolygonCoords: any[]): any[] {
  return multiPolygonCoords.map(polygon => {
    // Check bounds of this specific polygon
    const bounds = getCoordinateBounds(polygon);

    // If this polygon is entirely >180°, shift it by -360°
    if (bounds.minLon > 180) {
      return shiftCoordinates(polygon);
    }

    // Otherwise leave as-is
    return polygon;
  });
}

/**
 * Fix Polygon geometries (single polygon)
 */
function fixPolygonCoordinates(polygonCoords: any[]): any[] {
  const bounds = getCoordinateBounds(polygonCoords);

  // If entirely >180°, shift by -360°
  if (bounds.minLon > 180) {
    return shiftCoordinates(polygonCoords);
  }

  return polygonCoords;
}

/**
 * Recursively find min/max longitude in a coordinate array
 */
function getCoordinateBounds(coords: any): { minLon: number; maxLon: number } {
  if (!Array.isArray(coords)) {
    return { minLon: Infinity, maxLon: -Infinity };
  }

  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    // This is a single coordinate pair [lng, lat]
    return { minLon: coords[0], maxLon: coords[0] };
  } else {
    // This is an array of coordinates - recurse
    const bounds = coords.map(c => getCoordinateBounds(c));
    return {
      minLon: Math.min(...bounds.map(b => b.minLon)),
      maxLon: Math.max(...bounds.map(b => b.maxLon)),
    };
  }
}

async function fixLayer(layerName: string): Promise<void> {
  const inputPath = path.join(SOURCE_DIR, `${layerName}.geojson`);
  const outputPath = path.join(OUTPUT_DIR, `${layerName}.geojson`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as GeoJSONFeatureCollection;

  let featuresFixed = 0;
  let polygonsShifted = 0;

  // Process each feature
  const fixedFeatures = data.features.map((feature) => {
    const featureId = feature.id ?? feature.properties?.id ?? 'unknown';

    if (feature.geometry && feature.geometry.coordinates) {
      let fixedCoordinates;
      let wasFixed = false;
      let shiftedCount = 0;

      if (feature.geometry.type === 'MultiPolygon') {
        const originalCoords = feature.geometry.coordinates;
        fixedCoordinates = fixMultiPolygonCoordinates(originalCoords);

        // Count how many polygons were shifted
        originalCoords.forEach((polygon, i) => {
          const origBounds = getCoordinateBounds(polygon);
          const fixedBounds = getCoordinateBounds(fixedCoordinates[i]);
          if (Math.abs(origBounds.minLon - fixedBounds.minLon) > 1) {
            shiftedCount++;
          }
        });

        if (shiftedCount > 0) {
          console.log(`  🔄 Fixed ${featureId}: ${shiftedCount}/${originalCoords.length} polygons shifted by -360°`);
          wasFixed = true;
          polygonsShifted += shiftedCount;
        }
      } else if (feature.geometry.type === 'Polygon') {
        const originalCoords = feature.geometry.coordinates;
        fixedCoordinates = fixPolygonCoordinates(originalCoords);

        const origBounds = getCoordinateBounds(originalCoords);
        const fixedBounds = getCoordinateBounds(fixedCoordinates);

        if (Math.abs(origBounds.minLon - fixedBounds.minLon) > 1) {
          console.log(`  🔄 Fixed ${featureId}: ${origBounds.minLon.toFixed(2)}° to ${origBounds.maxLon.toFixed(2)}° → ${fixedBounds.minLon.toFixed(2)}° to ${fixedBounds.maxLon.toFixed(2)}°`);
          wasFixed = true;
          polygonsShifted++;
        }
      } else {
        fixedCoordinates = feature.geometry.coordinates;
      }

      if (wasFixed) {
        featuresFixed++;
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: fixedCoordinates,
          },
        };
      }
    }

    return feature;
  });

  // Write fixed GeoJSON
  const outputData: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: fixedFeatures,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`✓ ${layerName}: ${featuresFixed} features fixed (${polygonsShifted} polygons shifted)`);
}

async function main() {
  console.log('🔧 Fixing Dateline Geometries\\n');
  console.log('='.repeat(80));
  console.log('\\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created output directory: ${OUTPUT_DIR}\\n`);
  }

  const layers = ['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background'];

  for (const layer of layers) {
    try {
      console.log(`🔧 Processing layer: ${layer}`);
      await fixLayer(layer);
      console.log('');
    } catch (error) {
      console.error(`   ❌ Error processing ${layer}:`, error instanceof Error ? error.message : String(error));
      console.log('');
    }
  }

  console.log('='.repeat(80));
  console.log('📋 SUMMARY\\n');
  console.log('Strategy used:');
  console.log('  - MultiPolygon features: Process each polygon separately');
  console.log('  - Polygons entirely >180°: Shifted by -360° to preserve topology');
  console.log('  - Polygons within ±180°: Left unchanged');
  console.log('  - This handles countries like Oyashima (28 islands) correctly');
  console.log('');
  console.log(`✅ Fixed GeoJSON files saved to: ${OUTPUT_DIR}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Import to PostgreSQL: bash scripts/import-dateline-fixed.sh');
  console.log('2. Validate geometries: npx tsx scripts/validate-postgis-geometries.ts');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Fix failed:', error);
  process.exit(1);
});
