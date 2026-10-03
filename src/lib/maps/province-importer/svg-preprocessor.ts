/**
 * SVG Preprocessor — normalizes and cleans SVG before province parsing.
 *
 * Pipeline:
 * 1. Strip non-visual elements (defs, metadata, scripts, comments)
 * 2. Normalize viewBox (ensure it exists, standardize coordinate space)
 * 3. Remove tiny fragments (shapes too small to be provinces)
 *
 * Server-side only (uses @xmldom/xmldom).
 */

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { SHAPE_TAGS } from "./svg-element-converter";
import { elementChildren, styleDeclares, svgTag, type XmlElement } from "./svg-dom";

type XmlNode = import("@xmldom/xmldom").Node;

interface PreprocessResult {
  /** Cleaned SVG string ready for parsing */
  svgContent: string;
  /** Log of preprocessing actions */
  log: string[];
  stats: {
    elementsRemoved: number;
    fragmentsRemoved: number;
    shapesBeforeClean: number;
    shapesAfterClean: number;
  };
}

/** Lowercase tags (matched against lowercased element names) that carry no visible shape data. */
const STRIP_TAGS = new Set([
  "metadata",
  "title",
  "desc",
  "script",
  "pattern",
  "filter",
  "marker",
  "symbol",
  "font",
  "font-face",
]);

/** Children of <defs> worth keeping: clip paths and masks, plus CSS classes (AI exports define fills/strokes there). */
const KEEP_IN_DEFS = new Set(["clippath", "mask", "style"]);

/** SVG presentation properties that get inlined from CSS classes. */
const INLINE_SVG_PROPS = new Set([
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

const NUMBER_RE = /[-+]?\d*\.?\d+/g;

const lowerTag = (el: XmlElement) => svgTag(el).toLowerCase();

/** Detach each node from its parent; returns how many were removed. */
function removeNodes(nodes: XmlNode[]): number {
  let removed = 0;
  for (const node of nodes) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
      removed++;
    }
  }
  return removed;
}

/** All shape elements below `root` (shapes are not searched for nested shapes). */
function collectShapes(root: XmlElement): XmlElement[] {
  return elementChildren(root).flatMap((child) =>
    SHAPE_TAGS.has(lowerTag(child)) ? [child] : collectShapes(child)
  );
}

/**
 * Full preprocessing pipeline for SVG content.
 */
export function preprocessSvg(svgContent: string): PreprocessResult {
  const log: string[] = [];

  const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    return {
      svgContent,
      log: ["Warning: Could not parse SVG for preprocessing"],
      stats: { elementsRemoved: 0, fragmentsRemoved: 0, shapesBeforeClean: 0, shapesAfterClean: 0 },
    };
  }

  const shapesBefore = collectShapes(svgRoot).length;
  log.push(`Preprocessing: ${shapesBefore} shape elements found`);

  const stripped = stripNonVisualElements(svgRoot);
  if (stripped > 0) {
    log.push(`Stripped ${stripped} non-visual elements (metadata, scripts, filters, etc.)`);
  }

  // Resolve class-defined fill/stroke into inline styles (critical for Adobe Illustrator exports)
  const inlinedCount = inlineCssClasses(svgRoot);
  if (inlinedCount > 0) {
    log.push(`Inlined CSS styles on ${inlinedCount} elements`);
  }

  normalizeViewBox(svgRoot, log);

  const decorRemoved = removeNodes(collectShapes(svgRoot).filter(isDecorativeShape));
  if (decorRemoved > 0) {
    log.push(`Removed ${decorRemoved} decorative elements (thin borders, invisible shapes)`);
  }

  const fragmentsRemoved = removeTinyFragments(svgRoot);
  if (fragmentsRemoved > 0) {
    log.push(`Removed ${fragmentsRemoved} tiny fragment shapes`);
  }

  const shapesAfter = collectShapes(svgRoot).length;
  if (shapesBefore !== shapesAfter) {
    log.push(`Shape count: ${shapesBefore} → ${shapesAfter}`);
  }

  return {
    svgContent: new XMLSerializer().serializeToString(doc),
    log,
    stats: {
      elementsRemoved: stripped + decorRemoved,
      fragmentsRemoved,
      shapesBeforeClean: shapesBefore,
      shapesAfterClean: shapesAfter,
    },
  };
}

/** Strip comments, non-visual tags and (inside <defs>) everything but clip paths, masks and styles. */
function stripNonVisualElements(root: XmlElement): number {
  const toRemove: XmlNode[] = [];

  const walk = (el: XmlElement) => {
    for (const child of el.childNodes) {
      if (child.nodeType === 8) {
        toRemove.push(child);
      } else if (child.nodeType === 1) {
        const childEl = child as XmlElement;
        const tag = lowerTag(childEl);
        if (STRIP_TAGS.has(tag)) {
          toRemove.push(childEl);
        } else if (tag === "defs") {
          toRemove.push(...elementChildren(childEl).filter((c) => !KEEP_IN_DEFS.has(lowerTag(c))));
        } else {
          walk(childEl);
        }
      }
    }
  };
  walk(root);

  return removeNodes(toRemove);
}

/** Properties declared in a CSS block body: "fill: #abc; stroke: none" → Map. */
function parseDeclarations(body: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const decl of body.split(";")) {
    const colonIdx = decl.indexOf(":");
    const prop = decl.slice(0, colonIdx).trim();
    const val = decl.slice(colonIdx + 1).trim();
    if (colonIdx >= 0 && prop && val) props.set(prop, val);
  }
  return props;
}

/** Declarations per simple class selector (".cls-1" and grouped ".cls-1, .cls-2"). */
function parseClassStyles(css: string): Map<string, Map<string, string>> {
  const classStyles = new Map<string, Map<string, string>>();
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const props = parseDeclarations(body!);
    if (props.size === 0) continue;
    for (const selector of selectors!.split(",")) {
      const className = selector.trim().match(/^\.([a-zA-Z0-9_-]+)$/)?.[1];
      if (className) {
        classStyles.set(className, new Map([...(classStyles.get(className) ?? []), ...props]));
      }
    }
  }
  return classStyles;
}

/** <style> elements anywhere in the tree (not searched for nested styles). */
function collectStyleElements(el: XmlElement): XmlElement[] {
  return elementChildren(el).flatMap((child) =>
    lowerTag(child) === "style" ? [child] : collectStyleElements(child)
  );
}

/**
 * Parse CSS <style> blocks in the SVG and inline the resolved properties
 * onto elements that reference those classes. This is critical for
 * Adobe Illustrator / Affinity Designer exports where fill, stroke, etc.
 * are defined entirely via CSS classes (e.g., .cls-1 { fill: #ccebc5 }).
 */
function inlineCssClasses(root: XmlElement): number {
  const cssText = collectStyleElements(root)
    .flatMap((style) => [...style.childNodes])
    .filter((node) => node.nodeType === 3 || node.nodeType === 4) // text or CDATA
    .map((node) => node.nodeValue ?? "")
    .join("");

  const classStyles = parseClassStyles(cssText);
  if (classStyles.size === 0) return 0;

  let inlinedCount = 0;
  const applyToElement = (el: XmlElement) => {
    const existingStyle = el.getAttribute("style") ?? "";
    const newProps = (el.getAttribute("class") ?? "")
      .split(/\s+/)
      .flatMap((cls) => [...(classStyles.get(cls) ?? [])])
      .filter(
        ([prop]) =>
          INLINE_SVG_PROPS.has(prop) &&
          // Don't override existing inline styles or XML attributes
          !existingStyle.includes(`${prop}:`) &&
          !existingStyle.includes(`${prop} :`) &&
          !el.getAttribute(prop)
      )
      .map(([prop, val]) => `${prop}:${val}`);

    if (el.getAttribute("class") && newProps.length > 0) {
      const base = existingStyle ? existingStyle.replace(/;?\s*$/, "; ") : "";
      el.setAttribute("style", base + newProps.join("; "));
      inlinedCount++;
    }
    elementChildren(el).forEach(applyToElement);
  };

  applyToElement(root);
  return inlinedCount;
}

/** Add a viewBox from width/height when the SVG has none. */
function normalizeViewBox(root: XmlElement, log: string[]) {
  if (root.getAttribute("viewBox")) return;

  const w = parseFloat(root.getAttribute("width") ?? "0");
  const h = parseFloat(root.getAttribute("height") ?? "0");

  if (w > 0 && h > 0) {
    root.setAttribute("viewBox", `0 0 ${w} ${h}`);
    log.push(`Added viewBox from width/height: 0 0 ${w} ${h}`);
  }
}

/** Purely decorative shapes: display:none, visibility:hidden, or no fill with a very thin stroke. */
function isDecorativeShape(el: XmlElement): boolean {
  const style = el.getAttribute("style") ?? "";

  if (el.getAttribute("display") === "none" || styleDeclares(style, "display", "none")) return true;
  if (styleDeclares(style, "visibility", "hidden")) return true;

  const fill = el.getAttribute("fill") ?? "";
  const fillFromStyle = style.match(/fill\s*:\s*([^;]+)/)?.[1]?.trim() ?? "";
  const hasNoFill =
    fill === "none" ||
    fillFromStyle === "none" ||
    (!fill && !fillFromStyle && !style.includes("fill"));
  if (!hasNoFill) return false;

  const sw =
    parseFloat(el.getAttribute("stroke-width") ?? "") ||
    parseFloat(style.match(/stroke-width\s*:\s*([^;]+)/)?.[1] ?? "1");
  return sw < 0.5;
}

/** Estimate the number of coordinate points in a shape element. */
function estimatePointCount(el: XmlElement): number {
  const tag = lowerTag(el);
  if (tag === "path" || tag === "polygon" || tag === "polyline") {
    const source = el.getAttribute(tag === "path" ? "d" : "points") ?? "";
    return Math.floor((source.match(NUMBER_RE)?.length ?? 0) / 2);
  }
  if (tag === "rect") return 4;
  return tag === "circle" || tag === "ellipse" ? 32 : 0;
}

/** Remove shapes with fewer points than 5% of the median (min 3); skipped when under 3 shapes. */
function removeTinyFragments(root: XmlElement): number {
  const shapes = collectShapes(root).map((el) => ({ el, pointCount: estimatePointCount(el) }));
  if (shapes.length < 3) return 0;

  const sorted = shapes.map((s) => s.pointCount).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 10;
  const threshold = Math.max(3, Math.floor(median * 0.05));

  return removeNodes(shapes.filter((s) => s.pointCount < threshold).map((s) => s.el));
}
