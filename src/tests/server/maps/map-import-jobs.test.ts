/** @jest-environment node */
/**
 * Map import jobs and what they write: one job per realm at a time, an engine failure and a cancel recorded on the
 * job, a job that stopped reporting failed, an oversize file refused; "Import this map" from the realm's wiki only for
 * its map staff and refused when the wiki's file changed since it was chosen; the shared writer's refusals and
 * replace-mode retirements, areas measured on the realm's own planet, a failed map version bump that does not fail
 * the recorded import, and only the realm's latest import still in place can be rolled back. The whole plan, apply
 * and rollback through the router is the atlas-png-map-import scenario.
 *
 * Folds: src/tests/server/maps/map-import-apply.test.ts, src/tests/server/maps/map-import-wiki.test.ts,
 * src/tests/server/api/routers/geo/map-import-router.test.ts
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, name: string, fn: () => Promise<unknown>) => {
    const held = (globalThis as { heldLeases?: Set<string> }).heldLeases ?? new Set<string>();
    if (held.has(name)) return { ran: false };
    held.add(name);
    try {
      return { ran: true, result: await fn() };
    } finally {
      held.delete(name);
    }
  }),
}));
const fetchOriginal = jest.fn();
jest.mock("~/server/modules/realms/realms.wiki", () => {
  class RealmWikiError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
  return {
    RealmWikiError,
    fetchChosenWikiMapOriginal: (...args: unknown[]) => fetchOriginal(...args),
  };
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Polygon } from "geojson";
import {
  cancelMapImportJob,
  mapImportLockName,
  processMapImportQueue,
  recoverStaleMapImports,
  runMapImportJob,
  startMapImport,
  STALE_AFTER_MS,
} from "~/server/modules/maps/map-import.jobs";
import {
  applyMapImportPlan,
  planMapImport,
  refreshRealmMap,
} from "~/server/modules/maps/map-import.apply";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { writePipelineLayers } from "~/server/modules/maps/map-import.pipeline";
import { findImportRealm, MapImportError } from "~/server/modules/maps/map-import.realm";
import { startWikiMapImport } from "~/server/modules/maps/map-import.wiki";
import { RealmWikiError } from "~/server/modules/realms/realms.wiki";
import { polygonalAreaSqKm } from "~/lib/maps/planet";
import {
  MAX_MAP_IMPORT_BYTES,
  mapImportApplySchema,
  type EngineResult,
} from "~/lib/maps/import/options";
import { admin, fakeDb, stranger } from "./map-import-fakes";

const held = new Set<string>();
(globalThis as { heldLeases?: Set<string> }).heldLeases = held;

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "map-import-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

const square = (x: number, size = 10): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, 0],
      [x + size, 0],
      [x + size, size],
      [x, size],
      [x, 0],
    ],
  ],
});

/** A lon/lat engine result: two regions, as the GeoJSON engine would give. */
const result: EngineResult = {
  kind: "geojson",
  space: "lonlat",
  width: 360,
  height: 180,
  regions: [
    { key: "Aurelia", name: "Aurelia", parts: 1 },
    { key: "Borealis", name: "Borealis", parts: 1 },
  ],
  features: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { key: "Aurelia" }, geometry: square(0) },
      { type: "Feature", properties: { key: "Borealis" }, geometry: square(10) },
    ],
  },
  report: { log: [], warnings: [], timingsMs: {} },
};

/** Eurth (half Earth's radius) with one nation and a roster page, and an engine that traces `result`. */
function setup() {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    ownerId: "founder_1",
    settings: { map: { radiusKm: 3185.5 } },
  });
  db.country.rows.push({ id: "c_aur", name: "Aurelia", realmId: "r1", landArea: null });
  db.realmPage.rows.push({ realmId: "r1", kind: "nation", title: "Borealis" });
  const runEngine = jest.fn(
    async (
      _kind: string,
      _bytes: Uint8Array,
      _options: unknown,
      progress: (p: number, s: string) => void
    ) => {
      progress(50, "Tracing borders");
      return result;
    }
  );
  return { db, runEngine };
}

const bytes = new TextEncoder().encode('{"type":"FeatureCollection","features":[]}');
const queue = (db: ReturnType<typeof fakeDb>, filename = "a.geojson") =>
  startMapImport(
    { realmId: "r1", source: { kind: "geojson", bytes, filename }, requestedBy: "admin_1" },
    { db, kick: false }
  );

describe("map import jobs: lifecycle", () => {
  it("runs one job per realm at a time: a job whose realm lease is held stays queued", async () => {
    const { db, runEngine } = setup();
    const jobId = await queue(db);
    held.add(mapImportLockName("r1"));
    try {
      expect(await runMapImportJob(db, jobId, { runEngine })).toBe("busy");
      expect(await processMapImportQueue(db, {}, { runEngine })).toMatchObject({ ran: 0, busy: 1 });
      expect(db.mapImportJob.rows[0].status).toBe("queued");
    } finally {
      held.delete(mapImportLockName("r1"));
    }
    expect(await processMapImportQueue(db, {}, { runEngine })).toMatchObject({ ran: 1, busy: 0 });
    expect(db.mapImportJob.rows[0].status).toBe("succeeded");
  });

  it("records an engine failure on the job", async () => {
    const { db } = setup();
    const jobId = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "png", bytes, filename: "bad.png" },
        requestedBy: "admin_1",
      },
      { db, kick: false }
    );
    const runEngine = jest.fn().mockRejectedValue(new Error("The map image could not be read"));
    await runMapImportJob(db, jobId, { runEngine });
    expect(db.mapImportJob.rows[0]).toMatchObject({
      status: "failed",
      error: "The map image could not be read",
    });
  });

  it("cancels a queued job, and a running job stops at its next progress report", async () => {
    const { db } = setup();
    const queued = await queue(db);
    await cancelMapImportJob(db as never, admin, queued);
    expect(db.mapImportJob.rows[0].status).toBe("cancelled");
    await expect(cancelMapImportJob(db as never, admin, queued)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const running = await queue(db, "b.geojson");
    const runEngine = jest.fn(
      async (
        _k: string,
        _b: Uint8Array,
        _o: unknown,
        progress: (p: number, s: string) => void,
        isCancelled: () => boolean
      ) => {
        await cancelMapImportJob(db as never, admin, running);
        progress(40, "Tracing borders");
        await new Promise((resolve) => setTimeout(resolve, 10));
        progress(60, "Simplifying borders");
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(isCancelled()).toBe(true); // the engine stops at its next slice; this one returns
        return result;
      }
    );
    await runMapImportJob(db, running, { runEngine });
    expect(db.mapImportJob.rows[1].status).toBe("cancelled");
  });

  it("marks a running job that stopped reporting as failed", async () => {
    const { db } = setup();
    db.mapImportJob.rows.push({
      id: "jstale0001",
      realmId: "r1",
      status: "running",
      heartbeatAt: new Date(Date.now() - STALE_AFTER_MS - 1000),
      createdAt: new Date(),
    });
    expect(await recoverStaleMapImports(db)).toBe(1);
    expect(db.mapImportJob.rows[0].status).toBe("failed");
  });

  it("refuses an oversize file and a missing upload", async () => {
    const { db } = setup();
    await expect(
      startMapImport(
        {
          realmId: "r1",
          source: {
            kind: "png",
            bytes: new Uint8Array(MAX_MAP_IMPORT_BYTES + 1),
            filename: "big.png",
          },
          requestedBy: "admin_1",
        },
        { db, kick: false }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      startMapImport(
        {
          realmId: "r1",
          source: { kind: "png", uploadId: "0".repeat(64), filename: "x.png" },
          requestedBy: "admin_1",
        },
        { db, kick: false }
      )
    ).rejects.toBeInstanceOf(MapImportError);
  });
});

describe("Import this map (from the realm's wiki)", () => {
  function wikiRealm() {
    const db = fakeDb();
    db.realm.rows.push({
      id: "r1",
      slug: "eurth",
      name: "Eurth",
      ownerId: "founder_1",
      settings: {
        map: {
          source: "iiwiki",
          attribution: "Map by A. Cartographer (CC BY-SA)",
          bounds: { west: -180, south: -60, east: 180, north: 80 },
        },
      },
    });
    return db;
  }
  beforeEach(() => fetchOriginal.mockReset());

  it("is only for the realm's map staff: the wiki is not asked for a stranger", async () => {
    const db = wikiRealm();
    await expect(startWikiMapImport(db, stranger, "r1", { kick: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fetchOriginal).not.toHaveBeenCalled();
  });

  it("passes on the wiki's refusal when the file changed since it was chosen, and queues nothing", async () => {
    const db = wikiRealm();
    fetchOriginal.mockRejectedValue(
      new (RealmWikiError as never as new (c: string, m: string) => Error)(
        "CONFLICT",
        "The wiki's file changed"
      )
    );
    await expect(startWikiMapImport(db, admin, "r1", { kick: false })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.mapImportJob.rows).toHaveLength(0);
  });
});

describe("what an import writes", () => {
  /** A realm with Borealis's border, a stale Old Kingdom and a lake on another layer (`radiusKm` its planet). */
  function mappedRealm(radiusKm?: number) {
    const db = fakeDb();
    db.realm.rows.push({
      id: "r1",
      slug: "eurth",
      name: "Eurth",
      ownerId: "founder_1",
      settings: radiusKm ? { map: { radiusKm } } : {},
    });
    db.country.rows.push(
      { id: "c_aur", name: "Aurelia", realmId: "r1", landArea: null, geometry: null },
      { id: "c_bor", name: "Borealis", realmId: "r1", landArea: 51_000, geometry: null }
    );
    const row = (id: string, layerType: string, featureId: string, geometry: Polygon) => ({
      id,
      realmId: "r1",
      layerType,
      featureId,
      displayName: featureId,
      countryId: null,
      geometry,
      properties: {},
      isActive: true,
    });
    db.mapLayer.rows.push(
      { ...row("m1", "political", "borealis-key", square(10)), countryId: "c_bor" },
      row("m2", "political", "Old Kingdom", square(90)),
      row("m3", "lakes", "lake-1", square(100, 1)),
      row("m4", "lakes", "lake-old", square(110, 1))
    );
    return db;
  }
  const feature = (
    id: string,
    geometry: Polygon | { type: "LineString"; coordinates: number[][] }
  ) => ({
    type: "Feature" as const,
    id,
    properties: id === "lake-2" ? { name: "Blue Lake" } : {},
    geometry,
  });
  const line = (toLon: number) => ({
    type: "LineString" as const,
    coordinates: [
      [0, 0],
      [toLon, 1],
    ],
  });

  it("replace mode retires the stale features of the imported layer types only, keeps one whose incoming row was refused, and refuses bad geometry", async () => {
    const db = mappedRealm();
    const out = await writePipelineLayers(db as never, {
      realmId: "r1",
      mode: "replace",
      createdBy: "admin_1",
      layers: {
        lakes: {
          type: "FeatureCollection",
          features: [feature("lake-2", square(120, 1)), feature("lake-1", square(500, 1))],
        },
        rivers: {
          type: "FeatureCollection",
          features: [feature("r-1", line(1)), feature("r-2", line(500))],
        },
      },
    });
    expect(out).toMatchObject({ imported: 2, deactivated: 1, mode: "replace" });
    expect(out.rejected.map((r) => `${r.layerType}:${r.key}`).sort()).toEqual([
      "lakes:lake-1",
      "rivers:r-2",
    ]);
    expect(out.rejected.find((r) => r.key === "r-2")?.reason).toMatch(/lon\/lat/);
    const row = (key: string) =>
      db.mapLayer.rows.find((r: { featureId: string }) => r.featureId === key);
    expect(row("lake-2")).toMatchObject({ displayName: "Blue Lake", isActive: true });
    expect(row("r-1")).toMatchObject({ isActive: true });
    expect(row("lake-old").isActive).toBe(false);
    // the lake whose new border was refused keeps its old one, and the borders are another layer
    expect(row("lake-1")).toMatchObject({ isActive: true, geometry: square(100, 1) });
    expect(row("Old Kingdom").isActive).toBe(true);
    expect(db.mapImport.rows[0]).toMatchObject({ mode: "replace", rollbackAvailable: true });
    expect([...db.mapImport.rows[0].layerTypes].sort()).toEqual(["lakes", "rivers"]);
  });

  it("measures areas on the realm's own planet", async () => {
    const apply = mapImportApplySchema.parse({
      mapping: { Aurelia: "Aurelia", Borealis: "Borealis" },
      mode: "merge",
    });
    const area = async (db: ReturnType<typeof mappedRealm>) =>
      (await planMapImport(db as never, await findImportRealm(db, "r1"), result, apply, {})).diff
        .features[0]!.areaKm2!;
    const onEarth = await area(mappedRealm());
    expect(onEarth).toBeCloseTo(polygonalAreaSqKm(square(0)), 3);
    // half Earth's radius: a quarter of the area
    expect((await area(mappedRealm(6371 / 2))) / onEarth).toBeCloseTo(0.25, 6);
  });

  it("rolls back only the realm's latest import still in place: an older one is refused, writing nothing, until the newer is rolled back", async () => {
    const db = mappedRealm();
    const realm = await findImportRealm(db, "r1");
    const apply = mapImportApplySchema.parse({
      mapping: { Aurelia: "Aurelia", Borealis: "Borealis" },
      mode: "replace",
    });
    const map = () =>
      JSON.stringify(
        db.mapLayer.rows
          .map(
            (r: {
              layerType: string;
              featureId: string;
              isActive: boolean;
              countryId: string | null;
            }) => [r.layerType, r.featureId, r.isActive, r.countryId].join(":")
          )
          .sort()
      );
    const original = map();
    const importOnce = async (jobId: string) =>
      applyMapImportPlan(
        db as never,
        realm,
        await planMapImport(db as never, realm, result, apply, {}),
        { jobId, requestedBy: "admin_1" }
      );
    const first = await importOnce("j1");
    const afterFirst = map();
    expect(afterFirst).not.toBe(original); // Aurelia's border added, Old Kingdom's retired
    const second = await importOnce("j2");
    const state = () => JSON.stringify([db.mapLayer.rows, db.country.rows, db.mapImport.rows]);
    const before = state();

    await expect(rollbackMapImport(db as never, admin, first.mapImportId)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Roll back the newer import"),
    });
    expect(state()).toBe(before);

    // newest first: each rollback puts back the map as the import before it found it
    await rollbackMapImport(db as never, admin, second.mapImportId);
    expect(map()).toBe(afterFirst);
    await rollbackMapImport(db as never, admin, first.mapImportId);
    expect(map()).toBe(original);
  });

  it("moves the realm's map version, and a failed bump is logged instead of failing the recorded import", async () => {
    const db = mappedRealm();
    await expect(refreshRealmMap(db as never, "r1", { adjacency: false })).resolves.toBeNull();
    expect(db.realm.rows[0].mapVersion).toBe(1);

    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    db.$queryRaw.mockRejectedValueOnce(new Error("db down"));
    await expect(refreshRealmMap(db as never, "r1", { adjacency: false })).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("version bump"), expect.any(Error));
    error.mockRestore();
  });
});
