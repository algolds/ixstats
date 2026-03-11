/**
 * IxMaps Configuration
 *
 * MapLibre GL JS configuration for the IxEarth fictional world map.
 * Uses globe projection at low zoom, transitions to mercator at higher zoom.
 * Visual style: minimal/clean (Google Maps-like) with light palette.
 */

import { ELEVATION_ZONES, type ElevationZoneConfig } from "./elevation-config";
import { CLIMATE_TYPES, CLIMATE_NAMES, CLIMATE_COLORS, type IxWorldClimate } from "./procedural/climate-system";

/** Available map layer types matching GeoJSON files */
export const MAP_LAYER_TYPES = [
  "background",
  "altitudes",
  "climate",
  "political",
  "lakes",
  "rivers",
  "icecaps",
] as const;

export type MapLayerType = (typeof MAP_LAYER_TYPES)[number];

/** Layer rendering configuration */
export interface LayerConfig {
  label: string;
  zIndex: number;
  defaultVisible: boolean;
  fillColor: string | Record<string, string>;
  fillOpacity: number;
  strokeColor?: string;
  strokeWidth?: number;
  type: "fill" | "line";
}

export const LAYER_CONFIGS: Record<MapLayerType, LayerConfig> = {
  background: {
    label: "Landmass",
    zIndex: 0,
    defaultVisible: true,
    fillColor: "#e8e5da",
    fillOpacity: 1,
    type: "fill",
  },
  altitudes: {
    label: "Elevation",
    zIndex: 1,
    defaultVisible: true,
    fillColor: "from-property",
    fillOpacity: 0.75,
    type: "fill",
  },
  rivers: {
    label: "Rivers",
    zIndex: 2,
    defaultVisible: true,
    fillColor: "#7cb5d2",
    fillOpacity: 0,
    strokeColor: "#7cb5d2",
    strokeWidth: 1.2,
    type: "line",
  },
  lakes: {
    label: "Lakes",
    zIndex: 3,
    defaultVisible: true,
    fillColor: "#7cb5d2",
    fillOpacity: 0.65,
    type: "fill",
  },
  climate: {
    label: "Climate Zones",
    zIndex: 4,
    defaultVisible: false,
    fillColor: "from-property",
    fillOpacity: 0.35,
    type: "fill",
  },
  political: {
    label: "Countries",
    zIndex: 5,
    defaultVisible: true,
    fillColor: "from-property",
    fillOpacity: 0.4,
    strokeColor: "#888",
    strokeWidth: 0.8,
    type: "fill",
  },
  icecaps: {
    label: "Ice Caps",
    zIndex: 6,
    defaultVisible: false,
    fillColor: "#f0f4f8",
    fillOpacity: 0.7,
    type: "fill",
  },
};

/** Map view defaults */
export const MAP_DEFAULTS = {
  center: [56.1842, 0] as [number, number],
  zoom: 1.8,
  minZoom: 0.5,
  maxZoom: 6,
  bearing: 0,
  pitch: 0,
};

/** Projection mode for the IxWorld map */
export type ProjectionMode = "dynamic" | "globe" | "mercator";

export const PROJECTION_MODES: { mode: ProjectionMode; label: string; title: string }[] = [
  { mode: "dynamic", label: "Auto", title: "Dynamic projection (globe at low zoom, flat at high zoom)" },
  { mode: "globe", label: "Globe", title: "Lock to globe projection" },
  { mode: "mercator", label: "Flat", title: "Lock to flat (Mercator) projection" },
];

/** Get the MapLibre projection specification for a given mode */
export function getProjectionSpec(mode: ProjectionMode): { type: unknown } {
  switch (mode) {
    case "globe":
      return { type: "globe" };
    case "mercator":
      return { type: "mercator" };
    case "dynamic":
    default:
      return { type: ["interpolate", ["linear"], ["zoom"], 2.5, "globe", 4, "mercator"] };
  }
}

/** Ocean background color for the globe */
export const OCEAN_COLOR = "#b3cde0";

/** Distinct saturated colors for country fills (Google Maps-style) */
export const DEFAULT_COUNTRY_COLORS = [
  "#f8bbd0", // pink
  "#c5cae9", // indigo light
  "#b2dfdb", // teal light
  "#ffe0b2", // orange light
  "#e1bee7", // purple light
  "#ffccbc", // deep orange light
  "#c8e6c9", // green light
  "#fff9c4", // yellow light
  "#d1c4e9", // deep purple light
  "#f0f4c3", // lime light
  "#ffcdd2", // red light
  "#dcedc8", // light green
  "#ffe082", // amber
  "#aed581", // light green 300
  "#ce93d8", // purple 200
  "#ffab91", // deep orange 200
  "#a5d6a7", // green 200
  "#fff176", // yellow 300
  "#f4a460", // sandy brown
  "#dda0dd", // plum
  "#f0e68c", // khaki
  "#e6b8a2", // peach
  "#d4a5a5", // dusty rose
  "#c9cba3", // sage
];

/** Selected/hovered country colors */
export const INTERACTION_COLORS = {
  hover: "rgba(66, 133, 244, 0.3)",
  selected: "rgba(66, 133, 244, 0.5)",
  selectedStroke: "#4285F4",
  hoverStroke: "#5c9eff",
};

/** Generate a consistent pastel color from a feature ID string */
export function getCountryColor(featureId: string): string {
  let hash = 0;
  for (let i = 0; i < featureId.length; i++) {
    hash = featureId.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return DEFAULT_COUNTRY_COLORS[
    Math.abs(hash) % DEFAULT_COUNTRY_COLORS.length
  ];
}

// ──────────────────────────────────────────────
// Sovereignty / dependency configuration
// ──────────────────────────────────────────────

export const SOVEREIGNTY_TYPES = [
  // Original types
  { value: "crown_possession", label: "Crown Possession", short: "Crown Poss." },
  { value: "vassal", label: "Vassal State", short: "Vassal" },
  { value: "protectorate", label: "Protectorate", short: "Protectorate" },
  { value: "dependency", label: "Dependency", short: "Dependency" },
  { value: "puppet_state", label: "Puppet State", short: "Puppet" },
  { value: "dominion", label: "Dominion", short: "Dominion" },
  { value: "condominium", label: "Condominium", short: "Condominium" },
  { value: "associated_state", label: "Associated State", short: "Assoc. State" },
  // Dependency types from world roster
  { value: "colonial_possession", label: "Colonial Possession", short: "Colonial" },
  { value: "overseas_collectivity", label: "Overseas Collectivity", short: "O/S Collect." },
  { value: "overseas_possession", label: "Overseas Possession", short: "O/S Possess." },
  { value: "state", label: "State", short: "State" },
  { value: "commonwealth", label: "Commonwealth", short: "Commonw." },
  { value: "civil_rectory", label: "Civil Rectory", short: "Civil Rect." },
  { value: "special_federal_district", label: "Special Federal District", short: "Spec. Fed." },
  { value: "autonomous_district", label: "Autonomous District", short: "Auton. Dist." },
  { value: "theme", label: "Theme", short: "Theme" },
  { value: "overseas_province", label: "Overseas Province", short: "O/S Prov." },
  { value: "crowned_protectorate", label: "Crowned Protectorate", short: "Crowned Prot." },
  { value: "real_union", label: "Real Union", short: "Real Union" },
  { value: "military_directorate", label: "Military Directorate", short: "Mil. Direct." },
  { value: "province", label: "Province", short: "Province" },
  { value: "benefactor_confederacy", label: "Benefactor Confederacy", short: "Benef. Conf." },
  { value: "military_rectory", label: "Military Rectory", short: "Mil. Rect." },
  { value: "lon_mandate", label: "LoN Mandate", short: "LoN Mandate" },
  { value: "lon_territory", label: "LoN Territory", short: "LoN Terr." },
  { value: "overseas_territory", label: "Overseas Territory", short: "O/S Terr." },
  { value: "overseas_country", label: "Overseas Country", short: "O/S Country" },
  { value: "incorporated_territory", label: "Incorporated Territory", short: "Incorp. Terr." },
  { value: "metaregion", label: "Metaregion", short: "Metaregion" },
  { value: "overseas_state", label: "Overseas State", short: "O/S State" },
  { value: "dependent_protectorate", label: "Dependent Protectorate", short: "Dep. Prot." },
  { value: "lon_city", label: "LoN City", short: "LoN City" },
  { value: "overseas_region", label: "Overseas Region", short: "O/S Region" },
  { value: "constituent_country", label: "Constituent Country", short: "Constituent" },
  { value: "twin_associated_states", label: "Twin Associated States", short: "Twin Assoc." },
] as const;

export type SovereigntyType = (typeof SOVEREIGNTY_TYPES)[number]["value"];

export const SOVEREIGNTY_TYPE_MAP = Object.fromEntries(
  SOVEREIGNTY_TYPES.map((t) => [t.value, t])
) as Record<SovereigntyType, (typeof SOVEREIGNTY_TYPES)[number]>;

/** Parse hex color to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Convert [r, g, b] to hex string */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

/** Interpolate between two hex colors. ratio=0 → color1, ratio=1 → color2 */
export function blendColors(color1: string, color2: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio
  );
}

/**
 * Compute the fill color for a subject territory, blended toward its sovereign's color.
 * autonomy 0.0 → 80% sovereign color (near-total control)
 * autonomy 0.5 → 50/50 blend
 * autonomy 1.0 → 80% subject's own color (mostly independent)
 */
export function getSovereigntyColor(
  subjectColor: string,
  sovereignColor: string,
  autonomy: number
): string {
  const sovereignWeight = 0.8 - autonomy * 0.6; // Range: 0.8 → 0.2
  return blendColors(subjectColor, sovereignColor, sovereignWeight);
}

// ──────────────────────────────────────────────
// Elevation legend configuration
// ──────────────────────────────────────────────

/** Elevation zone legend entries for map UI */
export interface ElevationLegendEntry {
  zoneId: string;
  label: string;
  color: string;
  elevationRange: string;
}

/** Get elevation legend entries for the map UI */
export function getElevationLegend(): ElevationLegendEntry[] {
  return ELEVATION_ZONES.map((z: ElevationZoneConfig) => ({
    zoneId: z.zoneId,
    label: z.zoneName,
    color: z.color.slice(0, 7), // Strip alpha for CSS
    elevationRange:
      z.elevationMax >= 9999
        ? `${z.elevationMin}m+`
        : `${z.elevationMin}-${z.elevationMax}m`,
  }));
}

// ──────────────────────────────────────────────
// Climate legend configuration (Trewartha)
// ──────────────────────────────────────────────

export interface ClimateLegendEntry {
  code: IxWorldClimate;
  label: string;
  color: string;
}

/** Get Trewartha climate legend entries for the map UI */
export function getClimateLegend(): ClimateLegendEntry[] {
  return CLIMATE_TYPES.map((code) => ({
    code,
    label: `${code}: ${CLIMATE_NAMES[code]}`,
    color: CLIMATE_COLORS[code],
  }));
}

// ──────────────────────────────────────────────
// Ocean & sea label positions
// ──────────────────────────────────────────────

export interface WaterBodyLabel {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  type: "ocean" | "sea";
  rank: "major" | "medium" | "minor";
}

export const WATER_BODY_LABELS: WaterBodyLabel[] = [
  // Major oceans
  { name: "Levantine Ocean",   coordinates: [115, 32],    type: "ocean", rank: "major" },
  { name: "Ocean of Cathay",   coordinates: [175, -30],   type: "ocean", rank: "major" },
  { name: "Odoneru Ocean",     coordinates: [-15, 20],    type: "ocean", rank: "major" },
  { name: "Absurian Ocean",    coordinates: [30, -62],    type: "ocean", rank: "major" },
  // Seas
  { name: "Kilikas Sea",       coordinates: [25, 58],     type: "sea",   rank: "medium" },
  { name: "Sea of Nordska",    coordinates: [98, 52],     type: "sea",   rank: "medium" },
  { name: "Sea of Capean",    coordinates: [160, 42],    type: "sea",   rank: "medium" },
  { name: "Sea of Canete",     coordinates: [55, -9],     type: "sea",   rank: "medium" },
  { name: "Sea of Istroya",    coordinates: [85, -5],     type: "sea",   rank: "medium" },
  { name: "Tainean Sea",       coordinates: [-10, -12],   type: "sea",   rank: "medium" },
  { name: "Kindreds Sea",      coordinates: [-8, -28],    type: "sea",   rank: "medium" },
  { name: "Founders Sea",      coordinates: [80, -40],    type: "sea",   rank: "medium" },
  { name: "Pukhtun Sea",       coordinates: [145, -25],   type: "sea",   rank: "medium" },
  { name: "Great Expanse",     coordinates: [168, -5],    type: "sea",   rank: "medium" },
  { name: "Sea of St. John",   coordinates: [-140, 15],   type: "sea",   rank: "medium" },
  { name: "Albion Sea",        coordinates: [-58, 55],    type: "sea",   rank: "medium" },
  { name: "Sea of Orixtal",    coordinates: [-110, -18],   type: "sea",   rank: "medium" },
  { name: "Polynesian Sea",    coordinates: [-55, -30],   type: "sea",   rank: "medium" },
  { name: "Okatian Sea",       coordinates: [-70, -45],   type: "sea",   rank: "minor" },
  { name: "Barbary Straits",   coordinates: [115, 2],     type: "sea",   rank: "minor" },
];

/** Build the base MapLibre style with no data sources (added dynamically) */
export function buildBaseStyle(): Record<string, unknown> {
  return {
    version: 8,
    name: "IxEarth",
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "ocean-background",
        type: "background",
        paint: {
          "background-color": OCEAN_COLOR,
        },
      },
    ],
    projection: {
      type: ["interpolate", ["linear"], ["zoom"], 2.5, "globe", 4, "mercator"],
    },
  };
}
