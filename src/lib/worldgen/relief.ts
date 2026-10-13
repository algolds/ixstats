/**
 * Relief: height grids from generator cells or stored altitude bands, tileable detail, and an RGBA hillshade.
 *
 * Pure (no node:*, no DOM, no sharp), so the browser worker (preview) and the server (relief tiles) run the very same
 * code. Grids are equirectangular and 2:1: pixel (x, y) is the point at longitude -180 + (x + 0.5) * 360 / width and
 * latitude 90 - (y + 0.5) * 180 / height. Everything that touches the antimeridian wraps: x = 0 and x = width - 1 are
 * neighbours.
 */

// @ts-expect-error d3-delaunay has no declaration file
import { Delaunay as DelaunayImpl } from "d3-delaunay";
import { kmPerDegree, kmPerDegreeLat, kmPerDegreeLng } from "~/lib/maps/planet";
import { DETAIL_SIZE, detailTexture } from "./relief-noise";
import { mercatorY } from "./v2/mesh";

export type HeightGrid = {
  width: number;
  height: number;
  /** Row-major metres above sea level, north at the top; sea is 0. */
  metres: Float32Array;
};

type Triangulation = { triangles: Uint32Array };
const Delaunay = DelaunayImpl as new (points: Float64Array) => Triangulation;

// ---------------------------------------------------------------------------------------------------------------------
// Heights from generator cells
// ---------------------------------------------------------------------------------------------------------------------

/** Cell centres in pixel space with their heights; `count` points (copies included) are used, `cells` are real. */
type PixelPoints = { xy: Float64Array; z: Float32Array; count: number; cells: number };

/** Typical cell spacing in degrees for 66,000 cells (a default world). */
const REFERENCE_CELLS = 64800;
/** How many cell spacings either side of the seam are copied across it. */
const SEAM_SPACINGS = 6;
/** Longitude rows shrink with cos(lat); keep the seam margin finite at the poles. */
const MIN_COS = 0.02;

/**
 * Cell centres as pixel-space points, plus a copy of every point near the antimeridian on its far side. A Delaunay
 * triangulation is not periodic, so without the copies the strip between the westmost and eastmost cells would be
 * missing. The margin is a few cell spacings, widened towards the poles where a row holds fewer cells.
 */
/** Points along each pole's edge of the grid, so the triangles reach the poles (the cells' sites stop short). */
const POLE_POINTS = 16;

function pixelPoints(
  cells: Float32Array,
  width: number,
  height: number,
  floorAtZero: boolean
): PixelPoints {
  const n = Math.floor(cells.length / 3);
  const xy = new Float64Array(n * 4 + (POLE_POINTS + 1) * 4);
  const z = new Float32Array(n * 2 + (POLE_POINTS + 1) * 2);
  const spacing = SEAM_SPACINGS * Math.sqrt(REFERENCE_CELLS / n);
  let count = 0;
  let valid = 0;
  // The value of the site nearest each pole
  const pole = { north: { lat: -Infinity, h: 0 }, south: { lat: Infinity, h: 0 } };
  const push = (x: number, y: number, h: number) => {
    xy[count * 2] = x;
    xy[count * 2 + 1] = y;
    z[count++] = h;
  };
  for (let i = 0; i < n; i++) {
    const lng = cells[i * 3]!;
    const lat = cells[i * 3 + 1]!;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    const value = cells[i * 3 + 2]!;
    const h = floorAtZero && !(value > 0) ? 0 : value;
    push(x, y, h);
    valid++;
    if (lat > pole.north.lat) pole.north = { lat, h };
    if (lat < pole.south.lat) pole.south = { lat, h };
    const cos = Math.max(MIN_COS, Math.cos((lat * Math.PI) / 180));
    const margin = Math.min(width / 2, ((spacing / cos) * width) / 360);
    if (x < margin) push(x + width, y, h);
    else if (x > width - margin) push(x - width, y, h);
  }
  if (valid >= 3) {
    for (let k = 0; k <= POLE_POINTS; k++) {
      const x = (k / POLE_POINTS) * width;
      push(x, 0, pole.north.h);
      push(x, height, pole.south.h);
    }
  }
  return { xy, z, count, cells: valid };
}

/** The x (in pixels) where the edge p-q crosses the horizontal line `yc`, or NaN when it does not (half-open). */
function edgeCrossing(px: number, py: number, qx: number, qy: number, yc: number): number {
  if (py <= yc === qy <= yc) return Number.NaN;
  return px + ((yc - py) / (qy - py)) * (qx - px);
}

/** Scratch for `rowSpan`: the left and right x of the last span, so the hot loop allocates nothing. */
const rowEnds = new Float64Array(2);

/** Fill `rowEnds` with where the triangle covers the line `yc`; false when it does not reach it. */
function rowSpan(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  yc: number
): boolean {
  let left = Infinity;
  let right = -Infinity;
  const ab = edgeCrossing(ax, ay, bx, by, yc);
  if (ab < left) left = ab;
  if (ab > right) right = ab;
  const bc = edgeCrossing(bx, by, cx, cy, yc);
  if (bc < left) left = bc;
  if (bc > right) right = bc;
  const ca = edgeCrossing(cx, cy, ax, ay, yc);
  if (ca < left) left = ca;
  if (ca > right) right = ca;
  rowEnds[0] = left;
  rowEnds[1] = right;
  return left <= right;
}

/** Scan-convert one triangle into the grid, interpolating its three vertex heights linearly. */
function fillTriangle(
  metres: Float32Array,
  width: number,
  height: number,
  { xy, z }: PixelPoints,
  a: number,
  b: number,
  c: number
): void {
  const ax = xy[a * 2]!;
  const ay = xy[a * 2 + 1]!;
  const bx = xy[b * 2]!;
  const by = xy[b * 2 + 1]!;
  const cx = xy[c * 2]!;
  const cy = xy[c * 2 + 1]!;
  const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(det) < 1e-12) return;
  const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5));
  const y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
  const ha = z[a]!;
  const dB = z[b]! - ha;
  const dC = z[c]! - ha;
  const gx = (dB * (cy - ay) - dC * (by - ay)) / det;
  const gy = (dC * (bx - ax) - dB * (cx - ax)) / det;
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    if (!rowSpan(ax, ay, bx, by, cx, cy, yc)) continue;
    const x0 = Math.max(0, Math.ceil(rowEnds[0]! - 0.5));
    const x1 = Math.min(width - 1, Math.floor(rowEnds[1]! - 0.5));
    const base = ha + gy * (yc - ay) - gx * ax;
    for (let x = x0; x <= x1; x++) metres[y * width + x] = base + gx * (x + 0.5);
  }
}

/**
 * The points with their rows moved to Mercator northing (at the columns' scale), so the triangulation is the mesh's
 * own: the mesh is built in Mercator, and a triangulation in longitude and latitude joins polar cells that are not
 * neighbours. The triangles are still drawn at the points' longitude and latitude.
 */
function mercatorPoints({ xy, count }: PixelPoints, width: number, height: number): Float64Array {
  const out = xy.slice(0, count * 2);
  const pixelsPerDegree = width / 360;
  for (let i = 0; i < count; i++) {
    const lat = Math.max(-89.95, Math.min(89.95, 90 - (out[i * 2 + 1]! / height) * 180));
    out[i * 2 + 1] = -mercatorY(lat) * pixelsPerDegree;
  }
  return out;
}

function rasterizeCells(cells: Float32Array, width: number, floorAtZero: boolean): HeightGrid {
  const height = width >> 1;
  const metres = new Float32Array(width * height);
  const points = pixelPoints(cells, width, height, floorAtZero);
  if (points.cells < 3) return { width, height, metres };
  const { triangles } = new Delaunay(mercatorPoints(points, width, height));
  for (let t = 0; t < triangles.length; t += 3) {
    fillTriangle(
      metres,
      width,
      height,
      points,
      triangles[t]!,
      triangles[t + 1]!,
      triangles[t + 2]!
    );
  }
  return { width, height, metres };
}

/**
 * Rasterise the cell triangulation to a `width` x `width / 2` grid. `cells` is packed `[lng, lat, h, ...]` in degrees
 * and metres; sea cells (h < 0) count as 0. Cells near the antimeridian are mirrored across it before triangulating,
 * so the seam has no gap column and no triangle streaks across the map.
 */
export function heightsFromCells(cells: Float32Array, width = 2048): HeightGrid {
  return rasterizeCells(cells, width, true);
}

/**
 * The same rasteriser for any per-cell value (`[lng, lat, value, ...]`): negative values, such as a temperature
 * below freezing, are kept. The grid's `metres` hold the value in its own unit.
 */
export function scalarsFromCells(cells: Float32Array, width = 2048): HeightGrid {
  return rasterizeCells(cells, width, false);
}

// ---------------------------------------------------------------------------------------------------------------------
// Heights from altitude bands
// ---------------------------------------------------------------------------------------------------------------------

/** Chamfer weights (5, 7): within about 2 % of the Euclidean distance in pixels x 5. */
const AXIS = 5;
const DIAGONAL = 7;
/** Distance of a pixel that no target can reach. */
const UNREACHED = 65535;

function sweepRight(d: Uint16Array, row: number, w: number): void {
  for (let x = 1; x < w; x++) {
    const v = d[row + x - 1]! + AXIS;
    if (v < d[row + x]!) d[row + x] = v;
  }
  // The pixel left of x = 0 is x = w - 1; carry any gain it makes round the seam.
  let v = d[row + w - 1]! + AXIS;
  if (v >= d[row]!) return;
  d[row] = v;
  for (let x = 1; x < w; x++) {
    v = d[row + x - 1]! + AXIS;
    if (v >= d[row + x]!) break;
    d[row + x] = v;
  }
}

function sweepLeft(d: Uint16Array, row: number, w: number): void {
  for (let x = w - 2; x >= 0; x--) {
    const v = d[row + x + 1]! + AXIS;
    if (v < d[row + x]!) d[row + x] = v;
  }
  let v = d[row]! + AXIS;
  if (v >= d[row + w - 1]!) return;
  d[row + w - 1] = v;
  for (let x = w - 2; x >= 0; x--) {
    v = d[row + x + 1]! + AXIS;
    if (v >= d[row + x]!) break;
    d[row + x] = v;
  }
}

/** Relax each pixel of `row` from the three neighbours in `other` (the row above or below), wrapping at the seam. */
function relaxFromRow(d: Uint16Array, row: number, other: number, w: number): void {
  for (let x = 0; x < w; x++) {
    const west = other + (x === 0 ? w - 1 : x - 1);
    const east = other + (x === w - 1 ? 0 : x + 1);
    let best = d[row + x]!;
    const straight = d[other + x]! + AXIS;
    if (straight < best) best = straight;
    const nearWest = d[west]! + DIAGONAL;
    if (nearWest < best) best = nearWest;
    const nearEast = d[east]! + DIAGONAL;
    if (nearEast < best) best = nearEast;
    d[row + x] = best;
  }
}

/**
 * Two-pass chamfer distance transform in place: on entry 0 marks a target and UNREACHED everything else; on exit each
 * pixel holds its distance to the nearest target (pixels x 5), wrapping across the left and right edges.
 */
function chamfer(d: Uint16Array, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    if (y > 0) relaxFromRow(d, y * w, (y - 1) * w, w);
    sweepRight(d, y * w, w);
  }
  for (let y = h - 1; y >= 0; y--) {
    if (y < h - 1) relaxFromRow(d, y * w, (y + 1) * w, w);
    sweepLeft(d, y * w, w);
  }
}

/** Mark pixels at or below `level` as targets; returns how many. */
function markBelow(levels: Uint8Array, d: Uint16Array, level: number): number {
  let n = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i]! <= level) {
      d[i] = 0;
      n++;
    } else d[i] = UNREACHED;
  }
  return n;
}

/** Mark pixels above `level` as targets; returns how many. */
function markAbove(levels: Uint8Array, d: Uint16Array, level: number): number {
  let n = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i]! > level) {
      d[i] = 0;
      n++;
    } else d[i] = UNREACHED;
  }
  return n;
}

/**
 * Position of a pixel inside its band, 0 at the band's lower edge and 1 at its upper edge, from its distances to the
 * band below (`lo`) and the band above (`hi`). A band with nothing above (or below) it anywhere climbs towards its
 * ceiling (falls to its floor) over the deepest distance found inside the band.
 */
function bandFraction(lo: number, hi: number, deepestLo: number, deepestHi: number): number {
  const noLo = lo === UNREACHED;
  const noHi = hi === UNREACHED;
  if (noLo && noHi) return 0.5;
  const below = noLo ? deepestHi - hi + AXIS : lo;
  const above = noHi ? deepestLo - lo + AXIS : hi;
  const t = (below - AXIS / 2) / (below + above - AXIS);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Write the heights of every pixel at `level`, from the two distance fields. */
function shapeBand(
  levels: Uint8Array,
  level: number,
  lo: Uint16Array,
  hi: Uint16Array,
  metres: Float32Array,
  floor: number,
  ceiling: number
): void {
  let deepestLo = 0;
  let deepestHi = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] !== level) continue;
    if (lo[i]! !== UNREACHED && lo[i]! > deepestLo) deepestLo = lo[i]!;
    if (hi[i]! !== UNREACHED && hi[i]! > deepestHi) deepestHi = hi[i]!;
  }
  const span = Math.max(0, ceiling - floor);
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] === level)
      metres[i] = floor + bandFraction(lo[i]!, hi[i]!, deepestLo, deepestHi) * span;
  }
}

/**
 * Heights from stored altitude bands. `zoneGrid` holds, per pixel, 0 for sea or "no band" and `k` for `zones[k - 1]`
 * (values above the zone count count as the top zone); draw it without anti-aliasing. Each band is interpolated
 * between its floor and ceiling by its distance to the band below against its distance to the band above, so heights
 * rise from the coast to the highest band and never leave a band's limits. Distances wrap across the antimeridian.
 */
export function heightsFromBands(
  zoneGrid: Uint8Array,
  width: number,
  height: number,
  zones: Array<{ min: number; max: number }>
): HeightGrid {
  const metres = new Float32Array(width * height);
  const levels = zoneGrid.slice();
  const top = Math.min(zones.length, 255);
  const present = new Uint32Array(top + 1);
  for (let i = 0; i < levels.length; i++) {
    if (levels[i]! > top) levels[i] = top;
    const level = levels[i]!;
    present[level] = present[level]! + 1;
  }
  const lo = new Uint16Array(width * height);
  const hi = new Uint16Array(width * height);
  for (let level = 1; level <= top; level++) {
    if (present[level] === 0) continue;
    // With no target a field stays UNREACHED everywhere, which shapeBand reads as "nothing there".
    if (markBelow(levels, lo, level - 1) > 0) chamfer(lo, width, height);
    if (markAbove(levels, hi, level) > 0) chamfer(hi, width, height);
    const zone = zones[level - 1]!;
    shapeBand(levels, level, lo, hi, metres, zone.min, zone.max);
  }
  return { width, height, metres };
}

// ---------------------------------------------------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------------------------------------------------

/** The detail tile spans an eighth of the world's width at this reference resolution, at any grid size. */
const DETAIL_REFERENCE_WIDTH = 2048;
/** Detail amplitude in metres at ruggedness 1: a few metres everywhere, 60 % of the height on hills and mountains. */
const DETAIL_LOWLAND_METRES = 5;
const DETAIL_HIGHLAND_SHARE = 0.6;
/** The highland share fades in (smoothstep) between these heights, so lowlands stay smooth and hills get texture. */
const DETAIL_HILLS_START = 100;
const DETAIL_HILLS_FULL = 700;

/** Detail amplitude in metres at ruggedness 1 for land at height `m`. */
function detailAmplitude(m: number): number {
  const t = Math.min(
    1,
    Math.max(0, (m - DETAIL_HILLS_START) / (DETAIL_HILLS_FULL - DETAIL_HILLS_START))
  );
  return DETAIL_LOWLAND_METRES + DETAIL_HIGHLAND_SHARE * m * t * t * (3 - 2 * t);
}

/**
 * Add fractal detail to the land of `grid` in place. `ruggedness` scales it: 0 adds nothing, 1 is the full amount.
 * The amplitude grows with altitude: lowland (under ~100 m) gets a few metres, so it stays flat under the
 * hillshade, while hills and mountains get a texture the shading can show. The tile is placed in world space, so a
 * 1024 px preview and the 2048 px tiles show the same hills. Sea is untouched and land stays above sea level.
 */
export function addDetail(grid: HeightGrid, ruggedness: number): void {
  if (!(ruggedness > 0)) return;
  const { width, height, metres } = grid;
  const tile = detailTexture();
  const step = DETAIL_REFERENCE_WIDTH / width;
  const columns = new Uint16Array(width);
  for (let x = 0; x < width; x++) columns[x] = Math.floor(x * step) % DETAIL_SIZE;
  for (let y = 0; y < height; y++) {
    const tileRow = (Math.floor(y * step) % DETAIL_SIZE) * DETAIL_SIZE;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const m = metres[row + x]!;
      if (m <= 0) continue;
      metres[row + x] = Math.max(
        1,
        m + tile[tileRow + columns[x]!]! * ruggedness * detailAmplitude(m)
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Hillshade
// ---------------------------------------------------------------------------------------------------------------------

const AZIMUTH = (315 * Math.PI) / 180; // light from the north-west, compass bearing
const ALTITUDE = (45 * Math.PI) / 180;
/** Unit vector towards the light: x east, y north, z up. */
const LIGHT_X = Math.sin(AZIMUTH) * Math.cos(ALTITUDE);
const LIGHT_Y = Math.cos(AZIMUTH) * Math.cos(ALTITUDE);
const LIGHT_Z = Math.sin(ALTITUDE);
/**
 * Slopes are drawn this much steeper than they are. A pixel is ~20 km wide, so a 5,000 m mountain belt over 30 pixels
 * is a 0.8 % slope and would barely shade; at 40 the belts of generated Eurth and Ixnay worlds reach the shadow and
 * highlight caps while lowland stays clear. It scales the physical slope (metres per metre), not the per-pixel one,
 * so it does not depend on the grid width: the 1024 px preview shades like the 2048 px tiles.
 */
const VERTICAL_EXAGGERATION = 40;
/**
 * Near the poles a pixel row shrinks to nothing and the same height step would read as a cliff; below this share of
 * the equator's width the shading stops scaling by latitude (about 72 degrees).
 */
const MIN_POLAR_COS = 0.3;
/** Alpha (0-255) per unit of shade difference from flat ground, and its ceiling: black shadows, white highlights. */
const SHADOW_GAIN = 400;
const SHADOW_MAX = 140; // 0.55
const LIGHT_GAIN = 300;
const LIGHT_MAX = 50; // 0.2

/** Shade one row of land pixels into `out` (RGBA). Sea and flat land stay transparent. */
function shadeRow(
  grid: HeightGrid,
  y: number,
  out: Uint8ClampedArray,
  metresPerPixelY: number
): void {
  const { width: w, height: h, metres } = grid;
  const lat = 90 - ((y + 0.5) * 180) / h;
  const equator = (kmPerDegree() * 1000 * 360) / w;
  const metresPerPixelX = Math.max(equator * MIN_POLAR_COS, (kmPerDegreeLng(lat) * 1000 * 360) / w);
  const north = (y > 0 ? y - 1 : y) * w;
  const south = (y < h - 1 ? y + 1 : y) * w;
  const rows = (south - north) / w; // 2 inside the grid, 1 on the first and last row
  const kx = VERTICAL_EXAGGERATION / (2 * metresPerPixelX);
  const ky = VERTICAL_EXAGGERATION / (rows * metresPerPixelY);
  const row = y * w;
  for (let x = 0; x < w; x++) {
    if (!(metres[row + x]! > 0)) continue;
    const p =
      (metres[row + (x === w - 1 ? 0 : x + 1)]! - metres[row + (x === 0 ? w - 1 : x - 1)]!) * kx;
    const q = (metres[north + x]! - metres[south + x]!) * ky;
    const shade = (LIGHT_Z - p * LIGHT_X - q * LIGHT_Y) / Math.sqrt(1 + p * p + q * q);
    const i = (row + x) * 4;
    if (shade < LIGHT_Z) {
      out[i + 3] = Math.min(SHADOW_MAX, (LIGHT_Z - shade) * SHADOW_GAIN);
    } else {
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = Math.min(LIGHT_MAX, (shade - LIGHT_Z) * LIGHT_GAIN);
    }
  }
}

/**
 * Hillshade as straight RGBA, north up: light from the north-west (315 degrees) at 45 degrees. Slopes are taken in
 * metres, so a pixel's width follows its latitude. Shadows are black with alpha up to ~0.55, lit slopes white with alpha
 * up to ~0.2; flat land and sea are fully transparent.
 */
export function hillshade(grid: HeightGrid): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grid.width * grid.height * 4);
  const metresPerPixelY = (kmPerDegreeLat() * 1000 * 180) / grid.height;
  for (let y = 0; y < grid.height; y++) shadeRow(grid, y, out, metresPerPixelY);
  return out;
}
