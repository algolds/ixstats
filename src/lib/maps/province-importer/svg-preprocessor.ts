/**
 * SVG Preprocessor — normalizes and cleans SVG before province parsing.
 *
 * Pipeline:
 * 1. Strip non-visual elements (defs, metadata, scripts, comments)
 * 2. Normalize viewBox (ensure it exists, standardize coordinate space)
 * 3. Remove tiny fragments (shapes too small to be provinces)
 * 4. Fix self-intersecting rings
 * 5. Merge same-color adjacent shapes into single provinces
 *
 * Server-side only (uses @xmldom/xmldom).
 */

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Position } from "geojson";

export interface PreprocessResult {
  /** Cleaned SVG string ready for parsing */
  svgContent: string;
  /** Log of preprocessing actions */
  log: string[];
  /** Statistics */
  stats: {
    elementsRemoved: number;
    fragmentsRemoved: number;
    shapesBeforeClean: number;
    shapesAfterClean: number;
  };
}

// oxlint-disable-next-line typescript/no-unused-vars
const SVG_NS = "http://www.w3.org/2000/svg";

/** Tags that carry no visible shape data and can be stripped. */
const STRIP_TAGS = new Set([
  "metadata",
  "title",
  "desc",
  "script",
  "linearGradient",
  "radialGradient",
  "pattern",
  "filter",
  "feGaussianBlur",
  "feOffset",
  "feMerge",
  "feMergeNode",
  "feBlend",
  "feFlood",
  "feComposite",
  "feColorMatrix",
  "marker",
  "symbol",
  "font",
  "font-face",
]);

/** Tags that contain reusable definitions (keep for clip-path refs, but strip contents we don't need). */
const CONTAINER_STRIP_TAGS = new Set(["defs"]);

const SHAPE_TAGS = new Set(["path", "polygon", "polyline", "rect", "circle", "ellipse"]);

/**
 * Full preprocessing pipeline for SVG content.
 */
export function preprocessSvg(svgContent: string): PreprocessResult {
  const log: string[] = [];
  let elementsRemoved = 0;
  let fragmentsRemoved = 0;

  // Parse DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    return {
      svgContent,
      log: ["Warning: Could not parse SVG for preprocessing"],
      stats: { elementsRemoved: 0, fragmentsRemoved: 0, shapesBeforeClean: 0, shapesAfterClean: 0 },
    };
  }

  // Count shapes before
  const shapesBefore = countShapes(svgRoot);
  log.push(`Preprocessing: ${shapesBefore} shape elements found`);

  // 1. Strip non-visual elements
  const stripped = stripNonVisualElements(svgRoot);
  elementsRemoved += stripped;
  if (stripped > 0) {
    log.push(`Stripped ${stripped} non-visual elements (metadata, scripts, filters, etc.)`);
  }

  // 1b. Inline CSS classes → resolve class-defined fill/stroke into inline style attributes
  // This is critical for Adobe Illustrator exports where all styling is via CSS classes
  const inlinedCount = inlineCssClasses(svgRoot, log);
  if (inlinedCount > 0) {
    log.push(`Inlined CSS styles on ${inlinedCount} elements`);
  }

  // 2. Normalize viewBox
  normalizeViewBox(svgRoot, log);

  // 3. Remove decorative elements (very thin strokes with no fill, tiny shapes)
  const decorRemoved = removeDecorativeElements(svgRoot);
  elementsRemoved += decorRemoved;
  if (decorRemoved > 0) {
    log.push(`Removed ${decorRemoved} decorative elements (thin borders, invisible shapes)`);
  }

  // 4. Remove tiny fragment shapes (< 0.1% of largest shape by point count)
  fragmentsRemoved = removeTinyFragments(svgRoot);
  if (fragmentsRemoved > 0) {
    log.push(`Removed ${fragmentsRemoved} tiny fragment shapes`);
  }

  // Count shapes after
  const shapesAfter = countShapes(svgRoot);
  if (shapesBefore !== shapesAfter) {
    log.push(`Shape count: ${shapesBefore} → ${shapesAfter}`);
  }

  // Serialize back to string
  const serializer = new XMLSerializer();
  const cleanedSvg = serializer.serializeToString(doc);

  return {
    svgContent: cleanedSvg,
    log,
    stats: {
      elementsRemoved,
      fragmentsRemoved,
      shapesBeforeClean: shapesBefore,
      shapesAfterClean: shapesAfter,
    },
  };
}

// ──────────────────────────────────────────────
// Pipeline Steps
// ──────────────────────────────────────────────

/** Strip non-visual elements from the SVG DOM. */
function stripNonVisualElements(root: Element): number {
  let removed = 0;
  const toRemove: Node[] = [];

  // Collect all elements to remove
  function walk(el: Element) {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType === 8) {
        // Comment node
        toRemove.push(child);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const childEl = child as Element;
      const tag = (childEl.localName ?? childEl.tagName?.split(":").pop() ?? "").toLowerCase();

      if (STRIP_TAGS.has(tag)) {
        toRemove.push(childEl);
        continue;
      }

      if (CONTAINER_STRIP_TAGS.has(tag)) {
        // Keep defs but strip non-clipPath children
        stripDefsContent(childEl, toRemove);
        continue;
      }

      walk(childEl);
    }
  }

  walk(root);

  for (const node of toRemove) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
      removed++;
    }
  }

  return removed;
}

/** Within a <defs>, keep clipPath and mask elements, strip everything else. */
function stripDefsContent(defs: Element, toRemove: Node[]) {
  for (let i = 0; i < defs.childNodes.length; i++) {
    const child = defs.childNodes[i];
    if (child.nodeType !== 1) continue;
    const tag = ((child as Element).localName ?? "").toLowerCase();
    // Keep clipPath, mask, and style (CSS classes define fills/strokes in AI exports)
    if (tag !== "clippath" && tag !== "mask" && tag !== "style") {
      toRemove.push(child);
    }
  }
}

/**
 * Parse CSS <style> blocks in the SVG and inline the resolved properties
 * onto elements that reference those classes. This is critical for
 * Adobe Illustrator / Affinity Designer exports where fill, stroke, etc.
 * are defined entirely via CSS classes (e.g., .cls-1 { fill: #ccebc5 }).
 */
function inlineCssClasses(root: Element, _log: string[]): number {
  // Find all <style> elements in the SVG
  const styleEls: Element[] = [];
  const walk = (el: Element) => {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i] as Element;
      if (!child || child.nodeType !== 1) continue;
      const tag = (child.localName ?? child.tagName?.split(":").pop() ?? "").toLowerCase();
      if (tag === "style") {
        styleEls.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(root);

  if (styleEls.length === 0) return 0;

  // Extract CSS text from all <style> elements
  let cssText = "";
  for (const se of styleEls) {
    for (let i = 0; i < se.childNodes.length; i++) {
      const child = se.childNodes[i];
      if (child?.nodeType === 3 || child?.nodeType === 4) {
        // TEXT_NODE or CDATA
        cssText += (child as any).data ?? (child as any).nodeValue ?? "";
      }
    }
  }

  if (!cssText.trim()) return 0;

  // Parse CSS rules: .className { property: value; ... }
  // Also handle grouped selectors: .cls-1, .cls-2 { fill: #abc; }
  const classStyles = new Map<string, Map<string, string>>();

  const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
  let match;
  while ((match = ruleRegex.exec(cssText)) !== null) {
    const selectorStr = match[1]!.trim();
    const propsStr = match[2]!.trim();

    // Parse properties
    const props = new Map<string, string>();
    for (const decl of propsStr.split(";")) {
      const colonIdx = decl.indexOf(":");
      if (colonIdx < 0) continue;
      const prop = decl.slice(0, colonIdx).trim();
      const val = decl.slice(colonIdx + 1).trim();
      if (prop && val) props.set(prop, val);
    }
    if (props.size === 0) continue;

    // Parse selectors (split by comma)
    for (const selector of selectorStr.split(",")) {
      const trimmed = selector.trim();
      // Only handle simple class selectors: .cls-1
      const classMatch = trimmed.match(/^\.([a-zA-Z0-9_-]+)$/);
      if (classMatch) {
        const className = classMatch[1]!;
        const existing = classStyles.get(className) ?? new Map<string, string>();
        for (const [p, v] of props) {
          existing.set(p, v);
        }
        classStyles.set(className, existing);
      }
    }
  }

  if (classStyles.size === 0) return 0;

  // Apply resolved CSS to elements with matching class attributes
  // SVG-relevant properties to inline
  const SVG_PROPS = new Set([
    "fill",
    "stroke",
    "stroke-width",
    "stroke-miterlimit",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "fill-opacity",
    "opacity",
    "fill-rule",
    "clip-rule",
    "display",
    "visibility",
  ]);

  let inlinedCount = 0;

  const applyToElement = (el: Element) => {
    const classAttr = el.getAttribute("class");
    if (classAttr) {
      const classes = classAttr.split(/\s+/);
      const existingStyle = el.getAttribute("style") ?? "";
      const newProps: string[] = [];

      for (const cls of classes) {
        const styles = classStyles.get(cls);
        if (!styles) continue;
        for (const [prop, val] of styles) {
          if (!SVG_PROPS.has(prop)) continue;
          // Don't override existing inline styles
          if (existingStyle.includes(prop + ":") || existingStyle.includes(prop + " :")) continue;
          // Also check if the property is already set as an XML attribute
          if (el.getAttribute(prop)) continue;
          newProps.push(`${prop}:${val}`);
        }
      }

      if (newProps.length > 0) {
        const combined = existingStyle
          ? existingStyle.replace(/;?\s*$/, "; ") + newProps.join("; ")
          : newProps.join("; ");
        el.setAttribute("style", combined);
        inlinedCount++;
      }
    }

    // Recurse into children
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i] as Element;
      if (child?.nodeType === 1) applyToElement(child);
    }
  };

  applyToElement(root);
  return inlinedCount;
}

/** Ensure the SVG has a valid viewBox. */
function normalizeViewBox(root: Element, log: string[]) {
  const viewBox = root.getAttribute("viewBox");
  if (viewBox) return; // Already has viewBox

  const w = parseFloat(root.getAttribute("width") ?? "0");
  const h = parseFloat(root.getAttribute("height") ?? "0");

  if (w > 0 && h > 0) {
    root.setAttribute("viewBox", `0 0 ${w} ${h}`);
    log.push(`Added viewBox from width/height: 0 0 ${w} ${h}`);
  }
}

/** Remove decorative elements: very thin strokes with no fill, display:none. */
function removeDecorativeElements(root: Element): number {
  let removed = 0;
  const toRemove: Element[] = [];

  function walk(el: Element) {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType !== 1) continue;
      const childEl = child as Element;
      const tag = (childEl.localName ?? "").toLowerCase();

      if (SHAPE_TAGS.has(tag)) {
        if (isDecorativeShape(childEl)) {
          toRemove.push(childEl);
        }
      } else {
        walk(childEl);
      }
    }
  }

  walk(root);

  for (const el of toRemove) {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
      removed++;
    }
  }

  return removed;
}

/** Check if a shape element is purely decorative (thin border, no fill, invisible). */
function isDecorativeShape(el: Element): boolean {
  const style = el.getAttribute("style") ?? "";
  const display = el.getAttribute("display") ?? "";

  // display:none
  if (display === "none" || style.includes("display:none") || style.includes("display: none")) {
    return true;
  }

  // visibility:hidden
  if (style.includes("visibility:hidden") || style.includes("visibility: hidden")) {
    return true;
  }

  // No fill AND very thin stroke — likely a border decoration
  const fill = el.getAttribute("fill") ?? "";
  const strokeWidth = el.getAttribute("stroke-width") ?? "";
  const fillFromStyle = style.match(/fill\s*:\s*([^;]+)/)?.[1]?.trim() ?? "";

  const hasNoFill =
    fill === "none" ||
    fillFromStyle === "none" ||
    (fill === "" && fillFromStyle === "" && !style.includes("fill"));

  if (hasNoFill) {
    const sw =
      parseFloat(strokeWidth) || parseFloat(style.match(/stroke-width\s*:\s*([^;]+)/)?.[1] ?? "1");
    if (sw < 0.5) return true;
  }

  return false;
}

/**
 * Remove shapes with very few points (likely artifacts or borders).
 * Threshold: shapes with < 4 points in their path data.
 */
function removeTinyFragments(root: Element): number {
  let removed = 0;
  const shapes: Array<{ el: Element; pointCount: number }> = [];

  // Collect all shapes with their approximate point counts
  function walk(el: Element) {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType !== 1) continue;
      const childEl = child as Element;
      const tag = (childEl.localName ?? "").toLowerCase();

      if (SHAPE_TAGS.has(tag)) {
        const pointCount = estimatePointCount(childEl);
        shapes.push({ el: childEl, pointCount });
      } else {
        walk(childEl);
      }
    }
  }

  walk(root);

  if (shapes.length < 3) return 0; // Don't filter if very few shapes

  // Find the median point count
  const sorted = shapes.map((s) => s.pointCount).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 10;
  const threshold = Math.max(3, Math.floor(median * 0.05)); // 5% of median, min 3

  for (const { el, pointCount } of shapes) {
    if (pointCount < threshold && el.parentNode) {
      el.parentNode.removeChild(el);
      removed++;
    }
  }

  return removed;
}

/** Estimate the number of coordinate points in a shape element. */
function estimatePointCount(el: Element): number {
  const tag = (el.localName ?? "").toLowerCase();

  switch (tag) {
    case "path": {
      const d = el.getAttribute("d") ?? "";
      // Count coordinate pairs (rough estimate: count commas + spaces between numbers)
      const matches = d.match(/[-+]?\d*\.?\d+/g);
      return matches ? Math.floor(matches.length / 2) : 0;
    }
    case "polygon":
    case "polyline": {
      const points = el.getAttribute("points") ?? "";
      const matches = points.match(/[-+]?\d*\.?\d+/g);
      return matches ? Math.floor(matches.length / 2) : 0;
    }
    case "rect":
      return 4;
    case "circle":
    case "ellipse":
      return 32;
    default:
      return 0;
  }
}

/** Count all shape elements in the DOM tree. */
function countShapes(root: Element): number {
  let count = 0;
  function walk(el: Element) {
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];
      if (child.nodeType !== 1) continue;
      const childEl = child as Element;
      const tag = (childEl.localName ?? "").toLowerCase();
      if (SHAPE_TAGS.has(tag)) count++;
      else walk(childEl);
    }
  }
  walk(root);
  return count;
}

// ──────────────────────────────────────────────
// Self-intersection detection & fix
// ──────────────────────────────────────────────

/**
 * Check if a ring self-intersects and split at crossing points.
 * Returns the original ring if no intersections, or multiple valid rings.
 */
export function fixSelfIntersectingRing(ring: Position[]): Position[][] {
  if (ring.length < 4) return [ring];

  // Find intersection points
  const intersections: Array<{ segA: number; segB: number; point: Position }> = [];

  for (let i = 0; i < ring.length - 1; i++) {
    for (let j = i + 2; j < ring.length - 1; j++) {
      // Don't check adjacent segments (they share a vertex)
      if (j === i + 1 || (i === 0 && j === ring.length - 2)) continue;

      const pt = segmentIntersection(ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!);
      if (pt) {
        intersections.push({ segA: i, segB: j, point: pt });
      }
    }
  }

  if (intersections.length === 0) return [ring];

  // For the first intersection, split into two rings
  const { segA, segB, point } = intersections[0]!;

  // Ring 1: start → segA → intersection → segB+1 → end
  const ring1: Position[] = [];
  for (let i = 0; i <= segA; i++) ring1.push(ring[i]!);
  ring1.push(point);
  for (let i = segB + 1; i < ring.length; i++) ring1.push(ring[i]!);

  // Ring 2: intersection → segA+1 → segB → intersection
  const ring2: Position[] = [point];
  for (let i = segA + 1; i <= segB; i++) ring2.push(ring[i]!);
  ring2.push(point);

  // Recursively fix any remaining intersections
  const result: Position[][] = [];
  for (const r of [ring1, ring2]) {
    if (r.length >= 4) {
      result.push(...fixSelfIntersectingRing(r));
    }
  }

  return result.length > 0 ? result : [ring];
}

/** Find intersection point of two line segments, or null if they don't intersect. */
function segmentIntersection(
  p1: Position,
  p2: Position,
  p3: Position,
  p4: Position
): Position | null {
  const d1x = p2[0]! - p1[0]!;
  const d1y = p2[1]! - p1[1]!;
  const d2x = p4[0]! - p3[0]!;
  const d2y = p4[1]! - p3[1]!;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // parallel

  const t = ((p3[0]! - p1[0]!) * d2y - (p3[1]! - p1[1]!) * d2x) / denom;
  const u = ((p3[0]! - p1[0]!) * d1y - (p3[1]! - p1[1]!) * d1x) / denom;

  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return [p1[0]! + t * d1x, p1[1]! + t * d1y];
  }

  return null;
}
