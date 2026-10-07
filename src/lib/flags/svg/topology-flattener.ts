import type { Geometry, Position } from "geojson";
import { polygonalAreaSqKm } from "~/lib/maps/planet";
import { assembleRings, signedRingArea, type FillRule } from "~/lib/maps/ring-assembly";

// @xmldom/xmldom@0.9's Element type is no longer structurally assignable to the
// global lib.dom Element (it was in 0.8). All "XmlElement" values in this file are
// xmldom-parsed nodes, never real DOM elements, so alias to the package's own type.
type XmlElement = import("@xmldom/xmldom").Element;

/**
 * Calculate the signed area of a ring (in WGS84 coordinates).
 * Positive = counter-clockwise (outer ring in GeoJSON), negative = clockwise (hole).
 */
export function ringArea(ring: Position[]): number {
  return signedRingArea(ring);
}

/**
 * Calculate the centroid of a set of rings as simple coordinate average.
 */
export function calculateCentroid(rings: Position[][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      sumLng += lng!;
      sumLat += lat!;
      count++;
    }
  }

  if (count === 0) return [0, 0];
  return [sumLng / count, sumLat / count];
}

/**
 * Calculate bounding box [minLng, minLat, maxLng, maxLat].
 */
export function calculateBoundingBox(rings: Position[][]): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng! < minLng) minLng = lng!;
      if (lng! > maxLng) maxLng = lng!;
      if (lat! < minLat) minLat = lat!;
      if (lat! > maxLat) maxLat = lat!;
    }
  }

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Approximate area in square kilometers of the polygons the rings make (Shoelace formula with a
 * latitude-dependent scaling factor): rings are classified by containment, so holes are subtracted.
 */
export function calculateApproxArea(rings: Position[][]): number {
  return rings.length === 0 ? 0 : roundedAreaSqKm(assembleRings(rings));
}

/** A Polygon/MultiPolygon's approximate area in km² (holes subtracted), to two decimals. */
export function roundedAreaSqKm(geometry: Geometry): number {
  return Math.round(polygonalAreaSqKm(geometry) * 100) / 100;
}

/**
 * Extract fill color from an SVG element.
 */
export function extractFillColor(el: XmlElement, style: string): string | undefined {
  const styleMatch = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  if (styleMatch?.[1]) {
    const val = normalizeColor(styleMatch[1]);
    if (isValidColor(val)) return val;
  }

  const fillAttr = el.getAttribute("fill");
  if (fillAttr) {
    const val = normalizeColor(fillAttr);
    if (isValidColor(val)) return val;
  }

  let parent = el.parentNode;
  while (parent && parent.nodeType === 1) {
    const parentEl = parent as XmlElement;
    const parentStyle = parentEl.getAttribute("style") ?? "";
    const pMatch = parentStyle.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
    if (pMatch?.[1]) {
      const val = normalizeColor(pMatch[1]);
      if (isValidColor(val)) return val;
    }
    const pFill = parentEl.getAttribute("fill");
    if (pFill) {
      const val = normalizeColor(pFill);
      if (isValidColor(val)) return val;
    }
    parent = parent.parentNode;
  }

  return undefined;
}

/**
 * The SVG fill rule an element is drawn with (its own `fill-rule` style or attribute, else its nearest
 * ancestor's), or undefined when none is given anywhere.
 */
export function extractFillRule(el: XmlElement): FillRule | undefined {
  let node: XmlElement | null = el;
  while (node && node.nodeType === 1) {
    const styled = (node.getAttribute("style") ?? "").match(/(?:^|;)\s*fill-rule\s*:\s*([^;]+)/i);
    const rule = (styled?.[1] ?? node.getAttribute("fill-rule") ?? "").trim().toLowerCase();
    if (rule === "evenodd" || rule === "nonzero") return rule;
    node = node.parentNode as XmlElement | null;
  }
  return undefined;
}

/**
 * Extract stroke color from an SVG element.
 */
export function extractStrokeColor(el: XmlElement, style: string): string | undefined {
  const styleMatch = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
  if (styleMatch?.[1]) {
    const val = normalizeColor(styleMatch[1]);
    if (isValidColor(val)) return val;
  }

  const strokeAttr = el.getAttribute("stroke");
  if (strokeAttr) {
    const val = normalizeColor(strokeAttr);
    if (isValidColor(val)) return val;
  }

  return undefined;
}

function isValidColor(val: string): boolean {
  if (!val || val === "none" || val === "inherit" || val === "transparent") {
    return false;
  }
  return true;
}

function normalizeColor(val: string): string {
  const trimmed = val.trim();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return `#${trimmed}`;
  }
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`;
  }
  return trimmed;
}
