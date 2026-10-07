/**
 * Per-path feature extraction for the SVG → GeoJSON parser: reference geometry
 * reuse, SVG → WGS84 conversion, ring closure and outer/hole classification
 * (by containment under the path's fill rule: lib/maps/ring-assembly).
 */

import type { ParsedFeature } from "../svg-parser";
import type { SvgCoordinateConfig } from "../svg-coordinate-config";
import { svgToWgs84 } from "../svg-coordinate-config";
import { pathCommandsToRings } from "./command-evaluator";
import type { ReferenceGeometry } from "./reference-geometry";
import { assembleRings } from "~/lib/maps/ring-assembly";
import {
  calculateCentroid,
  calculateBoundingBox,
  extractFillColor,
  extractFillRule,
  extractStrokeColor,
  roundedAreaSqKm,
} from "./topology-flattener";
import { SVG_NS, inkscapeLabel, parseAbsolutePath, type XmlElement } from "./xml";

type Ring = [number, number][];

interface FeatureExtractionOptions {
  coordConfig: SvgCoordinateConfig;
  bezierSegments: number;
  minRingSize: number;
  refGeometryMap: Map<string, ReferenceGeometry>;
}

/**
 * Convert feature ID to display name: "New_Harren" → "New Harren"
 */
export function featureIdToDisplayName(id: string): string {
  return id.replace(/_/g, " ").replace(/-/g, " ");
}

function featureProperties(
  pathEl: XmlElement,
  featureId: string,
  displayName: string
): Record<string, unknown> {
  const style = pathEl.getAttribute("style") || "";
  // Extract fill/stroke colors from SVG (always needed, even for reference geometry)
  const fillColor = extractFillColor(pathEl, style);
  const strokeColor = extractStrokeColor(pathEl, style);

  const properties: Record<string, unknown> = {
    id: featureId,
    name: displayName,
  };
  if (fillColor) properties.fill = fillColor;
  if (strokeColor) properties.stroke = strokeColor;
  return properties;
}

/**
 * Convert SVG coordinates to WGS84 (clamp to valid range).
 */
function toWgs84Rings(rings: Ring[], coordConfig: SvgCoordinateConfig): Ring[] {
  return rings.map((ring) =>
    ring.map(([x, y]): [number, number] => {
      const [lng, lat] = svgToWgs84(x, y, coordConfig);
      return [Math.max(-180, Math.min(180, lng)), Math.max(-90, Math.min(90, lat))];
    })
  );
}

/**
 * Close a ring (GeoJSON requires first == last).
 */
function closeRing(ring: Ring): Ring {
  if (
    ring.length > 0 &&
    (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])
  ) {
    return [...ring, ring[0]!];
  }
  return ring;
}

/**
 * No reference — fall back to SVG coordinate conversion. Returns null (after
 * logging why) when the path yields no usable rings.
 */
function convertSvgFeature(
  d: string,
  base: Pick<ParsedFeature, "featureId" | "displayName" | "properties"> & {
    fillRule?: "evenodd" | "nonzero";
  },
  options: FeatureExtractionOptions,
  log: string[]
): ParsedFeature | null {
  const { featureId } = base;
  const rings = pathCommandsToRings(parseAbsolutePath(d), options.bezierSegments);
  if (rings.length === 0) {
    log.push(`  Skipping ${featureId}: no valid rings`);
    return null;
  }

  const wgs84Rings = toWgs84Rings(rings, options.coordConfig);

  // Skip features entirely outside valid geographic bounds
  const hasValidCoords = wgs84Rings.some((ring) =>
    ring.some(([lng, lat]) => Math.abs(lng) < 180 && Math.abs(lat) < 90)
  );
  if (!hasValidCoords) {
    log.push(`  Skipping ${featureId}: all coordinates outside valid range`);
    return null;
  }

  // Filter out rings that are too small
  const validRings = wgs84Rings.filter((ring) => ring.length >= options.minRingSize);
  if (validRings.length === 0) {
    log.push(`  Skipping ${featureId}: all rings too small`);
    return null;
  }

  const closedRings = validRings.map((ring) => closeRing(ring));
  const geometry = assembleRings(closedRings, base.fillRule);
  return {
    featureId,
    displayName: base.displayName,
    geometry,
    properties: base.properties,
    centroid: calculateCentroid(closedRings),
    boundingBox: calculateBoundingBox(closedRings),
    areaSqKm: roundedAreaSqKm(geometry),
  };
}

/**
 * Extract path elements from the target group (all descendants, not just direct
 * children). This supports both Inkscape (flat layer structure) and Illustrator
 * (nested sub-groups).
 */
export function extractFeatures(
  targetGroup: XmlElement,
  options: FeatureExtractionOptions,
  log: string[]
): { features: ParsedFeature[]; pathCount: number; refUsedCount: number } {
  const features: ParsedFeature[] = [];
  const allPaths = targetGroup.getElementsByTagNameNS(SVG_NS, "path");
  let refUsedCount = 0;

  for (let i = 0; i < allPaths.length; i++) {
    const pathEl = allPaths[i]!;
    const featureId = pathEl.getAttribute("id") || `feature_${i}`;
    const displayName =
      inkscapeLabel(pathEl) ||
      pathEl.getAttribute("data-name") ||
      featureIdToDisplayName(featureId);
    const d = pathEl.getAttribute("d");

    if (!d) {
      log.push(`  Skipping ${featureId}: no path data`);
      continue;
    }

    try {
      const properties = featureProperties(pathEl, featureId, displayName);

      // Use reference geometry if available (exact coordinates, perfect alignment)
      const refData = options.refGeometryMap.get(featureId);
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

      const fillRule = extractFillRule(pathEl);
      const feature = convertSvgFeature(
        d,
        { featureId, displayName, properties, fillRule },
        options,
        log
      );
      if (feature) features.push(feature);
    } catch (err) {
      log.push(
        `  Error processing ${featureId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { features, pathCount: allPaths.length, refUsedCount };
}
