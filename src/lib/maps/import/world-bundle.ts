/**
 * The world bundle: what the browser world generator uploads (a gzip of this JSON) and what the `world` map import
 * job reads. Pure and safe for a browser Web Worker: no `node:*` imports. The gunzip side is `world-bundle.node.ts`.
 *
 * A bundle is untrusted input: the caps below (cells, slots, the decompressed size) keep a hostile one from pinning
 * the server, and `parseWorldBundleJson` refuses anything the importer would have to guess about (non-finite
 * numbers, open rings, political features that name no slot). Self-intersecting rings are not checked here; the
 * import's dry run checks them in PostGIS.
 */
import type { Feature, FeatureCollection, Position } from "geojson";
import { z } from "zod";
import type { WorldGenParams } from "~/lib/worldgen/v2/types";

export const WORLD_BUNDLE_VERSION = 1;
export const MAX_WORLD_BUNDLE_CELLS = 200_000;
export const MAX_WORLD_BUNDLE_SLOTS = 500;
/** What a gunzipped bundle may measure: a zip-bomb cap, well over a 200,000-cell world's JSON. */
export const MAX_WORLD_BUNDLE_JSON_BYTES = 160 * 1024 * 1024;

export const WORLD_BUNDLE_LAYERS = [
  "background",
  "altitudes",
  "climate",
  "political",
  "rivers",
  "lakes",
  "icecaps",
] as const;
export type WorldBundleLayerName = (typeof WORLD_BUNDLE_LAYERS)[number];
export type WorldBundleSource = "preset" | "realm-map";

/** A nation slot: a generated country the realm's founder may leave claimable or turn into scenery. */
export interface WorldBundleSlot {
  key: string;
  name: string;
  colour: string;
  claimable: boolean;
  population: number;
  gdpPerCapita: number;
  areaKm2: number;
}

export interface WorldBundle {
  version: typeof WORLD_BUNDLE_VERSION;
  seed: number;
  params: WorldGenParams;
  /** "realm-map": generated around the realm's own borders, so no political layer and no slots. */
  source: WorldBundleSource;
  layers: Record<Exclude<WorldBundleLayerName, "political">, FeatureCollection> & {
    political?: FeatureCollection;
  };
  slots: WorldBundleSlot[];
  /** The generator's packed cells (lng, lat, height in metres per cell) as base64 little-endian Float32. */
  cells: string;
}

export type WorldBundleParse = { ok: true; bundle: WorldBundle } | { ok: false; reason: string };

const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

// Parameters

const latitude = z.number().min(-90).max(90);
const countryCount = z.number().int().min(1).max(500);

/** Bounded generator params: an unbounded cellCount or plateCount would pin whoever runs them. */
export const worldGenParamsSchema: z.ZodType<WorldGenParams> = z.object({
  seed: z.number().int(),
  cellCount: z.number().int().min(1000).max(150000),
  plateCount: z.number().int().min(3).max(30),
  continentCount: z.number().int().min(1).max(12),
  continentLatitudeRange: z.tuple([latitude, latitude]),
  continentSizeVariance: z.number().min(0).max(2),
  islandShare: z.number().min(0).max(0.5),
  polarLand: z.object({ north: z.boolean(), south: z.boolean() }),
  countryCountRange: z.tuple([countryCount, countryCount]),
  oceanPercentage: z.number().min(0.2).max(0.95),
  terrainRoughness: z.number().min(0).max(1),
  coastlineComplexity: z.number().min(0).max(1),
  hypsometry: z.array(z.number().min(0)).length(9),
  temperatureOffset: z.number().min(-20).max(20),
  precipitationScale: z.number().min(0.1).max(5),
  riverDensity: z.number().min(0).max(5),
  lakeCoverage: z.number().min(0).max(0.1),
  hasIcecaps: z.boolean(),
  hasRivers: z.boolean(),
  hasLakes: z.boolean(),
  useMarkovNaming: z.boolean(),
  lloydIterations: z.number().int().min(0).max(5),
  developmentLevel: z.enum(["developing", "industrial", "modern"]),
});

// Cells

/** Base64 length of the most cells a bundle may hold: 12 bytes (three float32) per cell. */
const MAX_CELLS_BASE64_LENGTH = (MAX_WORLD_BUNDLE_CELLS * 12 * 4) / 3;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const CHUNK = 0x2000;

/** The generator's packed cells as base64 little-endian Float32 (the bundle's `cells`). */
export function encodeCells(cells: Float32Array): string {
  const bytes = new Uint8Array(cells.length * 4);
  const view = new DataView(bytes.buffer);
  cells.forEach((value, i) => view.setFloat32(i * 4, value, true));
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export type CellsDecode = { ok: true; cells: Float32Array } | { ok: false; reason: string };

/** The bundle's `cells` back to the packed Float32Array, or why it is not a valid one. */
export function decodeCells(base64: string): CellsDecode {
  if (base64.length > MAX_CELLS_BASE64_LENGTH)
    return fail(`The bundle has more than ${MAX_WORLD_BUNDLE_CELLS.toLocaleString("en-US")} cells`);
  if (base64.length % 4 !== 0 || !BASE64.test(base64)) return fail("cells is not valid base64");
  const binary = atob(base64);
  if (binary.length % 12 !== 0)
    return fail("cells is not a whole number of (lng, lat, height) triples");
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) view.setUint8(i, binary.charCodeAt(i));
  const cells = new Float32Array(binary.length / 4);
  for (let i = 0; i < cells.length; i++) {
    const value = view.getFloat32(i * 4, true);
    if (!Number.isFinite(value)) return fail("cells hold a value that is not finite");
    cells[i] = value;
  }
  return { ok: true, cells };
}

// Envelope

const slotSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb hex"),
  claimable: z.boolean(),
  population: z.number().min(0).max(1e11),
  gdpPerCapita: z.number().min(0).max(1e7),
  areaKm2: z.number().min(0).max(1e9),
});

const layerSchema = z.custom<FeatureCollection>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features),
  "Not a GeoJSON FeatureCollection"
);

const envelopeSchema = z.object({
  version: z.literal(WORLD_BUNDLE_VERSION, "Unsupported world bundle version"),
  seed: z.number().int(),
  params: worldGenParamsSchema,
  source: z.enum(["preset", "realm-map"]),
  layers: z.record(z.string(), layerSchema),
  slots: z
    .array(slotSchema)
    .max(MAX_WORLD_BUNDLE_SLOTS, `The bundle has more than ${MAX_WORLD_BUNDLE_SLOTS} nation slots`),
  cells: z.string(),
});

// Features

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Whether a number anywhere in the value (properties are shallow; the depth bound is for hostile nesting) is not finite. */
function holdsNonFinite(value: JsonValue, depth = 0): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  if (value === null || typeof value !== "object" || depth > 4) return false;
  const items: JsonValue[] = Array.isArray(value) ? value : Object.values(value);
  return items.some((item) => holdsNonFinite(item, depth + 1));
}

const finitePosition = (position: Position) =>
  Array.isArray(position) && position.length >= 2 && position.every((n) => Number.isFinite(n));

function lineProblem(line: Position[]): string | null {
  if (!Array.isArray(line) || line.length < 2) return "a line has fewer than 2 points";
  return line.every(finitePosition) ? null : "a coordinate is not a finite number pair";
}

function ringProblem(ring: Position[]): string | null {
  if (!Array.isArray(ring) || ring.length < 4) return "a ring has fewer than 4 points";
  if (!ring.every(finitePosition)) return "a coordinate is not a finite number pair";
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? null : "a ring is not closed";
}

function firstProblem<T>(items: T[], problem: (item: T) => string | null): string | null {
  for (const item of items) {
    const found = problem(item);
    if (found) return found;
  }
  return null;
}

function polygonProblem(rings: Position[][]): string | null {
  if (!Array.isArray(rings) || rings.length === 0) return "a polygon has no rings";
  return firstProblem(rings, ringProblem);
}

function geometryProblem(layer: WorldBundleLayerName, feature: Feature): string | null {
  const geometry = feature.geometry;
  if (!geometry || typeof geometry !== "object") return "has no geometry";
  const lineAllowed = layer === "rivers";
  switch (geometry.type) {
    case "Polygon":
      return polygonProblem(geometry.coordinates);
    case "MultiPolygon":
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0)
        return "a MultiPolygon has no polygons";
      return firstProblem(geometry.coordinates, polygonProblem);
    case "LineString":
      return lineAllowed ? lineProblem(geometry.coordinates) : "needs a polygon geometry";
    case "MultiLineString":
      if (!lineAllowed) return "needs a polygon geometry";
      return Array.isArray(geometry.coordinates)
        ? firstProblem(geometry.coordinates, lineProblem)
        : "a line has fewer than 2 points";
    default:
      return "has an unsupported geometry type";
  }
}

function featureProblem(
  layer: WorldBundleLayerName,
  feature: Feature,
  slotKeys: ReadonlySet<string>
): string | null {
  if (!feature || typeof feature !== "object" || feature.type !== "Feature")
    return "is not a GeoJSON Feature";
  if (typeof feature.id === "number" && !Number.isFinite(feature.id))
    return "has an id that is not finite";
  const properties = feature.properties;
  if (properties !== null && (typeof properties !== "object" || Array.isArray(properties)))
    return "has properties that are not an object";
  if (properties && holdsNonFinite(properties)) return "has a property number that is not finite";
  const geometry = geometryProblem(layer, feature);
  if (geometry) return geometry;
  if (layer !== "political") return null;
  const key = properties?.slotKey;
  if (typeof key !== "string") return "has no slotKey";
  return slotKeys.has(key) ? null : `names slotKey ${key}, which is not one of the bundle's slots`;
}

/** The first problem in the layers (named by layer and feature index), or null when every feature is sound. */
function layersProblem(
  layers: Record<string, FeatureCollection>,
  slotKeys: ReadonlySet<string>
): string | null {
  for (const layer of WORLD_BUNDLE_LAYERS) {
    const features = layers[layer]?.features ?? [];
    for (let i = 0; i < features.length; i++) {
      const problem = featureProblem(layer, features[i]!, slotKeys);
      if (problem) return `${layer} feature ${i}: ${problem}`;
    }
  }
  return null;
}

/** Whether the layer set names only known layers and has every layer a bundle must carry. */
function layerSetProblem(layers: Record<string, FeatureCollection>): string | null {
  const stray = Object.keys(layers).find(
    (name) => !(WORLD_BUNDLE_LAYERS as readonly string[]).includes(name)
  );
  if (stray) return `Unknown layer ${stray}`;
  const missing = WORLD_BUNDLE_LAYERS.find((name) => name !== "political" && !layers[name]);
  return missing ? `Missing layer ${missing}` : null;
}

function sourceProblem(
  source: WorldBundleSource,
  layers: Record<string, FeatureCollection>,
  slots: WorldBundleSlot[]
): string | null {
  if (source !== "realm-map") return null;
  if (layers.political)
    return "A realm map bundle keeps the realm's borders: it has no political layer";
  return slots.length > 0
    ? "A realm map bundle keeps the realm's borders: it has no nation slots"
    : null;
}

function duplicateSlotKey(slots: WorldBundleSlot[]): string | null {
  const seen = new Set<string>();
  for (const { key } of slots) {
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}

function zodReason(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "That is not a world bundle";
  return issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
}

/** Validate the bundle JSON text; a bundle that parses is safe for the `world` import job. */
export function parseWorldBundleJson(text: string): WorldBundleParse {
  let raw: JsonValue;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("The bundle is not valid JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    return fail("That is not a world bundle: the JSON is not an object");
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) return fail(zodReason(envelope.error));
  const { layers, slots, source, cells } = envelope.data;

  const decoded = decodeCells(cells);
  if (!decoded.ok) return fail(decoded.reason);
  const twice = duplicateSlotKey(slots);
  const problem =
    (twice && `Slot ${twice} appears twice`) ||
    layerSetProblem(layers) ||
    sourceProblem(source, layers, slots) ||
    layersProblem(layers, new Set(slots.map((s) => s.key)));
  if (problem) return fail(problem);

  const { background, altitudes, climate, rivers, lakes, icecaps, political } = layers;
  return {
    ok: true,
    bundle: {
      version: WORLD_BUNDLE_VERSION,
      seed: envelope.data.seed,
      params: envelope.data.params,
      source,
      layers: {
        background: background!,
        altitudes: altitudes!,
        climate: climate!,
        rivers: rivers!,
        lakes: lakes!,
        icecaps: icecaps!,
        ...(political && { political }),
      },
      slots,
      cells,
    },
  };
}

// Gzip (web platform streams: a browser or a Web Worker)

/** Whether the bytes begin with a gzip header (magic bytes and the deflate method). */
export const isGzip = (bytes: Uint8Array) =>
  bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    chunks.push(read.value);
    length += read.value.length;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** The bundle as the upload sends it: its JSON, gzipped with the platform's CompressionStream. */
export async function encodeWorldBundle(bundle: WorldBundle): Promise<Uint8Array> {
  const compression = new CompressionStream("gzip");
  const compressed = collect(compression.readable);
  const writer = compression.writable.getWriter();
  await writer.write(new TextEncoder().encode(JSON.stringify(bundle)));
  await writer.close();
  return compressed;
}
