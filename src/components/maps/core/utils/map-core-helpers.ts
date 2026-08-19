// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import type { FeatureCollection } from "geojson";

export const COUNTRY_LABEL_OPACITY: unknown = ["coalesce", ["get", "_distFade"], 0];

/** Escape HTML entities for safe insertion into popup innerHTML */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Area thresholds for progressive feature loading based on zoom */
export const PROGRESSIVE_THRESHOLDS: Record<string, [number, number][]> = {
  // [zoom, minAreaSqKm] — features below threshold are hidden at low zoom
  rivers: [
    [0, 50],
    [3, 20],
    [5, 0],
  ],
  lakes: [
    [0, 50],
    [3, 20],
    [5, 0],
  ],
};

/** Get the minimum area for a layer type at a given zoom level */
export function getMinArea(layerType: string, zoom: number): number {
  const thresholds = PROGRESSIVE_THRESHOLDS[layerType];
  if (!thresholds) return 0;
  let minArea = thresholds[0][1];
  for (const [z, area] of thresholds) {
    if (zoom >= z) minArea = area;
  }
  return minArea;
}

const filterCache = new WeakMap<any, Map<number, FeatureCollection>>();

/** Filter a FeatureCollection by minimum area */
export function filterByArea(data: FeatureCollection, minArea: number): FeatureCollection {
  if (minArea <= 0 || !data || !data.features) return data;

  let areaCache = filterCache.get(data);
  if (!areaCache) {
    areaCache = new Map();
    filterCache.set(data, areaCache);
  }

  let cached = areaCache.get(minArea);
  if (!cached) {
    cached = {
      ...data,
      features: data.features.filter((f) => {
        const area =
          (f.properties?.areaKm2 as number) ??
          (f.properties?._areaSqKm as number) ??
          (f.properties?.areaSqKm as number) ??
          ((f.properties?.lengthKm as number)
            ? (f.properties?.lengthKm as number) * 50
            : undefined) ??
          ((f.properties?.flux as number) ? (f.properties?.flux as number) * 10 : undefined) ??
          99999;
        return area >= minArea;
      }),
    };
    areaCache.set(minArea, cached);
  }
  return cached;
}

/**
 * Generate a 5-pointed star image as ImageData for MapLibre addImage().
 * Follows wiki/cartographic convention: filled star for national capitals.
 */
export function createStarImage(size: number, fillColor: string, strokeColor: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1;
  const innerR = outerR * 0.4;
  const spikes = 5;

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 2) * -1 + (Math.PI / spikes) * i;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}
