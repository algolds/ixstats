/**
 * The map import engine's options and result types, shared by the server (jobs, engines) and the Pipeline
 * wizard. Every option has a default, so `{}` is a valid request. Pure, client-safe.
 */
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";
import { mapGeoreferenceSchema } from "~/lib/maps/realm-map-settings";

export const MAP_IMPORT_KINDS = ["png", "svg", "geojson"] as const;
export type MapImportKind = (typeof MAP_IMPORT_KINDS)[number];

export const MAP_IMPORT_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type MapImportStatus = (typeof MAP_IMPORT_STATUSES)[number];

/** Largest file the import accepts (PNG, JPEG, SVG or GeoJSON). */
export const MAX_MAP_IMPORT_BYTES = 40 * 1024 * 1024;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb hex").transform((h) => h.toLowerCase());

export const colourKeyEntrySchema = z.object({
  hex,
  nation: z.string().trim().min(1).max(200),
});

export const pngEngineOptionsSchema = z.object({
  /** How far (CIEDE2000) a pixel may be from a palette colour and still be that colour. */
  tolerance: z.number().min(1).max(40).default(12),
  /** Smallest share of the image an auto-detected colour must cover (0.0002 = 0.02%). */
  paletteMinShare: z.number().min(0).max(0.1).default(0.0002),
  maxColours: z.number().int().min(2).max(1000).default(400),
  /** Pixels darker than this L* (0-100) and nearly grey are border lines; 0 turns line removal off. */
  borderLightness: z.number().min(0).max(60).default(28),
  /** Extra line colours (e.g. a dark red border style). */
  borderColours: z.array(hex).max(16).default([]),
  /** Colours that are sea or background: their regions are offered as ignored. */
  waterColours: z.array(hex).max(16).default([]),
  /** Regions smaller than this many pixels merge into their largest neighbour; null = 0.002% of the image. */
  minRegionPixels: z.number().int().min(0).max(10_000_000).nullable().default(null),
  /** Drop one-pixel lines and specks before filling (a 3×3 majority vote). */
  majorityFilter: z.boolean().default(true),
  /** Topological simplification: smallest triangle (px²) a vertex may span and still be kept. */
  simplify: z.number().min(0).max(100).default(1.5),
  /** When given, the palette is exactly these colours (a colour key): nothing is auto-detected. */
  colourKey: z.array(colourKeyEntrySchema).max(2000).optional(),
});
export type PngEngineOptions = z.infer<typeof pngEngineOptionsSchema>;

export const svgEngineOptionsSchema = z.object({
  /** Only shapes inside the group whose id or label contains this (e.g. "political"); empty = auto-detect. */
  layer: z.string().max(100).optional(),
  bezierSegments: z.number().int().min(2).max(64).default(8),
});

export const geojsonEngineOptionsSchema = z.object({
  /** The feature property holding the nation's name or key; empty = the first likely one. */
  nameProperty: z.string().max(100).optional(),
});

/** What an analyse job is asked to do. */
export const mapImportOptionsSchema = z.object({
  png: pngEngineOptionsSchema.default(pngEngineOptionsSchema.parse({})),
  svg: svgEngineOptionsSchema.default(svgEngineOptionsSchema.parse({})),
  geojson: geojsonEngineOptionsSchema.default({}),
  /** Overrides the realm's stored georeference for this import. */
  georef: mapGeoreferenceSchema.optional(),
});
export type MapImportOptions = z.infer<typeof mapImportOptionsSchema>;
export type MapImportOptionsInput = z.input<typeof mapImportOptionsSchema>;

/** How an apply job writes: which source region is which nation, and what else it may change. */
export const mapImportApplySchema = z.object({
  /** Source region key → nation name; a key left out or null is not imported. */
  mapping: z.record(z.string().max(300), z.string().trim().max(200).nullable()),
  /** merge: only the imported nations' features change. replace: every other political feature is retired. */
  mode: z.enum(["merge", "replace"]).default("merge"),
  /** Write the traced area as a nation's land area when it has none (never over a stated one). */
  fillMissingLandArea: z.boolean().default(true),
  /** Save the import's georeference as the realm's (Realm.settings.map). */
  saveGeoreference: z.boolean().default(false),
});
export type MapImportApply = z.infer<typeof mapImportApplySchema>;
export type MapImportApplyInput = z.input<typeof mapImportApplySchema>;

/** One region the engine found: a palette colour (PNG), a shape or group (SVG), or a property value (GeoJSON). */
export interface ImportRegion {
  key: string;
  /** A name the source gives it (SVG title or id, GeoJSON property, colour key). */
  name?: string;
  /** #rrggbb for PNG palette colours and SVG fills. */
  colour?: string;
  /** PNG: pixels of this colour after clean-up. */
  pixels?: number;
  /** PNG: separate pieces. SVG/GeoJSON: features. */
  parts?: number;
  /** PNG: small pieces merged into a neighbour. */
  mergedSpecks?: number;
  /** Offered as ignored (sea, background). */
  water?: boolean;
}

export interface EngineReport {
  log: string[];
  warnings: string[];
  /** PNG: image colours that matched no palette colour (largest first), filled from their neighbours. */
  unmatchedColours?: Array<{ hex: string; pixels: number }>;
  /** PNG: border-line and unmatched pixels given to the nearest region. */
  filledPixels?: number;
  /** PNG: pieces under the minimum size merged into their largest neighbour. */
  mergedRegions?: { count: number; pixels: number; minRegionPixels: number };
  timingsMs: Record<string, number>;
}

/** What an analyse job produces, before any region is matched to a nation. */
export interface EngineResult {
  kind: MapImportKind;
  /** "pixel": coordinates are image pixels or SVG viewBox units, georeferenced later; "lonlat": already WGS84. */
  space: "pixel" | "lonlat";
  width: number;
  height: number;
  regions: ImportRegion[];
  /** PNG: a TopoJSON topology (pixel coordinates) whose `regions` object holds one geometry per region key. */
  topology?: unknown;
  /** SVG and GeoJSON: one feature per region key (properties.key). */
  features?: FeatureCollection<Polygon | MultiPolygon, { key: string }>;
  report: EngineReport;
}
