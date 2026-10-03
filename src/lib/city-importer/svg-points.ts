// Server-only: imports @xmldom/xmldom via the province-importer SVG pipeline. Never import into a client component or hook.

import { DOMParser } from "@xmldom/xmldom";
import { elementToRings, SHAPE_TAGS } from "~/lib/maps/province-importer/svg-element-converter";
import {
  getAccumulatedTransform,
  applyMatrixToPoint,
  applyMatrixToRings,
} from "~/lib/maps/province-importer/svg-transform";
import {
  detectProvinceLayer,
  collectShapeElements,
  filterProvinceShapes,
} from "~/lib/maps/province-importer/svg-layer-detector";
import { extractAllTextLabels } from "~/lib/maps/province-importer/svg-text-matcher";
import {
  SVG_NS,
  ancestorElements,
  attrNumber,
  attrOrZero,
  elementChildren,
  groupName,
  inkscapeLabel,
  sanitizeSvg,
  svgTag,
  type XmlElement,
} from "~/lib/maps/province-importer/svg-dom";

export interface SvgLayerInfo {
  id: string; // element id or a synthesized id (e.g. "layer-3")
  name: string; // inkscape:label / id / "Layer N"
  shapeCount: number;
  textCount: number;
  /** Circles, ellipses, <use> refs, and small point-like shapes — the actual city markers. */
  markerCount: number;
  /** Nesting depth (0 = top-level child of <svg>) for UI indentation. */
  depth: number;
}

export interface SvgCityPoint {
  svgX: number; // in root SVG coordinate space (after getAccumulatedTransform)
  svgY: number;
  name: string; // matched text label, or "" if none
  isCapital: boolean;
}

interface SvgProvinceRef {
  name: string; // province label text
  svgX: number; // province shape centroid in root SVG space
  svgY: number;
}

interface ParsedCitySvg {
  layers: SvgLayerInfo[];
  points: SvgCityPoint[];
  svgProvinces: SvgProvinceRef[];
  detectedCitiesLayerId: string;
  detectedCityNameLayerId?: string;
}

interface ParseCitySvgOptions {
  citiesLayerId?: string; // which layer holds the dots; auto-detect if unset
  capitalLayerId?: string; // layer (or marker) that marks capitals; optional
  cityNameLayerId?: string; // layer holding city names/labels; optional
}

type TextLabel = ReturnType<typeof extractAllTextLabels>[number];

interface RawPoint {
  x: number;
  y: number;
  el: XmlElement;
  refIcon?: string;
  name?: string;
}

// Layer-name fragments (after normalizeLayerName) that mark the cities layer.
const STRONG_CITY_LAYER_NAMES = [
  "cities",
  "city",
  "town",
  "settlement",
  "localities",
  "locality",
  "place",
];
// Word-boundary match so "decorative-dots" doesn't count; only used when no strong match exists.
const WEAK_CITY_LAYER_NAMES = /\b(dots|pins|markers|points|nodes)\b/i;
const CITY_NAME_LAYER_NAMES = ["names", "labels", "text", "captions", "annotations"];
const ANY_LABEL_LAYER_NAMES = /city|town|place|label|name|text/;

function extractViewBoxWidth(svgRoot: XmlElement): number {
  const parts =
    svgRoot
      .getAttribute("viewBox")
      ?.split(/[\s,]+/)
      .map(Number) ?? [];
  const w = parts.length >= 4 ? parts[2]! : 0;
  return (w === 0 ? attrOrZero(svgRoot, "width") : w) || 800;
}

function isPointLikeElement(el: XmlElement, viewBoxWidth: number): boolean {
  const tag = svgTag(el);
  if (tag === "circle" || tag === "ellipse") {
    const r = attrNumber(el, "r", "rx");
    return r > 0 && r <= 15;
  }
  try {
    const rings = elementToRings(el);
    if (!rings[0]?.length) return false;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of rings.flat()) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const maxDim = Math.max(viewBoxWidth * 0.05, 30);
    return w > 0 && h > 0 && w <= maxDim && h <= maxDim;
  } catch {
    return false;
  }
}

// Count point-like markers (circles, ellipses, <use>, small shapes) by walking the DOM directly.
// Unlike collectShapeElements, this does NOT drop shapes that lack an inline fill= (city dots are
// usually styled via CSS class / default fill), which is exactly what collectShapeElements discards.
function countPointLikeDescendants(el: XmlElement, viewBoxWidth: number): number {
  return elementChildren(el).reduce((count, node) => {
    const tag = svgTag(node);
    if (tag === "circle" || tag === "ellipse" || tag === "use") return count + 1;
    if (SHAPE_TAGS.has(tag)) return count + (isPointLikeElement(node, viewBoxWidth) ? 1 : 0);
    return tag === "g" ? count + countPointLikeDescendants(node, viewBoxWidth) : count;
  }, 0);
}

function matchesIdOrName(el: XmlElement, idOrName: string): boolean {
  return el.getAttribute("id") === idOrName || inkscapeLabel(el) === idOrName;
}

function findLayerByIdOrName(svgRoot: XmlElement, idOrName: string): XmlElement | null {
  if (idOrName === "root") return svgRoot;
  return (
    [...svgRoot.getElementsByTagNameNS(SVG_NS, "g")].find((g) => matchesIdOrName(g, idOrName)) ??
    null
  );
}

function isCapitalElement(el: XmlElement, capitalLayerId?: string): boolean {
  return [el, ...ancestorElements(el)].some((node) =>
    capitalLayerId
      ? matchesIdOrName(node, capitalLayerId)
      : /capital/i.test(node.getAttribute("id") || "") || /capital/i.test(inkscapeLabel(node))
  );
}

// Normalize a layer's name for semantic matching: split camelCase, turn
// separators (_ - . /) into spaces, collapse whitespace, lowercase. So
// "City_names", "cityNames", "city-labels" and "City.Names" all reduce to a
// comparable spaced phrase like "city names" — covering the many ways different
// editors (Illustrator, Inkscape, hand-authored) name the same layer.
function normalizeLayerName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectProvinceName(el: XmlElement, fallbackId: string): string {
  return (
    inkscapeLabel(el) ||
    el.getAttribute("data-name") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("id") ||
    fallbackId
  );
}

/** Recursively list every <g> as a layer, plus a synthetic "root" entry when <svg> holds content directly. */
function enumerateLayers(svgRoot: XmlElement, viewBoxWidth: number): SvgLayerInfo[] {
  const layers: SvgLayerInfo[] = [];
  const seenIds = new Set<string>();
  let syntheticIdx = 0;

  const info = (el: XmlElement, id: string, name: string, depth: number): SvgLayerInfo => ({
    id,
    name,
    shapeCount: collectShapeElements(el, svgRoot).length,
    textCount: extractAllTextLabels(el, svgRoot).length,
    markerCount: countPointLikeDescendants(el, viewBoxWidth),
    depth,
  });

  const enumerateGroups = (parent: XmlElement, depth: number) => {
    for (const child of elementChildren(parent)) {
      if (svgTag(child) !== "g") continue;
      const id = child.getAttribute("id") || `layer-${++syntheticIdx}`;
      // Duplicate ids shouldn't happen in valid SVG, but skip the entry and still recurse
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const name = groupName(child) || id;
        layers.push(info(child, id, name, depth));
      }
      enumerateGroups(child, depth + 1);
    }
  };
  enumerateGroups(svgRoot, 0);

  const rootTags = elementChildren(svgRoot).map(svgTag);
  if (rootTags.some((t) => SHAPE_TAGS.has(t) || t === "text") || layers.length === 0) {
    layers.unshift(info(svgRoot, "root", "Root SVG", 0));
  }
  return layers;
}

/** The layer with the highest `key` count among those whose normalized name satisfies `match`. */
function bestLayerId(
  layers: SvgLayerInfo[],
  key: "markerCount" | "textCount",
  match: (normalizedName: string) => boolean
): string | undefined {
  let best: SvgLayerInfo | undefined;
  for (const layer of layers) {
    if (
      layer[key] > 0 &&
      match(normalizeLayerName(layer.name)) &&
      layer[key] > (best?.[key] ?? 0)
    ) {
      best = layer;
    }
  }
  return best?.id;
}

/** Semantic name match first (strong, then weak), else the layer with the most markers. */
function detectCitiesLayerId(layers: SvgLayerInfo[]): string {
  const isStrong = (name: string) => STRONG_CITY_LAYER_NAMES.some((p) => name.includes(p));
  const named =
    bestLayerId(layers, "markerCount", isStrong) ??
    bestLayerId(layers, "markerCount", (n) => !isStrong(n) && WEAK_CITY_LAYER_NAMES.test(n));
  if (named) return named;
  const mostMarkers = layers.reduce((a, b) => (b.markerCount > a.markerCount ? b : a), layers[0]!);
  return mostMarkers?.id || "root";
}

function scanPoints(group: XmlElement, svgRoot: XmlElement, viewBoxWidth: number): RawPoint[] {
  const points: RawPoint[] = [];
  const toRoot = (el: XmlElement, x: number, y: number) =>
    applyMatrixToPoint(x, y, getAccumulatedTransform(el, svgRoot));

  // Explicit point primitives (circle/ellipse/use dots) ARE the cities — ignore stray
  // point-like <path>s, which are usually label glyphs (text converted to outlines) in the same group.
  const hasPrimitiveMarkers = ["circle", "ellipse", "use"].some(
    (t) => group.getElementsByTagName(t).length > 0
  );

  const scan = (el: XmlElement) => {
    const tag = svgTag(el);
    if (tag === "circle" || tag === "ellipse") {
      if (attrNumber(el, "r", "rx") > 0) {
        const [x, y] = toRoot(el, attrOrZero(el, "cx"), attrOrZero(el, "cy"));
        points.push({ x, y, el });
      }
    } else if (tag === "use") {
      const [x, y] = toRoot(el, attrOrZero(el, "x"), attrOrZero(el, "y"));
      const refIcon = el.getAttribute("href") || el.getAttribute("xlink:href") || "";
      points.push({ x, y, el, refIcon });
    } else if (SHAPE_TAGS.has(tag)) {
      if (!hasPrimitiveMarkers && isPointLikeElement(el, viewBoxWidth)) {
        try {
          const rings = elementToRings(el);
          if (rings[0]?.length) {
            const all = applyMatrixToRings(rings, getAccumulatedTransform(el, svgRoot)).flat();
            points.push({
              x: all.reduce((sum, [px]) => sum + px, 0) / all.length,
              y: all.reduce((sum, [, py]) => sum + py, 0) / all.length,
              el,
            });
          }
        } catch {
          // malformed or unsupported shape in the uploaded SVG — skipped
        }
      }
    } else if (tag === "g") {
      elementChildren(el).forEach(scan);
    }
  };
  elementChildren(group).forEach(scan);

  // Fallback: a group holding only text elements — each label is a point
  if (points.length === 0 && collectShapeElements(group, svgRoot).length === 0) {
    for (const label of extractAllTextLabels(group, svgRoot)) {
      points.push({ x: label.x, y: label.y, el: group, name: label.text });
    }
  }
  return points;
}

function nearestLabelText(x: number, y: number, labels: TextLabel[], maxDistance: number) {
  let nearest: TextLabel | undefined;
  let minDistance = Infinity;
  for (const label of labels) {
    const d = Math.hypot(x - label.x, y - label.y);
    if (d < minDistance) {
      minDistance = d;
      nearest = label;
    }
  }
  return minDistance < maxDistance ? nearest?.text : undefined;
}

/**
 * Pick the text labels used to name points: the explicit names layer, else the cities group's own
 * text, else an auto-detected names layer, else any text-bearing layer that looks like names, else
 * every label in the SVG.
 */
function resolveLabels(
  svgRoot: XmlElement,
  layers: SvgLayerInfo[],
  targetGroup: XmlElement,
  targetLayerId: string,
  explicitNameLayerId?: string
): { labels: TextLabel[]; nameLayerId?: string } {
  const layerLabels = (id?: string) => {
    const container = id ? findLayerByIdOrName(svgRoot, id) : null;
    return container ? extractAllTextLabels(container, svgRoot) : [];
  };

  let nameLayerId = explicitNameLayerId;
  let labels = layerLabels(explicitNameLayerId);

  if (labels.length === 0 && !explicitNameLayerId) {
    labels = extractAllTextLabels(targetGroup, svgRoot);
    if (labels.length > 0) {
      nameLayerId = targetLayerId;
    } else {
      nameLayerId = bestLayerId(layers, "textCount", (n) =>
        CITY_NAME_LAYER_NAMES.some((p) => n.includes(p))
      );
      labels = layerLabels(nameLayerId);
    }
  }

  for (const layer of layers) {
    if (labels.length > 0) break;
    if (layer.textCount > 0 && ANY_LABEL_LAYER_NAMES.test(normalizeLayerName(layer.name))) {
      labels = layerLabels(layer.id);
    }
  }
  return {
    labels: labels.length > 0 ? labels : extractAllTextLabels(svgRoot, svgRoot),
    nameLayerId,
  };
}

/** Points whose icon differs from the dominant (>50%) <use> icon are capitals. */
function dominantIcon(rawPoints: RawPoint[]): string | undefined {
  const counts = new Map<string, number>();
  for (const { refIcon } of rawPoints) {
    if (refIcon) counts.set(refIcon, (counts.get(refIcon) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > total * 0.5 ? top[0] : undefined;
}

function extractProvinceRefs(svgRoot: XmlElement, labels: TextLabel[]): SvgProvinceRef[] {
  const container = detectProvinceLayer(svgRoot).layer ?? svgRoot;
  const shapes = filterProvinceShapes(collectShapeElements(container, svgRoot), svgRoot);
  const refs: SvgProvinceRef[] = [];

  for (const el of shapes) {
    try {
      const outerRing = elementToRings(el)[0];
      if (!outerRing?.length) continue;
      const centroidX = outerRing.reduce((sum, [x]) => sum + x, 0) / outerRing.length;
      const centroidY = outerRing.reduce((sum, [, y]) => sum + y, 0) / outerRing.length;
      const [svgX, svgY] = applyMatrixToPoint(
        centroidX,
        centroidY,
        getAccumulatedTransform(el, svgRoot)
      );
      refs.push({
        name:
          nearestLabelText(svgX, svgY, labels, 250) ??
          detectProvinceName(el, el.getAttribute("id") || "province"),
        svgX,
        svgY,
      });
    } catch {
      // malformed or unsupported shape in the uploaded SVG — skipped
    }
  }
  return refs;
}

export function parseCitySvg(svgContent: string, opts?: ParseCitySvgOptions): ParsedCitySvg {
  const doc = new DOMParser().parseFromString(sanitizeSvg(svgContent), "image/svg+xml");
  const svgRoot = doc.documentElement;
  if (!svgRoot) {
    throw new Error("Failed to parse SVG: no root element found");
  }

  const viewBoxWidth = extractViewBoxWidth(svgRoot);
  const layers = enumerateLayers(svgRoot, viewBoxWidth);
  const targetLayerId = opts?.citiesLayerId || detectCitiesLayerId(layers);
  const targetGroup = findLayerByIdOrName(svgRoot, targetLayerId) || svgRoot;
  const rawPoints = scanPoints(targetGroup, svgRoot, viewBoxWidth);
  const { labels, nameLayerId } = resolveLabels(
    svgRoot,
    layers,
    targetGroup,
    targetLayerId,
    opts?.cityNameLayerId
  );
  const icon = dominantIcon(rawPoints);

  const points = rawPoints.map(({ x, y, el, refIcon, name }): SvgCityPoint => {
    const isCapital =
      isCapitalElement(el, opts?.capitalLayerId) || !!(icon && refIcon && refIcon !== icon);
    return {
      svgX: x,
      svgY: y,
      name: name ?? nearestLabelText(x, y, labels, 120) ?? "",
      isCapital,
    };
  });

  return {
    layers,
    points,
    svgProvinces: extractProvinceRefs(svgRoot, labels),
    detectedCitiesLayerId: targetLayerId,
    detectedCityNameLayerId: nameLayerId,
  };
}
