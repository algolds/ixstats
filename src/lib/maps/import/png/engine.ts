/**
 * The PNG map engine: a flat-colour political map image in, one region per palette colour out, as a TopoJSON
 * topology in pixel coordinates so neighbouring regions share their borders exactly.
 *
 *   decode once (sharp) → palette (colour key, or auto-detected) → snap pixels → majority vote → fill border
 *   lines and unmatched pixels from their neighbours → merge specks into their largest neighbour → trace every
 *   boundary once → assemble rings (holes by containment) → TopoJSON (shared arcs) → topological simplification
 *
 * Which colour is which nation is decided afterwards (several colours may be one nation); the topology lets
 * those be merged along their shared arcs. Server only (sharp). Runs in a worker thread when one is available,
 * else yields to the event loop between slices (see progress.ts).
 */
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { assembleRings } from "~/lib/maps/ring-assembly";
import { decodeImage } from "./decode";
import { clearLineLabels, fillUnlabelled, majorityFilter, snapToPalette } from "./label-raster";
import {
  autoPalette,
  colourHistogram,
  keyPalette,
  topUnmatched,
  type PaletteEntry,
} from "./palette";
import { mergeSmallRegions } from "./regions";
import { traceLabelRings } from "./trace";
import { pngEngineOptionsSchema, type EngineResult, type ImportRegion } from "../options";
import { stageProgress, type EngineContext } from "../progress";

// TopoJSON packages are CommonJS.
const topoServer = require("topojson-server") as {
  topology: (objects: Record<string, unknown>, quantization?: number) => PixelTopology;
};
const topoSimplify = require("topojson-simplify") as {
  presimplify: (topology: PixelTopology) => PixelTopology;
  simplify: (topology: PixelTopology, minWeight?: number) => PixelTopology;
};

export interface PixelTopology {
  type: "Topology";
  arcs: number[][][];
  objects: Record<
    string,
    { type: string; geometries?: Array<{ type: string; properties?: { key: string } }> }
  >;
}

/** One TopoJSON topology of the traced regions (shared arcs), simplified once when `simplify` > 0 (px²). */
export function simplifiedTopology(
  features: Array<Feature<Polygon | MultiPolygon, { key: string }>>,
  simplify: number
): PixelTopology {
  const topology = topoServer.topology({ regions: { type: "FeatureCollection", features } });
  return simplify > 0
    ? topoSimplify.simplify(topoSimplify.presimplify(topology), simplify)
    : topology;
}

/** Below this many pixels a region is a speck: 0.002% of the image, at least 16 pixels. */
export const defaultMinRegionPixels = (pixels: number) =>
  Math.max(16, Math.round(pixels * 0.00002));

export async function runPngEngine(
  bytes: Uint8Array,
  rawOptions: unknown,
  ctx: EngineContext
): Promise<EngineResult> {
  const options = pngEngineOptionsSchema.parse(rawOptions ?? {});
  const timings: Record<string, number> = {};
  const log: string[] = [];
  const warnings: string[] = [];
  let clock = Date.now();
  const lap = (name: string) => {
    const now = Date.now();
    timings[name] = now - clock;
    clock = now;
  };

  ctx.progress(1, "Decoding the image");
  let image: Awaited<ReturnType<typeof decodeImage>> | null = await decodeImage(bytes);
  const { width, height } = image;
  const pixels = width * height;
  log.push(`Image: ${width}×${height} (${(pixels / 1e6).toFixed(1)} megapixels)`);
  lap("decode");

  ctx.progress(8, "Finding the map's colours");
  const hist = await colourHistogram(image.data, ctx);
  const palette: PaletteEntry[] = options.colourKey?.length
    ? keyPalette(options)
    : autoPalette(hist, options);
  if (hist.transparent > 0) {
    palette.push({
      hex: "#000000",
      rgb: [0, 0, 0],
      lab: [0, 0, 0],
      water: true,
      transparent: true,
    });
  }
  if (palette.length === 0)
    throw new Error("No colours were found: upload a flat-colour political map");
  if (palette.length > 65000) throw new Error("The map has too many colours");
  log.push(
    options.colourKey?.length
      ? `Palette: the colour key's ${palette.length} colours`
      : `Palette: ${palette.length} colours detected (tolerance ΔE ${options.tolerance})`
  );
  lap("palette");

  ctx.progress(15, "Matching pixels to colours");
  const snapped = await snapToPalette(image.data, palette, options, ctx);
  image = null; // the RGBA buffer is not needed any more
  const { labels } = snapped;
  log.push(
    `Snapped: ${snapped.borderPixels} border-line pixels, ${snapped.unknownPixels} pixels near no colour`
  );
  lap("snap");

  ctx.progress(35, "Removing border lines");
  // A detected colour that exists only as thin lines is a fringe or a blend, not a nation (a key's colours stay).
  const lineLabels = options.colourKey?.length
    ? new Set<number>()
    : await clearLineLabels(labels, width, height, palette.length, ctx);
  if (lineLabels.size > 0)
    log.push(`Dropped ${lineLabels.size} colour(s) that only appear as thin lines`);
  const voted = options.majorityFilter ? await majorityFilter(labels, width, height, ctx) : 0;
  const filled = await fillUnlabelled(labels, width, height, ctx);
  if (voted) log.push(`Majority vote changed ${voted} pixels`);
  log.push(`Filled ${filled} pixels from their neighbours`);
  lap("clean");

  ctx.progress(45, "Merging specks");
  const minRegionPixels = options.minRegionPixels ?? defaultMinRegionPixels(pixels);
  const regionStats = await mergeSmallRegions(labels, width, height, minRegionPixels, ctx);
  log.push(
    `Merged ${regionStats.mergedCount} regions under ${minRegionPixels} px (${regionStats.mergedPixels} px) into their largest neighbour`
  );
  lap("regions");

  const counts = new Uint32Array(palette.length);
  for (let p = 0; p < labels.length; p++) if (labels[p]) counts[labels[p]! - 1]!++;

  ctx.progress(55, "Tracing borders");
  const rings = await traceLabelRings(
    labels,
    width,
    height,
    ctx,
    stageProgress(ctx.progress, 55, 75, "Tracing borders")
  );
  lap("trace");

  ctx.progress(76, "Assembling regions");
  const features: Array<Feature<Polygon | MultiPolygon, { key: string }>> = [];
  const regions: ImportRegion[] = [];
  for (let index = 0; index < palette.length; index++) {
    const entry = palette[index]!;
    const label = index + 1;
    if (lineLabels.has(label)) continue;
    const labelRings = rings.get(label);
    const key = entry.transparent ? "transparent" : entry.hex;
    regions.push({
      key,
      colour: entry.transparent ? undefined : entry.hex,
      name: entry.nation,
      pixels: counts[index]!,
      parts: regionStats.partsPerLabel.get(label) ?? 0,
      mergedSpecks: regionStats.mergedPerLabel.get(label) ?? 0,
      water: entry.water || undefined,
    });
    if (!labelRings?.length) continue;
    features.push({
      type: "Feature",
      properties: { key },
      geometry: assembleRings(labelRings, "evenodd"),
    });
    await ctx.tick();
  }
  const empty = regions.filter((r) => !r.pixels);
  if (empty.length > 0) {
    warnings.push(
      `${empty.length} palette colour(s) cover no pixels: ${empty
        .slice(0, 10)
        .map((r) => r.key)
        .join(", ")}`
    );
  }
  lap("assemble");

  ctx.progress(85, "Building and simplifying shared borders");
  const simplified = simplifiedTopology(features, options.simplify);
  lap("topology");
  const vertices = simplified.arcs.reduce((sum, arc) => sum + arc.length, 0);
  log.push(`Topology: ${simplified.arcs.length} shared arcs, ${vertices} vertices`);

  const unmatched = topUnmatched(snapped.unmatchedCounts, snapped.unmatchedSums).filter(
    (c) => c.pixels >= Math.max(1, Math.round(pixels * options.paletteMinShare))
  );
  if (unmatched.length > 0) {
    warnings.push(
      `${unmatched.length} colour(s) of the image match no palette colour and were given to their neighbours`
    );
  }
  ctx.progress(99, "Done");
  return {
    kind: "png",
    space: "pixel",
    width,
    height,
    regions: regions.sort((a, b) => (b.pixels ?? 0) - (a.pixels ?? 0)),
    topology: simplified,
    report: {
      log,
      warnings,
      unmatchedColours: unmatched,
      filledPixels: filled,
      mergedRegions: {
        count: regionStats.mergedCount,
        pixels: regionStats.mergedPixels,
        minRegionPixels,
      },
      timingsMs: timings,
    },
  };
}
