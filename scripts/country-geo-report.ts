#!/usr/bin/env npx tsx
/**
 * Country Geographic Report Generator
 *
 * Generates a comprehensive geographic report for any IxWorld country
 * using GeoJSON data layers (political, altitude, climate, rivers, lakes, icecaps).
 *
 * Usage:
 *   npx tsx scripts/country-geo-report.ts "Burgundie"
 *   npx tsx scripts/country-geo-report.ts "Burgundie" --json
 *   npx tsx scripts/country-geo-report.ts --list
 */

import { readFileSync } from "fs";
import { join } from "path";
import * as turf from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
  Position,
  GeoJsonProperties,
} from "geojson";

// ─────────────────────────────────────────────
// Constants (replicated from src/ to avoid Next.js import issues)
// ─────────────────────────────────────────────

const ELEVATION_ZONES = [
  { zoneId: "zone_0", zoneName: "Coastal Lowlands", elevationMin: 0, elevationMax: 99, color: "#a8c995" },
  { zoneId: "zone_1", zoneName: "Low Hills", elevationMin: 100, elevationMax: 349, color: "#c3d3a1" },
  { zoneId: "zone_2", zoneName: "Rolling Hills", elevationMin: 350, elevationMax: 499, color: "#dcdcac" },
  { zoneId: "zone_3", zoneName: "Uplands", elevationMin: 500, elevationMax: 999, color: "#f7e6b8" },
  { zoneId: "zone_4", zoneName: "Low Mountains", elevationMin: 1000, elevationMax: 1999, color: "#dac497" },
  { zoneId: "zone_5", zoneName: "Mid Mountains", elevationMin: 2000, elevationMax: 2999, color: "#bea276" },
  { zoneId: "zone_6", zoneName: "High Mountains", elevationMin: 3000, elevationMax: 3999, color: "#9c7b50" },
  { zoneId: "zone_7", zoneName: "Alpine", elevationMin: 4000, elevationMax: 4999, color: "#796142" },
  { zoneId: "zone_8", zoneName: "Extreme Alpine", elevationMin: 5000, elevationMax: 9999, color: "#4f4236" },
];

const CLIMATE_COLOR_MAP: Record<string, string> = {
  "#00fd97": "Tropical",
  "#326500": "Dense Forest",
  "#fd9833": "Arid",
  "#659700": "Temperate",
  "#fc3502": "Desert",
  "#980000": "Extreme Arid",
  "#fcfc33": "Subtropical",
  "#0098fd": "Oceanic",
  "#9ea7b0": "Subarctic",
  "#0065ca": "Arctic",
  "#fecbfe": "Alpine",
};

// Climate type metadata for temperature/precipitation modeling
const CLIMATE_METADATA: Record<string, { tempModifier: number; precipMmYr: number; description: string }> = {
  "Tropical":      { tempModifier: 2,   precipMmYr: 2200, description: "Hot and humid year-round with heavy rainfall" },
  "Dense Forest":  { tempModifier: 0,   precipMmYr: 1800, description: "Heavily forested with consistent moisture" },
  "Arid":          { tempModifier: 3,   precipMmYr: 350,  description: "Low rainfall with hot daytime temperatures" },
  "Temperate":     { tempModifier: -2,  precipMmYr: 900,  description: "Moderate temperatures with distinct seasons" },
  "Desert":        { tempModifier: 5,   precipMmYr: 100,  description: "Extremely dry with intense solar radiation" },
  "Extreme Arid":  { tempModifier: 6,   precipMmYr: 50,   description: "Virtually no precipitation, extreme temperatures" },
  "Subtropical":   { tempModifier: 1,   precipMmYr: 1200, description: "Warm with moderate to high precipitation" },
  "Oceanic":       { tempModifier: -3,  precipMmYr: 1100, description: "Maritime influence with mild, wet conditions" },
  "Subarctic":     { tempModifier: -10, precipMmYr: 400,  description: "Long cold winters, brief cool summers" },
  "Arctic":        { tempModifier: -20, precipMmYr: 200,  description: "Permanently cold with minimal precipitation" },
  "Alpine":        { tempModifier: -12, precipMmYr: 600,  description: "High altitude with cold temperatures and orographic precipitation" },
};

// ─────────────────────────────────────────────
// GeoJSON Loading
// ─────────────────────────────────────────────

const GEOJSON_DIR = join(process.cwd(), "scripts", "geojson_fixed");

function loadGeoJSON(filename: string): FeatureCollection {
  const raw = readFileSync(join(GEOJSON_DIR, filename), "utf-8");
  return JSON.parse(raw) as FeatureCollection;
}

type PolyFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;
type LineFeature = Feature<LineString | MultiLineString, GeoJsonProperties>;

// ─────────────────────────────────────────────
// Country Lookup (fuzzy matching)
// ─────────────────────────────────────────────

function featureIdToDisplayName(id: string): string {
  return id.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
    }
  }
  return dp[m]![n]!;
}

function findCountry(name: string, features: Feature[]): Feature | null {
  const input = name.toLowerCase().trim();

  // Exact match on feature ID
  const exactId = features.find(
    (f) => (f.properties?.id as string)?.toLowerCase() === input
  );
  if (exactId) return exactId;

  // Exact match on display name
  const exactName = features.find(
    (f) => featureIdToDisplayName(f.properties?.id ?? "").toLowerCase() === input
  );
  if (exactName) return exactName;

  // Substring match
  const substring = features.filter(
    (f) => featureIdToDisplayName(f.properties?.id ?? "").toLowerCase().includes(input)
  );
  if (substring.length === 1) return substring[0]!;
  if (substring.length > 1) {
    console.error(`\nMultiple matches for "${name}":`);
    substring.forEach((f) => console.error(`  - ${featureIdToDisplayName(f.properties?.id ?? "")}`));
    console.error(`\nPlease be more specific.`);
    process.exit(1);
  }

  // Levenshtein distance fallback
  const scored = features
    .map((f) => ({
      feature: f,
      name: featureIdToDisplayName(f.properties?.id ?? ""),
      dist: levenshtein(input, featureIdToDisplayName(f.properties?.id ?? "").toLowerCase()),
    }))
    .sort((a, b) => a.dist - b.dist);

  if (scored[0] && scored[0].dist <= 3) {
    console.error(`\nNo exact match for "${name}". Did you mean "${scored[0].name}"? Using it.\n`);
    return scored[0].feature;
  }

  console.error(`\nNo match found for "${name}". Closest names:`);
  scored.slice(0, 5).forEach((s) => console.error(`  - ${s.name} (distance: ${s.dist})`));
  process.exit(1);
}

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function getElevationZone(fillColor: string) {
  const norm = fillColor.toLowerCase().replace(/^#/, "").slice(0, 6);
  return ELEVATION_ZONES.find((z) => z.color.replace(/^#/, "").slice(0, 6) === norm);
}

function getClimateType(fillColor: string): string | null {
  const norm = fillColor.toLowerCase();
  return CLIMATE_COLOR_MAP[norm] ?? null;
}

function bboxOverlaps(a: turf.BBox, b: turf.BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function bearingToCompass(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(normalized / 22.5) % 16]!;
}

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`;
}

function safeIntersect(a: PolyFeature, b: PolyFeature): Feature<Polygon | MultiPolygon> | null {
  try {
    return turf.intersect(turf.featureCollection([a, b]));
  } catch {
    return null;
  }
}

function getPolygonCount(feature: Feature): number {
  if (feature.geometry.type === "MultiPolygon") {
    return (feature.geometry as MultiPolygon).coordinates.length;
  }
  return feature.geometry.type === "Polygon" ? 1 : 0;
}

// ─────────────────────────────────────────────
// Analysis: Area & Dimensions
// ─────────────────────────────────────────────

interface AreaResult {
  areaKm2: number;
  areaSqMi: number;
  bbox: turf.BBox;
  nsSpanKm: number;
  ewSpanKm: number;
  centroid: [number, number]; // [lng, lat]
  perimeterKm: number;
}

function analyzeArea(country: Feature): AreaResult {
  const areaM2 = turf.area(country);
  const areaKm2 = areaM2 / 1e6;
  const areaSqMi = areaKm2 * 0.386102;
  const bbox = turf.bbox(country);
  const cent = turf.centroid(country);
  const centCoord = cent.geometry.coordinates as [number, number];

  const nsSpanKm = turf.distance(
    turf.point([centCoord[0], bbox[1]]),
    turf.point([centCoord[0], bbox[3]]),
    { units: "kilometers" }
  );
  const ewSpanKm = turf.distance(
    turf.point([bbox[0], centCoord[1]]),
    turf.point([bbox[2], centCoord[1]]),
    { units: "kilometers" }
  );

  let perimeterKm = 0;
  try {
    const lines = turf.polygonToLine(country as Feature<Polygon | MultiPolygon>);
    if (lines.type === "Feature") {
      perimeterKm = turf.length(lines, { units: "kilometers" });
    } else {
      for (const feat of lines.features) {
        perimeterKm += turf.length(feat, { units: "kilometers" });
      }
    }
  } catch {
    // Fallback: manually sum ring lengths
    const geom = country.geometry;
    const rings: Position[][] = [];
    if (geom.type === "Polygon") {
      rings.push(...(geom as Polygon).coordinates);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of (geom as MultiPolygon).coordinates) {
        rings.push(...poly);
      }
    }
    for (const ring of rings) {
      const line = turf.lineString(ring);
      perimeterKm += turf.length(line, { units: "kilometers" });
    }
  }

  return { areaKm2, areaSqMi, bbox, nsSpanKm, ewSpanKm, centroid: centCoord, perimeterKm };
}

// ─────────────────────────────────────────────
// Analysis: Elevation Profile
// ─────────────────────────────────────────────

interface ElevationZoneResult {
  zoneName: string;
  elevationMin: number;
  elevationMax: number;
  areaKm2: number;
  percent: number;
}

interface ElevationResult {
  zones: ElevationZoneResult[];
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  terrainRoughness: number;
  dominantTerrain: string;
}

function analyzeElevation(country: PolyFeature, altitudeFeatures: Feature[], countryBbox: turf.BBox, countryAreaKm2: number): ElevationResult {
  const zoneAreas = new Map<string, number>();
  let intersectionWarnings = 0;

  for (const altFeat of altitudeFeatures) {
    const altBbox = turf.bbox(altFeat);
    if (!bboxOverlaps(countryBbox, altBbox)) continue;

    const fillColor = (altFeat.properties?.fill as string) ?? "";
    const zone = getElevationZone(fillColor);
    if (!zone) continue;

    try {
      if (!turf.booleanIntersects(country, altFeat)) continue;
    } catch {
      continue;
    }

    const intersection = safeIntersect(country, altFeat as PolyFeature);
    if (!intersection) {
      intersectionWarnings++;
      continue;
    }

    const intArea = turf.area(intersection) / 1e6;
    zoneAreas.set(zone.zoneName, (zoneAreas.get(zone.zoneName) ?? 0) + intArea);
  }

  if (intersectionWarnings > 0) {
    process.stderr.write(`  [warn] ${intersectionWarnings} altitude intersection(s) failed (degenerate geometry)\n`);
  }

  const totalMappedArea = Array.from(zoneAreas.values()).reduce((s, a) => s + a, 0);
  const zones: ElevationZoneResult[] = ELEVATION_ZONES
    .filter((z) => zoneAreas.has(z.zoneName))
    .map((z) => ({
      zoneName: z.zoneName,
      elevationMin: z.elevationMin,
      elevationMax: z.elevationMax,
      areaKm2: zoneAreas.get(z.zoneName)!,
      percent: totalMappedArea > 0 ? (zoneAreas.get(z.zoneName)! / totalMappedArea) * 100 : 0,
    }));

  let minElev = 9999, maxElev = 0, weightedSum = 0;
  for (const z of zones) {
    const mid = (z.elevationMin + z.elevationMax) / 2;
    if (z.elevationMin < minElev) minElev = z.elevationMin;
    if (z.elevationMax > maxElev) maxElev = z.elevationMax;
    weightedSum += mid * z.areaKm2;
  }
  const meanElevation = totalMappedArea > 0 ? weightedSum / totalMappedArea : 0;
  const terrainRoughness = zones.length / Math.sqrt(countryAreaKm2);
  const dominantTerrain = zones.sort((a, b) => b.areaKm2 - a.areaKm2)[0]?.zoneName ?? "Unknown";

  // Re-sort by elevation for display
  zones.sort((a, b) => a.elevationMin - b.elevationMin);

  return {
    zones,
    minElevation: minElev === 9999 ? 0 : minElev,
    maxElevation: maxElev,
    meanElevation,
    terrainRoughness,
    dominantTerrain,
  };
}

// ─────────────────────────────────────────────
// Analysis: Climate
// ─────────────────────────────────────────────

interface ClimateZoneResult {
  type: string;
  areaKm2: number;
  percent: number;
  description: string;
}

interface ClimateResult {
  zones: ClimateZoneResult[];
  dominantType: string;
  diversityIndex: number;
  estMeanTempC: number;
  estMeanTempF: number;
  estAnnualPrecipMm: number;
  estSeasonalRangeC: number;
  estSummerHighC: number;
  estWinterLowC: number;
}

function analyzeClimate(
  country: PolyFeature,
  climateFeatures: Feature[],
  countryBbox: turf.BBox,
  centroidLat: number,
  meanElevation: number
): ClimateResult {
  const typeAreas = new Map<string, number>();
  let intersectionWarnings = 0;

  for (const climFeat of climateFeatures) {
    const climBbox = turf.bbox(climFeat);
    if (!bboxOverlaps(countryBbox, climBbox)) continue;

    const fillColor = (climFeat.properties?.fill as string) ?? "";
    const climType = getClimateType(fillColor);
    if (!climType) continue;

    try {
      if (!turf.booleanIntersects(country, climFeat)) continue;
    } catch {
      continue;
    }

    const intersection = safeIntersect(country, climFeat as PolyFeature);
    if (!intersection) {
      intersectionWarnings++;
      continue;
    }

    const intArea = turf.area(intersection) / 1e6;
    typeAreas.set(climType, (typeAreas.get(climType) ?? 0) + intArea);
  }

  if (intersectionWarnings > 0) {
    process.stderr.write(`  [warn] ${intersectionWarnings} climate intersection(s) failed (degenerate geometry)\n`);
  }

  const totalMappedArea = Array.from(typeAreas.values()).reduce((s, a) => s + a, 0);
  const zones: ClimateZoneResult[] = Array.from(typeAreas.entries())
    .map(([type, areaKm2]) => ({
      type,
      areaKm2,
      percent: totalMappedArea > 0 ? (areaKm2 / totalMappedArea) * 100 : 0,
      description: CLIMATE_METADATA[type]?.description ?? "",
    }))
    .sort((a, b) => b.areaKm2 - a.areaKm2);

  const dominantType = zones[0]?.type ?? "Unknown";

  // Shannon diversity index
  let diversityIndex = 0;
  for (const z of zones) {
    const p = z.areaKm2 / totalMappedArea;
    if (p > 0) diversityIndex -= p * Math.log(p);
  }

  // Temperature estimation using real-world latitude-based model
  // Base: 28°C at equator, decreasing 0.7°C per degree latitude
  const absLat = Math.abs(centroidLat);
  let baseTempC = 28 - 0.7 * absLat;

  // Elevation lapse rate: -6.5°C per 1000m (standard atmospheric lapse rate)
  baseTempC -= 6.5 * (meanElevation / 1000);

  // Climate type modifier (area-weighted)
  let climateModifier = 0;
  for (const z of zones) {
    const meta = CLIMATE_METADATA[z.type];
    if (meta) climateModifier += meta.tempModifier * (z.areaKm2 / totalMappedArea);
  }
  const estMeanTempC = baseTempC + climateModifier;

  // Seasonal range: increases with latitude (continental amplification)
  const estSeasonalRangeC = 5 + 0.35 * absLat;
  const estSummerHighC = estMeanTempC + estSeasonalRangeC / 2;
  const estWinterLowC = estMeanTempC - estSeasonalRangeC / 2;

  // Precipitation estimation (area-weighted from climate type)
  let estAnnualPrecipMm = 0;
  for (const z of zones) {
    const meta = CLIMATE_METADATA[z.type];
    if (meta) estAnnualPrecipMm += meta.precipMmYr * (z.areaKm2 / totalMappedArea);
  }

  // Orographic adjustment: +15% per 1000m mean elevation for windward, -10% for leeward
  estAnnualPrecipMm *= 1 + 0.05 * (meanElevation / 1000);

  return {
    zones,
    dominantType,
    diversityIndex,
    estMeanTempC,
    estMeanTempF: estMeanTempC * 9 / 5 + 32,
    estAnnualPrecipMm,
    estSeasonalRangeC,
    estSummerHighC,
    estWinterLowC,
  };
}

// ─────────────────────────────────────────────
// Analysis: Hydrography
// ─────────────────────────────────────────────

interface HydrographyResult {
  riverCount: number;
  totalRiverLengthKm: number;
  lakeCount: number;
  totalLakeAreaKm2: number;
  drainageDensity: number;
}

function analyzeHydrography(
  country: PolyFeature,
  riverFeatures: Feature[],
  lakeFeatures: Feature[],
  countryBbox: turf.BBox,
  countryAreaKm2: number
): HydrographyResult {
  let riverCount = 0;
  let totalRiverLengthKm = 0;

  for (const river of riverFeatures) {
    const riverBbox = turf.bbox(river);
    if (!bboxOverlaps(countryBbox, riverBbox)) continue;

    try {
      if (!turf.booleanIntersects(country, river)) continue;
    } catch {
      continue;
    }

    riverCount++;

    // Estimate river length within country by sampling points along the line
    const riverLength = turf.length(river, { units: "kilometers" });
    const sampleInterval = Math.max(5, riverLength / 50); // sample every 5km or at 50 points
    let pointsInside = 0;
    let totalPoints = 0;

    for (let d = 0; d <= riverLength; d += sampleInterval) {
      totalPoints++;
      try {
        const pt = turf.along(river as Feature<LineString>, d, { units: "kilometers" });
        if (turf.booleanPointInPolygon(pt, country)) {
          pointsInside++;
        }
      } catch {
        // skip bad samples
      }
    }

    if (totalPoints > 0) {
      totalRiverLengthKm += riverLength * (pointsInside / totalPoints);
    }
  }

  let lakeCount = 0;
  let totalLakeAreaKm2 = 0;

  for (const lake of lakeFeatures) {
    const lakeBbox = turf.bbox(lake);
    if (!bboxOverlaps(countryBbox, lakeBbox)) continue;

    try {
      if (!turf.booleanIntersects(country, lake)) continue;
    } catch {
      continue;
    }

    lakeCount++;
    const intersection = safeIntersect(country, lake as PolyFeature);
    if (intersection) {
      totalLakeAreaKm2 += turf.area(intersection) / 1e6;
    } else {
      // Fallback: use full lake area
      totalLakeAreaKm2 += turf.area(lake) / 1e6;
    }
  }

  const drainageDensity = countryAreaKm2 > 0 ? totalRiverLengthKm / countryAreaKm2 : 0;

  return { riverCount, totalRiverLengthKm, lakeCount, totalLakeAreaKm2, drainageDensity };
}

// ─────────────────────────────────────────────
// Analysis: Geographic Position
// ─────────────────────────────────────────────

interface PositionResult {
  hemisphere: string;
  latitudeBand: string;
  distanceFromEquatorKm: number;
  approximateTimezone: string;
  latitudeClassification: string;
}

function analyzePosition(centroid: [number, number]): PositionResult {
  const [lng, lat] = centroid;
  const absLat = Math.abs(lat);

  let hemisphere: string;
  if (absLat < 5) hemisphere = "Equatorial";
  else if (lat > 0) hemisphere = "Northern";
  else hemisphere = "Southern";

  let latitudeBand: string;
  if (absLat < 23.5) latitudeBand = "Tropical";
  else if (absLat < 35) latitudeBand = "Subtropical";
  else if (absLat < 55) latitudeBand = "Temperate";
  else if (absLat < 66.5) latitudeBand = "Subarctic/Subantarctic";
  else latitudeBand = "Arctic/Antarctic";

  const distanceFromEquatorKm = turf.distance(
    turf.point([lng, 0]),
    turf.point([lng, lat]),
    { units: "kilometers" }
  );

  const utcOffset = Math.round(lng / 15);
  const sign = utcOffset >= 0 ? "+" : "";
  const approximateTimezone = `UTC${sign}${utcOffset}`;

  // Koppen-style latitude classification
  let latitudeClassification: string;
  if (absLat < 10) latitudeClassification = "Equatorial zone (ITCZ dominant)";
  else if (absLat < 23.5) latitudeClassification = "Tropical zone (Hadley cell)";
  else if (absLat < 35) latitudeClassification = "Subtropical high zone (horse latitudes)";
  else if (absLat < 50) latitudeClassification = "Mid-latitude westerlies zone";
  else if (absLat < 60) latitudeClassification = "Subpolar low zone";
  else if (absLat < 66.5) latitudeClassification = "Polar front zone";
  else latitudeClassification = "Polar zone (polar easterlies)";

  return { hemisphere, latitudeBand, distanceFromEquatorKm, approximateTimezone, latitudeClassification };
}

// ─────────────────────────────────────────────
// Shared border computation helpers
// ─────────────────────────────────────────────

function extractRings(feature: PolyFeature): Position[][] {
  const rings: Position[][] = [];
  const geom = feature.geometry;
  if (geom.type === "Polygon") {
    rings.push(...geom.coordinates);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      rings.push(...poly);
    }
  }
  return rings;
}

function coordKey(pos: Position, precision = 3): string {
  return `${pos[0]!.toFixed(precision)},${pos[1]!.toFixed(precision)}`;
}

function computeSharedBorderLength(ringsA: Position[][], ringsB: Position[][]): number {
  // Build a set of edge keys from polygon B
  const edgesB = new Set<string>();
  for (const ring of ringsB) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = coordKey(ring[i]!);
      const b = coordKey(ring[i + 1]!);
      // Store both directions
      edgesB.add(`${a}|${b}`);
      edgesB.add(`${b}|${a}`);
    }
  }

  // Walk edges of polygon A, sum length of edges that exist in B
  let sharedKm = 0;
  for (const ring of ringsA) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = coordKey(ring[i]!);
      const b = coordKey(ring[i + 1]!);
      if (edgesB.has(`${a}|${b}`)) {
        sharedKm += turf.distance(turf.point(ring[i]!), turf.point(ring[i + 1]!), { units: "kilometers" });
      }
    }
  }

  return sharedKm;
}

// ─────────────────────────────────────────────
// Analysis: Neighbors
// ─────────────────────────────────────────────

interface NeighborResult {
  name: string;
  direction: string;
  bearing: number;
  estimatedSharedBorderKm: number;
}

function analyzeNeighbors(
  country: PolyFeature,
  countryCentroid: [number, number],
  allPolitical: Feature[],
  countryId: string
): NeighborResult[] {
  const neighbors: NeighborResult[] = [];
  const countryBbox = turf.bbox(country);

  // Expand bbox slightly for neighbor detection
  const expandedBbox: turf.BBox = [
    countryBbox[0] - 1, countryBbox[1] - 1,
    countryBbox[2] + 1, countryBbox[3] + 1,
  ];

  for (const other of allPolitical) {
    const otherId = (other.properties?.id as string) ?? "";
    if (otherId === countryId) continue;

    const otherBbox = turf.bbox(other);
    if (!bboxOverlaps(expandedBbox, otherBbox)) continue;

    try {
      if (!turf.booleanIntersects(country, other)) continue;
    } catch {
      continue;
    }

    const otherCentroid = turf.centroid(other).geometry.coordinates as [number, number];
    const bearing = turf.bearing(turf.point(countryCentroid), turf.point(otherCentroid));
    const direction = bearingToCompass(bearing);

    // Estimate shared border by finding coincident boundary segments
    let estimatedSharedBorderKm = 0;
    try {
      const countryRings = extractRings(country);
      const otherRings = extractRings(other as PolyFeature);
      estimatedSharedBorderKm = computeSharedBorderLength(countryRings, otherRings);
    } catch {
      estimatedSharedBorderKm = 0;
    }

    neighbors.push({
      name: featureIdToDisplayName(otherId),
      direction,
      bearing,
      estimatedSharedBorderKm,
    });
  }

  // Sort by bearing (clockwise from N)
  neighbors.sort((a, b) => ((a.bearing + 360) % 360) - ((b.bearing + 360) % 360));
  return neighbors;
}

// ─────────────────────────────────────────────
// Analysis: Coastline & Maritime
// ─────────────────────────────────────────────

interface CoastlineResult {
  hasCoastline: boolean;
  isLandlocked: boolean;
  estimatedCoastlineKm: number;
  totalSharedBorderKm: number;
  coastlinePercent: number;
}

function analyzeCoastline(perimeterKm: number, neighbors: NeighborResult[]): CoastlineResult {
  const totalSharedBorderKm = neighbors.reduce((s, n) => s + n.estimatedSharedBorderKm, 0);
  const estimatedCoastlineKm = Math.max(0, perimeterKm - totalSharedBorderKm);
  const coastlinePercent = perimeterKm > 0 ? (estimatedCoastlineKm / perimeterKm) * 100 : 0;
  const isLandlocked = coastlinePercent < 5;
  const hasCoastline = !isLandlocked;

  return { hasCoastline, isLandlocked, estimatedCoastlineKm, totalSharedBorderKm, coastlinePercent };
}

// ─────────────────────────────────────────────
// Analysis: Shape
// ─────────────────────────────────────────────

interface ShapeResult {
  compactnessRatio: number;
  compactnessDescription: string;
  elongationRatio: number;
  elongationDescription: string;
  fragmentCount: number;
  islandCount: number;
  mainlandAreaKm2: number;
}

function analyzeShape(country: Feature, areaKm2: number, perimeterKm: number, nsSpanKm: number, ewSpanKm: number): ShapeResult {
  // Polsby-Popper compactness: 4 * PI * area / perimeter²
  const perimeterM = perimeterKm * 1000;
  const areaM2 = areaKm2 * 1e6;
  const compactnessRatio = perimeterM > 0 ? (4 * Math.PI * areaM2) / (perimeterM * perimeterM) : 0;

  let compactnessDescription: string;
  if (compactnessRatio > 0.6) compactnessDescription = "Very compact (near-circular)";
  else if (compactnessRatio > 0.4) compactnessDescription = "Moderately compact";
  else if (compactnessRatio > 0.2) compactnessDescription = "Elongated or irregular";
  else compactnessDescription = "Highly irregular or fragmented";

  const elongationRatio = Math.min(nsSpanKm, ewSpanKm) > 0
    ? Math.max(nsSpanKm, ewSpanKm) / Math.min(nsSpanKm, ewSpanKm)
    : 1;

  let elongationDescription: string;
  if (elongationRatio < 1.3) elongationDescription = "Roughly equidimensional";
  else if (elongationRatio < 2.0) elongationDescription = nsSpanKm > ewSpanKm ? "Slightly elongated N-S" : "Slightly elongated E-W";
  else if (elongationRatio < 3.0) elongationDescription = nsSpanKm > ewSpanKm ? "Elongated N-S" : "Elongated E-W";
  else elongationDescription = nsSpanKm > ewSpanKm ? "Very elongated N-S" : "Very elongated E-W";

  const fragmentCount = getPolygonCount(country);

  // Detect islands: polygons that are < 10% of the total area
  let islandCount = 0;
  let mainlandAreaKm2 = areaKm2;
  if (country.geometry.type === "MultiPolygon") {
    const coords = (country.geometry as MultiPolygon).coordinates;
    const areas = coords.map((polyCoords) => {
      const poly = turf.polygon(polyCoords);
      return turf.area(poly) / 1e6;
    });
    const maxArea = Math.max(...areas);
    islandCount = areas.filter((a) => a < maxArea * 0.1).length;
    mainlandAreaKm2 = maxArea;
  }

  return {
    compactnessRatio,
    compactnessDescription,
    elongationRatio,
    elongationDescription,
    fragmentCount,
    islandCount,
    mainlandAreaKm2,
  };
}

// ─────────────────────────────────────────────
// Analysis: Ice Cap Coverage
// ─────────────────────────────────────────────

interface IcecapResult {
  hasIcecaps: boolean;
  icecapAreaKm2: number;
  icecapPercent: number;
}

function analyzeIcecaps(country: PolyFeature, icecapFeatures: Feature[], countryBbox: turf.BBox, countryAreaKm2: number): IcecapResult {
  let icecapAreaKm2 = 0;

  for (const iceFeat of icecapFeatures) {
    const iceBbox = turf.bbox(iceFeat);
    if (!bboxOverlaps(countryBbox, iceBbox)) continue;

    try {
      if (!turf.booleanIntersects(country, iceFeat)) continue;
    } catch {
      continue;
    }

    const intersection = safeIntersect(country, iceFeat as PolyFeature);
    if (intersection) {
      icecapAreaKm2 += turf.area(intersection) / 1e6;
    }
  }

  return {
    hasIcecaps: icecapAreaKm2 > 0,
    icecapAreaKm2,
    icecapPercent: countryAreaKm2 > 0 ? (icecapAreaKm2 / countryAreaKm2) * 100 : 0,
  };
}

// ─────────────────────────────────────────────
// Output: Console Report
// ─────────────────────────────────────────────

function progressBar(percent: number, width = 30): string {
  const filled = Math.round((percent / 100) * width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function printReport(
  countryName: string,
  area: AreaResult,
  elevation: ElevationResult,
  climate: ClimateResult,
  hydro: HydrographyResult,
  position: PositionResult,
  neighbors: NeighborResult[],
  coastline: CoastlineResult,
  shape: ShapeResult,
  icecaps: IcecapResult
) {
  const W = 72;
  const line = "\u2500".repeat(W);
  const dline = "\u2550".repeat(W);

  console.log();
  console.log(`\u2554${dline}\u2557`);
  console.log(`\u2551${`  GEOGRAPHIC REPORT: ${countryName.toUpperCase()}`.padEnd(W)}\u2551`);
  console.log(`\u2560${dline}\u2563`);
  console.log(`\u2551${`  Generated: ${new Date().toISOString().split("T")[0]}`.padEnd(W)}\u2551`);
  console.log(`\u255A${dline}\u255D`);

  // Area & Dimensions
  console.log(`\n\u2500\u2500\u2500 AREA & DIMENSIONS ${line.slice(20)}`);
  console.log(`  Total Area:            ${formatNumber(area.areaKm2)} km\u00B2 (${formatNumber(area.areaSqMi)} sq mi)`);
  console.log(`  Bounding Box:          ${Math.abs(area.bbox[1]).toFixed(2)}\u00B0${area.bbox[1] >= 0 ? "N" : "S"} to ${Math.abs(area.bbox[3]).toFixed(2)}\u00B0${area.bbox[3] >= 0 ? "N" : "S"}, ${Math.abs(area.bbox[0]).toFixed(2)}\u00B0${area.bbox[0] >= 0 ? "E" : "W"} to ${Math.abs(area.bbox[2]).toFixed(2)}\u00B0${area.bbox[2] >= 0 ? "E" : "W"}`);
  console.log(`  North-South Span:      ${formatNumber(area.nsSpanKm)} km`);
  console.log(`  East-West Span:        ${formatNumber(area.ewSpanKm)} km`);
  console.log(`  Centroid:              ${formatCoord(area.centroid[1], area.centroid[0])}`);
  console.log(`  Total Perimeter:       ${formatNumber(area.perimeterKm)} km`);

  // Real-world comparison
  const earthLandArea = 148_940_000;
  const earthPercent = (area.areaKm2 / earthLandArea) * 100;
  // Find closest real-world country by area
  const realCountries = [
    { name: "Russia", area: 17098242 }, { name: "Canada", area: 9984670 },
    { name: "United States", area: 9833517 }, { name: "China", area: 9596961 },
    { name: "Brazil", area: 8515767 }, { name: "Australia", area: 7692024 },
    { name: "India", area: 3287263 }, { name: "Argentina", area: 2780400 },
    { name: "Kazakhstan", area: 2724900 }, { name: "Algeria", area: 2381741 },
    { name: "DR Congo", area: 2344858 }, { name: "Saudi Arabia", area: 2149690 },
    { name: "Mexico", area: 1964375 }, { name: "Indonesia", area: 1904569 },
    { name: "Sudan", area: 1861484 }, { name: "Libya", area: 1759540 },
    { name: "Iran", area: 1648195 }, { name: "Mongolia", area: 1564116 },
    { name: "Peru", area: 1285216 }, { name: "Chad", area: 1284000 },
    { name: "Niger", area: 1267000 }, { name: "Angola", area: 1246700 },
    { name: "Mali", area: 1240192 }, { name: "South Africa", area: 1221037 },
    { name: "Colombia", area: 1141748 }, { name: "Ethiopia", area: 1104300 },
    { name: "Bolivia", area: 1098581 }, { name: "Mauritania", area: 1030700 },
    { name: "Egypt", area: 1002450 }, { name: "Tanzania", area: 945087 },
    { name: "Nigeria", area: 923768 }, { name: "Venezuela", area: 916445 },
    { name: "Pakistan", area: 881913 }, { name: "Mozambique", area: 801590 },
    { name: "Turkey", area: 783562 }, { name: "Chile", area: 756102 },
    { name: "Zambia", area: 752618 }, { name: "Myanmar", area: 676578 },
    { name: "Afghanistan", area: 652230 }, { name: "France", area: 640679 },
    { name: "Somalia", area: 637657 }, { name: "Central African Republic", area: 622984 },
    { name: "Ukraine", area: 603500 }, { name: "Madagascar", area: 587041 },
    { name: "Botswana", area: 581730 }, { name: "Kenya", area: 580367 },
    { name: "Thailand", area: 513120 }, { name: "Spain", area: 505992 },
    { name: "Turkmenistan", area: 488100 }, { name: "Cameroon", area: 475442 },
    { name: "Papua New Guinea", area: 462840 }, { name: "Sweden", area: 450295 },
    { name: "Uzbekistan", area: 447400 }, { name: "Morocco", area: 446550 },
    { name: "Iraq", area: 438317 }, { name: "Paraguay", area: 406752 },
    { name: "Zimbabwe", area: 390757 }, { name: "Japan", area: 377975 },
    { name: "Germany", area: 357022 }, { name: "Philippines", area: 300000 },
    { name: "Italy", area: 301340 }, { name: "United Kingdom", area: 242495 },
    { name: "Romania", area: 238391 }, { name: "Ghana", area: 238533 },
    { name: "Nepal", area: 147181 }, { name: "Greece", area: 131957 },
    { name: "North Korea", area: 120538 }, { name: "Portugal", area: 92212 },
    { name: "South Korea", area: 100210 }, { name: "Hungary", area: 93028 },
    { name: "Austria", area: 83871 }, { name: "Czech Republic", area: 78867 },
    { name: "Ireland", area: 70273 }, { name: "Sri Lanka", area: 65610 },
    { name: "Switzerland", area: 41285 }, { name: "Netherlands", area: 41543 },
    { name: "Belgium", area: 30528 }, { name: "Israel", area: 20770 },
    { name: "Slovenia", area: 20273 }, { name: "Jamaica", area: 10991 },
    { name: "Cyprus", area: 9251 }, { name: "Luxembourg", area: 2586 },
  ];
  const closest = realCountries.reduce((best, c) => {
    const ratio = Math.abs(Math.log(c.area / area.areaKm2));
    return ratio < best.ratio ? { name: c.name, area: c.area, ratio } : best;
  }, { name: "", area: 0, ratio: Infinity });
  console.log(`  Real-World Comparison: ~${earthPercent.toFixed(4)}% of Earth's land (comparable to ${closest.name}: ${formatNumber(closest.area)} km\u00B2)`);

  // Elevation
  console.log(`\n\u2500\u2500\u2500 ELEVATION PROFILE ${line.slice(21)}`);
  if (elevation.zones.length === 0) {
    console.log(`  No elevation data available.`);
  } else {
    const maxNameLen = Math.max(...elevation.zones.map((z) => z.zoneName.length));
    for (const z of elevation.zones) {
      const bar = progressBar(z.percent, 20);
      console.log(`  ${z.zoneName.padEnd(maxNameLen)}  ${formatNumber(z.areaKm2).padStart(10)} km\u00B2  ${z.percent.toFixed(1).padStart(5)}%  ${bar}  ${z.elevationMin}-${z.elevationMax}m`);
    }
    console.log();
    console.log(`  Elevation Range:       ${formatNumber(elevation.minElevation)} - ${formatNumber(elevation.maxElevation)} m`);
    console.log(`  Mean Elevation:        ${formatNumber(elevation.meanElevation)} m`);
    console.log(`  Dominant Terrain:      ${elevation.dominantTerrain}`);
    console.log(`  Terrain Roughness:     ${elevation.terrainRoughness.toFixed(4)} (zones/\u221Akm\u00B2)`);
  }

  // Climate
  console.log(`\n\u2500\u2500\u2500 CLIMATE ANALYSIS ${line.slice(20)}`);
  if (climate.zones.length === 0) {
    console.log(`  No climate data available.`);
  } else {
    const maxTypeLen = Math.max(...climate.zones.map((z) => z.type.length));
    for (const z of climate.zones) {
      const bar = progressBar(z.percent, 20);
      console.log(`  ${z.type.padEnd(maxTypeLen)}  ${formatNumber(z.areaKm2).padStart(10)} km\u00B2  ${z.percent.toFixed(1).padStart(5)}%  ${bar}`);
    }
    console.log();
    console.log(`  Dominant Climate:      ${climate.dominantType}`);
    console.log(`  Climate Diversity:     ${climate.diversityIndex.toFixed(3)} (Shannon index; higher = more diverse)`);
    console.log(`  Est. Mean Temperature: ${climate.estMeanTempC.toFixed(1)}\u00B0C (${climate.estMeanTempF.toFixed(1)}\u00B0F)`);
    console.log(`  Est. Summer High:      ${climate.estSummerHighC.toFixed(1)}\u00B0C (${(climate.estSummerHighC * 9 / 5 + 32).toFixed(1)}\u00B0F)`);
    console.log(`  Est. Winter Low:       ${climate.estWinterLowC.toFixed(1)}\u00B0C (${(climate.estWinterLowC * 9 / 5 + 32).toFixed(1)}\u00B0F)`);
    console.log(`  Seasonal Range:        \u00B1${(climate.estSeasonalRangeC / 2).toFixed(1)}\u00B0C`);
    console.log(`  Est. Annual Precip:    ${formatNumber(climate.estAnnualPrecipMm)} mm/yr`);

    // Climate zone descriptions
    console.log();
    console.log(`  Climate Zone Descriptions:`);
    for (const z of climate.zones.slice(0, 4)) {
      console.log(`    ${z.type}: ${z.description}`);
    }
  }

  // Hydrography
  console.log(`\n\u2500\u2500\u2500 HYDROGRAPHY ${line.slice(15)}`);
  console.log(`  Rivers:                ${hydro.riverCount} (${formatNumber(hydro.totalRiverLengthKm)} km total within borders)`);
  console.log(`  Lakes:                 ${hydro.lakeCount} (${formatNumber(hydro.totalLakeAreaKm2, 1)} km\u00B2 total area)`);
  console.log(`  Drainage Density:      ${hydro.drainageDensity.toFixed(3)} km/km\u00B2`);

  // Drainage classification
  let drainageClass: string;
  if (hydro.drainageDensity < 0.5) drainageClass = "Low (arid or permeable terrain)";
  else if (hydro.drainageDensity < 1.0) drainageClass = "Moderate";
  else if (hydro.drainageDensity < 2.0) drainageClass = "Moderate-High (well-watered)";
  else drainageClass = "High (impermeable terrain or high precipitation)";
  console.log(`  Drainage Class:        ${drainageClass}`);

  if (hydro.lakeCount > 0 && area.areaKm2 > 0) {
    const lakeCoverage = (hydro.totalLakeAreaKm2 / area.areaKm2) * 100;
    console.log(`  Lake Coverage:         ${lakeCoverage.toFixed(2)}% of total area`);
  }

  // Position
  console.log(`\n\u2500\u2500\u2500 GEOGRAPHIC POSITION ${line.slice(22)}`);
  console.log(`  Hemisphere:            ${position.hemisphere}`);
  console.log(`  Latitude Band:         ${position.latitudeBand}`);
  console.log(`  Atmospheric Zone:      ${position.latitudeClassification}`);
  console.log(`  Distance from Equator: ${formatNumber(position.distanceFromEquatorKm)} km`);
  console.log(`  Approx. Timezone:      ${position.approximateTimezone}`);

  // Icecaps
  if (icecaps.hasIcecaps) {
    console.log(`\n\u2500\u2500\u2500 ICE COVERAGE ${line.slice(16)}`);
    console.log(`  Ice Cap Area:          ${formatNumber(icecaps.icecapAreaKm2, 1)} km\u00B2`);
    console.log(`  Ice Coverage:          ${icecaps.icecapPercent.toFixed(1)}% of total area`);
  }

  // Neighbors
  console.log(`\n\u2500\u2500\u2500 NEIGHBORS ${line.slice(12)}`);
  if (neighbors.length === 0) {
    console.log(`  No neighboring countries detected (island nation).`);
  } else {
    const maxNLen = Math.max(...neighbors.map((n) => n.name.length));
    console.log(`  ${"Country".padEnd(maxNLen)}  Direction  Shared Border`);
    console.log(`  ${"\u2500".repeat(maxNLen)}  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
    for (const n of neighbors) {
      const border = n.estimatedSharedBorderKm > 0
        ? `~${formatNumber(n.estimatedSharedBorderKm)} km`
        : "< 1 km";
      console.log(`  ${n.name.padEnd(maxNLen)}  ${n.direction.padEnd(9)}  ${border}`);
    }
    console.log(`\n  Total Neighbors:       ${neighbors.length}`);
  }

  // Coastline
  console.log(`\n\u2500\u2500\u2500 COASTLINE & MARITIME ${line.slice(23)}`);
  console.log(`  Coastal Status:        ${coastline.isLandlocked ? "LANDLOCKED" : "Coastal nation"}`);
  if (coastline.hasCoastline) {
    console.log(`  Est. Coastline:        ~${formatNumber(coastline.estimatedCoastlineKm)} km`);
    console.log(`  Coastline/Perimeter:   ${coastline.coastlinePercent.toFixed(1)}%`);
    console.log(`  Total Land Borders:    ~${formatNumber(coastline.totalSharedBorderKm)} km`);
  } else {
    console.log(`  Total Land Borders:    ~${formatNumber(coastline.totalSharedBorderKm)} km`);
  }

  // Shape
  console.log(`\n\u2500\u2500\u2500 SHAPE ANALYSIS ${line.slice(18)}`);
  console.log(`  Compactness (P-P):     ${shape.compactnessRatio.toFixed(3)} (${shape.compactnessDescription})`);
  console.log(`  Elongation Ratio:      ${shape.elongationRatio.toFixed(2)} (${shape.elongationDescription})`);
  console.log(`  Land Fragments:        ${shape.fragmentCount}${shape.islandCount > 0 ? ` (${shape.fragmentCount - shape.islandCount} mainland + ${shape.islandCount} island${shape.islandCount > 1 ? "s" : ""})` : ""}`);
  if (shape.islandCount > 0) {
    console.log(`  Mainland Area:         ${formatNumber(shape.mainlandAreaKm2)} km\u00B2 (${((shape.mainlandAreaKm2 / area.areaKm2) * 100).toFixed(1)}%)`);
  }

  console.log();
  console.log(`\u2550`.repeat(W + 2));
  console.log();
}

// ─────────────────────────────────────────────
// Output: JSON
// ─────────────────────────────────────────────

function printJSON(
  countryName: string,
  featureId: string,
  area: AreaResult,
  elevation: ElevationResult,
  climate: ClimateResult,
  hydro: HydrographyResult,
  position: PositionResult,
  neighbors: NeighborResult[],
  coastline: CoastlineResult,
  shape: ShapeResult,
  icecaps: IcecapResult
) {
  const report = {
    country: countryName,
    featureId,
    generatedAt: new Date().toISOString(),
    area: {
      km2: Math.round(area.areaKm2),
      sqMi: Math.round(area.areaSqMi),
      boundingBox: {
        minLng: +area.bbox[0].toFixed(4),
        minLat: +area.bbox[1].toFixed(4),
        maxLng: +area.bbox[2].toFixed(4),
        maxLat: +area.bbox[3].toFixed(4),
      },
      nsSpanKm: Math.round(area.nsSpanKm),
      ewSpanKm: Math.round(area.ewSpanKm),
      centroid: { lng: +area.centroid[0].toFixed(4), lat: +area.centroid[1].toFixed(4) },
      perimeterKm: Math.round(area.perimeterKm),
    },
    elevation: {
      zones: elevation.zones.map((z) => ({
        zone: z.zoneName,
        minM: z.elevationMin,
        maxM: z.elevationMax,
        areaKm2: Math.round(z.areaKm2),
        percent: +z.percent.toFixed(1),
      })),
      minElevationM: elevation.minElevation,
      maxElevationM: elevation.maxElevation,
      meanElevationM: Math.round(elevation.meanElevation),
      dominantTerrain: elevation.dominantTerrain,
      terrainRoughness: +elevation.terrainRoughness.toFixed(4),
    },
    climate: {
      zones: climate.zones.map((z) => ({
        type: z.type,
        areaKm2: Math.round(z.areaKm2),
        percent: +z.percent.toFixed(1),
        description: z.description,
      })),
      dominantType: climate.dominantType,
      shannonDiversity: +climate.diversityIndex.toFixed(3),
      temperature: {
        meanC: +climate.estMeanTempC.toFixed(1),
        meanF: +climate.estMeanTempF.toFixed(1),
        summerHighC: +climate.estSummerHighC.toFixed(1),
        winterLowC: +climate.estWinterLowC.toFixed(1),
        seasonalRangeC: +climate.estSeasonalRangeC.toFixed(1),
      },
      annualPrecipitationMm: Math.round(climate.estAnnualPrecipMm),
    },
    hydrography: {
      riverCount: hydro.riverCount,
      totalRiverLengthKm: Math.round(hydro.totalRiverLengthKm),
      lakeCount: hydro.lakeCount,
      totalLakeAreaKm2: +hydro.totalLakeAreaKm2.toFixed(1),
      drainageDensity: +hydro.drainageDensity.toFixed(3),
    },
    position: {
      hemisphere: position.hemisphere,
      latitudeBand: position.latitudeBand,
      atmosphericZone: position.latitudeClassification,
      distanceFromEquatorKm: Math.round(position.distanceFromEquatorKm),
      timezone: position.approximateTimezone,
    },
    neighbors: neighbors.map((n) => ({
      name: n.name,
      direction: n.direction,
      sharedBorderKm: Math.round(n.estimatedSharedBorderKm),
    })),
    coastline: {
      hasCoastline: coastline.hasCoastline,
      isLandlocked: coastline.isLandlocked,
      coastlineKm: Math.round(coastline.estimatedCoastlineKm),
      landBorderKm: Math.round(coastline.totalSharedBorderKm),
      coastlinePercent: +coastline.coastlinePercent.toFixed(1),
    },
    shape: {
      compactnessRatio: +shape.compactnessRatio.toFixed(3),
      compactness: shape.compactnessDescription,
      elongationRatio: +shape.elongationRatio.toFixed(2),
      elongation: shape.elongationDescription,
      fragments: shape.fragmentCount,
      islands: shape.islandCount,
    },
    iceCoverage: {
      hasIcecaps: icecaps.hasIcecaps,
      areaKm2: Math.round(icecaps.icecapAreaKm2),
      percent: +icecaps.icecapPercent.toFixed(1),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const listMode = args.includes("--list");
  const positionalArgs = args.filter((a) => !a.startsWith("--"));

  // Load GeoJSON layers
  process.stderr.write("Loading GeoJSON layers...\n");
  const political = loadGeoJSON("political.geojson");
  const altitudes = loadGeoJSON("altitudes.geojson");
  const climateGeo = loadGeoJSON("climate.geojson");
  const rivers = loadGeoJSON("rivers.geojson");
  const lakes = loadGeoJSON("lakes.geojson");
  const icecapsGeo = loadGeoJSON("icecaps.geojson");
  process.stderr.write(`  Loaded: ${political.features.length} political, ${altitudes.features.length} altitude, ${climateGeo.features.length} climate, ${rivers.features.length} rivers, ${lakes.features.length} lakes, ${icecapsGeo.features.length} icecaps\n`);

  if (listMode) {
    const names = political.features
      .map((f) => featureIdToDisplayName(f.properties?.id ?? ""))
      .filter(Boolean)
      .sort();
    console.log(`\nAvailable countries (${names.length}):\n`);
    for (const name of names) console.log(`  ${name}`);
    console.log();
    return;
  }

  const countryName = positionalArgs.join(" ");
  if (!countryName) {
    console.error("Usage: npx tsx scripts/country-geo-report.ts \"Country Name\" [--json]");
    console.error("       npx tsx scripts/country-geo-report.ts --list");
    process.exit(1);
  }

  // Find the country
  const countryFeature = findCountry(countryName, political.features);
  if (!countryFeature) process.exit(1);

  const featureId = (countryFeature.properties?.id as string) ?? "";
  const displayName = featureIdToDisplayName(featureId);
  process.stderr.write(`\nAnalyzing: ${displayName} (feature ID: ${featureId})\n\n`);

  // Run analyses
  process.stderr.write("  Computing area & dimensions...\n");
  const area = analyzeArea(countryFeature);

  process.stderr.write("  Computing elevation profile...\n");
  const elevation = analyzeElevation(
    countryFeature as PolyFeature,
    altitudes.features,
    area.bbox,
    area.areaKm2
  );

  process.stderr.write("  Computing climate analysis...\n");
  const climate = analyzeClimate(
    countryFeature as PolyFeature,
    climateGeo.features,
    area.bbox,
    area.centroid[1],
    elevation.meanElevation
  );

  process.stderr.write("  Computing hydrography...\n");
  const hydro = analyzeHydrography(
    countryFeature as PolyFeature,
    rivers.features,
    lakes.features,
    area.bbox,
    area.areaKm2
  );

  process.stderr.write("  Computing geographic position...\n");
  const position = analyzePosition(area.centroid);

  process.stderr.write("  Computing neighbors...\n");
  const neighbors = analyzeNeighbors(
    countryFeature as PolyFeature,
    area.centroid,
    political.features,
    featureId
  );

  process.stderr.write("  Computing coastline analysis...\n");
  const coastlineResult = analyzeCoastline(area.perimeterKm, neighbors);

  process.stderr.write("  Computing shape analysis...\n");
  const shape = analyzeShape(countryFeature, area.areaKm2, area.perimeterKm, area.nsSpanKm, area.ewSpanKm);

  process.stderr.write("  Computing ice coverage...\n");
  const icecaps = analyzeIcecaps(
    countryFeature as PolyFeature,
    icecapsGeo.features,
    area.bbox,
    area.areaKm2
  );

  process.stderr.write("  Done!\n");

  // Output
  if (jsonMode) {
    printJSON(displayName, featureId, area, elevation, climate, hydro, position, neighbors, coastlineResult, shape, icecaps);
  } else {
    printReport(displayName, area, elevation, climate, hydro, position, neighbors, coastlineResult, shape, icecaps);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
