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
  /province|subdivision|region|state|admin|boundar|border|district|territory|county|canton|oblast|governorate|prefecture|depart/i;

/** Keywords that negatively indicate a non-province layer. */
const NEGATIVE_KEYWORDS =
  /\b(text|labels?|legend|decoration|background|base|outline|title|annotation|grid|scale|compass|rose|frame|note|watermark|logo|symbol|icon|markers?|city|cities|towns?|capitals?|rivers?|lakes?|ocean|sea|water|mountains?|terrain|elevation|locator|dots?|points?|pins?|names?)\b/i;

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

    // Sweet spot: typical province count is 3-50
    if (shapeCount >= 3 && shapeCount <= 50) score += 20;
    else if (shapeCount >= 51 && shapeCount <= 100) score += 10;
    else if (shapeCount < 3) score -= 10;

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

  const best = candidates[0];
  if (best && best.score >= 30) {
    log.push(`Selected province layer: "${best.name}" (score=${best.score})`);
    return { layer: best.element, confidence: Math.min(best.score / 100, 1.0), log };
  }

  log.push("No clear province layer detected, using SVG root");
  return { layer: null, confidence: 0, log };
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
 */
export function isDecorativeElement(el: Element): boolean {
  const style = el.getAttribute("style") || "";
  const fill = el.getAttribute("fill") || "";
  const stroke = el.getAttribute("stroke") || "";
  const strokeWidth = el.getAttribute("stroke-width") || "";

  // Invisible: fill="none" AND stroke="none"
  const fillNone = fill === "none" || style.includes("fill:none") || style.includes("fill: none");
  const strokeNone = stroke === "none" || style.includes("stroke:none") || style.includes("stroke: none");
  if (fillNone && strokeNone) return true;

  // Very thin stroke with no fill — likely a border/grid line
  const fillIsNone = fillNone || (!fill && !style.includes("fill"));
  if (fillIsNone) {
    const sw = parseFloat(strokeWidth) || parseStrokeWidthFromStyle(style);
    if (sw > 0 && sw < 0.5) return true;
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
