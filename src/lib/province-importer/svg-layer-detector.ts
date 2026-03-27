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

const SVG_NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

// ──────────────────────────────────────────────
// Layer detection
// ──────────────────────────────────────────────

interface LayerCandidate {
  element: Element;
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

/**
 * Detect the most likely province layer in the SVG.
 * Returns the best candidate group, or null if no clear winner.
 */
export function detectProvinceLayer(svgRoot: Element): {
  layer: Element | null;
  confidence: number;
  log: string[];
} {
  const log: string[] = [];
  const candidates: LayerCandidate[] = [];

  // Parse CSS <style> blocks to detect classes with display:none
  const hiddenClasses = extractHiddenCssClasses(svgRoot);

  const allGroups = svgRoot.getElementsByTagNameNS(SVG_NS, "g");

  for (let i = 0; i < allGroups.length; i++) {
    const g = allGroups[i]!;

    // Skip groups inside excluded containers
    if (isInsideExcludedContainer(g)) continue;

    const name = getGroupName(g);
    const isInkscapeLayer =
      g.getAttributeNS(INKSCAPE_NS, "groupmode") === "layer" ||
      g.getAttribute("inkscape:groupmode") === "layer";

    // Skip groups hidden via CSS class (e.g. .st6 { display: none })
    if (isHiddenByClass(g, hiddenClasses)) continue;

    let score = 0;

    // Inkscape layer bonus
    if (isInkscapeLayer) score += 50;

    // Keyword matching on name
    if (name && PROVINCE_KEYWORDS.test(name)) score += 40;
    if (name && NEGATIVE_KEYWORDS.test(name)) score -= 30;

    // Count direct shape children
    const shapeCount = countDirectShapeChildren(g);

    // Sweet spot: typical province count is 5-50
    if (shapeCount >= 10 && shapeCount <= 50) score += 30;
    else if (shapeCount >= 5 && shapeCount < 10) score += 20;
    else if (shapeCount >= 51 && shapeCount <= 100) score += 15;
    else if (shapeCount < 3) score -= 20;
    else if (shapeCount >= 3 && shapeCount < 5) score += 5;

    // Vertex complexity: province boundaries have many vertices (50+),
    // while marker/locator shapes have very few (~10). This is a strong
    // signal to distinguish actual boundaries from decorative elements.
    const avgVertices = shapeCount > 0 ? countTotalVertices(g) / shapeCount : 0;
    if (avgVertices >= 50) score += 30;       // complex shapes — very likely boundaries
    else if (avgVertices >= 20) score += 15;  // moderately complex
    else if (avgVertices < 15 && shapeCount >= 3) score -= 20; // simple shapes — likely markers/icons

    // Check if children have diverse fill colors (province layers usually do)
    if (shapeCount >= 3 && hasDistinctFillColors(g)) score += 10;

    // Penalize if all children are <text> elements
    if (hasOnlyTextChildren(g)) score -= 20;

    // Penalize deeply nested groups (prefer top-level layers)
    const depth = getDepthFromRoot(g, svgRoot);
    if (depth > 3) score -= 5 * (depth - 3);

    // Also consider groups whose children are themselves groups (each sub-group = province)
    const subGroupCount = countDirectGroupChildren(g);
    if (subGroupCount >= 3 && subGroupCount <= 50) score += 15;

    if (score > 0 || isInkscapeLayer) {
      candidates.push({ element: g, name: name || `(unnamed group #${i})`, score, shapeCount });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    log.push(`Layer candidates: ${candidates.map((c) => `${c.name}(score=${c.score}, shapes=${c.shapeCount})`).join(", ")}`);
  }

  let best = candidates[0];

  // If the best candidate has very few shapes (<5) but there's a candidate
  // with many more shapes, prefer the one with more shapes (likely the real province layer)
  if (best && best.shapeCount < 5) {
    const betterByShapes = candidates.find(c => c.shapeCount >= 10 && c.score >= 20);
    if (betterByShapes) {
      log.push(`Overriding "${best.name}" (${best.shapeCount} shapes) with "${betterByShapes.name}" (${betterByShapes.shapeCount} shapes)`);
      best = betterByShapes;
    }
  }

  if (best && best.score >= 20) {
    log.push(`Selected province layer: "${best.name}" (score=${best.score}, shapes=${best.shapeCount})`);
    return { layer: best.element, confidence: Math.min(best.score / 100, 1.0), log };
  }

  // Last resort: find the group with the most filled shapes (>= 5)
  const byShapeCount = candidates
    .filter(c => c.shapeCount >= 5)
    .sort((a, b) => b.shapeCount - a.shapeCount);
  if (byShapeCount.length > 0) {
    const fallback = byShapeCount[0]!;
    log.push(`Fallback to highest-shape-count layer: "${fallback.name}" (${fallback.shapeCount} shapes)`);
    return { layer: fallback.element, confidence: 0.3, log };
  }

  log.push("No clear province layer detected, using SVG root");
  return { layer: null, confidence: 0, log };
}

// ──────────────────────────────────────────────
// Color-based province shape classification
// ──────────────────────────────────────────────

/** Well-known topographic/elevation color palettes (earth tones, green-to-brown gradients). */
const TOPO_COLORS = new Set([
  "#a8c995", "#c3d3a1", "#dcdcac", "#f7e6b8", "#dac497",
  "#bea276", "#9c7b50", "#8b7142", "#6b5b3a", "#4a3b2a",
  "#e8e4c9", "#d4c79f", "#c4b07a", "#b49a5e",
]);

/** Water/ocean colors. */
const WATER_COLORS = new Set([
  "#dfeff9", "#c6ecff", "#aad4f5", "#89c0e8", "#6bb0d9",
  "#246a9b", "#246a9c", "#1a5276", "#0099ff", "#0066cc",
]);

/** Common province fill colors (neutral, pastel, or distinctive). */
const PROVINCE_FILL_PATTERNS = [
  /^#f[0-9a-f]{5}$/i,   // Light pastels (f-prefix)
  /^#e[0-9a-f]{5}$/i,   // Light greys/pastels
  /^#d[0-9a-f]{5}$/i,   // Mid-light
];

/**
 * Classify shapes into province candidates vs non-province (topo/water/decorative).
 * Returns only the elements that look like province fills.
 */
export function filterProvinceShapes(
  shapes: Element[],
  svgRoot: Element,
  log: string[] = [],
): Element[] {
  if (shapes.length === 0) return [];

  // Collect fill and stroke info for all shapes
  const shapeInfo: Array<{
    el: Element;
    fill: string;
    stroke: string;
    strokeWidth: number;
    fillNone: boolean;
  }> = [];

  for (const el of shapes) {
    const style = el.getAttribute("style") || "";
    const fill = extractStyleProp(style, "fill") || el.getAttribute("fill") || "";
    const stroke = extractStyleProp(style, "stroke") || el.getAttribute("stroke") || "";
    const swStr = extractStyleProp(style, "stroke-width") || el.getAttribute("stroke-width") || "0";
    const sw = parseFloat(swStr.replace(/[^0-9.]/g, "")) || 0;
    const fillNone = fill === "none" || style.includes("fill:none") || style.includes("fill: none");

    shapeInfo.push({
      el,
      fill: normalizeColor(fill),
      stroke: normalizeColor(stroke),
      strokeWidth: sw,
      fillNone,
    });
  }

  // Count fill colors
  const fillCounts = new Map<string, number>();
  for (const s of shapeInfo) {
    if (!s.fillNone && s.fill) {
      fillCounts.set(s.fill, (fillCounts.get(s.fill) ?? 0) + 1);
    }
  }

  // Count stroke colors
  const strokeCounts = new Map<string, number>();
  for (const s of shapeInfo) {
    if (s.stroke && s.stroke !== "none") {
      strokeCounts.set(s.stroke, (strokeCounts.get(s.stroke) ?? 0) + 1);
    }
  }

  log.push(`Shape analysis: ${shapes.length} shapes, ${fillCounts.size} fill colors, ${strokeCounts.size} stroke colors`);

  // Identify the dominant fill colors (province fills tend to be 1-3 dominant colors)
  const sortedFills = [...fillCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Classify each fill color
  const topoFills = new Set<string>();
  const waterFills = new Set<string>();
  const provinceFills = new Set<string>();

  for (const [color, count] of sortedFills) {
    const isTopoColor = TOPO_COLORS.has(color) || isEarthTone(color);
    const isWaterColor = WATER_COLORS.has(color) || isBlueish(color);
    const isBlackOrWhite = color === "#000000" || color === "#ffffff" || color === "#fff" || color === "black" || color === "white";

    if (isTopoColor) {
      topoFills.add(color);
    } else if (isWaterColor) {
      waterFills.add(color);
    } else if (!isBlackOrWhite) {
      provinceFills.add(color);
    }
  }

  // Heuristic: if we have many topo colors (5+) and few province colors,
  // this is likely a topo map. Use the province-colored shapes only.
  const hasManyTopoColors = topoFills.size >= 4;
  const hasFewProvinceColors = provinceFills.size <= 5;

  if (hasManyTopoColors && provinceFills.size > 0) {
    log.push(`Topo map detected: ${topoFills.size} topo fills, ${provinceFills.size} province fills. Filtering to province colors.`);
  }

  // If no clear province colors but we have topo colors,
  // check for shapes with uniform stroke (black border) — those are province outlines on topo
  const dominantStroke = strokeCounts.size > 0
    ? [...strokeCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    : null;

  // Filter shapes
  const result: Element[] = [];
  for (const s of shapeInfo) {
    // Always exclude stroke-only (no fill)
    if (s.fillNone) continue;

    // Exclude water fills
    if (waterFills.has(s.fill)) continue;

    // If topo map detected, exclude topo fills
    if (hasManyTopoColors && topoFills.has(s.fill)) continue;

    // Exclude black/white fills (borders, masks)
    if (s.fill === "#000000" || s.fill === "#ffffff" || s.fill === "#fff" || s.fill === "black" || s.fill === "white") continue;

    result.push(s.el);
  }

  if (topoFills.size > 0) {
    log.push(`Excluded topo colors: ${[...topoFills].join(", ")}`);
  }
  if (waterFills.size > 0) {
    log.push(`Excluded water colors: ${[...waterFills].join(", ")}`);
  }
  log.push(`Province filter: ${shapes.length} → ${result.length} shapes (excluded ${topoFills.size} topo colors, ${waterFills.size} water colors)`);

  return result;
}

/** Check if a hex color is an earth tone (brown/tan/olive spectrum). */
function isEarthTone(hex: string): boolean {
  const norm = normalizeColor(hex);
  if (!norm.startsWith("#") || norm.length < 7) return false;
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  // Earth tones: r > g > b, warm/muted colors
  return r > 100 && g > 80 && b < g && (r - b) > 40 && g < 220;
}

/** Check if a hex color is blueish (water). */
function isBlueish(hex: string): boolean {
  const norm = normalizeColor(hex);
  if (!norm.startsWith("#") || norm.length < 7) return false;
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return b > r && b > g && b > 100;
}

/** Extract a CSS property from an inline style string. */
function extractStyleProp(style: string, prop: string): string {
  const match = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`));
  return match ? match[1]!.trim() : "";
}

/**
 * Normalize a color value to a 6-char lowercase hex string.
 * Handles:
 *   - 3-char hex: "#abc" → "#aabbcc"
 *   - 6-char hex: "#aabbcc" → "#aabbcc"
 *   - rgb(): "rgb(170,187,204)" → "#aabbcc"
 *   - rgba(): "rgba(170,187,204,0.5)" → "#aabbcc"
 *   - Named colors: passed through unchanged
 */
export function normalizeColor(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Handle rgb(r,g,b) and rgba(r,g,b,a)
  const rgbMatch = trimmed.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1]!, 10));
    const g = Math.min(255, parseInt(rgbMatch[2]!, 10));
    const b = Math.min(255, parseInt(rgbMatch[3]!, 10));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // Handle 3-char hex → 6-char hex
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const r = trimmed[1]!, g = trimmed[2]!, b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  // Already 6-char hex or named color — return as-is (lowercased)
  return trimmed;
}

// ──────────────────────────────────────────────
// Shape collection
// ──────────────────────────────────────────────

/**
 * Recursively collect all shape elements within a container.
 * Excludes elements inside <defs>, <clipPath>, <mask>, <symbol>.
 * Excludes elements with display:none or visibility:hidden (including CSS class-based hiding).
 */
export function collectShapeElements(container: Element, svgRoot?: Element): Element[] {
  const shapes: Element[] = [];
  const hiddenClasses = extractHiddenCssClasses(svgRoot ?? container.ownerDocument?.documentElement ?? container);
  collectShapesRecursive(container, shapes, hiddenClasses);
  return shapes;
}

function collectShapesRecursive(el: Element, result: Element[], hiddenClasses: Set<string>): void {
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue; // Element nodes only

    const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";

    // Skip excluded containers entirely
    if (EXCLUDED_CONTAINERS.has(tag)) continue;

    // Skip hidden elements (inline or CSS class-based)
    if (isHiddenElement(child) || isHiddenByClass(child, hiddenClasses)) continue;

    if (SHAPE_TAGS.has(tag)) {
      // Skip decorative elements
      if (!isDecorativeElement(child)) {
        result.push(child);
      }
    } else if (tag === "g" || tag === "svg") {
      // Recurse into groups
      collectShapesRecursive(child, result, hiddenClasses);
    }
  }
}

/**
 * Check if an element is likely decorative (thin border, invisible, etc.).
 * Province shapes MUST have a visible fill — stroke-only elements are borders/lines.
 */
export function isDecorativeElement(el: Element): boolean {
  const style = el.getAttribute("style") || "";
  const fill = el.getAttribute("fill") || "";
  const stroke = el.getAttribute("stroke") || "";
  const strokeWidth = el.getAttribute("stroke-width") || "";
  const tag = el.localName ?? el.tagName?.split(":").pop() ?? "";

  // Invisible: fill="none" AND stroke="none"
  const fillNone = fill === "none" || style.includes("fill:none") || style.includes("fill: none");
  const strokeNone = stroke === "none" || style.includes("stroke:none") || style.includes("stroke: none");
  if (fillNone && strokeNone) return true;

  // Lines are always decorative (borders, not regions)
  if (tag === "line") return true;

  // Polylines with fewer than 4 points are decorative; those with >= 4 could be province boundaries
  if (tag === "polyline") {
    const points = el.getAttribute("points") ?? "";
    const matches = points.match(/[-+]?\d*\.?\d+/g);
    const pointCount = matches ? Math.floor(matches.length / 2) : 0;
    if (pointCount < 4) return true;
    // Polyline with enough points — not decorative, could be a boundary
    return false;
  }

  // Stroke-only elements with no fill — borders/outlines, not province shapes
  const fillIsNone = fillNone || (!fill && !style.includes("fill"));
  if (fillIsNone) return true;

  // Circles/ellipses with small radius are likely markers/dots
  if (tag === "circle" || tag === "ellipse") {
    const r = parseFloat(el.getAttribute("r") ?? el.getAttribute("rx") ?? "0");
    if (r < 5) return true; // Small dots — city markers, pins
  }

  // Rectangles covering the full canvas are backgrounds
  if (tag === "rect") {
    const w = parseFloat(el.getAttribute("width") ?? "0");
    const h = parseFloat(el.getAttribute("height") ?? "0");
    // If width or height matches viewBox, likely a background
    const parentSvg = el.ownerDocument?.documentElement;
    if (parentSvg) {
      const vb = parentSvg.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length >= 4) {
          const vbW = parts[2]!, vbH = parts[3]!;
          if (w >= vbW * 0.9 && h >= vbH * 0.9) return true; // Background rect
        }
      }
    }
  }

  // Very small rect/polygon elements (bounding box < 1% of viewBox) are likely markers
  if (tag === "rect" || tag === "polygon") {
    const parentSvg = el.ownerDocument?.documentElement;
    if (parentSvg) {
      const vb = parentSvg.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length >= 4) {
          const vbArea = parts[2]! * parts[3]!;
          if (vbArea > 0) {
            let elArea = 0;
            if (tag === "rect") {
              const w = parseFloat(el.getAttribute("width") ?? "0");
              const h = parseFloat(el.getAttribute("height") ?? "0");
              elArea = w * h;
            } else {
              // polygon: compute bounding box area from points
              const pts = el.getAttribute("points") ?? "";
              const nums = pts.match(/[-+]?\d*\.?\d+/g);
              if (nums && nums.length >= 4) {
                let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
                for (let k = 0; k < nums.length - 1; k += 2) {
                  const px = parseFloat(nums[k]!);
                  const py = parseFloat(nums[k + 1]!);
                  if (px < pMinX) pMinX = px;
                  if (px > pMaxX) pMaxX = px;
                  if (py < pMinY) pMinY = py;
                  if (py > pMaxY) pMaxY = py;
                }
                elArea = (pMaxX - pMinX) * (pMaxY - pMinY);
              }
            }
            if (elArea > 0 && elArea < vbArea * 0.01) return true;
          }
        }
      }
    }
  }

  // White or near-white fills are likely backgrounds/masks
  if (fill === "#ffffff" || fill === "#fff" || fill === "white") {
    // Could be a province, but combined with no stroke it's likely a mask
    if (strokeNone) return true;
  }

  return false;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getGroupName(g: Element): string {
  return (
    g.getAttributeNS(INKSCAPE_NS, "label") ||
    g.getAttribute("inkscape:label") ||
    g.getAttribute("data-name") ||
    g.getAttribute("id") ||
    ""
  );
}

function countDirectShapeChildren(g: Element): number {
  let count = 0;
  const children = g.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
    if (SHAPE_TAGS.has(tag)) count++;
  }
  return count;
}

/**
 * Count total vertices across all direct shape children.
 * Used to distinguish complex province boundaries from simple markers/icons.
 */
function countTotalVertices(g: Element): number {
  let total = 0;
  const children = g.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
    if (!SHAPE_TAGS.has(tag)) continue;

    if (tag === "polygon" || tag === "polyline") {
      const pts = child.getAttribute("points") ?? "";
      // Count coordinate pairs (separated by spaces/commas)
      total += pts.trim().split(/[\s,]+/).length / 2;
    } else if (tag === "path") {
      const d = child.getAttribute("d") ?? "";
      // Rough estimate: count command letters (each typically adds a vertex)
      total += (d.match(/[MLCQSATZHVmlcqsatzhv]/g) ?? []).length;
    } else if (tag === "rect") {
      total += 4;
    } else if (tag === "circle" || tag === "ellipse") {
      total += 32; // Approximate circle as 32 segments
    } else if (tag === "line") {
      total += 2;
    }
  }
  return total;
}

function countDirectGroupChildren(g: Element): number {
  let count = 0;
  const children = g.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
    if (tag === "g") count++;
  }
  return count;
}

function hasDistinctFillColors(g: Element): boolean {
  const colors = new Set<string>();
  const children = g.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    const fill = child.getAttribute("fill") || extractFillFromStyle(child);
    if (fill && fill !== "none") colors.add(fill.toLowerCase());
    if (colors.size >= 3) return true; // 3+ distinct colors = likely provinces
  }
  return false;
}

function extractFillFromStyle(el: Element): string {
  const style = el.getAttribute("style") || "";
  const match = style.match(/fill\s*:\s*([^;]+)/);
  return match ? match[1]!.trim() : "";
}

function hasOnlyTextChildren(g: Element): boolean {
  const children = g.childNodes;
  let hasAny = false;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    hasAny = true;
    const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
    if (tag !== "text" && tag !== "tspan") return false;
  }
  return hasAny;
}

function isHiddenElement(el: Element): boolean {
  const display = el.getAttribute("display");
  if (display === "none") return true;
  const visibility = el.getAttribute("visibility");
  if (visibility === "hidden") return true;
  const style = el.getAttribute("style") || "";
  if (style.includes("display:none") || style.includes("display: none")) return true;
  if (style.includes("visibility:hidden") || style.includes("visibility: hidden")) return true;
  return false;
}

function isInsideExcludedContainer(el: Element): boolean {
  let current = el.parentNode as Element | null;
  while (current) {
    const tag = current.localName ?? current.tagName?.split(":").pop() ?? "";
    if (EXCLUDED_CONTAINERS.has(tag)) return true;
    current = current.parentNode as Element | null;
  }
  return false;
}

function getDepthFromRoot(el: Element, root: Element): number {
  let depth = 0;
  let current = el.parentNode as Element | null;
  while (current && current !== root) {
    depth++;
    current = current.parentNode as Element | null;
  }
  return depth;
}

function parseStrokeWidthFromStyle(style: string): number {
  const match = style.match(/stroke-width\s*:\s*([\d.]+)/);
  return match ? parseFloat(match[1]!) : 0;
}

/**
 * Parse <style> blocks inside the SVG to find CSS classes with display:none.
 * Returns a Set of class names (without the leading dot).
 */
function extractHiddenCssClasses(svgRoot: Element): Set<string> {
  const hiddenClasses = new Set<string>();
  const styleElements = svgRoot.getElementsByTagName("style");

  for (let i = 0; i < styleElements.length; i++) {
    const css = styleElements[i]!.textContent ?? "";

    // Match rules like ".st0, .st1, .st6 { ... display: none ... }"
    // Simple regex: find selectors + block pairs
    const rulePattern = /([^{}]+)\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = rulePattern.exec(css)) !== null) {
      const selectors = match[1]!;
      const body = match[2]!;
      if (/display\s*:\s*none/i.test(body)) {
        // Extract class names from the selector list
        const classPattern = /\.([a-zA-Z_][\w-]*)/g;
        let classMatch: RegExpExecArray | null;
        while ((classMatch = classPattern.exec(selectors)) !== null) {
          hiddenClasses.add(classMatch[1]!);
        }
      }
    }
  }

  return hiddenClasses;
}

/**
 * Check if an element has any CSS class that is marked display:none in the stylesheet.
 */
function isHiddenByClass(el: Element, hiddenClasses: Set<string>): boolean {
  if (hiddenClasses.size === 0) return false;
  const className = el.getAttribute("class") ?? "";
  if (!className) return false;
  const classes = className.split(/\s+/);
  return classes.some((c) => hiddenClasses.has(c));
}
