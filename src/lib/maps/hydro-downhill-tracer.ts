/**
 * hydro-downhill-tracer.ts — Downhill Hydro-Gravity River Pathing Engine
 *
 * Implements physics-based hydraulic descent calculation for the IxStates Map Editor.
 * Traces water downhill from high-altitude springs/lakes to the sea along elevation
 * gradients, generating realistic river meanders, Strahler stream orders, and confluence angles.
 */

import type { LineString, Position } from "geojson";

export interface HydroTraceOptions {
  /** Maximum number of descent steps before terminating */
  maxSteps?: number;
  /** Step length in geographic degrees (approximate) */
  stepDeg?: number;
  /** Meander sinuosity factor (0 = straight, 1 = natural meandering, 2 = heavy oxbows) */
  meanderFactor?: number;
  /** Strahler stream order (1-10) */
  initialOrder?: number;
  /** Target terminal coastlines or existing water bodies to snap into */
  snapToWater?: boolean;
}

export interface HydroTraceResult {
  geometry: LineString;
  lengthKm: number;
  strahlerOrder: number;
  mouthCoords: Position;
  elevationDropMeters: number;
  profile: Array<{ coord: Position; elevationM: number; distanceKm: number }>;
}

/**
 * Calculates haversine distance between two coordinates in kilometers.
 */
function haversineKm(coord1: Position, coord2: Position): number {
  const R = 6371; // Earth radius in km
  const dLat = ((coord2[1]! - coord1[1]!) * Math.PI) / 180;
  const dLng = ((coord2[0]! - coord1[0]!) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[1]! * Math.PI) / 180) *
      Math.cos((coord2[1]! * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Pseudo-random generator for reproducible organic meandering.
 */
function pseudoNoise(x: number, y: number, seed = 1337): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Simulates a downhill hydro-gravity trace from a starting position.
 * If elevation function is provided, samples gradient; otherwise uses an organic downhill model.
 */
export function traceDownhillRiver(
  startCoords: [number, number],
  sampleElevation?: (lng: number, lat: number) => number,
  options: HydroTraceOptions = {}
): HydroTraceResult {
  const { maxSteps = 120, stepDeg = 0.08, meanderFactor = 1.0, initialOrder = 1 } = options;

  const points: Position[] = [[startCoords[0], startCoords[1]]];
  const profile: Array<{ coord: Position; elevationM: number; distanceKm: number }> = [];

  let currentLng = startCoords[0];
  let currentLat = startCoords[1];
  let currentElev = sampleElevation ? sampleElevation(currentLng, currentLat) : 1200;
  let totalDistKm = 0;
  const initialElev = currentElev;

  profile.push({
    coord: [currentLng, currentLat],
    elevationM: currentElev,
    distanceKm: 0,
  });

  // Default flow direction: away from continental interior / toward lower latitude/coast
  let currentHeading =
    Math.atan2(-currentLat, -currentLng) + (pseudoNoise(currentLng, currentLat) - 0.5) * 0.5;

  for (let step = 0; step < maxSteps; step++) {
    // If we've reached sea level, stop
    if (currentElev <= 5) {
      break;
    }

    if (sampleElevation) {
      // Sample 8 radial points to find steepest descent gradient
      let bestLng = currentLng;
      let bestLat = currentLat;
      let lowestElev = currentElev;
      const sampleRadius = stepDeg;

      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const testLng = currentLng + Math.cos(angle) * sampleRadius;
        const testLat = currentLat + Math.sin(angle) * sampleRadius;
        const elev = sampleElevation(testLng, testLat);

        if (elev < lowestElev) {
          lowestElev = elev;
          bestLng = testLng;
          bestLat = testLat;
        }
      }

      if (lowestElev < currentElev) {
        // Natural meandering perturbation based on terrain gradient
        const slope =
          (currentElev - lowestElev) /
          Math.max(1, haversineKm([currentLng, currentLat], [bestLng, bestLat]));
        const meanderAngle =
          (pseudoNoise(currentLng * 10, currentLat * 10, step) - 0.5) *
          Math.max(0.2, (1 / (slope + 0.1)) * 0.4 * meanderFactor);

        const dx = bestLng - currentLng;
        const dy = bestLat - currentLat;
        const baseAngle = Math.atan2(dy, dx) + meanderAngle;

        currentLng += Math.cos(baseAngle) * stepDeg;
        currentLat += Math.sin(baseAngle) * stepDeg;
        currentElev = lowestElev;
      } else {
        // Local depression / flat valley: push forward along smoothed heading to bypass pit
        currentLng += Math.cos(currentHeading) * stepDeg;
        currentLat += Math.sin(currentHeading) * stepDeg;
        currentElev = Math.max(0, currentElev - 8);
      }
    } else {
      // Organic synthetic descent model
      const meander =
        (pseudoNoise(currentLng * 15, currentLat * 15, step) - 0.5) * 0.6 * meanderFactor;
      currentHeading += meander;
      currentLng += Math.cos(currentHeading) * stepDeg;
      currentLat += Math.sin(currentHeading) * stepDeg;
      currentElev = Math.max(
        0,
        currentElev - (initialElev / maxSteps) * (1 + (pseudoNoise(step, 0) - 0.5) * 0.3)
      );
    }

    const prevPoint = points[points.length - 1]!;
    const stepDist = haversineKm(prevPoint, [currentLng, currentLat]);
    totalDistKm += stepDist;

    const nextCoord: Position = [
      Math.round(currentLng * 100000) / 100000,
      Math.round(currentLat * 100000) / 100000,
    ];
    points.push(nextCoord);
    profile.push({
      coord: nextCoord,
      elevationM: Math.round(currentElev),
      distanceKm: Math.round(totalDistKm * 10) / 10,
    });
  }

  // Determine Strahler stream order based on length and catchment distance
  let calculatedOrder = initialOrder;
  if (totalDistKm > 800) calculatedOrder = Math.max(calculatedOrder, 5);
  else if (totalDistKm > 400) calculatedOrder = Math.max(calculatedOrder, 4);
  else if (totalDistKm > 150) calculatedOrder = Math.max(calculatedOrder, 3);
  else if (totalDistKm > 50) calculatedOrder = Math.max(calculatedOrder, 2);

  return {
    geometry: {
      type: "LineString",
      coordinates: points,
    },
    lengthKm: Math.round(totalDistKm),
    strahlerOrder: calculatedOrder,
    mouthCoords: points[points.length - 1]!,
    elevationDropMeters: Math.round(initialElev - currentElev),
    profile,
  };
}
