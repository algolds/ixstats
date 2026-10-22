/** @jest-environment node */
/**
 * The admin layer choice (Studio, Review Focus 2) and Ixnay: a site admin writes exactly the ticked physical layers
 * onto a realm's own map, Ixnay included and under a pending claim, and never its land, borders, nations or
 * generation record; a ticked layer the world has none of is refused rather than wiping the realm's; past the guarded
 * client's 1000-row cap the check counts, the apply replaces and the rollback restores every row; Ixnay is never
 * generated without a layer choice. Then geoEditor.mapImport's world procedures: their permission and input gates,
 * one row each, and a refused call queues and builds nothing.
 *
 * Folds: src/tests/server/api/routers/geo/world-import-router.test.ts
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
jest.mock("~/server/modules/maps/realm-relief", () => ({
  buildRealmRelief: jest.fn(async () => ({
    id: "relief",
    version: "v9",
    maxZoom: 5,
    built: true,
    tiles: 4,
    skipped: 1,
  })),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorMapImportRouter } from "~/server/api/routers/geo/editor/map-import";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { buildRealmRelief } from "~/server/modules/maps/realm-relief";
import { applyWorld, runWorldDryRun } from "~/server/modules/maps/world-import";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, founder, stranger } from "./map-import-fakes";
import {
  CHECK_ID,
  jobFor,
  layer,
  makeBundle,
  mapRow,
  relief,
  seedRealm,
  storeBundle,
  stored,
} from "./world-import-fixtures";

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

describe("a layer choice", () => {
  it("on Ixnay, under a pending claim: writes only the ticked layers and keeps its seed, record, nations and borders", async () => {
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
    expect(diff.slots).toMatchObject({ create: 0, retire: 0 });
    const result = await applyWorld(
      db,
      jobFor(await realmMap(), { ...base, ...chooseApply(["altitudes", "rivers"]) }),
      undefined,
      { runRelief }
    );
    // replace mode: the ticked layers hold the world's features only
    expect(layer(db, "altitudes", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "altitudes", "zone_own")).toMatchObject({ isActive: false });
    expect(layer(db, "rivers", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: false });
    expect(rowsOf(db, keep)).toBe(before.rows);
    expect(JSON.stringify(db.country.rows)).toBe(before.countries);
    expect(JSON.stringify([db.realm.rows[0].seed, db.realm.rows[0].generationParams])).toBe(
      before.realm
    );
    expect(result.slots).toEqual({ created: 0, retired: 0, opened: 0 });
    expect(result.rollbackAvailable).toBe(true);
    expect(runRelief).toHaveBeenCalledWith(expect.anything(), "default", expect.anything());
  });

  it("refuses a ticked layer the world has none of, rather than wipe the realm's", async () => {
    const db = drawnRealm();
    db.mapLayer.rows.push(mapRow("lakes", "own"));
    const before = rowsOf(db, ["lakes"]);
    const upload = await realmMap();
    const message = expect.stringMatching(/no lakes features/);
    await expect(
      runWorldDryRun(db, jobFor(upload, choose(["lakes", "rivers"])))
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message });
    await expect(
      applyWorld(db, jobFor(upload, chooseApply(["lakes"])), undefined, { runRelief: relief() })
    ).rejects.toMatchObject({ message });
    expect(rowsOf(db, ["lakes"])).toBe(before);
  });

  it("past the 1000-row cap (Ixnay has 4068 bands): the check counts, the apply replaces and the rollback restores every row", async () => {
    const BANDS = 1001;
    const db = drawnRealm();
    for (let i = 0; i < BANDS; i++) db.mapLayer.rows.push(mapRow("altitudes", `band_${i}`));
    const state = () =>
      db.mapLayer.rows
        .map((r: { layerType: string; featureId: string; isActive: boolean }) =>
          [r.layerType, r.featureId, r.isActive].join(":")
        )
        .sort();
    const activeAltitudes = () =>
      db.mapLayer.rows.filter(
        (r: { layerType: string; isActive: boolean }) => r.layerType === "altitudes" && r.isActive
      ).length;
    const before = state();

    const diff = await runWorldDryRun(db, jobFor(await realmMap(), choose(["altitudes"])));
    expect(diff.layers.altitudes).toEqual({ create: 1, change: 0, retire: BANDS + 1 });
    expect(diff.replaces).toEqual([`The realm's ${BANDS + 1} altitudes features will be replaced`]);

    const result = await applyWorld(
      db,
      jobFor(await realmMap(), chooseApply(["altitudes"])),
      undefined,
      { runRelief: relief() }
    );
    expect(activeAltitudes()).toBe(1);

    // through the normal snapshot: the layers as they were, and no slot step
    const restored = await rollbackMapImport(db, admin, result.mapImportId!);
    expect(restored.slots).toBeUndefined();
    expect(activeAltitudes()).toBe(BANDS + 1);
    expect(state()).toEqual(before);
    expect(db.country.rows).toHaveLength(4);
  });
});

describe("Ixnay", () => {
  it("is never generated without a layer choice, not even for a site admin", async () => {
    const db = ixnay();
    const options = { requestedBy: "admin_1", realmId: "default" };
    const check = jobFor(await realmMap(), { ...options, options: { fittedMapVersion: 0 } });
    await expect(runWorldDryRun(db, check)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Ixnay"),
    });
    await expect(
      applyWorld(db, jobFor(await stored(), options), undefined, { runRelief: relief() })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("geoEditor.mapImport's world procedures: refusals", () => {
  // Queueing a job kicks the in-process runner on a timer: no timer fires, so no job runs after the test
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(buildRealmRelief).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  function caller(user: typeof admin, realm: Record<string, unknown> = {}) {
    const db = seedRealm(realm);
    const api = createCallerFactory(geoEditorMapImportRouter)(
      createMockRouterContext({
        db,
        auth: { userId: user.clerkUserId },
        user: { ...user, country: null },
      }) as never
    ).mapImport;
    return { db, api };
  }
  type Caller = ReturnType<typeof caller>;
  const world = { realmId: "r1", kind: "world" as const, filename: "world.json.gz" };
  const layerChoice = async () => ({
    ...world,
    uploadId: await storeBundle(makeBundle({ source: "realm-map" })),
    options: { layers: ["rivers" as const, "altitudes" as const] },
    fittedMapVersion: 0,
  });
  const IXNAY = { id: "default", slug: "ixnay" };

  it.each([
    [
      "start, while a claim is pending",
      founder,
      {},
      async ({ api, db }: Caller) => {
        db.realmClaim.rows.push({ id: "q", realmId: "r1", countryId: null, status: "pending" });
        return api.start({ ...world, uploadId: "a".repeat(64) });
      },
      { code: "CONFLICT" },
    ],
    [
      "start, a founder's layer choice",
      founder,
      {},
      async ({ api }: Caller) => api.start(await layerChoice()),
      { code: "FORBIDDEN" },
    ],
    [
      "start, a layer choice naming a layer that is not physical",
      admin,
      {},
      async ({ api }: Caller) =>
        api.start({ ...(await layerChoice()), options: { layers: ["political"] } as never }),
      { code: "BAD_REQUEST" },
    ],
    [
      "applyWorld, the check of a map that has changed since",
      founder,
      { mapVersion: 4 },
      async ({ api, db }: Caller) => {
        db.mapImportJob.rows[0].result.mapVersion = 3;
        return api.applyWorld({ jobId: CHECK_ID });
      },
      { code: "CONFLICT", message: "The map changed since the check. Check the world again." },
    ],
    [
      "applyWorld, a founder applying an admin's layer choice",
      founder,
      {},
      async ({ api, db }: Caller) => {
        db.mapImportJob.rows[0].options = { layers: ["lakes"] };
        return api.applyWorld({ jobId: CHECK_ID });
      },
      { code: "FORBIDDEN" },
    ],
    [
      "rebuildRelief, another player",
      stranger,
      {},
      async ({ api }: Caller) => api.rebuildRelief({ realmId: "r1" }),
      { code: "FORBIDDEN" },
    ],
    [
      "rebuildRelief, a founder on Ixnay",
      founder,
      IXNAY,
      async ({ api }: Caller) => api.rebuildRelief({ realmId: "default" }),
      { code: "FORBIDDEN" },
    ],
  ])("%s: refused, nothing queued or built", async (_case, user, realm, call, refusal) => {
    const callerFor = caller(user, realm);
    const jobs = callerFor.db.mapImportJob.rows.length;
    await expect(call(callerFor)).rejects.toMatchObject(refusal);
    expect(callerFor.db.mapImportJob.rows).toHaveLength(jobs);
    expect(buildRealmRelief).not.toHaveBeenCalled();
  });
});
