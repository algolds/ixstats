/**
 * UPG v2 — GeoJSON Export Engine
 *
 * Converts WorldGraph into a 7-layer GeoJSON collection matching IxWorldMap renderer contract:
 * - background: landmass base polygons (merged by continent, spline smoothed)
 * - altitudes: 9-zone cumulative isoline contour polygons (zone N = elevZone >= N, spline smoothed)
 * - climate: biome region polygons (grouped by biome, spline smoothed)
 * - political: country territory polygons (grouped by state, with _id, _displayName, _fillColor, slotKey, etc.)
 *   (omitted when the realm keeps its own borders)
 * - rivers: river network LineString features
 * - lakes: lake feature polygons
 * - icecaps: ice cap polygons (biome === 10)
 *
 * Only countries carry names (the suggested names of their slots): continents, rivers and lakes
 * are left unnamed.
 *
 * Polygons are built to be valid as they stand, without a PostGIS repair: shells run counter-clockwise, holes
 * clockwise inside their shell, rings do not cross themselves, and the rings of neighbouring countries and
 * biomes share their borders point for point. A coast is the same curve in every layer that has it. They stop
 * short of the poles (see RING_LATITUDE).
 */

import { slotKey, type WorldGraph, type WorldGenParams } from "./types";
import type {
  FeatureCollection,
  Feature,
  LineString,
  Polygon,
  MultiPolygon,
  Position,
} from "geojson";
import { ELEVATION_ZONES, ICE_CAP_BIOME, TREWARTHA_BIOMES } from "./config";
import { coastCorners, mergeCells, type MergedPolygon } from "./helpers/polygon-merge";
import { catmullRomSmoothLine } from "./helpers/chaikin";
import { SmoothingCache, smoothRing } from "./helpers/ring-smooth";
import { cellLng, cellLat } from "./mesh";

/** Spline refinement passes of every polygon ring: 4 vertices per cell edge */
const SMOOTHING_PASSES = 2;

export function exportToGeoJSON(
  graph: WorldGraph,
  params: Pick<WorldGenParams, "hasIcecaps"> = { hasIcecaps: true },
  options: { political?: boolean } = {}
): Record<string, FeatureCollection> {
  // The same corners for every layer, so a coast has the same chains in all of them
  const { cells } = graph;
  const corners = coastCorners(graph, (i) =>
    cells.isLand[i] ? 1 + (cells.state[i]! * 16 + cells.biome[i]!) * 16 + cells.elevZone[i]! : 0
  );
  // A border is smoothed once for both rings that share it, a coast once for every layer
  const shared: SharedSmoothing = { corners, cache: new SmoothingCache() };
  return {
    background: exportBackground(graph, shared),
    altitudes: exportAltitudes(graph, shared),
    climate: exportClimate(graph, shared),
    ...((options.political ?? true) ? { political: exportPolitical(graph, shared) } : {}),
    rivers: exportRivers(graph),
    lakes: exportLakes(graph, shared),
    icecaps: params.hasIcecaps
      ? exportIcecaps(graph, shared)
      : { type: "FeatureCollection", features: [] },
  };
}

/** What every layer's rings share: the coast corners and the chains smoothed so far. */
interface SharedSmoothing {
  corners: Uint8Array;
  cache: SmoothingCache;
}

/** Cell ids by key, in cell order (key 0 means none). One pass instead of one per feature. */
function bucketCells(n: number, keyOf: (cell: number) => number): Map<number, number[]> {
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const key = keyOf(i);
    if (key === 0) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  return buckets;
}

// Layer Exporters

function exportBackground(graph: WorldGraph, shared: SharedSmoothing): FeatureCollection {
  const { cells, features } = graph;
  const geoFeatures: Feature[] = [];

  const continents = features.filter((f) => f.type === "continent" || f.type === "island");
  const landmassIds = new Set(continents.map((f) => f.id));
  const landmassOf = (i: number) => (landmassIds.has(cells.feature[i]!) ? cells.feature[i]! : 0);
  const cellsOf = bucketCells(cells.n, landmassOf);

  for (const cont of continents) {
    const contCells = cellsOf.get(cont.id);
    if (!contCells) continue;

    const smoothedGeom = mergeAndSmooth(graph, shared, contCells, landmassOf);
    if (!smoothedGeom) continue;

    geoFeatures.push({
      type: "Feature",
      id: cont.id,
      geometry: smoothedGeom,
      properties: {
        id: `landmass_${cont.id}`,
        type: cont.type,
        fill: "#e8e5da",
        _fillColor: "#e8e5da",
      },
    });
  }

  return { type: "FeatureCollection", features: geoFeatures };
}

function exportAltitudes(graph: WorldGraph, shared: SharedSmoothing): FeatureCollection {
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

    const smoothedGeom = mergeAndSmooth(graph, shared, zoneLandCells);
    if (!smoothedGeom) continue;

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

function exportClimate(graph: WorldGraph, shared: SharedSmoothing): FeatureCollection {
  const { cells } = graph;
  const geoFeatures: Feature[] = [];
  /** Water is its own region, apart from every biome */
  const biomeOf = (i: number) => (cells.isLand[i] ? cells.biome[i]! + 1 : 0);

  for (const biomeConfig of TREWARTHA_BIOMES) {
    const biomeCells: number[] = [];
    for (let i = 0; i < cells.n; i++) {
      if (cells.isLand[i] && cells.biome[i] === biomeConfig.id) {
        biomeCells.push(i);
      }
    }

    if (biomeCells.length === 0) continue;

    const smoothedGeom = mergeAndSmooth(graph, shared, biomeCells, biomeOf);
    if (!smoothedGeom) continue;

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

function exportPolitical(graph: WorldGraph, shared: SharedSmoothing): FeatureCollection {
  const { cells, states } = graph;
  const geoFeatures: Feature[] = [];
  const stateOf = (i: number) => cells.state[i]!;
  const cellsOf = bucketCells(cells.n, stateOf);

  for (const state of states) {
    const stateCells = cellsOf.get(state.id);
    if (!stateCells) continue;
    let sumLng = 0,
      sumLat = 0;
    for (const i of stateCells) {
      sumLng += cellLng(graph, i);
      sumLat += cellLat(graph, i);
    }

    const centroidLng = sumLng / stateCells.length;
    const centroidLat = sumLat / stateCells.length;

    const smoothedGeom = mergeAndSmooth(graph, shared, stateCells, stateOf);
    if (!smoothedGeom) continue;

    geoFeatures.push({
      type: "Feature",
      id: state.id,
      geometry: smoothedGeom,
      properties: {
        _id: `state_${state.id}`,
        id: state.id,
        slotKey: slotKey(state.id),
        _displayName: state.name,
        name: state.name,
        _fillColor: state.color,
        color: state.color,
        _areaSqKm: state.areaKm2,
        _centroidLng: centroidLng,
        _centroidLat: centroidLat,
        culture: state.culture,
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

    // The spline overshoots at the poles (a river on an Antarctic coast reached latitude -90.74), and no
    // map projection takes a latitude past 90
    const smoothedLine = catmullRomSmoothLine(lineCoords, 3).map(([lng, lat]): [number, number] => [
      lng,
      Math.max(-90, Math.min(90, lat)),
    ]);

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

function exportLakes(graph: WorldGraph, shared: SharedSmoothing): FeatureCollection {
  const { cells, features } = graph;
  const geoFeatures: Feature[] = [];

  const lakeFeatures = features.filter((f) => f.type === "lake");
  const cellsOf = bucketCells(cells.n, (i) => (cells.isLand[i] === 1 ? cells.lake[i]! : 0));

  for (const lake of lakeFeatures) {
    const lakeCells = cellsOf.get(lake.id);
    if (!lakeCells) continue;

    const smoothedGeom = mergeAndSmooth(graph, shared, lakeCells);
    if (!smoothedGeom) continue;

    geoFeatures.push({
      type: "Feature",
      id: lake.id,
      geometry: smoothedGeom,
      properties: {
        id: lake.id,
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

function exportIcecaps(graph: WorldGraph, shared: SharedSmoothing): FeatureCollection {
  const { cells } = graph;
  const geoFeatures: Feature[] = [];

  const iceCells: number[] = [];
  for (let i = 0; i < cells.n; i++) {
    if (cells.biome[i] === ICE_CAP_BIOME) iceCells.push(i);
  }

  if (iceCells.length > 0) {
    const smoothedGeom = mergeAndSmooth(graph, shared, iceCells);
    if (smoothedGeom) {
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

/** The cells merged into polygons (see mergeCells) and smoothed. */
function mergeAndSmooth(
  graph: WorldGraph,
  shared: SharedSmoothing,
  cellIds: number[],
  labelOf?: (cell: number) => number
): Polygon | MultiPolygon | null {
  return smoothGeometry(shared.cache, mergeCells(graph, cellIds, labelOf, shared.corners));
}

/**
 * The polygons smoothed ring by ring, as a Polygon or MultiPolygon (null when nothing is left). A ring that
 * smoothing collapsed to less than a triangle is dropped: a shell takes its polygon with it, a hole just goes.
 */
function smoothGeometry(
  cache: SmoothingCache,
  polygons: MergedPolygon[]
): Polygon | MultiPolygon | null {
  const coordinates: Position[][][] = [];
  for (const [shell, ...holes] of polygons) {
    const outer = smoothRing(shell!, SMOOTHING_PASSES, cache);
    if (outer.length < 4) continue;
    const inner = holes.map((hole) => smoothRing(hole, SMOOTHING_PASSES, cache));
    coordinates.push([outer, ...inner.filter((ring) => ring.length >= 4)]);
  }
  if (coordinates.length === 0) return null;
  return coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0]! }
    : { type: "MultiPolygon", coordinates };
}
