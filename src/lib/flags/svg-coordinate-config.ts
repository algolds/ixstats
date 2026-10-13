/**
 * SVG Coordinate Configuration
 *
 * Defines the mapping from SVG coordinate space to WGS84 geographic coordinates: an affine transform, either given
 * (a georeference's control points, `createConfigFromCalibration`) or fitted to matched points.
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
 * Convert SVG coordinates to WGS84 [longitude, latitude].
 *
 * Formula:
 *   lat = (equatorY - svgY) / pixelsPerLat
 *   lng = (svgX - primeMeridianX) / pixelsPerLng + primeMeridianReferenceLng
 */
export function svgToWgs84(
  svgX: number,
  svgY: number,
  config: SvgCoordinateConfig
): [number, number] {
  const lat = (config.equatorY - svgY) / config.pixelsPerLat;
  const lng =
    (svgX - config.primeMeridianX) / config.pixelsPerLng + config.primeMeridianReferenceLng;

  return [lng, lat];
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
