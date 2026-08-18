/**
 * SVG Element Converter
 *
 * Converts all SVG shape element types (<path>, <polygon>, <polyline>,
 * <rect>, <circle>, <ellipse>) into coordinate rings so the rest of
 * the province parser pipeline can treat them uniformly.
 *
 * Server-side only (operates on @xmldom Elements).
 */

import { createRequire } from "module";
import { pathCommandsToRings } from "~/lib/flags/svg-parser;
import type { SvgPathCommand } from "~/lib/flags/svg-parser;

const _require = createRequire(import.meta.url);
const { parseSVG, makeAbsolute } = _require("svg-path-parser") as {
  parseSVG: (d: string) => SvgPathCommand[];
  makeAbsolute: (cmds: SvgPathCommand[]) => SvgPathCommand[];
};

// ──────────────────────────────────────────────
// Main dispatcher
// ──────────────────────────────────────────────

/**
 * Convert any SVG shape element to coordinate rings.
 * Returns empty array for unsupported/degenerate elements.
 */
export function elementToRings(el: Element, bezierSegments: number = 8): [number, number][][] {
  const tag = el.localName ?? el.tagName?.split(":").pop() ?? "";

  switch (tag) {
    case "path":
      return pathToRings(el, bezierSegments);
    case "polygon":
      return polygonToRings(el);
    case "polyline":
      return polylineToRings(el);
    case "rect":
      return rectToRings(el);
    case "circle":
      return circleToRings(el);
    case "ellipse":
      return ellipseToRings(el);
    default:
      return [];
  }
}

// ──────────────────────────────────────────────
// Individual converters
// ──────────────────────────────────────────────

/** Convert a <path> element using the existing SVG path parser pipeline. */
function pathToRings(el: Element, bezierSegments: number): [number, number][][] {
  const d = el.getAttribute("d");
  if (!d) return [];

  try {
    const commands = makeAbsolute(parseSVG(d));
    return pathCommandsToRings(commands, bezierSegments);
  } catch {
    return [];
  }
}

/** Parse a `points` attribute into an array of [x, y] pairs. */
function parsePoints(pointsAttr: string): [number, number][] {
  const coords: [number, number][] = [];
  // Points can be separated by whitespace and/or commas: "x1,y1 x2,y2" or "x1 y1 x2 y2"
  const nums = pointsAttr
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    if (!isFinite(x) || !isFinite(y)) continue;
    coords.push([x, y]);
  }
  return coords;
}

/** Convert a <polygon> element (auto-closed ring). */
export function polygonToRings(el: Element): [number, number][][] {
  const pointsAttr = el.getAttribute("points");
  if (!pointsAttr) return [];

  const pts = parsePoints(pointsAttr);
  if (pts.length < 3) return [];

  // Close the ring
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    pts.push([first[0], first[1]]);
  }

  return [pts];
}

/** Convert a <polyline> element (not auto-closed). */
export function polylineToRings(el: Element): [number, number][][] {
  const pointsAttr = el.getAttribute("points");
  if (!pointsAttr) return [];

  const pts = parsePoints(pointsAttr);
  if (pts.length < 3) return [];

  // Close if endpoints are very close (common for polylines used as polygons)
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const dist = Math.hypot(first[0] - last[0], first[1] - last[1]);
  if (dist > 0.001) {
    pts.push([first[0], first[1]]);
  }

  return [pts];
}

/** Convert a <rect> element to a 4-corner rectangle ring. */
export function rectToRings(el: Element): [number, number][][] {
  const x = parseFloat(el.getAttribute("x") || "0");
  const y = parseFloat(el.getAttribute("y") || "0");
  const w = parseFloat(el.getAttribute("width") || "0");
  const h = parseFloat(el.getAttribute("height") || "0");

  if (w <= 0 || h <= 0) return [];

  // Ignore rx/ry for simplicity — treat rounded rects as sharp corners
  return [
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y], // close
    ],
  ];
}

/** Approximate a <circle> as a polygon with N segments. */
export function circleToRings(el: Element, segments: number = 32): [number, number][][] {
  const cx = parseFloat(el.getAttribute("cx") || "0");
  const cy = parseFloat(el.getAttribute("cy") || "0");
  const r = parseFloat(el.getAttribute("r") || "0");

  if (r <= 0) return [];

  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  return [pts];
}

/** Approximate an <ellipse> as a polygon with N segments. */
export function ellipseToRings(el: Element, segments: number = 32): [number, number][][] {
  const cx = parseFloat(el.getAttribute("cx") || "0");
  const cy = parseFloat(el.getAttribute("cy") || "0");
  const rx = parseFloat(el.getAttribute("rx") || "0");
  const ry = parseFloat(el.getAttribute("ry") || "0");

  if (rx <= 0 || ry <= 0) return [];

  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    pts.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }

  return [pts];
}

/** Set of SVG shape element tag names we can convert. */
export const SHAPE_TAGS = new Set(["path", "polygon", "polyline", "rect", "circle", "ellipse"]);
