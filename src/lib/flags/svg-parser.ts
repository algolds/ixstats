/**
 * SVG metadata and the SVG helpers the province importer and the SVG import engine share.
 *
 * Server-side only. The SVG to GeoJSON parser that lived here served the old Labs map pipeline and went with it; the
 * province importer (lib/maps/province-importer) and the import engine (lib/maps/import/svg-engine) read SVG themselves.
 */

import { DOMParser } from "@xmldom/xmldom";

import { pathCommandsToRings } from "./svg/command-evaluator";
import {
  calculateCentroid,
  calculateBoundingBox,
  extractFillColor,
} from "./svg/topology-flattener";
import { SVG_NS, INKSCAPE_NS } from "./svg/xml";

export { pathCommandsToRings, calculateCentroid, calculateBoundingBox, extractFillColor };

/**
 * Convert feature ID to display name: "New_Harren" → "New Harren"
 */
export function featureIdToDisplayName(id: string): string {
  return id.replace(/_/g, " ").replace(/-/g, " ");
}

/**
 * Extract SVG metadata (viewBox, dimensions, layer list).
 */
export function extractSvgMetadata(svgContent: string): {
  viewBox: { x: number; y: number; width: number; height: number } | null;
  width: string | null;
  height: string | null;
  layers: Array<{ id: string; label: string; childCount: number }>;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const root = doc.documentElement;

  if (!root) return { viewBox: null, width: null, height: null, layers: [] };

  // Parse viewBox
  let viewBox = null;
  const vbAttr = root.getAttribute("viewBox");
  if (vbAttr) {
    const parts = vbAttr.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      viewBox = { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
    }
  }

  // Find layers
  const layers: Array<{ id: string; label: string; childCount: number }> = [];
  const groups = root.getElementsByTagNameNS(SVG_NS, "g");
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    if (g.parentNode !== root) continue;

    const gId = g.getAttribute("id") || "";
    const gLabel =
      g.getAttributeNS(INKSCAPE_NS, "label") || g.getAttribute("inkscape:label") || gId;

    // Count all descendant paths (not just direct children — Illustrator nests groups)
    const paths = g.getElementsByTagNameNS(SVG_NS, "path");

    layers.push({ id: gId, label: gLabel, childCount: paths.length });
  }

  return {
    viewBox,
    width: root.getAttribute("width"),
    height: root.getAttribute("height"),
    layers,
  };
}
