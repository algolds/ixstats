// ─── Types ───────────────────────────────────────────────────

/** Trewartha climate classification codes */
export type IxWorldClimate =
  | "Ar" // Tropical Wet
  | "Aw" // Tropical Wet-And-Dry
  | "Bw" // Desert or Arid
  | "Bs" // Steppe or Semiarid
  | "Cs" // Subtropical Dry Summer
  | "Cf" // Subtropical Humid
  | "Do" // Temperate Oceanic
  | "Dc" // Temperate Continental
  | "E" // Boreal
  | "Ft" // Tundra
  | "Fi" // Ice Cap
  | "H"; // Highland
/** Mapping from index to Trewartha climate type */
export const CLIMATE_TYPES: IxWorldClimate[] = [
  "Ar", // 0  — Tropical Wet
  "Aw", // 1  — Tropical Wet-And-Dry
  "Bw", // 2  — Desert or Arid
  "Bs", // 3  — Steppe or Semiarid
  "Cs", // 4  — Subtropical Dry Summer
  "Cf", // 5  — Subtropical Humid
  "Do", // 6  — Temperate Oceanic
  "Dc", // 7  — Temperate Continental
  "E", // 8  — Boreal
  "Ft", // 9  — Tundra
  "Fi", // 10 — Ice Cap
  "H", // 11 — Highland
];

/** Human-readable names for each Trewartha type */
export const CLIMATE_NAMES: Record<IxWorldClimate, string> = {
  Ar: "Tropical Wet",
  Aw: "Tropical Wet-And-Dry",
  Bw: "Desert or Arid",
  Bs: "Steppe or Semiarid",
  Cs: "Subtropical Dry Summer",
  Cf: "Subtropical Humid",
  Do: "Temperate Oceanic",
  Dc: "Temperate Continental",
  E: "Boreal",
  Ft: "Tundra",
  Fi: "Ice Cap",
  H: "Highland",
};

/** Canonical Trewartha color scheme (from wiki legend) */
export const CLIMATE_COLORS: Record<IxWorldClimate, string> = {
  Ar: "#990000",
  Aw: "#FF3300",
  Bw: "#FFFF33",
  Bs: "#FF9933",
  Cs: "#669900",
  Cf: "#336600",
  Do: "#00FF99",
  Dc: "#0099FF",
  E: "#0066CC",
  Ft: "#B9B9B9",
  Fi: "#99FFFF",
  H: "#FFCCFF",
};

// ─── Main Entry ──────────────────────────────────────────────
// ─── Continentality ──────────────────────────────────────────
// ─── Wind Simulation ─────────────────────────────────────────
// ─── Ocean Current Warmth ────────────────────────────────────
// ─── Precipitation ───────────────────────────────────────────
// ─── Temperature ─────────────────────────────────────────────
// ─── Trewartha Classification → IxWorld 12 Types ─────────────
