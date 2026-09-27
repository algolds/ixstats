/**
 * SVG viewBox reading and SVG → WGS84 coordinate-config resolution.
 *
 * Strategy 1: Calibrate from reference GeoJSON (most accurate — matches existing layers)
 * Strategy 2: Fall back to mapping viewBox → WGS84 world bounds (for first-time imports)
 */

import type { FeatureCollection } from "geojson";
import type { SvgCoordinateConfig } from "../svg-coordinate-config";
import { createConfigFromBounds, createConfigFromCalibration } from "../svg-coordinate-config";
import { buildReferenceCentroids } from "./reference-geometry";
import { SVG_NS, parseAbsolutePath, type XmlElement } from "./xml";

export interface ViewBoxSize {
  width: number;
  height: number;
}

type CalibrationPoint = { svgX: number; svgY: number; lng: number; lat: number };

/**
 * Read the root viewBox, falling back to the base coordinate config's dimensions.
 */
export function readViewBox(
  svgRoot: XmlElement,
  baseCoordConfig: SvgCoordinateConfig,
  log: string[]
): ViewBoxSize {
  const viewBoxAttr = svgRoot.getAttribute("viewBox");
  let viewBox = { width: baseCoordConfig.viewBoxWidth, height: baseCoordConfig.viewBoxHeight };
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      viewBox = { width: parts[2]!, height: parts[3]! };
      log.push(`SVG viewBox: ${viewBox.width} × ${viewBox.height}`);
    }
  }
  return viewBox;
}

/**
 * Average of a path's command endpoints (cmd.x, cmd.y), NOT bezier control points
 * (x1,y1,x2,y2). Returns null for paths with fewer than 3 endpoints.
 */
function pathEndpointCentroid(d: string): [number, number] | null {
  const cmds = parseAbsolutePath(d);
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
  if (svgCount < 3) return null;
  return [svgSumX / svgCount, svgSumY / svgCount];
}

/**
 * Pair SVG path centroids with reference centroids by feature ID.
 */
function collectCalibrationPoints(
  svgRoot: XmlElement,
  refCentroids: Map<string, [number, number]>
): CalibrationPoint[] {
  const allSvgPaths = svgRoot.getElementsByTagNameNS(SVG_NS, "path");
  const calibPoints: CalibrationPoint[] = [];

  for (let i = 0; i < allSvgPaths.length; i++) {
    const p = allSvgPaths[i]!;
    const pid = p.getAttribute("id") || "";
    const ref = refCentroids.get(pid);
    if (!ref) continue;
    const d = p.getAttribute("d") || "";
    if (!d) continue;
    try {
      const centroid = pathEndpointCentroid(d);
      if (!centroid) continue;
      calibPoints.push({ svgX: centroid[0], svgY: centroid[1], lng: ref[0], lat: ref[1] });
    } catch {
      continue;
    }
  }
  return calibPoints;
}

function calibrateFromReference(
  svgRoot: XmlElement,
  viewBox: ViewBoxSize,
  reference: FeatureCollection,
  log: string[]
): SvgCoordinateConfig | null {
  const calibPoints = collectCalibrationPoints(svgRoot, buildReferenceCentroids(reference));

  if (calibPoints.length >= 2) {
    const calibConfig = createConfigFromCalibration(viewBox.width, viewBox.height, calibPoints);
    if (calibConfig) {
      log.push(
        `Calibrated from ${calibPoints.length} matched features (scale: ${(1 / calibConfig.pixelsPerLng).toFixed(6)} deg/px)`
      );
      return calibConfig;
    }
  }

  log.push(
    `Calibration failed (${calibPoints.length} matches found, need 2+). Falling back to bounds mapping.`
  );
  return null;
}

/**
 * Build the coordinate config used to convert SVG coordinates to WGS84.
 */
export function resolveCoordinateConfig(
  svgRoot: XmlElement,
  viewBox: ViewBoxSize,
  baseCoordConfig: SvgCoordinateConfig,
  reference: FeatureCollection | undefined,
  log: string[]
): SvgCoordinateConfig {
  const hasArea = viewBox.width > 0 && viewBox.height > 0;
  if (reference && hasArea) {
    const calibConfig = calibrateFromReference(svgRoot, viewBox, reference, log);
    if (calibConfig) return calibConfig;
  }
  if (!hasArea) return baseCoordConfig;

  const boundsConfig = createConfigFromBounds(
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
  return boundsConfig;
}
