/**
 * The PNG engine for a realm's physical layers: whole-globe map art traced into the non-political layer types with
 * a fixed palette, so the features carry the properties IxWorld's own have and its styling applies.
 *
 *   altitudes  land from a blank map (grey land on a white sea): R+G+B below `landMaxSum`. Its border lines are
 *              as white as the sea, so a water gap at most `lineWidth` px across (or down) with land on both
 *              sides is land too. Without elevation art: one band, styled as IxWorld's lowest band and marked as
 *              land only (LAND_BAND). With a geography map and its legend's bands: the hypsometric tints
 *              (png/elevation.ts), stored nested as IxWorld stores its bands: each band's polygons cover the land
 *              at or above its lowest elevation, the coast band the whole land.
 *   lakes      water not connected to the ocean (the largest water body, which meets itself across ±180°).
 *   rivers     the geography map's river colour on land, thinned to centre lines (png/rivers.ts): one
 *              MultiLineString per river system, as IxWorld's rivers are lines.
 *   climate    a climate map painted in the climate key's colours, on the land of the blank map: land pixels near
 *              no zone colour (lines, text, a legend box) take the nearest zone; specks merge into a neighbour.
 *   icecaps    land whose darkest channel is above `iceMinChannel` on a geography map (white ice); white label
 *              specks and white islets merge into the land or sea around them.
 *
 * Each polygon layer is one label raster traced with shared arcs (png/engine.ts), so its features tile without
 * gaps or overlaps. The sea is label 0 (ice aside): never traced, never merged into, so a small island keeps its
 * land and its zone. The arcs are simplified (`simplify` px²) and then smoothed (`smooth` rounds of Chaikin corner
 * cutting, junctions kept, topology-smooth.ts), so traced edges have no pixel steps and shared edges stay shared.
 * Pixels become lon/lat as a whole-globe equirectangular image (features meet ±180° as the political import's
 * do), and each layer is split into one feature per polygon, as IxWorld stores them, largest first.
 * Server only (sharp).
 */
import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";
import { LAND_BAND } from "~/lib/maps/elevation-config";
import { climateZoneLabel } from "~/lib/maps/climate-zones";
import type { ClimateKey } from "~/lib/maps/realm-map-settings";
import { assembleRings, polygonPlanarArea } from "~/lib/maps/ring-assembly";
import { smoothTopology } from "~/lib/maps/topology-smooth";
import { tidyGeometry, topologyGeometry } from "../build";
import { resolveGeoreference, transformPolygonal, type PixelToLonLat } from "../georef";
import { pngEngineOptionsSchema } from "../options";
import type { EngineContext } from "../progress";
import { decodeImage, type DecodedImage } from "./decode";
import { altitudeStyles, elevationLabels, SEA_BARRIER, type ElevationBand } from "./elevation";
import { simplifiedTopology, type PixelTopology } from "./engine";
import { fillUnlabelled, snapToPalette } from "./label-raster";
import { layerEngineOptionsSchema, type LayerEngineOptions } from "./layer-engine-options";
import { keyPalette } from "./palette";
import { findRegions, mergeSmallRegions } from "./regions";
import { traceRivers } from "./rivers";
import { traceLabelRings } from "./trace";

export const PNG_LAYER_TYPES = ["altitudes", "lakes", "climate", "icecaps", "rivers"] as const;
export type PngLayerType = (typeof PNG_LAYER_TYPES)[number];

export interface LayerEngineSources {
  /** The blank map: land and water (every other image must be its size). */
  land: Uint8Array;
  /** A climate map painted in the key's zone colours. */
  climate?: { image: Uint8Array; key: ClimateKey };
  /** A map whose ice is white (a geography map). */
  ice?: Uint8Array;
  /** A geography map's hypsometric tints and its legend's bands (lowest first or in any order). */
  elevation?: { image: Uint8Array; bands: readonly ElevationBand[] };
  /** A geography map and the colours its rivers are drawn in. */
  rivers?: { image: Uint8Array; colours: readonly string[] };
}

/** One traced polygon (or river system) of a layer, ready for the realm map writer. */
export interface LayerFeature {
  key: string;
  name: string;
  geometry: Polygon | LineString | MultiLineString;
  properties: Record<string, string | number | null>;
}

export interface LayerEngineResult {
  width: number;
  height: number;
  layers: Partial<Record<PngLayerType, LayerFeature[]>>;
  log: string[];
}

/** A label of a raster to trace: features `<prefix>-<n>` named `name`, with `properties` (plus their `id`). */
interface TraceClass {
  label: number;
  prefix: string;
  name: string;
  properties: Record<string, string | number | null>;
}

interface TraceSettings {
  minRegionPixels: number;
  simplify: number;
  smooth: number;
  smoothMaxCut: number;
  smoothPrune: number;
  transform: PixelToLonLat;
}

const LAND = 1;
const LAKE = 2;
const ICE = 1;
const BARE_LAND = 2;
const ICE_SEA = 3;
/** Rounds of line closing: a junction of lines closes in the second. */
const MAX_LINE_ROUNDS = 4;

const LAND_CLASS: Omit<TraceClass, "label"> = {
  prefix: "land",
  name: LAND_BAND.zoneName,
  properties: {
    fill: LAND_BAND.color,
    "ixmap-subgroup": "coastlines",
    zoneId: LAND_BAND.zoneId,
    zoneName: LAND_BAND.zoneName,
  },
};
const LAKE_CLASS: Omit<TraceClass, "label"> = {
  prefix: "lake",
  name: "Lake",
  properties: { fill: "#84daff", "ixmap-subgroup": null },
};
const ICE_CLASS: Omit<TraceClass, "label"> = {
  prefix: "ice",
  name: "Ice cap",
  properties: { fill: "#ffffff", "ixmap-subgroup": null },
};
/** IxWorld's river style. */
const RIVER_FILL = "#6f95ff";

/** Called with a water gap of the mask: its first pixel, the pixel after it, and the step between pixels. */
type GapMarker = (start: number, end: number, step: number) => void;

/** Visit each water run of one row or column (`count` pixels from `first`, `step` apart) with land on both ends. */
function forEnclosedGaps(
  mask: Uint8Array,
  first: number,
  count: number,
  step: number,
  visit: GapMarker
) {
  let i = 0;
  while (i < count) {
    if (mask[first + i * step] === 1) {
      i++;
      continue;
    }
    const start = i;
    while (i < count && mask[first + i * step] !== 1) i++;
    if (start > 0 && i < count) visit(first + start * step, first + i * step, step);
  }
}

/**
 * The blank map's land (1) and water (0), with drawn border lines (water gaps at most `lineWidth` px across or
 * down, land on both sides) counted as land. Returns how many line pixels became land.
 */
export function landMask(
  image: DecodedImage,
  options: Pick<LayerEngineOptions, "landMaxSum" | "lineWidth">
): { mask: Uint8Array; lines: number } {
  const { width, height, data } = image;
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) {
    const o = p * 4;
    mask[p] =
      data[o + 3]! >= 128 && data[o]! + data[o + 1]! + data[o + 2]! < options.landMaxSum ? 1 : 0;
  }
  // Marked 2 first, so the second direction still sees only the land of the round before.
  const mark: GapMarker = (start, end, step) => {
    if ((end - start) / step > options.lineWidth) return;
    for (let p = start; p < end; p += step) mask[p] = 2;
  };
  let lines = 0;
  // Where lines meet, the junction is long both across and down; once the lines are land it is a short gap.
  for (let round = 0; round < MAX_LINE_ROUNDS; round++) {
    for (let y = 0; y < height; y++) forEnclosedGaps(mask, y * width, width, 1, mark);
    for (let x = 0; x < width; x++) forEnclosedGaps(mask, x, height, width, mark);
    let marked = 0;
    for (let p = 0; p < mask.length; p++) {
      if (mask[p] === 2) {
        mask[p] = 1;
        marked++;
      }
    }
    lines += marked;
    if (marked === 0) break;
  }
  return { mask, lines };
}

/** Land (LAND), lakes (LAKE) and the ocean (0): the largest body of water, joined across ±180°. */
async function landAndLakes(mask: Uint8Array, width: number, height: number, ctx: EngineContext) {
  const labels = new Uint16Array(mask.length);
  for (let p = 0; p < mask.length; p++) labels[p] = mask[p] ? LAND : LAKE;
  const { runs, region, area, regionLabel } = await findRegions(labels, width, height, ctx, true);
  let ocean = -1;
  for (let r = 0; r < area.length; r++) {
    if (regionLabel[r] === LAKE && (ocean < 0 || area[r]! > area[ocean]!)) ocean = r;
  }
  let lakes = 0;
  for (let r = 0; r < area.length; r++) if (regionLabel[r] === LAKE && r !== ocean) lakes++;
  for (let i = 0; i < runs.count; i++) {
    if (region[i] !== ocean) continue;
    const row = runs.row[i]! * width;
    labels.fill(0, row + runs.start[i]!, row + runs.end[i]!);
  }
  return { labels, lakes };
}

/**
 * Clear (to 0, to be filled) the zone specks under `minPixels` that touch no sea: a legend swatch or a letter in
 * a zone colour would otherwise grow into the box around it. Specks on the coast stay: a small island's zone.
 */
async function clearInlandSpecks(
  labels: Uint16Array,
  width: number,
  height: number,
  minPixels: number,
  ctx: EngineContext
): Promise<number> {
  const { runs, region, area, regionLabel } = await findRegions(labels, width, height, ctx);
  const isSea = (p: number) => labels[p] === SEA_BARRIER;
  const touchesSea = (p: number, x: number) =>
    (x > 0 && isSea(p - 1)) ||
    (x + 1 < width && isSea(p + 1)) ||
    (p >= width && isSea(p - width)) ||
    (p + width < labels.length && isSea(p + width));
  const speck = (r: number) =>
    area[r]! < minPixels && regionLabel[r] !== 0 && regionLabel[r] !== SEA_BARRIER;
  const coastal = new Uint8Array(area.length);
  for (let i = 0; i < runs.count; i++) {
    const r = region[i]!;
    const row = runs.row[i]! * width;
    for (let x = runs.start[i]!; x < runs.end[i]! && speck(r) && !coastal[r]; x++) {
      if (touchesSea(row + x, x)) coastal[r] = 1;
    }
  }
  let cleared = 0;
  for (let i = 0; i < runs.count; i++) {
    const r = region[i]!;
    if (!speck(r) || coastal[r]) continue;
    const row = runs.row[i]! * width;
    labels.fill(0, row + runs.start[i]!, row + runs.end[i]!);
    cleared += runs.end[i]! - runs.start[i]!;
  }
  return cleared;
}

/** The climate map's zones on the land: label = palette index + 1, sea 0. */
async function climateLabels(
  image: DecodedImage,
  mask: Uint8Array,
  key: ClimateKey,
  options: Pick<LayerEngineOptions, "climateTolerance" | "minRegionPixels">,
  ctx: EngineContext
) {
  const snapOptions = pngEngineOptionsSchema.parse({
    tolerance: options.climateTolerance,
    borderLightness: 0,
    colourKey: key.zones.map((zone) => ({ hex: zone.color, nation: zone.code })),
  });
  const palette = keyPalette(snapOptions);
  const { labels } = await snapToPalette(image.data, palette, snapOptions, ctx);
  let unmatched = 0;
  for (let p = 0; p < labels.length; p++) {
    if (!mask[p]) labels[p] = SEA_BARRIER;
    else if (labels[p] === 0) unmatched++;
  }
  const specks = await clearInlandSpecks(
    labels,
    image.width,
    image.height,
    options.minRegionPixels.climate,
    ctx
  );
  await fillUnlabelled(labels, image.width, image.height, ctx, SEA_BARRIER);
  for (let p = 0; p < labels.length; p++) if (labels[p] === SEA_BARRIER) labels[p] = 0;
  const classes: TraceClass[] = palette.map((entry, index) => {
    const zone = key.zones.find((candidate) => candidate.code === entry.nation)!;
    return {
      label: index + 1,
      prefix: zone.code.replace(/[^A-Za-z0-9]+/g, "-"),
      name: climateZoneLabel(zone),
      properties: {
        fill: entry.hex,
        "ixmap-subgroup": null,
        climateId: zone.code,
        climateName: climateZoneLabel(zone),
      },
    };
  });
  return { labels, classes, unmatched, specks };
}

/**
 * Ice (ICE), other land (BARE_LAND) and sea (ICE_SEA, a label of its own here so that a small white islet, a
 * label's halo, merges into it instead of standing as an ice cap).
 */
function iceLabels(image: DecodedImage, mask: Uint8Array, minChannel: number): Uint16Array {
  const labels = new Uint16Array(mask.length).fill(ICE_SEA);
  const { data } = image;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const o = p * 4;
    labels[p] = Math.min(data[o]!, data[o + 1]!, data[o + 2]!) > minChannel ? ICE : BARE_LAND;
  }
  return labels;
}

/** A geometry's polygons as features of one class, largest first. */
function classFeatures(geometry: Polygon | MultiPolygon, cls: TraceClass): LayerFeature[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .map((coordinates) => ({ coordinates, area: polygonPlanarArea(coordinates) }))
    .sort((a, b) => b.area - a.area)
    .map(({ coordinates }, i) => {
      const key = `${cls.prefix}-${i + 1}`;
      return {
        key,
        name: cls.name,
        geometry: { type: "Polygon", coordinates },
        properties: { id: key, ...cls.properties },
      };
    });
}

/**
 * The classes of a label raster as one topology (other labels only shape them): specks merged, every border
 * traced once, simplified and smoothed. Each class is the region key `String(label)`. Rewrites `labels`.
 */
async function traceTopology(
  labels: Uint16Array,
  width: number,
  height: number,
  classes: readonly TraceClass[],
  settings: TraceSettings,
  ctx: EngineContext
): Promise<PixelTopology> {
  await mergeSmallRegions(labels, width, height, settings.minRegionPixels, ctx);
  const rings = await traceLabelRings(labels, width, height, ctx);
  const pixelFeatures: Array<Feature<Polygon | MultiPolygon, { key: string }>> = [];
  for (const cls of classes) {
    const own = rings.get(cls.label);
    if (!own?.length) continue;
    pixelFeatures.push({
      type: "Feature",
      properties: { key: String(cls.label) },
      geometry: assembleRings(own, "evenodd"),
    });
  }
  return smoothTopology(simplifiedTopology(pixelFeatures, settings.simplify), {
    iterations: settings.smooth,
    maxCut: settings.smoothMaxCut,
    prune: settings.smoothPrune,
  });
}

/** The regions of `labels` merged along their shared arcs, georeferenced, tidied and split per polygon. */
function topologyFeatures(
  topology: PixelTopology,
  labels: readonly number[],
  cls: TraceClass,
  transform: PixelToLonLat
): LayerFeature[] {
  const geometry = topologyGeometry(topology, labels.map(String));
  const placed = geometry ? tidyGeometry(transformPolygonal(geometry, transform)) : null;
  return placed ? classFeatures(placed, cls) : [];
}

/** Trace the classes of a label raster, each on its own (see traceTopology). Rewrites `labels`. */
async function traceClasses(
  labels: Uint16Array,
  width: number,
  height: number,
  classes: readonly TraceClass[],
  settings: TraceSettings,
  ctx: EngineContext
): Promise<Map<number, LayerFeature[]>> {
  const topology = await traceTopology(labels, width, height, classes, settings, ctx);
  const out = new Map<number, LayerFeature[]>();
  for (const cls of classes) {
    out.set(cls.label, topologyFeatures(topology, [cls.label], cls, settings.transform));
    await ctx.tick();
  }
  return out;
}

/** The elevation bands as IxWorld stores them: band i covers every band from i up (the coast band, all land). */
async function traceElevation(
  image: DecodedImage,
  rawBands: readonly ElevationBand[],
  water: Uint16Array,
  ice: Uint16Array | null,
  options: LayerEngineOptions,
  settings: TraceSettings,
  ctx: EngineContext
) {
  const bands = [...rawBands].sort((a, b) => a.min - b.min);
  const styles = altitudeStyles(bands);
  const raster = await elevationLabels(
    image,
    bands,
    (p) => water[p] === LAND,
    (p) => ice?.[p] === ICE,
    { tolerance: options.elevationTolerance, smoothing: options.elevationSmoothing },
    ctx
  );
  const classes: TraceClass[] = styles.map((style, i) => ({
    label: i + 1,
    prefix: style.subgroup === "coastlines" ? "coast" : style.subgroup.toLowerCase(),
    name: style.label,
    properties: {
      fill: style.fill,
      "ixmap-subgroup": style.subgroup,
      zoneId: style.zoneId,
      zoneName: style.label,
      elevationMin: bands[i]!.min,
      elevationMax: bands[i]!.max,
      elevationLabel: style.label,
    },
  }));
  const topology = await traceTopology(
    raster.labels,
    image.width,
    image.height,
    classes,
    settings,
    ctx
  );
  const features: LayerFeature[] = [];
  for (const cls of classes) {
    const upward = classes.filter((c) => c.label >= cls.label).map((c) => c.label);
    features.push(...topologyFeatures(topology, upward, cls, settings.transform));
    await ctx.tick();
  }
  return { features, raster };
}

/** The rivers as features: one MultiLineString per river system, longest first, in lon/lat. */
function riverFeatures(
  image: DecodedImage,
  colours: readonly string[],
  water: Uint16Array,
  options: LayerEngineOptions,
  transform: PixelToLonLat
) {
  const traced = traceRivers(image, (p) => water[p] === LAND, { colours, ...options.rivers });
  const features = traced.systems.map((system, i): LayerFeature => {
    const key = `river-${i + 1}`;
    const lines = system.map((line) => line.map(([x, y]) => transform(x!, y!)));
    return {
      key,
      name: "River",
      geometry:
        lines.length === 1
          ? { type: "LineString", coordinates: lines[0]! }
          : { type: "MultiLineString", coordinates: lines },
      properties: { id: key, fill: RIVER_FILL, "ixmap-subgroup": null },
    };
  });
  return { features, pixels: traced.pixels, dropped: traced.dropped };
}

/** Decodes each distinct image once; every image must be the land image's size. */
function imageReader(like: { width: number; height: number }) {
  const decoded = new Map<Uint8Array, Promise<DecodedImage>>();
  return (bytes: Uint8Array, what: string) => {
    let image = decoded.get(bytes);
    if (!image) {
      image = decodeImage(bytes).then((img) => {
        if (img.width !== like.width || img.height !== like.height) {
          throw new Error(
            `The ${what} image is ${img.width}×${img.height}, not the land image's size (${like.width}×${like.height})`
          );
        }
        return img;
      });
      decoded.set(bytes, image);
    }
    return image;
  };
}

type ReadImage = ReturnType<typeof imageReader>;

interface Stage {
  sources: LayerEngineSources;
  options: LayerEngineOptions;
  width: number;
  height: number;
  mask: Uint8Array;
  water: Uint16Array;
  read: ReadImage;
  settings: (minRegionPixels: number) => TraceSettings;
  layers: LayerEngineResult["layers"];
  log: string[];
  ctx: EngineContext;
}

async function climateStage(s: Stage) {
  if (!s.sources.climate) return;
  s.ctx.progress(30, "Tracing climate zones");
  const image = await s.read(s.sources.climate.image, "climate");
  const climate = await climateLabels(image, s.mask, s.sources.climate.key, s.options, s.ctx);
  s.log.push(
    `Climate: ${climate.unmatched} land pixels near no zone colour and ${climate.specks} in inland specks, given to the nearest zone`
  );
  const traced = await traceClasses(
    climate.labels,
    s.width,
    s.height,
    climate.classes,
    s.settings(s.options.minRegionPixels.climate),
    s.ctx
  );
  s.layers.climate = climate.classes.flatMap((c) => traced.get(c.label) ?? []);
}

/** Ice caps; returns the ice raster (ICE where ice is) for the elevation bands. */
async function iceStage(s: Stage): Promise<Uint16Array | null> {
  if (!s.sources.ice) return null;
  s.ctx.progress(55, "Tracing ice");
  const image = await s.read(s.sources.ice, "ice");
  const labels = iceLabels(image, s.mask, s.options.iceMinChannel);
  const traced = await traceClasses(
    labels,
    s.width,
    s.height,
    [{ label: ICE, ...ICE_CLASS }],
    s.settings(s.options.minRegionPixels.icecaps),
    s.ctx
  );
  s.layers.icecaps = traced.get(ICE);
  return labels;
}

async function elevationStage(s: Stage, ice: Uint16Array | null) {
  if (!s.sources.elevation) return;
  s.ctx.progress(65, "Tracing elevation bands");
  const image = await s.read(s.sources.elevation.image, "elevation");
  const { features, raster } = await traceElevation(
    image,
    s.sources.elevation.bands,
    s.water,
    ice,
    s.options,
    s.settings(s.options.minRegionPixels.elevation),
    s.ctx
  );
  s.log.push(
    `Elevation: ${raster.unmatched} land pixels near no band tint, ${raster.cleared} in patches that skip a band, ${raster.smoothed} changed by the mode filter`
  );
  s.layers.altitudes = features;
}

async function riverStage(s: Stage) {
  if (!s.sources.rivers) return;
  s.ctx.progress(90, "Tracing rivers");
  const image = await s.read(s.sources.rivers.image, "rivers");
  const rivers = riverFeatures(
    image,
    s.sources.rivers.colours,
    s.water,
    s.options,
    s.settings(0).transform
  );
  s.log.push(
    `Rivers: ${rivers.pixels} river pixels on land, ${rivers.features.length} river systems kept, ${rivers.dropped} too short dropped`
  );
  s.layers.rivers = rivers.features;
}

/**
 * Trace the layers the sources allow: always land and lakes; climate, ice caps, elevation bands (which replace
 * the single land band) and rivers when their art is given.
 */
export async function runLayerEngine(
  sources: LayerEngineSources,
  rawOptions: unknown,
  ctx: EngineContext
): Promise<LayerEngineResult> {
  const options = layerEngineOptionsSchema.parse(rawOptions ?? {});
  const log: string[] = [];
  ctx.progress(1, "Reading the land");
  const blank = await decodeImage(sources.land);
  const { width, height } = blank;
  const { mask, lines } = landMask(blank, options);
  log.push(`Image: ${width}×${height}; ${lines} border-line pixels counted as land`);
  const transform = resolveGeoreference(undefined, width, height).transform;
  const settings = (minRegionPixels: number): TraceSettings => ({
    minRegionPixels,
    simplify: options.simplify,
    smooth: options.smooth,
    smoothMaxCut: options.smoothMaxCut,
    smoothPrune: options.smoothPrune,
    transform,
  });
  const layers: LayerEngineResult["layers"] = {};

  ctx.progress(10, "Tracing land and lakes");
  const water = await landAndLakes(mask, width, height, ctx);
  log.push(`Water: the ocean and ${water.lakes} enclosed bodies of water`);
  // The speck merge rewrites the raster: later stages read the land and lakes as they are drawn.
  const physical = await traceClasses(
    water.labels,
    width,
    height,
    [
      { label: LAND, ...LAND_CLASS },
      { label: LAKE, ...LAKE_CLASS },
    ],
    settings(options.minRegionPixels.land),
    ctx
  );
  layers.altitudes = physical.get(LAND);
  layers.lakes = physical.get(LAKE);

  const stage: Stage = {
    sources,
    options,
    width,
    height,
    mask,
    water: water.labels,
    read: imageReader(blank),
    settings,
    layers,
    log,
    ctx,
  };
  await climateStage(stage);
  await elevationStage(stage, await iceStage(stage));
  await riverStage(stage);
  ctx.progress(99, "Done");
  return { width, height, layers, log };
}
