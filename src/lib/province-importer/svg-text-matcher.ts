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
      // Concatenate all tspan children into a single label.
      // Multi-line text labels (e.g. "São" + "Paulo") should produce "São Paulo".
      const parts: string[] = [];
      let firstX = NaN, firstY = NaN;

      for (let j = 0; j < tspans.length; j++) {
        const tspan = tspans[j]!;
        const text = (tspan.textContent || "").trim();
        if (!text) continue;

        if (isNaN(firstX)) {
          // Use the first tspan's position (or parent's) as the label position
          const tx = parseFloat(tspan.getAttribute("x") || el.getAttribute("x") || "0");
          const ty = parseFloat(tspan.getAttribute("y") || el.getAttribute("y") || "0");
          const dx = parseFloat(tspan.getAttribute("dx") || "0");
          const dy = parseFloat(tspan.getAttribute("dy") || "0");

          // Accumulate the tspan's own transform if it has one
          const tspanMatrix = getAccumulatedTransform(tspan, transformRoot);
          const [rx, ry] = applyMatrixToPoint(tx + dx, ty + dy, tspanMatrix);
          firstX = rx;
          firstY = ry;
        }

        parts.push(text);
      }

      const combined = parts.join(" ").trim();
      if (combined.length >= 2 && !isNaN(firstX)) {
        labels.push({ text: combined, x: firstX, y: firstY });
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

  // Build ALL candidate pairs: label → province with centroid distance
  // Each label can match any province within range
  const allPairs: { labelIdx: number; provIdx: number; dist: number; inBbox: boolean }[] = [];

  for (let li = 0; li < labels.length; li++) {
    const label = labels[li]!;

    for (let pi = 0; pi < provinces.length; pi++) {
      const prov = provinces[pi]!;
      const [minX, minY, maxX, maxY] = prov.bbox;
      const inBbox =
        label.x >= minX && label.x <= maxX &&
        label.y >= minY && label.y <= maxY;
      const c = prov.centroid;
      const dist = Math.hypot(label.x - c[0], label.y - c[1]);

      if (inBbox || dist < maxDist) {
        allPairs.push({ labelIdx: li, provIdx: pi, dist, inBbox });
      }
    }
  }

  // Sort: bbox containment first (true > false), then by distance
  allPairs.sort((a, b) => {
    if (a.inBbox !== b.inBbox) return a.inBbox ? -1 : 1;
    return a.dist - b.dist;
  });

  // Pass 1: assign labels that are inside exactly ONE bbox (unambiguous)
  const result = new Map<number, string>();
  const usedProvinces = new Set<number>();
  const usedLabels = new Set<number>();

  const bboxCounts = new Map<number, number[]>(); // labelIdx → provIndices where it's in bbox
  for (const pair of allPairs) {
    if (!pair.inBbox) continue;
    if (!bboxCounts.has(pair.labelIdx)) bboxCounts.set(pair.labelIdx, []);
    bboxCounts.get(pair.labelIdx)!.push(pair.provIdx);
  }

  // First assign unique bbox containments (label inside exactly one province)
  for (const [labelIdx, provIndices] of bboxCounts) {
    if (provIndices.length === 1) {
      const provIdx = provIndices[0]!;
      if (!usedProvinces.has(provIdx) && !usedLabels.has(labelIdx)) {
        result.set(provIdx, labels[labelIdx]!.text);
        usedProvinces.add(provIdx);
        usedLabels.add(labelIdx);
      }
    }
  }

  // Pass 2: assign remaining by closest centroid distance (greedy)
  for (const { labelIdx, provIdx } of allPairs) {
    if (usedProvinces.has(provIdx) || usedLabels.has(labelIdx)) continue;
    result.set(provIdx, labels[labelIdx]!.text);
    usedProvinces.add(provIdx);
    usedLabels.add(labelIdx);
  }

  return result;
}
