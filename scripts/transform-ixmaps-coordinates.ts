/**
 * Transform IxMaps coordinates to WGS84
 *
 * The IxMaps coordinate system uses a shifted prime meridian at 26.09° East
 * instead of Greenwich (0°). This script applies the simple transformation:
 *
 * WGS84_lng = IxMaps_lng + 26.09
 * WGS84_lat = IxMaps_lat (unchanged)
 */

import fs from 'fs';
import path from 'path';

const PRIME_MERIDIAN_SHIFT = 26.09;

const SOURCE_DIR = '/ixwiki/public/projects/maps/scripting/geojson_4326';
const OUTPUT_DIR = '/ixwiki/public/projects/ixstats/scripts/geojson_wgs84';

interface GeoJSONFeature {
  type: string;
  properties: any;
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface GeoJSONFeatureCollection {
  type: string;
  features: GeoJSONFeature[];
}

// Recursively transform coordinates
function transformCoordinates(coords: any): any {
  if (typeof coords[0] === 'number') {
    // This is a single coordinate pair [lng, lat]
    return [coords[0] + PRIME_MERIDIAN_SHIFT, coords[1]];
  } else {
    // This is an array of coordinates
    return coords.map((c: any) => transformCoordinates(c));
  }
}

async function transformLayer(layerName: string) {
  const inputPath = path.join(SOURCE_DIR, `${layerName}.geojson`);
  const outputPath = path.join(OUTPUT_DIR, `${layerName}.geojson`);

  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  Skipping ${layerName} (file not found)`);
    return;
  }

  // Read source GeoJSON
  const sourceData = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as GeoJSONFeatureCollection;

  // Transform all features
  const transformedFeatures = sourceData.features.map((feature) => ({
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: transformCoordinates(feature.geometry.coordinates),
    },
  }));

  // Write output GeoJSON
  const outputData: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: transformedFeatures,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`   ✓ ${layerName} transformed (${transformedFeatures.length} features)`);

  // Show sample coordinate for verification
  if (transformedFeatures.length > 0 && transformedFeatures[0].geometry.coordinates) {
    const geom = transformedFeatures[0].geometry;
    let sampleCoord: [number, number] | null = null;

    if (geom.type === 'Point') {
      sampleCoord = geom.coordinates;
    } else if (geom.type === 'Polygon' && geom.coordinates[0][0]) {
      sampleCoord = geom.coordinates[0][0];
    } else if (geom.type === 'MultiPolygon' && geom.coordinates[0][0][0]) {
      sampleCoord = geom.coordinates[0][0][0];
    } else if (geom.type === 'LineString' && geom.coordinates[0]) {
      sampleCoord = geom.coordinates[0];
    }

    if (sampleCoord) {
      console.log(`     Sample coordinate: [${sampleCoord[0].toFixed(4)}, ${sampleCoord[1].toFixed(4)}]`);
    }
  }
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🗺️  Transforming IxMaps coordinates to WGS84...');
  console.log(`   Prime meridian shift: +${PRIME_MERIDIAN_SHIFT}°\n`);

  const layers = ['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps', 'background'];

  for (const layer of layers) {
    await transformLayer(layer);
  }

  console.log('\n✅ Transformation complete! Files saved to:', OUTPUT_DIR);
  console.log('\nNext steps:');
  console.log('1. Import political boundaries to PostgreSQL:');
  console.log(`   ogr2ogr -f "PostgreSQL" PG:"host=localhost port=5433 dbname=ixstats user=postgres password=postgres" \\`);
  console.log(`     ${OUTPUT_DIR}/political.geojson \\`);
  console.log(`     -nln temp_political_import -overwrite`);
  console.log('');
  console.log('2. Run the import script:');
  console.log('   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ixstats" npx tsx scripts/import-geographic-boundaries.ts');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
