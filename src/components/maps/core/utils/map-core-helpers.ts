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
  // [zoom, minAreaSqKm] — features below threshold are hidden
  rivers: [
    [0, 3000],
    [3, 1000],
    [5, 200],
    [6, 0],
  ],
  lakes: [
    [0, 5000],
    [3, 1000],
    [5, 200],
    [6, 0],
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

/** Filter a FeatureCollection by minimum area */
export function filterByArea(data: FeatureCollection, minArea: number): FeatureCollection {
  if (minArea <= 0) return data;
  return {
    ...data,
    features: data.features.filter((f) => {
      const area = (f.properties?._areaSqKm as number) ?? 0;
      return area >= minArea;
    }),
  };
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
