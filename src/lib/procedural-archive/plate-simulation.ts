/**
 * Plate Simulation — Tectonic plate generation on equirectangular grid.
 *
 * Ported from World Orogen's plate algorithm (plates.js + coarse-plates.js),
 * adapted to operate on a flat equirectangular grid with cos(lat) corrections.
 *
 * Pipeline:
 *  1. Farthest-point seeding for plate centers
 *  2. Round-robin growth with compactness constraints + directional bias
 *  3. Euler pole assignment for plate motion vectors
 *  4. Ocean/land classification (iterative growth to target %)
 *  5. Collision detection between adjacent plates
 *  6. Boundary smoothing (majority-vote filtering)
 */

import { makeRng } from "./rng";


// ─── Types ───────────────────────────────────────────────────

export interface PlateVelocity {
  /** Euler pole in normalized [0,1] space */
  eulerPoleX: number;
  eulerPoleY: number;
  /** Angular velocity (radians/timestep), positive = CCW */
  angularVelocity: number;
}

export interface PlateInfo {
  id: number;
  centerX: number;
  centerY: number;
  isOcean: boolean;
  velocity: PlateVelocity;
  cellCount: number;
}

export interface PlateCollision {
  plateA: number;
  plateB: number;
  /** Type of boundary: convergent, divergent, or transform */
  boundaryType: "convergent" | "divergent" | "transform";
  /** Boundary cells as [x, y] pairs in grid space */
  boundaryCells: Array<[number, number]>;
  /** Stress intensity at this boundary (0-1) */
  stress: number;
  /** Which plate is subducting (-1 = A, 1 = B, 0 = neither) */
  subductingSide: -1 | 0 | 1;
}

export interface PlateSimulationResult {
  /** Plate assignment per pixel (Uint16Array, index = y*width+x, value = plate ID) */
  plateAssignment: Uint16Array;
  /** Set of plate IDs that are oceanic */
  oceanPlates: Set<number>;
  /** Plate information array */
  plates: PlateInfo[];
  /** Detected collisions between plates */
  collisions: PlateCollision[];
  /** Grid dimensions */
  width: number;
  height: number;
}

// ─── Constants ───────────────────────────────────────────────

const UNASSIGNED = 0xffff;

// ─── Main Entry ──────────────────────────────────────────────

/**
 * Generate tectonic plates on an equirectangular grid.
 */
export function simulatePlates(
  seed: number,
  width: number,
  height: number,
  plateCount: number,
  continentCount: number,
  oceanPercentage: number
): PlateSimulationResult {
  const rng = makeRng(seed);
  const totalCells = width * height;

  // Step 1: Seed plate centers using farthest-point sampling
  const centers = farthestPointSeed(width, height, plateCount, rng);

  // Step 2: Grow plates via round-robin BFS
  const plateAssignment = growPlates(width, height, centers, rng);

  // Step 3: Assign Euler pole velocities
  const velocities: PlateVelocity[] = [];
  for (let i = 0; i < plateCount; i++) {
    velocities.push({
      eulerPoleX: rng() * 2 - 1,
      eulerPoleY: rng() * 2 - 1,
      angularVelocity: (rng() - 0.5) * 4.0, // ±2.0 range
    });
  }

  // Step 4: Classify ocean vs continent plates
  const oceanPlates = classifyOceanPlates(
    plateAssignment,
    width,
    height,
    plateCount,
    continentCount,
    oceanPercentage,
    rng
  );

  // Step 5: Smooth boundaries (majority-vote filter)
  smoothBoundaries(plateAssignment, width, height);

  // Step 6: Count cells per plate and build PlateInfo
  const cellCounts = new Uint32Array(plateCount);
  for (let i = 0; i < totalCells; i++) {
    const p = plateAssignment[i]!;
    if (p < plateCount) cellCounts[p]!++;
  }

  const plates: PlateInfo[] = centers.map((c, i) => ({
    id: i,
    centerX: c[0],
    centerY: c[1],
    isOcean: oceanPlates.has(i),
    velocity: velocities[i]!,
    cellCount: cellCounts[i]!,
  }));

  // Step 7: Detect plate collisions
  const collisions = detectCollisions(
    plateAssignment,
    width,
    height,
    plates,
    oceanPlates,
    seed
  );

  return { plateAssignment, oceanPlates, plates, collisions, width, height };
}

// ─── Farthest-Point Seeding ──────────────────────────────────

/**
 * Distribute plate seeds across the grid using farthest-point sampling.
 * Each new seed is placed at the point farthest from all existing seeds.
 */
function farthestPointSeed(
  width: number,
  height: number,
  count: number,
  rng: () => number
): Array<[number, number]> {
  const seeds: Array<[number, number]> = [];

  // First seed: random position
  seeds.push([Math.floor(rng() * width), Math.floor(rng() * height)]);

  // Distance grid (stores min distance to any seed)
  const dist = new Float32Array(width * height).fill(Infinity);

  for (let i = 1; i < count; i++) {
    // Update distances from the last seed
    const [sx, sy] = seeds[i - 1]!;
    for (let y = 0; y < height; y++) {
      const latRad = ((y / height) - 0.5) * Math.PI;
      const cosLat = Math.cos(latRad);
      for (let x = 0; x < width; x++) {
        let dx = Math.abs(x - sx);
        if (dx > width / 2) dx = width - dx; // Wrap around
        dx *= cosLat; // Correct for latitude
        const dy = y - sy;
        const d = dx * dx + dy * dy;
        const idx = y * width + x;
        if (d < dist[idx]!) dist[idx] = d;
      }
    }

    // Find the point with maximum distance
    let maxDist = -1;
    let bestIdx = 0;
    for (let j = 0; j < dist.length; j++) {
      if (dist[j]! > maxDist) {
        maxDist = dist[j]!;
        bestIdx = j;
      }
    }

    seeds.push([bestIdx % width, Math.floor(bestIdx / width)]);
  }

  return seeds;
}

// ─── Plate Growth (Round-Robin BFS) ──────────────────────────

interface GrowthFrontier {
  plateId: number;
  cells: Array<number>; // flat indices
  growthRate: number;
  dirBiasX: number;
  dirBiasY: number;
}

/**
 * Grow plates from seed points via round-robin BFS with:
 * - Random growth rate per plate (0.7-3.0)
 * - Directional bias for elongated plates
 * - Compactness constraints
 */
function growPlates(
  width: number,
  height: number,
  seeds: Array<[number, number]>,
  rng: () => number
): Uint16Array {
  const totalCells = width * height;
  const assignment = new Uint16Array(totalCells).fill(UNASSIGNED);

  const frontiers: GrowthFrontier[] = seeds.map(([x, y], i) => {
    const idx = y * width + x;
    assignment[idx] = i;
    return {
      plateId: i,
      cells: getNeighbors8(x, y, width, height),
      growthRate: 0.7 + rng() * 2.3, // 0.7 to 3.0
      dirBiasX: (rng() - 0.5) * 0.3,
      dirBiasY: (rng() - 0.5) * 0.3,
    };
  });

  let unassigned = totalCells - seeds.length;
  let roundCounter = 0;
  const maxRounds = totalCells * 2; // Safety limit

  while (unassigned > 0 && roundCounter < maxRounds) {
    roundCounter++;
    let anyGrew = false;

    for (const frontier of frontiers) {
      if (frontier.cells.length === 0) continue;

      // Number of cells to claim this round
      const claimCount = Math.max(1, Math.round(frontier.growthRate));

      for (let c = 0; c < claimCount && frontier.cells.length > 0; c++) {
        // Pick a random frontier cell (not strictly BFS order — adds irregularity)
        const pickIdx = Math.floor(rng() * frontier.cells.length);
        const cellIdx = frontier.cells[pickIdx]!;

        // Swap-remove for O(1)
        frontier.cells[pickIdx] = frontier.cells[frontier.cells.length - 1]!;
        frontier.cells.pop();

        if (assignment[cellIdx] !== UNASSIGNED) continue;

        assignment[cellIdx] = frontier.plateId;
        unassigned--;
        anyGrew = true;

        // Add this cell's unassigned neighbors to frontier
        const cx = cellIdx % width;
        const cy = (cellIdx - cx) / width;
        const neighbors = getNeighbors8(cx, cy, width, height);
        for (const n of neighbors) {
          if (assignment[n] === UNASSIGNED) {
            frontier.cells.push(n);
          }
        }
      }
    }

    if (!anyGrew) break;
  }

  return assignment;
}

// ─── Ocean/Continent Classification ──────────────────────────

/**
 * Classify plates as ocean or continent.
 * Selects `continentCount` largest plates as continental, rest as oceanic.
 * Then adjusts to approximate the target ocean percentage.
 */
function classifyOceanPlates(
  assignment: Uint16Array,
  width: number,
  height: number,
  plateCount: number,
  continentCount: number,
  targetOceanPct: number,
  _rng: () => number
): Set<number> {
  // Count cells per plate
  const cellCounts = new Uint32Array(plateCount);
  for (let i = 0; i < assignment.length; i++) {
    const p = assignment[i]!;
    if (p < plateCount) cellCounts[p]!++;
  }

  // Sort plates by size (largest first)
  const sorted = Array.from({ length: plateCount }, (_, i) => i)
    .sort((a, b) => cellCounts[b]! - cellCounts[a]!);

  // Start with top `continentCount` as continental, rest as ocean
  const oceanPlates = new Set<number>();
  for (let i = continentCount; i < sorted.length; i++) {
    oceanPlates.add(sorted[i]!);
  }

  // Calculate current ocean percentage
  const totalCells = width * height;
  let oceanCells = 0;
  for (let i = 0; i < assignment.length; i++) {
    if (oceanPlates.has(assignment[i]!)) oceanCells++;
  }
  let currentOceanPct = oceanCells / totalCells;

  // Iteratively flip plates to get closer to target
  const maxFlips = 10;
  for (let flip = 0; flip < maxFlips; flip++) {
    if (Math.abs(currentOceanPct - targetOceanPct) < 0.05) break;

    if (currentOceanPct < targetOceanPct) {
      // Need more ocean — convert smallest continent to ocean
      let smallestContinent = -1;
      let smallestSize = Infinity;
      for (let i = 0; i < plateCount; i++) {
        if (!oceanPlates.has(i) && cellCounts[i]! < smallestSize) {
          smallestSize = cellCounts[i]!;
          smallestContinent = i;
        }
      }
      if (smallestContinent >= 0) {
        oceanPlates.add(smallestContinent);
        oceanCells += cellCounts[smallestContinent]!;
      }
    } else {
      // Need more land — convert smallest ocean plate to continent
      let smallestOcean = -1;
      let smallestSize = Infinity;
      for (const p of oceanPlates) {
        if (cellCounts[p]! < smallestSize) {
          smallestSize = cellCounts[p]!;
          smallestOcean = p;
        }
      }
      if (smallestOcean >= 0) {
        oceanPlates.delete(smallestOcean);
        oceanCells -= cellCounts[smallestOcean]!;
      }
    }

    currentOceanPct = oceanCells / totalCells;
  }

  return oceanPlates;
}

// ─── Boundary Smoothing ─────────────────────────────────────

/**
 * Smooth plate boundaries using majority-vote filtering.
 * Each boundary cell adopts the most common plate among its 8 neighbors.
 */
function smoothBoundaries(
  assignment: Uint16Array,
  width: number,
  height: number
): void {
  const copy = new Uint16Array(assignment);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const current = copy[idx]!;

      // Check if this is a boundary cell (any neighbor differs)
      const neighbors = getNeighbors8(x, y, width, height);
      let isBoundary = false;
      for (const n of neighbors) {
        if (copy[n] !== current) {
          isBoundary = true;
          break;
        }
      }

      if (!isBoundary) continue;

      // Count neighbor plate occurrences
      const counts = new Map<number, number>();
      counts.set(current, 1); // Include self
      for (const n of neighbors) {
        const p = copy[n]!;
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }

      // Find majority
      let bestPlate = current;
      let bestCount = 1;
      for (const [plate, count] of counts) {
        if (count > bestCount) {
          bestCount = count;
          bestPlate = plate;
        }
      }

      assignment[idx] = bestPlate;
    }
  }
}

// ─── Collision Detection ─────────────────────────────────────

/**
 * Detect collisions between adjacent plates by analyzing their Euler pole velocities.
 *
 * For each pair of adjacent plates, compute relative motion at boundary:
 * - Convergent: plates moving toward each other (mountains/subduction)
 * - Divergent: plates moving apart (rifts/ridges)
 * - Transform: plates sliding past each other
 */
function detectCollisions(
  assignment: Uint16Array,
  width: number,
  height: number,
  plates: PlateInfo[],
  oceanPlates: Set<number>,
  _seed: number
): PlateCollision[] {
  // Find all plate boundary cells and which plates they border
  const adjacencies = new Map<string, { cells: Array<[number, number]> }>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const plateA = assignment[idx]!;

      const neighbors = getNeighbors8(x, y, width, height);
      for (const nIdx of neighbors) {
        const plateB = assignment[nIdx]!;
        if (plateB !== plateA && plateB < plates.length && plateA < plates.length) {
          const lo = Math.min(plateA, plateB);
          const hi = Math.max(plateA, plateB);
          const key = `${lo}-${hi}`;
          let entry = adjacencies.get(key);
          if (!entry) {
            entry = { cells: [] };
            adjacencies.set(key, entry);
          }
          // Only add if boundary cell count is manageable
          if (entry.cells.length < 5000) {
            entry.cells.push([x, y]);
          }
        }
      }
    }
  }

  const collisions: PlateCollision[] = [];

  for (const [key, data] of adjacencies) {
    const [loStr, hiStr] = key.split("-");
    const plateA = parseInt(loStr!);
    const plateB = parseInt(hiStr!);

    if (data.cells.length < 3) continue; // Skip trivial boundaries

    const infoA = plates[plateA]!;
    const infoB = plates[plateB]!;

    // Compute relative velocity at boundary midpoint
    // Simplified: use velocity difference at the midpoint of the boundary
    const midIdx = Math.floor(data.cells.length / 2);
    const [mx, my] = data.cells[midIdx]!;
    const nx = mx / width;
    const ny = my / height;

    // Approximate tangent velocity from Euler pole rotation
    const velA = eulerVelocityAt(infoA.velocity, nx, ny);
    const velB = eulerVelocityAt(infoB.velocity, nx, ny);

    // Relative velocity (B relative to A)
    const relVx = velB[0] - velA[0];
    const relVy = velB[1] - velA[1];

    // Boundary normal: direction from A center to B center
    let normalX = infoB.centerX / width - infoA.centerX / width;
    let normalY = infoB.centerY / height - infoA.centerY / height;
    // Handle wrapping
    if (Math.abs(normalX) > 0.5) normalX -= Math.sign(normalX);
    const normalLen = Math.sqrt(normalX * normalX + normalY * normalY);
    if (normalLen > 0) {
      normalX /= normalLen;
      normalY /= normalLen;
    }

    // Convergence: positive dot product = converging
    const convergence = -(relVx * normalX + relVy * normalY);
    // Shear: cross product magnitude
    const shear = Math.abs(relVx * normalY - relVy * normalX);

    let boundaryType: PlateCollision["boundaryType"];
    let stress: number;

    if (Math.abs(convergence) > shear * 0.5) {
      if (convergence > 0) {
        boundaryType = "convergent";
        stress = Math.min(1, convergence * 0.5);
      } else {
        boundaryType = "divergent";
        stress = Math.min(1, Math.abs(convergence) * 0.3);
      }
    } else {
      boundaryType = "transform";
      stress = Math.min(1, shear * 0.2);
    }

    // Subduction: in convergent boundaries, oceanic plate subducts under continental
    let subductingSide: PlateCollision["subductingSide"] = 0;
    if (boundaryType === "convergent") {
      const aIsOcean = oceanPlates.has(plateA);
      const bIsOcean = oceanPlates.has(plateB);
      if (aIsOcean && !bIsOcean) subductingSide = -1;
      else if (!aIsOcean && bIsOcean) subductingSide = 1;
      else if (aIsOcean && bIsOcean) {
        // Both oceanic: smaller plate subducts
        subductingSide = infoA.cellCount < infoB.cellCount ? -1 : 1;
      }
    }

    // Subsample boundary cells for efficiency (max 500)
    let boundaryCells = data.cells;
    if (boundaryCells.length > 500) {
      const step = Math.ceil(boundaryCells.length / 500);
      boundaryCells = boundaryCells.filter((_, i) => i % step === 0);
    }

    collisions.push({
      plateA,
      plateB,
      boundaryType,
      boundaryCells,
      stress,
      subductingSide,
    });
  }

  return collisions;
}

// ─── Euler Velocity Helpers ──────────────────────────────────

/**
 * Compute velocity at a point from an Euler pole rotation.
 * Simplified for equirectangular: v = omega × r (cross product).
 */
function eulerVelocityAt(
  vel: PlateVelocity,
  nx: number,
  ny: number
): [number, number] {
  // Treat the Euler pole direction as (epX, epY) and the point as (nx, ny)
  // Velocity is perpendicular to the vector from pole to point, scaled by angular velocity
  const dx = nx - vel.eulerPoleX * 0.5 - 0.5;
  const dy = ny - vel.eulerPoleY * 0.5 - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r < 0.001) return [0, 0];

  // Perpendicular direction (rotated 90°)
  const vx = -dy / r * vel.angularVelocity;
  const vy = dx / r * vel.angularVelocity;
  return [vx, vy];
}

// ─── Grid Neighbor Utilities ─────────────────────────────────

/**
 * Get 8-connected neighbor indices for a grid cell.
 * Wraps horizontally (equirectangular), clamps vertically.
 */
export function getNeighbors8(
  x: number,
  y: number,
  width: number,
  height: number
): number[] {
  const neighbors: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      let nx = x + dx;
      if (nx < 0) nx += width;       // Wrap left
      if (nx >= width) nx -= width;   // Wrap right
      neighbors.push(ny * width + nx);
    }
  }
  return neighbors;
}

/**
 * Get 4-connected neighbor indices (no diagonals).
 */
export function getNeighbors4(
  x: number,
  y: number,
  width: number,
  height: number
): number[] {
  const neighbors: number[] = [];
  if (y > 0) neighbors.push((y - 1) * width + x);
  if (y < height - 1) neighbors.push((y + 1) * width + x);
  let nx = x - 1;
  if (nx < 0) nx += width;
  neighbors.push(y * width + nx);
  nx = x + 1;
  if (nx >= width) nx -= width;
  neighbors.push(y * width + nx);
  return neighbors;
}
