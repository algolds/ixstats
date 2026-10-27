/** @jest-environment node */
/**
 * A world import that goes wrong or is undone: the compensation after a failure puts the previous slots and layers
 * back and never deletes a slot a player claimed; the rollback of an applied world restores the slots, layers and the
 * realm's generation record in one go (never half), takes its locks in a claim's order and keeps a slot claimed as it
 * runs; whether the relief of the realm's latest world import is missing, and the rebuild that clears it; and Atlas's
 * retry guards (a failed apply retried as a check, one retry at a time, never on Ixnay, under a claim or in an
 * archived realm).
 *
 * Folds: src/tests/server/maps/world-import-rollback-race.test.ts, src/tests/server/maps/world-relief-state.test.ts,
 * src/tests/server/maps/atlas-jobs.test.ts
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
jest.mock("~/server/modules/maps/realm-map-pipeline.config", () => ({
  startMapPipelineRun: jest.fn(),
  cancelMapPipelineRun: jest.fn(),
}));

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { parseRealmMapSettings, withRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { withRasterLayer } from "~/lib/maps/raster-tiles";
import { retryAtlasJob } from "~/server/modules/maps/atlas-jobs";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { mapImportLockName } from "~/server/modules/maps/map-import.realm";
import { saveImportResult, saveMapUpload } from "~/server/modules/maps/map-import.storage";
import { startMapPipelineRun } from "~/server/modules/maps/realm-map-pipeline.config";
import { applyWorld, rebuildRealmRelief } from "~/server/modules/maps/world-import";
import { worldReliefFailed } from "~/server/modules/maps/world-import.relief-state";
import { atlasFakeDb } from "./atlas-fakes";
import { admin } from "./map-import-fakes";
import {
  CELLS,
  RELIEF_ENTRY,
  country,
  jobFor,
  layer,
  relief,
  seedRealm,
  stateOf,
  stored,
} from "./world-import-fixtures";

const held = new Set<string>();
(globalThis as { heldLeases?: Set<string> }).heldLeases = held;
afterEach(() => held.clear());

type Db = ReturnType<typeof seedRealm>;
/** The seeded realm's four countries: the generated slots and the hand-made one. */
const SEEDED = ["c_old1", "c_old2", "c_owned", "c_manual"];
const isNew = (c: { id: string }) => !SEEDED.includes(c.id);

let dir: string;
let rasterDir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-restore-"));
  rasterDir = mkdtempSync(path.join(tmpdir(), "world-restore-rasters-"));
  process.env.MAP_IMPORT_DIR = dir;
  process.env.MAP_RASTER_DIR = rasterDir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(rasterDir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
  delete process.env.MAP_RASTER_DIR;
});

const quietly = async <T>(run: () => Promise<T>) => {
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    return await run();
  } finally {
    error.mockRestore();
  }
};

describe("a failure after the slots changed", () => {
  /** The first nation border fails (its whole batch is rejected); the restore after it writes as usual. */
  const failFirstBorder = (db: Db) => {
    const upsert = db.mapLayer.upsert.getMockImplementation()!;
    let failed = false;
    db.mapLayer.upsert.mockImplementation(async (args: { create: { layerType: string } }) => {
      if (args.create.layerType === "political" && !failed) {
        failed = true;
        throw new Error("connection reset");
      }
      return upsert(args);
    });
  };

  it.each([
    [
      "the import cannot be recorded",
      (db: Db) => db.mapImport.create.mockRejectedValueOnce(new Error("disk full")),
      "disk full",
    ],
    [
      "the map writer rejects the nation borders",
      failFirstBorder,
      /rejected 3 nation borders \(connection reset\)/,
    ],
  ])("puts the previous slots and layers back when %s", async (_case, fail, message) => {
    const db = seedRealm();
    const runRelief = relief();
    const job = jobFor(await stored());
    fail(db);
    await quietly(() =>
      expect(applyWorld(db, job, undefined, { runRelief })).rejects.toThrow(message)
    );
    // The retired slot is back as it was; the new ones and their borders are gone
    expect(country(db, "c_old1")).toMatchObject({
      name: "Old One",
      slug: "old-one",
      worldgen: true,
      baselinePopulation: 500_000,
      baselineGdpPerCapita: 9_000,
    });
    expect(db.country.rows.map((c: { id: string }) => c.id).sort()).toEqual([...SEEDED].sort());
    // c_old2 (a withdrawn claim holds it) was closed for the new world and is open again with its old border
    expect(country(db, "c_old2")).toMatchObject({ claimable: true });
    expect(layer(db, "political", "slot_1")).toBeUndefined();
    expect(layer(db, "rivers", "1")).toBeUndefined();
    expect(layer(db, "political", "slot_old")).toMatchObject({
      isActive: true,
      countryId: "c_old1",
    });
    expect(layer(db, "political", "manual-key")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: true });
    expect(db.realm.rows[0].seed).toBeNull();
    expect(runRelief).not.toHaveBeenCalled();
    // an import it recorded is marked as rolled back, so the history does not offer it
    expect(db.mapImport.rows.every((r: { rolledBackAt: Date | null }) => r.rolledBackAt)).toBe(
      true
    );
  });

  it("keeps every new slot unclaimable while the map is written, and opens them after", async () => {
    const db = seedRealm();
    const seen: boolean[][] = [];
    const record = db.mapImport.create.getMockImplementation()!;
    // The import is recorded once the layers are written: the last moment before the slots open
    db.mapImport.create.mockImplementationOnce(async (args: object) => {
      seen.push(db.country.rows.filter(isNew).map((c: { claimable: boolean }) => c.claimable));
      return record(args);
    });
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(seen).toEqual([[false, false, false]]);
    expect(db.country.rows.filter(isNew).map((c: { claimable: boolean }) => c.claimable)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("keeps a new slot a player claimed once it was open, and says so in the error", async () => {
    const db = seedRealm();
    let late = false;
    // The last step after the slots open fails; a claim has just landed on one of them
    jest.mocked(broadcastMapUpdate).mockImplementation((kind: string) => {
      const open = db.country.rows.filter(isNew).filter((c: { claimable: boolean }) => c.claimable);
      if (kind !== "bulk" || open.length === 0 || late) return;
      late = true;
      db.realmClaim.rows.push({
        id: "q_late",
        realmId: "r1",
        countryId: open[0].id,
        status: "pending",
      });
      throw new Error("socket closed");
    });
    const runRelief = relief();
    const job = jobFor(await stored());
    await quietly(() =>
      expect(applyWorld(db, job, undefined, { runRelief })).rejects.toThrow(
        /socket closed\. 1 new nation was kept because a player has claimed it/
      )
    );
    jest.mocked(broadcastMapUpdate).mockReset();

    // Only the claimed nation stays, with its claim; the retired slot is back; the realm's record is as before
    expect(db.country.rows.filter(isNew)).toHaveLength(1);
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_late",
      "q_withdrawn",
    ]);
    expect(country(db, "c_old1")).toBeDefined();
    expect(db.realm.rows[0].seed).toBeNull();
    expect(runRelief).not.toHaveBeenCalled();
  });
});

describe("rolling a world back", () => {
  const BEFORE = "a".repeat(8);
  const AFTER = "b".repeat(8);
  const base = {
    id: "geography",
    label: "Geography",
    kind: "base" as const,
    version: "c".repeat(8),
    maxZoom: 3,
  };
  const reliefBefore = {
    id: "relief",
    label: "Relief",
    kind: "overlay" as const,
    version: BEFORE,
    maxZoom: 5,
    order: 10,
  };
  /** A relief runner that records its layer in the realm's settings, as the real one does. */
  const recordingRelief = (db: Db) =>
    jest.fn(async (_db: unknown, realmId: string) => {
      const realm = db.realm.rows.find((r: { id: string }) => r.id === realmId);
      const layers = parseRealmMapSettings(realm.settings).rasterLayers ?? [];
      realm.settings = withRealmMapSettings(realm.settings, {
        rasterLayers: withRasterLayer(layers, { ...RELIEF_ENTRY, version: AFTER, order: 10 }),
      });
      return { ...RELIEF_ENTRY, version: AFTER };
    });

  it("changes nothing while another import holds the lease or when it fails partway, and the retry puts back the slots, layers and the realm's record", async () => {
    const previous = { source: "preset", developmentLevel: "modern", params: { seed: 7 } };
    const db = seedRealm({
      seed: 7,
      generationParams: previous,
      settings: {
        inactivityDays: 30,
        map: { radiusKm: 3185.5, rasterLayers: [base, reliefBefore] },
      },
    });
    // The tiles of the relief before the world are on disk, so a rollback can put its entry back
    mkdirSync(path.join(rasterDir, "r1", "relief", BEFORE), { recursive: true });
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: recordingRelief(db),
    });
    expect(country(db, "c_old1")).toBeUndefined();
    expect(db.realm.rows[0].seed).toBe(42);
    const worldState = stateOf(db);

    held.add(mapImportLockName("r1"));
    await expect(rollbackMapImport(db, admin, applied.mapImportId!)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Another import"),
    });
    held.clear();
    expect(stateOf(db)).toBe(worldState);

    // The old slots cannot be put back: the new ones are not removed without them
    db.country.createMany.mockRejectedValueOnce(new Error("slug taken"));
    await expect(rollbackMapImport(db, admin, applied.mapImportId!)).rejects.toThrow("slug taken");
    expect(stateOf(db)).toBe(worldState);

    const restored = await rollbackMapImport(db, admin, applied.mapImportId!);
    expect(restored.slots).toEqual({ restored: 1, removed: 3, kept: 0 });
    expect(country(db, "c_old1")).toMatchObject({
      name: "Old One",
      slug: "old-one",
      worldgen: true,
    });
    // the slot the world had closed (its old claim kept it) is open again, as its border is
    expect(country(db, "c_old2")).toMatchObject({ claimable: true });
    expect(db.country.rows).toHaveLength(4);
    expect(layer(db, "political", "slot_old")).toMatchObject({
      isActive: true,
      countryId: "c_old1",
    });
    expect(layer(db, "political", "slot_1")).toBeUndefined();
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: true });
    // the previous seed, parameters and relief version, and the realm's other settings kept
    expect(db.realm.rows[0]).toMatchObject({ seed: 7, generationParams: previous });
    const settings = parseRealmMapSettings(db.realm.rows[0].settings);
    expect(settings.rasterLayers).toEqual([base, reliefBefore]);
    expect(settings.radiusKm).toBe(3185.5);
    expect(db.realm.rows[0].settings.inactivityDays).toBe(30);
  });

  it("refuses once a player has claimed one of the new slots, changing nothing", async () => {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    const made = db.country.rows.find((c: { name: string }) => c.name === "Nation 3");
    db.realmClaim.rows.push({ id: "q_new", realmId: "r1", countryId: made.id, status: "approved" });
    const before = stateOf(db);
    await expect(rollbackMapImport(db, admin, applied.mapImportId!)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("have been claimed"),
    });
    expect(stateOf(db)).toBe(before);
  });

  it("locks the new slots, then the realm, closes them and only then reads who holds them: a claim filed at the lock keeps its slot", async () => {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    const made = db.country.rows.filter(isNew) as Array<{ id: string }>;
    const events: string[] = [];
    let filed = false;
    const queryRaw = db.$queryRaw;
    db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
      const text = sql.join("?");
      if (text.includes("FOR UPDATE")) {
        events.push(text.includes('"Country"') ? "lock slots" : "lock realm");
        // A player's claim (loadClaimable refuses a slot that is not claimable) commits just as the restore asks
        // for its lock: the lock waits for it, then the check sees it
        const claimed = country(db, made[2]!.id);
        if (!filed && claimed?.claimable) {
          filed = true;
          db.realmClaim.rows.push({
            id: "q_late",
            realmId: "r1",
            countryId: made[2]!.id,
            status: "pending",
          });
        }
      }
      return queryRaw(sql, ...args);
    });
    const claims = db.realmClaim.findMany.getMockImplementation()!;
    db.realmClaim.findMany = jest.fn(async (args: object) => {
      events.push("read claims");
      return claims(args);
    });
    const close = db.country.updateMany.getMockImplementation()!;
    db.country.updateMany = jest.fn(async (args: { data: { claimable?: boolean } }) => {
      if (args.data.claimable === false) events.push("close slots");
      return close(args);
    });
    const remove = db.country.deleteMany.getMockImplementation()!;
    db.country.deleteMany = jest.fn(async (args: object) => {
      events.push("delete slots");
      return remove(args);
    });

    const restored = await rollbackMapImport(db, admin, applied.mapImportId!);
    // Country rows, then the realm: the order of the apply and of a claim's own foreign-key checks
    expect(events.slice(events.indexOf("lock slots"))).toEqual([
      "lock slots",
      "lock realm",
      "close slots",
      "read claims",
      "delete slots",
    ]);
    expect(filed).toBe(true);
    expect(restored.slots).toEqual({ restored: 1, removed: 2, kept: 1 });
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_late",
      "q_withdrawn",
    ]);
    // It was open before, and a pending claim on it must still be decidable
    expect(country(db, made[2]!.id)).toMatchObject({ claimable: true });
    expect(made.slice(0, 2).every((c) => country(db, c.id) === undefined)).toBe(true);
  });
});

describe("whether the realm's relief is missing (what the World tab offers to rebuild)", () => {
  const FAILED = { status: "failed", version: null, tiles: 0, error: "sharp ran out of memory" };
  const BUILT = { status: "built", version: "abc12345", tiles: 12, error: null };

  /** A finished apply job of the realm and the import it recorded. */
  function addApply(db: Db, id: string, outcome: object, createdAt = "2026-02-01T00:00:00Z") {
    db.mapImportJob.rows.push({
      id,
      realmId: "r1",
      kind: "world",
      dryRun: false,
      status: "succeeded",
      result: { phase: "world-apply", written: 4, relief: outcome },
      createdAt: new Date(createdAt),
    });
    db.mapImport.rows.push({
      id: `i_${id}`,
      realmId: "r1",
      jobId: id,
      layerTypes: ["altitudes"],
      rolledBackAt: null,
    });
  }

  it.each([
    [
      "a later world import that built its relief clears an earlier failure",
      () => {
        const db = seedRealm();
        addApply(db, "j_old", FAILED);
        addApply(db, "j_new", BUILT, "2026-03-01T00:00:00Z");
        return db;
      },
      false,
    ],
    [
      "a rollback of the import whose relief failed clears it (the previous relief is back)",
      () => {
        const db = seedRealm();
        addApply(db, "j_apply", FAILED);
        db.mapImport.rows[0]!.rolledBackAt = new Date();
        return db;
      },
      false,
    ],
    [
      "a relief version the settings record with no tiles on disk (pruned, or never shared) is missing",
      () =>
        seedRealm({
          settings: {
            map: {
              rasterLayers: [
                {
                  id: "relief",
                  label: "Relief",
                  kind: "overlay",
                  // never built here (the rollback test above builds "a" x 8)
                  version: "d".repeat(8),
                  maxZoom: 5,
                  order: 10,
                },
              ],
            },
          },
        }),
      true,
    ],
  ])("%s", async (_case, realm, missing) => {
    await expect(worldReliefFailed(realm(), "r1")).resolves.toBe(missing);
  });

  it("is cleared by a rebuild from the cells of the world whose relief step failed", async () => {
    const db = seedRealm();
    const uploadId = await stored();
    const applied = await quietly(() =>
      applyWorld(db, jobFor(uploadId), undefined, {
        runRelief: jest.fn().mockRejectedValue(new Error("sharp ran out of memory")),
      })
    );
    expect(applied.relief).toMatchObject({ status: "failed", error: "sharp ran out of memory" });
    // the job runner records the apply's outcome on its job
    db.mapImportJob.rows.push({
      id: "j_world",
      realmId: "r1",
      uploadId,
      kind: "world",
      dryRun: false,
      status: "succeeded",
      result: { phase: "world-apply", relief: applied.relief },
      createdAt: new Date(),
    });
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(true);

    const runRelief = relief();
    expect(await rebuildRealmRelief(db, "r1", { runRelief })).toEqual({
      source: "cells",
      version: "abc12345",
      built: true,
      tiles: 12,
    });
    expect(Array.from((runRelief.mock.calls[0]![2] as { cells: Float32Array }).cells)).toEqual(
      CELLS
    );
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(false);
    expect(
      db.mapImportJob.rows.find((job: { id: string }) => job.id === "j_world")!.result.relief
    ).toEqual({ status: "built", version: "abc12345", tiles: 12, error: null });
  });
});

describe("Atlas: retrying a failed job", () => {
  type Fake = ReturnType<typeof atlasFakeDb>;
  const deps = { kick: false };
  let uploadId: string;
  beforeAll(async () => {
    uploadId = await saveMapUpload(new Uint8Array([1, 2, 3]));
  });
  beforeEach(() => jest.mocked(startMapPipelineRun).mockClear());

  let n = 0;
  function seed(db: Fake, job: Record<string, unknown>) {
    const row = {
      id: `job${(++n).toString().padStart(6, "0")}`,
      realmId: "a",
      kind: "png",
      status: "succeeded",
      dryRun: true,
      progress: 100,
      stage: "Done",
      error: null,
      filename: "map.png",
      parentJobId: null,
      requestedBy: "someone",
      uploadId,
      options: {},
      result: { big: "result" },
      createdAt: new Date(1_000_000 + n * 1000),
      startedAt: null,
      finishedAt: null,
      ...job,
    };
    db.mapImportJob.rows.push(row);
    return row;
  }
  const realmRow = (id: string, slug: string, status = "active") => ({
    id,
    slug,
    name: slug,
    ownerId: "owner",
    status,
    settings: null,
  });
  function world() {
    const db = atlasFakeDb();
    db.realm.rows.push(realmRow("a", "alpha"), realmRow("b", "beta"));
    return db;
  }
  function failedWorldApply(db: Fake, realmId: string) {
    const check = seed(db, { kind: "world", realmId });
    return seed(db, {
      kind: "world",
      dryRun: false,
      status: "failed",
      parentJobId: check.id,
      realmId,
    });
  }
  const job = (db: Fake, id: string) =>
    (db.mapImportJob.rows as Array<{ id: string; status: string }>).find((r) => r.id === id)!;

  it("restarts a failed world apply as a new CHECK from the same upload, never an apply", async () => {
    const db = world();
    const check = seed(db, {
      kind: "world",
      options: { fittedMapVersion: 4 },
      filename: "w.json.gz",
    });
    const failed = seed(db, {
      kind: "world",
      dryRun: false,
      status: "failed",
      parentJobId: check.id,
      options: {},
      filename: "w.json.gz",
    });
    const result = await retryAtlasJob(db, admin, failed.id, deps);
    const created = db.mapImportJob.rows.find((r: { id: string }) => r.id === result.jobId);
    expect(result.retryAs).toBe("world-check");
    expect(created).toMatchObject({
      kind: "world",
      dryRun: true,
      parentJobId: null,
      uploadId,
      requestedBy: admin.clerkUserId,
    });
    expect(created.options.fittedMapVersion).toBe(4);
    expect(result.note).toMatch(/fails if the map has changed/i);
  });

  it("refuses a second retry while the first job on the file is queued or running", async () => {
    const db = world();
    const failed = seed(db, { status: "failed" });
    const first = await retryAtlasJob(db, admin, failed.id, deps);
    const before = db.mapImportJob.rows.length;
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A job for this file is already running",
    });
    expect(db.mapImportJob.rows).toHaveLength(before);

    // Running counts too; once it has finished (or failed) a retry is allowed again
    job(db, first.jobId).status = "running";
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toThrow(/already running/i);
    job(db, first.jobId).status = "failed";
    await expect(retryAtlasJob(db, admin, failed.id, deps)).resolves.toMatchObject({
      retryAs: "analysis",
    });
  });

  it.each([
    [
      "a world on Ixnay",
      async (db: Fake) => {
        db.realm.rows.push(realmRow("default", "ixnay"));
        return [failedWorldApply(db, "default")];
      },
      { code: "BAD_REQUEST" },
    ],
    [
      "a world while a claim is pending",
      async (db: Fake) => {
        db.realmClaim.rows.push({ realmId: "a", status: "pending" });
        return [failedWorldApply(db, "a")];
      },
      { code: "CONFLICT" },
    ],
    [
      "every kind of job in an archived realm",
      async (db: Fake) => {
        db.realm.rows.push(realmRow("old", "old", "archived"));
        const parent = seed(db, { realmId: "old" });
        await saveImportResult(parent.id, {} as never);
        return [
          seed(db, { realmId: "old", status: "failed" }),
          seed(db, { realmId: "old", status: "failed", kind: "world" }),
          failedWorldApply(db, "old"),
          seed(db, {
            realmId: "old",
            status: "failed",
            dryRun: false,
            parentJobId: parent.id,
            options: { apply: { mapping: {} } },
          }),
          seed(db, {
            realmId: "old",
            status: "failed",
            kind: "map-pipeline",
            uploadId: null,
            options: { steps: ["relief"], dryRun: false },
          }),
        ];
      },
      { code: "BAD_REQUEST", message: expect.stringMatching(/archived/i) },
    ],
  ])("never retries %s, queueing nothing", async (_case, failedJobs, refusal) => {
    const db = world();
    const failed = await failedJobs(db);
    const before = db.mapImportJob.rows.length;
    for (const row of failed) {
      await expect(retryAtlasJob(db, admin, row.id, deps)).rejects.toMatchObject(refusal);
    }
    expect(db.mapImportJob.rows).toHaveLength(before);
    expect(startMapPipelineRun).not.toHaveBeenCalled();
  });
});
