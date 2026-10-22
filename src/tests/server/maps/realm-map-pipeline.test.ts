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
jest.mock("~/server/modules/maps/realm-relief", () => ({
  planRealmRelief: jest.fn().mockResolvedValue(null),
  applyRealmRelief: jest.fn(),
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
  getMapPipelineRun,
  listMapPipelineRuns,
  MAP_PIPELINE_CANCEL_ACTION,
  MAP_PIPELINE_RUN_ACTION,
  startMapPipelineRun,
} from "~/server/modules/maps/realm-map-pipeline.config";
import { admin, fakeDb, founder, stranger } from "./map-import-fakes";
import type { Polygon } from "geojson";
import type { LayerEngineResult, LayerFeature } from "~/lib/maps/import/png/layer-engine";
import type { StepContext } from "~/server/modules/maps/realm-map-pipeline.context";
import { runPhysicalStep } from "~/server/modules/maps/realm-map-pipeline.physical";
import type { Geometry, Position } from "geojson";
import { measureRealm } from "~/server/modules/maps/realm-calibration";
import { realmLabelSeedFileSchema } from "~/lib/maps/realm-labels";
import { seedRealmLabels } from "~/server/modules/maps/realm-labels";
import type { PrismaClient } from "@prisma/client";
import { runReliefStep } from "~/server/modules/maps/realm-map-pipeline.relief";
import {
  applyRealmRelief,
  planRealmRelief,
  type ReliefPlan,
} from "~/server/modules/maps/realm-relief";

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
    db.user.rows.push({
      clerkUserId: admin.clerkUserId,
      forumUsername: "Ixnay",
      wikiUsername: null,
    });
    const runs = await listMapPipelineRuns(db, admin, "r1");
    expect(runs).toHaveLength(3);
    // Who started each run, by name (the panel shows it), not a raw account id.
    expect(runs[0]!.requestedByName).toBe("Ixnay");
    expect(runs[0]!.results.map((r) => r.status)).toEqual(["unchanged", "unchanged"]);
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

/**
 * The pipeline's `physical` step compares each traced layer with the realm's stored features exactly as the writer
 * would store them, so a dry run says what an apply would do: features stored as traced are unchanged, a stored
 * feature drawn differently is changed, a traced one the realm lacks is new, a stored one no longer traced is retired. A dry run only reports.
 */
describe("the physical step", () => {
  const triangle = (size: number): LayerFeature["geometry"] => ({
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [size, 0],
        [size, size],
        [0, 0],
      ],
    ],
  });
  /** The row the writer stores for a traced feature. */
  const storedRow = (key: string, size = 1) => ({
    featureId: key,
    displayName: `Zone ${key}`,
    properties: { band: key, name: `Zone ${key}` },
    // The writer stores a polygon as a multipolygon
    geometry: { type: "MultiPolygon", coordinates: [(triangle(size) as Polygon).coordinates] },
  });
  function dryRun(features: LayerFeature[], stored: object[], cap = Infinity) {
    const result: LayerEngineResult = {
      width: 2,
      height: 2,
      log: [],
      layers: { altitudes: features },
    };
    const ctx: StepContext = {
      db: {
        realm: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
        // Like the guarded client: a findMany with no `take` answers at most 1000 rows
        mapLayer: {
          findMany: jest.fn(async ({ take }: { take?: number } = {}) =>
            stored.slice(0, take ?? cap)
          ),
        },
      } as never,
      realm: { id: "r1", slug: "eurth", name: "Eurth" },
      pipeline: realmMapPipelineSchema.parse({
        art: { geo: { uploadId: "a".repeat(64) } },
        physical: { land: "geo" },
      }),
      dryRun: true,
      art: jest.fn().mockResolvedValue({ bytes: new Uint8Array([1]) }),
      requestedBy: "founder_1",
      actor: founder,
      jobId: null,
      progress: jest.fn(),
      isCancelled: () => false,
      deps: { runLayerEngine: jest.fn().mockResolvedValue(result) },
    };
    return runPhysicalStep(ctx);
  }
  describe("past the guarded client's 1000-row cap", () => {
    it("retires every stored feature the layer no longer has (Ixnay has 4068 altitude bands)", async () => {
      const stored = Array.from({ length: 1001 }, (_, i) => storedRow(`band_${i}`));
      const report = await dryRun([], stored, 1000);
      expect(report.counts).toMatchObject({ changes: 1001 });
    });
  });
});

/**
 *
 *
 * A realm's stored map measured for World Studio's Calibration tab: read from the `geometry` JSON (a polygon across
 * the antimeridian measures as itself), Koppen and Trewartha realms alike, cached per map version, and a reason
 * instead of a throw when there is nothing to measure.
 */
describe("measuring a realm", () => {
  const box = (west: number, south: number, east: number, north: number): Position[] => [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
  const polygon = (...rings: Position[][]): Geometry => ({ type: "Polygon", coordinates: rings });
  let seq = 0;
  function seed(
    layers: {
      layerType: string;
      geometry: Geometry | null;
      properties?: object;
      isActive?: boolean;
    }[],
    settings: object | null = null
  ) {
    const db = fakeDb();
    const id = `realm_${++seq}`;
    db.realm.rows.push({ id, slug: `slug-${seq}`, name: `Realm ${seq}`, mapVersion: 7, settings });
    layers.forEach((layer, i) =>
      db.mapLayer.rows.push({
        realmId: id,
        featureId: `f${i}`,
        properties: {},
        isActive: true,
        ...layer,
      })
    );
    return { db, id, slug: `slug-${seq}` };
  }
  describe("measureRealm", () => {
    it("reads an antimeridian-crossing polygon from its geometry JSON as the strip it is", async () => {
      const { db, id } = seed([
        {
          layerType: "political",
          geometry: polygon([
            [170, -5],
            [-170, -5],
            [-170, 5],
            [170, 5],
            [170, -5],
          ]),
        },
      ]);
      const result = await measureRealm(db, id);
      if (!result.ok) throw new Error("expected a measurement");
      // 20 x 10 degrees at the equator: about 0.48% of the globe and 2.5 million km2
      expect(result.measures.landShare).toBeCloseTo(0.00484, 3);
      expect(result.measures.nations.medianKm2).toBeGreaterThan(2.4e6);
      expect(result.measures.nations.medianKm2).toBeLessThan(2.55e6);
    });
    it("prefers a realm whose id is the name when another realm's slug is the same", async () => {
      const { db, id } = seed([{ layerType: "political", geometry: polygon(box(0, 0, 10, 10)) }]);
      db.realm.rows.unshift({
        id: "other",
        slug: id,
        name: "Other",
        mapVersion: 1,
        settings: null,
      });
      const result = await measureRealm(db, id);
      if (!result.ok) throw new Error("expected a measurement");
      expect(result.realm.id).toBe(id);
    });
    it("refuses to measure a partial map when the realm holds more rows than it reads", async () => {
      const { db, id } = seed([{ layerType: "political", geometry: polygon(box(0, 0, 10, 10)) }]);
      const rows = db.mapLayer.rows.slice();
      db.mapLayer.findMany.mockImplementationOnce(async ({ take }: { take: number }) =>
        Array.from({ length: take }, (_, i) => ({ ...rows[0], featureId: `f${i}` }))
      );
      const result = await measureRealm(db, id);
      expect(result).toEqual({ ok: false, reason: expect.stringMatching(/too many|more than/i) });
    });
  });
});

describe("seeding a realm's labels", () => {
  interface Row {
    id: string;
    text: string;
    labelType: string;
    coordinates: [number, number];
    metadata: { rank?: string; seedKey?: string } | null;
  }
  function fakeDb(rows: Row[]) {
    return {
      mapLabel: {
        findMany: jest.fn(async () => rows),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
      },
    };
  }
  const ENTRIES = realmLabelSeedFileSchema.parse({
    source: "test",
    labels: [
      { key: "Argic Ocean (west)", text: "Argic Ocean", kind: "ocean", coordinates: [-33.3, 82.8] },
      { text: "Auraid Bay", kind: "sea", rank: "minor", coordinates: [6.75, 38.4] },
      { text: "Kosscow Sea", kind: "sea", coordinates: [99.45, 61.43] },
    ],
  }).labels;
  describe("seeding a realm's labels", () => {
    it("is idempotent: matches by key (or by name for a hand-made label), updates only what changed", async () => {
      const db = fakeDb([
        {
          id: "a",
          text: "Argic Ocean",
          labelType: "ocean",
          coordinates: [-33.3, 82.8],
          metadata: { rank: "major", seedKey: "Argic Ocean (west)" },
        },
        {
          id: "b",
          text: "Auraid Bay",
          labelType: "sea",
          coordinates: [6, 38],
          metadata: { rank: "minor", seedKey: "Auraid Bay" },
        },
        {
          id: "c",
          text: "Kosscow Sea",
          labelType: "sea",
          coordinates: [99.45, 61.43],
          metadata: null,
        },
      ]);
      const report = await seedRealmLabels(db as never, "realm_1", ENTRIES, {
        apply: true,
        submittedBy: "script",
      });
      expect(report).toEqual({ created: [], updated: ["Auraid Bay", "Kosscow Sea"], unchanged: 1 });
      expect(db.mapLabel.create).not.toHaveBeenCalled();
      expect(db.mapLabel.update.mock.calls).toEqual([
        [
          {
            where: { id: "b" },
            data: {
              text: "Auraid Bay",
              labelType: "sea",
              coordinates: [6.75, 38.4],
              metadata: { rank: "minor", seedKey: "Auraid Bay" },
            },
          },
        ],
        [
          {
            where: { id: "c" },
            data: {
              text: "Kosscow Sea",
              labelType: "sea",
              coordinates: [99.45, 61.43],
              metadata: { rank: "medium", seedKey: "Kosscow Sea" },
            },
          },
        ],
      ]);
    });
  });
});

/**
 *
 *
 * The map pipeline's `relief` step: it plans the realm's relief from its stored altitude bands, reports what an
 * apply would change on a dry run (writing nothing), builds on an apply, and skips a realm with no bands.
 */
describe("the relief step", () => {
  const plan = (over: Partial<ReliefPlan> = {}): ReliefPlan => ({
    entry: {
      id: "relief",
      label: "Relief",
      kind: "overlay",
      version: "0123456789abcdef",
      maxZoom: 5,
      order: 10,
    },
    image: new Uint8Array(),
    built: false,
    changed: true,
    previous: undefined,
    ...over,
  });
  const db = {} as PrismaClient;
  function context(dryRun: boolean): StepContext {
    return {
      db,
      realm: { id: "r1", slug: "ixnay", name: "Ixnay" },
      pipeline: realmMapPipelineSchema.parse({}),
      dryRun,
      art: async () => ({ bytes: new Uint8Array(), sha256: "" }),
      requestedBy: "script:test",
      actor: { id: "script:test", clerkUserId: "script:test", role: { name: "system", level: 0 } },
      jobId: null,
      progress: jest.fn(),
      isCancelled: () => false,
      deps: {},
    };
  }
  beforeEach(() => jest.clearAllMocks());
  describe("runReliefStep", () => {
    it("only reports on a dry run: tiles to build, or just the entry to record", async () => {
      jest.mocked(planRealmRelief).mockResolvedValue(plan());
      const build = await runReliefStep(context(true));
      expect(build).toMatchObject({ status: "would-change" });
      expect(build.summary).toMatch(/tiles to build/);

      jest.mocked(planRealmRelief).mockResolvedValue(plan({ built: true }));
      const record = await runReliefStep(context(true));
      expect(record).toMatchObject({ status: "would-change" });
      expect(record.summary).toMatch(/entry changes/);
      expect(applyRealmRelief).not.toHaveBeenCalled();
    });
  });
});
