/** @jest-environment node */
/**
 * The admin layer choice (Studio Task 5, Review Focus 2): a site admin writes exactly the ticked physical layers
 * onto a realm's own map, Ixnay included, and never its land, borders or nations.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { applyWorld, rebuildRealmRelief, runWorldDryRun } from "~/server/modules/maps/world-import";
import { admin } from "./map-import-fakes";
import { CELLS, jobFor, layer, mapRow, relief, seedRealm, stored } from "./world-import-fixtures";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-layers-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

type Db = ReturnType<typeof seedRealm>;
const rowsOf = (db: Db, types: readonly string[]) =>
  JSON.stringify(
    db.mapLayer.rows.filter((r: { layerType: string }) => types.includes(r.layerType))
  );

/** The realm draws its own land, elevation, climate and borders, and has rivers and lakes. */
function drawnRealm(over: Record<string, unknown> = {}): Db {
  const db = seedRealm({ seed: 7, generationParams: { source: "hand" }, ...over });
  db.mapLayer.rows.push(
    mapRow("background", "land"),
    mapRow("altitudes", "zone_own"),
    mapRow("climate", "climate_own")
  );
  return db;
}

/** Ixnay: its map, countries and check belong to the default realm, and a claim is pending. */
function ixnay(): Db {
  const db = drawnRealm({ id: "default", slug: "ixnay", ownerId: "system" });
  for (const row of [...db.mapLayer.rows, ...db.country.rows, ...db.mapImportJob.rows]) {
    row.realmId = "default";
  }
  db.realmClaim.rows.push({
    id: "q_pending",
    realmId: "default",
    countryId: null,
    status: "pending",
  });
  return db;
}

const choose = (layers: PhysicalLayer[], over: Record<string, unknown> = {}) => ({
  requestedBy: "admin_1",
  options: { layers, fittedMapVersion: 0 },
  ...over,
});
// The apply job inherits only the layer choice
const chooseApply = (layers: PhysicalLayer[], over: Record<string, unknown> = {}) => ({
  requestedBy: "admin_1",
  options: { layers },
  ...over,
});
const realmMap = () => stored({ source: "realm-map" });

describe("a layer choice: the check", () => {
  it("reports the ticked layers replacing the realm's, touches no nation, and writes nothing", async () => {
    const db = drawnRealm();
    const before = JSON.stringify([db.mapLayer.rows, db.country.rows, db.realm.rows]);
    const diff = await runWorldDryRun(
      db,
      jobFor(await realmMap(), choose(["rivers", "altitudes"]))
    );
    expect(diff.chosen).toEqual(["rivers", "altitudes"]);
    expect(diff.layers.rivers).toEqual({ create: 1, change: 0, retire: 1 });
    expect(diff.layers.altitudes).toEqual({ create: 1, change: 0, retire: 1 });
    for (const left of ["background", "political", "climate", "lakes", "icecaps"] as const) {
      expect(diff.layers[left]).toEqual({ create: 0, change: 0, retire: 0 });
    }
    expect(diff.slots).toEqual({ create: 0, retire: 0, keep: 3, reserved: 0, renamed: 0 });
    expect(diff.replaces).toEqual([
      "The realm's 1 rivers features will be replaced",
      "The realm's 1 altitudes features will be replaced",
    ]);
    expect(diff.kept).toEqual(["background", "climate", "political", "lakes"]);
    expect(JSON.stringify([db.mapLayer.rows, db.country.rows, db.realm.rows])).toBe(before);
  });

  it("does not call a ticked replace 'nothing to add', where the plain realm map world does", async () => {
    const db = drawnRealm();
    for (const type of ["rivers", "icecaps"]) db.mapLayer.rows.push(mapRow(type, "x"));
    const plain = jobFor(await realmMap(), { options: { fittedMapVersion: 0 } });
    // the realm has every layer the bundle would generate and every region a nation
    for (const type of ["altitudes", "climate"]) db.mapLayer.rows.push(mapRow(type, "y"));
    await expect(runWorldDryRun(db, plain)).rejects.toMatchObject({
      message: expect.stringContaining("nothing to add"),
    });
    const diff = await runWorldDryRun(db, jobFor(await realmMap(), choose(["climate"])));
    expect(diff.chosen).toEqual(["climate"]);
  });

  it.each(["lakes", "icecaps"] as const)(
    "refuses a ticked %s layer the world has none of, rather than wipe the realm's",
    async (empty) => {
      const db = drawnRealm();
      db.mapLayer.rows.push(mapRow(empty, "own"));
      const before = rowsOf(db, [empty]);
      const upload = await realmMap();
      const message = new RegExp(`no ${empty} features`);
      await expect(
        runWorldDryRun(db, jobFor(upload, choose([empty, "rivers"])))
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(message) });
      await expect(
        applyWorld(db, jobFor(upload, chooseApply([empty])), undefined, { runRelief: relief() })
      ).rejects.toMatchObject({ message: expect.stringMatching(message) });
      expect(rowsOf(db, [empty])).toBe(before);
    }
  );

  it("is refused for a founder, for a preset world, and for an archived realm", async () => {
    const db = drawnRealm();
    await expect(
      runWorldDryRun(db, jobFor(await realmMap(), choose(["rivers"], { requestedBy: "founder_1" })))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      runWorldDryRun(db, jobFor(await stored(), choose(["rivers"])))
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("fitted") });
    const archived = drawnRealm({ status: "archived" });
    await expect(
      runWorldDryRun(archived, jobFor(await realmMap(), choose(["rivers"])))
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("archived") });
  });
});

describe("a layer choice: the apply", () => {
  it("writes only the ticked layers and leaves land, borders and nations as they were", async () => {
    const db = drawnRealm();
    const untouched = ["background", "political", "climate", "lakes"];
    const before = { rows: rowsOf(db, untouched), countries: JSON.stringify(db.country.rows) };
    const runRelief = relief();
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), chooseApply(["rivers", "altitudes"])),
      undefined,
      { runRelief }
    );
    expect(rowsOf(db, untouched)).toBe(before.rows);
    expect(JSON.stringify(db.country.rows)).toBe(before.countries);
    // replace mode: the ticked layers hold the world's features only
    expect(layer(db, "rivers", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: false });
    expect(layer(db, "altitudes", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "altitudes", "zone_own")).toMatchObject({ isActive: false });
    expect(result.slots).toEqual({ created: 0, retired: 0, opened: 0 });
    // the realm's generation record is not the world's
    expect(db.realm.rows[0]).toMatchObject({ seed: 7, generationParams: { source: "hand" } });
    expect(result.rollbackAvailable).toBe(true);
  });

  it("builds the relief from the world's cells only when altitudes is ticked", async () => {
    const runRelief = relief();
    const withRelief = await applyWorld(
      drawnRealm(),
      jobFor(await realmMap(), chooseApply(["altitudes"])),
      undefined,
      { runRelief }
    );
    expect(withRelief.relief.status).toBe("built");
    expect(runRelief).toHaveBeenCalledTimes(1);
    expect(Array.from((runRelief.mock.calls[0]![2] as { cells: Float32Array }).cells)).toEqual(
      CELLS
    );

    const skipped = relief();
    const without = await applyWorld(
      drawnRealm(),
      jobFor(await realmMap(), chooseApply(["rivers", "climate"])),
      undefined,
      { runRelief: skipped }
    );
    expect(without.relief.status).toBe("kept");
    expect(skipped).not.toHaveBeenCalled();
  });

  it("rolls back to the layers as they were, through the normal snapshot", async () => {
    const db = drawnRealm();
    const state = () =>
      db.mapLayer.rows
        .map((r: { layerType: string; featureId: string; isActive: boolean }) =>
          [r.layerType, r.featureId, r.isActive].join(":")
        )
        .sort();
    const before = state();
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), chooseApply(["rivers", "altitudes"])),
      undefined,
      { runRelief: relief() }
    );
    expect(state()).not.toEqual(before);
    const restored = await rollbackMapImport(db, admin, result.mapImportId!);
    expect(restored.slots).toBeUndefined();
    expect(state()).toEqual(before);
    expect(db.country.rows).toHaveLength(4);
  });

  it("is refused for a founder, and for a preset world, writing nothing", async () => {
    const db = drawnRealm();
    const before = JSON.stringify(db.mapLayer.rows);
    await expect(
      applyWorld(
        db,
        jobFor(await realmMap(), chooseApply(["rivers"], { requestedBy: "founder_1" })),
        undefined,
        { runRelief: relief() }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      applyWorld(db, jobFor(await stored(), chooseApply(["rivers"])), undefined, {
        runRelief: relief(),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("fitted") });
    expect(JSON.stringify(db.mapLayer.rows)).toBe(before);
  });
});

describe("rolling back a layer choice", () => {
  const reliefEntry = {
    id: "relief",
    label: "Relief",
    kind: "overlay" as const,
    version: "a".repeat(8),
    maxZoom: 5,
    order: 10,
  };
  const settingsWithRelief = { map: { rasterLayers: [reliefEntry] } };
  const reliefLayers = (db: Db) => parseRealmMapSettings(db.realm.rows[0].settings).rasterLayers;

  it("leaves the relief entry alone when the elevation was not ticked", async () => {
    // The recorded version's tiles are gone from disk, so a restore would remove the entry
    const db = drawnRealm({ settings: settingsWithRelief });
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), chooseApply(["climate"])),
      undefined,
      { runRelief: relief() }
    );
    await rollbackMapImport(db, admin, result.mapImportId!);
    expect(reliefLayers(db)).toEqual([reliefEntry]);
  });

  it("still restores the relief entry when the elevation was ticked", async () => {
    const db = drawnRealm({ settings: settingsWithRelief });
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), chooseApply(["altitudes"])),
      undefined,
      { runRelief: relief() }
    );
    await rollbackMapImport(db, admin, result.mapImportId!);
    // The tiles of the recorded version are not on disk here, so the entry goes rather than serve 404s
    expect(reliefLayers(db)).toBeUndefined();
  });
});

describe("a realm with more rows than the guarded client's findMany cap (Ixnay has 4068 bands)", () => {
  const BANDS = 1001;
  const bigRealm = () => {
    const db = drawnRealm();
    for (let i = 0; i < BANDS; i++) db.mapLayer.rows.push(mapRow("altitudes", `band_${i}`));
    return db;
  };
  const activeAltitudes = (db: Db) =>
    db.mapLayer.rows.filter(
      (r: { layerType: string; isActive: boolean }) => r.layerType === "altitudes" && r.isActive
    ).length;

  it("counts every feature the ticked layer replaces in the check", async () => {
    const diff = await runWorldDryRun(bigRealm(), jobFor(await realmMap(), choose(["altitudes"])));
    expect(diff.layers.altitudes).toEqual({ create: 1, change: 0, retire: BANDS + 1 });
    expect(diff.replaces).toEqual([`The realm's ${BANDS + 1} altitudes features will be replaced`]);
  });

  it("snapshots and restores every row of a ticked layer", async () => {
    const db = bigRealm();
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), chooseApply(["altitudes"])),
      undefined,
      { runRelief: relief() }
    );
    expect(activeAltitudes(db)).toBe(1);
    await rollbackMapImport(db, admin, result.mapImportId!);
    expect(activeAltitudes(db)).toBe(BANDS + 1);
  });
});

describe("Ixnay", () => {
  it("is refused without a layer choice, even for a site admin", async () => {
    const db = ixnay();
    const options = { requestedBy: "admin_1", realmId: "default" };
    const check = jobFor(await realmMap(), { ...options, options: { fittedMapVersion: 0 } });
    await expect(runWorldDryRun(db, check)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Ixnay"),
    });
    await expect(
      applyWorld(db, jobFor(await realmMap(), options), undefined, { runRelief: relief() })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("takes the ticked layers under a pending claim, and keeps its seed, record, nations and borders", async () => {
    const db = ixnay();
    const keep = ["background", "political", "climate", "lakes"];
    const before = {
      rows: rowsOf(db, keep),
      countries: JSON.stringify(db.country.rows),
      realm: JSON.stringify([db.realm.rows[0].seed, db.realm.rows[0].generationParams]),
    };
    const runRelief = relief();
    const base = { requestedBy: "admin_1", realmId: "default" };
    const diff = await runWorldDryRun(
      db,
      jobFor(await realmMap(), { ...base, ...choose(["altitudes", "rivers"]) })
    );
    expect(diff.chosen).toEqual(["altitudes", "rivers"]);
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), { ...base, ...chooseApply(["altitudes", "rivers"]) }),
      undefined,
      { runRelief }
    );
    expect(layer(db, "altitudes", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: false });
    expect(rowsOf(db, keep)).toBe(before.rows);
    expect(JSON.stringify(db.country.rows)).toBe(before.countries);
    expect(JSON.stringify([db.realm.rows[0].seed, db.realm.rows[0].generationParams])).toBe(
      before.realm
    );
    expect(result.slots).toEqual({ created: 0, retired: 0, opened: 0 });
    expect(runRelief).toHaveBeenCalledWith(expect.anything(), "default", expect.anything());
  });

  it("rebuilds its relief from its bands, whatever world last wrote its elevation", async () => {
    const db = ixnay();
    const base = { requestedBy: "admin_1", realmId: "default" };
    await applyWorld(
      db,
      jobFor(await realmMap(), { ...base, ...chooseApply(["altitudes"]) }),
      undefined,
      { runRelief: relief() }
    );
    db.mapImportJob.rows.push({ id: "j_world", uploadId: await realmMap() });
    const runRelief = relief();
    expect((await rebuildRealmRelief(db, "default", { runRelief })).source).toBe("bands");
    expect(runRelief.mock.calls[0]![2]).toEqual({ bands: true });
  });

  it("is refused to a founder who sends a layer choice", async () => {
    const db = ixnay();
    await expect(
      runWorldDryRun(
        db,
        jobFor(
          await realmMap(),
          choose(["rivers"], { requestedBy: "founder_1", realmId: "default" })
        )
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("a new realm from a world", () => {
  it("stays a listed draft owned by its admin when the apply fails", async () => {
    const db = seedRealm({ status: "draft", visibility: "unlisted", ownerId: "admin_1" });
    db.realm.rows[0].mapVersion = 3; // the check read version 0
    await expect(
      applyWorld(db, jobFor(await stored(), { requestedBy: "admin_1" }), undefined, {
        runRelief: relief(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.realm.rows).toHaveLength(1);
    expect(db.realm.rows[0]).toMatchObject({
      status: "draft",
      visibility: "unlisted",
      ownerId: "admin_1",
    });
  });
});
