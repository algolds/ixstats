/**
 * A realm's climate key in use (`settings.map.climateKey`): the label a zone is shown with, and which zone a
 * climate feature is. Client-safe.
 */
import type { ClimateKey, ClimateZone } from "./realm-map-settings";

/** "Cfb: Oceanic": a zone as the pin readout and the Geography tab show it (as IxWorld's "Do: Temperate Oceanic"). */
export const climateZoneLabel = (zone: Pick<ClimateZone, "code" | "name">): string =>
  `${zone.code}: ${zone.name}`;

/** The key's zone a climate feature is: by its zone code (`properties.climateId`), else by its fill colour. */
export function climateZoneOf(
  key: ClimateKey,
  properties: Record<string, unknown> | null | undefined
): ClimateZone | null {
  const code = properties?.climateId;
  const fill = typeof properties?.fill === "string" ? properties.fill.toLowerCase() : null;
  return (
    key.zones.find((z) => z.code === code) ??
    key.zones.find((z) => z.color.toLowerCase() === fill) ??
    null
  );
}
