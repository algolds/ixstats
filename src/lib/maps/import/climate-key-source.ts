/**
 * A climate key from a map repository's JavaScript data file (eurth-map's `src/data/climates.js`), read with the
 * literal-only reader and never evaluated: an array of zones `{ code, name, rgb: [r, g, b] | color: "#rrggbb",
 * wiki | link }` bound to `zonesBinding`. A file that completes the wiki pages in code (`].map(… prefix + wiki)`)
 * names the string the prefix is bound to as `linkPrefixBinding`, and the prefix is added here instead. A link
 * that is not https is left out. Pure.
 */
import {
  isLiteralObject,
  readBoundLiteral,
  type LiteralValue,
} from "~/lib/realms/sources/js-literal";
import { rgbHex } from "./colour";
import { ClimateKeySchema, type ClimateKey } from "~/lib/maps/realm-map-settings";

export interface ClimateKeySourceOptions {
  system: string;
  zonesBinding: string;
  linkPrefixBinding?: string;
}

const text = (value: LiteralValue | undefined) => (typeof value === "string" ? value : undefined);

function zoneColour(zone: { [key: string]: LiteralValue }): string {
  const hex = text(zone.color);
  if (hex) return hex.toLowerCase();
  const rgb = zone.rgb;
  if (Array.isArray(rgb) && rgb.length === 3 && rgb.every((c) => typeof c === "number")) {
    return rgbHex(rgb as [number, number, number]);
  }
  throw new Error(`The climate zone "${text(zone.code) ?? "?"}" has no colour (rgb or color)`);
}

function zoneLink(zone: { [key: string]: LiteralValue }, prefix: string): string | undefined {
  const page = text(zone.link) ?? text(zone.wiki);
  if (!page) return undefined;
  const link = /^[a-z]+:/i.test(page) ? page : prefix + page;
  return link.startsWith("https://") ? link : undefined;
}

export function readClimateKeySource(source: string, options: ClimateKeySourceOptions): ClimateKey {
  const zones = readBoundLiteral(source, options.zonesBinding, "ignore");
  if (!Array.isArray(zones)) throw new Error(`${options.zonesBinding} is not an array of zones`);
  const prefix = options.linkPrefixBinding
    ? (text(readBoundLiteral(source, options.linkPrefixBinding)) ?? "")
    : "";
  return ClimateKeySchema.parse({
    system: options.system,
    zones: zones.filter(isLiteralObject).map((zone) => {
      const link = zoneLink(zone, prefix);
      return {
        code: text(zone.code),
        name: text(zone.name),
        color: zoneColour(zone),
        ...(link && { link }),
      };
    }),
  });
}
