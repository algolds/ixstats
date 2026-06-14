/**
 * Climate Stage — Temperature, Precipitation, and Trewartha Biome Classification
 *
 * Runs after heightmap, features, and rivers. Assigns temperature, refines
 * precipitation with orographic effects, and classifies each land cell into
 * one of 12 Trewartha climate zones stored in cells.b.
 */

import type { PackedGraph, WorldGenParams } from "./types";
// eslint-disable-next-line unused-imports/no-unused-imports
import { WATER_THRESHOLD, elevToMeters } from "./types";
// eslint-disable-next-line unused-imports/no-unused-imports
import { isLand, cellLat, cellAreaKm2 } from "./voronoi-mesh";

// ──────────────────────────────────────────────
// Trewartha Climate Types
// ──────────────────────────────────────────────

export const TREWARTHA_TYPES = [
  { id: 0, code: "Ar", name: "Tropical Wet" },
  { id: 1, code: "Aw", name: "Tropical Dry" },
  { id: 2, code: "Bs", name: "Steppe" },
  { id: 3, code: "Bw", name: "Desert" },
  { id: 4, code: "Cf", name: "Subtropical Humid" },
  { id: 5, code: "Cs", name: "Subtropical Dry Summer" },
  { id: 6, code: "Do", name: "Temperate Oceanic" },
  { id: 7, code: "Dc", name: "Temperate Continental" },
  { id: 8, code: "E", name: "Boreal" },
  { id: 9, code: "Ft", name: "Tundra" },
  { id: 10, code: "Fi", name: "Ice Cap" },
  { id: 11, code: "H", name: "Highland" },
] as const;

export const TREWARTHA_COLORS: Record<string, string> = {
  Ar: "#960000", // deep red
  Aw: "#ff0000", // red
  Bs: "#f5a500", // orange
  Bw: "#ffff00", // yellow
  Cf: "#96ff00", // lime
  Cs: "#00c800", // green
  Do: "#00ff6e", // seafoam
  Dc: "#37c8ff", // sky blue
  E: "#007d7d", // teal
  Ft: "#b2b2b2", // grey
  Fi: "#ffffff", // white
  H: "#966496", // mauve
};

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

// eslint-disable-next-line unused-imports/no-unused-vars
export function computeClimate(graph: PackedGraph, params: WorldGenParams): void {
  const { cells } = graph;
  const n = cells.n;

  // ── Pass 1: Temperature ────────────────────
  for (let i = 0; i < n; i++) {
    const lat = cellLat(graph, i);
    const elevMeters = elevToMeters(cells.h[i]!);

    // Base temperature: equator ~30°C, poles ~-30°C
    let temp = 30 - 60 * Math.abs(lat / 90);

    // Lapse rate: -6.5°C per 1000m
    temp -= 6.5 * (elevMeters / 1000);

    // Coastal moderation: bias toward 15°C for cells near coast
    const coastDist = cells.coastDist[i]!;
    if (coastDist < 5 && isLand(graph, i)) {
      temp = temp + (15 - temp) * 0.2;
    }

    // Clamp to Int8 range
    cells.temp[i] = Math.max(-128, Math.min(127, Math.round(temp)));
  }

  // ── Pass 2: Precipitation refinement (orographic) ──
  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) continue;

    const lat = cellLat(graph, i);
    const elevMeters = elevToMeters(cells.h[i]!);
    let prec = cells.prec[i]!;

    // Orographic effect at mid-latitudes (prevailing westerlies 30-60°)
    if (Math.abs(lat) >= 30 && Math.abs(lat) <= 60 && elevMeters > 2000) {
      // Check if windward (west-facing slope) or leeward
      const isWindward = hasWesternLowerNeighbor(graph, i);
      if (isWindward) {
        prec = Math.min(255, Math.round(prec * 1.5));
      } else {
        prec = Math.max(0, Math.round(prec * 0.7));
      }
    }

    // If rivers stage didn't set precipitation, assign a base value from latitude
    if (prec === 0) {
      // Tropics are wet, subtropics drier, mid-latitudes moderate
      const absLat = Math.abs(lat);
      if (absLat < 15) prec = 180;
      else if (absLat < 30) prec = 60;
      else if (absLat < 60) prec = 100;
      else prec = 40;

      // Coastal cells get more rain
      const cd = cells.coastDist[i]!;
      if (cd < 3) prec = Math.min(255, prec + 40);
      else if (cd < 8) prec = Math.min(255, prec + 15);
    }

    cells.prec[i] = prec;
  }

  // ── Pass 3: Trewartha biome classification ──
  for (let i = 0; i < n; i++) {
    if (!isLand(graph, i)) {
      cells.b[i] = 0; // water cells default to 0
      continue;
    }

    const temp = cells.temp[i]!;
    const prec = cells.prec[i]!;
    const elevMeters = elevToMeters(cells.h[i]!);
    const coastDist = cells.coastDist[i]!;

    cells.b[i] = classifyTrewartha(temp, prec, elevMeters, coastDist);
  }
}

// ──────────────────────────────────────────────
// Classification Logic
// ──────────────────────────────────────────────

/**
 * Classify a cell into one of 12 Trewartha climate types.
 * Returns biome index (0-11) matching TREWARTHA_TYPES[].id.
 */
function classifyTrewartha(
  temp: number,
  prec: number,
  elevMeters: number,
  coastDist: number
): number {
  // Highland overrides everything
  if (elevMeters > 3000) return 11; // H

  // Frozen climates
  if (temp < -20) return 10; // Fi (Ice Cap)
  if (temp < -10) return 9; // Ft (Tundra)

  // Boreal
  if (temp >= -10 && temp < 0) return 8; // E (Boreal)

  // Temperate (0-10°C)
  if (temp >= 0 && temp < 10) {
    if (coastDist < 10 && prec > 75) return 6; // Do (Oceanic)
    return 7; // Dc (Continental)
  }

  // Subtropical (10-22°C)
  if (temp >= 10 && temp < 22) {
    if (prec > 100) return 4; // Cf (Humid)
    if (prec >= 50) return 5; // Cs (Dry Summer)
    if (prec >= 25) return 2; // Bs (Steppe)
    return 3; // Bw (Desert)
  }

  // Tropical (>=22°C)
  if (prec > 200) return 0; // Ar (Wet)
  if (prec >= 100) return 1; // Aw (Dry)
  if (prec >= 50) return 2; // Bs (Steppe)
  return 3; // Bw (Desert)
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Check if any western neighbor is at lower elevation (windward slope).
 * "Western" means neighbor has lower longitude than the cell.
 */
function hasWesternLowerNeighbor(graph: PackedGraph, i: number): boolean {
  const { cells } = graph;
  const lng = cells.p[i * 2]!;
  const h = cells.h[i]!;
  const nbrs = cells.neighbors[i]!;

  for (const j of nbrs) {
    const nbrLng = cells.p[j * 2]!;
    // Neighbor is to the west and lower
    if (nbrLng < lng && cells.h[j]! < h) return true;
  }
  return false;
}
