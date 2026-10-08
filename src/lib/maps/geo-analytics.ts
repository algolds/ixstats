/** Climate zone distribution entry for a country */
export interface ClimateZoneEntry {
  type: string; // Full name e.g. "Tropical Wet (Ar)"
  code?: string; // Short code e.g. "Ar"
  name?: string; // Display name e.g. "Tropical Wet"
  color?: string; // A realm climate key's zone colour
  percentArea: number; // 0–100
  areaSqKm: number;
  agricultureFactor: number; // 0.0–0.9
}

/** Elevation zone distribution entry for a country */
export interface ElevationZoneEntry {
  zone: string; // e.g. "zone_4"
  name: string; // e.g. "Low Mountains"
  percentArea: number; // 0–100
  areaSqKm: number;
  minElev: number;
  maxElev: number;
}

/** Full geographic profile for a country */
interface GeoProfile {
  arableLandPercent: number;
  coastlineKm: number;
  isLandlocked: boolean;
  isIsland: boolean;
  neighborCount: number;
  dominantClimate: string | null;
  dominantElevation: string | null;
  meanElevation: number;
  terrainRoughness: number;
  climateDiversity: number;
  climateDistribution: ClimateZoneEntry[];
  elevationProfile: ElevationZoneEntry[];
  drainageDensity: number;
  totalRiverLengthKm: number;
  totalLakeAreaSqKm: number;
}

/** NPC personality trait names (matches diplomatic-npc-personality.ts) */
interface PersonalityTraits {
  assertiveness: number;
  cooperativeness: number;
  economicFocus: number;
  culturalOpenness: number;
  riskTolerance: number;
  ideologicalRigidity: number;
  militarism: number;
  isolationism: number;
}

/** Economic modifiers derived from geography */
interface EconomicGeoModifiers {
  /** Multiplier on GDP growth rate (e.g. 1.05 = +5%) */
  gdpModifier: number;
  /** Multiplier on trade efficiency */
  tradeModifier: number;
  /** Multiplier on infrastructure costs */
  infraCostModifier: number;
}

/** Crisis risk scores by type (0–1 probability weight) */
interface CrisisRiskFactors {
  hurricane: number;
  earthquake: number;
  drought: number;
  flood: number;
  wildfire: number;
  pandemic: number;
  famine: number;
}

/** Climate metadata — agriculture factors, temperature, precipitation per Trewartha zone */
const CLIMATE_METADATA: Record<
  string,
  {
    tempModifier: number;
    diurnalRangeC: number;
    precipMmYr: number;
    growingSeasonDays: number;
    agricultureFactor: number;
    description: string;
    vegetation: string;
  }
> = {
  "Tropical Wet (Ar)": {
    tempModifier: 3,
    diurnalRangeC: 8,
    precipMmYr: 2200,
    growingSeasonDays: 365,
    agricultureFactor: 0.7,
    description: "Hot and humid year-round with heavy rainfall",
    vegetation: "Tropical rainforest, dense canopy",
  },
  "Tropical Wet-And-Dry (Aw)": {
    tempModifier: 2,
    diurnalRangeC: 11,
    precipMmYr: 1500,
    growingSeasonDays: 270,
    agricultureFactor: 0.8,
    description: "Tropical with distinct wet and dry seasons",
    vegetation: "Savanna, tropical grassland, open woodland",
  },
  "Desert or Arid (Bw)": {
    tempModifier: 5,
    diurnalRangeC: 18,
    precipMmYr: 100,
    growingSeasonDays: 60,
    agricultureFactor: 0.05,
    description: "Extremely dry with intense solar radiation",
    vegetation: "Sparse xerophytes, barren sand/rock",
  },
  "Steppe or Semiarid (Bs)": {
    tempModifier: 3,
    diurnalRangeC: 15,
    precipMmYr: 350,
    growingSeasonDays: 150,
    agricultureFactor: 0.3,
    description: "Low rainfall with hot daytime temperatures",
    vegetation: "Short grass steppe, scrubland",
  },
  "Subtropical Dry Summer (Cs)": {
    tempModifier: 1,
    diurnalRangeC: 14,
    precipMmYr: 600,
    growingSeasonDays: 245,
    agricultureFactor: 0.75,
    description: "Warm with dry summers and mild wet winters",
    vegetation: "Mediterranean scrub, evergreen woodland",
  },
  "Subtropical Humid (Cf)": {
    tempModifier: 0,
    diurnalRangeC: 10,
    precipMmYr: 1200,
    growingSeasonDays: 300,
    agricultureFactor: 0.9,
    description: "Warm with year-round moisture",
    vegetation: "Broadleaf evergreen forest, mixed woodland",
  },
  "Temperate Oceanic (Do)": {
    tempModifier: -2,
    diurnalRangeC: 9,
    precipMmYr: 1100,
    growingSeasonDays: 250,
    agricultureFactor: 0.85,
    description: "Maritime influence with mild, wet conditions",
    vegetation: "Deciduous forest, lush grassland",
  },
  "Temperate Continental (Dc)": {
    tempModifier: -3,
    diurnalRangeC: 13,
    precipMmYr: 700,
    growingSeasonDays: 180,
    agricultureFactor: 0.8,
    description: "Cold winters, warm summers, moderate precipitation",
    vegetation: "Mixed deciduous-coniferous forest",
  },
  "Boreal (E)": {
    tempModifier: -10,
    diurnalRangeC: 14,
    precipMmYr: 400,
    growingSeasonDays: 100,
    agricultureFactor: 0.15,
    description: "Long cold winters with brief cool summers",
    vegetation: "Taiga, coniferous forest",
  },
  "Tundra (Ft)": {
    tempModifier: -18,
    diurnalRangeC: 10,
    precipMmYr: 250,
    growingSeasonDays: 45,
    agricultureFactor: 0.02,
    description: "Very cold with minimal vegetation and permafrost",
    vegetation: "Mosses, lichens, dwarf shrubs",
  },
  "Ice Cap (Fi)": {
    tempModifier: -25,
    diurnalRangeC: 8,
    precipMmYr: 100,
    growingSeasonDays: 0,
    agricultureFactor: 0.0,
    description: "Permanently frozen, virtually no precipitation",
    vegetation: "None (permanent ice)",
  },
  "Highland (H)": {
    tempModifier: -12,
    diurnalRangeC: 12,
    precipMmYr: 600,
    growingSeasonDays: 130,
    agricultureFactor: 0.2,
    description: "High altitude with cold temps and orographic precipitation",
    vegetation: "Alpine meadow, montane forest",
  },
};

/** Short code → full climate name lookup */
const CLIMATE_CODE_TO_NAME: Record<string, string> = {
  Ar: "Tropical Wet (Ar)",
  Aw: "Tropical Wet-And-Dry (Aw)",
  Bw: "Desert or Arid (Bw)",
  Bs: "Steppe or Semiarid (Bs)",
  Cs: "Subtropical Dry Summer (Cs)",
  Cf: "Subtropical Humid (Cf)",
  Do: "Temperate Oceanic (Do)",
  Dc: "Temperate Continental (Dc)",
  E: "Boreal (E)",
  Ft: "Tundra (Ft)",
  Fi: "Ice Cap (Fi)",
  H: "Highland (H)",
};

/** Köppen code patterns → the nearest Trewartha code (first match wins). */
const KOPPEN_TO_TREWARTHA: Array<[RegExp, string]> = [
  [/^A[fm]/, "Ar"],
  [/^A[ws]/, "Aw"],
  [/^BW/, "Bw"],
  [/^BS/, "Bs"],
  [/^Cs/, "Cs"],
  [/^C[fw]a/, "Cf"],
  [/^C[fw]/, "Do"],
  [/^D[fsw][ab]/, "Dc"],
  [/^D[fsw]/, "E"],
  [/^ET/, "Ft"],
  [/^EF/, "Fi"],
];

/**
 * The Trewartha type (full name, e.g. "Temperate Oceanic (Do)") whose metadata the estimates use for a climate
 * key's zone code: a Trewartha code itself, else the nearest type to a Köppen code (Cfb → Do); null if neither.
 */
export function climateMetadataType(code: string): string | null {
  const trewartha = CLIMATE_CODE_TO_NAME[code]
    ? code
    : KOPPEN_TO_TREWARTHA.find(([re]) => re.test(code))?.[1];
  return trewartha ? (CLIMATE_CODE_TO_NAME[trewartha] ?? null) : null;
}

/** Canonical Trewartha fill colors → climate code. Used to identify climate zones from SVG map data. */
const CLIMATE_COLORS: Record<string, string> = {
  "#990000": "Ar",
  "#ff3300": "Aw",
  "#ffff33": "Bw",
  "#ff9933": "Bs",
  "#669900": "Cs",
  "#336600": "Cf",
  "#00ff99": "Do",
  "#0099ff": "Dc",
  "#0066cc": "E",
  "#b9b9b9": "Ft",
  "#99ffff": "Fi",
  "#ffccff": "H",
};

/**
 * Resolve a climate zone name from a fill color hex string.
 * Matches against canonical Trewartha colors with tolerance for slight SVG variations.
 * Returns full name like "Tropical Wet (Ar)" or null if no match.
 */
export function resolveClimateFromColor(fill: string): string | null {
  if (!fill) return null;
  const hex = fill.toLowerCase().replace(/\s/g, "");

  // Direct match
  for (const [canonical, code] of Object.entries(CLIMATE_COLORS)) {
    if (hex === canonical) return CLIMATE_CODE_TO_NAME[code] ?? null;
  }

  // Fuzzy match by RGB distance (SVG colors may be slightly off)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  let bestCode: string | null = null;
  let bestDist = 50; // max tolerance

  for (const [canonical, code] of Object.entries(CLIMATE_COLORS)) {
    const cr = parseInt(canonical.slice(1, 3), 16);
    const cg = parseInt(canonical.slice(3, 5), 16);
    const cb = parseInt(canonical.slice(5, 7), 16);
    const dist = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestCode = code;
    }
  }

  return bestCode ? (CLIMATE_CODE_TO_NAME[bestCode] ?? null) : null;
}

/** Elevation zone definitions */
export const ELEVATION_ZONES = [
  {
    zoneId: "zone_0",
    zoneName: "Coastal Lowlands",
    elevationMin: 0,
    elevationMax: 99,
    color: "#a8c995",
  },
  {
    zoneId: "zone_1",
    zoneName: "Low Hills",
    elevationMin: 100,
    elevationMax: 349,
    color: "#c3d3a1",
  },
  {
    zoneId: "zone_2",
    zoneName: "Rolling Hills",
    elevationMin: 350,
    elevationMax: 499,
    color: "#dcdcac",
  },
  { zoneId: "zone_3", zoneName: "Uplands", elevationMin: 500, elevationMax: 999, color: "#f7e6b8" },
  {
    zoneId: "zone_4",
    zoneName: "Low Mountains",
    elevationMin: 1000,
    elevationMax: 1999,
    color: "#dac497",
  },
  {
    zoneId: "zone_5",
    zoneName: "Mid Mountains",
    elevationMin: 2000,
    elevationMax: 2999,
    color: "#bea276",
  },
  {
    zoneId: "zone_6",
    zoneName: "High Mountains",
    elevationMin: 3000,
    elevationMax: 3999,
    color: "#9c7b50",
  },
  {
    zoneId: "zone_7",
    zoneName: "Alpine",
    elevationMin: 4000,
    elevationMax: 4999,
    color: "#796142",
  },
  {
    zoneId: "zone_8",
    zoneName: "Extreme Alpine",
    elevationMin: 5000,
    elevationMax: 9999,
    color: "#4f4236",
  },
] as const;

/**
 * Compute arable land percentage from climate zone distribution.
 * Weighted average of agriculture factors by area share.
 */
function computeArableLandPercent(zones: ClimateZoneEntry[]): number {
  const totalArea = zones.reduce((s, z) => s + z.areaSqKm, 0);
  if (totalArea <= 0) return 0;

  let weightedSum = 0;
  for (const z of zones) {
    weightedSum += z.agricultureFactor * z.areaSqKm;
  }

  // Agriculture factor is 0–0.9, scale to percentage
  return Math.round((weightedSum / totalArea) * 100 * 10) / 10;
}

/**
 * Determine if a country is landlocked (no coastline).
 */
function computeIsLandlocked(coastlineKm: number): boolean {
  return coastlineKm < 1;
}

/**
 * Determine if a country is an island nation.
 * Island = has coastline + no land neighbors (or very small land area with high coast-to-area ratio).
 */
function computeIsIsland(neighborCount: number, coastlineKm: number, landAreaKm2: number): boolean {
  if (coastlineKm < 1) return false;
  if (neighborCount === 0) return true;
  // High coast-to-area ratio suggests island archipelago even with a neighbor
  if (landAreaKm2 > 0 && coastlineKm / Math.sqrt(landAreaKm2) > 8) return true;
  return false;
}

/**
 * Shannon diversity index for climate zones.
 * Higher = more diverse climate. Range: 0 (monoculture) to ~2.5 (very diverse).
 */
function computeClimateDiversity(zones: ClimateZoneEntry[]): number {
  const totalArea = zones.reduce((s, z) => s + z.areaSqKm, 0);
  if (totalArea <= 0) return 0;

  let H = 0;
  for (const z of zones) {
    const p = z.areaSqKm / totalArea;
    if (p > 0) H -= p * Math.log(p);
  }

  return Math.round(H * 1000) / 1000;
}

/**
 * Terrain roughness from elevation profile.
 * Standard deviation of the elevation zone distribution, weighted by area.
 * Higher = more varied terrain.
 */
function computeTerrainRoughness(zones: ElevationZoneEntry[]): number {
  const totalArea = zones.reduce((s, z) => s + z.areaSqKm, 0);
  if (totalArea <= 0) return 0;

  // Mean elevation (weighted)
  let mean = 0;
  for (const z of zones) {
    const midElev = (z.minElev + z.maxElev) / 2;
    mean += midElev * (z.areaSqKm / totalArea);
  }

  // Variance
  let variance = 0;
  for (const z of zones) {
    const midElev = (z.minElev + z.maxElev) / 2;
    const diff = midElev - mean;
    variance += diff * diff * (z.areaSqKm / totalArea);
  }

  // Normalize: divide by 3000 (reference roughness) to get 0–1 range
  const stdDev = Math.sqrt(variance);
  return Math.min(1, Math.round((stdDev / 3000) * 1000) / 1000);
}

/**
 * Compute mean elevation from elevation profile (area-weighted).
 */
function computeMeanElevation(zones: ElevationZoneEntry[]): number {
  const totalArea = zones.reduce((s, z) => s + z.areaSqKm, 0);
  if (totalArea <= 0) return 0;

  let mean = 0;
  for (const z of zones) {
    const midElev = (z.minElev + z.maxElev) / 2;
    mean += midElev * (z.areaSqKm / totalArea);
  }
  return Math.round(mean);
}

/**
 * Estimate mean annual temperature from latitude, elevation, and climate zones.
 * Formula: baseline 28°C at equator, -0.45°C per degree latitude,
 * -6.5°C per 1000m elevation (standard atmospheric lapse rate),
 * plus climate-type modifier.
 */
export function estimateTemperature(
  centroidLat: number,
  meanElevation: number,
  zones: ClimateZoneEntry[]
): { meanTempC: number; summerHighC: number; winterLowC: number; seasonalRangeC: number } {
  const absLat = Math.abs(centroidLat);
  let baseTempC = 28 - 0.45 * absLat;
  baseTempC -= 6.5 * (meanElevation / 1000);

  const totalArea = zones.reduce((s, z) => s + z.areaSqKm, 0);
  let climateModifier = 0;
  let diurnalRange = 0;

  if (totalArea > 0) {
    for (const z of zones) {
      const meta = CLIMATE_METADATA[z.type];
      if (meta) {
        const frac = z.areaSqKm / totalArea;
        climateModifier += meta.tempModifier * frac;
        diurnalRange += meta.diurnalRangeC * frac;
      }
    }
  }

  const meanTempC = Math.round((baseTempC + climateModifier) * 10) / 10;
  const seasonalRangeC = Math.round((5 + 0.35 * absLat) * 10) / 10;
  const summerHighC = Math.round((meanTempC + seasonalRangeC / 2 + diurnalRange / 2) * 10) / 10;
  const winterLowC = Math.round((meanTempC - seasonalRangeC / 2 - diurnalRange / 2) * 10) / 10;

  return { meanTempC, summerHighC, winterLowC, seasonalRangeC };
}

/**
 * Estimate annual precipitation from climate zones and elevation.
 * Area-weighted from climate type, with orographic adjustment.
 */
export function estimatePrecipitation(zones: ClimateZoneEntry[], meanElevation: number): number {
  const totalArea = zones.reduce((s, z) => s + z.areaSqKm, 0);
  if (totalArea <= 0) return 0;

  let precip = 0;
  for (const z of zones) {
    const meta = CLIMATE_METADATA[z.type];
    if (meta) precip += meta.precipMmYr * (z.areaSqKm / totalArea);
  }

  // Orographic adjustment: +5% per 1000m mean elevation
  precip *= 1 + 0.05 * (meanElevation / 1000);

  return Math.round(precip);
}

/**
 * Compute drainage density (river length per area).
 */
function computeDrainageDensity(totalRiverLengthKm: number, areaKm2: number): number {
  if (areaKm2 <= 0) return 0;
  return Math.round((totalRiverLengthKm / areaKm2) * 1000) / 1000;
}

/**
 * Compute economic modifiers from geographic profile.
 * Returns multipliers for GDP growth, trade efficiency, and infrastructure costs.
 */
export function computeEconomicGeoModifiers(profile: GeoProfile): EconomicGeoModifiers {
  let gdpModifier = 1.0;
  let tradeModifier = 1.0;
  let infraCostModifier = 1.0;

  // Arable land → agriculture GDP base
  // High arable (>60%) boosts GDP slightly, very low (<10%) penalizes
  if (profile.arableLandPercent > 60) {
    gdpModifier *= 1.03; // +3% from agricultural productivity
  } else if (profile.arableLandPercent < 10) {
    gdpModifier *= 0.97; // -3% food import dependency
  }

  // Landlocked → trade penalty (no maritime access)
  if (profile.isLandlocked) {
    tradeModifier *= 0.92; // -8% trade efficiency
    infraCostModifier *= 1.08; // +8% infrastructure (overland only)
  }

  // Coastline → maritime trade bonus
  if (profile.coastlineKm > 500) {
    tradeModifier *= 1.05; // +5% maritime trade bonus
  } else if (profile.coastlineKm > 100) {
    tradeModifier *= 1.02; // +2% minor port access
  }

  // Terrain roughness → infrastructure cost penalty
  if (profile.terrainRoughness > 0.6) {
    infraCostModifier *= 1.12; // +12% mountainous terrain
    gdpModifier *= 0.97; // -3% connectivity drag
  } else if (profile.terrainRoughness > 0.3) {
    infraCostModifier *= 1.05; // +5% hilly terrain
  }

  // Climate harshness — extreme climates reduce GDP potential
  const dominant = profile.dominantClimate ?? "";
  if (dominant.includes("Desert") || dominant.includes("Bw")) {
    gdpModifier *= 0.95; // -5% desert penalty
  } else if (dominant.includes("Ice Cap") || dominant.includes("Fi")) {
    gdpModifier *= 0.9; // -10% ice cap penalty
  } else if (dominant.includes("Tundra") || dominant.includes("Ft")) {
    gdpModifier *= 0.93; // -7% tundra penalty
  }

  // Island nation → trade modifier (port-centric economy)
  if (profile.isIsland) {
    tradeModifier *= 1.04; // +4% island trade focus
    infraCostModifier *= 1.06; // +6% logistics costs
  }

  // Water resources → agricultural and industrial base
  if (profile.drainageDensity > 0.8) {
    gdpModifier *= 1.02; // +2% freshwater advantage
  }

  // Climate diversity → economic resilience (diverse agriculture)
  if (profile.climateDiversity > 1.5) {
    gdpModifier *= 1.02; // +2% economic diversity bonus
  }

  return {
    gdpModifier: Math.round(gdpModifier * 1000) / 1000,
    tradeModifier: Math.round(tradeModifier * 1000) / 1000,
    infraCostModifier: Math.round(infraCostModifier * 1000) / 1000,
  };
}

/**
 * Compute NPC personality trait modifiers from geographic profile.
 * Returns small adjustments (±0.3–0.8) that feed into the personality drift
 * algorithm. These represent geographic "pressures" on national character.
 *
 * Modifiers are per-cycle values and will be capped by the ±2/year limit
 * in applyPersonalityDrift().
 */
export function computeNPCGeoModifiers(profile: GeoProfile): Partial<PersonalityTraits> {
  const dominant = profile.dominantClimate ?? "";
  const climateIs = (...needles: string[]) => needles.some((n) => dominant.includes(n));

  const rules: [applies: boolean, effects: Partial<PersonalityTraits>][] = [
    // Island nation → maritime self-sufficiency, insular tendency
    [profile.isIsland, { cooperativeness: -0.5, isolationism: 0.5 }],
    // Landlocked → trade-seeking, cooperation-driven
    [profile.isLandlocked, { economicFocus: 0.5, cooperativeness: 0.3 }],
    // Desert dominant → scarcity-driven boldness
    [climateIs("Desert", "Bw"), { riskTolerance: 0.4 }],
    // Tropical climate → historical trade crossroads openness
    [climateIs("Tropical", "(Ar)", "(Aw)"), { culturalOpenness: 0.3 }],
    // Many neighbors → crowded neighborhood tension
    [profile.neighborCount > 4, { assertiveness: 0.3 }],
    // Mountain terrain → defensive isolation mindset
    [profile.terrainRoughness > 0.5, { isolationism: 0.3, militarism: 0.3 }],
    // High coastline → maritime trade orientation
    [profile.coastlineKm > 500, { economicFocus: 0.3 }],
    // Boreal/cold climate → self-reliant tendency
    [climateIs("Boreal", "(E)"), { isolationism: 0.2, ideologicalRigidity: 0.2 }],
  ];

  const mods: Partial<PersonalityTraits> = {};
  for (const [applies, effects] of rules) {
    if (!applies) continue;
    for (const [trait, delta] of Object.entries(effects) as [keyof PersonalityTraits, number][]) {
      mods[trait] = (mods[trait] ?? 0) + delta;
    }
  }
  return mods;
}

/** The value of the first matching tier, else `fallback`. */
const tiered = (tiers: [matches: boolean, value: number][], fallback: number) =>
  tiers.find(([matches]) => matches)?.[1] ?? fallback;

/**
 * Compute crisis risk factors from geographic profile.
 * Returns 0–1 probability weights per crisis type.
 * Used by the crisis generation system to localize natural disasters.
 */
export function computeCrisisRiskFactors(profile: GeoProfile): CrisisRiskFactors {
  const dominant = profile.dominantClimate ?? "";
  const climateIs = (...needles: string[]) => needles.some((n) => dominant.includes(n));
  const { arableLandPercent, drainageDensity, terrainRoughness } = profile;
  const hasCoast = profile.coastlineKm > 100;
  const isTropical = climateIs("Tropical", "(Ar)", "(Aw)");
  const isArid = climateIs("Desert", "Bw", "Steppe", "Bs");
  const isHumid = climateIs("Humid", "Cf", "Oceanic", "Do");
  const isDrySummer = climateIs("Dry Summer", "Cs", "Steppe", "Bs");

  return {
    // Tropical + coastal
    hurricane: tiered(
      [
        [isTropical && hasCoast, 0.7],
        [isTropical, 0.2],
        [hasCoast, 0.1],
      ],
      0
    ),
    // High terrain roughness (mountain boundary zones)
    earthquake: tiered(
      [
        [terrainRoughness > 0.5, 0.6],
        [terrainRoughness > 0.3, 0.3],
      ],
      0.1
    ),
    // Arid climate + low arable land
    drought: tiered(
      [
        [isArid && arableLandPercent < 15, 0.8],
        [isArid, 0.5],
        [arableLandPercent < 20, 0.3],
      ],
      0.1
    ),
    // High drainage density + humid climate
    flood: tiered(
      [
        [drainageDensity > 0.8 && isHumid, 0.7],
        [drainageDensity > 0.5, 0.4],
        [isHumid, 0.3],
      ],
      0.1
    ),
    // Dry summer climate (Mediterranean, steppe)
    wildfire: tiered(
      [
        [isDrySummer, 0.6],
        [isArid, 0.3],
      ],
      0.1
    ),
    // High population density correlates with tropical + humid
    pandemic: tiered(
      [
        [isTropical, 0.4],
        [isHumid, 0.3],
      ],
      0.2
    ),
    // Low arable + low water resources
    famine: tiered(
      [
        [arableLandPercent < 10 && drainageDensity < 0.3, 0.7],
        [arableLandPercent < 20, 0.4],
      ],
      0.1
    ),
  };
}

/**
 * Look up the agriculture factor for a climate zone name.
 * Accepts both full names ("Tropical Wet (Ar)") and short codes ("Ar").
 */
export function getAgricultureFactor(climateType: string): number {
  // Direct match
  const meta = CLIMATE_METADATA[climateType];
  if (meta) return meta.agricultureFactor;

  // Try short code lookup
  const fullName = CLIMATE_CODE_TO_NAME[climateType];
  if (fullName) {
    const m = CLIMATE_METADATA[fullName];
    if (m) return m.agricultureFactor;
  }

  // Try partial match (e.g. "Tropical Wet" without code)
  for (const [key, val] of Object.entries(CLIMATE_METADATA)) {
    if (key.includes(climateType) || climateType.includes(key)) {
      return val.agricultureFactor;
    }
  }

  return 0.5; // Default middle value
}

/**
 * Build a complete GeoProfile from raw analysis data.
 * Convenience function that computes all derived fields.
 */
export function buildGeoProfile(raw: {
  climateDistribution: ClimateZoneEntry[];
  elevationProfile: ElevationZoneEntry[];
  coastlineKm: number;
  neighborCount: number;
  totalRiverLengthKm: number;
  totalLakeAreaSqKm: number;
  areaKm2: number;
}): GeoProfile {
  const arableLandPercent = computeArableLandPercent(raw.climateDistribution);
  const isLandlocked = computeIsLandlocked(raw.coastlineKm);
  const isIsland = computeIsIsland(raw.neighborCount, raw.coastlineKm, raw.areaKm2);
  const climateDiversity = computeClimateDiversity(raw.climateDistribution);
  const terrainRoughness = computeTerrainRoughness(raw.elevationProfile);
  const meanElevation = computeMeanElevation(raw.elevationProfile);
  const drainageDensity = computeDrainageDensity(raw.totalRiverLengthKm, raw.areaKm2);

  // Dominant climate = largest area
  const dominantClimate =
    raw.climateDistribution.length > 0
      ? raw.climateDistribution.reduce((a, b) => (a.areaSqKm > b.areaSqKm ? a : b)).type
      : null;

  // Dominant elevation = largest area
  const dominantElevation =
    raw.elevationProfile.length > 0
      ? raw.elevationProfile.reduce((a, b) => (a.areaSqKm > b.areaSqKm ? a : b)).name
      : null;

  return {
    arableLandPercent,
    coastlineKm: raw.coastlineKm,
    isLandlocked,
    isIsland,
    neighborCount: raw.neighborCount,
    dominantClimate,
    dominantElevation,
    meanElevation,
    terrainRoughness,
    climateDiversity,
    climateDistribution: raw.climateDistribution,
    elevationProfile: raw.elevationProfile,
    drainageDensity,
    totalRiverLengthKm: raw.totalRiverLengthKm,
    totalLakeAreaSqKm: raw.totalLakeAreaSqKm,
  };
}

/**
 * Formats a distance in kilometers into metric, imperial, and nautical strings.
 */
export function formatDistanceMetrics(distanceKm: number): {
  km: string;
  mi: string;
  nm: string;
} {
  return {
    km: distanceKm.toFixed(1),
    mi: (distanceKm * 0.621371).toFixed(1),
    nm: (distanceKm * 0.539957).toFixed(1),
  };
}
