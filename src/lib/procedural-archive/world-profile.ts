/**
 * World Profile — Statistical fingerprint of a reference world.
 *
 * Captures continent sizes, country size distributions, geographic parameters,
 * and provides sampling functions that generate constrained random values.
 * The `similarity` parameter (0-1) controls how tightly output matches the profile.
 */

// ─── Types ───────────────────────────────────────────────────

export interface WorldProfile {
  name: string;

  continent: {
    /** Expected continent count */
    count: number;
    /** Size fractions sorted largest→smallest, sum to 1.0 */
    sizeFractions: number[];
    /** Coastline complexity: perimeter / sqrt(area) */
    coastlineComplexity: { mean: number; stddev: number };
    /** Major/minor axis ratio for continent shapes */
    aspectRatio: { mean: number; stddev: number };
  };

  country: {
    /** Country count distribution */
    count: { mean: number; stddev: number };
    /** Lognormal parameters for country areas in km2 */
    areaDist: { mu: number; sigma: number };
    /** Fraction of countries that are landlocked */
    landlockedRatio: number;
    /** Average neighbor count per country */
    neighborCount: { mean: number; stddev: number };
    /** Gini coefficient for area inequality (0=equal, 1=max) */
    areaGini: number;
  };

  geography: {
    oceanPercentage: number;
    terrainRoughness: number;
    hasIcecaps: boolean;
    /** Rivers per 1M km2 of land */
    riverDensity: number;
    /** Lakes per 1M km2 of land */
    lakeDensity: number;
    /** Fraction of land in each of the 9 elevation zones */
    elevationProfile: number[];
  };
}

// ─── Profiles ────────────────────────────────────────────────

/**
 * IxWorld profile — calibrated from actual GeoJSON analysis (Feb 2026).
 *
 * Real IxWorld data (scripts/geojson_fixed/):
 *   185 countries, avg 506 vertices, convexity 0.616, Gini 0.621
 *   4068 altitude features, 632 climate, 1041 rivers, 350 lakes, 12 icecaps
 *   Elevation distribution: 51% zone0, 27% zone1, 14% zone2, 6% zone3,
 *     1.6% zone4, 0.6% zone5, 0.15% zone6, 0.03% zone7, 0.001% zone8
 */
export const IXWORLD_PROFILE: WorldProfile = {
  name: "IxWorld",
  continent: {
    count: 6,
    sizeFractions: [0.28, 0.22, 0.19, 0.14, 0.1, 0.07],
    coastlineComplexity: { mean: 7.89, stddev: 3.52 }, // actual measured from GeoJSON
    aspectRatio: { mean: 1.6, stddev: 0.5 },
  },
  country: {
    count: { mean: 185, stddev: 10 },
    areaDist: { mu: 11.2, sigma: 1.4 }, // median ~73k km2
    landlockedRatio: 0.22,
    neighborCount: { mean: 4.5, stddev: 1.8 },
    areaGini: 0.621, // actual measured from GeoJSON
  },
  geography: {
    oceanPercentage: 0.65,
    terrainRoughness: 0.5,
    hasIcecaps: true,
    riverDensity: 6.0, // actual: ~1041 rivers across IxWorld land area
    lakeDensity: 2.0, // actual: ~350 lakes
    // Actual IxWorld elevation zone area fractions (measured from altitudes.geojson)
    elevationProfile: [0.51, 0.266, 0.139, 0.062, 0.016, 0.006, 0.001, 0.0003, 0.00001],
  },
};

export const PROFILES: Record<string, WorldProfile> = {
  IxWorld: IXWORLD_PROFILE,
};

/**
 * Resolve a profile by name. Falls back to IxWorld if not found.
 */
export function resolveProfile(name: string): WorldProfile {
  return PROFILES[name] ?? IXWORLD_PROFILE;
}

// ─── Sampling Functions ──────────────────────────────────────

/**
 * Interpolate between a random value and a profile target.
 * similarity=0 → returns randomValue, similarity=1 → returns profileTarget.
 */
export function profileLerp(
  randomValue: number,
  profileTarget: number,
  similarity: number
): number {
  return profileTarget * similarity + randomValue * (1 - similarity);
}

/**
 * Seeded RNG using xorshift32.
 */
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Sample from a normal distribution using Box-Muller transform.
 */
export function sampleNormal(rng: () => number, mean: number, stddev: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

/**
 * Sample from a lognormal distribution.
 * Returns value in natural space (not log space).
 */
export function sampleLognormal(rng: () => number, mu: number, sigma: number): number {
  return Math.exp(sampleNormal(rng, mu, sigma));
}

/**
 * Sample continent size fractions from a Dirichlet-like distribution
 * centered on the profile's sizeFractions.
 *
 * similarity controls concentration: high → sizes near profile, low → more uniform.
 */
export function sampleContinentSizes(
  profile: WorldProfile,
  similarity: number,
  continentCount: number,
  rng: () => number
): number[] {
  const targetFractions = profile.continent.sizeFractions;

  // Concentration parameter: high similarity → tight, low → spread out
  // At similarity=1, concentration=50 (very tight). At similarity=0, concentration=1 (nearly uniform)
  const concentration = 1 + similarity * 49;

  // Generate Dirichlet sample via gamma variates
  const raw: number[] = [];
  for (let i = 0; i < continentCount; i++) {
    // Use the profile fraction as the Dirichlet alpha if available
    const alpha =
      i < targetFractions.length
        ? targetFractions[i]! * concentration
        : (1 / continentCount) * concentration;
    raw.push(sampleGamma(rng, Math.max(0.1, alpha)));
  }

  // Normalize to sum to 1
  const sum = raw.reduce((a, b) => a + b, 0);
  const fractions = raw.map((v) => v / sum);

  // Sort descending (largest continent first)
  fractions.sort((a, b) => b - a);

  return fractions;
}

/**
 * Sample country area targets from a lognormal distribution
 * weighted by the profile.
 *
 * Returns sorted array (largest first) of target area fractions [0-1]
 * that sum to approximately 1.0.
 */
export function sampleCountryAreas(
  profile: WorldProfile,
  targetCount: number,
  similarity: number,
  rng: () => number
): number[] {
  // At similarity=0, generate uniform-ish areas
  // At similarity=1, generate lognormal areas matching profile
  const { mu, sigma } = profile.country.areaDist;

  // Blend sigma toward 0 (uniform) as similarity decreases
  const effectiveSigma = sigma * similarity;
  // Blend mu to keep median stable
  const effectiveMu = mu;

  const areas: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    if (similarity < 0.01) {
      // Nearly uniform: just a small random variation
      areas.push(1 + rng() * 0.2);
    } else {
      areas.push(sampleLognormal(rng, effectiveMu, effectiveSigma));
    }
  }

  // Normalize to fractions summing to 1
  const total = areas.reduce((a, b) => a + b, 0);
  const fractions = areas.map((a) => a / total);

  // Sort descending (largest country first)
  fractions.sort((a, b) => b - a);

  return fractions;
}

/**
 * Compute the Gini coefficient for an array of positive values.
 * Returns 0 (perfect equality) to ~1 (maximum inequality).
 */
export function computeGini(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;

  let sumAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbsDiff += Math.abs(sorted[i]! - sorted[j]!);
    }
  }
  return sumAbsDiff / (2 * n * n * mean);
}

/**
 * Compute profile similarity score by comparing generated stats to profile targets.
 * Returns 0-1 where 1 = perfect match.
 */
export function computeProfileSimilarity(
  profile: WorldProfile,
  stats: {
    countryCount: number;
    areaGini: number;
    landlockedRatio: number;
    avgNeighborCount: number;
  }
): number {
  // Score each dimension 0-1 based on how close to profile target
  const countScore =
    1 -
    Math.min(
      1,
      Math.abs(stats.countryCount - profile.country.count.mean) / (profile.country.count.stddev * 3)
    );
  const giniScore = 1 - Math.min(1, Math.abs(stats.areaGini - profile.country.areaGini) / 0.3);
  const landlockScore =
    1 - Math.min(1, Math.abs(stats.landlockedRatio - profile.country.landlockedRatio) / 0.3);
  const neighborScore =
    1 -
    Math.min(
      1,
      Math.abs(stats.avgNeighborCount - profile.country.neighborCount.mean) /
        (profile.country.neighborCount.stddev * 3)
    );

  // Weighted average
  return countScore * 0.3 + giniScore * 0.3 + landlockScore * 0.2 + neighborScore * 0.2;
}

// ─── Internal: Gamma sampling via Marsaglia & Tsang ─────────

function sampleGamma(rng: () => number, alpha: number): number {
  if (alpha < 1) {
    // Use Ahrens-Dieter for alpha < 1
    return sampleGamma(rng, alpha + 1) * Math.pow(rng(), 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (let attempt = 0; attempt < 1000; attempt++) {
    let x: number;
    let v: number;

    do {
      x = sampleNormal(rng, 0, 1);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rng();
    const xSq = x * x;

    if (u < 1 - 0.0331 * xSq * xSq) return d * v;
    if (Math.log(u) < 0.5 * xSq + d * (1 - v + Math.log(v))) return d * v;
  }

  // Fallback (should never reach here)
  return alpha;
}
