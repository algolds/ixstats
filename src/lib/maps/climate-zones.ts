/**
 * A realm's climate key in use (`settings.map.climateKey`): the label a zone is shown with, and which zone a
 * climate feature is. Client-safe.
 */
import type { ClimateKey, ClimateZone } from "./realm-map-settings";

/** "Cfb: Oceanic": a zone as the pin readout and the Geography tab show it (as Ixnay's "Do: Temperate Oceanic"). */
export const climateZoneLabel = (zone: Pick<ClimateZone, "code" | "name">): string =>
  `${zone.code}: ${zone.name}`;

/**
 * A colour as one spelling to compare by: lower case, `#rgb` and `#rgba` expanded to `#rrggbb` and `#rrggbbaa`, and an
 * opaque `ff` alpha dropped, so `#A8C995FF` and `#a8c995` name the same fill, as do `#fc0f` and `#ffcc00`. Anything else (a name, a
 * `rgb()`) is only trimmed and lower-cased.
 */
export function normalizeHexColor(color: string): string {
  const hex = color.trim().toLowerCase();
  if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) return hex;
  const full =
    hex.length <= 5 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}` : hex;
  return full.length === 9 && full.endsWith("ff") ? full.slice(0, 7) : full;
}

/** The key's zone a climate feature is: by its zone code (`properties.climateId`), else by its fill colour. */
export function climateZoneOf(
  key: ClimateKey,
  properties: Record<string, unknown> | null | undefined
): ClimateZone | null {
  const code = properties?.climateId;
  const fill = typeof properties?.fill === "string" ? normalizeHexColor(properties.fill) : null;
  return (
    key.zones.find((z) => z.code === code) ??
    key.zones.find((z) => normalizeHexColor(z.color) === fill) ??
    null
  );
}
