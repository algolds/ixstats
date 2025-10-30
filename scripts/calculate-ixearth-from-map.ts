/**
 * Calculate actual IxEarth size from complete map data
 */

// Earth-scale measurements from PostGIS (all layers)
const EARTH_SCALE_MEASUREMENTS = {
  political: 43338096.66, // 185 features (countries + territories)
  altitudes: 86434483.02, // 4068 features (COMPLETE LAND LAYER)
  icecaps: 8367034.83, // 12 features (polar ice - part of land)
  lakes: 494883.35, // 350 features (water bodies)
  background: 0, // 1 feature (empty)
};

// Calculated scale factor from World Roster to Earth measurements
const IXEARTH_SCALE_FACTOR = 1.4777;

// Screenshot approximation (rough worldbuilding estimate)
const SCREENSHOT_APPROXIMATION = {
  totalLand: 126985380,
  totalWater: 225814620,
  totalSurface: 352800000,
};

console.log("\n🌍 CALCULATING ACTUAL IXEARTH SIZE FROM COMPLETE MAP DATA\n");
console.log("=".repeat(80));
console.log("\n");

// Calculate total land area (altitudes layer is the complete base map)
const earthScaleTotalLand = EARTH_SCALE_MEASUREMENTS.altitudes;
const canonicalTotalLand = earthScaleTotalLand * IXEARTH_SCALE_FACTOR;

console.log("📊 LAND AREA CALCULATION\n");
console.log(`   Earth-scale measurement (from PostGIS altitudes layer):`);
console.log(`      ${earthScaleTotalLand.toLocaleString()} sq mi`);
console.log(`   × IxEarth Scale Factor: ${IXEARTH_SCALE_FACTOR}x`);
console.log(`   = Canonical IxEarth Total Land:`);
console.log(`      ${canonicalTotalLand.toLocaleString()} sq mi`);
console.log("\n");

console.log("   Screenshot Approximation: 126,985,380 sq mi");
console.log(
  `   Difference: ${Math.abs(canonicalTotalLand - SCREENSHOT_APPROXIMATION.totalLand).toLocaleString()} sq mi`
);
console.log(
  `   Match: ${((canonicalTotalLand / SCREENSHOT_APPROXIMATION.totalLand) * 100).toFixed(1)}%`
);
console.log("\n");

// Of the total land, calculate claimed vs unclaimed
const claimedByCountries = 44440107; // From World Roster sum
const unclaimedLand = canonicalTotalLand - claimedByCountries;
const claimedPercent = (claimedByCountries / canonicalTotalLand) * 100;

console.log("📊 LAND BREAKDOWN\n");
console.log(`   Total IxEarth Land: ${canonicalTotalLand.toLocaleString()} sq mi`);
console.log(
  `   Claimed by 82 Countries: ${claimedByCountries.toLocaleString()} sq mi (${claimedPercent.toFixed(1)}%)`
);
console.log(
  `   Unclaimed Territories: ${unclaimedLand.toLocaleString()} sq mi (${(100 - claimedPercent).toFixed(1)}%)`
);
console.log("\n");

// Using screenshot approximation's land-to-total ratio to estimate total surface
const screenshotLandPercent =
  SCREENSHOT_APPROXIMATION.totalLand / SCREENSHOT_APPROXIMATION.totalSurface;
const estimatedTotalSurface = canonicalTotalLand / screenshotLandPercent;
const estimatedTotalWater = estimatedTotalSurface - canonicalTotalLand;

console.log("🌊 TOTAL SURFACE AREA ESTIMATION\n");
console.log(
  `   Based on screenshot land-to-total ratio (${(screenshotLandPercent * 100).toFixed(1)}% land):`
);
console.log(`   Estimated Total Surface: ${estimatedTotalSurface.toLocaleString()} sq mi`);
console.log(`   Estimated Total Water: ${estimatedTotalWater.toLocaleString()} sq mi`);
console.log("\n");

console.log("   Screenshot Approximation:");
console.log(`      Total Surface: ${SCREENSHOT_APPROXIMATION.totalSurface.toLocaleString()} sq mi`);
console.log(`      Total Water: ${SCREENSHOT_APPROXIMATION.totalWater.toLocaleString()} sq mi`);
console.log(
  `   Match: ${((estimatedTotalSurface / SCREENSHOT_APPROXIMATION.totalSurface) * 100).toFixed(1)}%`
);
console.log("\n");

// Comparison to Earth
const EARTH_LAND_AREA = 57510000;
const EARTH_TOTAL_SURFACE = 196940000;
const EARTH_WATER_AREA = 139434000;

console.log("=".repeat(80));
console.log("\n");
console.log("🌎 COMPARISON TO EARTH\n");
console.log(`   Land Area:`);
console.log(`      IxEarth: ${canonicalTotalLand.toLocaleString()} sq mi`);
console.log(`      Earth: ${EARTH_LAND_AREA.toLocaleString()} sq mi`);
console.log(`      Ratio: ${(canonicalTotalLand / EARTH_LAND_AREA).toFixed(2)}x`);
console.log("\n");
console.log(`   Total Surface Area:`);
console.log(`      IxEarth: ${estimatedTotalSurface.toLocaleString()} sq mi`);
console.log(`      Earth: ${EARTH_TOTAL_SURFACE.toLocaleString()} sq mi`);
console.log(`      Ratio: ${(estimatedTotalSurface / EARTH_TOTAL_SURFACE).toFixed(2)}x`);
console.log("\n");
console.log(`   Water Area:`);
console.log(`      IxEarth: ${estimatedTotalWater.toLocaleString()} sq mi`);
console.log(`      Earth: ${EARTH_WATER_AREA.toLocaleString()} sq mi`);
console.log(`      Ratio: ${(estimatedTotalWater / EARTH_WATER_AREA).toFixed(2)}x`);
console.log("\n");

console.log("=".repeat(80));
console.log("\n");
console.log("✅ FINAL IXEARTH METRICS (FROM ACTUAL MAP DATA)\n");
console.log(`   Total Land Area: ${canonicalTotalLand.toLocaleString()} sq mi (2.21x Earth)`);
console.log(
  `      - Claimed Countries: ${claimedByCountries.toLocaleString()} sq mi (${claimedPercent.toFixed(1)}%)`
);
console.log(
  `      - Unclaimed Territories: ${unclaimedLand.toLocaleString()} sq mi (${(100 - claimedPercent).toFixed(1)}%)`
);
console.log(`   Total Water Area: ${estimatedTotalWater.toLocaleString()} sq mi (1.62x Earth)`);
console.log(`   Total Surface Area: ${estimatedTotalSurface.toLocaleString()} sq mi (1.79x Earth)`);
console.log("\n");
console.log("   IxEarth Scale Factor: 1.4777x");
console.log("   IxMaps Scale: 1px = 10 sq mi");
console.log("\n");
console.log("=".repeat(80));
console.log("\n");
