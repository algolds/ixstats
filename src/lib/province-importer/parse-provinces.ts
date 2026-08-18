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
} from "~/lib/flags/svg-parser;
import { elementToRings, SHAPE_TAGS } from "./svg-element-converter";
import { getAccumulatedTransform, applyMatrixToRings, isIdentity } from "./svg-transform";
import {
  detectProvinceLayer,
  collectShapeElements,
  filterProvinceShapes,
} from "./svg-layer-detector";
import { extractAllTextLabels, matchLabelsToProvinces } from "./svg-text-matcher";

const SVG_NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

// ──────────────────────────────────────────────
// Main Entry Point
// ──────────────────────────────────────────────

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
  const bezierSegments = config.bezierSegments ?? 8;
  const minRingSize = config.minRingSize ?? 4;
  const mergeGrouped = config.mergeGroupedPaths !== false;
  const maxMergeSize = config.maxMergeSize ?? 4;
  const useTextLabels = config.useTextLabels !== false;
  const includeTransforms = config.includeTransforms !== false;

  // Sanitize SVG content
  const sanitized = sanitizeSvg(svgContent);

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    throw new Error("Failed to parse SVG: no root element found");
  }

  // Extract viewBox
  const viewBox = extractViewBox(svgRoot);
  log.push(`SVG viewBox: ${viewBox.width} × ${viewBox.height}`);

  // Detect province layer
  let targetContainer: Element = svgRoot;
  const layersFound: string[] = [];

  if (config.targetLayer) {
    // User-specified layer — find by name/id
    const match = findLayerByName(svgRoot, config.targetLayer);
    if (match) {
      targetContainer = match;
      log.push(`Using user-specified layer: "${config.targetLayer}"`);
    } else {
      log.push(`Warning: layer "${config.targetLayer}" not found, using SVG root`);
    }
  } else {
    // Auto-detect
    const layerResult = detectProvinceLayer(svgRoot);
    log.push(...layerResult.log);
    if (layerResult.layer) {
      targetContainer = layerResult.layer;
    }
  }

  // Collect top-level group names for info
  const topGroups = svgRoot.getElementsByTagNameNS(SVG_NS, "g");
  for (let i = 0; i < topGroups.length; i++) {
    const g = topGroups[i]!;
    if (g.parentNode !== svgRoot) continue;
    const name =
      g.getAttributeNS(INKSCAPE_NS, "label") ||
      g.getAttribute("inkscape:label") ||
      g.getAttribute("id") ||
      "";
    if (name) layersFound.push(name);
  }
  log.push(`Top-level layers: ${layersFound.join(", ") || "none"}`);

  // Collect all shape elements from the target container
  const rawShapes = collectShapeElements(targetContainer, svgRoot);
  log.push(`Raw shape elements: ${rawShapes.length}`);

  // Filter to province-like shapes (removes topo fills, water, decorative elements)
  const allShapes = filterProvinceShapes(rawShapes, svgRoot, log);

  const tagCounts = new Map<string, number>();
  for (const s of allShapes) {
    const tag = s.localName ?? s.tagName?.split(":").pop() ?? "";
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  log.push(
    `Filtered shape elements: ${allShapes.length} (${[...tagCounts.entries()].map(([k, v]) => `${v} ${k}`).join(", ")})`
  );

  // Parse provinces
  let provinces: ProvinceFeature[];

  if (mergeGrouped) {
    provinces = parseWithSmartGrouping(
      allShapes,
      targetContainer,
      bezierSegments,
      minRingSize,
      maxMergeSize,
      includeTransforms,
      log
    );
  } else {
    provinces = parseIndividual(
      allShapes,
      targetContainer,
      bezierSegments,
      minRingSize,
      includeTransforms,
      log
    );
  }

  log.push(`Detected ${provinces.length} provinces from ${allShapes.length} shape elements`);

  if (provinces.length === 0 && allShapes.length === 0 && rawShapes.length === 0) {
    log.push(
      "HINT: 0 provinces detected. The SVG appears to have no filled shape elements. " +
        "Try uploading a different SVG with filled province shapes (path, polygon, or rect elements with fill colors)."
    );
  } else if (provinces.length === 0 && allShapes.length === 0 && rawShapes.length > 0) {
    log.push(
      "HINT: 0 provinces detected after filtering. The SVG appears to be a line-only map " +
        "without filled regions, or all shapes were classified as decorative/topo. " +
        "Try uploading an SVG where provinces have distinct fill colors."
    );
  } else if (provinces.length === 0 && allShapes.length > 0) {
    log.push(
      "HINT: 0 provinces detected from " +
        allShapes.length +
        " shape elements. " +
        "All shapes may have too few vertices (< 8 points) to be province boundaries."
    );
  }

  // Filter out shapes with too few vertices (likely markers/decorations, not boundaries)
  const preFilterCount = provinces.length;
  provinces = provinces.filter((p) => {
    const vertexCount = countGeometryVertices(p.geometry);
    return vertexCount >= 8; // Real province boundaries have 8+ vertices minimum
  });
  if (provinces.length < preFilterCount) {
    log.push(`Filtered ${preFilterCount - provinces.length} low-vertex shapes (< 8 points)`);
  }

  // Auto-exclude non-dominant fill colors (likely external/neighboring territory)
  if (provinces.length > 5) {
    const colorCounts = new Map<string, number>();
    for (const p of provinces) {
      if (p.color) colorCounts.set(p.color, (colorCounts.get(p.color) ?? 0) + 1);
    }
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
    const dominantColor = sorted[0];
    if (dominantColor && sorted.length >= 2) {
      let excludedCount = 0;
      const excludedColors: string[] = [];

      // Grey/neutral colors are likely external territory markers
      const isGreyNeutral = (hex: string) => {
        const h = hex.replace("#", "").toLowerCase();
        if (h.length !== 6) return false;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        // Grey: low saturation (max-min < 30) AND mid-range brightness (100-240)
        return maxC - minC < 30 && maxC > 100 && maxC < 240;
      };

      for (const [color, count] of sorted) {
        if (color === dominantColor[0]) continue;

        // Exclude if: few shapes (<=3) OR grey/neutral color (external territory)
        const shouldExclude = count <= 3 || isGreyNeutral(color);

        if (shouldExclude) {
          for (const p of provinces) {
            if (p.color === color) {
              p.included = false;
              excludedCount++;
            }
          }
          excludedColors.push(`${color}(${count})`);
        }
      }
      if (excludedCount > 0) {
        log.push(
          `Auto-excluded ${excludedCount} external territory shapes (colors: ${excludedColors.join(", ")}; dominant: ${dominantColor[0]}, ${dominantColor[1]} shapes)`
        );
      }
    }
  }

  // Merge same-color adjacent provinces (handles multi-path provinces)
  const mergedCount = provinces.length;
  provinces = mergeSameColorProvinces(provinces);
  if (provinces.length < mergedCount) {
    log.push(
      `Merged ${mergedCount - provinces.length} same-color adjacent shapes (${mergedCount} → ${provinces.length} provinces)`
    );
  }

  // Auto-exclude tiny fragments (< 1% of median province area)
  if (provinces.length > 3) {
    const areas = provinces.map((p) => p.areaSqKm).sort((a, b) => a - b);
    const medianArea = areas[Math.floor(areas.length / 2)]!;
    const fragmentThreshold = medianArea * 0.01;
    let fragCount = 0;

    for (const p of provinces) {
      if (p.areaSqKm < fragmentThreshold && p.areaSqKm > 0) {
        p.included = false;
        fragCount++;
      }
    }

    if (fragCount > 0) {
      log.push(
        `Auto-excluded ${fragCount} tiny fragments (area < ${fragmentThreshold.toFixed(2)} sq units)`
      );
    }
  }

  // Match text labels to provinces with low-confidence names
  if (useTextLabels && provinces.length > 0) {
    const labels = extractAllTextLabels(svgRoot, svgRoot);
    if (labels.length > 0) {
      log.push(`Found ${labels.length} text labels for matching`);

      const spatialInfo = provinces.map((p) => ({
        centroid: p.centroid,
        bbox: p.bbox,
      }));

      const matches = matchLabelsToProvinces(labels, spatialInfo);
      let matchCount = 0;
      for (const [idx, labelText] of matches) {
        if (idx < provinces.length) {
          // Text labels always override generic names like "Province 1"
          const isGeneric = /^(Province|Region|District)\s+\d+$/i.test(provinces[idx]!.name);
          if (provinces[idx]!.confidence < 0.7 || isGeneric) {
            provinces[idx]!.name = labelText;
            provinces[idx]!.confidence = 0.85;
            matchCount++;
          }
        }
      }
      if (matchCount > 0) {
        log.push(`Matched ${matchCount} text labels to provinces`);
      }
    }
  }

  // Fallback: if many provinces still have generic names, try extracting names from group IDs
  const genericCount = provinces.filter(
    (p) => /^(Province|Region|District)\s+\d+$/i.test(p.name) || p.confidence < 0.4
  ).length;
  if (genericCount > provinces.length * 0.5 && provinces.length > 0) {
    let cleanedCount = 0;
    for (const p of provinces) {
      if (/^(Province|Region|District)\s+\d+$/i.test(p.name) || p.confidence < 0.4) {
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
    }
    if (cleanedCount > 0) {
      log.push(`Extracted ${cleanedCount} province names from group/element IDs`);
    }
  }

  // Deduplicate names — if multiple provinces share the same name, append a number.
  // This commonly happens when all provinces inherit the parent layer name (e.g., "Layer 1").
  const nameCounts = new Map<string, number>();
  for (const p of provinces) {
    nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count <= 1) continue;
    // All provinces with this name get numbered, or fallback to "Province N"
    let idx = 1;
    const isGenericName = /^(layer|group|svg|g)\s*\d*$/i.test(name);
    for (const p of provinces) {
      if (p.name === name) {
        p.name = isGenericName ? `Province ${idx}` : `${name} ${idx}`;
        p.confidence = Math.min(p.confidence, 0.3); // Low confidence — user should rename
        idx++;
      }
    }
    log.push(`Renamed ${count} provinces with duplicate name "${name}" → numbered`);
  }

  return { provinces, viewBox, log, layersFound };
}

// ──────────────────────────────────────────────
// Parsing Strategies
// ──────────────────────────────────────────────

/**
 * Parse each shape element individually (no group merging).
 */
function parseIndividual(
  shapes: Element[],
  container: Element,
  bezierSegments: number,
  minRingSize: number,
  includeTransforms: boolean,
  log: string[]
): ProvinceFeature[] {
  const provinces: ProvinceFeature[] = [];

  for (let i = 0; i < shapes.length; i++) {
    const result = parseSingleElement(
      shapes[i]!,
      i,
      container,
      bezierSegments,
      minRingSize,
      includeTransforms,
      log
    );
    if (result) provinces.push(result);
  }

  return provinces;
}

/**
 * Smart group merging: handles nested groups, respects maxMergeSize,
 * and treats sub-groups as individual provinces when appropriate.
 */
function parseWithSmartGrouping(
  shapes: Element[],
  container: Element,
  bezierSegments: number,
  minRingSize: number,
  maxMergeSize: number,
  includeTransforms: boolean,
  log: string[]
): ProvinceFeature[] {
  // Group shapes by their immediate parent <g>
  const groupMap = new Map<Element, Element[]>();
  const ungrouped: Element[] = [];

  for (const shape of shapes) {
    const parent = shape.parentNode as Element | null;

    if (parent && parent !== container && isGroupElement(parent)) {
      const existing = groupMap.get(parent) ?? [];
      existing.push(shape);
      groupMap.set(parent, existing);
    } else {
      ungrouped.push(shape);
    }
  }

  const provinces: ProvinceFeature[] = [];
  let idx = 0;

  for (const [group, groupShapes] of groupMap) {
    // Check if this group has sub-groups (each sub-group = province)
    const subGroups = getDirectSubGroups(group);

    if (subGroups.length >= 2) {
      // Nested group structure: recurse into each sub-group
      log.push(
        `  Group "${getGroupName(group)}": ${subGroups.length} sub-groups → treating each as province`
      );
      for (const subGroup of subGroups) {
        const subShapes = groupShapes.filter(
          (s) => s.parentNode === subGroup || isDescendantOf(s, subGroup)
        );
        if (subShapes.length === 0) continue;

        if (subShapes.length <= maxMergeSize) {
          const result = mergeGroupShapes(
            subGroup,
            subShapes,
            idx,
            container,
            bezierSegments,
            minRingSize,
            includeTransforms,
            log
          );
          if (result) provinces.push(result);
        } else {
          // Too many shapes in sub-group — parse individually
          for (const shape of subShapes) {
            const result = parseSingleElement(
              shape,
              idx,
              container,
              bezierSegments,
              minRingSize,
              includeTransforms,
              log,
              subGroup
            );
            if (result) provinces.push(result);
            idx++;
          }
        }
        idx++;
      }

      // Also handle shapes directly in the parent group (not in any sub-group)
      const directShapes = groupShapes.filter((s) => s.parentNode === group);
      for (const shape of directShapes) {
        const result = parseSingleElement(
          shape,
          idx,
          container,
          bezierSegments,
          minRingSize,
          includeTransforms,
          log,
          group
        );
        if (result) provinces.push(result);
        idx++;
      }
    } else if (groupShapes.length > maxMergeSize) {
      // Too many shapes for one group — split into individual provinces
      const groupName = getGroupName(group);
      log.push(
        `  Group "${groupName}": ${groupShapes.length} shapes (> ${maxMergeSize}) → treating each as province`
      );
      for (const shape of groupShapes) {
        const result = parseSingleElement(
          shape,
          idx,
          container,
          bezierSegments,
          minRingSize,
          includeTransforms,
          log,
          group
        );
        if (result) provinces.push(result);
        idx++;
      }
    } else if (groupShapes.length === 1) {
      // Single shape in group — individual province
      const result = parseSingleElement(
        groupShapes[0]!,
        idx,
        container,
        bezierSegments,
        minRingSize,
        includeTransforms,
        log,
        group
      );
      if (result) provinces.push(result);
      idx++;
    } else {
      // Small group with meaningful name — merge (multi-part province)
      const result = mergeGroupShapes(
        group,
        groupShapes,
        idx,
        container,
        bezierSegments,
        minRingSize,
        includeTransforms,
        log
      );
      if (result) provinces.push(result);
      idx++;
    }
  }

  // Process ungrouped shapes
  for (const shape of ungrouped) {
    const result = parseSingleElement(
      shape,
      idx,
      container,
      bezierSegments,
      minRingSize,
      includeTransforms,
      log
    );
    if (result) provinces.push(result);
    idx++;
  }

  return provinces;
}

// ──────────────────────────────────────────────
// Element Parsing
// ──────────────────────────────────────────────

/**
 * Parse a single SVG shape element into a ProvinceFeature.
 * Works for any shape type (path, polygon, rect, circle, etc.).
 */
function parseSingleElement(
  el: Element,
  index: number,
  transformRoot: Element,
  bezierSegments: number,
  minRingSize: number,
  includeTransforms: boolean,
  log: string[],
  parentGroup?: Element
): ProvinceFeature | null {
  const sourceId = el.getAttribute("id") || `province_${index}`;
  const { name, confidence } = detectProvinceName(el, sourceId, parentGroup);
  const style = el.getAttribute("style") || "";
  const color = extractFillColor(el, style) ?? undefined;

  try {
    let rings = elementToRings(el, bezierSegments);

    if (rings.length === 0) {
      log.push(`  Skipping ${sourceId}: no valid rings`);
      return null;
    }

    // Apply accumulated transforms
    if (includeTransforms) {
      const matrix = getAccumulatedTransform(el, transformRoot);
      if (!isIdentity(matrix)) {
        rings = applyMatrixToRings(rings, matrix);
      }
    }

    const validRings = rings.filter((ring) => ring.length >= minRingSize);
    if (validRings.length === 0) {
      log.push(
        `  Skipping ${sourceId}: all rings too small (${rings.map((r) => r.length).join(",")} pts)`
      );
      return null;
    }

    const geometry = buildGeometry(validRings);
    const centroid = calculateCentroid(validRings);
    const bbox = calculateBoundingBox(validRings);
    const area = calculateApproxArea(validRings);

    return {
      sourceId,
      name,
      geometry,
      color,
      confidence,
      centroid,
      bbox,
      areaSqKm: area,
      included: true,
    };
  } catch (err) {
    log.push(`  Error parsing ${sourceId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Merge multiple shapes from a group into a single province.
 */
function mergeGroupShapes(
  group: Element,
  shapes: Element[],
  index: number,
  transformRoot: Element,
  bezierSegments: number,
  minRingSize: number,
  includeTransforms: boolean,
  log: string[]
): ProvinceFeature | null {
  const groupId = group.getAttribute("id") || `group_${index}`;
  const { name, confidence } = detectProvinceName(null, groupId, group);

  let color: string | undefined;
  const allRings: [number, number][][] = [];

  for (const el of shapes) {
    if (!color) {
      const style = el.getAttribute("style") || "";
      color = extractFillColor(el, style) ?? undefined;
    }

    try {
      let rings = elementToRings(el, bezierSegments);

      if (includeTransforms) {
        const matrix = getAccumulatedTransform(el, transformRoot);
        if (!isIdentity(matrix)) {
          rings = applyMatrixToRings(rings, matrix);
        }
      }

      for (const ring of rings) {
        if (ring.length >= minRingSize) {
          allRings.push(ring);
        }
      }
    } catch {
      // Skip malformed elements
    }
  }

  if (allRings.length === 0) {
    log.push(`  Skipping group "${name}": no valid rings from ${shapes.length} shapes`);
    return null;
  }

  const geometry = buildGeometry(allRings);
  const centroid = calculateCentroid(allRings);
  const bbox = calculateBoundingBox(allRings);
  const area = calculateApproxArea(allRings);

  log.push(`  Merged ${shapes.length} shapes into province "${name}" (${allRings.length} rings)`);

  return {
    sourceId: groupId,
    name,
    geometry,
    color,
    confidence,
    centroid,
    bbox,
    areaSqKm: area,
    included: true,
  };
}

// ──────────────────────────────────────────────
// Name Detection
// ──────────────────────────────────────────────

/**
 * Detect province name from SVG element attributes.
 * Searches up to 2 levels of parent groups for names.
 * Priority:
 *   1. inkscape:label on the element
 *   2. data-name attribute
 *   3. id attribute → converted to display name
 *   4. Parent group attributes (same priority order)
 *   5. Grandparent group attributes
 *   6. Fallback: generated from element ID
 */
function detectProvinceName(
  el: Element | null,
  fallbackId: string,
  parentGroup?: Element
): { name: string; confidence: number } {
  // Check element's own attributes
  if (el) {
    const result = extractNameFromElement(el, 1.0, 0.95, 0.8);
    if (result) return result;
  }

  // Check parent group
  if (parentGroup) {
    const result = extractNameFromElement(parentGroup, 0.9, 0.85, 0.7);
    if (result) return result;

    // Check grandparent group
    const grandparent = parentGroup.parentNode as Element | null;
    if (grandparent && isGroupElement(grandparent) && grandparent.localName !== "svg") {
      const gpResult = extractNameFromElement(grandparent, 0.75, 0.7, 0.6);
      if (gpResult) return gpResult;
    }
  }

  // Check parent if no explicit parentGroup was provided
  if (!parentGroup && el) {
    const parent = el.parentNode as Element | null;
    if (parent && isGroupElement(parent) && parent.localName !== "svg") {
      const result = extractNameFromElement(parent, 0.9, 0.85, 0.7);
      if (result) return result;

      // Grandparent
      const gp = parent.parentNode as Element | null;
      if (gp && isGroupElement(gp) && gp.localName !== "svg") {
        const gpResult = extractNameFromElement(gp, 0.75, 0.7, 0.6);
        if (gpResult) return gpResult;
      }
    }
  }

  // Fallback
  return { name: featureIdToDisplayName(fallbackId), confidence: 0.3 };
}

/** Try to extract a meaningful name from an element's attributes. */
function extractNameFromElement(
  el: Element,
  labelConf: number,
  dataNameConf: number,
  idConf: number
): { name: string; confidence: number } | null {
  const label = el.getAttributeNS(INKSCAPE_NS, "label") || el.getAttribute("inkscape:label");
  if (label && !isGenericId(label)) {
    return { name: label, confidence: labelConf };
  }

  const dataName = el.getAttribute("data-name");
  if (dataName && !isGenericId(dataName)) {
    return { name: dataName, confidence: dataNameConf };
  }

  // Also check aria-label and title attributes
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && !isGenericId(ariaLabel)) {
    return { name: ariaLabel, confidence: dataNameConf };
  }

  const elId = el.getAttribute("id") || "";
  if (elId && !isGenericId(elId)) {
    return { name: featureIdToDisplayName(elId), confidence: idConf };
  }

  return null;
}

/**
 * Check if an ID is a generic auto-generated name.
 * Expanded to catch more editor-generated patterns.
 */
function isGenericId(id: string): boolean {
  // Match SVG auto-generated IDs like "path123", "g45", "Layer 1", "layer1", "rect_2"
  return /^(path|rect|g|layer|use|circle|ellipse|line|polygon|polyline|image|text|tspan|svg|defs|clip|mask|_x[0-9A-Fa-f]+_)[\s_-]*\d*$/i.test(
    id.trim()
  );
}

// ──────────────────────────────────────────────
// Geometry Building
// ──────────────────────────────────────────────

/**
 * Build a Polygon or MultiPolygon from coordinate rings.
 * Closes rings if needed, detects outer vs hole rings by winding order.
 */
function buildGeometry(rings: [number, number][][]): Polygon | MultiPolygon {
  // Close rings
  const closedRings = rings.map((ring) => {
    if (
      ring.length > 0 &&
      (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])
    ) {
      return [...ring, ring[0]!];
    }
    return ring;
  });

  if (closedRings.length === 1) {
    const ring = closedRings[0]!;
    // Ensure outer ring is CCW (positive signed area) per GeoJSON RFC 7946
    const area = ringArea(ring as Position[]);
    return {
      type: "Polygon",
      coordinates: [area < 0 ? ring.slice().reverse() : ring],
    };
  }

  // Separate outer rings (positive area / CCW) from holes (negative / CW)
  const outerRings = closedRings.filter((r) => ringArea(r as Position[]) > 0);
  const holeRings = closedRings.filter((r) => ringArea(r as Position[]) <= 0);

  if (outerRings.length === 0) {
    // All rings are CW — reverse them to make outer rings
    return closedRings.length === 1
      ? { type: "Polygon", coordinates: [closedRings[0]!.slice().reverse()] }
      : {
          type: "MultiPolygon",
          coordinates: closedRings.map((r) => [r.slice().reverse()]),
        };
  }

  if (outerRings.length === 1 && holeRings.length > 0) {
    return {
      type: "Polygon",
      coordinates: [outerRings[0]!, ...holeRings.map((r) => r.slice().reverse())],
    };
  }

  // Multiple outer rings → MultiPolygon with holes assigned to containing outers
  const outerWithHoles: [number, number][][][] = outerRings.map((outer) => [outer]);

  for (const hole of holeRings) {
    // Find which outer ring contains this hole (test hole centroid)
    const holeCentroid = ringCentroid(hole);
    let assigned = false;

    for (let i = 0; i < outerRings.length; i++) {
      if (pointInRing(holeCentroid, outerRings[i]!)) {
        outerWithHoles[i]!.push(hole.slice().reverse());
        assigned = true;
        break;
      }
    }

    // If no outer contains the hole, assign to nearest outer by centroid distance
    if (!assigned && outerRings.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < outerRings.length; i++) {
        const outerC = ringCentroid(outerRings[i]!);
        const dx = outerC[0] - holeCentroid[0];
        const dy = outerC[1] - holeCentroid[1];
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      outerWithHoles[bestIdx]!.push(hole.slice().reverse());
    }
  }

  return {
    type: "MultiPolygon",
    coordinates: outerWithHoles,
  };
}

// ──────────────────────────────────────────────
// SVG Sanitization
// ──────────────────────────────────────────────

function sanitizeSvg(svgContent: string): string {
  return svgContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/href\s*=\s*'javascript:[^']*'/gi, "")
    .replace(/xlink:href\s*=\s*"https?:\/\/[^"]*"/gi, "")
    .replace(/xlink:href\s*=\s*'https?:\/\/[^']*'/gi, "");
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Count total vertices in a GeoJSON geometry. */
function countGeometryVertices(geom: Polygon | MultiPolygon): number {
  if (geom.type === "Polygon") {
    return geom.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  }
  return geom.coordinates.reduce(
    (sum, poly) => sum + poly.reduce((s, ring) => s + ring.length, 0),
    0
  );
}

function extractViewBox(svgRoot: Element): { width: number; height: number } {
  const viewBoxAttr = svgRoot.getAttribute("viewBox");
  let w = 0;
  let h = 0;
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      w = parts[2]!;
      h = parts[3]!;
    }
  }
  if (w === 0) {
    w = parseFloat(svgRoot.getAttribute("width") || "0");
    h = parseFloat(svgRoot.getAttribute("height") || "0");
  }
  return { width: w, height: h };
}

function getGroupName(g: Element): string {
  return (
    g.getAttributeNS(INKSCAPE_NS, "label") ||
    g.getAttribute("inkscape:label") ||
    g.getAttribute("data-name") ||
    g.getAttribute("id") ||
    ""
  );
}

function isGroupElement(el: Element): boolean {
  const tag = el.localName ?? el.tagName?.split(":").pop() ?? "";
  return tag === "g";
}

function getDirectSubGroups(group: Element): Element[] {
  const result: Element[] = [];
  const children = group.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    if (isGroupElement(child)) {
      // Only count sub-groups that contain shapes
      const hasShape = hasShapeDescendant(child);
      if (hasShape) result.push(child);
    }
  }
  return result;
}

function hasShapeDescendant(el: Element): boolean {
  const children = el.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (!child || child.nodeType !== 1) continue;
    const tag = child.localName ?? child.tagName?.split(":").pop() ?? "";
    if (SHAPE_TAGS.has(tag)) return true;
    if (tag === "g" && hasShapeDescendant(child)) return true;
  }
  return false;
}

function isDescendantOf(el: Element, ancestor: Element): boolean {
  let current = el.parentNode as Element | null;
  while (current) {
    if (current === ancestor) return true;
    current = current.parentNode as Element | null;
  }
  return false;
}

function findLayerByName(svgRoot: Element, name: string): Element | null {
  const lower = name.toLowerCase();
  const allGroups = svgRoot.getElementsByTagNameNS(SVG_NS, "g");
  for (let i = 0; i < allGroups.length; i++) {
    const g = allGroups[i]!;
    const gName = getGroupName(g).toLowerCase();
    if (gName === lower || gName.includes(lower)) return g;
  }
  return null;
}

// ──────────────────────────────────────────────
// Post-Processing: Color-Based Merging
// ──────────────────────────────────────────────

/**
 * Merge provinces that share the same fill color and have overlapping/touching bboxes.
 * Handles SVGs where a single province is drawn as multiple path segments.
 */
function mergeSameColorProvinces(provinces: ProvinceFeature[]): ProvinceFeature[] {
  if (provinces.length < 2) return provinces;

  // Group by color
  const byColor = new Map<string, ProvinceFeature[]>();
  const noColor: ProvinceFeature[] = [];

  for (const p of provinces) {
    const color = p.color?.toLowerCase()?.trim();
    if (!color) {
      noColor.push(p);
      continue;
    }
    const group = byColor.get(color) ?? [];
    group.push(p);
    byColor.set(color, group);
  }

  const result: ProvinceFeature[] = [...noColor];

  for (const [_color, group] of byColor) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }

    // If many shapes share the same color (>8), they're likely distinct provinces
    // that happen to share a fill color — don't merge them.
    if (group.length > 8) {
      result.push(...group);
      continue;
    }

    // Find clusters of touching/overlapping provinces within this color group
    const clusters = clusterByProximity(group);

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        result.push(cluster[0]!);
        continue;
      }

      // Merge cluster into a single MultiPolygon province
      const merged = mergeProvinceCluster(cluster);
      result.push(merged);
    }
  }

  return result;
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

      // Find all unvisited provinces whose bbox overlaps with a small margin
      for (let j = 0; j < provinces.length; j++) {
        if (visited.has(j)) continue;
        if (bboxOverlaps(provinces[idx]!.bbox, provinces[j]!.bbox, 0.5)) {
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
  const bestName = cluster.reduce(
    (best, p) => (p.confidence > best.confidence ? p : best),
    cluster[0]!
  );

  // Collect all coordinate arrays
  const allCoords: [number, number][][][] = [];
  for (const p of cluster) {
    const geo = p.geometry;
    if (geo.type === "Polygon") {
      allCoords.push(geo.coordinates as [number, number][][]);
    } else if (geo.type === "MultiPolygon") {
      for (const poly of geo.coordinates) {
        allCoords.push(poly as [number, number][][]);
      }
    }
  }

  const geometry: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: allCoords,
  };

  // Recalculate centroid and bbox from merged geometry
  const allOuters = allCoords.map((c) => c[0]!).flat();
  const cx = allOuters.reduce((s, p) => s + p[0], 0) / allOuters.length;
  const cy = allOuters.reduce((s, p) => s + p[1], 0) / allOuters.length;

  const lngs = allOuters.map((p) => p[0]);
  const lats = allOuters.map((p) => p[1]);

  return {
    sourceId: bestName.sourceId,
    name: bestName.name,
    geometry,
    color: bestName.color,
    confidence: bestName.confidence,
    centroid: [cx, cy],
    bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    areaSqKm: cluster.reduce((s, p) => s + p.areaSqKm, 0),
    included: true,
  };
}

// ──────────────────────────────────────────────
// Geometry Helpers
// ──────────────────────────────────────────────

/** Calculate centroid of a coordinate ring. */
function ringCentroid(ring: [number, number][]): [number, number] {
  let sx = 0;
  let sy = 0;
  const n =
    ring.length > 1 &&
    ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1]
      ? ring.length - 1 // exclude closing duplicate
      : ring.length;
  for (let i = 0; i < n; i++) {
    sx += ring[i]![0];
    sy += ring[i]![1];
  }
  return [sx / n, sy / n];
}

/**
 * Clean a group/element ID into a human-readable province name.
 * Examples:
 *   "baía-sul-rg"    → "Baía Sul"
 *   "lusia-wasg"     → "Lusia"
 *   "satheriana-rg"  → "Satheriana"
 *   "nova_terra_pb"  → "Nova Terra"
 *
 * Removes common trailing abbreviations (rg, av, pb, sr, wasg, etc.)
 * and cleans separators.
 */
export function cleanGroupIdToName(id: string): string {
  if (!id) return "";

  let cleaned = id
    // Remove common trailing abbreviations (2-4 char suffixes after separator)
    .replace(/[-_](rg|av|pb|sr|wasg|dist|prov|reg|cty|adm|sub|div)$/i, "")
    // Replace dashes and underscores with spaces
    .replace(/[-_]+/g, " ")
    // Remove leading/trailing whitespace
    .trim();

  // Capitalize first letter of each word, preserving accented characters
  cleaned = cleaned
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return cleaned;
}

/** Ray-casting point-in-ring test. */
function pointInRing(point: [number, number], ring: [number, number][]): boolean {
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
