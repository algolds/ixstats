/**
 * Vector Synthesis Engine — Hybrid Seed & Harmonic Spline Deformation
 *
 * Combines high-precision vector seeds (continents, elevation contours,
 * hydrographic rivers, lake basins) with multi-octave harmonic noise perturbation
 * and 2-pass Chaikin corner smoothing.
 *
 * Produces smooth RFC 7946 compliant GeoJSON output.
 */

import type {
  FeatureCollection,
  Feature,
  Geometry,
  Polygon,
  MultiPolygon,
  LineString,
  Position,
} from "geojson";
import { makeRng } from "../worldgen/rng";
import { ELEVATION_ZONES } from "../elevation-config";

// Load vector seed datasets (bundled statically)
import CONTINENTS_SEED from "../../../public/data/vector-seeds/continents.json";
import ELEVATION_SEED from "../../../public/data/vector-seeds/elevation-contours.json";
import RIVERS_SEED from "../../../public/data/vector-seeds/rivers.json";
import LAKES_SEED from "../../../public/data/vector-seeds/lakes.json";

function round4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/**
 * Multi-octave continuous harmonic perturbation directly on vector coordinates.
 */
function perturbCoord(pt: Position, seed: number, frequency = 0.08, amplitude = 2.5): Position {
  const [lng, lat] = pt;
  const n1 = Math.sin(lng * frequency + seed) * Math.cos(lat * frequency + seed * 0.5);
  const n2 =
    Math.sin(lng * frequency * 2.5 - seed * 1.3) *
    Math.cos(lat * frequency * 2.5 + seed * 2.1) *
    0.5;

  const dx = (n1 + n2) * amplitude;
  const dy = (n2 - n1) * amplitude * 0.8;

  const newLng = Math.max(-180, Math.min(180, lng + dx));
  const newLat = Math.max(-85, Math.min(85, lat + dy));

  return [round4(newLng), round4(newLat)];
}

/**
 * 2-pass Chaikin's corner smoothing for organic vector rings.
 */
function smoothVectorRing(ring: Position[], iterations = 2): Position[] {
  if (ring.length < 4) return ring;
  let current = ring;

  for (let it = 0; it < iterations; it++) {
    const next: Position[] = [];
    const n = current.length - 1;
    for (let i = 0; i < n; i++) {
      const p0 = current[i]!;
      const p1 = current[i + 1]!;
      const q: Position = [
        round4(0.75 * p0[0] + 0.25 * p1[0]),
        round4(0.75 * p0[1] + 0.25 * p1[1]),
      ];
      const r: Position = [
        round4(0.25 * p0[0] + 0.75 * p1[0]),
        round4(0.25 * p0[1] + 0.75 * p1[1]),
      ];
      next.push(q, r);
    }
    // Close the ring
    if (next.length > 0) {
      next.push([next[0]![0], next[0]![1]]);
    }
    current = next;
  }

  return current;
}

/**
 * Morph a GeoJSON geometry using harmonic noise & Chaikin spline smoothing.
 */
function morphGeometry(geom: Geometry, seed: number): Geometry {
  if (geom.type === "Polygon") {
    const newRings = (geom as Polygon).coordinates.map((ring) => {
      const perturbed = ring.map((pt) => perturbCoord(pt, seed));
      return smoothVectorRing(perturbed, 2);
    });
    return { type: "Polygon", coordinates: newRings };
  }

  if (geom.type === "MultiPolygon") {
    const newPolys = (geom as MultiPolygon).coordinates.map((poly) => {
      return poly.map((ring) => {
        const perturbed = ring.map((pt) => perturbCoord(pt, seed));
        return smoothVectorRing(perturbed, 2);
      });
    });
    return { type: "MultiPolygon", coordinates: newPolys };
  }

  if (geom.type === "LineString") {
    const pts = (geom as LineString).coordinates.map((pt) => perturbCoord(pt, seed, 0.05, 1.8));
    return { type: "LineString", coordinates: pts };
  }

  return geom;
}

export interface HybridVectorWorld {
  background: FeatureCollection;
  altitudes: FeatureCollection;
  climate: FeatureCollection;
  rivers: FeatureCollection;
  lakes: FeatureCollection;
  political: FeatureCollection;
  cities: FeatureCollection;
}

/**
 * Main Hybrid Vector Synthesis entry point.
 */
export function synthesizeHybridVectorWorld(seed: number): HybridVectorWorld {
  const rng = makeRng(seed);

  // 1. Synthesize background (landmass)
  const bgFeatures: Feature[] = (CONTINENTS_SEED as FeatureCollection).features.map(
    (feat, idx) => ({
      type: "Feature",
      id: idx + 1,
      properties: {
        id: `landmass-${idx + 1}`,
        featureId: `landmass-${idx + 1}`,
        fill: "#e8e5da",
        _fillColor: "#e8e5da",
      },
      geometry: morphGeometry(feat.geometry, seed + idx * 1.7),
    })
  );

  // 2. Synthesize 9-zone elevation topography
  const elevFeatures: Feature[] = [];
  let elevId = 100;
  for (const zoneConfig of ELEVATION_ZONES) {
    const matchingSeeds = (ELEVATION_SEED as FeatureCollection).features.filter(
      (f: any) =>
        f.properties?.zone === zoneConfig.sortOrder || f.properties?.zone === zoneConfig.zoneId
    );

    const sourceFeatures =
      matchingSeeds.length > 0
        ? matchingSeeds
        : (ELEVATION_SEED as FeatureCollection).features.slice(0, 2);

    for (const feat of sourceFeatures) {
      elevId++;
      const color = zoneConfig.color.slice(0, 7);
      elevFeatures.push({
        type: "Feature",
        id: elevId,
        properties: {
          id: `zone_${zoneConfig.sortOrder}_${elevId}`,
          featureId: `zone_${zoneConfig.sortOrder}_${elevId}`,
          fill: color,
          _fillColor: color,
          zoneName: zoneConfig.zoneName,
          zoneId: zoneConfig.zoneId,
          elevationMin: zoneConfig.elevationMin,
          elevationMax: zoneConfig.elevationMax,
        },
        geometry: morphGeometry(feat.geometry, seed + elevId * 2.3),
      });
    }
  }

  // 3. Synthesize hydrographic rivers
  const riverFeatures: Feature[] = (RIVERS_SEED as FeatureCollection).features.map((feat, idx) => ({
    type: "Feature",
    id: 200 + idx + 1,
    properties: {
      id: `river-${200 + idx + 1}`,
      featureId: `river-${200 + idx + 1}`,
      displayName: feat.properties?.name || `River ${idx + 1}`,
      fill: "#7cb5d2",
      type: "river",
    },
    geometry: morphGeometry(feat.geometry, seed + idx * 3.1),
  }));

  // 4. Synthesize inland lake basins
  const lakeFeatures: Feature[] = (LAKES_SEED as FeatureCollection).features.map((feat, idx) => ({
    type: "Feature",
    id: 300 + idx + 1,
    properties: {
      id: `lake-${300 + idx + 1}`,
      featureId: `lake-${300 + idx + 1}`,
      displayName: feat.properties?.name || `Lake ${idx + 1}`,
      fill: "#7cb5d2",
      _fillColor: "#7cb5d2",
      type: "lake",
    },
    geometry: morphGeometry(feat.geometry, seed + idx * 4.3),
  }));

  return {
    background: { type: "FeatureCollection", features: bgFeatures },
    altitudes: { type: "FeatureCollection", features: elevFeatures },
    climate: { type: "FeatureCollection", features: [] },
    rivers: { type: "FeatureCollection", features: riverFeatures },
    lakes: { type: "FeatureCollection", features: lakeFeatures },
    political: { type: "FeatureCollection", features: [] },
    cities: { type: "FeatureCollection", features: [] },
  };
}
