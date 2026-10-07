import { haversineKm } from "~/lib/maps/planet";

/** Round a distance down to 1, 2, 3 or 5 times a power of ten (MapLibre's scale bar steps). */
export function roundScaleDistance(value: number): number {
  if (!(value > 0)) return 0;
  const pow10 = 10 ** Math.floor(Math.log10(value));
  const d = value / pow10;
  const step = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
  return Number((pow10 * step).toPrecision(12));
}

export interface ScaleBar {
  /** The bar's width in pixels (at most the given maximum). */
  widthPx: number;
  /** "500 km", "20 m". */
  label: string;
}

/**
 * The scale bar for `maxWidthPx` pixels that span `spanKm` on the ground: the largest round distance that fits,
 * and the bar width that shows it.
 */
export function scaleBarFor(spanKm: number, maxWidthPx: number): ScaleBar | null {
  if (!(spanKm > 0) || !Number.isFinite(spanKm)) return null;
  const meters = spanKm * 1000;
  const unitMeters = meters >= 1000 ? 1000 : 1;
  const rounded = roundScaleDistance(meters / unitMeters);
  return {
    widthPx: Math.round((maxWidthPx * rounded * unitMeters) / meters),
    label: `${rounded.toLocaleString()} ${unitMeters === 1000 ? "km" : "m"}`,
  };
}

interface Projector {
  unproject: (point: [number, number]) => { lng: number; lat: number };
  getContainer: () => HTMLElement;
}

/**
 * The ground distance across `maxWidthPx` pixels in the middle of the map, measured on the realm's planet
 * (`radiusKm`) rather than MapLibre's built-in Earth radius.
 */
export function measureScaleSpanKm(map: Projector, maxWidthPx: number, radiusKm: number): number {
  const container = map.getContainer();
  const y = container.clientHeight / 2;
  const x0 = Math.max(0, container.clientWidth / 2 - maxWidthPx / 2);
  const left = map.unproject([x0, y]);
  const right = map.unproject([x0 + maxWidthPx, y]);
  return haversineKm([left.lng, left.lat], [right.lng, right.lat], radiusKm);
}

/** "12.35° N, 67.89° E" for a cursor position. */
export function formatLngLat(lng: number, lat: number): string {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  const ns = lat >= 0 ? "N" : "S";
  const ew = wrapped >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(wrapped).toFixed(2)}° ${ew}`;
}
