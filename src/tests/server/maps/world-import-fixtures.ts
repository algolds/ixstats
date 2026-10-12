/** A small world bundle, its stored upload and a realm to apply it to, for the `world` import tests. */
import { gzipSync } from "node:zlib";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";
import {
  encodeCells,
  type WorldBundle,
  type WorldBundleSlot,
} from "~/lib/maps/import/world-bundle";
import { saveMapUpload } from "~/server/modules/maps/map-import.storage";
import type { ReliefRunner } from "~/server/modules/maps/world-import";
import type { buildRealmRelief } from "~/server/modules/maps/realm-relief";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import type { WorldGenParams } from "~/lib/worldgen/v2/types";
import { fakeDb } from "./map-import-fakes";

/** A 2-degree square (about 49,000 km² at the equator) whose west edge is at `x`. */
export const square = (x: number, y = 0, size = 2): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ],
});

export const slot = (n: number, over: Partial<WorldBundleSlot> = {}): WorldBundleSlot => ({
  key: `slot_${n}`,
  name: `Nation ${n}`,
  colour: "#aa3322",
  claimable: true,
  population: 1_000_000,
  gdpPerCapita: 20_000,
  areaKm2: 49_000,
  ...over,
});

const collection = (features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

export const feature = (
  geometry: Geometry,
  properties: Feature["properties"] = {},
  id?: string | number
): Feature => ({ type: "Feature", properties, geometry, ...(id !== undefined && { id }) });

export const CELLS = [10, 20, 300, -10, -20, -5];

export interface BundleOptions {
  slots?: WorldBundleSlot[];
  source?: "preset" | "realm-map";
  params?: Partial<WorldGenParams>;
  seed?: number;
  /** Replace a layer's features. */
  layers?: Partial<
    Record<"background" | "altitudes" | "climate" | "rivers" | "lakes" | "icecaps", Feature[]>
  >;
  /** Replace the political features (default: one square per slot, in a row). */
  political?: Feature[];
}

/** A valid bundle: one 2-degree square per slot, a few physical features, three cells. */
export function makeBundle(options: BundleOptions = {}): WorldBundle {
  const source = options.source ?? "preset";
  const slots = source === "realm-map" ? [] : (options.slots ?? [slot(1), slot(2), slot(3)]);
  const layers = options.layers ?? {};
  const political =
    options.political ??
    slots.map((s, i) => feature(square(i * 4), { slotKey: s.key, name: s.name }, i + 1));
  return {
    version: 1,
    seed: options.seed ?? 42,
    params: { ...DEFAULT_PARAMS, ...options.params },
    source,
    layers: {
      background: collection(layers.background ?? [feature(square(0, 0, 20), {}, 1)]),
      altitudes: collection(layers.altitudes ?? [feature(square(0, 0, 10), { zone: "zone_1" }, 1)]),
      climate: collection(layers.climate ?? [feature(square(0, 0, 10), { code: "Aw" }, 1)]),
      rivers: collection(
        layers.rivers ?? [
          feature(
            {
              type: "LineString",
              coordinates: [
                [1, 1],
                [3, 3],
              ],
            },
            {},
            1
          ),
        ]
      ),
      lakes: collection(layers.lakes ?? []),
      icecaps: collection(layers.icecaps ?? []),
      ...(source === "preset" && { political: collection(political) }),
    },
    slots,
    cells: encodeCells(new Float32Array(CELLS)),
  };
}

/** The bundle as the upload route stores it (gzip JSON); returns its upload id. Needs MAP_IMPORT_DIR set. */
export const storeBundle = (bundle: WorldBundle) => saveMapUpload(gzipSync(JSON.stringify(bundle)));

/** The check `jobFor` is the apply of: `seedRealm` has it finished, against the map version the realm has. */
export const CHECK_ID = "j_world_check";

export const jobFor = (
  uploadId: string,
  over: Partial<{ requestedBy: string; realmId: string; parentJobId: string | null }> = {}
) => ({
  id: "j_world",
  realmId: "r1",
  uploadId,
  requestedBy: "founder_1",
  parentJobId: CHECK_ID as string | null,
  ...over,
});

const row = (layerType: string, featureId: string, extra: Record<string, unknown> = {}) => ({
  id: `m_${layerType}_${featureId}`,
  realmId: "r1",
  layerType,
  featureId,
  geometry: square(100),
  properties: {},
  isActive: true,
  countryId: null,
  displayName: null,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...extra,
});

/** A country the way a claim or a previous generation left it (only the columns the import reads or restores). */
const countryRow = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  slug: id.replace("c_", "slug-"),
  realmId: "r1",
  worldgen: false,
  claimable: true,
  ownerUserId: null,
  landArea: 1000,
  baselinePopulation: 500_000,
  baselineGdpPerCapita: 9_000,
  geometry: null,
  centroid: null,
  boundingBox: null,
  ...extra,
});

/**
 * A realm with a founder, an admin, and what a previous generation and its players left:
 *   c_old1    a generated slot nobody holds: retired by a regeneration
 *   c_old2    a generated slot whose claim was withdrawn: its claim row stays, so it stays
 *   c_owned   a generated slot a player owns
 *   c_manual  a country the realm made by hand, named like a bundle slot would be
 */
export function seedRealm(over: Record<string, unknown> = {}) {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    ownerId: "founder_1",
    status: "active",
    settings: {},
    mapVersion: 0,
    seed: null,
    generationParams: null,
    ...over,
  });
  db.mapImportJob.rows.push({
    id: CHECK_ID,
    realmId: "r1",
    kind: "world",
    dryRun: true,
    status: "succeeded",
    result: { phase: "world-dry-run", mapVersion: db.realm.rows[0].mapVersion },
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  db.user.rows.push(
    { id: "u_founder", clerkUserId: "founder_1", role: { name: "user", level: 100 } },
    { id: "u_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    { id: "u_other", clerkUserId: "someone", role: { name: "user", level: 100 } }
  );
  db.country.rows.push(
    countryRow("c_old1", "Old One", { worldgen: true, slug: "old-one" }),
    countryRow("c_old2", "Old Two", { worldgen: true }),
    countryRow("c_owned", "Old Owned", { worldgen: true, ownerUserId: "u_player" }),
    countryRow("c_manual", "Nation 2", { worldgen: false })
  );
  db.realmClaim.rows.push({
    id: "q_withdrawn",
    realmId: "r1",
    countryId: "c_old2",
    status: "withdrawn",
  });
  db.mapLayer.rows.push(
    row("political", "slot_old", { countryId: "c_old1", displayName: "Old One" }),
    row("political", "old_owned", { countryId: "c_owned", displayName: "Old Owned" }),
    row("political", "manual-key", { countryId: "c_manual", displayName: "Nation 2" }),
    row("rivers", "r_old"),
    row("lakes", "l_old")
  );
  return db;
}

/** Every table a world import may write, as plain data, to show nothing changed. */
export const stateOf = (db: ReturnType<typeof fakeDb>) =>
  JSON.stringify({
    realm: db.realm.rows,
    country: db.country.rows,
    mapLayer: db.mapLayer.rows,
    mapImport: db.mapImport.rows,
    realmClaim: db.realmClaim.rows,
    sharedVertex: db.sharedVertex.rows,
  });

/** What a relief build answers (the type `buildRealmRelief` returns). */
export const RELIEF_ENTRY: Awaited<ReturnType<typeof buildRealmRelief>> = {
  id: "relief",
  label: "Relief",
  kind: "overlay",
  version: "abc12345",
  maxZoom: 5,
  built: true,
  tiles: 12,
  skipped: 3,
};

/** A relief runner that builds nothing and answers with `RELIEF_ENTRY`. */
export const relief = () =>
  jest.fn<ReturnType<ReliefRunner>, Parameters<ReliefRunner>>(async () => RELIEF_ENTRY);

/** The bundle as stored by the upload route; returns its upload id. */
export const stored = (options: BundleOptions = {}) => storeBundle(makeBundle(options));

export const country = (db: ReturnType<typeof fakeDb>, id: string) =>
  db.country.rows.find((c: { id: string }) => c.id === id);

export const layer = (db: ReturnType<typeof fakeDb>, type: string, key: string) =>
  db.mapLayer.rows.find(
    (r: { layerType: string; featureId: string }) => r.layerType === type && r.featureId === key
  );
