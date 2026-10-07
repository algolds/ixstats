/**
 * The realm SVG engine: a political map drawn as SVG, on the province importer's building blocks (every shape
 * type, accumulated `transform`s, arcs, fill rules, text labels) instead of the old whole-map parser, which read
 * only `<path>` and ignored transforms.
 *
 * Each region is a nation: the nearest enclosing `<g>` with a meaningful name (a `<title>`, Inkscape label,
 * data-name, aria-label or a non-generic id), else the shape's own name, else its fill colour. Shapes of one
 * region are unioned; rings become polygons and holes by containment (ring-assembly). A region still unnamed takes
 * the `<text>` label drawn over it. Coordinates are the viewBox's (origin moved to 0, 0), georeferenced later like
 * a PNG's pixels. Server only (@xmldom/xmldom).
 */
import { DOMParser } from "@xmldom/xmldom";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { extractFillColor, extractFillRule } from "~/lib/flags/svg/topology-flattener";
import { featureIdToDisplayName } from "~/lib/flags/svg-parser";
import { assembleRings } from "~/lib/maps/ring-assembly";
import { elementToRings } from "~/lib/maps/province-importer/svg-element-converter";
import {
  applyMatrixToRings,
  getAccumulatedTransform,
} from "~/lib/maps/province-importer/svg-transform";
import { collectShapeElements } from "~/lib/maps/province-importer/svg-layer-detector";
import {
  extractAllTextLabels,
  matchLabelsToProvinces,
} from "~/lib/maps/province-importer/svg-text-matcher";
import {
  SVG_NS,
  elementChildren,
  inkscapeLabel,
  sanitizeSvg,
  svgTag,
  type XmlElement,
} from "~/lib/maps/province-importer/svg-dom";
import { unionGeometries } from "./build";
import { svgEngineOptionsSchema, type EngineResult, type ImportRegion } from "./options";

const GENERIC_ID =
  /^(path|rect|g|layer|use|circle|ellipse|line|polygon|polyline|image|text|tspan|svg|defs|clip|mask|shape|group|_x[0-9a-f]+_)[\s_-]*\d*$/i;
const POLITICAL_LAYER = /political|countries|nations|states|borders|realm/i;
const WATER_NAME = /\b(ocean|sea|water|lakes?|background|bg)\b/i;

/** A meaningful name on an element: its `<title>`, Inkscape label, data-name, aria-label or id (null if none). */
export function elementName(el: XmlElement): string | null {
  const title = elementChildren(el)
    .find((c) => svgTag(c) === "title")
    ?.textContent?.trim();
  const candidates = [
    title,
    inkscapeLabel(el),
    el.getAttribute("data-name"),
    el.getAttribute("aria-label"),
  ];
  for (const value of candidates) if (value && !GENERIC_ID.test(value.trim())) return value.trim();
  const id = el.getAttribute("id")?.trim();
  return id && !GENERIC_ID.test(id) ? featureIdToDisplayName(id) : null;
}

function viewBoxOf(root: XmlElement): { x: number; y: number; width: number; height: number } {
  const parts =
    root
      .getAttribute("viewBox")
      ?.split(/[\s,]+/)
      .map(Number) ?? [];
  if (parts.length >= 4 && parts.every(Number.isFinite) && parts[2]! > 0 && parts[3]! > 0) {
    return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
  }
  return {
    x: 0,
    y: 0,
    width: parseFloat(root.getAttribute("width") || "0"),
    height: parseFloat(root.getAttribute("height") || "0"),
  };
}

function findLayer(root: XmlElement, wanted: string | undefined, log: string[]): XmlElement {
  const groups = [...root.getElementsByTagNameNS(SVG_NS, "g")];
  const nameOf = (g: XmlElement) => `${inkscapeLabel(g)} ${g.getAttribute("id") ?? ""}`;
  const match = wanted
    ? groups.find((g) => nameOf(g).toLowerCase().includes(wanted.toLowerCase()))
    : groups.find((g) => g.parentNode === root && POLITICAL_LAYER.test(nameOf(g)));
  if (wanted && !match) log.push(`Layer "${wanted}" not found: reading the whole drawing`);
  if (match) log.push(`Reading the layer "${nameOf(match).trim()}"`);
  return match ?? root;
}

/** The region a shape belongs to: the nearest named group below the layer, else the shape's own name. */
function regionOf(
  shape: XmlElement,
  layer: XmlElement,
  index: number
): { key: string; name: string | null } {
  for (
    let p = shape.parentNode as XmlElement | null;
    p && p !== layer;
    p = p.parentNode as XmlElement | null
  ) {
    if (p.nodeType !== 1 || svgTag(p) !== "g") continue;
    const name = elementName(p);
    if (name) return { key: `g:${name}`, name };
  }
  const own = elementName(shape);
  if (own) return { key: `s:${own}`, name: own };
  const fill = extractFillColor(shape, shape.getAttribute("style") || "")?.toLowerCase();
  return { key: fill ? `fill:${fill}` : `shape:${index}`, name: null };
}

export function runSvgEngine(svgText: string, rawOptions: unknown = {}): EngineResult {
  const options = svgEngineOptionsSchema.parse(rawOptions ?? {});
  const started = Date.now();
  const log: string[] = [];
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(sanitizeSvg(svgText), "image/svg+xml");
  const root = doc.documentElement as XmlElement | null;
  if (!root || svgTag(root) !== "svg") throw new Error("The file is not an SVG drawing");
  const viewBox = viewBoxOf(root);
  if (!(viewBox.width > 0 && viewBox.height > 0)) throw new Error("The SVG has no viewBox or size");
  log.push(`viewBox ${viewBox.width}×${viewBox.height}`);

  const layer = findLayer(root, options.layer, log);
  const shapes = collectShapeElements(layer, root);
  log.push(`${shapes.length} filled shapes`);

  const pieces = new Map<
    string,
    { name: string | null; colour?: string; geometries: Array<Polygon | MultiPolygon> }
  >();
  let skipped = 0;
  let background = 0;
  for (const [index, shape] of shapes.entries()) {
    const label = `${shape.getAttribute("id") ?? ""} ${inkscapeLabel(shape)} ${shape.getAttribute("class") ?? ""}`;
    if (WATER_NAME.test(label)) {
      background++;
      continue;
    }
    const rings = elementToRings(shape, options.bezierSegments).filter((r) => r.length >= 4);
    if (rings.length === 0) {
      skipped++;
      continue;
    }
    const placed = applyMatrixToRings(rings, getAccumulatedTransform(shape, root)).map((ring) =>
      ring.map(([x, y]) => [x - viewBox.x, y - viewBox.y])
    );
    // A shape covering most of the drawing is the sea or a background, not a nation.
    const flat = placed.flat();
    const spanX = Math.max(...flat.map((p) => p[0]!)) - Math.min(...flat.map((p) => p[0]!));
    const spanY = Math.max(...flat.map((p) => p[1]!)) - Math.min(...flat.map((p) => p[1]!));
    if (spanX * spanY >= 0.8 * viewBox.width * viewBox.height) {
      background++;
      continue;
    }
    const region = regionOf(shape, layer, index);
    const entry = pieces.get(region.key) ?? { name: region.name, geometries: [] };
    entry.colour ??= extractFillColor(shape, shape.getAttribute("style") || "")?.toLowerCase();
    entry.geometries.push(assembleRings(placed, extractFillRule(shape)));
    pieces.set(region.key, entry);
  }
  if (skipped) log.push(`${skipped} shapes had no drawable outline`);
  if (background) log.push(`${background} sea or background shapes left out`);

  const features: Array<Feature<Polygon | MultiPolygon, { key: string }>> = [];
  const regions: ImportRegion[] = [];
  for (const [key, entry] of pieces) {
    const geometry = unionGeometries(entry.geometries);
    features.push({ type: "Feature", properties: { key }, geometry });
    regions.push({
      key,
      name: entry.name ?? undefined,
      colour: entry.colour && /^#[0-9a-f]{6}$/.test(entry.colour) ? entry.colour : undefined,
      parts: entry.geometries.length,
    });
  }

  // Regions without a name take the text label drawn over them.
  const unnamed = regions.map((r, i) => ({ r, i })).filter(({ r }) => !r.name);
  if (unnamed.length > 0) {
    const labels = extractAllTextLabels(root, root).map((l) => ({
      ...l,
      x: l.x - viewBox.x,
      y: l.y - viewBox.y,
    }));
    const spatial = unnamed.map(({ i }) => {
      const coords = (
        features[i]!.geometry.type === "Polygon"
          ? [features[i]!.geometry.coordinates as number[][][]]
          : (features[i]!.geometry.coordinates as number[][][][])
      ).flat(2);
      const xs = coords.map((p) => p[0]!);
      const ys = coords.map((p) => p[1]!);
      const bbox: [number, number, number, number] = [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];
      return {
        centroid: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as [number, number],
        bbox,
      };
    });
    const matches = matchLabelsToProvinces(labels, spatial);
    for (const [index, text] of matches) unnamed[index]!.r.name = text;
    if (matches.size) log.push(`Named ${matches.size} regions from their text labels`);
  }
  const stillUnnamed = regions.filter((r) => !r.name).length;
  if (stillUnnamed)
    warnings.push(`${stillUnnamed} region(s) have no name: name them in the mapping step`);
  if (regions.length === 0) throw new Error("No filled shapes were found in the SVG");

  return {
    kind: "svg",
    space: "pixel",
    width: viewBox.width,
    height: viewBox.height,
    regions,
    features: { type: "FeatureCollection", features },
    report: { log, warnings, timingsMs: { parse: Date.now() - started } },
  };
}
