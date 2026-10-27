/**
 * SVG Text Label Matcher
 *
 * Extracts <text> labels from SVG and matches them to provinces
 * by spatial proximity (point-in-bbox, then nearest centroid).
 */

import { getAccumulatedTransform, applyMatrixToPoint } from "./svg-transform";
import { SVG_NS, attrOrZero, type XmlElement } from "./svg-dom";

interface TextLabel {
  text: string;
  x: number;
  y: number;
}

/** Numeric attribute (first value of a list), NaN when absent. */
const attrOrNaN = (el: XmlElement, name: string) => {
  const v = el.getAttribute(name);
  return v != null ? parseFloat(v) : NaN;
};

/**
 * Join <tspan> children into one label string.
 *
 * Vector editors (Illustrator especially) split a single word into many
 * <tspan>s solely to encode per-glyph kerning — e.g. "CHRYSONUM" becomes
 * <tspan>CH</tspan><tspan>R</tspan><tspan>Y</tspan><tspan>SONUM</tspan>,
 * all sharing one baseline (y="0", increasing x). Those MUST be joined
 * with no separator. Genuine spaces between words survive verbatim inside
 * a tspan's text (e.g. "X NORBA"), so individual tspans must NOT be
 * trimmed. A separator is inserted only at a real line break — when a
 * tspan starts a new baseline (its y changes) or its x resets leftward
 * (a carriage return) — which keeps multi-line labels like "São" / "Paulo"
 * joined as "São Paulo".
 */
function tspanLabel(el: XmlElement, tspans: XmlElement[], transformRoot: XmlElement) {
  let combined = "";
  let firstX = NaN;
  let firstY = NaN;
  let prevX = NaN;
  let prevBaseline = NaN;

  for (const tspan of tspans) {
    const raw = tspan.textContent ?? "";
    if (raw === "") continue;

    const tx = attrOrNaN(tspan, "x");
    const ty = attrOrNaN(tspan, "y");

    // Anchor the label at the first positioned tspan (fall back to <text>).
    if (isNaN(firstX)) {
      const ax = (isNaN(tx) ? attrOrZero(el, "x") : tx) + attrOrZero(tspan, "dx");
      const ay = (isNaN(ty) ? attrOrZero(el, "y") : ty) + attrOrZero(tspan, "dy");
      [firstX, firstY] = applyMatrixToPoint(ax, ay, getAccumulatedTransform(tspan, transformRoot));
    }

    const newLine =
      (!isNaN(ty) && !isNaN(prevBaseline) && Math.abs(ty - prevBaseline) > 1e-6) ||
      (!isNaN(tx) && !isNaN(prevX) && tx < prevX - 1e-6);
    if (combined !== "" && newLine && !/\s$/.test(combined)) combined += " ";

    combined += raw;
    if (!isNaN(tx)) prevX = tx;
    if (!isNaN(ty)) prevBaseline = ty;
  }

  // Collapse whitespace runs (from line breaks or source formatting) and trim.
  const text = combined.replace(/\s+/g, " ").trim();
  return text.length >= 2 && !isNaN(firstX) ? { text, x: firstX, y: firstY } : null;
}

/**
 * Extract all text labels from an SVG, resolving transforms.
 * Handles <text> elements and their <tspan> children.
 *
 * @param svgRoot - The SVG root element or target layer
 * @param stopAt - Ancestor to stop transform accumulation at (usually SVG root)
 */
export function extractAllTextLabels(svgRoot: XmlElement, stopAt?: XmlElement): TextLabel[] {
  const transformRoot = stopAt ?? svgRoot;

  return [...svgRoot.getElementsByTagNameNS(SVG_NS, "text")].flatMap((el): TextLabel[] => {
    const tspans = [...el.getElementsByTagNameNS(SVG_NS, "tspan")];
    if (tspans.length > 0) {
      const label = tspanLabel(el, tspans, transformRoot);
      return label ? [label] : [];
    }

    const text = (el.textContent || "").trim();
    if (text.length < 2) return [];
    const [x, y] = applyMatrixToPoint(
      attrOrZero(el, "x"),
      attrOrZero(el, "y"),
      getAccumulatedTransform(el, transformRoot)
    );
    return [{ text, x, y }];
  });
}

interface ProvinceSpatialInfo {
  centroid: [number, number];
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

/**
 * Match text labels to provinces by spatial proximity.
 *
 * Strategy:
 *   1. Labels inside exactly one province bbox are assigned to it
 *   2. The remaining candidate pairs (label inside the bbox, or within 2x the average bbox
 *      diagonal of the centroid) are assigned greedily: bbox containment first, then closest
 *      centroid. Each province and each label is used at most once.
 *
 * @returns Map from province index → label text
 */
export function matchLabelsToProvinces(
  labels: TextLabel[],
  provinces: ProvinceSpatialInfo[]
): Map<number, string> {
  if (labels.length === 0 || provinces.length === 0) return new Map();

  const avgDiag =
    provinces.reduce(
      (sum, p) => sum + Math.hypot(p.bbox[2] - p.bbox[0], p.bbox[3] - p.bbox[1]),
      0
    ) / provinces.length;
  const maxDist = avgDiag * 2;

  const allPairs: { labelIdx: number; provIdx: number; dist: number; inBbox: boolean }[] = [];
  labels.forEach((label, labelIdx) => {
    provinces.forEach(({ bbox: [minX, minY, maxX, maxY], centroid }, provIdx) => {
      const inBbox = label.x >= minX && label.x <= maxX && label.y >= minY && label.y <= maxY;
      const dist = Math.hypot(label.x - centroid[0], label.y - centroid[1]);
      if (inBbox || dist < maxDist) allPairs.push({ labelIdx, provIdx, dist, inBbox });
    });
  });

  allPairs.sort((a, b) => Number(b.inBbox) - Number(a.inBbox) || a.dist - b.dist);

  const result = new Map<number, string>();
  const usedLabels = new Set<number>();
  const assign = (labelIdx: number, provIdx: number) => {
    if (result.has(provIdx) || usedLabels.has(labelIdx)) return;
    result.set(provIdx, labels[labelIdx]!.text);
    usedLabels.add(labelIdx);
  };

  // Pass 1: labels inside exactly ONE bbox (unambiguous)
  const bboxProvinces = new Map<number, number[]>(); // labelIdx → provinces whose bbox holds it
  for (const { labelIdx, provIdx, inBbox } of allPairs) {
    if (inBbox) bboxProvinces.set(labelIdx, [...(bboxProvinces.get(labelIdx) ?? []), provIdx]);
  }
  for (const [labelIdx, provIndices] of bboxProvinces) {
    if (provIndices.length === 1) assign(labelIdx, provIndices[0]!);
  }

  // Pass 2: remaining pairs by bbox containment, then closest centroid (greedy)
  for (const { labelIdx, provIdx } of allPairs) assign(labelIdx, provIdx);

  return result;
}
