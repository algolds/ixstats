import type { Position } from "geojson";

// @xmldom/xmldom@0.9's Element type is no longer structurally assignable to the
// global lib.dom Element (it was in 0.8). All "XmlElement" values in this file are
// xmldom-parsed nodes, never real DOM elements, so alias to the package's own type.
type XmlElement = import("@xmldom/xmldom").Element;

/**
 * Calculate the signed area of a ring (in WGS84 coordinates).
 * Positive = counter-clockwise (outer ring in GeoJSON), negative = clockwise (hole).
 */
export function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    area += x1! * y2! - x2! * y1!;
  }
  return area / 2;
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
 * Approximate area in square kilometers using the Shoelace formula
 * with a latitude-dependent scaling factor.
 */
export function calculateApproxArea(rings: Position[][]): number {
  let totalArea = 0;

  for (const ring of rings) {
    const centroid = calculateCentroid([ring]);
    const latRad = (centroid[1] * Math.PI) / 180;
    const kmPerDegLng = 111.32 * Math.cos(latRad);
    const kmPerDegLat = 110.574;

    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[i + 1]!;
      area += x1! * kmPerDegLng * (y2! * kmPerDegLat) - x2! * kmPerDegLng * (y1! * kmPerDegLat);
    }
    totalArea += Math.abs(area) / 2;
  }

  return Math.round(totalArea * 100) / 100;
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
