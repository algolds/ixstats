/**
 * Generation Validator — Post-generation statistical validation.
 *
 * Checks generated worlds for degenerate polygons, orphan landmasses,
 * and computes how closely the output matches the target profile.
 */

import type { Polygon, MultiPolygon } from "geojson";
import type { WorldProfile } from "./world-profile";
import { computeGini, computeProfileSimilarity } from "./world-profile";
import type { GeneratedCountry } from "./country-generator";

// ─── Types ───────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    countryCount: number;
    areaGini: number;
    landlockedRatio: number;
    avgNeighborCount: number;
    minCountryAreaKm2: number;
    maxCountryAreaKm2: number;
    orphanPolygonCount: number;
    degenerateCountryCount: number;
  };
  /** How similar the output is to the profile (0-1), null if no profile */
  profileSimilarity: number | null;
}

// ─── Main Validation ─────────────────────────────────────────

/**
 * Validate a generated world's statistical properties.
 */
export function validateGeneratedWorld(
  countries: GeneratedCountry[],
  profile: WorldProfile | null
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Basic stats
  const countryCount = countries.length;
  const areas = countries.map((c) => c.areaKm2);
  const minArea = areas.length > 0 ? Math.min(...areas) : 0;
  const maxArea = areas.length > 0 ? Math.max(...areas) : 0;

  // Gini coefficient for area inequality
  const areaGini = computeGini(areas);

  // Landlocked ratio
  const landlockedCount = countries.filter((c) => c.coastalPerimeter === 0).length;
  const landlockedRatio = countryCount > 0 ? landlockedCount / countryCount : 0;

  // Average neighbor count
  const totalNeighbors = countries.reduce((sum, c) => sum + c.neighbors.length, 0);
  const avgNeighborCount = countryCount > 0 ? totalNeighbors / countryCount : 0;

  // Degenerate countries
  const degenerates = findDegenerateCountries(countries);
  const degenerateCountryCount = degenerates.length;

  // Validation checks
  if (countryCount === 0) {
    errors.push("No countries generated");
  }

  if (degenerateCountryCount > 0) {
    warnings.push(`${degenerateCountryCount} degenerate countries (< 50 km2 or < 4 vertices)`);
  }

  if (minArea < 10) {
    warnings.push(`Smallest country is only ${Math.round(minArea)} km2`);
  }

  const totalArea = areas.reduce((a, b) => a + b, 0);
  if (maxArea > totalArea * 0.5) {
    warnings.push(
      `Largest country covers ${Math.round((maxArea / totalArea) * 100)}% of total land`
    );
  }

  if (avgNeighborCount < 2 && countryCount > 5) {
    warnings.push(`Low average neighbor count: ${avgNeighborCount.toFixed(1)}`);
  }

  // Profile similarity
  let profileSimilarity: number | null = null;
  if (profile) {
    profileSimilarity = computeProfileSimilarity(profile, {
      countryCount,
      areaGini,
      landlockedRatio,
      avgNeighborCount,
    });

    if (profileSimilarity < 0.3) {
      warnings.push(
        `Low profile similarity (${(profileSimilarity * 100).toFixed(0)}%) — output diverges significantly from ${profile.name}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    stats: {
      countryCount,
      areaGini,
      landlockedRatio,
      avgNeighborCount,
      minCountryAreaKm2: minArea,
      maxCountryAreaKm2: maxArea,
      orphanPolygonCount: 0, // Computed externally if needed
      degenerateCountryCount,
    },
    profileSimilarity,
  };
}

/**
 * Find countries that are degenerate (too small or too few vertices).
 */
export function findDegenerateCountries(countries: GeneratedCountry[]): string[] {
  const ids: string[] = [];
  for (const c of countries) {
    if (c.areaKm2 < 50) {
      ids.push(c.id);
      continue;
    }
    const coords =
      c.geometry.type === "Polygon" ? c.geometry.coordinates[0] : null;
    if (coords && coords.length < 4) {
      ids.push(c.id);
    }
  }
  return ids;
}

/**
 * Count landmass polygons that have no countries assigned.
 */
export function findOrphanLandmasses(
  landPolygons: Array<{ geometry: Polygon | MultiPolygon; areaKm2: number }>,
  countries: GeneratedCountry[]
): number {
  // A landmass is orphaned if no country centroid falls within it
  // Simple check: for each landmass, see if any country has a centroid
  // within its bounding box (approximate but fast)
  let orphans = 0;

  for (const lm of landPolygons) {
    if (lm.areaKm2 < 100) continue; // Skip tiny islands

    const coords =
      lm.geometry.type === "Polygon"
        ? lm.geometry.coordinates[0]!
        : lm.geometry.coordinates[0]?.[0] ?? [];

    if (coords.length < 3) continue;

    // Compute bounding box
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    // Check if any country centroid is within the bounding box
    const hasCountry = countries.some(
      (c) =>
        c.centroid[0] >= minLng &&
        c.centroid[0] <= maxLng &&
        c.centroid[1] >= minLat &&
        c.centroid[1] <= maxLat
    );

    if (!hasCountry) orphans++;
  }

  return orphans;
}
