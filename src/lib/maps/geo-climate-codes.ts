/**
 * Trewartha climate-code tables and lookups: short code ↔ full name, Köppen → Trewartha
 * mapping, and canonical map fill colours. Split out of geo-analytics.ts.
 */

/** Short code → full climate name lookup */
export const CLIMATE_CODE_TO_NAME: Record<string, string> = {
  Ar: "Tropical Wet (Ar)",
  Aw: "Tropical Wet-And-Dry (Aw)",
  Bw: "Desert or Arid (Bw)",
  Bs: "Steppe or Semiarid (Bs)",
  Cs: "Subtropical Dry Summer (Cs)",
  Cf: "Subtropical Humid (Cf)",
  Do: "Temperate Oceanic (Do)",
  Dc: "Temperate Continental (Dc)",
  E: "Boreal (E)",
  Ft: "Tundra (Ft)",
  Fi: "Ice Cap (Fi)",
  H: "Highland (H)",
};

/** Köppen code patterns → the nearest Trewartha code (first match wins). */
const KOPPEN_TO_TREWARTHA: Array<[RegExp, string]> = [
  [/^A[fm]/, "Ar"],
  [/^A[ws]/, "Aw"],
  [/^BW/, "Bw"],
  [/^BS/, "Bs"],
  [/^Cs/, "Cs"],
  [/^C[fw]a/, "Cf"],
  [/^C[fw]/, "Do"],
  [/^D[fsw][ab]/, "Dc"],
  [/^D[fsw]/, "E"],
  [/^ET/, "Ft"],
  [/^EF/, "Fi"],
];

/** The Trewartha code of a zone code: itself, or the nearest type to a Köppen code (Cfb → Do); null if neither. */
export function trewarthaCodeOf(code: string): string | null {
  const nearest = KOPPEN_TO_TREWARTHA.find(([re]) => re.test(code))?.[1];
  return CLIMATE_CODE_TO_NAME[code] ? code : (nearest ?? null);
}

/** The Trewartha type (full name, e.g. "Temperate Oceanic (Do)") of a climate key's zone code; null if neither. */
export function climateMetadataType(code: string): string | null {
  return CLIMATE_CODE_TO_NAME[trewarthaCodeOf(code) ?? ""] ?? null;
}

/** Canonical Trewartha fill colors → climate code. Used to identify climate zones from SVG map data. */
const CLIMATE_COLORS: Record<string, string> = {
  "#990000": "Ar",
  "#ff3300": "Aw",
  "#ffff33": "Bw",
  "#ff9933": "Bs",
  "#669900": "Cs",
  "#336600": "Cf",
  "#00ff99": "Do",
  "#0099ff": "Dc",
  "#0066cc": "E",
  "#b9b9b9": "Ft",
  "#99ffff": "Fi",
  "#ffccff": "H",
};

/**
 * Resolve a climate zone name from a fill color hex string.
 * Matches against canonical Trewartha colors with tolerance for slight SVG variations.
 * Returns full name like "Tropical Wet (Ar)" or null if no match.
 */
export function resolveClimateFromColor(fill: string): string | null {
  if (!fill) return null;
  const hex = fill.toLowerCase().replace(/\s/g, "");

  // Direct match
  for (const [canonical, code] of Object.entries(CLIMATE_COLORS)) {
    if (hex === canonical) return CLIMATE_CODE_TO_NAME[code] ?? null;
  }

  // Fuzzy match by RGB distance (SVG colors may be slightly off)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  let bestCode: string | null = null;
  let bestDist = 50; // max tolerance

  for (const [canonical, code] of Object.entries(CLIMATE_COLORS)) {
    const cr = parseInt(canonical.slice(1, 3), 16);
    const cg = parseInt(canonical.slice(3, 5), 16);
    const cb = parseInt(canonical.slice(5, 7), 16);
    const dist = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestCode = code;
    }
  }

  return bestCode ? (CLIMATE_CODE_TO_NAME[bestCode] ?? null) : null;
}
