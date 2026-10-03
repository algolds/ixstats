/**
 * Province SVG Parser (v2)
 *
 * Parses province/subdivision maps from SVG files uploaded by country owners.
 * Supports all SVG shape elements, transform attributes, layer detection,
 * text label matching, and intelligent group merging.
 *
 * Server-side only (uses @xmldom/xmldom).
 */

import { DOMParser } from "@xmldom/xmldom";
import type { Polygon, MultiPolygon, Position } from "geojson";
import type { ProvinceFeature, ProvinceParseConfig, ProvinceParseResult } from "./types";
import {
  extractFillColor,
  featureIdToDisplayName,
  calculateCentroid,
  calculateBoundingBox,
  calculateApproxArea,
  ringArea,
} from "~/lib/flags/svg-parser";
import { elementToRings, SHAPE_TAGS } from "./svg-element-converter";
import { getAccumulatedTransform, applyMatrixToRings } from "./svg-transform";
import {
  detectProvinceLayer,
  collectShapeElements,
  filterProvinceShapes,
} from "./svg-layer-detector";
import { extractAllTextLabels, matchLabelsToProvinces } from "./svg-text-matcher";
import {
  SVG_NS,
  ancestorElements,
  elementChildren,
  groupName,
  inkscapeLabel,
  sanitizeSvg,
  svgTag,
  type XmlElement,
} from "./svg-dom";

type Ring = [number, number][];

/** Settings shared by every per-element parse step. */
interface ParseCtx {
  /** Transforms are accumulated up to this element. */
  container: XmlElement;
  bezierSegments: number;
  minRingSize: number;
  includeTransforms: boolean;
  log: string[];
}

const GENERIC_PROVINCE_NAME = /^(Province|Region|District)\s+\d+$/i;

/**
 * Parse a province SVG into an array of ProvinceFeature objects.
 * Returns provinces in SVG coordinate space — alignment to the country
 * border is handled separately by the alignment engine.
 */
export function parseProvinceSvg(
  svgContent: string,
  config: ProvinceParseConfig = {}
): ProvinceParseResult {
  const log: string[] = [];
  const doc = new DOMParser().parseFromString(sanitizeSvg(svgContent), "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    throw new Error("Failed to parse SVG: no root element found");
  }

  const viewBox = extractViewBox(svgRoot);
  log.push(`SVG viewBox: ${viewBox.width} × ${viewBox.height}`);

  const targetContainer = findTargetContainer(svgRoot, config.targetLayer, log);

  const layersFound = [...svgRoot.getElementsByTagNameNS(SVG_NS, "g")]
    .filter((g) => g.parentNode === svgRoot)
    .map((g) => inkscapeLabel(g) || g.getAttribute("id") || "")
    .filter(Boolean);
  log.push(`Top-level layers: ${layersFound.join(", ") || "none"}`);

  const rawShapes = collectShapeElements(targetContainer, svgRoot);
  log.push(`Raw shape elements: ${rawShapes.length}`);

  // Drops topo fills, water and decorative elements
  const allShapes = filterProvinceShapes(rawShapes, svgRoot, log);

  const tagCounts = new Map<string, number>();
  for (const s of allShapes) {
    tagCounts.set(svgTag(s), (tagCounts.get(svgTag(s)) ?? 0) + 1);
  }
  log.push(
    `Filtered shape elements: ${allShapes.length} (${[...tagCounts.entries()].map(([k, v]) => `${v} ${k}`).join(", ")})`
  );

  const ctx: ParseCtx = {
    container: targetContainer,
    bezierSegments: config.bezierSegments ?? 8,
    minRingSize: config.minRingSize ?? 4,
    includeTransforms: config.includeTransforms !== false,
    log,
  };
  let provinces =
    config.mergeGroupedPaths !== false
      ? parseWithSmartGrouping(allShapes, ctx, config.maxMergeSize ?? 4)
      : allShapes.flatMap((el, i) => parseSingleElement(el, i, ctx) ?? []);

  log.push(`Detected ${provinces.length} provinces from ${allShapes.length} shape elements`);
  if (provinces.length === 0) {
    log.push(emptyResultHint(allShapes.length, rawShapes.length));
  }

  // Real province boundaries have 8+ vertices; fewer means markers/decorations
  const preFilterCount = provinces.length;
  provinces = provinces.filter((p) => countGeometryVertices(p.geometry) >= 8);
  if (provinces.length < preFilterCount) {
    log.push(`Filtered ${preFilterCount - provinces.length} low-vertex shapes (< 8 points)`);
  }

  autoExcludeExternalTerritory(provinces, log);

  // Merge same-color adjacent provinces (handles multi-path provinces)
  const mergedCount = provinces.length;
  provinces = mergeSameColorProvinces(provinces);
  if (provinces.length < mergedCount) {
    log.push(
      `Merged ${mergedCount - provinces.length} same-color adjacent shapes (${mergedCount} → ${provinces.length} provinces)`
    );
  }

  autoExcludeTinyFragments(provinces, log);

  if (config.useTextLabels !== false && provinces.length > 0) {
    applyTextLabels(provinces, svgRoot, log);
  }

  nameGenericProvincesFromIds(provinces, log);
  numberDuplicateNames(provinces, log);

  return { provinces, viewBox, log, layersFound };
}

function findTargetContainer(
  svgRoot: XmlElement,
  targetLayer: string | undefined,
  log: string[]
): XmlElement {
  if (!targetLayer) {
    const layerResult = detectProvinceLayer(svgRoot);
    log.push(...layerResult.log);
    return layerResult.layer ?? svgRoot;
  }
  const match = findLayerByName(svgRoot, targetLayer);
  log.push(
    match
      ? `Using user-specified layer: "${targetLayer}"`
      : `Warning: layer "${targetLayer}" not found, using SVG root`
  );
  return match ?? svgRoot;
}

function emptyResultHint(filteredCount: number, rawCount: number): string {
  if (rawCount === 0) {
    return (
      "HINT: 0 provinces detected. The SVG appears to have no filled shape elements. " +
      "Try uploading a different SVG with filled province shapes (path, polygon, or rect elements with fill colors)."
    );
  }
  if (filteredCount === 0) {
    return (
      "HINT: 0 provinces detected after filtering. The SVG appears to be a line-only map " +
      "without filled regions, or all shapes were classified as decorative/topo. " +
      "Try uploading an SVG where provinces have distinct fill colors."
    );
  }
  return (
    `HINT: 0 provinces detected from ${filteredCount} shape elements. ` +
    "All shapes may have too few vertices (< 8 points) to be province boundaries."
  );
}

/** Grey: low saturation (max-min < 30) and mid-range brightness (100-240). */
function isGreyNeutral(hex: string): boolean {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length !== 6) return false;
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const maxC = Math.max(...channels);
  return maxC - Math.min(...channels) < 30 && maxC > 100 && maxC < 240;
}

/** Non-dominant fill colors with few shapes (<= 3) or grey tones are likely neighboring territory. */
function autoExcludeExternalTerritory(provinces: ProvinceFeature[], log: string[]): void {
  if (provinces.length <= 5) return;
  const colorCounts = new Map<string, number>();
  for (const p of provinces) {
    if (p.color) colorCounts.set(p.color, (colorCounts.get(p.color) ?? 0) + 1);
  }
  const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const dominantColor = sorted[0];
  if (!dominantColor || sorted.length < 2) return;

  let excludedCount = 0;
  const excludedColors: string[] = [];
  for (const [color, count] of sorted) {
    if (color === dominantColor[0] || (count > 3 && !isGreyNeutral(color))) continue;
    for (const p of provinces) {
      if (p.color === color) p.included = false;
    }
    excludedCount += count;
    excludedColors.push(`${color}(${count})`);
  }
  if (excludedCount > 0) {
    log.push(
      `Auto-excluded ${excludedCount} external territory shapes (colors: ${excludedColors.join(", ")}; dominant: ${dominantColor[0]}, ${dominantColor[1]} shapes)`
    );
  }
}

/** Provinces under 1% of the median area are fragments. */
function autoExcludeTinyFragments(provinces: ProvinceFeature[], log: string[]): void {
  if (provinces.length <= 3) return;
  const areas = provinces.map((p) => p.areaSqKm).sort((a, b) => a - b);
  const fragmentThreshold = areas[Math.floor(areas.length / 2)]! * 0.01;
  const fragments = provinces.filter((p) => p.areaSqKm < fragmentThreshold && p.areaSqKm > 0);
  for (const p of fragments) p.included = false;
  if (fragments.length > 0) {
    log.push(
      `Auto-excluded ${fragments.length} tiny fragments (area < ${fragmentThreshold.toFixed(2)} sq units)`
    );
  }
}

/** Text labels override generic or low-confidence names. */
function applyTextLabels(provinces: ProvinceFeature[], svgRoot: XmlElement, log: string[]): void {
  const labels = extractAllTextLabels(svgRoot, svgRoot);
  if (labels.length === 0) return;
  log.push(`Found ${labels.length} text labels for matching`);

  const matches = matchLabelsToProvinces(
    labels,
    provinces.map(({ centroid, bbox }) => ({ centroid, bbox }))
  );
  let matchCount = 0;
  for (const [idx, labelText] of matches) {
    const province = provinces[idx];
    if (province && (province.confidence < 0.7 || GENERIC_PROVINCE_NAME.test(province.name))) {
      province.name = labelText;
      province.confidence = 0.85;
      matchCount++;
    }
  }
  if (matchCount > 0) {
    log.push(`Matched ${matchCount} text labels to provinces`);
  }
}

/** When most names are still generic, fall back to cleaned-up group/element IDs. */
function nameGenericProvincesFromIds(provinces: ProvinceFeature[], log: string[]): void {
  const isUnnamed = (p: ProvinceFeature) =>
    GENERIC_PROVINCE_NAME.test(p.name) || p.confidence < 0.4;
  if (provinces.filter(isUnnamed).length <= provinces.length * 0.5 || provinces.length === 0) {
    return;
  }
  let cleanedCount = 0;
  for (const p of provinces.filter(isUnnamed)) {
    const cleaned = cleanGroupIdToName(p.sourceId);
    if (
      cleaned &&
      cleaned !== p.sourceId &&
      !/^(province|group|path|region)\s*\d*$/i.test(cleaned)
    ) {
      p.name = cleaned;
      p.confidence = 0.6;
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    log.push(`Extracted ${cleanedCount} province names from group/element IDs`);
  }
}

/**
 * Number provinces that share a name — this commonly happens when all provinces inherit the
 * parent layer name (e.g. "Layer 1").
 */
function numberDuplicateNames(provinces: ProvinceFeature[], log: string[]): void {
  const nameCounts = new Map<string, number>();
  for (const p of provinces) {
    nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count <= 1) continue;
    const isGenericName = /^(layer|group|svg|g)\s*\d*$/i.test(name);
    let idx = 1;
    for (const p of provinces) {
      if (p.name !== name) continue;
      p.name = isGenericName ? `Province ${idx}` : `${name} ${idx}`;
      p.confidence = Math.min(p.confidence, 0.3); // Low confidence — user should rename
      idx++;
    }
    log.push(`Renamed ${count} provinces with duplicate name "${name}" → numbered`);
  }
}

/**
 * Smart group merging: handles nested groups, respects maxMergeSize,
 * and treats sub-groups as individual provinces when appropriate.
 */
function parseWithSmartGrouping(
  shapes: XmlElement[],
  ctx: ParseCtx,
  maxMergeSize: number
): ProvinceFeature[] {
  // Group shapes by their immediate parent <g>
  const groupMap = new Map<XmlElement, XmlElement[]>();
  const ungrouped: XmlElement[] = [];

  for (const shape of shapes) {
    const parent = shape.parentNode as XmlElement | null;
    if (parent && parent !== ctx.container && isGroupElement(parent)) {
      const members = groupMap.get(parent) ?? [];
      members.push(shape);
      groupMap.set(parent, members);
    } else {
      ungrouped.push(shape);
    }
  }

  const provinces: ProvinceFeature[] = [];
  let idx = 0;
  const addSingles = (els: XmlElement[], parentGroup?: XmlElement) => {
    for (const el of els) {
      const province = parseSingleElement(el, idx++, ctx, parentGroup);
      if (province) provinces.push(province);
    }
  };
  const addMerged = (group: XmlElement, groupShapes: XmlElement[]) => {
    const province = mergeGroupShapes(group, groupShapes, idx++, ctx);
    if (province) provinces.push(province);
  };

  for (const [group, groupShapes] of groupMap) {
    // Sub-groups that each hold shapes: each sub-group is a province
    const subGroups = elementChildren(group).filter(
      (child) => isGroupElement(child) && hasShapeDescendant(child)
    );

    if (subGroups.length >= 2) {
      ctx.log.push(
        `  Group "${groupName(group)}": ${subGroups.length} sub-groups → treating each as province`
      );
      for (const subGroup of subGroups) {
        const subShapes = groupShapes.filter(
          (s) => s.parentNode === subGroup || isDescendantOf(s, subGroup)
        );
        if (subShapes.length === 0) continue;

        if (subShapes.length <= maxMergeSize) {
          addMerged(subGroup, subShapes);
        } else {
          // Too many shapes in sub-group — parse individually
          addSingles(subShapes, subGroup);
          idx++;
        }
      }
      // Shapes directly in the parent group (not in any sub-group)
      addSingles(
        groupShapes.filter((s) => s.parentNode === group),
        group
      );
    } else if (groupShapes.length > maxMergeSize) {
      ctx.log.push(
        `  Group "${groupName(group)}": ${groupShapes.length} shapes (> ${maxMergeSize}) → treating each as province`
      );
      addSingles(groupShapes, group);
    } else if (groupShapes.length === 1) {
      addSingles(groupShapes, group);
    } else {
      // Small group with meaningful name — merge (multi-part province)
      addMerged(group, groupShapes);
    }
  }

  addSingles(ungrouped);
  return provinces;
}

/** Element rings in SVG space: the shape's path with its accumulated transforms applied. */
function shapeRings(el: XmlElement, ctx: ParseCtx): Ring[] {
  const rings = elementToRings(el, ctx.bezierSegments);
  if (rings.length === 0 || !ctx.includeTransforms) return rings;
  return applyMatrixToRings(rings, getAccumulatedTransform(el, ctx.container));
}

function buildFeature(
  sourceId: string,
  { name, confidence }: { name: string; confidence: number },
  color: string | undefined,
  rings: Ring[]
): ProvinceFeature {
  return {
    sourceId,
    name,
    geometry: buildGeometry(rings),
    color,
    confidence,
    centroid: calculateCentroid(rings),
    bbox: calculateBoundingBox(rings),
    areaSqKm: calculateApproxArea(rings),
    included: true,
  };
}

/**
 * Parse a single SVG shape element into a ProvinceFeature.
 * Works for any shape type (path, polygon, rect, circle, etc.).
 */
function parseSingleElement(
  el: XmlElement,
  index: number,
  ctx: ParseCtx,
  parentGroup?: XmlElement
): ProvinceFeature | null {
  const sourceId = el.getAttribute("id") || `province_${index}`;
  const color = extractFillColor(el, el.getAttribute("style") || "") ?? undefined;

  try {
    const rings = shapeRings(el, ctx);
    if (rings.length === 0) {
      ctx.log.push(`  Skipping ${sourceId}: no valid rings`);
      return null;
    }

    const validRings = rings.filter((ring) => ring.length >= ctx.minRingSize);
    if (validRings.length === 0) {
      ctx.log.push(
        `  Skipping ${sourceId}: all rings too small (${rings.map((r) => r.length).join(",")} pts)`
      );
      return null;
    }

    return buildFeature(sourceId, detectProvinceName(el, sourceId, parentGroup), color, validRings);
  } catch (err) {
    ctx.log.push(
      `  Error parsing ${sourceId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/** Merge multiple shapes from a group into a single province. */
function mergeGroupShapes(
  group: XmlElement,
  shapes: XmlElement[],
  index: number,
  ctx: ParseCtx
): ProvinceFeature | null {
  const groupId = group.getAttribute("id") || `group_${index}`;
  const named = detectProvinceName(null, groupId, group);

  const color =
    shapes.map((el) => extractFillColor(el, el.getAttribute("style") || "")).find(Boolean) ??
    undefined;

  const allRings = shapes.flatMap((el) => {
    try {
      return shapeRings(el, ctx).filter((ring) => ring.length >= ctx.minRingSize);
    } catch {
      return []; // Skip malformed elements
    }
  });

  if (allRings.length === 0) {
    ctx.log.push(`  Skipping group "${named.name}": no valid rings from ${shapes.length} shapes`);
    return null;
  }

  ctx.log.push(
    `  Merged ${shapes.length} shapes into province "${named.name}" (${allRings.length} rings)`
  );
  return buildFeature(groupId, named, color, allRings);
}

/**
 * Detect province name from SVG element attributes: the element itself, then its parent group,
 * then the grandparent group (each with lower confidence), else a name generated from the ID.
 */
function detectProvinceName(
  el: XmlElement | null,
  fallbackId: string,
  parentGroup?: XmlElement
): { name: string; confidence: number } {
  const isNamedGroup = (n: XmlElement | null | undefined): n is XmlElement =>
    !!n && isGroupElement(n) && n.localName !== "svg";
  const elParent = el?.parentNode as XmlElement | null | undefined;
  const parent = parentGroup ?? (isNamedGroup(elParent) ? elParent : null);
  const grandparent = parent?.parentNode as XmlElement | null | undefined;

  const candidates: [XmlElement | null | undefined, number, number, number][] = [
    [el, 1.0, 0.95, 0.8],
    [parent, 0.9, 0.85, 0.7],
    [isNamedGroup(grandparent) ? grandparent : null, 0.75, 0.7, 0.6],
  ];
  for (const [node, labelConf, dataNameConf, idConf] of candidates) {
    const result = node && extractNameFromElement(node, labelConf, dataNameConf, idConf);
    if (result) return result;
  }
  return { name: featureIdToDisplayName(fallbackId), confidence: 0.3 };
}

/** Try to extract a meaningful name from an element's attributes. */
function extractNameFromElement(
  el: XmlElement,
  labelConf: number,
  dataNameConf: number,
  idConf: number
): { name: string; confidence: number } | null {
  const named: [string | null, number][] = [
    [inkscapeLabel(el), labelConf],
    [el.getAttribute("data-name"), dataNameConf],
    [el.getAttribute("aria-label"), dataNameConf],
  ];
  for (const [value, confidence] of named) {
    if (value && !isGenericId(value)) return { name: value, confidence };
  }

  const elId = el.getAttribute("id") || "";
  return elId && !isGenericId(elId)
    ? { name: featureIdToDisplayName(elId), confidence: idConf }
    : null;
}

/**
 * Check if an ID is a generic auto-generated name, e.g. "path123", "g45", "Layer 1", "layer1",
 * "rect_2".
 */
function isGenericId(id: string): boolean {
  return /^(path|rect|g|layer|use|circle|ellipse|line|polygon|polyline|image|text|tspan|svg|defs|clip|mask|_x[0-9A-Fa-f]+_)[\s_-]*\d*$/i.test(
    id.trim()
  );
}

/**
 * Build a Polygon or MultiPolygon from coordinate rings.
 * Closes rings if needed, detects outer vs hole rings by winding order.
 */
function buildGeometry(rings: Ring[]): Polygon | MultiPolygon {
  const closedRings = rings.map((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first && last && (first[0] !== last[0] || first[1] !== last[1])
      ? [...ring, first]
      : ring;
  });

  if (closedRings.length === 1) {
    const ring = closedRings[0]!;
    // Ensure outer ring is CCW (positive signed area) per GeoJSON RFC 7946
    return {
      type: "Polygon",
      coordinates: [ringArea(ring as Position[]) < 0 ? ring.slice().reverse() : ring],
    };
  }

  // Outer rings are CCW (positive area), holes CW
  const outerRings = closedRings.filter((r) => ringArea(r as Position[]) > 0);
  const holeRings = closedRings.filter((r) => ringArea(r as Position[]) <= 0);

  // All rings are CW — reverse them to make outer rings
  if (outerRings.length === 0) {
    return { type: "MultiPolygon", coordinates: closedRings.map((r) => [r.slice().reverse()]) };
  }

  if (outerRings.length === 1 && holeRings.length > 0) {
    return {
      type: "Polygon",
      coordinates: [outerRings[0]!, ...holeRings.map((r) => r.slice().reverse())],
    };
  }

  // Multiple outer rings → MultiPolygon, each hole going to the outer ring containing it
  // (else the nearest outer by centroid distance)
  const outerWithHoles: Ring[][] = outerRings.map((outer) => [outer]);
  const outerCentroids = outerRings.map(ringCentroid);

  for (const hole of holeRings) {
    const holeCentroid = ringCentroid(hole);
    const containing = outerRings.findIndex((outer) => pointInRing(holeCentroid, outer));
    const nearest = outerCentroids.reduce(
      (best, c, i) => {
        const dist = (c[0] - holeCentroid[0]) ** 2 + (c[1] - holeCentroid[1]) ** 2;
        return dist < best.dist ? { dist, idx: i } : best;
      },
      { dist: Infinity, idx: 0 }
    ).idx;
    outerWithHoles[containing === -1 ? nearest : containing]!.push(hole.slice().reverse());
  }

  return { type: "MultiPolygon", coordinates: outerWithHoles };
}

function countGeometryVertices(geom: Polygon | MultiPolygon): number {
  const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polygons.flat().reduce((sum, ring) => sum + ring.length, 0);
}

function extractViewBox(svgRoot: XmlElement): { width: number; height: number } {
  const parts =
    svgRoot
      .getAttribute("viewBox")
      ?.split(/[\s,]+/)
      .map(Number) ?? [];
  if (parts.length >= 4 && parts[2] !== 0) {
    return { width: parts[2]!, height: parts[3]! };
  }
  return {
    width: parseFloat(svgRoot.getAttribute("width") || "0"),
    height: parseFloat(svgRoot.getAttribute("height") || "0"),
  };
}

function isGroupElement(el: XmlElement): boolean {
  return svgTag(el) === "g";
}

function hasShapeDescendant(el: XmlElement): boolean {
  return elementChildren(el).some(
    (child) => SHAPE_TAGS.has(svgTag(child)) || (isGroupElement(child) && hasShapeDescendant(child))
  );
}

function isDescendantOf(el: XmlElement, ancestor: XmlElement): boolean {
  return ancestorElements(el).includes(ancestor);
}

function findLayerByName(svgRoot: XmlElement, name: string): XmlElement | null {
  const lower = name.toLowerCase();
  return (
    [...svgRoot.getElementsByTagNameNS(SVG_NS, "g")].find((g) =>
      groupName(g).toLowerCase().includes(lower)
    ) ?? null
  );
}

/**
 * Merge provinces that share the same fill color and have overlapping/touching bboxes.
 * Handles SVGs where a single province is drawn as multiple path segments.
 */
function mergeSameColorProvinces(provinces: ProvinceFeature[]): ProvinceFeature[] {
  if (provinces.length < 2) return provinces;

  const byColor = new Map<string, ProvinceFeature[]>();
  const noColor: ProvinceFeature[] = [];
  for (const p of provinces) {
    const color = p.color?.toLowerCase().trim();
    if (!color) {
      noColor.push(p);
    } else {
      const members = byColor.get(color) ?? [];
      members.push(p);
      byColor.set(color, members);
    }
  }

  const mergeColorGroup = (group: ProvinceFeature[]): ProvinceFeature[] =>
    // Many shapes (>8) sharing a color are likely distinct provinces that just share a fill
    group.length === 1 || group.length > 8
      ? group
      : clusterByProximity(group).map((c) => (c.length === 1 ? c[0]! : mergeProvinceCluster(c)));

  return [...noColor, ...[...byColor.values()].flatMap(mergeColorGroup)];
}

/** Group provinces whose bboxes overlap or touch. */
function clusterByProximity(provinces: ProvinceFeature[]): ProvinceFeature[][] {
  const visited = new Set<number>();
  const clusters: ProvinceFeature[][] = [];

  for (let i = 0; i < provinces.length; i++) {
    if (visited.has(i)) continue;
    const cluster: ProvinceFeature[] = [];
    const stack = [i];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx)) continue;
      visited.add(idx);
      cluster.push(provinces[idx]!);

      for (let j = 0; j < provinces.length; j++) {
        if (!visited.has(j) && bboxOverlaps(provinces[idx]!.bbox, provinces[j]!.bbox, 0.5)) {
          stack.push(j);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/** Check if two bboxes overlap with a margin. */
function bboxOverlaps(
  a: [number, number, number, number],
  b: [number, number, number, number],
  margin: number
): boolean {
  return !(
    a[2] + margin < b[0] ||
    b[2] + margin < a[0] ||
    a[3] + margin < b[1] ||
    b[3] + margin < a[1]
  );
}

/** Merge a cluster of same-color provinces into a single MultiPolygon province. */
function mergeProvinceCluster(cluster: ProvinceFeature[]): ProvinceFeature {
  // Use the highest-confidence name
  const best = cluster.reduce((b, p) => (p.confidence > b.confidence ? p : b), cluster[0]!);

  const allCoords = cluster.flatMap((p) =>
    p.geometry.type === "Polygon" ? [p.geometry.coordinates] : p.geometry.coordinates
  ) as Ring[][];

  // Recalculate centroid and bbox from merged geometry
  const allOuters = allCoords.map((c) => c[0]!).flat();
  const lngs = allOuters.map((p) => p[0]);
  const lats = allOuters.map((p) => p[1]);

  return {
    sourceId: best.sourceId,
    name: best.name,
    geometry: { type: "MultiPolygon", coordinates: allCoords },
    color: best.color,
    confidence: best.confidence,
    centroid: [
      lngs.reduce((s, x) => s + x, 0) / allOuters.length,
      lats.reduce((s, y) => s + y, 0) / allOuters.length,
    ],
    bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    areaSqKm: cluster.reduce((s, p) => s + p.areaSqKm, 0),
    included: true,
  };
}

/** Centroid of a coordinate ring, excluding a closing duplicate point. */
function ringCentroid(ring: Ring): [number, number] {
  const closed =
    ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1];
  const points = closed ? ring.slice(0, -1) : ring;
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
}

/**
 * Clean a group/element ID into a human-readable province name, e.g. "baía-sul-rg" → "Baía Sul"
 * and "nova_terra_pb" → "Nova Terra": drops common trailing abbreviations (rg, av, pb, sr, wasg,
 * ...), turns separators into spaces and capitalizes each word (accents preserved).
 */
function cleanGroupIdToName(id: string): string {
  return id
    .replace(/[-_](rg|av|pb|sr|wasg|dist|prov|reg|cty|adm|sub|div)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Ray-casting point-in-ring test. */
function pointInRing(point: [number, number], ring: Ring): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
