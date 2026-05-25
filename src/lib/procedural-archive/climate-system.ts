/**
 * Climate System — Physics-based climate simulation.
 *
 * Ported from World Orogen's wind.js, precipitation.js, temperature.js,
 * ocean.js, and koppen.js. Simplified to annual-average (single-season).
 *
 * Pipeline:
 *   1. Continentality gradient (BFS from coast)
 *   2. Wind simulation (ITCZ, Coriolis, pressure-driven)
 *   3. Ocean currents (wind-driven, western intensification)
 *   4. Precipitation (moisture advection, orographic effects)
 *   5. Temperature (ITCZ baseline, lapse rate, continental amplification)
 *   6. Trewartha classification → IxWorld's 12 climate types
 */

import { createNoise, fractalNoise } from "./noise";
import { getNeighbors4 } from "./plate-simulation";

// ─── Types ───────────────────────────────────────────────────

/** Trewartha climate classification codes */
export type IxWorldClimate =
  | "Ar" // Tropical Wet
  | "Aw" // Tropical Wet-And-Dry
  | "Bw" // Desert or Arid
  | "Bs" // Steppe or Semiarid
  | "Cs" // Subtropical Dry Summer
  | "Cf" // Subtropical Humid
  | "Do" // Temperate Oceanic
  | "Dc" // Temperate Continental
  | "E" // Boreal
  | "Ft" // Tundra
  | "Fi" // Ice Cap
  | "H"; // Highland

export interface ClimateResult {
  /** Temperature in degrees C per cell */
  temperature: Float32Array;
  /** Precipitation [0, 1] normalized per cell */
  precipitation: Float32Array;
  /** IxWorld climate type per cell (index into CLIMATE_TYPES) */
  climateType: Uint8Array;
  /** Wind eastward component */
  windE: Float32Array;
  /** Wind northward component */
  windN: Float32Array;
}

/** Mapping from index to Trewartha climate type */
export const CLIMATE_TYPES: IxWorldClimate[] = [
  "Ar", // 0  — Tropical Wet
  "Aw", // 1  — Tropical Wet-And-Dry
  "Bw", // 2  — Desert or Arid
  "Bs", // 3  — Steppe or Semiarid
  "Cs", // 4  — Subtropical Dry Summer
  "Cf", // 5  — Subtropical Humid
  "Do", // 6  — Temperate Oceanic
  "Dc", // 7  — Temperate Continental
  "E", // 8  — Boreal
  "Ft", // 9  — Tundra
  "Fi", // 10 — Ice Cap
  "H", // 11 — Highland
];

/** Human-readable names for each Trewartha type */
export const CLIMATE_NAMES: Record<IxWorldClimate, string> = {
  Ar: "Tropical Wet",
  Aw: "Tropical Wet-And-Dry",
  Bw: "Desert or Arid",
  Bs: "Steppe or Semiarid",
  Cs: "Subtropical Dry Summer",
  Cf: "Subtropical Humid",
  Do: "Temperate Oceanic",
  Dc: "Temperate Continental",
  E: "Boreal",
  Ft: "Tundra",
  Fi: "Ice Cap",
  H: "Highland",
};

/** Canonical Trewartha color scheme (from wiki legend) */
export const CLIMATE_COLORS: Record<IxWorldClimate, string> = {
  Ar: "#990000",
  Aw: "#FF3300",
  Bw: "#FFFF33",
  Bs: "#FF9933",
  Cs: "#669900",
  Cf: "#336600",
  Do: "#00FF99",
  Dc: "#0099FF",
  E: "#0066CC",
  Ft: "#B9B9B9",
  Fi: "#99FFFF",
  H: "#FFCCFF",
};

// ─── Main Entry ──────────────────────────────────────────────

/**
 * Compute climate for all grid cells.
 */
export function computeClimate(
  elevation: Float32Array,
  isOcean: Uint8Array,
  width: number,
  height: number,
  seed: number
): ClimateResult {
  const noise = createNoise(seed + 2000);

  // Step 1: Continentality (distance from coast through land)
  const continentality = computeContinentality(isOcean, width, height);

  // Step 2: Wind simulation
  const { windE, windN } = computeWind(isOcean, width, height);

  // Step 3: Ocean current warmth
  const currentWarmth = computeOceanCurrentWarmth(isOcean, windE, width, height);

  // Step 4: Precipitation
  const precipitation = computePrecipitation(
    elevation,
    isOcean,
    windE,
    windN,
    continentality,
    width,
    height,
    seed
  );

  // Step 5: Temperature
  const temperature = computeTemperature(
    elevation,
    isOcean,
    continentality,
    currentWarmth,
    width,
    height,
    noise
  );

  // Step 6: Classify climate (Trewartha)
  const climateType = classifyClimate(
    temperature,
    precipitation,
    elevation,
    isOcean,
    continentality,
    width,
    height
  );

  return { temperature, precipitation, climateType, windE, windN };
}

// ─── Continentality ──────────────────────────────────────────

function computeContinentality(isOcean: Uint8Array, width: number, height: number): Float32Array {
  const N = width * height;
  const dist = new Float32Array(N).fill(Infinity);

  // Seeds: land cells adjacent to ocean
  const queue: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) continue;
      const neighbors = getNeighbors4(x, y, width, height);
      for (const n of neighbors) {
        if (isOcean[n]) {
          dist[idx] = 0;
          queue.push(idx);
          break;
        }
      }
    }
  }

  // BFS through land only
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi]!;
    const x = cur % width;
    const y = (cur - x) / width;
    const neighbors = getNeighbors4(x, y, width, height);
    for (const nb of neighbors) {
      if (!isOcean[nb] && dist[nb] === Infinity) {
        dist[nb] = dist[cur]! + 1;
        queue.push(nb);
      }
    }
  }

  // Normalize to [0, 1]
  let maxDist = 0;
  for (let i = 0; i < N; i++) {
    if (dist[i]! < Infinity && dist[i]! > maxDist) maxDist = dist[i]!;
  }
  const result = new Float32Array(N);
  if (maxDist > 0) {
    for (let i = 0; i < N; i++) {
      result[i] = isOcean[i] ? 0 : Math.min(1, dist[i]! / maxDist);
    }
  }
  return result;
}

// ─── Wind Simulation ─────────────────────────────────────────

function computeWind(
  isOcean: Uint8Array,
  width: number,
  height: number
): { windE: Float32Array; windN: Float32Array } {
  const N = width * height;
  const windE = new Float32Array(N);
  const windN = new Float32Array(N);

  for (let y = 0; y < height; y++) {
    // Latitude in degrees: 90 at top, -90 at bottom
    const latDeg = 90 - (y / height) * 180;
    const absLat = Math.abs(latDeg);

    // Wind belts (simplified annual average)
    let zonalWind: number; // Positive = eastward
    let meridionalWind: number; // Positive = northward

    if (absLat < 10) {
      // ITCZ: weak, converging
      zonalWind = -0.2; // Weak easterlies
      meridionalWind = latDeg > 0 ? -0.3 : 0.3; // Converge toward equator
    } else if (absLat < 30) {
      // Trade winds: strong easterlies
      zonalWind = -0.8;
      meridionalWind = latDeg > 0 ? -0.2 : 0.2; // Equatorward
    } else if (absLat < 60) {
      // Westerlies
      const t = (absLat - 30) / 30;
      zonalWind = 0.3 + t * 0.5; // Strong westerlies
      meridionalWind = latDeg > 0 ? 0.1 : -0.1; // Poleward
    } else {
      // Polar easterlies
      zonalWind = -0.3;
      meridionalWind = latDeg > 0 ? -0.2 : 0.2; // Equatorward
    }

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      windE[idx] = zonalWind;
      windN[idx] = meridionalWind;
    }
  }

  return { windE, windN };
}

// ─── Ocean Current Warmth ────────────────────────────────────

function computeOceanCurrentWarmth(
  isOcean: Uint8Array,
  windE: Float32Array,
  width: number,
  height: number
): Float32Array {
  const N = width * height;
  const warmth = new Float32Array(N);

  for (let y = 0; y < height; y++) {
    const latDeg = 90 - (y / height) * 180;
    const absLat = Math.abs(latDeg);

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!isOcean[idx]) continue;

      // Base warmth from latitude
      warmth[idx] = Math.max(0, 1 - absLat / 60);

      // Western boundary intensification: warm currents on western coasts
      // Check if there's land to the west
      const westIdx = y * width + ((x - 1 + width) % width);
      if (!isOcean[westIdx]) {
        // Western coast — warmer current
        warmth[idx] += 0.2;
      }

      // Eastern boundary: cold upwelling
      const eastIdx = y * width + ((x + 1) % width);
      if (!isOcean[eastIdx]) {
        // Eastern coast — colder
        warmth[idx] -= 0.15;
      }

      warmth[idx] = Math.max(0, Math.min(1, warmth[idx]!));
    }
  }

  return warmth;
}

// ─── Precipitation ───────────────────────────────────────────

function computePrecipitation(
  elevation: Float32Array,
  isOcean: Uint8Array,
  windE: Float32Array,
  windN: Float32Array,
  continentality: Float32Array,
  width: number,
  height: number,
  seed: number
): Float32Array {
  const N = width * height;
  const precip = new Float32Array(N);
  const noise = createNoise(seed + 3000);

  for (let y = 0; y < height; y++) {
    const latDeg = 90 - (y / height) * 180;
    const absLat = Math.abs(latDeg);
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isOcean[idx]) {
        precip[idx] = 0.5; // Ocean baseline
        continue;
      }

      // Base precipitation from latitude
      let p: number;
      if (absLat < 10) {
        p = 0.9; // ITCZ: very wet
      } else if (absLat < 30) {
        p = 0.3; // Subtropical high: dry
      } else if (absLat < 60) {
        const t = (absLat - 30) / 30;
        p = 0.3 + t * 0.4; // Increasing with westerlies
      } else {
        p = 0.2; // Polar: cold, dry
      }

      // Continental dryness: interior is drier
      p *= 1 - continentality[idx]! * 0.5;

      // Orographic effect: windward uplift increases precip, leeward decreases
      const h = elevation[idx]!;
      const we = windE[idx]!;
      const wn = windN[idx]!;

      // Check upwind elevation gradient
      const upwindX = (x - Math.sign(we) + width) % width;
      const upwindY = Math.max(0, Math.min(height - 1, y - Math.sign(wn)));
      const upwindIdx = upwindY * width + upwindX;
      const upwindH = elevation[upwindIdx]!;

      if (h > upwindH + 0.05) {
        // Windward: uplift causes rain
        p += (h - upwindH) * 0.6;
      } else if (h < upwindH - 0.05) {
        // Leeward: rain shadow
        p *= 0.4;
      }

      // Elevation bonus for mid-altitude
      if (h > 0.3 && h < 0.7) {
        p += 0.1;
      }

      // Noise variation
      p += fractalNoise(noise, (x / width) * 6, (y / height) * 6, 3, 2.0, 0.5) * 0.15;

      precip[idx] = Math.max(0, Math.min(1, p));
    }
  }

  return precip;
}

// ─── Temperature ─────────────────────────────────────────────

function computeTemperature(
  elevation: Float32Array,
  isOcean: Uint8Array,
  continentality: Float32Array,
  currentWarmth: Float32Array,
  width: number,
  height: number,
  noise: ReturnType<typeof createNoise>
): Float32Array {
  const N = width * height;
  const temp = new Float32Array(N);

  for (let y = 0; y < height; y++) {
    const latDeg = 90 - (y / height) * 180;
    const absLat = Math.abs(latDeg);

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Base temperature from latitude (ITCZ-based)
      // 28°C at equator, decreasing with latitude
      let t = 28 - absLat * 0.7;

      if (isOcean[idx]) {
        // Ocean: moderated by currents
        t += (currentWarmth[idx]! - 0.5) * 8;
        // Ocean moderates extremes
        t = Math.max(-2, Math.min(30, t));
      } else {
        // Land: elevation lapse rate
        const h = elevation[idx]!;
        // Lapse rate: ~6.5°C per 1000m, elevation [0,1] maps to ~0-5000m
        const elevM = h * 5000;
        t -= elevM * 0.0065;

        // Continental amplification: interior has more extreme temperatures
        const contAmp = continentality[idx]! * 0.3;
        if (latDeg > 0) {
          // Northern hemisphere
          t -= contAmp * 5; // Colder winters averaged in
        } else {
          t -= contAmp * 5;
        }

        // Nearby ocean warmth influence
        // Check adjacent ocean cells for coastal moderation
        const neighbors = getNeighbors4(x, y, width, height);
        let oceanCount = 0;
        let totalWarmth = 0;
        for (const n of neighbors) {
          if (isOcean[n]) {
            oceanCount++;
            totalWarmth += currentWarmth[n]!;
          }
        }
        if (oceanCount > 0) {
          const avgWarmth = totalWarmth / oceanCount;
          t += (avgWarmth - 0.5) * 4 * (1 - continentality[idx]!);
        }
      }

      // Add small noise for variation
      t += fractalNoise(noise, (x / width) * 4, (y / height) * 4, 2, 2.0, 0.5) * 2;

      temp[idx] = t;
    }
  }

  return temp;
}

// ─── Trewartha Classification → IxWorld 12 Types ─────────────

function classifyClimate(
  temperature: Float32Array,
  precipitation: Float32Array,
  elevation: Float32Array,
  isOcean: Uint8Array,
  continentality: Float32Array,
  width: number,
  height: number
): Uint8Array {
  const N = width * height;
  const climateType = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    if (isOcean[i]) {
      climateType[i] = 0; // Default (ocean cells are masked anyway)
      continue;
    }

    const temp = temperature[i]!;
    const precip = precipitation[i]!;
    const elev = elevation[i]!;
    const cont = continentality[i]!;

    // H: Highland — high elevation override
    if (elev > 0.6) {
      climateType[i] = 11; // H
      continue;
    }

    // Fi: Ice Cap — extremely cold
    if (temp < -25) {
      climateType[i] = 10; // Fi
      continue;
    }

    // Ft: Tundra — very cold
    if (temp < -10) {
      climateType[i] = 9; // Ft
      continue;
    }

    // Bw: Desert — very low precipitation
    if (precip < 0.15) {
      climateType[i] = 2; // Bw
      continue;
    }

    // Bs: Steppe — low precipitation
    if (precip < 0.3) {
      climateType[i] = 3; // Bs
      continue;
    }

    // E: Boreal — cold but not extreme
    if (temp < 0) {
      climateType[i] = 8; // E
      continue;
    }

    // Temperate zone: temp 0-10°C
    if (temp < 10) {
      if (cont > 0.5) {
        climateType[i] = 7; // Dc — Temperate Continental
      } else {
        climateType[i] = 6; // Do — Temperate Oceanic
      }
      continue;
    }

    // Subtropical zone: temp 10-18°C
    if (temp < 18) {
      if (precip < 0.5) {
        climateType[i] = 4; // Cs — Subtropical Dry Summer
      } else {
        climateType[i] = 5; // Cf — Subtropical Humid
      }
      continue;
    }

    // Tropical zone: temp >= 18°C
    if (precip > 0.7) {
      climateType[i] = 0; // Ar — Tropical Wet
    } else {
      climateType[i] = 1; // Aw — Tropical Wet-And-Dry
    }
  }

  return climateType;
}
