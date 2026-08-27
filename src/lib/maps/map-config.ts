/**
 * IxMaps Configuration
 *
 * MapLibre GL JS configuration for the IxEarth fictional world map.
 * Uses globe projection at low zoom, transitions to mercator at higher zoom.
 * Visual style: minimal/clean (Google Maps-like) with light palette.
 */

import { ELEVATION_ZONES, type ElevationZoneConfig } from "./elevation-config";
import {
  CLIMATE_TYPES,
  CLIMATE_NAMES,
  CLIMATE_COLORS,
  type IxWorldClimate,
} from "~/lib/worldgen/climate-system";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";

/** Available map layer types matching GeoJSON files */
export const MAP_LAYER_TYPES = [
  "background",
  "altitudes",
  "climate",
  "biomes",
  "political",
  "lakes",
  "rivers",
  "icecaps",
  "cities",
  "trade_routes",
  "country_labels",
] as const;

export type MapLayerType = (typeof MAP_LAYER_TYPES)[number];

/** Countries whose labels are demoted (only shown at high zoom) */
export const DEMOTED_COUNTRY_NAMES = ["Ugarit", "Orenstia", "Trade Island 5"] as const;

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
  climate: {
    label: "Climate Zones",
    zIndex: 2,
    defaultVisible: false,
    fillColor: "from-property",
    fillOpacity: 0.35,
    type: "fill",
  },
  biomes: {
    label: "Biomes",
    zIndex: 2,
    defaultVisible: false,
    fillColor: "from-property",
    fillOpacity: 0.4,
    type: "fill",
  },
  political: {
    label: "Countries",
    zIndex: 4,
    defaultVisible: true,
    fillColor: "from-property",
    fillOpacity: 0.45,
    strokeColor: "#64748b",
    strokeWidth: 1.0,
    type: "fill",
  },
  lakes: {
    label: "Lakes",
    zIndex: 6,
    defaultVisible: true,
    fillColor: "#0284c7",
    fillOpacity: 0.85,
    type: "fill",
  },
  rivers: {
    label: "Rivers",
    zIndex: 7,
    defaultVisible: true,
    fillColor: "#5295c4",
    fillOpacity: 1,
    strokeColor: "#5295c4",
    strokeWidth: 1.0,
    type: "line",
  },
  icecaps: {
    label: "Ice Caps",
    zIndex: 6,
    defaultVisible: false,
    fillColor: "#f0f4f8",
    fillOpacity: 0.7,
    type: "fill",
  },
  cities: {
    label: "Cities",
    zIndex: 7,
    defaultVisible: false,
    fillColor: "#FF4444",
    fillOpacity: 1,
    type: "fill",
  },
  trade_routes: {
    label: "Trade Routes",
    zIndex: 7,
    defaultVisible: false,
    fillColor: "#8B4513",
    fillOpacity: 0,
    strokeColor: "#8B4513",
    strokeWidth: 1.5,
    type: "line",
  },
  country_labels: {
    label: "Country Names",
    zIndex: 8,
    defaultVisible: true,
    fillColor: "#000",
    fillOpacity: 1,
    type: "fill", // placeholder, handled as symbol in IxWorldMap
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
  {
    mode: "dynamic",
    label: "Auto",
    title: "Dynamic projection (globe at low zoom, flat at high zoom)",
  },
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
      return { type: ["interpolate", ["linear"], ["zoom"], 2.5, "globe", 5.5, "mercator"] };
  }
}

/** Ocean background color for the globe */
export const OCEAN_COLOR = "#b3cde0";

// ─── Route Styles (single source of truth) ───────────────────────────────────

/**
 * Visual style for each transport route type.
 * Consumed by TransportOverlay (IxWorldMap) and EditorMap route layers so that
 * adding a new route type is a single-line change here.
 */
export interface RouteStyle {
  /** Display label used in the UI */
  label: string;
  /** MapLibre line-color / UI color swatch */
  color: string;
  /** MapLibre line-width in pixels */
  width: number;
  /** Optional MapLibre line-dasharray (undefined = solid) */
  dash?: number[];
}

export const ROUTE_STYLES: Record<string, RouteStyle> = {
  rail: { label: "Rail", color: "#374151", width: 3 },
  highway: { label: "Highway", color: "#f97316", width: 2.5 },
  road: { label: "Road", color: "#92400e", width: 1.5 },
  shipping_lane: { label: "Shipping", color: "#3b82f6", width: 2 },
  canal: { label: "Canal", color: "#06b6d4", width: 1.5 },
  air_corridor: { label: "Air", color: "#a855f7", width: 2, dash: [6, 4] },
  ferry: { label: "Ferry", color: "#14b8a6", width: 1.5, dash: [4, 3] },
  pipeline: { label: "Pipeline", color: "#eab308", width: 2 },
  power_grid: { label: "Power", color: "#f59e0b", width: 1.5 },
  fiber: { label: "Fiber", color: "#e5e7eb", width: 1 },
  military_supply: { label: "Mil. Supply", color: "#dc2626", width: 2 },
  military_naval: { label: "Mil. Naval", color: "#7f1d1d", width: 2 },
};

/** Ordered list of all route type keys for consistent UI rendering */
export const ROUTE_TYPE_KEYS = Object.keys(ROUTE_STYLES) as (keyof typeof ROUTE_STYLES)[];

/** Map of route types to hex colors */
export const ROUTE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_STYLES).map(([k, v]) => [k, v.color])
);

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
  return DEFAULT_COUNTRY_COLORS[Math.abs(hash) % DEFAULT_COUNTRY_COLORS.length];
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

/** Parse hex color to [r, g, b]. Returns [0,0,0] if invalid. */
function hexToRgb(hex: string): [number, number, number] {
  if (!hex || typeof hex !== "string") return [0, 0, 0];
  const h = hex.replace("#", "");
  if (h.length !== 6 && h.length !== 3) return [0, 0, 0];

  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }

  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

/** Convert [r, g, b] to hex string */
function rgbToHex(r: number, g: number, b: number): string {
  // Guard against NaN
  const safeR = isNaN(r) ? 0 : r;
  const safeG = isNaN(g) ? 0 : g;
  const safeB = isNaN(b) ? 0 : b;

  return (
    "#" +
    [safeR, safeG, safeB]
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
  const safeRatio = isNaN(ratio) ? 0 : Math.max(0, Math.min(1, ratio));

  return rgbToHex(
    r1 + (r2 - r1) * safeRatio,
    g1 + (g2 - g1) * safeRatio,
    b1 + (b2 - b1) * safeRatio
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
  if (!subjectColor || !sovereignColor) return subjectColor || sovereignColor || "#888";
  const safeAutonomy = typeof autonomy === "number" ? autonomy : 0.5;
  const sovereignWeight = 0.8 - safeAutonomy * 0.6; // Range: 0.8 → 0.2
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
      z.elevationMax >= 9999 ? `${z.elevationMin}m+` : `${z.elevationMin}-${z.elevationMax}m`,
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
  coordinates: [number, number]; // [lng, lat] — approximate center
  type: "ocean" | "sea" | "strait";
  rank: "major" | "medium" | "minor";
  /** Approximate bounding box [west, south, east, north] in degrees */
  bounds: [number, number, number, number];
  /** Approximate area in million km² */
  areaMKm2: number;
  /** Average depth in meters (approximate) */
  avgDepthM: number;
  /** Maximum depth in meters (approximate) */
  maxDepthM: number;
  /** Bordering countries/regions (wiki page names) */
  borders?: string[];
}

export const WATER_BODY_LABELS: WaterBodyLabel[] = [
  // ── Major Oceans ──
  {
    name: "Levantine Ocean",
    coordinates: [115, 32],
    type: "ocean",
    rank: "major",
    bounds: [70, 5, 165, 60],
    areaMKm2: 82.4,
    avgDepthM: 3680,
    maxDepthM: 10200,
    borders: ["Daxia", "Oyashima", "Metzetta", "Rusana"],
  },
  {
    name: "Ocean of Cathay",
    coordinates: [175, -30],
    type: "ocean",
    rank: "major",
    bounds: [140, -65, -140, 5],
    areaMKm2: 96.5,
    avgDepthM: 4050,
    maxDepthM: 11000,
    borders: ["Oyashima", "Tapakdore"],
  },
  {
    name: "Odoneru Ocean",
    coordinates: [-15, 20],
    type: "ocean",
    rank: "major",
    bounds: [-60, -30, 30, 55],
    areaMKm2: 68.8,
    avgDepthM: 3350,
    maxDepthM: 8600,
    borders: ["Cartadania", "Caphiria", "Urcea", "Pelaxia", "Burgundie"],
  },
  {
    name: "Absurian Ocean",
    coordinates: [30, -62],
    type: "ocean",
    rank: "major",
    bounds: [-30, -80, 90, -45],
    areaMKm2: 35.2,
    avgDepthM: 3700,
    maxDepthM: 7200,
  },

  // ── Seas ──
  {
    name: "Kilikas Sea",
    coordinates: [25, 58],
    type: "sea",
    rank: "medium",
    bounds: [10, 52, 40, 64],
    areaMKm2: 1.8,
    avgDepthM: 180,
    maxDepthM: 460,
    borders: ["Urcea", "Burgundie"],
  },
  {
    name: "Sea of Nordska",
    coordinates: [98, 52],
    type: "sea",
    rank: "medium",
    bounds: [78, 44, 118, 60],
    areaMKm2: 3.2,
    avgDepthM: 280,
    maxDepthM: 1100,
    borders: ["Daxia", "Rusana"],
  },
  {
    name: "Sea of Capean",
    coordinates: [160, 42],
    type: "sea",
    rank: "medium",
    bounds: [145, 35, 175, 50],
    areaMKm2: 2.1,
    avgDepthM: 350,
    maxDepthM: 1800,
  },
  {
    name: "Sea of Canete",
    coordinates: [55, -9],
    type: "sea",
    rank: "medium",
    bounds: [40, -18, 70, 0],
    areaMKm2: 2.8,
    avgDepthM: 420,
    maxDepthM: 2200,
    borders: ["Caphiria", "Cartadania"],
  },
  {
    name: "Sea of Istroya",
    coordinates: [85, -5],
    type: "sea",
    rank: "medium",
    bounds: [70, -15, 100, 5],
    areaMKm2: 2.4,
    avgDepthM: 380,
    maxDepthM: 1900,
    borders: ["Metzetta"],
  },
  {
    name: "Tainean Sea",
    coordinates: [-10, -12],
    type: "sea",
    rank: "medium",
    bounds: [-25, -20, 5, -4],
    areaMKm2: 1.6,
    avgDepthM: 320,
    maxDepthM: 1400,
    borders: ["Cartadania", "Pelaxia"],
  },
  {
    name: "Kindreds Sea",
    coordinates: [-8, -28],
    type: "sea",
    rank: "medium",
    bounds: [-22, -36, 6, -20],
    areaMKm2: 1.9,
    avgDepthM: 290,
    maxDepthM: 1200,
    borders: ["Cartadania"],
  },
  {
    name: "Founders Sea",
    coordinates: [80, -40],
    type: "sea",
    rank: "medium",
    bounds: [60, -50, 100, -30],
    areaMKm2: 3.5,
    avgDepthM: 450,
    maxDepthM: 2800,
  },
  {
    name: "Pukhtun Sea",
    coordinates: [145, -25],
    type: "sea",
    rank: "medium",
    bounds: [130, -35, 160, -15],
    areaMKm2: 2.6,
    avgDepthM: 360,
    maxDepthM: 1600,
  },
  {
    name: "Great Expanse",
    coordinates: [168, -5],
    type: "sea",
    rank: "medium",
    bounds: [155, -15, 180, 5],
    areaMKm2: 4.1,
    avgDepthM: 480,
    maxDepthM: 3200,
  },
  {
    name: "Sea of St. John",
    coordinates: [-140, 15],
    type: "sea",
    rank: "medium",
    bounds: [-160, 5, -120, 25],
    areaMKm2: 3.0,
    avgDepthM: 400,
    maxDepthM: 2500,
  },
  {
    name: "Albion Sea",
    coordinates: [-58, 55],
    type: "sea",
    rank: "medium",
    bounds: [-75, 45, -40, 65],
    areaMKm2: 2.3,
    avgDepthM: 250,
    maxDepthM: 900,
  },
  {
    name: "Sea of Orixtal",
    coordinates: [-110, -18],
    type: "sea",
    rank: "medium",
    bounds: [-130, -28, -90, -8],
    areaMKm2: 3.4,
    avgDepthM: 380,
    maxDepthM: 2100,
  },
  {
    name: "Polynesian Sea",
    coordinates: [-55, -30],
    type: "sea",
    rank: "medium",
    bounds: [-70, -40, -40, -20],
    areaMKm2: 2.0,
    avgDepthM: 300,
    maxDepthM: 1300,
  },
  {
    name: "Okatian Sea",
    coordinates: [-70, -45],
    type: "sea",
    rank: "minor",
    bounds: [-85, -52, -55, -38],
    areaMKm2: 1.2,
    avgDepthM: 220,
    maxDepthM: 800,
  },
  {
    name: "Barbary Straits",
    coordinates: [115, 2],
    type: "strait",
    rank: "minor",
    bounds: [108, -3, 122, 7],
    areaMKm2: 0.4,
    avgDepthM: 80,
    maxDepthM: 280,
  },
];

import { getMapGlyphsUrl } from "~/lib/base-path";

/**
 * Symbol-layer `text-font` stacks. Must match PBFs available at `getMapGlyphsUrl()`
 * (self-hosted DejaVu under IxStats vs Noto on protomaps CDN for standalone IxWorld).
 */
export const MAP_SYMBOL_FONTS =
  process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true"
    ? {
        regular: ["Noto Sans Regular"] as [string],
        bold: ["Noto Sans Medium"] as [string],
        sans: ["Noto Sans Regular"] as [string],
      }
    : {
        regular: ["DejaVu Sans Regular"] as [string],
        bold: ["DejaVu Sans Bold"] as [string],
        sans: ["DejaVu Sans"] as [string],
      };

import { getStyleForTheme, type MapTheme } from "~/lib/map-styles/registry";

/** Build the base MapLibre style for a given theme */
export function buildBaseStyle(
  theme: MapTheme = "standard",
  projectionMode: ProjectionMode = "dynamic"
): Record<string, unknown> {
  const base = getStyleForTheme(theme, getMapGlyphsUrl(), MAP_SYMBOL_FONTS);
  // The style-level projection wins over the constructor option and survives
  // setStyle(), so it must reflect the requested mode — otherwise a forced-flat
  // editor map snaps back to the globe on every theme/style apply.
  base.projection = getProjectionSpec(projectionMode);
  return base;
}

// ── Framework: World-aware configuration ────────────────────────────

/**
 * Resolved world configuration for rendering.
 * This is the shape that all map components consume.
 * Currently returns hardcoded IxWorld config; future versions will
 * read from the WorldConfig database table.
 */
export interface WorldMapConfig {
  worldId: string;
  name: string;
  wikiBaseUrl: string | null;
  wikiApiPath: string;
  mapProjection: ProjectionMode;
  defaultCenter: [number, number];
  defaultZoom: number;
  layerTypes: MapLayerType[];
  climateSystem: string;
  oceanColor: string;
  countryColors: string[];
  waterBodyLabels: Array<{
    name: string;
    lng: number;
    lat: number;
    type: string;
    areaMKm2: number;
    avgDepthM: number;
    maxDepthM: number;
    borders?: string[];
  }>;
  layerConfigs: Record<MapLayerType, LayerConfig>;
  sovereigntyTypes: typeof SOVEREIGNTY_TYPE_MAP;
  elevationZones: readonly ElevationZoneConfig[];
}

/** Default IxWorld configuration (used as baseline for all worlds) */
const IXWORLD_DEFAULTS: WorldMapConfig = {
  worldId: "default",
  name: "IxWorld",
  wikiBaseUrl: DEFAULT_MEDIAWIKI_URL,
  wikiApiPath: "/api.php",
  mapProjection: "dynamic",
  defaultCenter: MAP_DEFAULTS.center,
  defaultZoom: MAP_DEFAULTS.zoom,
  layerTypes: [...MAP_LAYER_TYPES],
  climateSystem: "trewartha",
  oceanColor: OCEAN_COLOR,
  countryColors: DEFAULT_COUNTRY_COLORS,
  waterBodyLabels: WATER_BODY_LABELS.map((l) => ({
    name: l.name,
    lng: l.coordinates[0],
    lat: l.coordinates[1],
    type: l.type,
    areaMKm2: l.areaMKm2,
    avgDepthM: l.avgDepthM,
    maxDepthM: l.maxDepthM,
    borders: l.borders,
  })),
  layerConfigs: { ...LAYER_CONFIGS },
  sovereigntyTypes: SOVEREIGNTY_TYPE_MAP,
  elevationZones: ELEVATION_ZONES,
};

/**
 * Load world configuration by worldId.
 *
 * Synchronous path: returns hardcoded IxWorld config for "default".
 * For custom realms, use loadRealmWorldConfig() which reads from DB.
 */
export function loadWorldConfig(worldId: string = "default"): WorldMapConfig {
  if (worldId === "default") {
    return { ...IXWORLD_DEFAULTS };
  }
  // For non-default worlds without DB access, return defaults with worldId override
  return { ...IXWORLD_DEFAULTS, worldId, name: worldId };
}

/**
 * Load world configuration from a database WorldConfig record.
 * Merges stored config with IxWorld defaults — any field not set
 * in the DB record falls back to the IxWorld baseline.
 */
export function loadWorldConfigFromDB(dbConfig: {
  worldId: string;
  name: string;
  description?: string | null;
  wikiBaseUrl?: string | null;
  wikiApiPath?: string;
  mapProjection?: string;
  defaultCenter?: unknown;
  defaultZoom?: number;
  layerTypes?: unknown;
  climateSystem?: string;
  elevationZones?: unknown;
  waterBodyLabels?: unknown;
  countryColors?: unknown;
  sovereigntyTypes?: unknown;
}): WorldMapConfig {
  return {
    ...IXWORLD_DEFAULTS,
    worldId: dbConfig.worldId,
    name: dbConfig.name,
    wikiBaseUrl: dbConfig.wikiBaseUrl ?? IXWORLD_DEFAULTS.wikiBaseUrl,
    wikiApiPath: dbConfig.wikiApiPath ?? IXWORLD_DEFAULTS.wikiApiPath,
    mapProjection: (dbConfig.mapProjection as ProjectionMode) ?? IXWORLD_DEFAULTS.mapProjection,
    defaultCenter: (dbConfig.defaultCenter as [number, number]) ?? IXWORLD_DEFAULTS.defaultCenter,
    defaultZoom: dbConfig.defaultZoom ?? IXWORLD_DEFAULTS.defaultZoom,
    layerTypes: (dbConfig.layerTypes as MapLayerType[]) ?? IXWORLD_DEFAULTS.layerTypes,
    climateSystem: dbConfig.climateSystem ?? IXWORLD_DEFAULTS.climateSystem,
    countryColors: (dbConfig.countryColors as string[]) ?? IXWORLD_DEFAULTS.countryColors,
    waterBodyLabels:
      (dbConfig.waterBodyLabels as WorldMapConfig["waterBodyLabels"]) ??
      IXWORLD_DEFAULTS.waterBodyLabels,
    elevationZones:
      (dbConfig.elevationZones as readonly ElevationZoneConfig[]) ??
      IXWORLD_DEFAULTS.elevationZones,
  };
}
