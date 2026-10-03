import type { Map as MapLibreMap } from "maplibre-gl";

export const POLITICAL_LAYER_ID = "fill-political";
const ORIGINAL_FILL_COLOR = ["coalesce", ["get", "_fillColor"], "#e8e5da"];

export type ColorStops = [number, string][];

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

/** Colour for `value` on a ramp of ascending `[position, "#rrggbb"]` stops (clamped at both ends). */
export function interpolateColor(value: number, stops: ColorStops): string {
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (value == null || isNaN(value) || value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];

  const i = stops.findIndex((_, k) => value <= stops[k + 1]![0]);
  const [t0, c0] = stops[i]!;
  const [t1, c1] = stops[i + 1]!;
  const t = (value - t0) / (t1 - t0);
  const hex = [0, 1, 2]
    .map((ch) =>
      Math.round(channel(c0, ch) * (1 - t) + channel(c1, ch) * t)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
  return `#${hex}`;
}

/**
 * Recolour the existing political fill per country (a `match` on `_countryId`) instead of adding
 * a separate fill layer, which bands and misaligns. Returns false when there is nothing to colour.
 */
export function colorPoliticalFill(map: MapLibreMap, colors: [id: string, color: string][]) {
  if (colors.length === 0) return false;
  map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", [
    "match",
    ["get", "_countryId"],
    ...colors.flat(),
    "#e8e5da",
  ]);
  return true;
}

export function restorePoliticalFill(map: MapLibreMap) {
  map.setPaintProperty(POLITICAL_LAYER_ID, "fill-color", ORIGINAL_FILL_COLOR);
}
