/**
 * SVG Coordinate Configuration
 *
 * Defines the mapping from SVG coordinate space to WGS84 geographic coordinates.
 *
 * The IxEarth SVG (viewBox 25625×15729) uses a simple affine transform to WGS84:
 *   lng = 0.04392139 * svgX - 153.9062
 *   lat = -0.04392143 * svgY + 110.1222
 *
 * This was empirically derived by matching SVG path coordinates to the
 * existing QGIS-exported GeoJSON data (scripts/geojson_fixed/).
 * The scale is isotropic: ~22.768 pixels per degree in both axes.
 */

export interface SvgCoordinateConfig {
  /** SVG viewBox width */
  viewBoxWidth: number;
  /** SVG viewBox height */
  viewBoxHeight: number;
  /** Equator Y position in viewBox space */
  equatorY: number;
  /** Prime meridian X position in viewBox space */
  primeMeridianX: number;
  /** Pixels per degree longitude in viewBox space */
  pixelsPerLng: number;
  /** Pixels per degree latitude in viewBox space */
  pixelsPerLat: number;
  /** Reference longitude for the prime meridian (degrees East) */
  primeMeridianReferenceLng: number;
}

/**
 * IxEarth default coordinate configuration.
 *
 * Empirically derived from matching SVG path start coordinates to
 * GeoJSON feature coordinates across 10+ countries:
 *   lng = 0.04392139 * svgX + (-153.9062)
 *   lat = -0.04392143 * svgY + 110.1222
 *
 * Expressed in the equator/PM form:
 *   equatorY = 110.1222 / 0.04392143 ≈ 2507.58  (Y where lat = 0)
 *   primeMeridianX = 153.9062 / 0.04392139 ≈ 3505.11  (X where lng = 0)
 *   pixelsPerLng = 1 / 0.04392139 ≈ 22.768
 *   pixelsPerLat = 1 / 0.04392143 ≈ 22.768
 */
export const IXEARTH_SVG_CONFIG: SvgCoordinateConfig = {
  viewBoxWidth: 25625,
  viewBoxHeight: 15729,
  equatorY: 110.1222 / 0.04392143, // ≈ 2507.58
  primeMeridianX: 153.9062 / 0.04392139, // ≈ 3505.11
  pixelsPerLng: 1 / 0.04392139, // ≈ 22.768
  pixelsPerLat: 1 / 0.04392143, // ≈ 22.768
  primeMeridianReferenceLng: 0, // PM is at lng = 0
};

/**
 * Convert SVG coordinates to WGS84 [longitude, latitude].
 *
 * Formula:
 *   lat = (equatorY - svgY) / pixelsPerLat
 *   lng = (svgX - primeMeridianX) / pixelsPerLng + primeMeridianReferenceLng
 */
export function svgToWgs84(
  svgX: number,
  svgY: number,
  config: SvgCoordinateConfig = IXEARTH_SVG_CONFIG
): [number, number] {
  const lat = (config.equatorY - svgY) / config.pixelsPerLat;
  const lng =
    (svgX - config.primeMeridianX) / config.pixelsPerLng + config.primeMeridianReferenceLng;

  return [lng, lat];
}

/**
 * Convert WGS84 [longitude, latitude] to SVG coordinates.
 * Inverse of svgToWgs84.
 */
export function wgs84ToSvg(
  lng: number,
  lat: number,
  config: SvgCoordinateConfig = IXEARTH_SVG_CONFIG
): [number, number] {
  const svgY = config.equatorY - lat * config.pixelsPerLat;
  const svgX =
    (lng - config.primeMeridianReferenceLng) * config.pixelsPerLng + config.primeMeridianX;

  return [svgX, svgY];
}

/**
 * Create a coordinate config from a simple bounding box mapping.
 * Useful for non-IxEarth SVGs where the admin specifies geographic bounds.
 *
 * When `preserveAspectRatio` is true (default), uses the same scale factor
 * for both axes so shapes aren't distorted. The content is centered within
 * the geographic bounds, with unused margins on the shorter axis.
 */
export function createConfigFromBounds(
  viewBoxWidth: number,
  viewBoxHeight: number,
  geoBounds: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  },
  options?: { preserveAspectRatio?: boolean }
): SvgCoordinateConfig {
  const lngRange = geoBounds.maxLng - geoBounds.minLng;
  const latRange = geoBounds.maxLat - geoBounds.minLat;

  let pixelsPerLng = viewBoxWidth / lngRange;
  let pixelsPerLat = viewBoxHeight / latRange;

  if (options?.preserveAspectRatio !== false) {
    // Isotropic scaling: use uniform scale so shapes maintain correct proportions.
    // Pick the larger value so the entire SVG fits within the geographic bounds.
    const uniformScale = Math.max(pixelsPerLng, pixelsPerLat);
    pixelsPerLng = uniformScale;
    pixelsPerLat = uniformScale;
  }

  // With isotropic scaling the SVG may not fill the full geo bounds on one axis.
  // Center the content within the bounds.
  const effectiveLngRange = viewBoxWidth / pixelsPerLng;
  const effectiveLatRange = viewBoxHeight / pixelsPerLat;
  const lngOffset = (lngRange - effectiveLngRange) / 2;
  const latOffset = (latRange - effectiveLatRange) / 2;
  const effectiveMinLng = geoBounds.minLng + lngOffset;
  const effectiveMaxLat = geoBounds.minLat + latOffset + effectiveLatRange;

  // Equator (lat=0): svgY where lat = (equatorY - svgY) / pixelsPerLat = 0
  const equatorY = effectiveMaxLat * pixelsPerLat;
  // Prime meridian (lng=0): svgX where (svgX - primeMeridianX) / pixelsPerLng = 0
  const primeMeridianX = -effectiveMinLng * pixelsPerLng;

  return {
    viewBoxWidth,
    viewBoxHeight,
    equatorY,
    primeMeridianX,
    pixelsPerLng,
    pixelsPerLat,
    primeMeridianReferenceLng: 0,
  };
}

/**
 * Create a coordinate config by calibrating from known SVG ↔ WGS84 correspondences.
 *
 * Given 2+ matched points (SVG coordinates → known WGS84 coordinates), computes
 * the best-fit affine transform. This is the most accurate method when reference
 * GeoJSON data exists for the same features.
 *
 * The transform is: lng = svgX / pxPerLng + offsetLng
 *                   lat = -svgY / pxPerLat + offsetLat
 */
export function createConfigFromCalibration(
  viewBoxWidth: number,
  viewBoxHeight: number,
  points: Array<{ svgX: number; svgY: number; lng: number; lat: number }>
): SvgCoordinateConfig | null {
  if (points.length < 2) return null;

  // Step 1: Theil-Sen robust initial estimate for the longitude slope.
  // Median of pairwise slopes is immune to up to 29% outliers — enough to
  // handle antimeridian-wrapped features (SVG right-edge → lng jumps by 360°).
  const slopesX: number[] = [];
  const slopesY: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j]!.svgX - points[i]!.svgX;
      const dy = points[j]!.svgY - points[i]!.svgY;
      if (Math.abs(dx) > 1) slopesX.push((points[j]!.lng - points[i]!.lng) / dx);
      if (Math.abs(dy) > 1) slopesY.push((points[j]!.lat - points[i]!.lat) / dy);
    }
  }
  if (slopesX.length === 0 || slopesY.length === 0) return null;

  slopesX.sort((a, b) => a - b);
  slopesY.sort((a, b) => a - b);
  const medA = slopesX[Math.floor(slopesX.length / 2)]!; // robust d(lng)/d(svgX)
  const medC = slopesY[Math.floor(slopesY.length / 2)]!; // robust d(lat)/d(svgY)

  // Robust intercepts: median of (lng - medA * svgX) and (lat - medC * svgY)
  const interceptsX = points.map((p) => p.lng - medA * p.svgX).sort((a, b) => a - b);
  const interceptsY = points.map((p) => p.lat - medC * p.svgY).sort((a, b) => a - b);
  const medB = interceptsX[Math.floor(interceptsX.length / 2)]!;
  const medD = interceptsY[Math.floor(interceptsY.length / 2)]!;

  // Step 2: Use Theil-Sen estimates to filter outliers (threshold 5°), then
  // run least-squares on the clean subset for the final fit.
  let filtered = points.filter((p) => {
    const predLng = medA * p.svgX + medB;
    const predLat = medC * p.svgY + medD;
    return Math.abs(predLng - p.lng) < 5 && Math.abs(predLat - p.lat) < 5;
  });
  if (filtered.length < 2) return null;

  // Step 3: Least-squares on clean data (one round of LS + one more outlier pass).
  let a = 0,
    b = 0,
    c = 0,
    d = 0;
  for (let round = 0; round < 2; round++) {
    const result = linearRegression(filtered);
    if (!result) return null;
    ({ a, b, c, d } = result);

    const inliers = filtered.filter((p) => {
      const predLng = a * p.svgX + b;
      const predLat = c * p.svgY + d;
      return Math.abs(predLng - p.lng) < 5 && Math.abs(predLat - p.lat) < 5;
    });
    if (inliers.length === filtered.length) break;
    if (inliers.length < 2) return null;
    filtered = inliers;
  }

  if (a <= 0 || c >= 0) return null; // sanity: lng increases with X, lat decreases with Y

  // Convert to SvgCoordinateConfig format:
  //   lng = (svgX - primeMeridianX) / pixelsPerLng  →  a = 1/pixelsPerLng, b = -primeMeridianX/pixelsPerLng
  //   lat = (equatorY - svgY) / pixelsPerLat  →  c = -1/pixelsPerLat, d = equatorY/pixelsPerLat
  const pixelsPerLng = 1 / a;
  const pixelsPerLat = 1 / Math.abs(c);
  const primeMeridianX = -b * pixelsPerLng;
  const equatorY = d * pixelsPerLat;

  return {
    viewBoxWidth,
    viewBoxHeight,
    equatorY,
    primeMeridianX,
    pixelsPerLng,
    pixelsPerLat,
    primeMeridianReferenceLng: 0,
  };
}

/** Least-squares linear regression for the affine SVG→WGS84 transform. */
function linearRegression(
  points: Array<{ svgX: number; svgY: number; lng: number; lat: number }>
): { a: number; b: number; c: number; d: number } | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0,
    sumLng = 0,
    sumXX = 0,
    sumXLng = 0;
  let sumY = 0,
    sumLat = 0,
    sumYY = 0,
    sumYLat = 0;

  for (const p of points) {
    sumX += p.svgX;
    sumLng += p.lng;
    sumXX += p.svgX * p.svgX;
    sumXLng += p.svgX * p.lng;
    sumY += p.svgY;
    sumLat += p.lat;
    sumYY += p.svgY * p.svgY;
    sumYLat += p.svgY * p.lat;
  }

  const denomX = n * sumXX - sumX * sumX;
  const denomY = n * sumYY - sumY * sumY;
  if (Math.abs(denomX) < 1e-10 || Math.abs(denomY) < 1e-10) return null;

  return {
    a: (n * sumXLng - sumX * sumLng) / denomX, // d(lng)/d(svgX)
    b: (sumLng - ((n * sumXLng - sumX * sumLng) / denomX) * sumX) / n,
    c: (n * sumYLat - sumY * sumLat) / denomY, // d(lat)/d(svgY) — negative
    d: (sumLat - ((n * sumYLat - sumY * sumLat) / denomY) * sumY) / n,
  };
}
