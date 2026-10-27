/**
 * The Studio's diagnostic layers: a generated world's height, temperature, rainfall, river flow and Voronoi cells as
 * images, and its nations' seed points as GeoJSON. Pure and DOM-free, so the generator worker renders them from its
 * cached graph and jest can too.
 *
 * Each image is first drawn equirectangular (the relief's convention: row 0 is 90N, column 0 is 180W; see
 * raster-draw.ts) and then warped to Web Mercator rows with the relief preview's own step, because a MapLibre image
 * source is placed in Mercator between four corners. Scalars (temperature and rainfall go below zero or have no
 * "sea" to floor to) use the unclamped rasteriser, not the height one.
 */

import type { Feature, FeatureCollection, Point } from "geojson";
import { catmullRomSmoothLine } from "./v2/helpers/chaikin";
import {
  drawSegment,
  fillRaster,
  fillRing,
  hexToRgb,
  newRaster,
  putPixel,
  rampTable,
  toPixel,
  type Raster,
  type Rgba,
} from "./raster-draw";
import { heightsFromCells, scalarsFromCells } from "./relief";
import { warpToMercator } from "./relief-preview";
import { ELEVATION_ZONES } from "./v2/config";
import type { WorldGraph } from "./v2/types";

export type DiagnosticKind = "height" | "temperature" | "rainfall" | "flow" | "cells";
export const DIAGNOSTIC_KINDS: readonly DiagnosticKind[] = [
  "height",
  "temperature",
  "rainfall",
  "flow",
  "cells",
];

export interface LegendStop {
  /** In the legend's unit */
  value: number;
  /** `#rrggbb` */
  color: string;
  label?: string;
}

/** What a diagnostic's colours mean: the domain and the stops, as data for the Layers tab to draw. */
export interface DiagnosticLegend {
  kind: DiagnosticKind;
  title: string;
  unit: string;
  /** Values at the two ends of the ramp */
  domain: [number, number];
  /** `linear` and `log` ramps blend between stops; `bands` are steps */
  scale: "linear" | "log" | "bands";
  /**
   * Whether values past the low or high end of `domain` are drawn at that end's colour: the end stops are then
   * labelled "or colder" and so on, and the legend can say so.
   */
  clipped: { low: boolean; high: boolean };
  stops: LegendStop[];
}

/** A diagnostic as the map shows it: straight RGBA in Web Mercator rows, pinned at +-MERCATOR_MAX_LAT. */
export interface DiagnosticImage {
  kind: DiagnosticKind;
  width: number;
  height: number;
  rgba: Uint8Array;
  legend: DiagnosticLegend;
}

/** The equirectangular image is 256 * 2^zoom wide, the width `tileSourceRows` expects for that zoom. */
export const DIAGNOSTIC_ZOOM = 3;
export const DIAGNOSTIC_WIDTH = 256 * 2 ** DIAGNOSTIC_ZOOM;

export const OCEAN_COLOR = "#b3cde0";
export const LAKE_COLOR = "#0284c7";
export const RIVER_COLOR = "#5295c4";

const OCEAN: Rgba = [...hexToRgb(OCEAN_COLOR), 255];
const COAST: Rgba = [60, 72, 88, 255];

/** `cells` packed `[lng, lat, value, ...]` for the rasterisers. */
export function packValues(graph: WorldGraph, values: ArrayLike<number>): Float32Array {
  const { n, p } = graph.cells;
  const packed = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    packed[i * 3] = p[i * 2]!;
    packed[i * 3 + 1] = p[i * 2 + 1]!;
    packed[i * 3 + 2] = values[i]!;
  }
  return packed;
}

/** 1 where a pixel is land, 0 where it is sea, from the cells' land flags interpolated across the triangulation. */
function landGrid(graph: WorldGraph, width: number): Float32Array {
  const { metres } = scalarsFromCells(packValues(graph, graph.cells.isLand), width);
  for (let i = 0; i < metres.length; i++) metres[i] = metres[i]! > 0.5 ? 1 : 0;
  return metres;
}

// ---------------------------------------------------------------------------------------------------------------------
// Height bands
// ---------------------------------------------------------------------------------------------------------------------

const TOP_METRES = ELEVATION_ZONES[ELEVATION_ZONES.length - 1]!.minMeters;
let bandTable: Uint8Array | null = null;

/** Per whole metre up to the top zone's floor, the band's rgb (3 bytes each). */
function bandColors(): Uint8Array {
  if (bandTable) return bandTable;
  const zones = ELEVATION_ZONES.map((z) => hexToRgb(z.color));
  const table = new Uint8Array((TOP_METRES + 1) * 3);
  let zone = 0;
  for (let m = 0; m <= TOP_METRES; m++) {
    while (zone + 1 < ELEVATION_ZONES.length && m >= ELEVATION_ZONES[zone + 1]!.minMeters) zone++;
    table.set(zones[zone]!, m * 3);
  }
  bandTable = table;
  return table;
}

/**
 * Colour `out` (RGBA) by height band: sea where the grid is not above zero, else the band the height falls in.
 * Straight into the bytes, one pass, so the 8192 px render runs it over 33 million pixels.
 */
export function paintHeightBands(out: Uint8ClampedArray, metres: Float32Array): void {
  const table = bandColors();
  const sea = OCEAN;
  for (let p = 0, i = 0; p < metres.length; p++, i += 4) {
    const m = metres[p]!;
    if (m > 0) {
      const t = (m < TOP_METRES ? m | 0 : TOP_METRES) * 3;
      out[i] = table[t]!;
      out[i + 1] = table[t + 1]!;
      out[i + 2] = table[t + 2]!;
    } else {
      out[i] = sea[0];
      out[i + 1] = sea[1];
      out[i + 2] = sea[2];
    }
    out[i + 3] = 255;
  }
}

const heightLegend = (): DiagnosticLegend => ({
  kind: "height",
  title: "Height",
  unit: "m",
  domain: [0, TOP_METRES],
  scale: "bands",
  clipped: { low: false, high: false },
  stops: [
    { value: -1, color: OCEAN_COLOR, label: "Sea" },
    ...ELEVATION_ZONES.map((z) => ({
      value: z.minMeters,
      color: z.color.slice(0, 7),
      label: z.name,
    })),
  ],
});

// ---------------------------------------------------------------------------------------------------------------------
// Scalar fields
// ---------------------------------------------------------------------------------------------------------------------

interface Ramp {
  title: string;
  unit: string;
  domain: [number, number];
  /** The labels of the end stops where values past the end are drawn at its colour (null where none can be) */
  clipLabels: { low: string | null; high: string | null };
  stops: ReadonlyArray<{ value: number; color: string }>;
}

const RAMPS: Record<"temperature" | "rainfall", Ramp> = {
  temperature: {
    title: "Temperature",
    unit: "°C",
    domain: [-30, 38],
    clipLabels: { low: "-30 or colder", high: "38 or hotter" },
    stops: [
      { value: -30, color: "#313695" },
      { value: -15, color: "#4575b4" },
      { value: -5, color: "#74add1" },
      { value: 0, color: "#e0f3f8" },
      { value: 10, color: "#ffffbf" },
      { value: 18, color: "#fee090" },
      { value: 25, color: "#fdae61" },
      { value: 31, color: "#f46d43" },
      { value: 38, color: "#a50026" },
    ],
  },
  rainfall: {
    title: "Rainfall",
    unit: "mm/year",
    domain: [0, 4500],
    clipLabels: { low: null, high: "4500 or wetter" },
    stops: [
      { value: 0, color: "#f6e8c3" },
      { value: 250, color: "#dfc27d" },
      { value: 500, color: "#c7e9b4" },
      { value: 1000, color: "#7fcdbb" },
      { value: 2000, color: "#41b6c4" },
      { value: 3000, color: "#225ea8" },
      { value: 4500, color: "#081d58" },
    ],
  },
};

const legendOf = (kind: "temperature" | "rainfall"): DiagnosticLegend => {
  const { title, unit, domain, clipLabels, stops } = RAMPS[kind];
  return {
    kind,
    title,
    unit,
    domain: [...domain],
    scale: "linear",
    clipped: { low: clipLabels.low !== null, high: clipLabels.high !== null },
    stops: stops.map(({ value, color }, k) => {
      const label = k === 0 ? clipLabels.low : k === stops.length - 1 ? clipLabels.high : null;
      return label === null ? { value, color } : { value, color, label };
    }),
  };
};

/** The ramp's 256 colours, each stop at its place in the domain. */
function rampOf({ domain: [lo, hi], stops }: Ramp): Uint8Array {
  return rampTable(
    stops.map((s) => ({ at: (s.value - lo) / (hi - lo), color: hexToRgb(s.color) }))
  );
}

/** A thin outline along the coast, from the land grid: a land pixel with sea to its east or south, or the reverse. */
function outlineCoast(raster: Raster, land: Float32Array): void {
  const { width, height, data } = raster;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const east = y * width + (x + 1 === width ? 0 : x + 1);
      const south = y + 1 < height ? p + width : p;
      if (land[p] !== land[east] || land[p] !== land[south]) putPixel(data, p * 4, COAST);
    }
  }
}

function drawScalar(
  graph: WorldGraph,
  kind: "temperature" | "rainfall",
  width: number
): { raster: Raster; legend: DiagnosticLegend } {
  const field = kind === "temperature" ? graph.cells.temp : graph.cells.prec;
  const legend = legendOf(kind);
  const { metres } = scalarsFromCells(packValues(graph, field), width);
  const land = landGrid(graph, width);
  const raster = newRaster(width);
  const table = rampOf(RAMPS[kind]);
  const [lo, hi] = RAMPS[kind].domain;
  const scale = 255 / (hi - lo);
  const { data } = raster;
  for (let p = 0, i = 0; p < metres.length; p++, i += 4) {
    data[i + 3] = 255;
    if (kind === "rainfall" && land[p] === 0) {
      data[i] = OCEAN[0];
      data[i + 1] = OCEAN[1];
      data[i + 2] = OCEAN[2];
      continue;
    }
    const t = Math.round(Math.min(255, Math.max(0, (metres[p]! - lo) * scale))) * 3;
    data[i] = table[t]!;
    data[i + 1] = table[t + 1]!;
    data[i + 2] = table[t + 2]!;
  }
  outlineCoast(raster, land);
  return { raster, legend };
}

// ---------------------------------------------------------------------------------------------------------------------
// Flow, cells
// ---------------------------------------------------------------------------------------------------------------------

const FLOW_STOPS = ["#bfe3f5", "#4a9fd4", "#1f5fa8", "#08306b"] as const;
const FLOW_LAND: Rgba = [236, 236, 232, 255];
const FLOW_LAKE: Rgba = [127, 196, 232, 255];
const SMOOTHING_PASSES = 2;

/** The least and greatest flux on any river cell (a made-up range for a world with no rivers). */
function fluxRange(graph: WorldGraph): [number, number] {
  const { rivers, cells } = graph;
  let min = Infinity;
  let max = 0;
  for (const river of rivers) {
    for (const c of river.cells) {
      const flux = cells.flux[c]!;
      if (flux > 0 && flux < min) min = flux;
      if (flux > max) max = flux;
    }
  }
  return max > 0 ? [min, max] : [1, 10];
}

/** The river's land cells as a line of [lng, lat], smoothed unless it crosses the antimeridian. */
function riverPoints(graph: WorldGraph, ids: readonly number[]): [number, number][] {
  const line = ids.map((c): [number, number] => [graph.cells.p[c * 2]!, graph.cells.p[c * 2 + 1]!]);
  const crossesSeam = line.some((pt, k) => k > 0 && Math.abs(pt[0] - line[k - 1]![0]) > 180);
  return crossesSeam ? line : catmullRomSmoothLine(line, SMOOTHING_PASSES);
}

/**
 * Every river as a line over `raster`, from its land cells. `style` turns a cell's flux, as a 0-1 share of the
 * world's range on a log scale, into the segment's colour and radius (px). Returns that range.
 */
export function strokeRivers(
  raster: Raster,
  graph: WorldGraph,
  style: (t: number) => { colour: Rgba; radius: number }
): [number, number] {
  const { cells, rivers } = graph;
  const [min, max] = fluxRange(graph);
  const span = Math.max(1e-9, Math.log(max) - Math.log(min));
  for (const river of rivers) {
    const ids = river.cells.filter((c) => cells.isLand[c] === 1);
    if (ids.length < 2) continue;
    const line = riverPoints(graph, ids);
    const perCell = (line.length - 1) / (ids.length - 1);
    for (let k = 1; k < line.length; k++) {
      const flux = Math.max(
        min,
        cells.flux[ids[Math.min(ids.length - 1, Math.round(k / perCell))]!]!
      );
      const t = Math.min(1, Math.max(0, (Math.log(flux) - Math.log(min)) / span));
      const { colour, radius } = style(t);
      const from = toPixel(line[k - 1]![0], line[k - 1]![1], raster);
      drawSegment(raster, from, toPixel(line[k]![0], line[k]![1], raster), colour, radius);
    }
  }
  return [min, max];
}

function drawFlow(graph: WorldGraph, width: number): { raster: Raster; legend: DiagnosticLegend } {
  const { cells } = graph;
  const raster = newRaster(width);
  const land = landGrid(graph, width);
  const { data } = raster;
  for (let p = 0, i = 0; p < land.length; p++, i += 4) {
    const c = land[p] === 1 ? FLOW_LAND : OCEAN;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = 255;
  }
  for (let c = 0; c < cells.n; c++) {
    if (cells.isLand[c] === 1 && cells.lake[c]! > 0)
      fillRing(raster, cells.vertices[c]!, FLOW_LAKE);
  }
  const table = rampTable(
    FLOW_STOPS.map((hex, k) => ({ at: k / (FLOW_STOPS.length - 1), color: hexToRgb(hex) }))
  );
  const scale = width / DIAGNOSTIC_WIDTH;
  const [min, max] = strokeRivers(raster, graph, (t) => {
    const shade = Math.round(t * 255) * 3;
    return {
      colour: [table[shade]!, table[shade + 1]!, table[shade + 2]!, 255],
      radius: (0.5 + 1.2 * t) * scale,
    };
  });
  const span = Math.log(max) - Math.log(min);
  const legend: DiagnosticLegend = {
    kind: "flow",
    title: "River flow",
    unit: "flux",
    domain: [min, max],
    scale: "log",
    clipped: { low: false, high: false },
    stops: FLOW_STOPS.map((color, k) => ({
      value: Math.exp(Math.log(min) + (span * k) / (FLOW_STOPS.length - 1)),
      color,
    })),
  };
  return { raster, legend };
}

const CELL_EDGE: Rgba = [31, 41, 55, 190];

function drawCells(graph: WorldGraph, width: number): { raster: Raster; legend: DiagnosticLegend } {
  const raster = newRaster(width);
  fillRaster(raster, [0, 0, 0, 0]);
  for (const ring of graph.cells.vertices) {
    for (let k = 1; k < ring.length; k++) {
      const from = toPixel(ring[k - 1]![0], ring[k - 1]![1], raster);
      const to = toPixel(ring[k]![0], ring[k]![1], raster);
      drawSegment(raster, from, to, CELL_EDGE, 0.5, true);
    }
  }
  return {
    raster,
    legend: {
      kind: "cells",
      title: "Cells",
      unit: "",
      domain: [0, 0],
      scale: "bands",
      clipped: { low: false, high: false },
      stops: [{ value: 0, color: "#1f2937", label: "Cell edge" }],
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------------------------------

/** A diagnostic drawn equirectangular, `width` px wide (the PNG's convention), before it is warped for the map. */
export function drawDiagnostic(
  graph: WorldGraph,
  kind: DiagnosticKind,
  width = DIAGNOSTIC_WIDTH
): { raster: Raster; legend: DiagnosticLegend } {
  switch (kind) {
    case "height": {
      const raster = newRaster(width);
      paintHeightBands(
        raster.data,
        heightsFromCells(packValues(graph, graph.cells.h), width).metres
      );
      return { raster, legend: heightLegend() };
    }
    case "temperature":
    case "rainfall":
      return drawScalar(graph, kind, width);
    case "flow":
      return drawFlow(graph, width);
    case "cells":
      return drawCells(graph, width);
  }
}

/** A diagnostic ready for the map: warped to Web Mercator rows with the relief preview's step. */
export function renderDiagnostic(graph: WorldGraph, kind: DiagnosticKind): DiagnosticImage {
  const { raster, legend } = drawDiagnostic(graph, kind);
  const data = new Uint8Array(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength);
  const warped = warpToMercator(
    { width: raster.width, height: raster.height, data },
    DIAGNOSTIC_ZOOM
  );
  return { kind, ...warped, legend };
}

/** Each nation's seed: its capital settlement, as a GeoJSON point. */
export function nationSeeds(graph: WorldGraph): FeatureCollection<Point> {
  const settlements = new Map(graph.settlements.map((s) => [s.id, s]));
  const features: Feature<Point>[] = [];
  for (const state of graph.states) {
    const capital = settlements.get(state.capital);
    if (!capital) continue;
    features.push({
      type: "Feature",
      id: state.id,
      geometry: { type: "Point", coordinates: [capital.lng, capital.lat] },
      properties: { id: state.id, name: state.name, color: state.color, capital: capital.name },
    });
  }
  return { type: "FeatureCollection", features };
}
