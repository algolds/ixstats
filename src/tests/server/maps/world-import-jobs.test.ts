/** @jest-environment node */
/**
 * The `world` kind in the map import job runner: the dry run job, the apply job queued from it, and what each leaves
 * in the job's result; and the relief rebuild under the realm's lease.
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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  getMapImportJob,
  mapImportLockName,
  previewMapImport,
  rebuildWorldRelief,
  runMapImportJob,
  startMapImport,
  startMapImportApply,
  startWorldApply,
  type ApplySummary,
} from "~/server/modules/maps/map-import.jobs";
import type {
  WorldApplySummary,
  WorldDryRunSummary,
  ReliefRunner,
} from "~/server/modules/maps/world-import";
import { admin, founder, stranger } from "./map-import-fakes";
import { makeBundle, seedRealm, slot, storeBundle } from "./world-import-fixtures";

const held = new Set<string>();
(globalThis as { heldLeases?: Set<string> }).heldLeases = held;

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-jobs-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});
afterEach(() => held.clear());

const runRelief: jest.MockedFunction<ReliefRunner> = jest.fn();
beforeEach(() => {
  runRelief.mockReset();
  runRelief.mockResolvedValue({
    id: "relief",
    label: "Relief",
    kind: "overlay",
    version: "v1",
    maxZoom: 5,
    built: true,
    tiles: 7,
    skipped: 0,
  });
});

/** Queue a dry run of a world as `requestedBy` would, and run it. */
async function dryRun(
  db: ReturnType<typeof seedRealm>,
  uploadId: string,
  requestedBy = "founder_1"
) {
  const jobId = await startMapImport(
    { realmId: "r1", source: { kind: "world", uploadId, filename: "world.json.gz" }, requestedBy },
    { db, kick: false }
  );
  await runMapImportJob(db, jobId, { world: { runRelief } });
  return jobId;
}

describe("a world through the job runner", () => {
  it("runs the dry run, then the apply job queued from it", async () => {
    const db = seedRealm();
    const uploadId = await storeBundle(makeBundle());
    const dryId = await dryRun(db, uploadId);

    const checked = await getMapImportJob(db, founder, dryId);
    expect(checked).toMatchObject({
      kind: "world",
      status: "succeeded",
      dryRun: true,
      error: null,
    });
    const diff = checked.result as WorldDryRunSummary;
    expect(diff).toMatchObject({
      phase: "world-dry-run",
      slots: { create: 3, retire: 1 },
      layers: { political: { create: 3 } },
    });
    expect(db.country.rows).toHaveLength(4); // the dry run wrote nothing

    const applyId = await startWorldApply(db, founder, dryId, { db, kick: false });
    expect(db.mapImportJob.rows.find((j: { id: string }) => j.id === applyId)).toMatchObject({
      kind: "world",
      dryRun: false,
      parentJobId: dryId,
      uploadId,
      requestedBy: "founder_1",
    });
    await runMapImportJob(db, applyId, { world: { runRelief } });

    const applied = await getMapImportJob(db, founder, applyId);
    expect(applied).toMatchObject({ status: "succeeded", error: null });
    expect(applied.result).toMatchObject({
      phase: "world-apply",
      slots: { created: 3, retired: 1, opened: 3 },
      relief: { status: "built", tiles: 7 },
    });
    expect(db.country.rows).toHaveLength(6);
    expect(runRelief).toHaveBeenCalledTimes(1);
    expect(db.mapImport.rows[0]).toMatchObject({ jobId: applyId });
  });

  it("marks a dry run of a bundle that cannot be applied as failed, with every reason", async () => {
    const db = seedRealm();
    const bundle = makeBundle({ slots: [slot(1, { gdpPerCapita: 99_999 })] });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const dryId = await dryRun(db, await storeBundle(bundle));
    error.mockRestore();
    const job = await getMapImportJob(db, founder, dryId);
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/The bundle can't be applied. Nation 1: GDP per capita 99,999/);
    expect(db.country.rows).toHaveLength(4);
  });

  it("fails an apply job whose realm was claimed meanwhile, changing nothing", async () => {
    const db = seedRealm();
    const dryId = await dryRun(db, await storeBundle(makeBundle()));
    const applyId = await startWorldApply(db, founder, dryId, { db, kick: false });
    db.realmClaim.rows.push({ id: "q_new", realmId: "r1", countryId: null, status: "pending" });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await runMapImportJob(db, applyId, { world: { runRelief } });
    error.mockRestore();
    const job = await getMapImportJob(db, founder, applyId);
    expect(job).toMatchObject({ status: "failed" });
    expect(job.error).toMatch(/locked/);
    expect(db.country.rows).toHaveLength(4);
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("keeps a succeeded job whose relief step failed, and says which step", async () => {
    const db = seedRealm();
    runRelief.mockRejectedValue(new Error("out of memory"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const dryId = await dryRun(db, await storeBundle(makeBundle()));
    const applyId = await startWorldApply(db, founder, dryId, { db, kick: false });
    await runMapImportJob(db, applyId, { world: { runRelief } });
    error.mockRestore();
    const job = await getMapImportJob(db, founder, applyId);
    expect(job.status).toBe("succeeded");
    expect((job.result as WorldApplySummary).relief).toMatchObject({
      status: "failed",
      error: "out of memory",
    });
  });
});

describe("queueing a world apply", () => {
  it("needs a finished world check, and the person to be allowed", async () => {
    const db = seedRealm();
    const uploadId = await storeBundle(makeBundle());
    const queued = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "world", uploadId, filename: "w.gz" },
        requestedBy: "founder_1",
      },
      { db, kick: false }
    );
    await expect(startWorldApply(db, founder, queued, { db, kick: false })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(startWorldApply(db, founder, "nope", { db, kick: false })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await runMapImportJob(db, queued, { world: { runRelief } });
    await expect(startWorldApply(db, stranger, queued, { db, kick: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await startWorldApply(db, admin, queued, { db, kick: false })).toBeTruthy();
  });

  it("is refused while a claim locks the realm", async () => {
    const db = seedRealm();
    const dryId = await dryRun(db, await storeBundle(makeBundle()));
    db.realmClaim.rows.push({ id: "q_live", realmId: "r1", countryId: null, status: "approved" });
    await expect(startWorldApply(db, founder, dryId, { db, kick: false })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("is not a mapped import: the wizard's apply and preview refuse a world", async () => {
    const db = seedRealm();
    const dryId = await dryRun(db, await storeBundle(makeBundle()));
    await expect(
      startMapImportApply(db, founder, dryId, { mapping: {} }, { db, kick: false })
    ).rejects.toThrow(/own apply/);
    await expect(previewMapImport(db, founder, dryId, { mapping: {} })).rejects.toThrow(
      /check result/
    );
    // and a world apply is not a mapped apply summary
    const job = await getMapImportJob(db, founder, dryId);
    expect((job.result as ApplySummary | WorldDryRunSummary).phase).toBe("world-dry-run");
  });
});

describe("rebuildWorldRelief", () => {
  it("rebuilds from the bands under the realm's lease, for the people who may apply a world", async () => {
    const db = seedRealm();
    await expect(
      rebuildWorldRelief(db, stranger, "r1", { world: { runRelief } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const out = await rebuildWorldRelief(db, founder, "r1", { world: { runRelief } });
    expect(out).toMatchObject({ source: "bands", version: "v1", tiles: 7 });
    expect(held.size).toBe(0); // the lease is released
  });

  it("works in a realm locked by claims, since it leaves the nations alone", async () => {
    const db = seedRealm();
    db.realmClaim.rows.push({ id: "q_live", realmId: "r1", countryId: null, status: "approved" });
    expect(await rebuildWorldRelief(db, founder, "r1", { world: { runRelief } })).toBeTruthy();
  });

  it("is refused for Ixnay and archived realms, and while another import of the realm runs", async () => {
    const ixnay = seedRealm({ id: "default", slug: "ixnay" });
    await expect(
      rebuildWorldRelief(ixnay, admin, "default", { world: { runRelief } })
    ).rejects.toThrow(/Ixnay/);
    const archived = seedRealm({ status: "archived" });
    await expect(
      rebuildWorldRelief(archived, founder, "r1", { world: { runRelief } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const busy = seedRealm();
    held.add(mapImportLockName("r1"));
    await expect(
      rebuildWorldRelief(busy, founder, "r1", { world: { runRelief } })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(runRelief).not.toHaveBeenCalled();
  });
});
