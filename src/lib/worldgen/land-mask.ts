/**
 * Land mask: a realm's own map as an equirectangular raster the generator fits a world around.
 *
 * Pure (no DOM, no node APIs) so the World tab's worker can rasterise the realm's layers itself.
 * Row 0 is 90°N, column 0 is 180°W; a pixel's value is that of its centre.
 */

import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { ELEVATION_ZONES, getZoneByColor, isLandBand } from "~/lib/maps/elevation-config";

export type LandMask = {
  width: number;
  height: number;
  /** 1 = land (background or political layer), row-major */
  land: Uint8Array;
  /** Highest altitude band (0-8) covering each pixel; present only when the map has altitude bands */
  zone?: Uint8Array;
};

/** A realm's layers as stored: features may lack a geometry. */
type LayerFeatures = FeatureCollection<Geometry | null>;

export type LandMaskLayers = {
  background?: LayerFeatures;
  political?: LayerFeatures;
  altitudes?: LayerFeatures;
};

type Ring = Position[];
/** Fills pixels [x0, x1) of a row. */
type SpanFill = (rowStart: number, x0: number, x1: number) => void;

const HIGHEST_ZONE = ELEVATION_ZONES.length - 1;

/** Land and altitude band at a point; longitudes outside ±180 wrap, latitudes clamp. */
export function sampleLandMask(
  mask: LandMask,
  lng: number,
  lat: number
): { land: boolean; zone?: number } {
  const wrapped = lng < -180 || lng > 180 ? ((((lng + 180) % 360) + 360) % 360) - 180 : lng;
  const x = clampIndex(Math.floor(((wrapped + 180) / 360) * mask.width), mask.width);
  const y = clampIndex(Math.floor(((90 - lat) / 180) * mask.height), mask.height);
  const at = y * mask.width + x;
  const land = mask.land[at] === 1;
  return mask.zone ? { land, zone: mask.zone[at]! } : { land };
}

/**
 * Rasterise the realm's layers: land is the union of the background and political polygons (holes
 * respected), zone the highest altitude band covering each pixel.
 */
export function rasterizeLandMask(layers: LandMaskLayers, width = 1024): LandMask {
  const w = Math.max(2, Math.round(width));
  const h = Math.max(1, Math.round(w / 2));
  const land = new Uint8Array(w * h);
  const rasterizer = new ScanlineFiller(w, h);

  const fillLand: SpanFill = (row, x0, x1) => land.fill(1, row + x0, row + x1);
  for (const collection of [layers.background, layers.political]) {
    for (const feature of collection?.features ?? []) {
      rasterizer.fillGeometry(feature.geometry, fillLand);
    }
  }

  const mask: LandMask = { width: w, height: h, land };
  const zone = rasterizeZones(layers.altitudes, rasterizer, w * h);
  if (zone) mask.zone = zone;
  return mask;
}

function rasterizeZones(
  altitudes: LayerFeatures | undefined,
  rasterizer: ScanlineFiller,
  size: number
): Uint8Array | undefined {
  let zone: Uint8Array | undefined;
  for (const feature of altitudes?.features ?? []) {
    const band = bandZone(feature);
    if (band === null) continue;
    zone ??= new Uint8Array(size);
    const grid = zone;
    rasterizer.fillGeometry(feature.geometry, (row, x0, x1) => {
      for (let x = row + x0; x < row + x1; x++) if (grid[x]! < band) grid[x] = band;
    });
  }
  return zone;
}

/** Altitude band 0-8 of a feature: generated worlds (`zone_N`), Ixnay's subgroups, or its band colour. */
function bandZone(feature: Feature<Geometry | null>): number | null {
  const props = feature.properties;
  if (!props || isLandBand(props)) return null;
  for (const id of [props.zone, props.zoneId]) {
    const match = typeof id === "string" ? /^zone_(\d)$/.exec(id) : null;
    if (match) return Math.min(HIGHEST_ZONE, Number(match[1]));
  }
  const sub = props["ixmap-subgroup"];
  if (sub === "coastlines") return 0;
  const fromSub = typeof sub === "string" ? /^Altitude-(\d)$/.exec(sub)?.[1] : undefined;
  if (fromSub) return Math.min(HIGHEST_ZONE, Number(fromSub));
  const fill = props.fill ?? props._fillColor;
  return typeof fill === "string" ? (getZoneByColor(fill)?.sortOrder ?? null) : null;
}

function clampIndex(i: number, size: number): number {
  return i < 0 ? 0 : i >= size ? size - 1 : i;
}

function isPosition(p: Position | undefined): p is Position {
  return p !== undefined && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/**
 * Even-odd scanline fill of one polygon (outer ring plus holes) at a time. A ring's longitudes are
 * unwrapped so each edge takes the short way around the globe; the polygon is then drawn at -360°,
 * 0° and +360° so whatever crosses ±180 lands on both sides.
 */
class ScanlineFiller {
  private readonly rows: number[][];

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {
    this.rows = Array.from({ length: height }, () => []);
  }

  fillGeometry(geometry: Geometry | null | undefined, fill: SpanFill): void {
    if (geometry?.type === "Polygon") this.fillPolygon(geometry.coordinates, fill);
    else if (geometry?.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) this.fillPolygon(polygon, fill);
    }
  }

  private fillPolygon(rings: Ring[], fill: SpanFill): void {
    const [outer, ...holes] = rings;
    const exterior = outer && unwrap(outer);
    if (!exterior) return;
    this.collect(exterior);
    for (const hole of holes) {
      const unwrapped = unwrap(hole);
      if (unwrapped) this.collect(unwrapped);
    }
    this.flush(fill);
  }

  /** Add the ring's edge crossings, at every 360° copy that can reach the map, to the rows it spans. */
  private collect(ring: { xs: number[]; ys: number[] }): void {
    const { xs, ys } = ring;
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const x of xs) {
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
    }
    for (const shift of [-360, 0, 360]) {
      if (xMax + shift <= -180 || xMin + shift >= 180) continue;
      for (let i = 0; i < xs.length - 1; i++) {
        this.addEdge(xs[i]! + shift, ys[i]!, xs[i + 1]! + shift, ys[i + 1]!);
      }
    }
  }

  private addEdge(x0: number, y0: number, x1: number, y1: number): void {
    if (y0 === y1) return;
    const dLat = 180 / this.height;
    const yLow = Math.min(y0, y1);
    const yHigh = Math.max(y0, y1);
    // Rows whose centre latitude c satisfies yLow <= c < yHigh
    const first = Math.max(0, Math.floor((90 - yHigh) / dLat - 0.5) + 1);
    const last = Math.min(this.height - 1, Math.floor((90 - yLow) / dLat - 0.5));
    const slope = (x1 - x0) / (y1 - y0);
    for (let r = first; r <= last; r++) {
      this.rows[r]!.push(x0 + (90 - (r + 0.5) * dLat - y0) * slope);
    }
  }

  /** Pair the sorted crossings of each touched row into spans, then clear the rows. */
  private flush(fill: SpanFill): void {
    const dLng = 360 / this.width;
    for (let r = 0; r < this.height; r++) {
      const crossings = this.rows[r]!;
      if (crossings.length === 0) continue;
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        // Pixels whose centre longitude lies in [a, b)
        const x0 = Math.max(0, Math.ceil((crossings[k]! + 180) / dLng - 0.5));
        const x1 = Math.min(this.width, Math.ceil((crossings[k + 1]! + 180) / dLng - 0.5));
        if (x1 > x0) fill(r * this.width, x0, x1);
      }
      crossings.length = 0;
    }
  }
}

/** An edge spanning the whole map is a planar edge (along a pole or the frame), not a seam crossing. */
const FULL_TURN = 359.99;

/** Longitude travelled along an edge: the short way round the globe unless it spans the whole map. */
function lngStep(from: Position, to: Position): number {
  const d = to[0]! - from[0]!;
  if (Math.abs(d) >= FULL_TURN || Math.abs(d) <= 180) return d;
  return d > 0 ? d - 360 : d + 360;
}

/**
 * The ring with continuous longitudes, or null when it is unusable. A ring that winds once around a
 * pole ends 360° from where it started; it is closed over that pole so the cap is what gets filled.
 */
function unwrap(ring: Ring): { xs: number[]; ys: number[] } | null {
  if (ring.length < 3 || !ring.every(isPosition)) return null;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
  const xs = [first[0]!];
  const ys = [first[1]!];
  let latSum = first[1]!;
  for (let i = 1; i < closed.length; i++) {
    xs.push(xs[i - 1]! + lngStep(closed[i - 1]!, closed[i]!));
    ys.push(closed[i]![1]!);
    latSum += closed[i]![1]!;
  }
  if (Math.abs(xs[xs.length - 1]! - xs[0]!) > 180) {
    const pole = latSum < 0 ? -90 : 90;
    xs.push(xs[xs.length - 1]!, xs[0]!, xs[0]!);
    ys.push(pole, pole, ys[0]!);
  }
  return { xs, ys };
}
