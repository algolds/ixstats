/**
 * World Generator - Orchestrator that calls all sub-generators in sequence.
 *
 * Pipeline (tectonic mode):
 *   1. Plate simulation → 2. Tectonic elevation → 3. Erosion →
 *   4. Sea level + land extraction → 5. Countries →
 *   6. Contour vectorization (altitudes) → 7. Climate system →
 *   8. Drainage + rivers → 9. Lakes → 10. Icecaps → 11. Validation
 *
 * Pipeline (legacy mode, useTectonicElevation=false):
 *   landmass → countries → terrain → water → assemble → validate
 *
 * When `similarity` > 0, uses profile-guided generation for IxWorld-like output.
 */

import type { FeatureCollection } from "geojson";
import {
  type LandmassParams,
  generateHeightmap,
  extractLandPolygons,
  simplifyPolygons,
} from "./landmass-generator";
import { generateCountries } from "./country-generator";
import { generateTerrain } from "./terrain-generator";
import { generateWater } from "./water-generator";
import { resolveProfile, computeGini, type WorldProfile } from "./world-profile";
import { validateGeneratedWorld } from "./generation-validator";
import { simulatePlates } from "./plate-simulation";
import { computeTectonicElevation } from "./tectonic-elevation";
import { applyErosion } from "./erosion";
import { extractDrainageNetwork } from "./drainage";
import { computeClimate, CLIMATE_TYPES, CLIMATE_COLORS, CLIMATE_NAMES } from "./climate-system";
import { extractAltitudeZones, extractClimateZones } from "./contour-vectorizer";
import { getGeneratorZones } from "../elevation-config";
import { LAYER_CONFIGS } from "../map-config";
import { createNoise, fractalNoise } from "./noise";
import { WorldNamingSystem } from "./markov-naming";
import { getLanguageFamilies } from "./language-families";
import { classifyBiomeGrid, extractBiomeFeatures } from "./biomes";
import { generateCultures } from "./culture-generator";
import { generatePopulation } from "./population-generator";
import { generateTradeRoutes } from "./trade-routes";

export interface WorldGenParams {
  seed: number;
  continentCount: number;      // 1-8, default 4
  countryCountRange: [number, number]; // default [20, 60]
  oceanPercentage: number;     // 0.4-0.8, default 0.65
  terrainRoughness: number;    // 0-1, default 0.5
  hasIcecaps: boolean;         // default true
  hasRivers: boolean;          // default true
  hasLakes: boolean;           // default true
  gridResolution: number;      // 256-1024, default 512
  /** 0.0 = fully random (legacy), 1.0 = tightly match profile */
  similarity?: number;
  /** Which world profile to target. Default: "IxWorld" */
  profileName?: string;
  /** Erosion intensity: 0 = skip, 0.5 = default, 1.0 = full. Default: 0.5 */
  erosionIntensity?: number;
  /** Climate detail level. Default: 'full' */
  climateDetail?: "simple" | "full";
  /** Use new tectonic plate elevation pipeline. Default: true. Set false for legacy noise. */
  useTectonicElevation?: boolean;
  /** Enable Markov chain naming with language families. Default: true */
  useMarkovNaming?: boolean;
  /** Specific language family IDs to use (null = use all). */
  languageFamilies?: string[];
}

export interface GeneratedWorld {
  seed: number;
  params: WorldGenParams;
  layers: Record<string, FeatureCollection>;
  stats: {
    landPercentage: number;
    countryCount: number;
    riverCount: number;
    lakeCount: number;
    altitudeZoneCount: number;
    climateZoneCount: number;
    icecapCount: number;
    biomeCount: number;
    cultureCount: number;
    cityCount: number;
    tradeRouteCount: number;
    generationTimeMs: number;
    /** Area inequality (0=equal, 1=max inequality) */
    areaGini: number;
    /** Fraction of countries that are landlocked */
    landlockedRatio: number;
    /** How closely output matches the target profile (0-1), null if no profile */
    profileSimilarity: number | null;
    /** Validation warnings */
    warnings: string[];
  };
}

export const DEFAULT_PARAMS: WorldGenParams = {
  seed: 42,
  continentCount: 4,
  countryCountRange: [20, 60],
  oceanPercentage: 0.65,
  terrainRoughness: 0.5,
  hasIcecaps: true,
  hasRivers: true,
  hasLakes: true,
  gridResolution: 512, // Quality default — matches IxWorld fidelity
  similarity: 0.5,     // Moderate profile matching for realistic output
  profileName: "IxWorld",
  erosionIntensity: 0.8, // Aggressive erosion for natural terrain
  climateDetail: "full",
  useTectonicElevation: true,
};

export const PRESETS: Record<string, Partial<WorldGenParams>> = {
  IxWorld: {
    continentCount: 6,
    countryCountRange: [160, 200],
    oceanPercentage: 0.65,
    terrainRoughness: 0.5,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    gridResolution: 512,  // Higher res for more altitude/terrain detail
    similarity: 0.8,
    profileName: "IxWorld",
  },
  "Earth-like": {
    continentCount: 6,
    countryCountRange: [40, 80],
    oceanPercentage: 0.7,
    terrainRoughness: 0.5,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    similarity: 0.5,
    profileName: "IxWorld",
  },
  Pangaea: {
    continentCount: 1,
    countryCountRange: [15, 40],
    oceanPercentage: 0.6,
    terrainRoughness: 0.6,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    similarity: 0.3,
  },
  Archipelago: {
    continentCount: 8,
    countryCountRange: [30, 80],
    oceanPercentage: 0.8,
    terrainRoughness: 0.3,
    hasIcecaps: false,
    hasRivers: false,
    hasLakes: true,
    similarity: 0.3,
  },
  Desert: {
    continentCount: 3,
    countryCountRange: [10, 30],
    oceanPercentage: 0.5,
    terrainRoughness: 0.7,
    hasIcecaps: false,
    hasRivers: false,
    hasLakes: false,
    similarity: 0.2,
  },
  Waterworld: {
    continentCount: 5,
    countryCountRange: [20, 50],
    oceanPercentage: 0.85,
    terrainRoughness: 0.3,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    similarity: 0.3,
  },
};

/**
 * Generate a complete procedural world from parameters.
 * All operations are deterministic for a given seed.
 */
export function generateWorld(params: WorldGenParams): GeneratedWorld {
  const startTime = performance.now();

  const useTectonic = params.useTectonicElevation !== false;

  // For low-res grids, fallback to legacy noise (tectonic plates need sufficient resolution)
  if (useTectonic && params.gridResolution >= 192) {
    return generateWorldTectonic(params, startTime);
  }

  return generateWorldLegacy(params, startTime);
}

/**
 * New tectonic pipeline:
 *   1. Plate simulation → 2. Tectonic elevation → 3. Erosion →
 *   4. Land extraction → 5. Countries → 6. Altitude contours →
 *   7. Climate → 8. Rivers (drainage) → 9. Lakes → 10. Icecaps → 11. Validate
 */
function generateWorldTectonic(params: WorldGenParams, startTime: number): GeneratedWorld {
  const similarity = params.similarity ?? 0;
  const profile: WorldProfile | undefined =
    similarity > 0 && params.profileName
      ? resolveProfile(params.profileName)
      : undefined;

  const width = params.gridResolution;
  const height = Math.round(params.gridResolution * 0.6);
  // Scale plates with continent count — more plates give smaller, more realistic sizes
  const plateCount = Math.max(8, params.continentCount * 2 + 6);
  const erosionIntensity = params.erosionIntensity ?? 0.8;

  // ── Step 1: Plate simulation ──
  const sim = simulatePlates(
    params.seed,
    width,
    height,
    plateCount,
    params.continentCount,
    params.oceanPercentage
  );

  // ── Step 2: Tectonic elevation ──
  const tecResult = computeTectonicElevation(
    sim,
    params.seed,
    params.terrainRoughness,
    params.oceanPercentage
  );

  // ── Step 3: Erosion ──
  applyErosion(tecResult.elevation, tecResult.isOcean, {
    seed: params.seed,
    intensity: erosionIntensity,
    width,
    height,
  });

  // ── Step 4: Build HeightmapResult + extract land polygons ──
  // Find sea level from the elevation data to match ocean percentage
  const sorted = Float32Array.from(tecResult.elevation).sort();
  const seaLevelIndex = Math.floor(params.oceanPercentage * sorted.length);
  const seaLevel = sorted[seaLevelIndex]!;

  const heightmapResult = {
    width,
    height,
    data: tecResult.elevation,
    seaLevel,
  };
  const landResult = extractLandPolygons(heightmapResult);
  const simplifyTolerance =
    params.gridResolution <= 256
      ? 0.3
      : params.gridResolution <= 512
        ? 0.2
        : 0.1;
  const landPolygons = simplifyPolygons(
    landResult.landPolygons,
    simplifyTolerance
  );

  // ── Step 5: Generate countries (with Markov naming if enabled) ──
  let namingSystem: WorldNamingSystem | undefined;
  let familyAssignments: Map<number, string> | undefined;
  const useMarkov = params.useMarkovNaming !== false;
  if (useMarkov) {
    const allFamilies = getLanguageFamilies();
    const families = params.languageFamilies
      ? allFamilies.filter((f) => params.languageFamilies!.includes(f.id))
      : allFamilies;
    if (families.length > 0) {
      namingSystem = new WorldNamingSystem(families, params.seed + 500);
      // Pre-assign families — will be refined once we know country neighbors
      const maxCountries = params.countryCountRange[1];
      const emptyNeighbors = new Map<number, number[]>();
      for (let i = 0; i < maxCountries; i++) emptyNeighbors.set(i, []);
      familyAssignments = namingSystem.assignFamilies(maxCountries, emptyNeighbors);
    }
  }
  const countryResult = generateCountries({
    seed: params.seed,
    countryCountRange: params.countryCountRange,
    landPolygons,
    heightmap: landResult.heightmap,
    profile,
    similarity,
    namingSystem,
    familyAssignments,
  });

  // ── Step 6: Altitude zone contour extraction ──
  const altitudeZones = getGeneratorZones();
  const thresholds: number[] = [];
  // Build thresholds from elevation config (normalize to [0,1] based on max 9999m)
  for (const zone of altitudeZones) {
    if (zone.elevationMax < 9999) {
      thresholds.push(zone.elevationMax / 9999);
    }
  }
  thresholds.sort((a, b) => a - b);

  const zoneNames = altitudeZones.map((z) => z.name);
  const zoneColors = altitudeZones.map((z) => z.color);

  const altitudeFeatures = extractAltitudeZones(
    tecResult.elevation,
    tecResult.isOcean,
    width,
    height,
    thresholds,
    zoneNames,
    zoneColors,
    params.seed
  );

  // ── Step 7: Climate system ──
  const climateResult = computeClimate(
    tecResult.elevation,
    tecResult.isOcean,
    width,
    height,
    params.seed
  );

  const climateTypeNames = CLIMATE_TYPES.map((t) => CLIMATE_NAMES[t]);
  const climateTypeColors = CLIMATE_TYPES.map((t) => CLIMATE_COLORS[t]);
  const climateFeatures = extractClimateZones(
    climateResult.climateType,
    tecResult.isOcean,
    width,
    height,
    climateTypeNames,
    climateTypeColors,
    params.seed
  );

  // ── Step 8: Rivers via drainage network ──
  let riverFeatures: FeatureCollection = { type: "FeatureCollection", features: [] };
  let drainage: ReturnType<typeof extractDrainageNetwork> | undefined;
  if (params.hasRivers) {
    drainage = extractDrainageNetwork(
      tecResult.elevation,
      tecResult.isOcean,
      width,
      height,
      undefined,
      1200
    );

    const riverColor = LAYER_CONFIGS.rivers.strokeColor ?? LAYER_CONFIGS.rivers.fillColor as string;
    const meanderNoise = createNoise(params.seed + 410);
    riverFeatures = {
      type: "FeatureCollection",
      features: drainage.rivers.map((river, i) => {
        // Add meander displacement to river coordinates for natural appearance
        const coords = river.coordinates.map((coord, ci) => {
          if (ci === 0 || ci === river.coordinates.length - 1) return coord;
          const mx = fractalNoise(meanderNoise, ci * 0.3 + i * 97.31, 0, 2) * 0.04;
          const my = fractalNoise(meanderNoise, ci * 0.3 + i * 97.31, 50, 2) * 0.02;
          return [coord[0]! + mx, coord[1]! + my] as [number, number];
        });
        return {
          type: "Feature" as const,
          id: `river-${i}`,
          geometry: { type: "LineString" as const, coordinates: coords },
          properties: {
            featureId: `river-${i}`,
            displayName: generateRiverName(params.seed + i),
            type: "river",
            fill: riverColor,
            strahlerOrder: river.strahlerOrder,
          },
        };
      }),
    };
  }

  // ── Step 9: Lakes ──
  let lakeFeatures: FeatureCollection = { type: "FeatureCollection", features: [] };
  if (params.hasLakes) {
    // Use legacy lake generation (works with any heightmap)
    const waterResult = generateWater({
      seed: params.seed,
      heightmap: landResult.heightmap,
      hasRivers: false, // Rivers already handled by drainage
      hasLakes: true,
    });
    lakeFeatures = waterResult.lakeFeatures;
  }

  // ── Step 10: Icecaps ──
  let icecapFeatures: FeatureCollection | null = null;
  if (params.hasIcecaps) {
    icecapFeatures = generateIcecaps(params.seed);
  }

  // ── Step 11: Biome classification ──
  let biomeFeatures: FeatureCollection = { type: "FeatureCollection", features: [] };
  let biomeGrid: ReturnType<typeof classifyBiomeGrid> | undefined;
  if (climateResult) {
    biomeGrid = classifyBiomeGrid(
      climateResult.temperature,
      climateResult.precipitation,
      landResult.heightmap,
      width,
      height
    );
    biomeFeatures = extractBiomeFeatures(biomeGrid, landResult.heightmap);
  }

  // Build river cell set from drainage for downstream consumers
  const riverCells = new Set<number>();
  if (drainage) {
    for (const river of drainage.rivers) {
      for (const cell of river.cells) riverCells.add(cell);
    }
  }

  // ── Step 12: Culture generation (with biome + river data) ──
  const allFamilies = getLanguageFamilies();
  const cultureResult = generateCultures({
    seed: params.seed + 600,
    heightmap: landResult.heightmap,
    families: allFamilies,
    countryCount: countryResult.countries.length,
    biomeGrid,
    riverCells: riverCells.size > 0 ? riverCells : undefined,
  });

  // ── Step 13: Population & cities (with river distance + biome habitability) ──
  const popResult = generatePopulation({
    seed: params.seed + 700,
    heightmap: landResult.heightmap,
    tempGrid: climateResult?.temperature,
    precipGrid: climateResult?.precipitation,
    countryCount: countryResult.countries.length,
    riverCells: riverCells.size > 0 ? riverCells : undefined,
    biomeGrid,
  });

  // ── Step 14: Trade routes (with biome-aware costs) ──
  const tradeResult = generateTradeRoutes({
    heightmap: landResult.heightmap,
    cities: popResult.cities,
    maxPairs: 80,
    biomeGrid,
  });

  // ── Step 15: Assemble + Validate ──
  const capFeatures = (
    fc: FeatureCollection,
    max: number
  ): FeatureCollection => {
    if (fc.features.length <= max) return fc;
    return { type: "FeatureCollection", features: fc.features.slice(0, max) };
  };

  const layers: Record<string, FeatureCollection> = {
    altitudes: capFeatures(altitudeFeatures, 5000),
    climate: capFeatures(climateFeatures, 1000),
    political: capFeatures(countryResult.featureCollection, 300),
    rivers: capFeatures(riverFeatures, 1200),
    lakes: capFeatures(lakeFeatures, 500),
    biomes: capFeatures(biomeFeatures, 2000),
    cities: capFeatures(popResult.featureCollection, 500),
    trade_routes: capFeatures(tradeResult.featureCollection, 200),
  };

  if (icecapFeatures) {
    layers.icecaps = icecapFeatures;
  }

  const validation = validateGeneratedWorld(
    countryResult.countries,
    profile ?? null
  );

  const generationTimeMs = performance.now() - startTime;

  const areas = countryResult.countries.map((c) => c.areaKm2);
  const areaGini = computeGini(areas);
  const landlockedCount = countryResult.countries.filter(
    (c) => c.coastalPerimeter === 0
  ).length;
  const landlockedRatio =
    countryResult.countries.length > 0
      ? landlockedCount / countryResult.countries.length
      : 0;

  return {
    seed: params.seed,
    params,
    layers,
    stats: {
      landPercentage: landResult.landPercentage,
      countryCount: countryResult.countries.length,
      riverCount: riverFeatures.features.length,
      lakeCount: lakeFeatures.features.length,
      altitudeZoneCount: altitudeFeatures.features.length,
      climateZoneCount: climateFeatures.features.length,
      icecapCount: icecapFeatures?.features.length ?? 0,
      biomeCount: biomeFeatures.features.length,
      cultureCount: cultureResult.cultures.length,
      cityCount: popResult.cities.length,
      tradeRouteCount: tradeResult.routes.length,
      generationTimeMs,
      areaGini,
      landlockedRatio,
      profileSimilarity: validation.profileSimilarity,
      warnings: validation.warnings,
    },
  };
}

/**
 * Legacy pipeline (noise-based, no plate tectonics).
 * Used when useTectonicElevation=false or gridResolution < 192.
 */
function generateWorldLegacy(params: WorldGenParams, startTime: number): GeneratedWorld {
  const similarity = params.similarity ?? 0;
  const profile: WorldProfile | undefined =
    similarity > 0 && params.profileName
      ? resolveProfile(params.profileName)
      : undefined;

  // Step 1: Generate landmasses
  const landmassParams: LandmassParams = {
    seed: params.seed,
    gridResolution: params.gridResolution,
    continentCount: params.continentCount,
    oceanPercentage: params.oceanPercentage,
    terrainRoughness: params.terrainRoughness,
    hasIcecaps: params.hasIcecaps,
    profile,
    similarity,
  };

  const heightmapResult = generateHeightmap(landmassParams);
  const landResult = extractLandPolygons(heightmapResult);
  const simplifyTolerance =
    params.gridResolution <= 256
      ? 0.3
      : params.gridResolution <= 512
        ? 0.2
        : 0.1;
  const landPolygons = simplifyPolygons(
    landResult.landPolygons,
    simplifyTolerance
  );

  // Step 2: Generate countries (with Markov naming if enabled)
  let legacyNaming: WorldNamingSystem | undefined;
  let legacyFamilyAssignments: Map<number, string> | undefined;
  if (params.useMarkovNaming !== false) {
    const allFamilies = getLanguageFamilies();
    const families = params.languageFamilies
      ? allFamilies.filter((f) => params.languageFamilies!.includes(f.id))
      : allFamilies;
    if (families.length > 0) {
      legacyNaming = new WorldNamingSystem(families, params.seed + 500);
      const maxC = params.countryCountRange[1];
      const emptyN = new Map<number, number[]>();
      for (let i = 0; i < maxC; i++) emptyN.set(i, []);
      legacyFamilyAssignments = legacyNaming.assignFamilies(maxC, emptyN);
    }
  }
  const countryResult = generateCountries({
    seed: params.seed,
    countryCountRange: params.countryCountRange,
    landPolygons,
    heightmap: landResult.heightmap,
    profile,
    similarity,
    namingSystem: legacyNaming,
    familyAssignments: legacyFamilyAssignments,
  });

  // Step 3: Generate terrain (altitude zones + climate)
  const collisionZones = heightmapResult.extra?.collisionZones;
  const terrainResult = generateTerrain({
    seed: params.seed,
    heightmap: landResult.heightmap,
    terrainRoughness: params.terrainRoughness,
    hasIcecaps: params.hasIcecaps,
    collisionZones,
  });

  // Step 4: Generate water (rivers + lakes)
  const waterResult = generateWater({
    seed: params.seed,
    heightmap: landResult.heightmap,
    hasRivers: params.hasRivers,
    hasLakes: params.hasLakes,
  });

  const capFeatures = (
    fc: FeatureCollection,
    max: number
  ): FeatureCollection => {
    if (fc.features.length <= max) return fc;
    return { type: "FeatureCollection", features: fc.features.slice(0, max) };
  };

  const layers: Record<string, FeatureCollection> = {
    altitudes: capFeatures(terrainResult.altitudeFeatures, 5000),
    climate: capFeatures(terrainResult.climateFeatures, 1000),
    political: capFeatures(countryResult.featureCollection, 300),
    rivers: capFeatures(waterResult.riverFeatures, 1200),
    lakes: capFeatures(waterResult.lakeFeatures, 500),
  };

  if (terrainResult.icecapFeatures) {
    layers.icecaps = terrainResult.icecapFeatures;
  }

  const validation = validateGeneratedWorld(
    countryResult.countries,
    profile ?? null
  );

  const generationTimeMs = performance.now() - startTime;

  const areas = countryResult.countries.map((c) => c.areaKm2);
  const areaGini = computeGini(areas);
  const landlockedCount = countryResult.countries.filter(
    (c) => c.coastalPerimeter === 0
  ).length;
  const landlockedRatio =
    countryResult.countries.length > 0
      ? landlockedCount / countryResult.countries.length
      : 0;

  return {
    seed: params.seed,
    params,
    layers,
    stats: {
      landPercentage: landResult.landPercentage,
      countryCount: countryResult.countries.length,
      riverCount: waterResult.riverFeatures.features.length,
      lakeCount: waterResult.lakeFeatures.features.length,
      altitudeZoneCount: terrainResult.altitudeFeatures.features.length,
      climateZoneCount: terrainResult.climateFeatures.features.length,
      icecapCount: terrainResult.icecapFeatures?.features.length ?? 0,
      biomeCount: 0,
      cultureCount: 0,
      cityCount: 0,
      tradeRouteCount: 0,
      generationTimeMs,
      areaGini,
      landlockedRatio,
      profileSimilarity: validation.profileSimilarity,
      warnings: validation.warnings,
    },
  };
}

// ─── Shared Helpers ──────────────────────────────────────────

function generateRiverName(seed: number): string {
  let s = seed | 0;
  if (s === 0) s = 1;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff; };
  const prefixes = ["Great", "Blue", "White", "Green", "Red", "Silver", "Golden", "Dark", "Clear", "Long"];
  const roots = ["water", "stream", "flow", "run", "brook", "bourne", "wye", "avon", "don", "ouse"];
  return `${prefixes[Math.floor(rng() * prefixes.length)]} ${roots[Math.floor(rng() * roots.length)]}`;
}

function generateIcecaps(seed: number): FeatureCollection {
  const noise = createNoise(seed + 80);
  const features: FeatureCollection["features"] = [];
  const SECTORS = 6;
  const POINTS_PER_ARC = 400;

  for (const pole of [1, -1]) {
    const baseLat = pole === 1 ? 90 : -90;
    const baseRadius = pole === 1 ? 5 : 8;
    const noiseAmp = pole === 1 ? 1.5 : 2.0;
    const noiseOffset = pole === 1 ? 0 : 10;

    for (let seg = 0; seg < SECTORS; seg++) {
      const startAngle = (seg / SECTORS) * Math.PI * 2;
      const endAngle = ((seg + 1) / SECTORS) * Math.PI * 2;
      const segPoints: [number, number][] = [];

      for (let i = 0; i <= POINTS_PER_ARC; i++) {
        const angle = startAngle + (i / POINTS_PER_ARC) * (endAngle - startAngle);
        const nx = Math.cos(angle) * 0.5 + 0.5;
        const ny = Math.sin(angle) * 0.5 + 0.5;
        const jitter = fractalNoise(noise, nx * 8 + noiseOffset, ny * 8, 4) * noiseAmp;
        const radius = baseRadius + jitter;
        segPoints.push([Math.cos(angle) * 180, baseLat - pole * radius]);
      }

      const lastArc = segPoints[segPoints.length - 1]!;
      const firstArc = segPoints[0]!;

      for (let r = 1; r <= 3; r++) {
        const t = r / 4;
        segPoints.push([lastArc[0] * (1 - t), lastArc[1] + (baseLat - lastArc[1]) * t]);
      }
      for (let r = 3; r >= 1; r--) {
        const t = r / 4;
        segPoints.push([firstArc[0] * (1 - t), firstArc[1] + (baseLat - firstArc[1]) * t]);
      }
      segPoints.push(segPoints[0]!);

      const idx = features.length;
      features.push({
        type: "Feature",
        id: `icecap-${idx}`,
        geometry: { type: "Polygon", coordinates: [segPoints] },
        properties: {
          featureId: `icecap-${idx}`,
          displayName: pole === 1 ? "North Polar Ice" : "South Polar Ice",
          fill: LAYER_CONFIGS.icecaps.fillColor as string,
        },
      });
    }
  }

  return { type: "FeatureCollection", features };
}
