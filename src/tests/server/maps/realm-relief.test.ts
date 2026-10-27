/**
 * @jest-environment node
 *
 * A realm's relief layer: the shading built from generator cells or from the stored altitude bands, handed to the
 * raster builder with the relief options, recorded in the realm's raster layers, versioned by what is drawn (an
 * unchanged world is never built again), and the map told it changed. The tile writer is replaced here (a full
 * pyramid takes seconds under Jest); realm-relief-tiles.test.ts builds a real one.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/modules/maps/realm-rasters.build", () => ({
  ...jest.requireActual("~/server/modules/maps/realm-rasters.build"),
  buildRealmRaster: jest.fn(),
}));

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { Position } from "geojson";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import {
  buildRealmRaster,
  planRealmRaster,
  type RasterBuildInput,
} from "~/server/modules/maps/realm-rasters.build";
import {
  applyRealmRelief,
  buildRealmRelief,
  planRealmRelief,
} from "~/server/modules/maps/realm-relief";
import { fakeDb } from "./map-import-fakes";

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "realm-relief-"));
  process.env.MAP_RASTER_DIR = root;
  // The real planner (version, folder), and a build that only makes the folder
  jest.mocked(buildRealmRaster).mockImplementation(async (input: RasterBuildInput) => {
    const plan = await planRealmRaster(input);
    mkdirSync(plan.dir, { recursive: true });
    return { ...plan, legend: false, built: !plan.built, tiles: 292, skipped: 733 };
  });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_RASTER_DIR;
  jest.clearAllMocks();
});

/** One realm, optionally with settings it had before. */
function setup(settings: object | null = {}) {
  const db = fakeDb();
  db.realm.rows.push({ id: "r1", slug: "r1", name: "R1", mapVersion: 5, settings });
  return db;
}

/**
 * Cells on a 3° grid over 60°W–60°E and 30°S–30°N: a ridge of 3,000 m along 0°E falling to 50 m at the edges, so
 * both its flanks shade. `shift` moves the ridge east.
 */
function ridgeCells(shift = 0): Float32Array {
  const cells: number[] = [];
  for (let lng = -60; lng <= 60; lng += 3) {
    for (let lat = -30; lat <= 30; lat += 3) {
      const ridge = Math.exp(-(((lng - shift) / 18) ** 2) - (lat / 24) ** 2);
      cells.push(lng, lat, 50 + 2950 * ridge);
    }
  }
  return new Float32Array(cells);
}

const layersOf = (db: { realm: { rows: Array<{ settings: object }> } }) =>
  parseRealmMapSettings(db.realm.rows[0]!.settings).rasterLayers ?? [];

const versionsOf = () => readdirSync(path.join(root, "r1", "relief")).sort();

describe("buildRealmRelief from cells", () => {
  it("does not build again for the same cells", async () => {
    const db = setup();
    const first = await buildRealmRelief(db, "r1", { cells: ridgeCells() });
    const updates = db.realm.update.mock.calls.length;
    const mapVersion = db.realm.rows[0].mapVersion;

    const again = await buildRealmRelief(db, "r1", { cells: ridgeCells() });
    expect(again).toMatchObject({ version: first.version, built: false, tiles: 0, skipped: 0 });
    expect(buildRealmRaster).toHaveBeenCalledTimes(1);
    expect(db.realm.update.mock.calls.length).toBe(updates);
    expect(db.realm.rows[0].mapVersion).toBe(mapVersion);
  });

  it("keeps the new version and the one before it, and the realm's other raster layers", async () => {
    const geography = {
      id: "geography",
      label: "Geography",
      kind: "base",
      version: "a".repeat(16),
      maxZoom: 3,
    };
    const db = setup({ map: { rasterLayers: [geography] } });
    const a = await buildRealmRelief(db, "r1", { cells: ridgeCells(0) });
    const b = await buildRealmRelief(db, "r1", { cells: ridgeCells(6) });
    const c = await buildRealmRelief(db, "r1", { cells: ridgeCells(12) });
    expect(new Set([a.version, b.version, c.version]).size).toBe(3);
    expect(versionsOf()).toEqual([b.version, c.version].sort());
    expect(layersOf(db).map((l) => [l.id, l.version])).toEqual([
      ["geography", geography.version],
      ["relief", c.version],
    ]);
  });
  it("builds for a realm whose settings were never written (Ixnay's are null)", async () => {
    const db = setup(null);
    const entry = await buildRealmRelief(db, "r1", { cells: ridgeCells() });
    expect(db.realm.rows[0].settings).toEqual({
      map: { rasterLayers: [expect.objectContaining({ id: "relief", version: entry.version })] },
    });
  });
});

describe("planRealmRelief", () => {
  it("says what a build would do and writes nothing", async () => {
    const db = setup();
    const plan = await planRealmRelief(db, "r1", { cells: ridgeCells() });
    expect(plan).toMatchObject({ built: false, changed: true });
    expect(plan?.entry).toMatchObject({ id: "relief", maxZoom: 5 });
    expect(existsSync(path.join(root, "r1"))).toBe(false);
    expect(db.realm.update).not.toHaveBeenCalled();
    expect(buildRealmRaster).not.toHaveBeenCalled();

    const entry = await applyRealmRelief(db, "r1", plan!);
    expect(entry.version).toBe(plan!.entry.version);
    expect(await planRealmRelief(db, "r1", { cells: ridgeCells() })).toMatchObject({
      built: true,
      changed: false,
    });
  });
});

/** A square ring `half` degrees either side of the antimeridian, stored with longitudes jumping 180 to -180. */
const acrossSeam = (half: number, tall: number): Position[] => [
  [180 - half, -tall],
  [180 - half, tall],
  [-180 + half, tall],
  [-180 + half, -tall],
  [180 - half, -tall],
];

const band = (zone: number, ring: Position[]) => ({
  realmId: "r1",
  layerType: "altitudes",
  isActive: true,
  properties: { zone: `zone_${zone}` },
  geometry: { type: "Polygon", coordinates: [ring] },
});

describe("buildRealmRelief from altitude bands", () => {
  it("shades a mountain over the antimeridian on both sides of the seam, with no streak or gap", async () => {
    const db = setup();
    db.mapLayer.rows.push(
      band(1, acrossSeam(10, 10)),
      band(4, acrossSeam(5, 5)),
      band(8, acrossSeam(2, 2))
    );
    await buildRealmRelief(db, "r1", { bands: true });
    const { data } = await sharp(jest.mocked(buildRealmRaster).mock.calls[0]![0].image)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(y * 2048 + x) * 4 + 3]!;
    // The mountain reaches 10° (57 px) either side of the seam and 10° either side of the equator (row 512)
    const shaded = (x0: number, x1: number, y0: number, y1: number) => {
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (alpha(x, y) > 0) n++;
      return n;
    };
    expect(shaded(0, 60, 440, 590)).toBeGreaterThan(200);
    expect(shaded(1988, 2048, 440, 590)).toBeGreaterThan(200);
    expect(shaded(100, 1948, 0, 1024)).toBe(0); // no streak round the world
    expect(shaded(0, 2048, 0, 440) + shaded(0, 2048, 590, 1024)).toBe(0);
    // Either side of the seam is one slope: the shading does not jump across the edge of the grid
    for (let y = 480; y < 545; y += 8)
      expect(Math.abs(alpha(0, y) - alpha(2047, y))).toBeLessThan(30);
  });
});
