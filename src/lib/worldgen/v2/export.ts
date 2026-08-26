/**
 * UPG v2 — GeoJSON Export Engine
 *
 * Converts WorldGraph into a 7-layer GeoJSON collection matching IxWorldMap renderer contract:
 * - background: landmass base polygons (merged by continent, 3-pass Chaikin smoothed)
 * - altitudes: 9-zone cumulative isoline contour polygons (zone N = elevZone >= N, 3-pass Chaikin smoothed)
 * - climate: biome region polygons (grouped by biome, 3-pass Chaikin smoothed)
 * - political: country territory polygons (grouped by state, with _id, _displayName, _fillColor, etc.)
 * - rivers: river network LineString features
 * - lakes: lake feature polygons
 * - icecaps: ice cap polygons (biome === 10)
 */

import type { WorldGraph } from "./types";
import type { FeatureCollection, Feature, LineString, Polygon, MultiPolygon } from "geojson";
import { ELEVATION_ZONES, TREWARTHA_BIOMES } from "./config";
import { mergeCellsToMultiPolygon } from "./helpers/polygon-merge";
import {
  chaikinSmoothLine,
  catmullRomSmooth,
  catmullRomSmoothLine,
  simplifyRing,
  perturbRing,
} from "./helpers/chaikin";
import { cellLng, cellLat } from "./mesh";

export function exportToGeoJSON(graph: WorldGraph): Record<string, FeatureCollection> {
  const layers: Record<string, FeatureCollection> = {
    background: exportBackground(graph),
    altitudes: exportAltitudes(graph),
    climate: exportClimate(graph),
    political: exportPolitical(graph),
    rivers: exportRivers(graph),
    lakes: exportLakes(graph),
    icecaps: exportIcecaps(graph),
  };

  return layers;
}

// ──────────────────────────────────────────────
// Layer Exporters
// ──────────────────────────────────────────────

function exportBackground(graph: WorldGraph): FeatureCollection {
  const { cells, features } = graph;
  const geoFeatures: Feature[] = [];

  const continents = features.filter((f) => f.type === "continent" || f.type === "island");

  for (const cont of continents) {
    const contCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.feature[i] === cont.id) {
        contCells.push(i);
      }
    }

    if (contCells.length === 0) continue;

    const geom = mergeCellsToMultiPolygon(graph, contCells);
    if (!geom) continue;

    const smoothedGeom = smoothGeometry(geom, 2);

    geoFeatures.push({
      type: "Feature",
      id: cont.id,
      geometry: smoothedGeom,
      properties: {
        id: `landmass_${cont.id}`,
        name: cont.name,
        type: cont.type,
        fill: "#e8e5da",
        _fillColor: "#e8e5da",
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportAltitudes(graph: WorldGraph): FeatureCollection {
  const { cells } = graph;
  const geoFeatures: Feature[] = [];

  // Process 9 elevation zones using cumulative isoline thresholding (elevZone >= z)
  for (let z = 0; z < ELEVATION_ZONES.length; z++) {
    const zoneConfig = ELEVATION_ZONES[z];
    if (!zoneConfig) continue;

    const zoneLandCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.isLand[i] && cells.elevZone[i]! >= z) {
        zoneLandCells.push(i);
      }
    }

    if (zoneLandCells.length === 0) continue;

    const geom = mergeCellsToMultiPolygon(graph, zoneLandCells);
    if (!geom) continue;

    const smoothedGeom = smoothGeometry(geom, 2);

    geoFeatures.push({
      type: "Feature",
      id: z + 1,
      geometry: smoothedGeom,
      properties: {
        zone: zoneConfig.zoneId,
        zoneName: zoneConfig.name,
        elevationMin: zoneConfig.minMeters,
        elevationMax: zoneConfig.maxMeters,
        fill: zoneConfig.color,
        _fillColor: zoneConfig.color,
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportClimate(graph: WorldGraph): FeatureCollection {
  const { cells } = graph;
  const geoFeatures: Feature[] = [];

  for (const biomeConfig of TREWARTHA_BIOMES) {
    const biomeCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.isLand[i] && cells.biome[i] === biomeConfig.id) {
        biomeCells.push(i);
      }
    }

    if (biomeCells.length === 0) continue;

    const geom = mergeCellsToMultiPolygon(graph, biomeCells);
    if (!geom) continue;

    const smoothedGeom = smoothGeometry(geom, 2);

    geoFeatures.push({
      type: "Feature",
      id: biomeConfig.id + 1,
      geometry: smoothedGeom,
      properties: {
        biomeId: biomeConfig.id,
        code: biomeConfig.code,
        name: biomeConfig.name,
        fill: biomeConfig.color,
        _fillColor: biomeConfig.color,
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportPolitical(graph: WorldGraph): FeatureCollection {
  const { cells, states } = graph;
  const geoFeatures: Feature[] = [];

  for (const state of states) {
    const stateCells: number[] = [];
    let sumLng = 0,
      sumLat = 0;

    for (let i = 0; i < cells.n; i++) {
      if (cells.state[i] === state.id) {
        stateCells.push(i);
        sumLng += cellLng(graph, i);
        sumLat += cellLat(graph, i);
      }
    }

    if (stateCells.length === 0) continue;

    const centroidLng = sumLng / stateCells.length;
    const centroidLat = sumLat / stateCells.length;

    const geom = mergeCellsToMultiPolygon(graph, stateCells);
    if (!geom) continue;

    const smoothedGeom = smoothGeometry(geom, 2);

    geoFeatures.push({
      type: "Feature",
      id: state.id,
      geometry: smoothedGeom,
      properties: {
        _id: `state_${state.id}`,
        id: state.id,
        _displayName: state.name,
        name: state.name,
        _fillColor: state.color,
        color: state.color,
        _areaSqKm: state.areaKm2,
        _centroidLng: centroidLng,
        _centroidLat: centroidLat,
        culture: state.culture,
        continent: state.continent,
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportRivers(graph: WorldGraph): FeatureCollection {
  const { rivers, cells } = graph;
  const geoFeatures: Feature[] = [];

  for (const river of rivers) {
    // Filter river cells to strictly land cells to guarantee rivers never flow in ocean
    const landRiverCells = river.cells.filter((c) => cells.isLand[c] === 1);
    if (landRiverCells.length < 2) continue;

    const lineCoords: [number, number][] = landRiverCells.map((c) => [
      cellLng(graph, c),
      cellLat(graph, c),
    ]);

    const smoothedLine = catmullRomSmoothLine(lineCoords, 3);

    const geom: LineString = {
      type: "LineString",
      coordinates: smoothedLine,
    };

    geoFeatures.push({
      type: "Feature",
      id: river.id,
      geometry: geom,
      properties: {
        id: river.id,
        name: river.name,
        flux: river.flux,
        lengthKm: river.lengthKm,
        fill: "#0284c7",
        _fillColor: "#0284c7",
        stroke: "#0284c7",
        _strokeColor: "#0284c7",
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportLakes(graph: WorldGraph): FeatureCollection {
  const { cells, features } = graph;
  const geoFeatures: Feature[] = [];

  const lakeFeatures = features.filter((f) => f.type === "lake");

  for (const lake of lakeFeatures) {
    const lakeCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.isLand[i] === 1 && cells.lake[i] === lake.id) {
        lakeCells.push(i);
      }
    }

    if (lakeCells.length === 0) continue;

    const geom = mergeCellsToMultiPolygon(graph, lakeCells);
    if (!geom) continue;

    const smoothedGeom = smoothGeometry(geom, 2);

    geoFeatures.push({
      type: "Feature",
      id: lake.id,
      geometry: smoothedGeom,
      properties: {
        id: lake.id,
        name: lake.name,
        areaKm2: lake.areaKm2,
        fill: "#0284c7",
        _fillColor: "#0284c7",
        stroke: "#0284c7",
        _strokeColor: "#0284c7",
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportIcecaps(graph: WorldGraph): FeatureCollection {
  const { cells } = graph;
  const geoFeatures: Feature[] = [];

  const iceCells: number[] = [];
  for (let i = 0; i < cells.n; i++) {
    if (cells.biome[i] === 10) {
      // 10 = Fi Ice Cap
      iceCells.push(i);
    }
  }

  if (iceCells.length > 0) {
    const geom = mergeCellsToMultiPolygon(graph, iceCells);
    if (geom) {
      const smoothedGeom = smoothGeometry(geom, 2);
      geoFeatures.push({
        type: "Feature",
        id: 1,
        geometry: smoothedGeom,
        properties: {
          name: "Ice Cap",
          fill: "#ffffff",
          _fillColor: "#ffffff",
        },
      });
    }
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function processVectorRing(ring: [number, number][], passes: number): [number, number][] {
  // 1. Fine decimation of collinear/duplicate points (0.001° ≈ 100m)
  const simplified = simplifyRing(ring, 0.001);
  // 2. Interpolate smooth Catmull-Rom spline curves through structural control points
  const smoothed = catmullRomSmooth(simplified, passes);
  // 3. Sub-cell harmonic noise perturbation for natural organic cartographic detail
  return perturbRing(smoothed, 42, 0.08, 0.004);
}

function smoothGeometry(geom: Polygon | MultiPolygon, passes: number): Polygon | MultiPolygon {
  if (geom.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geom.coordinates.map((ring) =>
        processVectorRing(ring as [number, number][], passes)
      ),
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: geom.coordinates.map((poly) =>
      poly.map((ring) => processVectorRing(ring as [number, number][], passes))
    ),
  };
}

function filterSmallComponents(graph: WorldGraph, cellList: number[], minSize: number): number[] {
  const { cells } = graph;
  const cellSet = new Set(cellList);
  const visited = new Set<number>();
  const validCells: number[] = [];

  for (const c of cellList) {
    if (visited.has(c)) continue;

    const comp: number[] = [];
    const queue = [c];
    visited.add(c);

    while (queue.length > 0) {
      const curr = queue.pop()!;
      comp.push(curr);
      for (const nb of cells.neighbors[curr]!) {
        if (cellSet.has(nb) && !visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    if (comp.length >= minSize) {
      validCells.push(...comp);
    }
  }

  return validCells;
}
