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
  listAtlasJobs,
  retryAtlasJob,
} from "~/server/modules/maps/atlas-jobs";
import { saveImportResult, saveMapUpload } from "~/server/modules/maps/map-import.storage";
import { startMapPipelineRun } from "~/server/modules/maps/realm-map-pipeline.config";
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
});
