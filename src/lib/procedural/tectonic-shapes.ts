/**
 * Tectonic Shapes — Perlin-warped plate boundaries for realistic continent shapes.
 *
 * Replaces simple elliptical continent placement with:
 *  1. Tectonic plate centers via Poisson disk
 *  2. Polar noise boundaries (not ellipses) for irregular coastlines
 *  3. Continental shelf fringe for archipelago edges
 *  4. Plate collision zones for mountain chain placement
 *
 * Profile-guided: sizeFractions control relative plate sizes.
 */

import type { Position } from "geojson";
import type { NoiseGenerator } from "./noise";
import { createNoise, fractalNoise } from "./noise";
import type { WorldProfile } from "./world-profile";
import { sampleContinentSizes } from "./world-profile";
import type { LandmassParams } from "./landmass-generator";

// ─── Types ───────────────────────────────────────────────────

export interface TectonicPlate {
  /** Center in normalized [0,1] space */
  center: { x: number; y: number };
  /** Base radius in normalized space */
  baseRadius: number;
  /** Target fraction of total land area */
  targetAreaFraction: number;
  /** Seed for boundary noise */
  boundaryNoiseSeed: number;
  /** Amplitude of Perlin warp on boundary (0.2-0.5 for realistic) */
  warpAmplitude: number;
  /** How far continental shelf extends beyond main boundary (0-0.3) */
  shelfExtent: number;
  /** Rotation angle for asymmetry */
  rotation: number;
  /** Noise generator for this plate's boundary */
  boundaryNoise: NoiseGenerator;
}

export interface CollisionZone {
  plateA: number;
  plateB: number;
  /** Parameterized boundary points in normalized [0,1] space */
  boundary: Position[];
  /** Elevation boost at collision (0.3-0.8) */
  elevationBoost: number;
}

export interface TectonicResult {
  plates: TectonicPlate[];
  collisions: CollisionZone[];
}

// ─── Main Entry ──────────────────────────────────────────────

/**
 * Generate tectonic plates with profile-guided sizes and Perlin-warped boundaries.
 */
export function generateTectonicPlates(
  params: LandmassParams,
  profile: WorldProfile | undefined,
  similarity: number,
  rng: () => number
): TectonicResult {
  const { seed, continentCount } = params;

  // Determine continent size fractions
  let sizeFractions: number[];
  if (profile && similarity > 0) {
    sizeFractions = sampleContinentSizes(profile, similarity, continentCount, rng);
  } else {
    // Uniform-ish with some random variation
    const raw = Array.from({ length: continentCount }, () => 0.5 + rng() * 0.5);
    const sum = raw.reduce((a, b) => a + b, 0);
    sizeFractions = raw.map((v) => v / sum).sort((a, b) => b - a);
  }

  // Place plate centers with spacing constraints
  const plates: TectonicPlate[] = [];
  const minSpacing = 0.18; // Minimum distance between plate centers (normalized)

  for (let i = 0; i < continentCount; i++) {
    let cx: number, cy: number;
    let attempts = 0;

    // Find a position that's not too close to existing plates
    do {
      cx = 0.08 + rng() * 0.84;
      cy = 0.12 + rng() * 0.76;
      attempts++;
    } while (
      attempts < 200 &&
      plates.some((p) => {
        const dx = cx - p.center.x;
        const dy = cy - p.center.y;
        return Math.sqrt(dx * dx + dy * dy) < minSpacing;
      })
    );

    // Base radius from size fraction: larger fraction → larger radius
    // Area ~ r^2, so r ~ sqrt(fraction * totalLandArea)
    // In normalized space, the total "land budget" depends on ocean percentage
    const landBudget = 1 - params.oceanPercentage;
    const baseRadius = Math.sqrt(sizeFractions[i]! * landBudget / Math.PI) * 1.8;

    // Warp amplitude: controlled by similarity (high sim → closer to profile's complexity)
    const targetWarp = profile
      ? 0.25 + (profile.continent.coastlineComplexity.mean - 1.5) * 0.1
      : 0.3;
    const warpAmplitude = similarity > 0
      ? targetWarp * (0.7 + rng() * 0.6)
      : 0.15 + rng() * 0.35;

    // Shelf extent: creates archipelago fringes
    const shelfExtent = 0.02 + rng() * 0.08;

    const plateSeed = seed + i * 1000 + 7;

    plates.push({
      center: { x: cx, y: cy },
      baseRadius: Math.max(0.05, Math.min(0.35, baseRadius)),
      targetAreaFraction: sizeFractions[i]!,
      boundaryNoiseSeed: plateSeed,
      warpAmplitude,
      shelfExtent,
      rotation: rng() * Math.PI * 2,
      boundaryNoise: createNoise(plateSeed),
    });
  }

  // Detect collision zones between nearby plates
  const collisions = detectCollisionZones(plates, rng, seed);

  return { plates, collisions };
}

/**
 * Create a heightmap influence function from tectonic plates.
 * Returns a function (nx, ny) → [0, 1] elevation contribution.
 */
export function tectonicInfluence(
  plates: TectonicPlate[],
  collisions: CollisionZone[],
  _detailNoise: NoiseGenerator
): (nx: number, ny: number) => number {
  return (nx: number, ny: number): number => {
    let maxInfluence = 0;
    let collisionBoost = 0;

    for (const plate of plates) {
      const influence = plateInfluence(plate, nx, ny);
      maxInfluence = Math.max(maxInfluence, influence);
    }

    // Bridge bonus: where two plates' influence zones overlap
    let bridgeBonus = 0;
    for (let i = 0; i < plates.length; i++) {
      for (let j = i + 1; j < plates.length; j++) {
        const infA = plateInfluence(plates[i]!, nx, ny);
        const infB = plateInfluence(plates[j]!, nx, ny);
        if (infA > 0.1 && infB > 0.1) {
          bridgeBonus = Math.max(bridgeBonus, Math.min(infA, infB) * 0.5);
        }
      }
    }

    // Collision zone boost
    for (const cz of collisions) {
      const dist = pointToPolylineDistNormalized(nx, ny, cz.boundary);
      if (dist < 0.08) {
        const proximity = 1 - dist / 0.08;
        collisionBoost = Math.max(
          collisionBoost,
          proximity * proximity * cz.elevationBoost
        );
      }
    }

    return Math.min(1, maxInfluence + bridgeBonus + collisionBoost * 0.3);
  };
}

// ─── Internal: Plate Influence ───────────────────────────────

/**
 * Compute influence of a single tectonic plate at a point.
 * Uses Perlin-warped polar boundary instead of elliptical falloff.
 */
function plateInfluence(plate: TectonicPlate, nx: number, ny: number): number {
  const dx = nx - plate.center.x;
  const dy = ny - plate.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > plate.baseRadius * 2.5) return 0;

  // Angle from plate center
  const angle = Math.atan2(dy, dx) + plate.rotation;

  // Perlin-warped boundary radius
  // Use multiple octaves for fractal coastline shape
  const warp1 = fractalNoise(
    plate.boundaryNoise,
    Math.cos(angle) * 3 + plate.center.x * 10,
    Math.sin(angle) * 3 + plate.center.y * 10,
    4,
    2.0,
    0.5
  );
  const warp2 = fractalNoise(
    plate.boundaryNoise,
    Math.cos(angle * 2) * 6 + 100,
    Math.sin(angle * 2) * 6 + 100,
    3,
    2.0,
    0.5
  );

  const boundaryR =
    plate.baseRadius * (1 + plate.warpAmplitude * (warp1 * 0.7 + warp2 * 0.3));

  // Main body influence: smooth falloff from center to boundary
  const normalizedDist = dist / Math.max(0.01, boundaryR);
  let influence: number;

  if (normalizedDist < 0.7) {
    // Core: full influence
    influence = 1;
  } else if (normalizedDist < 1.0) {
    // Transition zone: smooth falloff
    const t = (normalizedDist - 0.7) / 0.3;
    influence = 1 - t * t;
  } else if (normalizedDist < 1.0 + plate.shelfExtent / plate.baseRadius) {
    // Continental shelf: rapid falloff with noise for archipelago fringes
    const shelfT =
      (normalizedDist - 1.0) / (plate.shelfExtent / plate.baseRadius);
    const shelfNoise =
      fractalNoise(
        plate.boundaryNoise,
        nx * 20 + 50,
        ny * 20 + 50,
        3,
        2.0,
        0.5
      ) *
        0.5 +
      0.5;
    influence = (1 - shelfT) * 0.3 * shelfNoise;
  } else {
    influence = 0;
  }

  return Math.max(0, influence);
}

// ─── Internal: Collision Zones ───────────────────────────────

/**
 * Detect collision zones between plate pairs.
 * A collision occurs when two plates are close enough for their influence to overlap.
 */
function detectCollisionZones(
  plates: TectonicPlate[],
  rng: () => number,
  seed: number
): CollisionZone[] {
  const collisions: CollisionZone[] = [];
  const collisionNoise = createNoise(seed + 9000);

  for (let i = 0; i < plates.length; i++) {
    for (let j = i + 1; j < plates.length; j++) {
      const a = plates[i]!;
      const b = plates[j]!;

      const dx = b.center.x - a.center.x;
      const dy = b.center.y - a.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const combinedRadius = a.baseRadius + b.baseRadius;

      // Plates must be close enough to interact
      if (dist > combinedRadius * 1.6) continue;

      // Generate collision boundary as a perturbed line between the plates
      const midX = (a.center.x + b.center.x) / 2;
      const midY = (a.center.y + b.center.y) / 2;

      // Perpendicular direction
      const len = Math.max(0.001, dist);
      const perpX = -dy / len;
      const perpY = dx / len;

      // Generate boundary points along the perpendicular
      const extent = Math.min(a.baseRadius, b.baseRadius) * 0.8;
      const numPoints = 12;
      const boundary: Position[] = [];

      for (let k = 0; k < numPoints; k++) {
        const t = (k / (numPoints - 1)) * 2 - 1; // -1 to 1
        const baseX = midX + perpX * t * extent;
        const baseY = midY + perpY * t * extent;

        // Add noise perpendicular to the collision line
        const nv = fractalNoise(
          collisionNoise,
          baseX * 15 + i * 100,
          baseY * 15 + j * 100,
          3,
          2.0,
          0.5
        );
        const offsetX = (dx / len) * nv * 0.03;
        const offsetY = (dy / len) * nv * 0.03;

        boundary.push([baseX + offsetX, baseY + offsetY]);
      }

      // Elevation boost: closer plates → stronger collision → higher mountains
      const closeness = 1 - dist / (combinedRadius * 1.6);
      const elevationBoost = 0.3 + closeness * 0.5;

      collisions.push({
        plateA: i,
        plateB: j,
        boundary,
        elevationBoost: Math.min(0.8, elevationBoost),
      });
    }
  }

  return collisions;
}

// ─── Internal: Geometry Utilities ────────────────────────────

/**
 * Distance from a point to a polyline (in normalized 0-1 space).
 */
function pointToPolylineDistNormalized(
  px: number,
  py: number,
  line: Position[]
): number {
  let minDist = Infinity;

  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i]![0],
      ay = line[i]![1];
    const bx = line[i + 1]![0],
      by = line[i + 1]![1];

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t: number;
    if (lenSq === 0) {
      t = 0;
    } else {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    }

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}
