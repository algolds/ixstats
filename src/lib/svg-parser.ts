/**
 * SVG Parser - Converts Inkscape SVG files to GeoJSON FeatureCollections.
 *
 * Server-side only. Handles:
 * - Parsing SVG XML structure with @xmldom/xmldom
 * - Extracting layer groups and path features
 * - Flattening cubic bezier curves to line segments
 * - Converting SVG coordinates to WGS84 via configurable affine transform
 * - Calculating centroids, bounding boxes, and areas
 * - Fuzzy-matching political features to Country records
 */

import { DOMParser } from "@xmldom/xmldom";
// svg-path-parser is CJS-only; use createRequire for ESM compatibility
import { createRequire } from "module";

export interface SvgPathCommand {
  code: string;
  command: string;
  x?: number;
  y?: number;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

const _require = createRequire(import.meta.url);
const { parseSVG, makeAbsolute } = _require("svg-path-parser") as {
  parseSVG: (d: string) => SvgPathCommand[];
  makeAbsolute: (cmds: SvgPathCommand[]) => SvgPathCommand[];
};
import type { SvgCoordinateConfig } from "./svg-coordinate-config";
import {
  createConfigFromBounds,
  createConfigFromCalibration,
  IXEARTH_SVG_CONFIG,
  svgToWgs84,
} from "./svg-coordinate-config";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface SvgParseConfig {
  /** Coordinate conversion config (defaults to IxEarth) */
  coordinateConfig?: SvgCoordinateConfig;
  /** Specific layer ID to extract (e.g., "political"). If null, extracts all layers. */
  targetLayerId?: string;
  /** Number of line segments to use when flattening each cubic bezier curve */
  bezierSegments?: number;
  /** Minimum number of coordinates for a valid polygon ring */
  minRingSize?: number;
  /**
   * Reference GeoJSON for auto-calibrating the coordinate mapping.
   * When provided, the parser matches SVG feature IDs to reference features
   * and derives the correct affine transform from matched pairs.
   * This is the most accurate method when existing map data exists.
   */
  referenceGeoJson?: FeatureCollection;
}

export interface ParsedFeature {
  featureId: string;
  displayName: string;
  geometry: Polygon | MultiPolygon;
  properties: Record<string, unknown>;
  centroid: [number, number]; // [lng, lat]
  boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  areaSqKm: number;
}

export interface SvgParseResult {
  features: ParsedFeature[];
  featureCollection: FeatureCollection;
  layersFound: string[];
  viewBox: { width: number; height: number };
  log: string[];
}

// ──────────────────────────────────────────────
// SVG Parsing
// ──────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

/**
 * Main entry point: parse SVG content string into GeoJSON.
 */
export function parseSvgToGeoJson(
  svgContent: string,
  layerType: string,
  config: SvgParseConfig = {}
): SvgParseResult {
  const log: string[] = [];
  const baseCoordConfig = config.coordinateConfig ?? IXEARTH_SVG_CONFIG;
  const bezierSegments = config.bezierSegments ?? 8;
  const minRingSize = config.minRingSize ?? 4;
  const targetLayerId = config.targetLayerId ?? layerType;

  log.push(`Parsing SVG for layer type: ${layerType}`);

  // Parse SVG XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgRoot = doc.documentElement;

  if (!svgRoot) {
    throw new Error("Failed to parse SVG: no root element found");
  }

  // Extract viewBox
  const viewBoxAttr = svgRoot.getAttribute("viewBox");
  let viewBox = { width: baseCoordConfig.viewBoxWidth, height: baseCoordConfig.viewBoxHeight };
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      viewBox = { width: parts[2]!, height: parts[3]! };
      log.push(`SVG viewBox: ${viewBox.width} × ${viewBox.height}`);
    }
  }

  // Build coordinate config.
  // Strategy 1: Calibrate from reference GeoJSON (most accurate — matches existing layers)
  // Strategy 2: Fall back to mapping viewBox → WGS84 world bounds (for first-time imports)
  let coordConfig = baseCoordConfig;
  let calibrated = false;

  if (config.referenceGeoJson && viewBox.width > 0 && viewBox.height > 0) {
    // Build a lookup of reference feature CENTROIDS by ID.
    // Centroids are ring-start-invariant (unlike first coordinate which
    // differs between SVG and GeoJSON because rings can start at any vertex).
    const refCentroids = new Map<string, [number, number]>();
    for (const feat of config.referenceGeoJson.features) {
      const fid = String(feat.properties?.id ?? feat.id ?? "");
      if (!fid || !feat.geometry || !("coordinates" in feat.geometry)) continue;
      // Flatten all coordinates to compute centroid
      const allCoords: number[][] = [];
      const flatten = (arr: unknown): void => {
        if (!Array.isArray(arr)) return;
        if (arr.length >= 2 && typeof arr[0] === "number" && typeof arr[1] === "number") {
          allCoords.push(arr as number[]);
          return;
        }
        for (const item of arr) flatten(item);
      };
      flatten(feat.geometry.coordinates);
      if (allCoords.length > 0) {
        const avgLng = allCoords.reduce((s, c) => s + c[0]!, 0) / allCoords.length;
        const avgLat = allCoords.reduce((s, c) => s + c[1]!, 0) / allCoords.length;
        refCentroids.set(fid, [avgLng, avgLat]);
      }
    }

    // Compute SVG centroids using the path parser (handles relative commands correctly).
    // Uses only command endpoints (cmd.x, cmd.y), NOT bezier control points (x1,y1,x2,y2).
    const allSvgPaths = svgRoot.getElementsByTagNameNS(SVG_NS, "path");
    const calibPoints: Array<{ svgX: number; svgY: number; lng: number; lat: number }> = [];

    for (let i = 0; i < allSvgPaths.length; i++) {
      const p = allSvgPaths[i]!;
      const pid = p.getAttribute("id") || "";
      const ref = refCentroids.get(pid);
      if (!ref) continue;
      const d = p.getAttribute("d") || "";
      if (!d) continue;
      try {
        const cmds = makeAbsolute(parseSVG(d));
        let svgSumX = 0,
          svgSumY = 0,
          svgCount = 0;
        for (const cmd of cmds) {
          if (cmd.x !== undefined && cmd.y !== undefined) {
            svgSumX += cmd.x;
            svgSumY += cmd.y;
            svgCount++;
          }
        }
        if (svgCount < 3) continue;
        calibPoints.push({
          svgX: svgSumX / svgCount,
          svgY: svgSumY / svgCount,
          lng: ref[0],
          lat: ref[1],
        });
      } catch {
        continue;
      }
    }

    if (calibPoints.length >= 2) {
      const calibConfig = createConfigFromCalibration(viewBox.width, viewBox.height, calibPoints);
      if (calibConfig) {
        coordConfig = calibConfig;
        calibrated = true;
        log.push(
          `Calibrated from ${calibPoints.length} matched features (scale: ${(1 / calibConfig.pixelsPerLng).toFixed(6)} deg/px)`
        );
      }
    }

    if (!calibrated) {
      log.push(
        `Calibration failed (${calibPoints.length} matches found, need 2+). Falling back to bounds mapping.`
      );
    }
  }

  if (!calibrated && viewBox.width > 0 && viewBox.height > 0) {
    coordConfig = createConfigFromBounds(
      viewBox.width,
      viewBox.height,
      {
        minLng: -180,
        maxLng: 180,
        minLat: -90,
        maxLat: 90,
      },
      { preserveAspectRatio: true }
    );

    const effectiveLatRange = viewBox.height / Math.max(viewBox.width / 360, viewBox.height / 180);
    log.push(
      `Mapping viewBox (${viewBox.width}×${viewBox.height}) to WGS84 bounds (lat range: ±${(effectiveLatRange / 2).toFixed(1)}°)`
    );
  }

  // Find all top-level groups (layers)
  const layersFound: string[] = [];
  const topGroups = svgRoot.getElementsByTagNameNS(SVG_NS, "g");

  let targetGroup: Element | null = null;

  for (let i = 0; i < topGroups.length; i++) {
    const g = topGroups[i]!;
    // Only check direct children of svg root
    if (g.parentNode !== svgRoot) continue;

    const gId = g.getAttribute("id") || "";
    const gLabel = g.getAttributeNS(INKSCAPE_NS, "label") || g.getAttribute("inkscape:label") || "";

    if (gId) layersFound.push(gId);

    // Match by ID or label (case-insensitive)
    const matchId = gId.toLowerCase().replace(/-/g, "");
    const matchLabel = gLabel.toLowerCase().replace(/-/g, "");
    const targetNorm = targetLayerId.toLowerCase().replace(/-/g, "");

    if (matchId === targetNorm || matchLabel === targetNorm) {
      targetGroup = g;
    }
  }

  log.push(`Layers found in SVG: ${layersFound.join(", ")}`);

  // Fallback for single-layer SVGs (e.g., exporting from Inkscape or Illustrator)
  if (!targetGroup) {
    // Strategy 1: Top-level <g> elements that contain paths (at any depth)
    const groupsWithPaths: { el: Element; pathCount: number }[] = [];
    for (let i = 0; i < topGroups.length; i++) {
      const g = topGroups[i]!;
      if (g.parentNode !== svgRoot) continue;
      const pathCount = g.getElementsByTagNameNS(SVG_NS, "path").length;
      if (pathCount > 0) groupsWithPaths.push({ el: g, pathCount });
    }

    if (groupsWithPaths.length === 1) {
      // Single top-level group with paths — use it
      targetGroup = groupsWithPaths[0]!.el;
      log.push(
        `Layer "${targetLayerId}" not found by name; using sole group "${targetGroup.getAttribute("id")}" (${groupsWithPaths[0]!.pathCount} paths)`
      );
    } else if (groupsWithPaths.length > 1) {
      // Multiple groups — check nested groups for a name match
      for (const { el: g } of groupsWithPaths) {
        const nestedGroups = g.getElementsByTagNameNS(SVG_NS, "g");
        for (let k = 0; k < nestedGroups.length; k++) {
          const ng = nestedGroups[k]!;
          if (ng.parentNode !== g) continue;
          const ngId = (ng.getAttribute("id") || "").toLowerCase().replace(/-/g, "");
          const ngLabel = (
            ng.getAttributeNS(INKSCAPE_NS, "label") ||
            ng.getAttribute("inkscape:label") ||
            ""
          )
            .toLowerCase()
            .replace(/-/g, "");
          const targetNormFb = targetLayerId.toLowerCase().replace(/-/g, "");
          if (ngId === targetNormFb || ngLabel === targetNormFb) {
            targetGroup = ng;
            log.push(
              `Found nested layer "${ng.getAttribute("id")}" inside group "${g.getAttribute("id")}"`
            );
            break;
          }
        }
        if (targetGroup) break;
      }

      // Still no match — pick the group with the most paths
      if (!targetGroup) {
        const best = groupsWithPaths.sort((a, b) => b.pathCount - a.pathCount)[0]!;
        targetGroup = best.el;
        log.push(
          `Layer "${targetLayerId}" not found by name; using largest group "${targetGroup.getAttribute("id")}" (${best.pathCount} paths)`
        );
      }
    }

    // Strategy 2: Any paths anywhere in the document — use SVG root
    if (!targetGroup) {
      const totalPaths = svgRoot.getElementsByTagNameNS(SVG_NS, "path").length;
      if (totalPaths > 0) {
        targetGroup = svgRoot;
        log.push(
          `Layer "${targetLayerId}" not found by name; using SVG root (${totalPaths} total paths)`
        );
      }
    }
  }

  if (!targetGroup) {
    throw new Error(
      `Layer "${targetLayerId}" not found in SVG. Available layers: ${layersFound.join(", ") || "none"}`
    );
  }

  log.push(`Extracting features from layer: ${targetGroup.getAttribute("id")}`);

  // Build reference geometry lookup: use exact coordinates from reference GeoJSON
  // when available, instead of converting SVG coordinates (which introduces error).
  // The SVG is still used for feature discovery, colors, and names.
  const refGeometryMap = new Map<
    string,
    {
      geometry: Polygon | MultiPolygon;
      centroid: [number, number];
      bbox: [number, number, number, number];
      area: number;
    }
  >();
  if (config.referenceGeoJson) {
    for (const feat of config.referenceGeoJson.features) {
      const fid = String(feat.properties?.id ?? feat.id ?? "");
      if (!fid || !feat.geometry || !("coordinates" in feat.geometry)) continue;
      const geom = feat.geometry as Polygon | MultiPolygon;
      // Compute centroid, bbox, area from reference coordinates
      const allCoords: [number, number][] = [];
      const flattenCoords = (arr: unknown): void => {
        if (!Array.isArray(arr)) return;
        if (arr.length >= 2 && typeof arr[0] === "number" && typeof arr[1] === "number") {
          allCoords.push(arr as [number, number]);
          return;
        }
        for (const item of arr) flattenCoords(item);
      };
      flattenCoords(geom.coordinates);
      if (allCoords.length === 0) continue;
      const cLng = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
      const cLat = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;
      let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
      for (const [lng, lat] of allCoords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      // Approximate area using the reference rings
      const refRings =
        geom.type === "Polygon"
          ? (geom.coordinates as Position[][])
          : (geom.coordinates as Position[][][]).flat();
      const area = calculateApproxArea(refRings as [number, number][][]);
      refGeometryMap.set(fid, {
        geometry: geom,
        centroid: [cLng, cLat],
        bbox: [minLng, minLat, maxLng, maxLat],
        area,
      });
    }
    log.push(`Reference geometry available for ${refGeometryMap.size} features`);
  }

  // Extract path elements from the target group (all descendants, not just direct children)
  // This supports both Inkscape (flat layer structure) and Illustrator (nested sub-groups)
  const features: ParsedFeature[] = [];
  const allPaths = targetGroup.getElementsByTagNameNS(SVG_NS, "path");
  let refUsedCount = 0;

  for (let i = 0; i < allPaths.length; i++) {
    const pathEl = allPaths[i]!;

    const featureId = pathEl.getAttribute("id") || `feature_${i}`;
    const displayName =
      pathEl.getAttributeNS(INKSCAPE_NS, "label") ||
      pathEl.getAttribute("inkscape:label") ||
      pathEl.getAttribute("data-name") ||
      featureIdToDisplayName(featureId);
    const d = pathEl.getAttribute("d");
    const style = pathEl.getAttribute("style") || "";

    if (!d) {
      log.push(`  Skipping ${featureId}: no path data`);
      continue;
    }

    try {
      // Extract fill/stroke colors from SVG (always needed, even for reference geometry)
      const fillColor = extractFillColor(pathEl, style);
      const strokeColor = extractStrokeColor(pathEl, style);

      const properties: Record<string, unknown> = {
        id: featureId,
        name: displayName,
      };
      if (fillColor) properties.fill = fillColor;
      if (strokeColor) properties.stroke = strokeColor;

      // Use reference geometry if available (exact coordinates, perfect alignment)
      const refData = refGeometryMap.get(featureId);
      if (refData) {
        refUsedCount++;
        features.push({
          featureId,
          displayName,
          geometry: refData.geometry,
          properties,
          centroid: refData.centroid,
          boundingBox: refData.bbox,
          areaSqKm: refData.area,
        });
        continue; // skip SVG coordinate conversion
      }

      // No reference — fall back to SVG coordinate conversion
      // Parse SVG path to absolute commands
      const commands = makeAbsolute(parseSVG(d));

      // Convert to coordinate rings
      const rings = pathCommandsToRings(commands, bezierSegments);

      if (rings.length === 0) {
        log.push(`  Skipping ${featureId}: no valid rings`);
        continue;
      }

      // Convert SVG coordinates to WGS84 (clamp to valid range)
      const wgs84Rings = rings.map((ring) =>
        ring.map(([x, y]): [number, number] => {
          const [lng, lat] = svgToWgs84(x!, y!, coordConfig);
          return [Math.max(-180, Math.min(180, lng)), Math.max(-90, Math.min(90, lat))];
        })
      );

      // Skip features entirely outside valid geographic bounds
      const hasValidCoords = wgs84Rings.some((ring) =>
        ring.some(([lng, lat]) => Math.abs(lng) < 180 && Math.abs(lat) < 90)
      );
      if (!hasValidCoords) {
        log.push(`  Skipping ${featureId}: all coordinates outside valid range`);
        continue;
      }

      // Filter out rings that are too small
      const validRings = wgs84Rings.filter((ring) => ring.length >= minRingSize);
      if (validRings.length === 0) {
        log.push(`  Skipping ${featureId}: all rings too small`);
        continue;
      }

      // Close rings (GeoJSON requires first == last)
      const closedRings = validRings.map((ring) => {
        if (
          ring.length > 0 &&
          (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])
        ) {
          return [...ring, ring[0]!];
        }
        return ring;
      });

      // Build geometry
      let geometry: Polygon | MultiPolygon;
      if (closedRings.length === 1) {
        geometry = {
          type: "Polygon",
          coordinates: [closedRings[0]!],
        };
      } else {
        // Determine which rings are outer (CCW in GeoJSON) vs holes (CW)
        const outerRings = closedRings.filter((r) => ringArea(r) > 0);
        const holeRings = closedRings.filter((r) => ringArea(r) <= 0);

        if (outerRings.length === 0) {
          geometry = {
            type: outerRings.length <= 1 && holeRings.length === 0 ? "Polygon" : "MultiPolygon",
            coordinates:
              closedRings.length === 1
                ? [closedRings[0]!.slice().reverse()]
                : closedRings.map((r) => [r.slice().reverse()]),
          } as Polygon | MultiPolygon;
        } else if (outerRings.length === 1 && holeRings.length > 0) {
          geometry = {
            type: "Polygon",
            coordinates: [outerRings[0]!, ...holeRings.map((r) => r.slice().reverse())],
          };
        } else {
          geometry = {
            type: "MultiPolygon",
            coordinates: outerRings.map((outer) => [outer]),
          };
        }
      }

      // Calculate metrics
      const centroid = calculateCentroid(closedRings);
      const bbox = calculateBoundingBox(closedRings);
      const area = calculateApproxArea(closedRings);

      features.push({
        featureId,
        displayName,
        geometry,
        properties,
        centroid,
        boundingBox: bbox,
        areaSqKm: area,
      });
    } catch (err) {
      log.push(
        `  Error processing ${featureId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  log.push(`Extracted ${features.length} features from ${allPaths.length} paths`);
  if (refUsedCount > 0) {
    log.push(
      `Used reference geometry for ${refUsedCount} features (${features.length - refUsedCount} from SVG conversion)`
    );
  }

  // Build FeatureCollection
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: features.map(
      (f): Feature => ({
        type: "Feature",
        id: f.featureId,
        geometry: f.geometry,
        properties: f.properties,
      })
    ),
  };

  return {
    features,
    featureCollection,
    layersFound,
    viewBox,
    log,
  };
}

// ──────────────────────────────────────────────
// Path Commands → Coordinate Rings
// ──────────────────────────────────────────────

/**
 * Convert parsed SVG path commands into arrays of [x, y] coordinate rings.
 * Each M (moveto) starts a new ring, Z (closepath) closes it.
 * Cubic bezier curves (C) are flattened into line segments.
 */
export function pathCommandsToRings(
  commands: SvgPathCommand[],
  bezierSegments: number
): [number, number][][] {
  const rings: [number, number][][] = [];
  let currentRing: [number, number][] = [];
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of commands) {
    switch (cmd.code) {
      case "M": {
        // Start new ring
        if (currentRing.length > 2) {
          rings.push(currentRing);
        }
        currentRing = [];
        curX = cmd.x ?? 0;
        curY = cmd.y ?? 0;
        startX = curX;
        startY = curY;
        currentRing.push([curX, curY]);
        break;
      }

      case "L": {
        curX = cmd.x ?? curX;
        curY = cmd.y ?? curY;
        currentRing.push([curX, curY]);
        break;
      }

      case "H": {
        curX = cmd.x ?? curX;
        currentRing.push([curX, curY]);
        break;
      }

      case "V": {
        curY = cmd.y ?? curY;
        currentRing.push([curX, curY]);
        break;
      }

      case "C": {
        // Cubic bezier: flatten with adaptive segment count
        const x0 = curX;
        const y0 = curY;
        const x1 = cmd.x1 ?? x0;
        const y1 = cmd.y1 ?? y0;
        const x2 = cmd.x2 ?? x1;
        const y2 = cmd.y2 ?? y1;
        const x3 = cmd.x ?? x2;
        const y3 = cmd.y ?? y2;

        const segs = adaptiveCubicSegments(x0, y0, x1, y1, x2, y2, x3, y3, bezierSegments);
        for (let t = 1; t <= segs; t++) {
          const frac = t / segs;
          const [bx, by] = cubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, frac);
          currentRing.push([bx, by]);
        }
        curX = x3;
        curY = y3;
        break;
      }

      case "Q": {
        // Quadratic bezier: flatten with adaptive segment count
        const qx0 = curX;
        const qy0 = curY;
        const qx1 = cmd.x1 ?? qx0;
        const qy1 = cmd.y1 ?? qy0;
        const qx2 = cmd.x ?? qx1;
        const qy2 = cmd.y ?? qy1;

        const qSegs = adaptiveQuadSegments(qx0, qy0, qx1, qy1, qx2, qy2, bezierSegments);
        for (let t = 1; t <= qSegs; t++) {
          const frac = t / qSegs;
          const [bx, by] = quadraticBezier(qx0, qy0, qx1, qy1, qx2, qy2, frac);
          currentRing.push([bx, by]);
        }
        curX = qx2;
        curY = qy2;
        break;
      }

      case "S": {
        // Smooth cubic bezier (reflected control point)
        const sx0 = curX;
        const sy0 = curY;
        const sx1 = cmd.x0 !== undefined ? 2 * curX - cmd.x0 : curX;
        const sy1 = cmd.y0 !== undefined ? 2 * curY - cmd.y0 : curY;
        const sx2 = cmd.x2 ?? sx1;
        const sy2 = cmd.y2 ?? sy1;
        const sx3 = cmd.x ?? sx2;
        const sy3 = cmd.y ?? sy2;

        const sSegs = adaptiveCubicSegments(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3, bezierSegments);
        for (let t = 1; t <= sSegs; t++) {
          const frac = t / sSegs;
          const [bx, by] = cubicBezier(sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3, frac);
          currentRing.push([bx, by]);
        }
        curX = sx3;
        curY = sy3;
        break;
      }

      case "A": {
        // Arc: approximate with end point (full arc flattening is complex)
        curX = cmd.x ?? curX;
        curY = cmd.y ?? curY;
        currentRing.push([curX, curY]);
        break;
      }

      case "Z": {
        // Close path - return to start
        if (currentRing.length > 2) {
          currentRing.push([startX, startY]);
          rings.push(currentRing);
        }
        currentRing = [];
        curX = startX;
        curY = startY;
        break;
      }
    }
  }

  // Capture any unclosed ring
  if (currentRing.length > 2) {
    rings.push(currentRing);
  }

  return rings;
}

// ──────────────────────────────────────────────
// Bezier Curves
// ──────────────────────────────────────────────

export function cubicBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number
): [number, number] {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return [
    mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
    mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3,
  ];
}

export function quadraticBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): [number, number] {
  const mt = 1 - t;
  return [mt * mt * x0 + 2 * mt * t * x1 + t * t * x2, mt * mt * y0 + 2 * mt * t * y1 + t * t * y2];
}

// ──────────────────────────────────────────────
// Adaptive Bezier Segmentation
// ──────────────────────────────────────────────

/**
 * Calculate adaptive segment count for a cubic bezier based on curve "flatness".
 * Near-straight curves get fewer segments, tight curves get more.
 *
 * Flatness is measured by the maximum distance of control points from the
 * straight line connecting start to end.
 */
function adaptiveCubicSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  maxSegments: number
): number {
  // Distance from control points to the line from (x0,y0) to (x3,y3)
  const dx = x3 - x0;
  const dy = y3 - y0;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen < 1e-6) return 2; // degenerate

  // Perpendicular distances of control points from the chord
  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / lineLen;
  const d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / lineLen;
  const maxDev = Math.max(d1, d2);

  // Flatness ratio: deviation / chord length
  const flatness = maxDev / lineLen;

  if (flatness < 0.01) return Math.max(2, Math.round(maxSegments * 0.25)); // very flat
  if (flatness < 0.05) return Math.max(3, Math.round(maxSegments * 0.5)); // mostly flat
  if (flatness < 0.15) return Math.max(4, Math.round(maxSegments * 0.75)); // moderate
  return maxSegments; // tight curve — use full segments
}

/**
 * Calculate adaptive segment count for a quadratic bezier.
 */
function adaptiveQuadSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  maxSegments: number
): number {
  const dx = x2 - x0;
  const dy = y2 - y0;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  if (lineLen < 1e-6) return 2;

  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / lineLen;
  const flatness = d1 / lineLen;

  if (flatness < 0.01) return Math.max(2, Math.round(maxSegments * 0.25));
  if (flatness < 0.05) return Math.max(3, Math.round(maxSegments * 0.5));
  if (flatness < 0.15) return Math.max(4, Math.round(maxSegments * 0.75));
  return maxSegments;
}

// ──────────────────────────────────────────────
// Color Extraction
// ──────────────────────────────────────────────

/**
 * Extract fill color from an SVG element.
 * Priority: inline style > fill attribute > inherited from parent groups.
 * Handles hex, rgb(), named colors. Ignores "none" and "url(#...)".
 */
export function extractFillColor(el: Element, style: string): string | undefined {
  // 1. Inline style: fill:...
  const styleMatch = style.match(/(?:^|;)\s*fill:\s*([^;]+)/i);
  if (styleMatch) {
    const val = styleMatch[1]!.trim();
    if (isValidColor(val)) return normalizeColor(val);
  }

  // 2. fill attribute on the element
  const fillAttr = el.getAttribute("fill");
  if (fillAttr && isValidColor(fillAttr)) return normalizeColor(fillAttr);

  // 3. Inherit from parent <g> elements (Illustrator sets fill on groups)
  let parent = el.parentNode as Element | null;
  while (parent && parent.nodeType === 1) {
    const parentStyle = parent.getAttribute("style") || "";
    const parentStyleMatch = parentStyle.match(/(?:^|;)\s*fill:\s*([^;]+)/i);
    if (parentStyleMatch) {
      const val = parentStyleMatch[1]!.trim();
      if (isValidColor(val)) return normalizeColor(val);
    }
    const parentFill = parent.getAttribute("fill");
    if (parentFill && isValidColor(parentFill)) return normalizeColor(parentFill);
    parent = parent.parentNode as Element | null;
  }

  return undefined;
}

/**
 * Extract stroke color from an SVG element (same priority as fill).
 */
export function extractStrokeColor(el: Element, style: string): string | undefined {
  const styleMatch = style.match(/(?:^|;)\s*stroke:\s*([^;]+)/i);
  if (styleMatch) {
    const val = styleMatch[1]!.trim();
    if (isValidColor(val)) return normalizeColor(val);
  }

  const strokeAttr = el.getAttribute("stroke");
  if (strokeAttr && isValidColor(strokeAttr)) return normalizeColor(strokeAttr);

  return undefined;
}

/** Check if a CSS color value is a real color (not "none", "url(#...)", "inherit", etc.) */
function isValidColor(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  if (lower === "none" || lower === "inherit" || lower === "transparent") return false;
  if (lower.startsWith("url(")) return false;
  return true;
}

/** Normalize color: convert rgb() to hex, trim whitespace */
function normalizeColor(val: string): string {
  const trimmed = val.trim();

  // Convert rgb(r, g, b) to #hex
  const rgbMatch = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1]!, 10));
    const g = Math.min(255, parseInt(rgbMatch[2]!, 10));
    const b = Math.min(255, parseInt(rgbMatch[3]!, 10));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  return trimmed;
}

// ──────────────────────────────────────────────
// Geometry Calculations
// ──────────────────────────────────────────────

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
 * (Same approach as seed-map-data.ts)
 */
export function calculateApproxArea(rings: Position[][]): number {
  let totalArea = 0;

  for (const ring of rings) {
    const centroid = calculateCentroid([ring]);
    const latRad = (centroid[1] * Math.PI) / 180;
    // Approximate degrees to km at this latitude
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

// ──────────────────────────────────────────────
// Country Name Matching
// ──────────────────────────────────────────────

/**
 * Convert feature ID to display name: "New_Harren" → "New Harren"
 */
export function featureIdToDisplayName(id: string): string {
  return id.replace(/_/g, " ").replace(/-/g, " ");
}

/**
 * Normalize a name for fuzzy matching.
 * Removes common prefixes/suffixes, lowercases, strips non-alpha.
 */
export function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(
      /^(the|republic|kingdom|empire|federation|state|commonwealth|duchy|principality)(of)?/g,
      ""
    )
    .trim();
}

/**
 * Match parsed features to Country records by name.
 */
export function matchFeaturesToCountries(
  features: ParsedFeature[],
  countries: Array<{ id: string; name: string; slug: string | null }>
): Map<string, { countryId: string; countryName: string; matchType: "exact" | "fuzzy" }> {
  const matches = new Map<
    string,
    { countryId: string; countryName: string; matchType: "exact" | "fuzzy" }
  >();

  // Build lookup maps
  const countryByExactName = new Map<string, { id: string; name: string }>();
  const countryByNormalized = new Map<string, { id: string; name: string }>();
  const countryBySlug = new Map<string, { id: string; name: string }>();

  for (const c of countries) {
    countryByExactName.set(c.name.toLowerCase(), { id: c.id, name: c.name });
    countryByNormalized.set(normalizeForMatching(c.name), { id: c.id, name: c.name });
    if (c.slug) {
      countryBySlug.set(c.slug.toLowerCase(), { id: c.id, name: c.name });
    }
  }

  for (const feature of features) {
    const featureName = feature.displayName.toLowerCase();
    const featureNorm = normalizeForMatching(feature.displayName);
    const featureSlug = feature.featureId.toLowerCase().replace(/_/g, "-");

    // Try exact name match
    const exact = countryByExactName.get(featureName);
    if (exact) {
      matches.set(feature.featureId, {
        countryId: exact.id,
        countryName: exact.name,
        matchType: "exact",
      });
      continue;
    }

    // Try slug match
    const slugMatch = countryBySlug.get(featureSlug);
    if (slugMatch) {
      matches.set(feature.featureId, {
        countryId: slugMatch.id,
        countryName: slugMatch.name,
        matchType: "exact",
      });
      continue;
    }

    // Try normalized fuzzy match
    const fuzzy = countryByNormalized.get(featureNorm);
    if (fuzzy) {
      matches.set(feature.featureId, {
        countryId: fuzzy.id,
        countryName: fuzzy.name,
        matchType: "fuzzy",
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Layer type auto-detection
// ---------------------------------------------------------------------------

const LAYER_KEYWORDS: Record<string, string[]> = {
  political: ["political", "countries", "borders", "nations", "states"],
  altitudes: ["altitude", "altitudes", "elevation", "topograph", "terrain", "height"],
  climate: ["climate", "biome", "temperature", "weather"],
  rivers: ["river", "rivers", "waterway", "stream"],
  lakes: ["lake", "lakes", "waterbodies", "water_bodies"],
  icecaps: ["icecap", "icecaps", "ice_cap", "ice", "glacier", "polar"],
  background: ["background", "base", "outline", "coastline", "landmass"],
};

/**
 * Auto-detect layer type from filename and optionally SVG content.
 * Matches filenames like "political.svg", "altitudes_v3.svg", "IxEarth-rivers-feb2026.svg".
 * Falls back to examining SVG layer group IDs/labels if filename is ambiguous.
 */
export function detectLayerType(
  fileName: string,
  svgContent?: string
): { layerType: string; confidence: "high" | "medium" } | null {
  const normalized = fileName.toLowerCase().replace(/[_\-\s.]+/g, " ");

  // Strategy 1: filename keyword match (high confidence)
  for (const [layerType, keywords] of Object.entries(LAYER_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return { layerType, confidence: "high" };
    }
  }

  // Strategy 2: SVG group IDs/labels (medium confidence)
  if (svgContent) {
    try {
      const metadata = extractSvgMetadata(svgContent);
      for (const layer of metadata.layers) {
        const groupId = (layer.id + " " + layer.label).toLowerCase().replace(/[-_]/g, "");
        for (const [layerType, keywords] of Object.entries(LAYER_KEYWORDS)) {
          if (keywords.some((kw) => groupId.includes(kw.replace(/[-_]/g, "")))) {
            return { layerType, confidence: "medium" };
          }
        }
      }
    } catch {
      // SVG metadata extraction failed — skip
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Layer diff computation
// ---------------------------------------------------------------------------

export interface FeatureDiffEntry {
  featureId: string;
  displayName: string;
  status: "added" | "modified" | "removed" | "unchanged";
  changes?: {
    geometryChanged: boolean;
    propertiesChanged: boolean;
    areaDeltaSqKm?: number;
  };
  existingCountryId?: string | null;
  existingCountryName?: string | null;
}

export interface LayerDiff {
  layerType: string;
  totalExisting: number;
  totalIncoming: number;
  added: FeatureDiffEntry[];
  modified: FeatureDiffEntry[];
  removed: FeatureDiffEntry[];
  unchanged: FeatureDiffEntry[];
  preservedLinkages: Array<{ featureId: string; countryId: string; countryName?: string }>;
  summary: {
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
    unchangedCount: number;
    linkagesPreserved: number;
    linkagesLost: number;
  };
}

/**
 * Compare incoming parsed features against existing DB features to produce a diff.
 * Uses featureId as the stable key (matches the @@unique constraint on MapLayer).
 */
export function computeLayerDiff(
  incomingFeatures: ParsedFeature[],
  existingFeatures: Array<{
    featureId: string;
    displayName: string | null;
    geometry: unknown;
    countryId: string | null;
    areaSqKm: number | null;
    properties: unknown;
    country?: { name: string } | null;
  }>
): LayerDiff {
  const existingMap = new Map(existingFeatures.map((f) => [f.featureId, f]));
  const incomingMap = new Map(incomingFeatures.map((f) => [f.featureId, f]));

  const added: FeatureDiffEntry[] = [];
  const modified: FeatureDiffEntry[] = [];
  const removed: FeatureDiffEntry[] = [];
  const unchanged: FeatureDiffEntry[] = [];
  const preservedLinkages: Array<{ featureId: string; countryId: string; countryName?: string }> =
    [];
  let linkagesLost = 0;

  // Check incoming features against existing
  for (const incoming of incomingFeatures) {
    const existing = existingMap.get(incoming.featureId);
    if (!existing) {
      added.push({
        featureId: incoming.featureId,
        displayName: incoming.displayName,
        status: "added",
      });
      continue;
    }

    // Feature exists — check for modifications via full JSON comparison
    const geometryChanged = JSON.stringify(incoming.geometry) !== JSON.stringify(existing.geometry);
    const propertiesChanged =
      JSON.stringify(incoming.properties) !== JSON.stringify(existing.properties);
    const areaDelta = incoming.areaSqKm - (existing.areaSqKm ?? 0);

    if (geometryChanged || propertiesChanged) {
      modified.push({
        featureId: incoming.featureId,
        displayName: incoming.displayName,
        status: "modified",
        changes: { geometryChanged, propertiesChanged, areaDeltaSqKm: areaDelta },
        existingCountryId: existing.countryId,
        existingCountryName: existing.country?.name ?? null,
      });
    } else {
      unchanged.push({
        featureId: incoming.featureId,
        displayName: incoming.displayName,
        status: "unchanged",
        existingCountryId: existing.countryId,
        existingCountryName: existing.country?.name ?? null,
      });
    }

    // Preserve linkage for both modified and unchanged features
    if (existing.countryId) {
      preservedLinkages.push({
        featureId: incoming.featureId,
        countryId: existing.countryId,
        countryName: existing.country?.name ?? undefined,
      });
    }
  }

  // Check for removed features (in DB but not in incoming)
  for (const existing of existingFeatures) {
    if (!incomingMap.has(existing.featureId)) {
      removed.push({
        featureId: existing.featureId,
        displayName: existing.displayName ?? existing.featureId,
        status: "removed",
        existingCountryId: existing.countryId,
        existingCountryName: existing.country?.name ?? null,
      });
      if (existing.countryId) linkagesLost++;
    }
  }

  return {
    layerType: "",
    totalExisting: existingFeatures.length,
    totalIncoming: incomingFeatures.length,
    added,
    modified,
    removed,
    unchanged,
    preservedLinkages,
    summary: {
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
      unchangedCount: unchanged.length,
      linkagesPreserved: preservedLinkages.length,
      linkagesLost,
    },
  };
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
