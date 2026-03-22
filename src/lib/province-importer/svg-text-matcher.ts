/**
 * SVG Text Label Matcher
 *
 * Extracts <text> labels from SVG and matches them to provinces
 * by spatial proximity (point-in-bbox, then nearest centroid).
 */

import { getAccumulatedTransform, applyMatrixToPoint } from "./svg-transform";

const SVG_NS = "http://www.w3.org/2000/svg";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface TextLabel {
  text: string;
  x: number;
  y: number;
}

// ──────────────────────────────────────────────
// Text Extraction
// ──────────────────────────────────────────────

/**
 * Extract all text labels from an SVG, resolving transforms.
 * Handles <text> elements and their <tspan> children.
 *
 * @param svgRoot - The SVG root element or target layer
 * @param stopAt - Ancestor to stop transform accumulation at (usually SVG root)
 */
export function extractAllTextLabels(
  svgRoot: Element,
  stopAt?: Element
): TextLabel[] {
  const transformRoot = stopAt ?? svgRoot;
  const labels: TextLabel[] = [];
  const textEls = svgRoot.getElementsByTagNameNS(SVG_NS, "text");

  for (let i = 0; i < textEls.length; i++) {
    const el = textEls[i]!;

    // Get accumulated transform from this <text> up to the root
    const matrix = getAccumulatedTransform(el, transformRoot);

    // Check for <tspan> children
    const tspans = el.getElementsByTagNameNS(SVG_NS, "tspan");

    if (tspans.length > 0) {
      // Collect text from all tspans
      for (let j = 0; j < tspans.length; j++) {
        const tspan = tspans[j]!;
        const text = (tspan.textContent || "").trim();
        if (!text || text.length < 2) continue;

        // tspan x/y override parent; fall back to parent's x/y
        const tx = parseFloat(tspan.getAttribute("x") || el.getAttribute("x") || "0");
        const ty = parseFloat(tspan.getAttribute("y") || el.getAttribute("y") || "0");

        // Handle dx/dy offsets
        const dx = parseFloat(tspan.getAttribute("dx") || "0");
        const dy = parseFloat(tspan.getAttribute("dy") || "0");

        const [rx, ry] = applyMatrixToPoint(tx + dx, ty + dy, matrix);
        labels.push({ text, x: rx, y: ry });
      }
    } else {
      // No tspan — use <text> element directly
      const text = (el.textContent || "").trim();
      if (!text || text.length < 2) continue;

      const x = parseFloat(el.getAttribute("x") || "0");
      const y = parseFloat(el.getAttribute("y") || "0");

      const [rx, ry] = applyMatrixToPoint(x, y, matrix);
      labels.push({ text, x: rx, y: ry });
    }
  }

  return labels;
}

// ──────────────────────────────────────────────
// Label → Province Matching
// ──────────────────────────────────────────────

interface ProvinceSpatialInfo {
  centroid: [number, number];
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

/**
 * Match text labels to provinces by spatial proximity.
 *
 * Strategy:
 *   1. For each label, find provinces whose bbox contains the label point
 *   2. Among those, pick the province whose centroid is closest
 *   3. If no bbox contains the label, find the nearest centroid within a threshold
 *   4. Greedy: each province gets at most one label (closest wins)
 *
 * @returns Map from province index → label text
 */
export function matchLabelsToProvinces(
  labels: TextLabel[],
  provinces: ProvinceSpatialInfo[]
): Map<number, string> {
  if (labels.length === 0 || provinces.length === 0) return new Map();

  // Compute average bbox diagonal for distance threshold
  let avgDiag = 0;
  for (const p of provinces) {
    const dx = p.bbox[2] - p.bbox[0];
    const dy = p.bbox[3] - p.bbox[1];
    avgDiag += Math.hypot(dx, dy);
  }
  avgDiag /= provinces.length;
  const maxDist = avgDiag * 2; // Allow labels up to 2x average bbox diagonal away

  // Score each label → province pair
  const assignments: { labelIdx: number; provIdx: number; dist: number }[] = [];

  for (let li = 0; li < labels.length; li++) {
    const label = labels[li]!;

    // Find provinces whose bbox contains this label
    const containing: number[] = [];
    for (let pi = 0; pi < provinces.length; pi++) {
      const [minX, minY, maxX, maxY] = provinces[pi]!.bbox;
      if (label.x >= minX && label.x <= maxX && label.y >= minY && label.y <= maxY) {
        containing.push(pi);
      }
    }

    if (containing.length > 0) {
      // Pick the province with centroid closest to the label
      let bestIdx = containing[0]!;
      let bestDist = Infinity;
      for (const pi of containing) {
        const c = provinces[pi]!.centroid;
        const d = Math.hypot(label.x - c[0], label.y - c[1]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = pi;
        }
      }
      assignments.push({ labelIdx: li, provIdx: bestIdx, dist: bestDist });
    } else {
      // Fallback: find nearest centroid within threshold
      let bestIdx = -1;
      let bestDist = maxDist;
      for (let pi = 0; pi < provinces.length; pi++) {
        const c = provinces[pi]!.centroid;
        const d = Math.hypot(label.x - c[0], label.y - c[1]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = pi;
        }
      }
      if (bestIdx >= 0) {
        assignments.push({ labelIdx: li, provIdx: bestIdx, dist: bestDist });
      }
    }
  }

  // Sort by distance (closest first) for greedy assignment
  assignments.sort((a, b) => a.dist - b.dist);

  const result = new Map<number, string>();
  const usedProvinces = new Set<number>();
  const usedLabels = new Set<number>();

  for (const { labelIdx, provIdx } of assignments) {
    if (usedProvinces.has(provIdx) || usedLabels.has(labelIdx)) continue;
    result.set(provIdx, labels[labelIdx]!.text);
    usedProvinces.add(provIdx);
    usedLabels.add(labelIdx);
  }

  return result;
}
