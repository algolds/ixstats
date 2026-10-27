/**
 * SVG Element Converter
 *
 * Converts all SVG shape element types (<path>, <polygon>, <polyline>,
 * <rect>, <circle>, <ellipse>) into coordinate rings so the rest of
 * the province parser pipeline can treat them uniformly.
 *
 * Server-side only (operates on @xmldom Elements).
 */

import { pathCommandsToRings } from "~/lib/flags/svg-parser";
import { parseAbsolutePath } from "~/lib/flags/svg/xml";
import { attrOrZero, svgTag, type XmlElement } from "./svg-dom";

type Ring = [number, number][];

/**
 * Convert any SVG shape element to coordinate rings.
 * Returns empty array for unsupported/degenerate elements.
 */
export function elementToRings(el: XmlElement, bezierSegments: number = 8): Ring[] {
  switch (svgTag(el)) {
    case "path":
      return pathToRings(el, bezierSegments);
    case "polygon":
      return pointsToRings(el, (first, last) => first[0] !== last[0] || first[1] !== last[1]);
    case "polyline":
      // Close if endpoints are far apart (polylines are often used as polygons)
      return pointsToRings(
        el,
        (first, last) => Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.001
      );
    case "rect":
      return rectToRings(el);
    case "circle":
      return ellipseToRings(el, "r", "r");
    case "ellipse":
      return ellipseToRings(el, "rx", "ry");
    default:
      return [];
  }
}

function pathToRings(el: XmlElement, bezierSegments: number): Ring[] {
  const d = el.getAttribute("d");
  if (!d) return [];

  try {
    return pathCommandsToRings(parseAbsolutePath(d), bezierSegments);
  } catch {
    return [];
  }
}

/** Parse a `points` attribute ("x1,y1 x2,y2" or "x1 y1 x2 y2") into a ring, closing it when `needsClose` says so. */
function pointsToRings(
  el: XmlElement,
  needsClose: (first: [number, number], last: [number, number]) => boolean
): Ring[] {
  const pointsAttr = el.getAttribute("points");
  if (!pointsAttr) return [];

  const nums = pointsAttr
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const pts: Ring = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (isFinite(nums[i]!) && isFinite(nums[i + 1]!)) pts.push([nums[i]!, nums[i + 1]!]);
  }
  if (pts.length < 3) return [];

  const first = pts[0]!;
  if (needsClose(first, pts[pts.length - 1]!)) pts.push([first[0], first[1]]);
  return [pts];
}

/** Rounded corners (rx/ry) are ignored: rects become sharp-cornered rings. */
function rectToRings(el: XmlElement): Ring[] {
  const [x, y, w, h] = ["x", "y", "width", "height"].map((name) => attrOrZero(el, name));
  if (w! <= 0 || h! <= 0) return [];
  return [
    [
      [x!, y!],
      [x! + w!, y!],
      [x! + w!, y! + h!],
      [x!, y! + h!],
      [x!, y!],
    ],
  ];
}

/** Approximate a <circle> or <ellipse> as a 32-segment polygon (radii read from `rxAttr`/`ryAttr`). */
function ellipseToRings(el: XmlElement, rxAttr: string, ryAttr: string, segments = 32): Ring[] {
  const cx = attrOrZero(el, "cx");
  const cy = attrOrZero(el, "cy");
  const rx = attrOrZero(el, rxAttr);
  const ry = attrOrZero(el, ryAttr);
  if (rx <= 0 || ry <= 0) return [];

  return [
    Array.from({ length: segments + 1 }, (_, i): [number, number] => {
      const angle = (2 * Math.PI * i) / segments;
      return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
    }),
  ];
}

/** Set of SVG shape element tag names we can convert. */
export const SHAPE_TAGS = new Set(["path", "polygon", "polyline", "rect", "circle", "ellipse"]);
