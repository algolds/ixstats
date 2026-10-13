/** @jest-environment node */
/** Atlas jobs: the cross-realm list, per-row actions, and retry, cancel and rollback by kind. */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/maps/realm-map-pipeline.config", () => ({
  startMapPipelineRun: jest.fn(),
  cancelMapPipelineRun: jest.fn(),
}));
jest.mock("~/server/modules/maps/map-import.history", () => ({ rollbackMapImport: jest.fn() }));

import { ZodError } from "zod";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  cancelAtlasJob,
  getAtlasJob,
  latestAtlasImport,
  listAtlasJobs,
  retryAtlasJob,
  rollbackAtlasImport,
} from "~/server/modules/maps/atlas-jobs";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { saveImportResult, saveMapUpload } from "~/server/modules/maps/map-import.storage";
import {
  cancelMapPipelineRun,
  startMapPipelineRun,
} from "~/server/modules/maps/realm-map-pipeline.config";
import { atlasFakeDb } from "./atlas-fakes";
import { admin } from "./map-import-fakes";

type Fake = ReturnType<typeof atlasFakeDb>;

let dir: string;
let uploadId: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "atlas-jobs-"));
  process.env.MAP_IMPORT_DIR = dir;
  uploadId = await saveMapUpload(new Uint8Array([1, 2, 3]));
});
afterAll(async () => {
  delete process.env.MAP_IMPORT_DIR;
  await rm(dir, { recursive: true, force: true });
});

/** Moves a job the fake holds to another status, as the worker would. */
function setStatus(db: Fake, id: string, status: string) {
  const row = (db.mapImportJob.rows as Array<{ id: string; status: string }>).find(
    (r) => r.id === id
  );
  if (!row) throw new Error(`No job ${id}`);
  row.status = status;
}

const GONE = "f".repeat(64);
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

function world(extra: Record<string, unknown> = {}) {
  const db = atlasFakeDb();
  db.realm.rows.push(
    { id: "a", slug: "alpha", name: "Alpha", ownerId: "owner", status: "active", settings: null },
    { id: "b", slug: "beta", name: "Beta", ownerId: "owner", status: "active", settings: null }
  );
  Object.assign(db, extra);
  return db;
}

beforeEach(() => jest.clearAllMocks());

describe("listAtlasJobs", () => {
  it("lists newest first across realms without the result, with the realm", async () => {
    const db = world();
    const a = seed(db, { realmId: "a" });
    const b = seed(db, { realmId: "b", kind: "svg" });
    const { jobs, nextCursor } = await listAtlasJobs(db);
    expect(jobs.map((j) => j.id)).toEqual([b.id, a.id]);
    expect(jobs[0]!.realm).toEqual({ id: "b", slug: "beta", name: "Beta" });
    expect(jobs[0]).not.toHaveProperty("result");
    expect(jobs[0]).not.toHaveProperty("uploadId");
    expect(nextCursor).toBeNull();
  });

  it("filters by realm (id or slug), kind and status", async () => {
    const db = world();
    seed(db, { realmId: "a", kind: "png", status: "failed" });
    const wanted = seed(db, { realmId: "b", kind: "world", status: "queued" });
    seed(db, { realmId: "b", kind: "png", status: "queued" });
    const ids = async (f: Parameters<typeof listAtlasJobs>[1]) =>
      (await listAtlasJobs(db, f)).jobs.map((j) => j.id);
    expect(await ids({ realm: "b", kind: "world" })).toEqual([wanted.id]);
    expect(await ids({ realm: "beta", kind: "world", status: "queued" })).toEqual([wanted.id]);
    expect(await ids({ status: "failed" })).toHaveLength(1);
    expect(await ids({ realm: "nowhere" })).toEqual([]);
  });

  it("pages by (createdAt, id) with a cursor, ties included", async () => {
    const db = world();
    const same = new Date(2_000_000);
    const rows = [1, 2, 3, 4, 5].map((i) =>
      seed(db, { id: `tie${i}`, createdAt: i > 2 ? same : new Date(2_000_000 + i) })
    );
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await listAtlasJobs(db, { limit: 2, cursor });
      seen.push(...page.jobs.map((j) => j.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual(["tie2", "tie1", "tie5", "tie4", "tie3"]);
    expect(new Set(seen).size).toBe(rows.length);
  });

  it("refuses a malformed cursor", async () => {
    await expect(listAtlasJobs(world(), { cursor: "garbage" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("says which rows can be cancelled: a world apply only while queued", async () => {
    const db = world();
    const rows = {
      queuedPng: seed(db, { status: "queued" }),
      runningPng: seed(db, { status: "running" }),
      runningCheck: seed(db, { kind: "world", status: "running" }),
      queuedApply: seed(db, { kind: "world", dryRun: false, status: "queued" }),
      runningApply: seed(db, { kind: "world", dryRun: false, status: "running" }),
      done: seed(db, { status: "succeeded" }),
    };
    const { jobs } = await listAtlasJobs(db);
    const can = (id: string) => jobs.find((j) => j.id === id)!.canCancel;
    expect(Object.entries(rows).map(([k, r]) => [k, can(r.id)])).toEqual([
      ["queuedPng", true],
      ["runningPng", true],
      ["runningCheck", true],
      ["queuedApply", true],
      ["runningApply", false],
      ["done", false],
    ]);
  });

  it("says which failed jobs can be retried and why not", async () => {
    const db = world();
    const parent = seed(db, { status: "succeeded" });
    await saveImportResult(parent.id, {} as never);
    const orphan = seed(db, { status: "succeeded" });
    const cases = {
      analysis: seed(db, { status: "failed" }),
      analysisNoUpload: seed(db, { status: "failed", uploadId: GONE }),
      apply: seed(db, { status: "failed", dryRun: false, parentJobId: parent.id }),
      applyNoResult: seed(db, { status: "failed", dryRun: false, parentJobId: orphan.id }),
      worldApply: seed(db, { status: "failed", kind: "world", dryRun: false }),
      pipeline: seed(db, { status: "failed", kind: "map-pipeline", uploadId: null }),
      notFailed: seed(db, { status: "succeeded" }),
    };
    const { jobs } = await listAtlasJobs(db);
    const by = (id: string) => jobs.find((j) => j.id === id)!;
    expect(Object.entries(cases).map(([k, r]) => [k, by(r.id).canRetry, by(r.id).retryAs])).toEqual(
      [
        ["analysis", true, "analysis"],
        ["analysisNoUpload", false, "analysis"],
        ["apply", true, "apply"],
        ["applyNoResult", false, "apply"],
        ["worldApply", true, "world-check"],
        ["pipeline", true, "pipeline"],
        ["notFailed", false, "analysis"],
      ]
    );
    expect(by(cases.analysisNoUpload.id).retryBlocked).toMatch(/upload it again/i);
    expect(by(cases.applyNoResult.id).retryBlocked).toMatch(/analyse the file again/i);
  });

  it("marks only the realm's latest import still in place as rollbackable", async () => {
    const db = world();
    const older = seed(db, { dryRun: false });
    const newer = seed(db, { dryRun: false });
    const other = seed(db, { dryRun: false, realmId: "b" });
    const unrolled = seed(db, { dryRun: false, realmId: "b" });
    db.mapImport.rows.push(
      { id: "i1", realmId: "a", jobId: older.id, createdAt: new Date(10), rollbackAvailable: true },
      { id: "i2", realmId: "a", jobId: newer.id, createdAt: new Date(20), rollbackAvailable: true },
      { id: "i3", realmId: "b", jobId: other.id, createdAt: new Date(10), rollbackAvailable: true },
      {
        id: "i4",
        realmId: "b",
        jobId: unrolled.id,
        createdAt: new Date(20),
        rollbackAvailable: true,
        rolledBackAt: new Date(30),
      }
    );
    const { jobs } = await listAtlasJobs(db);
    const state = (id: string) => {
      const job = jobs.find((j) => j.id === id)!;
      return [job.importId, job.canRollBack];
    };
    expect(state(older.id)).toEqual(["i1", false]);
    expect(state(newer.id)).toEqual(["i2", true]);
    // the newer import of b was rolled back, so b's older one is the latest in place
    expect(state(other.id)).toEqual(["i3", true]);
    expect(state(unrolled.id)).toEqual(["i4", false]);
  });
});

describe("getAtlasJob", () => {
  it("returns the result and a retry note, mentioning a fitted world", async () => {
    const db = world();
    const check = seed(db, { kind: "world", options: { fittedMapVersion: 7 } });
    const apply = seed(db, {
      kind: "world",
      dryRun: false,
      status: "failed",
      parentJobId: check.id,
      options: {},
    });
    const detail = await getAtlasJob(db, apply.id);
    expect(detail.result).toEqual({ big: "result" });
    expect(detail.fittedMapVersion).toBe(7);
    expect(detail.retryNote).toMatch(/new check/i);
    expect(detail.retryNote).toMatch(/fails if the map has changed/i);
    await expect(getAtlasJob(db, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("offers Apply only for a succeeded world check that nothing has been applied from", async () => {
    const db = world();
    const fresh = seed(db, { kind: "world" });
    expect((await getAtlasJob(db, fresh.id)).canApply).toBe(true);

    const used = seed(db, { kind: "world" });
    seed(db, { kind: "world", dryRun: false, status: "failed", parentJobId: used.id });
    expect((await getAtlasJob(db, used.id)).canApply).toBe(false);

    for (const other of [
      seed(db, { kind: "world", status: "failed" }),
      seed(db, { kind: "world", status: "running" }),
      seed(db, { kind: "world", dryRun: false }),
      seed(db, { kind: "png" }),
    ]) {
      expect((await getAtlasJob(db, other.id)).canApply).toBe(false);
    }
  });
});

describe("retryAtlasJob", () => {
  const deps = { kick: false };

  it("analyses the same upload again with the same settings, requested by the admin", async () => {
    const db = world();
    const failed = seed(db, {
      status: "failed",
      options: { georef: undefined, attribution: "Credit" },
      filename: "x.png",
    });
    const result = await retryAtlasJob(db, admin, failed.id, deps);
    const created = db.mapImportJob.rows.find((r: any) => r.id === result.jobId);
    expect(result.retryAs).toBe("analysis");
    expect(created).toMatchObject({
      realmId: "a",
      kind: "png",
      dryRun: true,
      uploadId,
      filename: "x.png",
      requestedBy: admin.clerkUserId,
      status: "queued",
    });
    expect(created.options).toMatchObject({ attribution: "Credit" });
  });

  it("applies the same mapping again from the analysis", async () => {
    const db = world();
    const parent = seed(db, { status: "succeeded" });
    await saveImportResult(parent.id, {} as never);
    const failed = seed(db, {
      status: "failed",
      dryRun: false,
      parentJobId: parent.id,
      options: { apply: { mapping: { r1: "Nation" }, mode: "replace" } },
    });
    const result = await retryAtlasJob(db, admin, failed.id, deps);
    const created = db.mapImportJob.rows.find((r: any) => r.id === result.jobId);
    expect(result.retryAs).toBe("apply");
    expect(created).toMatchObject({
      dryRun: false,
      parentJobId: parent.id,
      requestedBy: admin.clerkUserId,
    });
    expect(created.options.apply).toMatchObject({ mapping: { r1: "Nation" }, mode: "replace" });
  });

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
    const created = db.mapImportJob.rows.find((r: any) => r.id === result.jobId);
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

  it("retries an Ixnay layer choice as a layer choice, under a pending claim", async () => {
    const db = world();
    db.realm.rows.push({
      id: "default",
      slug: "ixnay",
      name: "Ixnay",
      ownerId: "system",
      status: "active",
    });
    db.realmClaim.rows.push({ id: "q", realmId: "default", countryId: null, status: "pending" });
    const check = seed(db, {
      realmId: "default",
      kind: "world",
      status: "failed",
      options: { layers: ["rivers", "altitudes"], fittedMapVersion: 2 },
    });
    const failed = seed(db, {
      realmId: "default",
      kind: "world",
      dryRun: false,
      status: "failed",
      parentJobId: check.id,
      options: { layers: ["rivers", "altitudes"] },
    });
    for (const from of [check, failed]) {
      const result = await retryAtlasJob(db, admin, from.id, deps);
      const created = db.mapImportJob.rows.find((r: any) => r.id === result.jobId);
      expect(created).toMatchObject({ realmId: "default", kind: "world", dryRun: true });
      expect(created.options).toMatchObject({
        layers: ["rivers", "altitudes"],
        fittedMapVersion: 2,
      });
      // That check finishes before the next retry: a second one while it ran would be refused
      created.status = "succeeded";
    }
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
    setStatus(db, first.jobId, "running");
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toThrow(/already running/i);
    setStatus(db, first.jobId, "failed");
    await expect(retryAtlasJob(db, admin, failed.id, deps)).resolves.toMatchObject({
      retryAs: "analysis",
    });
  });

  it("does not hold a retry back for a job on another file or in another realm", async () => {
    const db = world();
    const failed = seed(db, { status: "failed" });
    seed(db, { status: "running", uploadId: "e".repeat(64) });
    seed(db, { status: "running", realmId: "b" });
    await expect(retryAtlasJob(db, admin, failed.id, deps)).resolves.toMatchObject({
      retryAs: "analysis",
    });
  });

  it("refuses a second pipeline retry for the realm while a run is queued or running", async () => {
    const db = world();
    jest.mocked(startMapPipelineRun).mockResolvedValue({ jobId: "new1" });
    const failed = seed(db, {
      kind: "map-pipeline",
      status: "failed",
      uploadId: null,
      options: { steps: ["relief"], dryRun: false },
    });
    seed(db, { kind: "map-pipeline", status: "queued", uploadId: null });
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toThrow(/already running/i);
    expect(startMapPipelineRun).not.toHaveBeenCalled();
  });

  it("starts a failed world check again as a check", async () => {
    const db = world();
    const failed = seed(db, { kind: "world", status: "failed" });
    const result = await retryAtlasJob(db, admin, failed.id, deps);
    expect(db.mapImportJob.rows.find((r: any) => r.id === result.jobId)).toMatchObject({
      kind: "world",
      dryRun: true,
    });
  });

  it("runs a pipeline again with its stored options", async () => {
    const db = world();
    jest.mocked(startMapPipelineRun).mockResolvedValue({ jobId: "new1" });
    const failed = seed(db, {
      kind: "map-pipeline",
      status: "failed",
      uploadId: null,
      options: { steps: ["relief"], dryRun: false },
    });
    const result = await retryAtlasJob(db, admin, failed.id, deps);
    expect(result).toMatchObject({ jobId: "new1", retryAs: "pipeline" });
    expect(startMapPipelineRun).toHaveBeenCalledWith(
      db,
      admin,
      "a",
      { steps: ["relief"], dryRun: false },
      deps
    );
  });

  it("refuses what is not failed, a gone upload and a gone analysis", async () => {
    const db = world();
    const ok = seed(db, { status: "succeeded" });
    const noUpload = seed(db, { status: "failed", uploadId: GONE });
    const noResult = seed(db, { status: "failed", dryRun: false, parentJobId: "nothing" });
    await expect(retryAtlasJob(db, admin, ok.id, deps)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(retryAtlasJob(db, admin, noUpload.id, deps)).rejects.toThrow(/upload it again/i);
    await expect(retryAtlasJob(db, admin, noResult.id, deps)).rejects.toThrow(
      /analyse the file again/i
    );
    await expect(retryAtlasJob(db, admin, "missing", deps)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.mapImportJob.rows).toHaveLength(3);
  });
});

describe("retry guards", () => {
  const deps = { kick: false };

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

  it("refuses to retry a world on Ixnay", async () => {
    const db = world();
    db.realm.rows.push({
      id: "default",
      slug: "ixnay",
      name: "Ixnay",
      ownerId: "o",
      status: "active",
      settings: null,
    });
    const failed = failedWorldApply(db, "default");
    const before = db.mapImportJob.rows.length;
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.mapImportJob.rows).toHaveLength(before);
  });

  it("refuses to retry a world while a claim is pending", async () => {
    const db = world();
    const failed = failedWorldApply(db, "a");
    db.realmClaim.rows.push({ realmId: "a", status: "pending" });
    const before = db.mapImportJob.rows.length;
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.mapImportJob.rows).toHaveLength(before);
  });

  it("refuses every kind of retry in an archived realm", async () => {
    const db = world();
    db.realm.rows.push({
      id: "old",
      slug: "old",
      name: "Old",
      ownerId: "o",
      status: "archived",
      settings: null,
    });
    const parent = seed(db, { realmId: "old" });
    await saveImportResult(parent.id, {} as never);
    const failed = [
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
    const before = db.mapImportJob.rows.length;
    for (const job of failed) {
      await expect(retryAtlasJob(db, admin, job.id, deps)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringMatching(/archived/i),
      });
    }
    expect(db.mapImportJob.rows).toHaveLength(before);
    expect(startMapPipelineRun).not.toHaveBeenCalled();
  });

  it.each(["svg", "geojson"])(
    "applies a failed %s import again from its analysis",
    async (kind) => {
      const db = world();
      const parent = seed(db, { kind });
      await saveImportResult(parent.id, {} as never);
      const failed = seed(db, {
        kind,
        status: "failed",
        dryRun: false,
        parentJobId: parent.id,
        options: { apply: { mapping: { r: "Nation" } } },
      });
      const result = await retryAtlasJob(db, admin, failed.id, deps);
      expect(db.mapImportJob.rows.find((r: any) => r.id === result.jobId)).toMatchObject({
        kind,
        dryRun: false,
        parentJobId: parent.id,
      });
    }
  );

  it("refuses an apply whose stored mapping is missing", async () => {
    const db = world();
    const parent = seed(db, {});
    await saveImportResult(parent.id, {} as never);
    const failed = seed(db, {
      status: "failed",
      dryRun: false,
      parentJobId: parent.id,
      options: {},
    });
    await expect(retryAtlasJob(db, admin, failed.id, deps)).rejects.toBeInstanceOf(ZodError);
  });
});

describe("cancel and rollback", () => {
  it("cancels a queued import and refuses a running world apply", async () => {
    const db = world();
    const queued = seed(db, { status: "queued" });
    const running = seed(db, { kind: "world", dryRun: false, status: "running" });
    await expect(cancelAtlasJob(db, admin, queued.id)).resolves.toEqual({ cancelled: true });
    expect(queued.status).toBe("cancelled");
    await expect(cancelAtlasJob(db, admin, running.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(running.status).toBe("running");
  });

  it("cancels a pipeline run through its own cancel", async () => {
    const db = world();
    jest.mocked(cancelMapPipelineRun).mockResolvedValue({ cancelled: true });
    const run = seed(db, { kind: "map-pipeline", status: "running" });
    await cancelAtlasJob(db, admin, run.id);
    expect(cancelMapPipelineRun).toHaveBeenCalledWith(db, admin, run.id);
    await expect(cancelAtlasJob(db, admin, "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rolls back through the import service", async () => {
    const db = world();
    await rollbackAtlasImport(db, admin, "imp1");
    expect(rollbackMapImport).toHaveBeenCalledWith(db, admin, "imp1");
  });

  it("reads a realm's latest import still in place", async () => {
    const db = world();
    expect(await latestAtlasImport(db, "a")).toBeNull();
    db.mapImport.rows.push(
      { id: "old", realmId: "a", createdAt: new Date(1), rollbackAvailable: true },
      {
        id: "gone",
        realmId: "a",
        createdAt: new Date(3),
        rollbackAvailable: true,
        rolledBackAt: new Date(4),
      },
      { id: "new", realmId: "a", createdAt: new Date(2), rollbackAvailable: false }
    );
    expect(await latestAtlasImport(db, "a")).toMatchObject({ id: "new", canRollBack: false });
  });
});
