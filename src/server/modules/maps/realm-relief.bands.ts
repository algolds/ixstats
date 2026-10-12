/**
 * A realm's stored altitude bands as the zone grid relief heights are made from (`heightsFromBands`,
 * src/lib/worldgen/relief.ts): every band drawn as SVG in zone order, lowest first, and rasterised with sharp.
 *
 * Read from the `geometry` column, never `geom_postgis`: a ring that crosses the antimeridian is stored with
 * longitudes jumping from 180 to -180, which PostGIS reads as a planar sliver across the world. Here such a ring is
 * made continuous (-182 instead of 178) and drawn again a world's width over, so the seam has neither a streak nor a
 * gap. Nothing is anti-aliased: each zone is a flat grey on a black sea and the shapes are `crispEdges`, so a pixel
 * is exactly one zone and an edge pixel is never a blend that reads as a band in between. Server only.
 */
import type { PrismaClient } from "@prisma/client";
import type { Feature, Geometry, GeoJsonProperties, Position } from "geojson";
import { ELEVATION_ZONES } from "~/lib/maps/elevation-config";
import { toPolygonal } from "~/lib/maps/polygonal-geometry";
import { bandZone } from "~/lib/worldgen/land-mask";

/** Lower and upper limit of a zone in metres. */
export type ZoneLimits = { min: number; max: number };

export interface BandsGrid {
  /** Per pixel, row-major from the north: 0 for sea or no band, `k` for `zones[k - 1]`. */
  zoneGrid: Uint8Array;
  /** The nine zones' limits, lowest first. */
  zones: ZoneLimits[];
}

/** Grey per zone value: far enough apart that rounding a pixel back to its zone cannot cross to another. */
const GREY_STEP = Math.floor(255 / ELEVATION_ZONES.length);

/** A ring pulled out by this many pixels past the map's edge is drawn again on the far side. */
const SEAM_TOLERANCE_PX = 0.5;

/**
 * The ring with its longitudes continuous: a step of more than 180 degrees is a crossing of the antimeridian, not a
 * long edge, so it is taken the short way round. Null for a ring that does not close up after that: it circles a
 * pole (its coast runs the whole way round, then back along the pole), and is drawn as it is.
 */
function unwrapRing(ring: readonly Position[]): Position[] | null {
  const first = ring[0]!;
  let lng = first[0]!;
  const out: Position[] = [[lng, first[1]!]];
  for (let i = 1; i < ring.length; i++) {
    const step = ring[i]![0]! - ring[i - 1]![0]!;
    lng += step > 180 ? step - 360 : step < -180 ? step + 360 : step;
    out.push([lng, ring[i]![1]!]);
  }
  return Math.abs(out[out.length - 1]![0]! - first[0]!) < 180 ? out : null;
}

const copyRing = (ring: readonly Position[]): Position[] => ring.map((p) => [...p]);

/** The middle of a ring's longitudes. */
function midLongitude(ring: readonly Position[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const [lng] of ring) {
    if (lng! < min) min = lng!;
    if (lng! > max) max = lng!;
  }
  return (min + max) / 2;
}

/**
 * A polygon's rings with continuous longitudes, the holes on the outer ring's side of the seam. Each ring is
 * unwrapped from its own first vertex, which can leave a hole a whole turn (360 degrees) from its outer ring; with
 * even-odd fill it would then not overlap the ring it is cut from. So a hole moves by whole turns until its first
 * vertex is within 180 degrees of the middle of the outer ring.
 */
function continuousPolygon(rings: readonly (readonly Position[])[]): Position[][] {
  const [outerRing, ...holes] = rings;
  if (!outerRing || outerRing.length < 4) return [];
  const outer = unwrapRing(outerRing) ?? copyRing(outerRing);
  const middle = midLongitude(outer);
  const placed = holes.flatMap((hole) => {
    if (hole.length < 4) return [];
    const ring = unwrapRing(hole);
    if (!ring) return [copyRing(hole)];
    const turns = Math.round((middle - ring[0]![0]!) / 360);
    return [ring.map(([lng, lat]) => [lng! + turns * 360, lat!])];
  });
  return [outer, ...placed];
}

/** The SVG path (pixel space) of a feature's polygons, and how far it reaches either side of the map. */
function featurePath(
  geometry: Geometry,
  width: number,
  height: number
): { d: string; minX: number; maxX: number } | null {
  const polygons = toPolygonal(geometry);
  if (!polygons) return null;
  const list = polygons.type === "Polygon" ? [polygons.coordinates] : polygons.coordinates;
  let minX = Infinity;
  let maxX = -Infinity;
  const parts: string[] = [];
  for (const ring of list.flatMap(continuousPolygon)) {
    const points = ring.map(([lng, lat]) => {
      const x = ((lng! + 180) / 360) * width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      return `${x.toFixed(1)} ${(((90 - lat!) / 180) * height).toFixed(1)}`;
    });
    parts.push(`M${points.join("L")}Z`);
  }
  return parts.length > 0 ? { d: parts.join(""), minX, maxX } : null;
}

/** The element for one feature: itself, and a copy a world's width over for each side of the seam it reaches past. */
function featureElements(
  feature: Feature<Geometry | null>,
  width: number,
  height: number
): string[] {
  const path = feature.geometry && featurePath(feature.geometry, width, height);
  if (!path) return [];
  const elements = [`<path d="${path.d}"/>`];
  if (path.minX < -SEAM_TOLERANCE_PX)
    elements.push(`<path d="${path.d}" transform="translate(${width} 0)"/>`);
  if (path.maxX > width + SEAM_TOLERANCE_PX)
    elements.push(`<path d="${path.d}" transform="translate(${-width} 0)"/>`);
  return elements;
}

/** A band feature that has something to draw. */
interface DrawnBand {
  zone: number;
  paths: string[];
  properties: GeoJsonProperties;
}

/** Each zone's limits: the canonical zone's, unless a feature of the zone carries its own (a realm's own bands). */
function zoneLimits(bands: readonly DrawnBand[]): ZoneLimits[] {
  const zones = ELEVATION_ZONES.map((z) => ({ min: z.elevationMin, max: z.elevationMax }));
  const own = new Set<number>();
  for (const { zone, properties } of bands) {
    const min = properties?.elevationMin;
    const max = properties?.elevationMax;
    if (own.has(zone) || typeof min !== "number" || typeof max !== "number") continue;
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) continue;
    zones[zone] = { min, max };
    own.add(zone);
  }
  return zones;
}

/**
 * The bands as a zone grid `width` x `height`, or null when the features hold none (no features, land-only bands, no
 * geometry): a realm with no elevations has no relief.
 */
export async function rasterizeBands(
  features: readonly Feature<Geometry | null>[],
  width: number,
  height: number
): Promise<BandsGrid | null> {
  const bands: DrawnBand[] = [];
  for (const feature of features) {
    const zone = bandZone(feature);
    if (zone === null) continue;
    const paths = featureElements(feature, width, height);
    if (paths.length > 0) bands.push({ zone, paths, properties: feature.properties });
  }
  if (bands.length === 0) return null;

  const groups = ELEVATION_ZONES.map((_, zone) => {
    const paths = bands.filter((b) => b.zone === zone).flatMap((b) => b.paths);
    const grey = (zone + 1) * GREY_STEP;
    return paths.length > 0 ? `<g fill="rgb(${grey},${grey},${grey})">${paths.join("")}</g>` : "";
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<g shape-rendering="crispEdges" fill-rule="evenodd"><rect width="${width}" height="${height}" fill="#000"/>` +
    `${groups.join("")}</g></svg>`;

  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(Buffer.from(svg))
    .removeAlpha()
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height) {
    throw new Error(`Altitude bands drew as ${info.width}×${info.height}, not ${width}×${height}`);
  }
  const zoneGrid = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) zoneGrid[i] = Math.round(data[i]! / GREY_STEP);
  return { zoneGrid, zones: zoneLimits(bands) };
}

/** The realm's active altitude features, from the `geometry` column. */
export async function loadAltitudeBands(
  db: Pick<PrismaClient, "mapLayer">,
  realmId: string
): Promise<Feature<Geometry | null>[]> {
  const rows = await db.mapLayer.findMany({
    where: { realmId, layerType: "altitudes", isActive: true },
    select: { geometry: true, properties: true },
    // The same zone limits whichever order the database returns: the first feature of a zone that carries them wins
    orderBy: { featureId: "asc" },
  });
  return rows.map((row): Feature<Geometry | null> => ({
    type: "Feature",
    properties: row.properties as GeoJsonProperties,
    geometry: row.geometry as Geometry | null,
  }));
}
