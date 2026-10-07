/**
 * Boundary tracing of the cleaned label raster, once for the whole map. Every boundary between two labels is
 * walked along the pixel edges ("crack following"), with the region on the left, so each label's rings come out
 * of one pass over the raster. Regions are 4-connected: where two pixels of one label touch only at a corner,
 * they are separate rings meeting at that point.
 *
 * Shared borders come out identical: a ring keeps only the grid vertices that matter (corners, and points where
 * three or more labels meet), and whether a vertex matters depends on the four pixels around it, not on the ring,
 * so both neighbours of a border list exactly the same points. TopoJSON then recognises the border as one shared
 * arc and simplifies it once, which is what keeps neighbours touching without gaps or overlaps. Pure.
 */
import type { Position } from "geojson";
import type { EngineContext } from "../progress";

// Directions: 0 east (+x), 1 south (+y, down), 2 west, 3 north.
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
// Pixel sides as bits: north 1, east 2, south 4, west 8.
const SIDE_N = 1;
const SIDE_E = 2;
const SIDE_S = 4;
const SIDE_W = 8;

/** Label rings per label: label → rings of [x, y] grid vertices (closed). */
export type LabelRings = Map<number, Position[][]>;

export async function traceLabelRings(
  labels: Uint16Array,
  width: number,
  height: number,
  ctx: EngineContext,
  onRow?: (fraction: number) => void
): Promise<LabelRings> {
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : labels[y * width + x]!;
  const visited = new Uint8Array(width * height);

  /** Whether the grid vertex (i, j) must be kept: not a straight run of one border between two labels. */
  const significant = (i: number, j: number): boolean => {
    const a = at(i - 1, j - 1);
    const b = at(i, j - 1);
    const c = at(i - 1, j);
    const d = at(i, j);
    const horizontal = a === b && c === d && a !== c;
    const vertical = a === c && b === d && a !== b;
    return !(horizontal || vertical);
  };

  // The edge leaving vertex (i, j) in direction d has, on its left, pixel E (i, j-1) · S (i, j) · W (i-1, j) ·
  // N (i-1, j-1), and on its right E (i, j) · S (i-1, j) · W (i-1, j-1) · N (i, j-1). The left pixel is the
  // region's; the edge is its south, west, north or east side respectively.
  const trace = (label: number, si: number, sj: number, sd: number): Position[] => {
    const ring: Position[] = [];
    let i = si;
    let j = sj;
    let d = sd;
    do {
      if (d === 0) visited[(j - 1) * width + i]! |= SIDE_S;
      else if (d === 1) visited[j * width + i]! |= SIDE_W;
      else if (d === 2) visited[j * width + i - 1]! |= SIDE_N;
      else visited[(j - 1) * width + i - 1]! |= SIDE_E;
      i += DX[d]!;
      j += DY[d]!;
      let aheadLeft: boolean;
      let aheadRight: boolean;
      if (d === 0) {
        aheadLeft = at(i, j - 1) === label;
        aheadRight = at(i, j) === label;
      } else if (d === 1) {
        aheadLeft = at(i, j) === label;
        aheadRight = at(i - 1, j) === label;
      } else if (d === 2) {
        aheadLeft = at(i - 1, j) === label;
        aheadRight = at(i - 1, j - 1) === label;
      } else {
        aheadLeft = at(i - 1, j - 1) === label;
        aheadRight = at(i, j - 1) === label;
      }
      if (!aheadLeft)
        d = (d + 3) % 4; // turn left (also at a corner touch: 4-connected)
      else if (aheadRight) d = (d + 1) % 4; // turn right
      if (significant(i, j)) ring.push([i, j]);
    } while (i !== si || j !== sj || d !== sd);
    if (ring.length > 0) ring.push([ring[0]![0]!, ring[0]![1]!]);
    return ring;
  };

  const rings: LabelRings = new Map();
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const p = row + x;
      const label = labels[p]!;
      if (label === 0) continue;
      const north = y > 0 ? labels[p - width]! : -1;
      const east = x + 1 < width ? labels[p + 1]! : -1;
      const south = y + 1 < height ? labels[p + width]! : -1;
      const west = x > 0 ? labels[p - 1]! : -1;
      if (north === label && east === label && south === label && west === label) continue;
      // Each side on a boundary starts a ring unless it was walked already: north, east, south, west.
      if (north !== label && !(visited[p]! & SIDE_N)) push(rings, label, trace(label, x + 1, y, 2));
      if (east !== label && !(visited[p]! & SIDE_E))
        push(rings, label, trace(label, x + 1, y + 1, 3));
      if (south !== label && !(visited[p]! & SIDE_S)) push(rings, label, trace(label, x, y + 1, 0));
      if (west !== label && !(visited[p]! & SIDE_W)) push(rings, label, trace(label, x, y, 1));
    }
    if ((y & 31) === 0) {
      onRow?.(y / height);
      await ctx.tick();
    }
  }
  return rings;
}

function push(rings: LabelRings, label: number, ring: Position[]) {
  if (ring.length < 4) return;
  const list = rings.get(label);
  if (list) list.push(ring);
  else rings.set(label, [ring]);
}
