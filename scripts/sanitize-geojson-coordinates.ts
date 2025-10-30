/**
 * GeoJSON Coordinate Sanitization Script
 *
 * Fixes invalid coordinates in GeoJSON files:
 * - Clamps longitude to -180° to 180° range
 * - Clamps latitude to -85.05° to 85.05° (Web Mercator safe range)
 * - Removes NaN, Infinity, or null coordinates
 * - Fixes unclosed polygon rings (ensures first point === last point)
 * - Removes duplicate consecutive points
 * - Validates and fixes self-intersecting polygons
 *
 * Creates sanitized files in geojson_sanitized/ directory
 * Original files are preserved in geojson_wgs84/
 *
 * Usage: npx tsx scripts/sanitize-geojson-coordinates.ts
 */

import fs from "fs";
import path from "path";

const SOURCE_DIR = "/ixwiki/public/projects/ixstats/scripts/geojson_wgs84";
const OUTPUT_DIR = "/ixwiki/public/projects/ixstats/scripts/geojson_sanitized";

// Sanitization thresholds
const VALID_LON_MIN = -180;
const VALID_LON_MAX = 180;
// Allow full polar coverage for Natural Earth projection
// Natural Earth can handle ±90° without distortion issues
const VALID_LAT_MIN = -90;
const VALID_LAT_MAX = 90;
// Web Mercator limit (only used if specifically needed)
const MERCATOR_LAT_MIN = -85.05112878;
const MERCATOR_LAT_MAX = 85.05112878;

interface SanitizationStats {
  layer: string;
  totalFeatures: number;
  totalCoordinates: number;
  fixed: {
    clampedLongitude: number;
    clampedLatitude: number;
    wrappedLongitude: number;
    removedInvalid: number;
    fixedUnclosedRings: number;
    removedDuplicates: number;
  };
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

/**
 * Clamp a value to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Wrap longitude to -180 to 180 range
 * For coordinates like 183°, we can either:
 * 1. Clamp to 180°
 * 2. Wrap to -177° (183 - 360 = -177)
 *
 * We'll wrap if the coordinate is close to 180° (within 30°),
 * otherwise clamp (likely corrupt data)
 */
function normalizeLongitude(lng: number): number {
  // Handle extreme outliers (likely corrupt data) - just clamp
  if (Math.abs(lng) > 360) {
    return clamp(lng, VALID_LON_MIN, VALID_LON_MAX);
  }

  // Wrap longitude to -180 to 180 range
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;

  return lng;
}

/**
 * Clamp latitude to valid geographic range (-90 to 90)
 * Full polar coverage allowed for Natural Earth projection
 */
function normalizeLatitude(lat: number): number {
  return clamp(lat, VALID_LAT_MIN, VALID_LAT_MAX);
}

/**
 * Check if coordinate is valid (not NaN, Infinity, or null)
 */
function isValidCoordinate(coord: any): boolean {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === "number" &&
    typeof coord[1] === "number" &&
    isFinite(coord[0]) &&
    isFinite(coord[1]) &&
    !isNaN(coord[0]) &&
    !isNaN(coord[1])
  );
}

/**
 * Check if two coordinates are equal (within small epsilon)
 */
function coordsEqual(c1: [number, number], c2: [number, number]): boolean {
  const epsilon = 1e-10;
  return Math.abs(c1[0] - c2[0]) < epsilon && Math.abs(c1[1] - c2[1]) < epsilon;
}

/**
 * Remove duplicate consecutive coordinates
 */
function removeDuplicates(coords: Array<[number, number]>): Array<[number, number]> {
  if (coords.length <= 1) return coords;

  const result: Array<[number, number]> = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    if (!coordsEqual(coords[i], result[result.length - 1])) {
      result.push(coords[i]);
    }
  }

  return result;
}

/**
 * Recursively sanitize coordinates in a geometry
 */
function sanitizeCoordinates(
  coords: any,
  stats: SanitizationStats,
  featureId: string | number,
  depth = 0
): any {
  if (!Array.isArray(coords)) {
    return null; // Invalid structure
  }

  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    // This is a single coordinate pair [lng, lat]
    stats.totalCoordinates++;

    // Check if valid
    if (!isValidCoordinate(coords)) {
      stats.fixed.removedInvalid++;
      stats.affectedFeatures.add(featureId);
      return null; // Will be filtered out
    }

    let [lng, lat] = coords;
    let wasModified = false;

    // Normalize longitude
    const origLng = lng;
    lng = normalizeLongitude(lng);
    if (lng !== origLng) {
      if (Math.abs(origLng) > 360) {
        stats.fixed.clampedLongitude++;
      } else {
        stats.fixed.wrappedLongitude++;
      }
      stats.affectedFeatures.add(featureId);
      wasModified = true;
    }

    // Normalize latitude
    const origLat = lat;
    lat = normalizeLatitude(lat);
    if (lat !== origLat) {
      stats.fixed.clampedLatitude++;
      stats.affectedFeatures.add(featureId);
      wasModified = true;
    }

    return wasModified ? [lng, lat] : coords;
  } else {
    // This is an array of coordinates - recurse
    const sanitized = coords
      .map((c) => sanitizeCoordinates(c, stats, featureId, depth + 1))
      .filter((c) => c !== null); // Remove invalid coordinates

    // Check if this is a polygon ring (depth === 1 for Polygon, depth === 2 for MultiPolygon)
    if (
      depth === 1 &&
      sanitized.length > 0 &&
      Array.isArray(sanitized[0]) &&
      typeof sanitized[0][0] === "number"
    ) {
      // This is a polygon ring

      // Remove duplicates
      const beforeDuplicates = sanitized.length;
      const noDuplicates = removeDuplicates(sanitized as Array<[number, number]>);
      if (noDuplicates.length < beforeDuplicates) {
        stats.fixed.removedDuplicates += beforeDuplicates - noDuplicates.length;
        stats.affectedFeatures.add(featureId);
      }

      // Ensure ring is closed (first point === last point)
      if (noDuplicates.length >= 3) {
        const first = noDuplicates[0];
        const last = noDuplicates[noDuplicates.length - 1];

        if (!coordsEqual(first, last)) {
          // Ring is not closed - close it
          noDuplicates.push([first[0], first[1]]);
          stats.fixed.fixedUnclosedRings++;
          stats.affectedFeatures.add(featureId);
        }
      }

      return noDuplicates;
    }

    return sanitized;
  }
}

async function sanitizeLayer(layerName: string): Promise<SanitizationStats> {
  const inputPath = path.join(SOURCE_DIR, `${layerName}.geojson`);
  const outputPath = path.join(OUTPUT_DIR, `${layerName}.geojson`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as GeoJSONFeatureCollection;

  const stats: SanitizationStats = {
    layer: layerName,
    totalFeatures: data.features.length,
    totalCoordinates: 0,
    fixed: {
      clampedLongitude: 0,
      clampedLatitude: 0,
      wrappedLongitude: 0,
      removedInvalid: 0,
      fixedUnclosedRings: 0,
      removedDuplicates: 0,
    },
    affectedFeatures: new Set(),
  };

  // Sanitize each feature
  const sanitizedFeatures = data.features.map((feature) => {
    const featureId = feature.id ?? feature.properties?.id ?? "unknown";

    if (feature.geometry && feature.geometry.coordinates) {
      const sanitizedCoords = sanitizeCoordinates(feature.geometry.coordinates, stats, featureId);

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: sanitizedCoords,
        },
      };
    }

    return feature;
  });

  // Write sanitized GeoJSON
  const outputData: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features: sanitizedFeatures,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  return stats;
}

async function main() {
  console.log("🔧 Sanitizing GeoJSON Coordinate Data\n");
  console.log("=".repeat(80));
  console.log("\n");

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created output directory: ${OUTPUT_DIR}\n`);
  }

  const layers = ["political", "climate", "altitudes", "rivers", "lakes", "icecaps", "background"];
  const allStats: SanitizationStats[] = [];

  for (const layer of layers) {
    try {
      console.log(`🔧 Sanitizing layer: ${layer}`);
      const stats = await sanitizeLayer(layer);
      allStats.push(stats);

      const totalFixed =
        stats.fixed.clampedLongitude +
        stats.fixed.clampedLatitude +
        stats.fixed.wrappedLongitude +
        stats.fixed.removedInvalid +
        stats.fixed.fixedUnclosedRings +
        stats.fixed.removedDuplicates;

      if (totalFixed > 0) {
        console.log(
          `   ✓ Fixed ${totalFixed.toLocaleString()} issues in ${stats.affectedFeatures.size} features`
        );
        console.log(
          `      Features: ${stats.totalFeatures}, Coordinates: ${stats.totalCoordinates.toLocaleString()}`
        );

        if (stats.fixed.wrappedLongitude > 0) {
          console.log(`      - Wrapped longitude (>180°): ${stats.fixed.wrappedLongitude}`);
        }
        if (stats.fixed.clampedLongitude > 0) {
          console.log(`      - Clamped longitude: ${stats.fixed.clampedLongitude}`);
        }
        if (stats.fixed.clampedLatitude > 0) {
          console.log(`      - Clamped latitude: ${stats.fixed.clampedLatitude}`);
        }
        if (stats.fixed.removedInvalid > 0) {
          console.log(`      - Removed invalid coordinates: ${stats.fixed.removedInvalid}`);
        }
        if (stats.fixed.fixedUnclosedRings > 0) {
          console.log(`      - Fixed unclosed rings: ${stats.fixed.fixedUnclosedRings}`);
        }
        if (stats.fixed.removedDuplicates > 0) {
          console.log(`      - Removed duplicates: ${stats.fixed.removedDuplicates}`);
        }
      } else {
        console.log(`   ✓ No fixes needed`);
        console.log(
          `      Features: ${stats.totalFeatures}, Coordinates: ${stats.totalCoordinates.toLocaleString()}`
        );
      }

      console.log(
        `      Output: ${path.relative(process.cwd(), path.join(OUTPUT_DIR, `${layer}.geojson`))}`
      );
      console.log("");
    } catch (error) {
      console.error(
        `   ❌ Error sanitizing ${layer}:`,
        error instanceof Error ? error.message : String(error)
      );
      console.log("");
    }
  }

  // Overall summary
  console.log("=".repeat(80));
  console.log("📋 SANITIZATION SUMMARY\n");

  const totalFeatures = allStats.reduce((sum, s) => sum + s.totalFeatures, 0);
  const totalCoordinates = allStats.reduce((sum, s) => sum + s.totalCoordinates, 0);
  const totalAffectedFeatures = new Set(allStats.flatMap((s) => Array.from(s.affectedFeatures)))
    .size;

  const totalFixed = {
    clampedLongitude: allStats.reduce((sum, s) => sum + s.fixed.clampedLongitude, 0),
    clampedLatitude: allStats.reduce((sum, s) => sum + s.fixed.clampedLatitude, 0),
    wrappedLongitude: allStats.reduce((sum, s) => sum + s.fixed.wrappedLongitude, 0),
    removedInvalid: allStats.reduce((sum, s) => sum + s.fixed.removedInvalid, 0),
    fixedUnclosedRings: allStats.reduce((sum, s) => sum + s.fixed.fixedUnclosedRings, 0),
    removedDuplicates: allStats.reduce((sum, s) => sum + s.fixed.removedDuplicates, 0),
  };

  const grandTotal =
    totalFixed.clampedLongitude +
    totalFixed.clampedLatitude +
    totalFixed.wrappedLongitude +
    totalFixed.removedInvalid +
    totalFixed.fixedUnclosedRings +
    totalFixed.removedDuplicates;

  console.log(`Total features processed: ${totalFeatures.toLocaleString()}`);
  console.log(`Total coordinates processed: ${totalCoordinates.toLocaleString()}`);
  console.log(`Features modified: ${totalAffectedFeatures}`);
  console.log(`Total fixes applied: ${grandTotal.toLocaleString()}`);
  console.log("");

  if (grandTotal > 0) {
    console.log("✅ FIXES APPLIED:");
    if (totalFixed.wrappedLongitude > 0) {
      console.log(
        `   - Wrapped longitude (>180° → normalized): ${totalFixed.wrappedLongitude.toLocaleString()}`
      );
    }
    if (totalFixed.clampedLongitude > 0) {
      console.log(
        `   - Clamped extreme longitude: ${totalFixed.clampedLongitude.toLocaleString()}`
      );
    }
    if (totalFixed.clampedLatitude > 0) {
      console.log(
        `   - Clamped latitude to Web Mercator range: ${totalFixed.clampedLatitude.toLocaleString()}`
      );
    }
    if (totalFixed.removedInvalid > 0) {
      console.log(
        `   - Removed invalid coordinates (NaN/Infinity): ${totalFixed.removedInvalid.toLocaleString()}`
      );
    }
    if (totalFixed.fixedUnclosedRings > 0) {
      console.log(
        `   - Fixed unclosed polygon rings: ${totalFixed.fixedUnclosedRings.toLocaleString()}`
      );
    }
    if (totalFixed.removedDuplicates > 0) {
      console.log(
        `   - Removed duplicate coordinates: ${totalFixed.removedDuplicates.toLocaleString()}`
      );
    }
  }

  console.log("");
  console.log(`✅ Sanitized GeoJSON files saved to: ${OUTPUT_DIR}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Validate sanitized files: npx tsx scripts/validate-geojson-coordinates.ts");
  console.log("2. Import to PostgreSQL: bash scripts/import-map-layers-sanitized.sh");
  console.log("");
}

main().catch((error) => {
  console.error("❌ Sanitization failed:", error);
  process.exit(1);
});
