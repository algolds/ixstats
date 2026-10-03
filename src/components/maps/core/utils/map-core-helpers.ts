import type { Feature } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

export const COUNTRY_LABEL_OPACITY: unknown = ["coalesce", ["get", "_distFade"], 0];

/** Escape HTML entities for safe insertion into popup innerHTML */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/** True when two feature arrays hold the same feature objects in the same order. */
export function sameFeatureList(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Push a filtered feature list to a GeoJSON source only when it differs from the list pushed
 * last time. Zoom-driven filters run on every `zoom` frame; re-sending an unchanged
 * FeatureCollection makes MapLibre's worker re-tile the whole source each frame, which is
 * what made zooming stutter. `lastRef` holds the list last sent to this source.
 */
export function setFilteredSourceData(
  source: { setData: (data: GeoJSON.GeoJSON) => unknown } | undefined,
  features: GeoJSON.Feature[],
  lastRef: { current: GeoJSON.Feature[] | null },
  base?: Partial<GeoJSON.FeatureCollection>
): void {
  if (!source) return;
  if (sameFeatureList(lastRef.current, features)) return;
  lastRef.current = features;
  source.setData({ ...base, type: "FeatureCollection", features });
}

/** Whether a feature belongs to the focused country (matched by id, slug or name). */
export function matchesCountry(f: Feature, countryKey: string): boolean {
  const p = f.properties;
  if (!p) return false;
  return (
    p.countryId === countryKey ||
    p.countrySlug === countryKey ||
    (typeof p.countryName === "string" && p.countryName.toLowerCase() === countryKey.toLowerCase())
  );
}

/** Show/hide each of `layerIds` that exists on the map. */
export function setLayersVisible(
  map: MapLibreMap,
  layerIds: string[],
  visible: boolean | undefined
) {
  for (const id of layerIds) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
