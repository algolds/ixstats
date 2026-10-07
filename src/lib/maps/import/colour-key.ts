/**
 * Colour-key legends for PNG map imports: a CSV or JSON file saying which colour is which nation, so the admin
 * does not name a hundred swatches by hand. A nation may have several colours (each becomes part of it).
 *
 * Accepted shapes:
 *   CSV   one row per colour: a hex cell and a name cell in either order, an optional header; or a name followed
 *         by several hex cells.
 *   JSON  { "#ff0000": "Nation" } · { "Nation": ["#ff0000", "#ee0000"] } · [{ colour|color|hex, nation|name }]
 *         · [{ nation|name, colours|colors: [...] }]
 * Pure, client-safe.
 */
import Papa from "papaparse";
import { deltaE2000, hexToRgb, normalizeHex, rgbToLab, type Lab } from "./colour";

export interface ColourKeyEntry {
  hex: string;
  nation: string;
}

export interface ColourKey {
  entries: ColourKeyEntry[];
  /** Rows that could not be read, and colours given to two nations (the first one wins). */
  problems: string[];
}

export const MAX_COLOUR_KEY_ENTRIES = 2000;
const NAME_MAX = 200;

function add(key: ColourKey, seen: Map<string, string>, rawHex: unknown, rawNation: unknown, where: string) {
  const hex = typeof rawHex === "string" ? normalizeHex(rawHex) : null;
  const nation = typeof rawNation === "string" ? rawNation.trim().slice(0, NAME_MAX) : "";
  if (!hex || !nation) {
    key.problems.push(`${where}: needs a #rrggbb colour and a nation name`);
    return;
  }
  const earlier = seen.get(hex);
  if (earlier && earlier !== nation) {
    key.problems.push(`${where}: ${hex} is already ${earlier}; kept ${earlier}`);
    return;
  }
  if (earlier || key.entries.length >= MAX_COLOUR_KEY_ENTRIES) return;
  seen.set(hex, nation);
  key.entries.push({ hex, nation });
}

const pick = (row: Record<string, unknown>, names: string[]) =>
  names.map((n) => row[n]).find((v) => v !== undefined);

function fromJson(data: unknown): ColourKey {
  const key: ColourKey = { entries: [], problems: [] };
  const seen = new Map<string, string>();
  if (Array.isArray(data)) {
    data.forEach((item, i) => {
      const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const nation = pick(row, ["nation", "name", "country"]);
      const many = pick(row, ["colours", "colors", "hexes"]);
      if (Array.isArray(many)) many.forEach((hex) => add(key, seen, hex, nation, `Item ${i + 1}`));
      else add(key, seen, pick(row, ["colour", "color", "hex"]), nation, `Item ${i + 1}`);
    });
    return key;
  }
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (normalizeHex(k)) add(key, seen, k, v, k);
      else if (Array.isArray(v)) v.forEach((hex) => add(key, seen, hex, k, k));
      else add(key, seen, v, k, k);
    }
    return key;
  }
  return { entries: [], problems: ["The JSON is not an object or a list"] };
}

function fromCsv(text: string): ColourKey {
  const key: ColourKey = { entries: [], problems: [] };
  const seen = new Map<string, string>();
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  parsed.data.forEach((cells, i) => {
    const trimmed = cells.map((c) => String(c ?? "").trim()).filter(Boolean);
    const hexes = trimmed.filter((c) => normalizeHex(c));
    const names = trimmed.filter((c) => !normalizeHex(c));
    if (hexes.length === 0 && i === 0) return; // a header row
    if (hexes.length === 0 || names.length === 0) {
      key.problems.push(`Row ${i + 1}: needs a #rrggbb colour and a nation name`);
      return;
    }
    for (const hex of hexes) add(key, seen, hex, names[0], `Row ${i + 1}`);
  });
  return key;
}

/** Read a colour key from the text of a CSV or JSON file (JSON when it starts with `{` or `[`). */
export function parseColourKey(text: string): ColourKey {
  const body = text.replace(/^﻿/, "").trim();
  if (!body) return { entries: [], problems: ["The colour key is empty"] };
  if (body.startsWith("{") || body.startsWith("[")) {
    try {
      return fromJson(JSON.parse(body));
    } catch (error) {
      return { entries: [], problems: [`The JSON could not be read: ${(error as Error).message}`] };
    }
  }
  return fromCsv(body);
}

export interface ColourKeyMatch {
  /** Palette hex → the key's nation for it. */
  assignments: Record<string, string>;
  /** Key colours no palette colour came near. */
  unusedKeyColours: ColourKeyEntry[];
}

/**
 * Pre-fill a palette from a colour key: each palette colour takes the nation of the nearest key colour within
 * `tolerance` (CIEDE2000). Key colours that matched nothing are returned so the admin can see them.
 */
export function matchColourKey(
  palette: readonly string[],
  key: readonly ColourKeyEntry[],
  tolerance = 10
): ColourKeyMatch {
  const keyLab: Lab[] = key.map((e) => rgbToLab(hexToRgb(e.hex)));
  const used = new Set<number>();
  const assignments: Record<string, string> = {};
  for (const hex of palette) {
    const lab = rgbToLab(hexToRgb(hex));
    let best = -1;
    let bestDistance = Infinity;
    keyLab.forEach((k, i) => {
      const d = deltaE2000(lab, k);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    if (best >= 0 && bestDistance <= tolerance) {
      assignments[hex] = key[best]!.nation;
      used.add(best);
    }
  }
  return { assignments, unusedKeyColours: key.filter((_, i) => !used.has(i)) };
}
