/** @jest-environment node */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
}));

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { realmMapPipelineSchema } from "~/lib/maps/realm-map-pipeline";
import { processMapImportQueue, runMapImportJob } from "~/server/modules/maps/map-import.jobs";
import { MapImportError } from "~/server/modules/maps/map-import.realm";
import { saveMapUpload } from "~/server/modules/maps/map-import.storage";
import { artResolver } from "~/server/modules/maps/realm-map-pipeline.art";
import {
  cancelMapPipelineRun,
  getMapPipeline,
  getMapPipelineRun,
  listMapPipelineRuns,
  loadMapPipelinePreset,
  MAP_PIPELINE_CANCEL_ACTION,
  MAP_PIPELINE_PRESET_ACTION,
  MAP_PIPELINE_RUN_ACTION,
  MAP_PIPELINE_SAVED_ACTION,
  saveMapPipeline,
  startMapPipelineRun,
} from "~/server/modules/maps/realm-map-pipeline.config";
import { autoDefaultView } from "~/server/modules/maps/realm-map-pipeline.steps";
import { admin, fakeDb, founder, stranger } from "./map-import-fakes";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "map-pipeline-"));
  process.env.MAP_IMPORT_DIR = path.join(dir, "store");
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

const labels = {
  source: "test",
  labels: [
    { text: "Argic Ocean", kind: "ocean" as const, coordinates: [-33.3, 82.8] as [number, number] },
  ],
};

function setup(settings: object = {}) {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    ownerId: founder.clerkUserId,
    status: "active",
    officers: [],
    settings,
  });
  return db;
}

const withPipeline = (pipeline: object) => ({
  map: { pipeline: realmMapPipelineSchema.parse(pipeline) },
});

describe("map pipeline config", () => {
  it("is for the realm's map editors only", async () => {
    const db = setup();
    await expect(getMapPipeline(db, stranger, "r1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const view = await getMapPipeline(db, founder, "r1");
    expect(view.pipeline).toBeNull();
    expect(view.presets.map((p) => p.id)).toContain("eurth-map");
    expect(view.steps.map((s) => s.step)).toEqual([
      "repair",
      "physical",
      "rasters",
      "labels",
      "flags",
      "defaultView",
      "areas",
    ]);
  });

  it("loads a preset into an empty pipeline, then keeps what the realm has; both audited", async () => {
    const db = setup();
    const first = await loadMapPipelinePreset(db, founder, "r1", "eurth-map");
    expect(first.filled).toContain("rasters");
    const stored = db.realm.rows[0].settings.map.pipeline;
    expect(stored.rasters).toHaveLength(5);
    const again = await loadMapPipelinePreset(db, founder, "r1", "eurth-map");
    expect(again.filled).toEqual([]);
    expect(db.adminAuditLog.rows.map((r: { action: string }) => r.action)).toEqual([
      MAP_PIPELINE_PRESET_ACTION,
      MAP_PIPELINE_PRESET_ACTION,
    ]);
    await expect(loadMapPipelinePreset(db, founder, "r1", "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses to save art whose upload is gone, and keeps the realm's other settings when it saves", async () => {
    const db = setup({ map: { radiusKm: 6000 }, wiki: { source: "iiwiki" } });
    const gone = realmMapPipelineSchema.parse({ art: { geo: { uploadId: "b".repeat(64) } } });
    await expect(saveMapPipeline(db, founder, "r1", gone)).rejects.toThrow(
      /Upload again: the files of geo/
    );
    const uploadId = await saveMapUpload(new Uint8Array([1, 2, 3]));
    const ok = realmMapPipelineSchema.parse({ art: { geo: { uploadId } }, labels });
    await saveMapPipeline(db, founder, "r1", ok);
    expect(db.realm.rows[0].settings).toEqual({
      map: { radiusKm: 6000, pipeline: ok },
      wiki: { source: "iiwiki" },
    });
    expect(db.adminAuditLog.rows.map((r: { action: string }) => r.action)).toEqual([
      MAP_PIPELINE_SAVED_ACTION,
    ]);
  });
});

describe("map pipeline runs", () => {
  const nations = [
    { continent: "Europa", lng: 100, lat: 30, area: 3 },
    { continent: "Europa", lng: 110, lat: 40, area: 1 },
    { continent: "Argis", lng: -20, lat: 60, area: 50 },
  ];

  function runDb(settings: object) {
    const db = setup(settings);
    db.$queryRawUnsafe = jest.fn(async (sql: string) => (sql.includes('"Country"') ? nations : []));
    return db;
  }

  it("refuses to start without a pipeline, and starts one run at a time; audited", async () => {
    await expect(
      startMapPipelineRun(
        setup(),
        founder,
        "r1",
        { steps: ["labels"], dryRun: true },
        { kick: false }
      )
    ).rejects.toThrow(/Set up the map pipeline/);
    const db = setup(withPipeline({ labels }));
    const { jobId } = await startMapPipelineRun(
      db,
      founder,
      "r1",
      { steps: ["labels"], dryRun: true },
      { kick: false }
    );
    expect(db.mapImportJob.rows[0]).toMatchObject({
      id: jobId,
      kind: "map-pipeline",
      dryRun: true,
      options: { steps: ["labels"], dryRun: true },
      requestedBy: founder.clerkUserId,
    });
    expect(db.adminAuditLog.rows[0].action).toBe(MAP_PIPELINE_RUN_ACTION);
    await expect(
      startMapPipelineRun(db, founder, "r1", { steps: ["labels"], dryRun: false }, { kick: false })
    ).rejects.toBeInstanceOf(MapImportError);
  });

  it("a dry run reports each step and writes nothing; an apply writes; a second apply finds nothing to do", async () => {
    const db = runDb(withPipeline({ labels, defaultView: "auto" }));
    const run = async (dryRun: boolean) => {
      const { jobId } = await startMapPipelineRun(
        db,
        admin,
        "r1",
        { steps: ["defaultView", "labels"], dryRun },
        { kick: false }
      );
      expect(await runMapImportJob(db, jobId)).toBe("ran");
      return getMapPipelineRun(db, admin, jobId);
    };

    const dry = await run(true);
    expect(dry.status).toBe("succeeded");
    expect(dry.result?.steps.map((s) => [s.step, s.status])).toEqual([
      ["labels", "would-change"],
      ["defaultView", "would-change"],
    ]);
    expect(db.mapLabel.rows).toHaveLength(0);
    expect(db.realm.rows[0].settings.map.defaultView).toBeUndefined();

    const applied = await run(false);
    expect(applied.result?.steps.map((s) => s.status)).toEqual(["changed", "changed"]);
    expect(db.mapLabel.rows).toHaveLength(1);
    expect(db.realm.rows[0].settings.map.defaultView).toEqual({ center: [102.5, 32.5], zoom: 1.8 });
    expect(db.realm.rows[0].settings.map.pipeline).toBeDefined();

    const again = await run(false);
    expect(again.result?.steps.map((s) => s.status)).toEqual(["unchanged", "unchanged"]);
    db.user.rows.push({ clerkUserId: admin.clerkUserId, forumUsername: "Ixnay", wikiUsername: null });
    const runs = await listMapPipelineRuns(db, admin, "r1");
    expect(runs).toHaveLength(3);
    // Who started each run, by name (the panel shows it), not a raw account id.
    expect(runs[0]!.requestedByName).toBe("Ixnay");
    expect(runs[0]!.results.map((r) => r.status)).toEqual(["unchanged", "unchanged"]);
  });

  it("records a failed step, goes on with the next, and marks the run failed", async () => {
    const db = runDb(
      withPipeline({
        art: { labels: { uploadId: "c".repeat(64) } },
        labels: { art: "labels" },
        defaultView: "auto",
      })
    );
    db.mapImportJob.rows.push({
      id: "jobfail01",
      realmId: "r1",
      kind: "map-pipeline",
      status: "queued",
      dryRun: true,
      options: { steps: ["labels", "defaultView"], dryRun: true },
      requestedBy: "admin_1",
      createdAt: new Date(),
      progress: 0,
    });
    await runMapImportJob(db, "jobfail01");
    const run = await getMapPipelineRun(db, admin, "jobfail01");
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/Map labels: Art "labels": the uploaded file is gone/);
    expect(run.result?.steps.map((s) => s.status)).toEqual(["failed", "would-change"]);
  });

  it("skips the steps the pipeline does not configure", async () => {
    const db = runDb(withPipeline({}));
    const { jobId } = await startMapPipelineRun(
      db,
      admin,
      "r1",
      { steps: ["physical", "rasters", "labels", "flags", "defaultView"], dryRun: true },
      { kick: false }
    );
    await runMapImportJob(db, jobId);
    const run = await getMapPipelineRun(db, admin, jobId);
    expect(run.result?.steps.every((s) => s.status === "skipped")).toBe(true);
  });

  it("cancels a queued run (audited) and keeps pipeline runs out of the web process when cron runs them", async () => {
    const db = setup(withPipeline({ labels }));
    const { jobId } = await startMapPipelineRun(
      db,
      founder,
      "r1",
      { steps: ["labels"], dryRun: false },
      { kick: false }
    );
    await expect(processMapImportQueue(db, { applyOnly: true })).resolves.toMatchObject({ ran: 0 });
    expect(db.mapImportJob.rows[0].status).toBe("queued");
    await cancelMapPipelineRun(db, founder, jobId);
    expect(db.mapImportJob.rows[0].status).toBe("cancelled");
    expect(db.adminAuditLog.rows.at(-1).action).toBe(MAP_PIPELINE_CANCEL_ACTION);
    await expect(cancelMapPipelineRun(db, stranger, jobId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("art", () => {
  it("reads uploads, local checkouts (never outside them) and repository files once each, by content hash", async () => {
    const checkout = path.join(dir, "checkout");
    mkdirSync(path.join(checkout, "maps"), { recursive: true });
    writeFileSync(path.join(checkout, "maps", "geo.png"), "local");
    const uploadId = await saveMapUpload(new TextEncoder().encode("uploaded"));
    const art = {
      geo: { repoPath: "maps/geo.png" },
      up: { uploadId },
      escape: { repoPath: "../store/x" },
    };
    const local = artResolver({ art, repo: null, localDir: checkout });
    expect(new TextDecoder().decode((await local("geo")).bytes)).toBe("local");
    expect((await local("up")).sha256).toBe(uploadId);
    await expect(local("escape")).rejects.toThrow(/outside the checkout/);
    await expect(local("missing")).rejects.toThrow(/No art named "missing"/);

    const fetchBytes = jest.fn().mockResolvedValue(new TextEncoder().encode("remote"));
    const remote = artResolver({ art, repo: { repo: "a/b", ref: "main" }, fetchBytes });
    const first = await remote("geo");
    await remote("geo");
    expect(fetchBytes).toHaveBeenCalledTimes(1);
    expect(fetchBytes.mock.calls[0][0]).toEqual({ repo: "a/b", ref: "main", path: "maps/geo.png" });
    expect(fetchBytes.mock.calls[0][1].maxBytes).toBe(25 * 1024 * 1024);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(artResolver({ art, repo: null })("geo")).rejects.toThrow(/no source repository/);
  });
});

describe("autoDefaultView", () => {
  it("centres on the continent with the most nations, weighted by area, at IxWorld's home zoom", () => {
    expect(
      autoDefaultView([
        { continent: "Europa", lng: 100, lat: 30, area: 3 },
        { continent: "Europa", lng: 110, lat: 40, area: 1 },
        { continent: "Argis", lng: -20, lat: 60, area: 50 },
      ])
    ).toEqual({ view: { center: [102.5, 32.5], zoom: 1.8 }, continent: "Europa", nations: 2 });
  });

  it("averages a continent across ±180° on its own side, and takes every nation when none has a continent", () => {
    const view = autoDefaultView([
      { continent: null, lng: 179, lat: 0, area: 1 },
      { continent: null, lng: -179, lat: 0, area: 1 },
    ]);
    expect(Math.abs(view!.view.center[0])).toBe(180);
    expect(view!.continent).toBeNull();
    expect(autoDefaultView([])).toBeNull();
  });
});
