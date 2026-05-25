/**
 * resource-generator.ts — Procedural resource placement based on geography.
 *
 * Generates GeographicResource records for a country by analyzing its
 * climate zones, elevation profile, coastline, and hydrology.
 *
 * Resource types and their geographic triggers:
 * - Fishery → coastal zones (coastlineKm > 0)
 * - Forest → humid climate zones (Cf, Do, Ar, Aw — agriculture factor > 0.6)
 * - Mineral → mountainous terrain (elevation zone 4+, >1000m)
 * - Oil/Gas → arid sedimentary basins (Bw, Bs climate zones)
 * - Freshwater → high drainage density (rivers/lakes)
 * - Agricultural → high arable land (arableLandPercent > 30%)
 */

import type { GeoProfile } from "./geo-analytics";

export interface GeneratedResource {
  resourceType: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  quantity: number; // 0–1
  quality: number; // 0–1
  climateZone: string | null;
  elevationZone: string | null;
}

/** Resource naming templates */
const RESOURCE_NAMES: Record<string, string[]> = {
  fishery: [
    "Coastal Fishery",
    "Deep-Sea Grounds",
    "Reef Fishery",
    "Estuary Fishery",
    "Trawling Zone",
  ],
  forest: [
    "Old-Growth Forest",
    "Timber Reserve",
    "Hardwood Forest",
    "Tropical Canopy",
    "Managed Woodland",
  ],
  mineral: [
    "Iron Deposit",
    "Copper Vein",
    "Zinc Mine",
    "Bauxite Deposit",
    "Rare Earth Site",
    "Gold Deposit",
    "Silver Mine",
  ],
  oil: ["Oil Field", "Petroleum Reserve", "Crude Basin", "Offshore Well"],
  gas: ["Natural Gas Field", "Gas Reserve", "Shale Gas Deposit"],
  freshwater: ["River Basin", "Freshwater Aquifer", "Glacial Lake", "Reservoir System"],
  agricultural: ["Fertile Plains", "Grain Belt", "Cropland", "Plantation Zone", "Irrigated Valley"],
};

/**
 * Generate resources for a country based on its geographic profile.
 *
 * @param profile - Country's geographic profile from geo-analytics
 * @param centroid - Country centroid [lng, lat]
 * @param bbox - Country bounding box [minLng, minLat, maxLng, maxLat]
 * @param seed - Optional seed for deterministic generation (use countryId hash)
 */
export function generateResourcesForCountry(
  profile: GeoProfile,
  centroid: [number, number],
  bbox: [number, number, number, number],
  seed?: number
): GeneratedResource[] {
  const resources: GeneratedResource[] = [];
  const rng = createSeededRng(seed ?? hashString(JSON.stringify(centroid)));

  // 1. Fisheries — coastal countries only
  if (profile.coastlineKm > 0) {
    const count = profile.coastlineKm > 1000 ? 3 : profile.coastlineKm > 200 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      resources.push({
        resourceType: "fishery",
        name: pickName(rng, "fishery", i),
        coordinates: randomCoastalPoint(rng, centroid, bbox),
        quantity: 0.3 + rng() * 0.5,
        quality: 0.4 + rng() * 0.4,
        climateZone: profile.dominantClimate,
        elevationZone: null,
      });
    }
  }

  // 2. Forests — humid climate zones
  const forestZones = profile.climateDistribution.filter(
    (z) => z.agricultureFactor > 0.6 && z.percentArea > 5
  );
  if (forestZones.length > 0) {
    const count = Math.min(3, forestZones.length);
    for (let i = 0; i < count; i++) {
      const zone = forestZones[i % forestZones.length]!;
      resources.push({
        resourceType: "forest",
        name: pickName(rng, "forest", i),
        coordinates: randomInteriorPoint(rng, centroid, bbox),
        quantity: 0.3 + zone.agricultureFactor * 0.5,
        quality: 0.4 + rng() * 0.4,
        climateZone: zone.type,
        elevationZone: null,
      });
    }
  }

  // 3. Minerals — mountainous terrain (zone 4+)
  const mountainZones = profile.elevationProfile.filter(
    (z) => z.minElev >= 1000 && z.percentArea > 3
  );
  if (mountainZones.length > 0) {
    const count = Math.min(3, 1 + Math.floor(profile.terrainRoughness * 3));
    for (let i = 0; i < count; i++) {
      const zone = mountainZones[i % mountainZones.length]!;
      resources.push({
        resourceType: "mineral",
        name: pickName(rng, "mineral", i),
        coordinates: randomInteriorPoint(rng, centroid, bbox),
        quantity: 0.2 + rng() * 0.6,
        quality: 0.3 + rng() * 0.5,
        climateZone: null,
        elevationZone: zone.name,
      });
    }
  }

  // 4. Oil/Gas — arid zones
  const aridZones = profile.climateDistribution.filter(
    (z) =>
      z.type.includes("Desert") ||
      z.type.includes("Bw") ||
      z.type.includes("Steppe") ||
      z.type.includes("Bs")
  );
  if (aridZones.length > 0) {
    const totalAridPercent = aridZones.reduce((s, z) => s + z.percentArea, 0);
    if (totalAridPercent > 15) {
      // Oil
      if (rng() < 0.6) {
        resources.push({
          resourceType: "oil",
          name: pickName(rng, "oil", 0),
          coordinates: randomInteriorPoint(rng, centroid, bbox),
          quantity: 0.2 + rng() * 0.6,
          quality: 0.4 + rng() * 0.4,
          climateZone: aridZones[0]!.type,
          elevationZone: null,
        });
      }
      // Gas
      if (rng() < 0.5) {
        resources.push({
          resourceType: "gas",
          name: pickName(rng, "gas", 0),
          coordinates: randomInteriorPoint(rng, centroid, bbox),
          quantity: 0.2 + rng() * 0.5,
          quality: 0.4 + rng() * 0.4,
          climateZone: aridZones[0]!.type,
          elevationZone: null,
        });
      }
    }
  }

  // 5. Freshwater — high drainage density
  if (profile.drainageDensity > 0.3 || profile.totalRiverLengthKm > 50) {
    const count = profile.drainageDensity > 0.8 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      resources.push({
        resourceType: "freshwater",
        name: pickName(rng, "freshwater", i),
        coordinates: randomInteriorPoint(rng, centroid, bbox),
        quantity: 0.4 + profile.drainageDensity * 0.4,
        quality: 0.5 + rng() * 0.3,
        climateZone: null,
        elevationZone: null,
      });
    }
  }

  // 6. Agricultural — high arable land
  if (profile.arableLandPercent > 30) {
    const count = profile.arableLandPercent > 60 ? 3 : profile.arableLandPercent > 45 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      resources.push({
        resourceType: "agricultural",
        name: pickName(rng, "agricultural", i),
        coordinates: randomInteriorPoint(rng, centroid, bbox),
        quantity: 0.3 + (profile.arableLandPercent / 100) * 0.5,
        quality: 0.4 + rng() * 0.4,
        climateZone: profile.dominantClimate,
        elevationZone: profile.dominantElevation,
      });
    }
  }

  // Clamp all values to valid ranges
  for (const r of resources) {
    r.quantity = Math.round(Math.min(1, Math.max(0, r.quantity)) * 100) / 100;
    r.quality = Math.round(Math.min(1, Math.max(0, r.quality)) * 100) / 100;
  }

  return resources;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function pickName(rng: () => number, type: string, index: number): string {
  const names = RESOURCE_NAMES[type] ?? ["Resource"];
  return names[index % names.length]!;
}

/** Generate a point near the coast (biased toward bbox edge) */
function randomCoastalPoint(
  rng: () => number,
  centroid: [number, number],
  bbox: [number, number, number, number]
): [number, number] {
  const edge = rng(); // which edge
  const t = rng(); // position along edge
  const [minLng, minLat, maxLng, maxLat] = bbox;

  if (edge < 0.25) return [minLng + t * (maxLng - minLng), minLat]; // south
  if (edge < 0.5) return [minLng + t * (maxLng - minLng), maxLat]; // north
  if (edge < 0.75) return [minLng, minLat + t * (maxLat - minLat)]; // west
  return [maxLng, minLat + t * (maxLat - minLat)]; // east
}

/** Generate a random point inside the bbox (biased toward centroid) */
function randomInteriorPoint(
  rng: () => number,
  centroid: [number, number],
  bbox: [number, number, number, number]
): [number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  // Bias toward centroid (Gaussian-like with 2 uniform samples)
  const rx = (rng() + rng()) / 2;
  const ry = (rng() + rng()) / 2;
  const lng = minLng + rx * (maxLng - minLng);
  const lat = minLat + ry * (maxLat - minLat);
  return [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000];
}

/** Simple seeded RNG (mulberry32) */
function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit integer */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}
