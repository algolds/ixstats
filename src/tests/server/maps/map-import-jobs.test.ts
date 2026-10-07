/** @jest-environment node */
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
  cancelMapImportJob,
  getMapImportJob,
  mapImportLockName,
  processMapImportQueue,
  recoverStaleMapImports,
  runMapImportJob,
  startMapImport,
  startMapImportApply,
  STALE_AFTER_MS,
  type AnalyseSummary,
  type ApplySummary,
} from "~/server/modules/maps/map-import.jobs";
import { MapImportError } from "~/server/modules/maps/map-import.realm";
import { MAX_MAP_IMPORT_BYTES, type EngineResult } from "~/lib/maps/import/options";
import { admin, fakeDb, founder, stranger } from "./map-import-fakes";

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

const square = (x: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x, 0],
      [x + 10, 0],
      [x + 10, 10],
      [x, 10],
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

describe("map import jobs: lifecycle", () => {
  it("queues an analysis, runs it off the request and stores its summary", async () => {
    const { db, runEngine } = setup();
    const jobId = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "geojson", bytes, filename: "eurth.geojson" },
        requestedBy: "admin_1",
      },
      { db, kick: false, runEngine }
    );
    expect(db.mapImportJob.rows[0]).toMatchObject({
      id: jobId,
      status: "queued",
      dryRun: true,
      kind: "geojson",
    });
    expect(db.mapImportJob.rows[0].uploadId).toMatch(/^[0-9a-f]{64}$/);

    expect(await runMapImportJob(db, jobId, { runEngine })).toBe("ran");
    const job = await getMapImportJob(db, admin, jobId);
    expect(job.status).toBe("succeeded");
    expect(job.progress).toBe(100);
    const summary = job.result as AnalyseSummary;
    expect(summary.phase).toBe("analyse");
    // Names matched to the realm: a country and a roster page.
    expect(summary.suggestedMapping).toEqual({ Aurelia: "Aurelia", Borealis: "Borealis" });
    expect(runEngine).toHaveBeenCalledTimes(1);
  });

  it("applies an analysis: writes the borders, keeps a snapshot and fills only a missing land area", async () => {
    const { db, runEngine } = setup();
    const jobId = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "geojson", bytes, filename: "eurth.geojson" },
        requestedBy: "admin_1",
      },
      { db, kick: false, runEngine }
    );
    await runMapImportJob(db, jobId, { runEngine });
    const applyId = await startMapImportApply(
      db as never,
      admin,
      jobId,
      { mapping: { Aurelia: "Aurelia", Borealis: "Borealis" } },
      { kick: false }
    );
    expect(await runMapImportJob(db, applyId)).toBe("ran");
    const job = await getMapImportJob(db, admin, applyId);
    expect(job.error).toBeNull();
    const summary = job.result as ApplySummary;
    expect(summary).toMatchObject({ phase: "apply", written: 2, nations: 2, deactivated: 0 });
    expect(summary.landAreasFilled).toEqual(["Aurelia"]);
    const aurelia = db.mapLayer.rows.find((r: { featureId: string }) => r.featureId === "Aurelia");
    expect(aurelia).toMatchObject({ countryId: "c_aur", displayName: "Aurelia", isActive: true });
    // The realm's planet is half Earth's radius: areas are a quarter of Earth's.
    const area = db.country.rows[0].landArea;
    expect(area).toBeGreaterThan(0);
    expect(db.mapImport.rows).toHaveLength(1);
    expect(db.mapImport.rows[0]).toMatchObject({ rollbackAvailable: true, mode: "merge" });
    expect(db.mapImport.rows[0].snapshot).toBeInstanceOf(Uint8Array);
  });

  it("runs one job per realm at a time: a job whose realm lease is held stays queued", async () => {
    const { db, runEngine } = setup();
    const jobId = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "geojson", bytes, filename: "a.geojson" },
        requestedBy: "admin_1",
      },
      { db, kick: false }
    );
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
    const queued = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "geojson", bytes, filename: "a.geojson" },
        requestedBy: "admin_1",
      },
      { db, kick: false }
    );
    await cancelMapImportJob(db as never, admin, queued);
    expect(db.mapImportJob.rows[0].status).toBe("cancelled");
    await expect(cancelMapImportJob(db as never, admin, queued)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const running = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "geojson", bytes, filename: "b.geojson" },
        requestedBy: "admin_1",
      },
      { db, kick: false }
    );
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

describe("map import jobs: who may see and apply them", () => {
  it("lets the founder in and keeps other players out", async () => {
    const { db, runEngine } = setup();
    const jobId = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "geojson", bytes, filename: "a.geojson" },
        requestedBy: "founder_1",
      },
      { db, kick: false, runEngine }
    );
    await expect(getMapImportJob(db, founder, jobId)).resolves.toMatchObject({ id: jobId });
    await expect(getMapImportJob(db, stranger, jobId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await runMapImportJob(db, jobId, { runEngine });
    await expect(
      startMapImportApply(db as never, stranger, jobId, { mapping: {} }, { kick: false })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
