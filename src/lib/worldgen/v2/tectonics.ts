/**
 * UPG v2 — Tectonic Plate Simulation
 *
 * Simulates tectonic plate boundaries and dynamics:
 * 1. Seeds N plate centers via farthest-point sampling
 * 2. Assigns all cells to nearest plate via multi-source BFS
 * 3. Assigns velocity vectors (direction + speed) & continental/oceanic types
 * 4. Classifies boundaries as convergent, divergent, or transform
 * 5. Computes plateDist (distance from each cell to nearest boundary)
 */

import type { WorldGraph, WorldGenParams, TectonicPlate, BoundaryType } from "./types";
import { TECTONIC_CONSTANTS } from "./config";
import { makeRng } from "./helpers/rng";
import { farthestPointSample, cellLng, cellLat } from "./mesh";
import { bfsAssign } from "./helpers/flood-fill";

/**
 * Generate tectonic plates, assign cell plate IDs, velocity vectors, and boundary distances.
 * Mutates graph.cells.plate, graph.cells.plateDist, and populates graph.plates in-place.
 */
export function generateTectonicPlates(
  graph: WorldGraph,
  params: WorldGenParams
): void {
  const rng = makeRng(params.seed + 10);
  const { cells } = graph;
  const n = cells.n;
  const plateCount = Math.max(3, params.plateCount ?? 10);

  // Step 1: Seed plate centers via farthest-point sampling
  const seedCells = farthestPointSample(graph, plateCount, rng);

  // Step 2: Assign continental vs oceanic plate types
  // Target ocean fraction dictates ratio of oceanic vs continental plates
  const targetOceanFrac = params.oceanPercentage ?? 0.65;
  const continentalCount = Math.max(1, Math.round(plateCount * (1 - targetOceanFrac)));

  // Shuffle indices to assign continental types randomly among seeds
  const seedIndices = Array.from({ length: plateCount }, (_, i) => i);
  for (let i = seedIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [seedIndices[i], seedIndices[j]] = [seedIndices[j]!, seedIndices[i]!];
  }
  const continentalIndices = new Set(seedIndices.slice(0, continentalCount));

  // Step 3: Build TectonicPlate objects with random velocities
  const plates: TectonicPlate[] = [];
  const plateIds: number[] = [];

  for (let i = 0; i < plateCount; i++) {
    const plateId = i + 1; // 1-indexed
    const center = seedCells[i]!;
    const isContinental = continentalIndices.has(i);

    // Random motion direction angle (0..2π)
    const angle = rng() * Math.PI * 2;
    // Speed range depends on plate type (oceanic plates move faster)
    const [minSpeed, maxSpeed] = isContinental
      ? TECTONIC_CONSTANTS.continentalSpeedRange
      : TECTONIC_CONSTANTS.oceanicSpeedRange;
    const speed = minSpeed + rng() * (maxSpeed - minSpeed);

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    plates.push({
      id: plateId,
      type: isContinental ? "continental" : "oceanic",
      center,
      velocity: [vx, vy],
      speed,
      cellCount: 0,
    });
    plateIds.push(plateId);
  }

  // Step 4: Assign every cell to nearest plate via multi-source BFS
  const { assignment } = bfsAssign(graph, seedCells, plateIds);
  for (let i = 0; i < n; i++) {
    cells.plate[i] = assignment[i]!;
  }

  // Update cell counts per plate
  for (let i = 0; i < n; i++) {
    const pId = cells.plate[i]!;
    if (pId > 0 && pId <= plates.length) {
      plates[pId - 1]!.cellCount++;
    }
  }

  graph.plates = plates;

  // Step 5: Detect boundary cells and compute plateDist (BFS distance to boundary)
  computePlateBoundaryDistances(graph);
}

/**
 * Compute the relative motion / boundary type between two adjacent cells on different plates.
 */
export function classifyCellBoundary(
  graph: WorldGraph,
  cellA: number,
  cellB: number
): BoundaryType {
  const { cells, plates } = graph;
  const pAId = cells.plate[cellA]!;
  const pBId = cells.plate[cellB]!;

  if (pAId === pBId || pAId === 0 || pBId === 0) {
    return "transform";
  }

  const plateA = plates[pAId - 1];
  const plateB = plates[pBId - 1];
  if (!plateA || !plateB) return "transform";

  // Relative velocity vector (motion of B relative to A)
  const relVx = plateB.velocity[0] - plateA.velocity[0];
  const relVy = plateB.velocity[1] - plateA.velocity[1];

  // Boundary normal vector pointing from cell A to cell B
  const dx = cellLng(graph, cellB) - cellLng(graph, cellA);
  const dy = cellLat(graph, cellB) - cellLat(graph, cellA);
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-6) return "transform";

  const nx = dx / len;
  const ny = dy / len;

  // Dot product of relative velocity and normal vector
  // Negative = plates moving toward each other (convergent)
  // Positive = plates moving apart (divergent)
  const dot = relVx * nx + relVy * ny;

  const threshold = TECTONIC_CONSTANTS.boundaryVelocityThreshold;

  if (dot < -threshold) return "convergent";
  if (dot > threshold) return "divergent";
  return "transform";
}

/**
 * Identify boundary cells and compute BFS distance from each cell to nearest boundary.
 * Mutates graph.cells.plateDist in-place.
 */
function computePlateBoundaryDistances(graph: WorldGraph): void {
  const { cells } = graph;
  const n = cells.n;
  cells.plateDist.fill(65535);

  const boundaryQueue: number[] = [];

  // Find all cells adjacent to a different plate
  for (let i = 0; i < n; i++) {
    const myPlate = cells.plate[i]!;
    let isBoundary = false;
    for (const nb of cells.neighbors[i]!) {
      if (cells.plate[nb]! !== myPlate) {
        isBoundary = true;
        break;
      }
    }
    if (isBoundary) {
      cells.plateDist[i] = 0;
      boundaryQueue.push(i);
    }
  }

  // Multi-source BFS expansion across all cells
  let head = 0;
  while (head < boundaryQueue.length) {
    const cell = boundaryQueue[head++]!;
    const nextDist = cells.plateDist[cell]! + 1;

    for (const nb of cells.neighbors[cell]!) {
      if (cells.plateDist[nb]! > nextDist) {
        cells.plateDist[nb] = nextDist;
        boundaryQueue.push(nb);
      }
    }
  }
}
