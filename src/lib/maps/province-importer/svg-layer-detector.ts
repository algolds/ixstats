/**
 * SVG Layer Detector
 *
 * Intelligently identifies the province/subdivision layer in an SVG
 * and filters out decorative elements (borders, text, legends, etc.).
 *
 * Supports Inkscape layer conventions (inkscape:groupmode="layer") and
 * generic group ID/label heuristics.
 */

import { SHAPE_TAGS } from "./svg-element-converter";
import {
  INKSCAPE_NS,
  SVG_NS,
  attrNumber,
  ancestorElements,
  elementChildren,
  groupName,
  styleDeclares,
  svgTag,
  type XmlElement,
} from "./svg-dom";

interface LayerCandidate {
  element: XmlElement;
  name: string;
  score: number;
  shapeCount: number;
}

/** Keywords that positively indicate a province layer. */
const PROVINCE_KEYWORDS =
  /province|subdivision|region|state|admin|district|territory|county|canton|oblast|governorate|prefecture|depart|commonwealth/i;

/** Keywords that negatively indicate a non-province layer. */
const NEGATIVE_KEYWORDS =
  /\b(text|labels?|legend|decoration|background|base|outline|title|annotation|grid|scale|compass|rose|frame|note|watermark|logo|symbol|icon|markers?|city|cities|towns?|capitals?|rivers?|lakes?|ocean|sea|water|mountains?|terrain|elevation|locator|dots?|points?|pins?|names?|foreign|external|border|boundar|energy|plate|judicial|circuit|accent|dialect|secondary|secondaries|cap[-_]?mrk|nrj)\b/i;

/** Tags that should be excluded from shape collection. */
const EXCLUDED_CONTAINERS = new Set(["defs", "clipPath", "mask", "symbol", "marker", "pattern"]);

/** Typical province count is 5-50. */
function shapeCountScore(n: number): number {
  if (n >= 10 && n <= 50) return 30;
  if (n >= 5 && n < 10) return 20;
  if (n >= 51 && n <= 100) return 15;
  if (n < 3) return -20;
  return n < 5 ? 5 : 0;
}

/**
 * Province boundaries have many vertices (50+), while marker/locator shapes have very few (~10).
 */
function vertexScore(avgVertices: number, shapeCount: number): number {
  if (avgVertices >= 50) return 30;
  if (avgVertices >= 20) return 15;
  return avgVertices < 15 && shapeCount >= 3 ? -20 : 0;
}

function scoreGroup(g: XmlElement, name: string, svgRoot: XmlElement): number {
  const shapeCount = countDirectShapeChildren(g);
  const avgVertices = shapeCount > 0 ? countTotalVertices(g) / shapeCount : 0;
  const depth = getDepthFromRoot(g, svgRoot);
  const subGroupCount = elementChildren(g).filter((c) => svgTag(c) === "g").length;
  return (
    (isInkscapeLayer(g) ? 50 : 0) +
    (name && PROVINCE_KEYWORDS.test(name) ? 40 : 0) -
    (name && NEGATIVE_KEYWORDS.test(name) ? 30 : 0) +
    shapeCountScore(shapeCount) +
    vertexScore(avgVertices, shapeCount) +
    // Province layers usually have diverse fill colors
    (shapeCount >= 3 && hasDistinctFillColors(g) ? 10 : 0) -
    (hasOnlyTextChildren(g) ? 20 : 0) -
    // Prefer top-level layers
    (depth > 3 ? 5 * (depth - 3) : 0) +
    // Groups whose children are themselves groups (each sub-group = province)
    (subGroupCount >= 3 && subGroupCount <= 50 ? 15 : 0)
  );
}

function isInkscapeLayer(g: XmlElement): boolean {
  return (
    g.getAttributeNS(INKSCAPE_NS, "groupmode") === "layer" ||
    g.getAttribute("inkscape:groupmode") === "layer"
  );
}

/**
 * Detect the most likely province layer in the SVG.
 * Returns the best candidate group, or null if no clear winner.
 */
export function detectProvinceLayer(svgRoot: XmlElement): {
  layer: XmlElement | null;
  confidence: number;
  log: string[];
} {
  const log: string[] = [];
  const candidates: LayerCandidate[] = [];

  // Parse CSS <style> blocks to detect classes with display:none
  const hiddenClasses = extractHiddenCssClasses(svgRoot);

  [...svgRoot.getElementsByTagNameNS(SVG_NS, "g")].forEach((g, i) => {
    if (isInsideExcludedContainer(g) || isHiddenByClass(g, hiddenClasses)) return;

    const name = groupName(g);
    const score = scoreGroup(g, name, svgRoot);
    if (score > 0 || isInkscapeLayer(g)) {
      candidates.push({
        element: g,
        name: name || `(unnamed group #${i})`,
        score,
        shapeCount: countDirectShapeChildren(g),
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    log.push(
      `Layer candidates: ${candidates.map((c) => `${c.name}(score=${c.score}, shapes=${c.shapeCount})`).join(", ")}`
    );
  }

  let best = candidates[0];

  // A best candidate with very few shapes loses to one with many more (likely the real province layer)
  if (best && best.shapeCount < 5) {
    const betterByShapes = candidates.find((c) => c.shapeCount >= 10 && c.score >= 20);
    if (betterByShapes) {
      log.push(
        `Overriding "${best.name}" (${best.shapeCount} shapes) with "${betterByShapes.name}" (${betterByShapes.shapeCount} shapes)`
      );
      best = betterByShapes;
    }
  }

  if (best && best.score >= 20) {
    log.push(
      `Selected province layer: "${best.name}" (score=${best.score}, shapes=${best.shapeCount})`
    );
    return { layer: best.element, confidence: Math.min(best.score / 100, 1.0), log };
  }

  // Last resort: the group with the most filled shapes (>= 5)
  const fallback = candidates
    .filter((c) => c.shapeCount >= 5)
    .sort((a, b) => b.shapeCount - a.shapeCount)[0];
  if (fallback) {
    log.push(
      `Fallback to highest-shape-count layer: "${fallback.name}" (${fallback.shapeCount} shapes)`
    );
    return { layer: fallback.element, confidence: 0.3, log };
  }

  log.push("No clear province layer detected, using SVG root");
  return { layer: null, confidence: 0, log };
}

/** Well-known topographic/elevation color palettes (earth tones, green-to-brown gradients). */
const TOPO_COLORS = new Set([
  "#a8c995",
  "#c3d3a1",
  "#dcdcac",
  "#f7e6b8",
  "#dac497",
  "#bea276",
  "#9c7b50",
  "#8b7142",
  "#6b5b3a",
  "#4a3b2a",
  "#e8e4c9",
  "#d4c79f",
  "#c4b07a",
  "#b49a5e",
]);

/** Water/ocean colors. */
const WATER_COLORS = new Set([
  "#dfeff9",
  "#c6ecff",
  "#aad4f5",
  "#89c0e8",
  "#6bb0d9",
  "#246a9b",
  "#246a9c",
  "#1a5276",
  "#0099ff",
  "#0066cc",
]);

const BLACK_OR_WHITE = new Set(["#000000", "#ffffff", "#fff", "black", "white"]);

/**
 * Classify shapes into province candidates vs non-province (topo/water/decorative).
 * Returns only the elements that look like province fills.
 */
export function filterProvinceShapes(
  shapes: XmlElement[],
  svgRoot: XmlElement,
  log: string[] = []
): XmlElement[] {
  if (shapes.length === 0) return [];

  const shapeInfo = shapes.map((el) => {
    const style = el.getAttribute("style") || "";
    const fill = extractStyleProp(style, "fill") || el.getAttribute("fill") || "";
    return {
      el,
      fill: normalizeColor(fill),
      stroke: normalizeColor(extractStyleProp(style, "stroke") || el.getAttribute("stroke") || ""),
      fillNone: fill === "none" || styleDeclares(style, "fill", "none"),
    };
  });

  const fillCounts = new Map<string, number>();
  for (const s of shapeInfo) {
    if (!s.fillNone && s.fill) fillCounts.set(s.fill, (fillCounts.get(s.fill) ?? 0) + 1);
  }
  const fillColors = [...fillCounts.keys()].sort((a, b) => fillCounts.get(b)! - fillCounts.get(a)!);
  const strokeColors = new Set(shapeInfo.map((s) => s.stroke).filter((s) => s && s !== "none"));

  log.push(
    `Shape analysis: ${shapes.length} shapes, ${fillCounts.size} fill colors, ${strokeColors.size} stroke colors`
  );

  const topoFills = new Set<string>();
  const waterFills = new Set<string>();
  const provinceFills = new Set<string>();
  for (const color of fillColors) {
    if (TOPO_COLORS.has(color) || isEarthTone(color)) topoFills.add(color);
    else if (WATER_COLORS.has(color) || isBlueish(color)) waterFills.add(color);
    else if (!BLACK_OR_WHITE.has(color)) provinceFills.add(color);
  }

  // Many topo colors (4+) means a topo map: drop the topo fills and keep the province-colored shapes.
  const hasManyTopoColors = topoFills.size >= 4;
  if (hasManyTopoColors && provinceFills.size > 0) {
    log.push(
      `Topo map detected: ${topoFills.size} topo fills, ${provinceFills.size} province fills. Filtering to province colors.`
    );
  }

  const result = shapeInfo
    .filter(
      (s) =>
        // stroke-only, water, topo (on topo maps) and black/white fills (borders, masks) are not provinces
        !s.fillNone &&
        !waterFills.has(s.fill) &&
        !(hasManyTopoColors && topoFills.has(s.fill)) &&
        !BLACK_OR_WHITE.has(s.fill)
    )
    .map((s) => s.el);

  if (topoFills.size > 0) {
    log.push(`Excluded topo colors: ${[...topoFills].join(", ")}`);
  }
  if (waterFills.size > 0) {
    log.push(`Excluded water colors: ${[...waterFills].join(", ")}`);
  }
  log.push(
    `Province filter: ${shapes.length} → ${result.length} shapes (excluded ${topoFills.size} topo colors, ${waterFills.size} water colors)`
  );

  return result;
}

function rgbOf(hex: string): [number, number, number] | null {
  const norm = normalizeColor(hex);
  if (!norm.startsWith("#") || norm.length < 7) return null;
  return [1, 3, 5].map((i) => parseInt(norm.slice(i, i + 2), 16)) as [number, number, number];
}

/** Earth tones: warm/muted brown, tan and olive (r > g > b). */
function isEarthTone(hex: string): boolean {
  const rgb = rgbOf(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r > 100 && g > 80 && b < g && r - b > 40 && g < 220;
}

function isBlueish(hex: string): boolean {
  const rgb = rgbOf(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return b > r && b > g && b > 100;
}

/** Extract a CSS property from an inline style string. */
function extractStyleProp(style: string, prop: string): string {
  return style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`))?.[1]?.trim() ?? "";
}

/**
 * Normalize a color value to a lowercase 6-char hex string: "#abc" and "rgb(170,187,204)" /
 * "rgba(...)" become "#aabbcc"; named colors pass through lowercased.
 */
function normalizeColor(color: string): string {
  const trimmed = color.trim().toLowerCase();

  const rgbMatch = trimmed.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const hex = rgbMatch
      .slice(1, 4)
      .map((c) => Math.min(255, parseInt(c, 10)).toString(16).padStart(2, "0"));
    return `#${hex.join("")}`;
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }

  return trimmed;
}

/**
 * Recursively collect all shape elements within a container.
 * Excludes elements inside <defs>, <clipPath>, <mask>, <symbol>.
 * Excludes elements with display:none or visibility:hidden (including CSS class-based hiding).
 */
export function collectShapeElements(container: XmlElement, svgRoot?: XmlElement): XmlElement[] {
  const shapes: XmlElement[] = [];
  const hiddenClasses = extractHiddenCssClasses(
    svgRoot ?? container.ownerDocument?.documentElement ?? container
  );
  collectShapesRecursive(container, shapes, hiddenClasses);
  return shapes;
}

function collectShapesRecursive(
  el: XmlElement,
  result: XmlElement[],
  hiddenClasses: Set<string>
): void {
  for (const child of elementChildren(el)) {
    const tag = svgTag(child);
    if (EXCLUDED_CONTAINERS.has(tag)) continue;
    if (isHiddenElement(child) || isHiddenByClass(child, hiddenClasses)) continue;

    if (SHAPE_TAGS.has(tag)) {
      if (!isDecorativeElement(child, tag)) result.push(child);
    } else if (tag === "g" || tag === "svg") {
      collectShapesRecursive(child, result, hiddenClasses);
    }
  }
}

const NUMBER_RE = /[-+]?\d*\.?\d+/g;

function viewBoxSize(el: XmlElement): [number, number] | null {
  const vb = el.ownerDocument?.documentElement?.getAttribute("viewBox");
  const parts = vb?.split(/[\s,]+/).map(Number);
  return parts && parts.length >= 4 ? [parts[2]!, parts[3]!] : null;
}

/** Bounding-box area of a rect's width/height, or of a polygon's points (0 if under two points). */
function shapeArea(el: XmlElement, tag: string): number {
  if (tag === "rect") return attrNumber(el, "width") * attrNumber(el, "height");
  const nums = (el.getAttribute("points") ?? "").match(NUMBER_RE);
  if (!nums || nums.length < 4) return 0;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let k = 0; k < nums.length - 1; k += 2) {
    xs.push(parseFloat(nums[k]!));
    ys.push(parseFloat(nums[k + 1]!));
  }
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

/** Full-canvas rectangles are backgrounds; rects/polygons under 1% of the viewBox are markers. */
function isBackgroundOrMarkerShape(el: XmlElement, tag: string): boolean {
  const vb = viewBoxSize(el);
  if (!vb || (tag !== "rect" && tag !== "polygon")) return false;
  const [vbW, vbH] = vb;
  if (
    tag === "rect" &&
    attrNumber(el, "width") >= vbW * 0.9 &&
    attrNumber(el, "height") >= vbH * 0.9
  ) {
    return true;
  }
  const area = shapeArea(el, tag);
  return vbW * vbH > 0 && area > 0 && area < vbW * vbH * 0.01;
}

/**
 * Check if an element is likely decorative (thin border, invisible, background, tiny marker).
 * Province shapes MUST have a visible fill - stroke-only elements are borders/lines.
 */
function isDecorativeElement(el: XmlElement, tag: string): boolean {
  const style = el.getAttribute("style") || "";
  const fill = el.getAttribute("fill") || "";
  const fillNone = fill === "none" || styleDeclares(style, "fill", "none");
  const strokeNone = el.getAttribute("stroke") === "none" || styleDeclares(style, "stroke", "none");
  if (fillNone && strokeNone) return true;

  // Polylines need >= 4 points to be province boundaries
  if (tag === "polyline") return (el.getAttribute("points")?.match(NUMBER_RE)?.length ?? 0) < 8;

  if (fillNone || (!fill && !style.includes("fill"))) return true;

  // Small circles/ellipses are city markers and pins
  if ((tag === "circle" || tag === "ellipse") && attrNumber(el, "r", "rx") < 5) return true;

  if (isBackgroundOrMarkerShape(el, tag)) return true;

  // White fill with no stroke is likely a mask
  return ["#ffffff", "#fff", "white"].includes(fill) && strokeNone;
}

function countDirectShapeChildren(g: XmlElement): number {
  return elementChildren(g).filter((c) => SHAPE_TAGS.has(svgTag(c))).length;
}

const FIXED_VERTEX_COUNTS: Record<string, number> = { rect: 4, circle: 32, ellipse: 32 };

function shapeVertexCount(el: XmlElement, tag: string): number {
  if (tag === "polygon" || tag === "polyline") {
    return (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).length / 2;
  }
  // Rough estimate: each path command letter typically adds a vertex
  if (tag === "path") return (el.getAttribute("d")?.match(/[MLCQSATZHVmlcqsatzhv]/g) ?? []).length;
  return FIXED_VERTEX_COUNTS[tag] ?? 0;
}

/** Total vertices across all direct shape children (complex boundaries vs simple markers). */
function countTotalVertices(g: XmlElement): number {
  return elementChildren(g)
    .filter((c) => SHAPE_TAGS.has(svgTag(c)))
    .reduce((total, c) => total + shapeVertexCount(c, svgTag(c)), 0);
}

function hasDistinctFillColors(g: XmlElement): boolean {
  const colors = new Set<string>();
  for (const child of elementChildren(g)) {
    const fill =
      child.getAttribute("fill") || extractStyleProp(child.getAttribute("style") || "", "fill");
    if (fill && fill !== "none") colors.add(fill.toLowerCase());
    if (colors.size >= 3) return true;
  }
  return false;
}

function hasOnlyTextChildren(g: XmlElement): boolean {
  const children = elementChildren(g);
  return children.length > 0 && children.every((c) => ["text", "tspan"].includes(svgTag(c)));
}

function isHiddenElement(el: XmlElement): boolean {
  const style = el.getAttribute("style") || "";
  return (
    el.getAttribute("display") === "none" ||
    el.getAttribute("visibility") === "hidden" ||
    styleDeclares(style, "display", "none") ||
    styleDeclares(style, "visibility", "hidden")
  );
}

function isInsideExcludedContainer(el: XmlElement): boolean {
  return ancestorElements(el).some((a) => EXCLUDED_CONTAINERS.has(svgTag(a)));
}

function getDepthFromRoot(el: XmlElement, root: XmlElement): number {
  const ancestors = ancestorElements(el);
  const idx = ancestors.indexOf(root);
  return idx === -1 ? ancestors.length : idx;
}

/** Parse <style> blocks inside the SVG for CSS classes with display:none (names without the dot). */
function extractHiddenCssClasses(svgRoot: XmlElement): Set<string> {
  const hiddenClasses = new Set<string>();
  for (const style of svgRoot.getElementsByTagName("style")) {
    // Rules like ".st0, .st1, .st6 { ... display: none ... }"
    for (const [, selectors, body] of (style.textContent ?? "").matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/display\s*:\s*none/i.test(body!)) continue;
      for (const [, name] of selectors!.matchAll(/\.([a-zA-Z_][\w-]*)/g)) hiddenClasses.add(name!);
    }
  }
  return hiddenClasses;
}

/** Check if an element has any CSS class that is marked display:none in the stylesheet. */
function isHiddenByClass(el: XmlElement, hiddenClasses: Set<string>): boolean {
  if (hiddenClasses.size === 0) return false;
  return (el.getAttribute("class") ?? "").split(/\s+/).some((c) => hiddenClasses.has(c));
}
