/**
 * Terrain Generator - Creates altitude zones and climate classification.
 *
 * Altitude zones are the definitive terrain base layer that tiles all land
 * with no gaps. Climate is embedded as a property on each altitude polygon
 * so both layers share identical geometry.
 */

import type { Position, Polygon, Feature, FeatureCollection } from "geojson";
import { createNoise, fractalNoise, ridgeNoise } from "./noise";
import type { HeightmapResult } from "./landmass-generator";
import type { CollisionZone } from "./tectonic-shapes";
import { getGeneratorZones } from "../elevation-config";
import { LAYER_CONFIGS } from "../map-config";
import { extractGridOutline, douglasPeuckerSimplify } from "./grid-outline";

export interface TerrainParams {
  seed: number;
  heightmap: HeightmapResult;
  terrainRoughness: number; // 0-1
  hasIcecaps: boolean;
  /** Tectonic collision zones for mountain chain placement */
  collisionZones?: CollisionZone[];
}

export interface AltitudeZone {
  id: string;
  name: string;
  minElev: number;
  maxElev: number;
  color: string;
  /** Real-world elevation range in meters */
  elevationMin: number;
  elevationMax: number;
}

export interface ClimateZone {
  id: string;
  name: string;
  color: string;
}

export interface TerrainResult {
  altitudeFeatures: FeatureCollection;
  climateFeatures: FeatureCollection;
  icecapFeatures: FeatureCollection | null;
}

/** 9-zone meter-based altitude system from canonical elevation config */
const ALTITUDE_ZONES: AltitudeZone[] = getGeneratorZones();

/** Trewartha climate classification (12 types) */
const CLIMATE_TYPES: ClimateZone[] = [
  { id: "Ar", name: "Tropical Wet", color: "#990000" },
  { id: "Aw", name: "Tropical Wet-And-Dry", color: "#FF3300" },
  { id: "Bw", name: "Desert or Arid", color: "#FFFF33" },
  { id: "Bs", name: "Steppe or Semiarid", color: "#FF9933" },
  { id: "Cs", name: "Subtropical Dry Summer", color: "#669900" },
  { id: "Cf", name: "Subtropical Humid", color: "#336600" },
  { id: "Do", name: "Temperate Oceanic", color: "#00FF99" },
  { id: "Dc", name: "Temperate Continental", color: "#0099FF" },
  { id: "E", name: "Boreal", color: "#0066CC" },
  { id: "Ft", name: "Tundra", color: "#B9B9B9" },
  { id: "Fi", name: "Ice Cap", color: "#99FFFF" },
  { id: "H", name: "Highland", color: "#FFCCFF" },
];

const OCEAN_MARKER = 255;

/**
 * Generate terrain features (altitude zones and climate classification).
 *
 * Produces a unified set of polygons where each polygon has both altitude
 * and climate properties. Climate features reuse the same geometries with
 * different fill colors so the two layers are perfectly aligned.
 */
export function generateTerrain(params: TerrainParams): TerrainResult {
  const { seed, heightmap, terrainRoughness, hasIcecaps, collisionZones } = params;
  const { width, height, data, seaLevel } = heightmap;

  const mountainNoise = createNoise(seed + 50);
  const climateNoise = createNoise(seed + 60);
  const aridNoiseGen = createNoise(seed + 70);

  // ── Pass 1: Build enhanced elevation + terrain grid + climate grid ──
  const enhancedElev = new Float32Array(width * height);
  const terrainGrid = new Uint8Array(width * height); // altitude zone index per pixel
  const climateGrid = new Uint8Array(width * height); // climate type index per pixel

  // Fill ocean marker
  terrainGrid.fill(OCEAN_MARKER);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const base = data[idx]!;
      if (base < seaLevel) {
        enhancedElev[idx] = 0;
        continue;
      }

      // Normalize above sea level to [0, 1]
      const normalizedElev = (base - seaLevel) / (1 - seaLevel);

      // Add mountain ridges
      const nx = x / width;
      const ny = y / height;
      const ridge = ridgeNoise(mountainNoise, nx * 8, ny * 8, 4, 2.0, 0.5);

      // Collision zone mountain boost
      let collisionBoost = 0;
      if (collisionZones && collisionZones.length > 0) {
        for (const cz of collisionZones) {
          const dist = pointToPolylineDist(nx, ny, cz.boundary);
          if (dist < 0.08) {
            const proximity = 1 - dist / 0.08;
            collisionBoost = Math.max(collisionBoost, proximity * proximity * cz.elevationBoost);
          }
        }
      }

      const elev = Math.min(
        1,
        normalizedElev * 0.6 + ridge * 0.4 * terrainRoughness + collisionBoost * 0.3
      );
      enhancedElev[idx] = elev;

      // Classify climate
      const lat = 90 - (y / height) * 180;
      const absLat = Math.abs(lat);
      const noiseFactor = fractalNoise(climateNoise, nx * 3, ny * 3, 3) * 10;

      // Trewartha climate classification (12 types, indices 0-11)
      let climateIdx: number;
      if (elev > 0.5) {
        climateIdx = 11; // H: Highland
      } else if (absLat + noiseFactor > 80) {
        climateIdx = 10; // Fi: Ice Cap
      } else if (absLat + noiseFactor > 70) {
        climateIdx = 9; // Ft: Tundra
      } else if (absLat + noiseFactor > 60) {
        climateIdx = 8; // E: Boreal
      } else if (absLat + noiseFactor > 45) {
        // Temperate: split by continentality (proxy: distance from edge)
        const edgeDist = Math.min(x, width - x) / width;
        if (edgeDist < 0.15) {
          climateIdx = 6; // Do: Temperate Oceanic
        } else {
          climateIdx = 7; // Dc: Temperate Continental
        }
      } else if (absLat + noiseFactor > 25) {
        // Subtropical: split by precipitation proxy
        const precipProxy = fractalNoise(climateNoise, nx * 5, ny * 5, 2);
        if (precipProxy < 0) {
          climateIdx = 4; // Cs: Subtropical Dry Summer
        } else {
          climateIdx = 5; // Cf: Subtropical Humid
        }
      } else {
        // Tropical: split by precipitation proxy
        const precipProxy = fractalNoise(climateNoise, nx * 4, ny * 4, 2);
        if (precipProxy > 0.2) {
          climateIdx = 0; // Ar: Tropical Wet
        } else {
          climateIdx = 1; // Aw: Tropical Wet-And-Dry
        }
      }

      // Arid/steppe zones in mid-latitudes
      const aridNoise = fractalNoise(aridNoiseGen, nx * 5, ny * 5, 3);
      if (absLat > 15 && absLat < 40 && elev < 0.167) {
        if (aridNoise > 0.4) {
          climateIdx = 2; // Bw: Desert
        } else if (aridNoise > 0.25) {
          climateIdx = 3; // Bs: Steppe
        }
      }

      climateGrid[idx] = climateIdx;
    }
  }

  // ── Pass 1b: Quantile-threshold zone classification (no blur) ──
  // NO blur — preserves natural noise-driven spatial variation.
  // This creates many disconnected patches per zone, matching IxWorld's 4068 features.
  //
  // IxWorld area fractions: 51% zone0, 27% zone1, 14% zone2, 6% zone3, ...
  // We compute quantile thresholds then classify per-pixel.
  const IXWORLD_ZONE_FRACS = [0.51, 0.266, 0.139, 0.062, 0.016, 0.006, 0.001, 0.0003, 0.00001];

  // Collect land elevation values and compute quantile thresholds
  const landElevValues: number[] = [];
  for (let i = 0; i < enhancedElev.length; i++) {
    if (data[i]! >= seaLevel) {
      landElevValues.push(enhancedElev[i]!);
    }
  }
  landElevValues.sort((a, b) => a - b);

  const thresholds: number[] = [];
  let cumFrac = 0;
  for (let z = 0; z < IXWORLD_ZONE_FRACS.length; z++) {
    cumFrac += IXWORLD_ZONE_FRACS[z]!;
    const idx = Math.min(landElevValues.length - 1, Math.floor(cumFrac * landElevValues.length));
    thresholds.push(landElevValues[idx]!);
  }

  // Per-pixel zone assignment using thresholds.
  // Add sector-based fragmentation: divide the map into sectors and add
  // sector-specific elevation bias. This forces the SAME underlying zone
  // to be disconnected between sectors, creating many separate features.
  //
  // IxWorld has 4068 altitude features because each continent/island has
  // its own altitude patches. Sectors simulate this natural fragmentation.
  const fragNoise = createNoise(seed + 90);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i]! < seaLevel) continue;
      const e = enhancedElev[i]!;

      // Light noise for organic zone boundary variation.
      // Major fragmentation is handled by sector-based extraction in Pass 2.
      const nx = x / width;
      const ny = y / height;
      const frag = fractalNoise(fragNoise, nx * 20, ny * 20, 3, 2.0, 0.5) * 0.03;
      const eFrag = e + frag;

      let zone = 0;
      while (zone < thresholds.length - 1 && eFrag > thresholds[zone]!) zone++;
      terrainGrid[i] = zone;
    }
  }

  // ── Pass 2: Extract terrain polygons via sector-based grid ──
  //
  // IxWorld has 4068 altitude features — many small disconnected patches per zone.
  // A procedural heightmap is inherently smooth, so connected component analysis
  // produces few large regions. To match IxWorld's feature density, we divide the
  // map into sectors and run independent extraction within each. This ensures that
  // the same zone in different parts of the map creates separate features.
  //
  // Sectors: 20×12 = 240 sectors → each sector independently yields ~10-20 features
  // → ~2400-4800 total features (matching IxWorld's ~4068).
  const altitudeFeatures: Feature[] = [];
  const climateFeatures: Feature[] = [];

  const dsScale = 1; // Full pixel resolution for maximum altitude feature detail
  const dsW = Math.ceil(width / dsScale);
  const dsH = Math.ceil(height / dsScale);
  const dsZone = new Uint8Array(dsW * dsH);
  const dsClimate = new Uint8Array(dsW * dsH);

  // Downsample by majority vote per cell
  for (let dy = 0; dy < dsH; dy++) {
    for (let dx = 0; dx < dsW; dx++) {
      const zoneVotes = new Int32Array(ALTITUDE_ZONES.length + 1);
      const climVotes = new Int32Array(CLIMATE_TYPES.length);
      const pyEnd = Math.min((dy + 1) * dsScale, height);
      const pxEnd = Math.min((dx + 1) * dsScale, width);

      for (let py = dy * dsScale; py < pyEnd; py++) {
        for (let px = dx * dsScale; px < pxEnd; px++) {
          const z = terrainGrid[py * width + px]!;
          zoneVotes[z === OCEAN_MARKER ? ALTITUDE_ZONES.length : z]++;
          if (z !== OCEAN_MARKER) {
            climVotes[climateGrid[py * width + px]!]++;
          }
        }
      }

      let maxZVote = 0,
        maxZIdx = ALTITUDE_ZONES.length;
      for (let i = 0; i <= ALTITUDE_ZONES.length; i++) {
        if (zoneVotes[i]! > maxZVote) {
          maxZVote = zoneVotes[i]!;
          maxZIdx = i;
        }
      }
      dsZone[dy * dsW + dx] = maxZIdx === ALTITUDE_ZONES.length ? OCEAN_MARKER : maxZIdx;

      let maxCVote = 0,
        maxCIdx = 0;
      for (let i = 0; i < CLIMATE_TYPES.length; i++) {
        if (climVotes[i]! > maxCVote) {
          maxCVote = climVotes[i]!;
          maxCIdx = i;
        }
      }
      dsClimate[dy * dsW + dx] = maxCIdx;
    }
  }

  // Sector-based extraction: divide grid into sectors and run flood fill
  // within each sector independently. This prevents features from spanning
  // the entire map and creates many separate regions (like IxWorld's SVG patches).
  // Smaller sectors → more features. IxWorld has 4068 altitude features.
  // Target ~3 cells per sector → ~85×50 sectors → ~3000-5000 features.
  const SECTOR_W = Math.max(3, Math.floor(dsW / 85));
  const SECTOR_H = Math.max(2, Math.floor(dsH / 50));

  const MIN_REGION_CELLS = 1;

  // Process each sector independently. Flood fill cannot cross sector boundaries,
  // so the same zone in different sectors creates separate GeoJSON features.
  for (let secRow = 0; secRow * SECTOR_H < dsH; secRow++) {
    for (let secCol = 0; secCol * SECTOR_W < dsW; secCol++) {
      const secMinX = secCol * SECTOR_W;
      const secMinY = secRow * SECTOR_H;
      const secMaxX = Math.min(secMinX + SECTOR_W, dsW);
      const secMaxY = Math.min(secMinY + SECTOR_H, dsH);
      const secW = secMaxX - secMinX;
      const secH = secMaxY - secMinY;
      if (secW < 2 || secH < 2) continue;

      // Build a local zone grid for this sector
      const secGrid = new Uint8Array(secW * secH);
      const secClim = new Uint8Array(secW * secH);
      for (let ly = 0; ly < secH; ly++) {
        for (let lx = 0; lx < secW; lx++) {
          const gx = secMinX + lx;
          const gy = secMinY + ly;
          secGrid[ly * secW + lx] = dsZone[gy * dsW + gx]!;
          secClim[ly * secW + lx] = dsClimate[gy * dsW + gx]!;
        }
      }

      // Flood fill within this sector
      const secVisited = new Uint8Array(secW * secH);
      const secMask = new Uint8Array(secW * secH);

      for (let ly = 0; ly < secH; ly++) {
        for (let lx = 0; lx < secW; lx++) {
          const lidx = ly * secW + lx;
          if (secVisited[lidx]) continue;

          const zoneIdx = secGrid[lidx]!;
          if (zoneIdx === OCEAN_MARKER) {
            secVisited[lidx] = 1;
            continue;
          }

          secMask.fill(0);
          let regionSize = 0;
          const climVotes = new Int32Array(CLIMATE_TYPES.length);

          const stack: number[] = [lidx];
          while (stack.length > 0) {
            const ci = stack.pop()!;
            if (secVisited[ci] || secGrid[ci] !== zoneIdx) continue;

            secVisited[ci] = 1;
            secMask[ci] = 1;
            regionSize++;
            climVotes[secClim[ci]!]++;

            const cx = ci % secW;
            const cy = (ci - cx) / secW;

            if (cx + 1 < secW) stack.push(ci + 1);
            if (cx - 1 >= 0) stack.push(ci - 1);
            if (cy + 1 < secH) stack.push(ci + secW);
            if (cy - 1 >= 0) stack.push(ci - secW);
          }

          if (regionSize < MIN_REGION_CELLS) continue;

          // Extract outline within sector-local grid
          const rings = extractGridOutline(secMask, secW, secH);
          if (rings.length === 0) continue;

          // Take the ring with the largest area
          let bestRing = rings[0]!;
          let bestArea = Math.abs(signedArea2(bestRing));
          for (let ri = 1; ri < rings.length; ri++) {
            const a = Math.abs(signedArea2(rings[ri]!));
            if (a > bestArea) {
              bestArea = a;
              bestRing = rings[ri]!;
            }
          }

          // Convert sector-local grid coords → WGS84
          const wgsRing: Position[] = bestRing.map(([gx, gy]) => [
            (((secMinX + gx) * dsScale) / width) * 360 - 180,
            90 - (((secMinY + gy) * dsScale) / height) * 180,
          ]);

          // Light DP to remove strictly collinear points only
          const dpTolerance = (dsScale / width) * 360 * 0.08;
          let simplified = douglasPeuckerSimplify(wgsRing, dpTolerance);
          if (simplified.length < 4) continue;

          // Subdivide edges with noise for organic detail
          // IxWorld altitude features avg 38 vertices; raw grid outlines have ~10-15
          simplified = subdivideEdgesWithNoise(simplified, mountainNoise, altitudeFeatures.length);
          const first = simplified[0]!,
            last = simplified[simplified.length - 1]!;
          if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);

          // Ensure CCW winding
          const area = signedArea2(simplified);
          if (area < 0) simplified.reverse();

          const zone = ALTITUDE_ZONES[zoneIdx]!;
          const featureIdx = altitudeFeatures.length;

          // Dominant climate
          let dominantClimate = 0;
          let maxCVote = 0;
          for (let ci = 0; ci < climVotes.length; ci++) {
            if (climVotes[ci]! > maxCVote) {
              maxCVote = climVotes[ci]!;
              dominantClimate = ci;
            }
          }
          const climate = CLIMATE_TYPES[dominantClimate]!;

          const geometry: Polygon = { type: "Polygon", coordinates: [simplified] };

          altitudeFeatures.push({
            type: "Feature",
            id: `${zone.id}-${featureIdx}`,
            geometry,
            properties: {
              featureId: `${zone.id}-${featureIdx}`,
              zoneId: zone.id,
              zoneName: zone.name,
              fill: zone.color,
              elevationMin: zone.elevationMin,
              elevationMax: zone.elevationMax,
              elevationMidpoint: Math.round((zone.elevationMin + zone.elevationMax) / 2),
              elevationLabel: `${zone.elevationMin}-${zone.elevationMax}m`,
              climateId: climate.id,
              climateName: climate.name,
              climateColor: climate.color,
            },
          });

          climateFeatures.push({
            type: "Feature",
            id: `climate-${climate.id}-${featureIdx}`,
            geometry,
            properties: {
              featureId: `climate-${climate.id}-${featureIdx}`,
              climateId: climate.id,
              climateName: climate.name,
              fill: climate.color,
              zoneId: zone.id,
              zoneName: zone.name,
            },
          });
        }
      }
    }
  }

  // ── Icecaps ──
  let icecapFeatures: FeatureCollection | null = null;
  if (hasIcecaps) {
    const icecapPolys = extractIcecaps(seed);
    icecapFeatures = {
      type: "FeatureCollection",
      features: icecapPolys.map((geom, i) => ({
        type: "Feature" as const,
        id: `icecap-${i}`,
        geometry: geom,
        properties: {
          featureId: `icecap-${i}`,
          displayName: i < icecapPolys.length / 2 ? "North Polar Ice" : "South Polar Ice",
          fill: LAYER_CONFIGS.icecaps.fillColor as string,
        },
      })),
    };
  }

  return {
    altitudeFeatures: { type: "FeatureCollection", features: altitudeFeatures },
    climateFeatures: { type: "FeatureCollection", features: climateFeatures },
    icecapFeatures,
  };
}

// ─── Internal Helpers ──────────────────────────────────────────

/**
 * Subdivide polygon edges with noise-based perpendicular displacement.
 * Adds 2 intermediate points per edge for organic coastline detail.
 * Transforms a ~12-vertex grid outline into ~36 vertices (IxWorld avg: 38).
 */
function subdivideEdgesWithNoise(
  ring: Position[],
  noise: ReturnType<typeof createNoise>,
  featureIdx: number
): Position[] {
  const result: Position[] = [];
  const fOff = featureIdx * 17.3;
  const SUBS = 5; // 5 intermediate points per edge (target avg 38 per feature)

  for (let i = 0; i < ring.length; i++) {
    result.push(ring[i]!);
    if (i < ring.length - 1) {
      const curr = ring[i]!,
        next = ring[i + 1]!;
      const dx = next[0] - curr[0],
        dy = next[1] - curr[1];
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 0.001) continue;

      const perpX = -dy / segLen,
        perpY = dx / segLen;

      for (let s = 1; s <= SUBS; s++) {
        const t = s / (SUBS + 1);
        const n = fractalNoise(noise, curr[0] * 5 + fOff + s, curr[1] * 5, 2);
        const amp = segLen * 0.12; // 12% of edge length
        result.push([curr[0] + dx * t + perpX * n * amp, curr[1] + dy * t + perpY * n * amp]);
      }
    }
  }

  return result;
}

function signedArea2(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] - ring[i]![0]) * (ring[j]![1] + ring[i]![1]);
  }
  return area / 2;
}

/**
 * Generate icecap polygons fragmented into multiple features per pole.
 * IxWorld reference: 12 features, avg 625 vertices per feature.
 * Creates 6 sectors per pole = 12 total features with detailed coastlines.
 */
function extractIcecaps(seed: number): Polygon[] {
  const noise = createNoise(seed + 80);
  const polygons: Polygon[] = [];
  const SECTORS = 6; // 6 features per pole = 12 total
  const POINTS_PER_ARC = 400; // Dense vertices per sector arc (IxWorld avg 625 per feature)

  // Generate icecap sectors for each pole
  for (const pole of [1, -1]) {
    // 1 = north, -1 = south
    const baseLat = pole === 1 ? 90 : -90;
    const baseRadius = pole === 1 ? 5 : 8; // South cap is larger
    const noiseAmp = pole === 1 ? 1.5 : 2.0;
    const noiseOffset = pole === 1 ? 0 : 10;

    for (let seg = 0; seg < SECTORS; seg++) {
      const startAngle = (seg / SECTORS) * Math.PI * 2;
      const endAngle = ((seg + 1) / SECTORS) * Math.PI * 2;
      const segPoints: Position[] = [];

      // Outer arc with detailed noise coastline
      for (let i = 0; i <= POINTS_PER_ARC; i++) {
        const angle = startAngle + (i / POINTS_PER_ARC) * (endAngle - startAngle);
        const nx = Math.cos(angle) * 0.5 + 0.5;
        const ny = Math.sin(angle) * 0.5 + 0.5;
        const jitter = fractalNoise(noise, nx * 8 + noiseOffset, ny * 8, 4) * noiseAmp;
        const radius = baseRadius + jitter;
        const lng = Math.cos(angle) * 180;
        const lat = baseLat - pole * radius;
        segPoints.push([lng, lat]);
      }

      // Inner edge (back to pole via two radial lines)
      // Add a few points along the radial for smooth edges
      const lastArc = segPoints[segPoints.length - 1]!;
      const firstArc = segPoints[0]!;

      // Radial from end of arc toward pole
      for (let r = 1; r <= 3; r++) {
        const t = r / 4;
        segPoints.push([lastArc[0] * (1 - t), lastArc[1] + (baseLat - lastArc[1]) * t]);
      }

      // Radial from pole back to start of arc
      for (let r = 3; r >= 1; r--) {
        const t = r / 4;
        segPoints.push([firstArc[0] * (1 - t), firstArc[1] + (baseLat - firstArc[1]) * t]);
      }

      segPoints.push(segPoints[0]!); // Close ring
      polygons.push({ type: "Polygon", coordinates: [segPoints] });
    }
  }

  return polygons;
}

/**
 * Distance from a point to a polyline (in normalized 0-1 space).
 */
function pointToPolylineDist(px: number, py: number, line: Position[]): number {
  let minDist = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i]![0],
      ay = line[i]![1];
    const bx = line[i + 1]![0],
      by = line[i + 1]![1];
    const dx = bx - ax,
      dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const projX = ax + t * dx,
      projY = ay + t * dy;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}
