/** @jest-environment node */
/**
 * Scenario: a site admin imports a painted political map into a realm that already has borders, then rolls it back.
 * Real modules throughout: the upload route (the kind read from the bytes), the import router, the job runner with
 * the inline PNG engine (no worker thread), the region mapper's plan, the dry-run plan, the replace-mode write with
 * its snapshot, the map version bump and the rollback. Only the database (map-import-fakes) and Clerk are faked.
 *
 * The map (src/tests/fixtures/map-import-images.ts) is red and green nations sharing a wavy border, one nation painted
 * in yellow and brown, a lake in red, an island and a purple speck in green, anti-aliased with black border lines.
 * Along the way, a stranger is refused at every procedure of the wizard and a georeference that can't be fitted is
 * refused.
 *
 * Folds: src/tests/server/api/routers/geo/map-import-router.test.ts
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
const holder: { db: unknown } = { db: null };
jest.mock("~/server/db", () => ({
  db: new Proxy({}, { get: (_t, name: string) => (holder.db as Record<string, unknown>)[name] }),
}));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
}));
const clerkUser = { id: "admin_1" as string | null };
jest.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerkUser.id }) }));
jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: async () =>
    clerkUser.id === "admin_1"
      ? { userId: "admin_1" }
      : // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require("next/server") as typeof import("next/server")).NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        ),
}));
jest.mock("~/server/modules/maps/map-import.prune", () => ({
  pruneWorldUploadsIfDue: jest.fn().mockResolvedValue(null),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true }), isEnabled: () => false },
}));

import { mkdtempSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Polygon } from "geojson";
import type { NextRequest } from "next/server";
import { POST as upload } from "~/app/api/admin/map-import/upload/route";
import { deltaE2000, hexToRgb, rgbToLab } from "~/lib/maps/import/colour";
import { initialMapping, planRegionMapping } from "~/lib/maps/import/mapping";
import { mapImportOptionsSchema, type ImportRegion } from "~/lib/maps/import/options";
import { runImportEngineInline } from "~/lib/maps/import/run-engine";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorMapImportRouter } from "~/server/api/routers/geo/editor/map-import";
import { runMapImportJob, type AnalyseSummary } from "~/server/modules/maps/map-import.jobs";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, fakeDb, stranger } from "~/tests/server/maps/map-import-fakes";
import { makeBundle } from "~/tests/server/maps/world-import-fixtures";
import {
  BROWN,
  encode,
  GREEN,
  OCEAN,
  paint,
  PURPLE,
  RED,
  YELLOW,
  type Rgb,
} from "~/tests/fixtures/map-import-images";

jest.setTimeout(60_000);

type Db = ReturnType<typeof fakeDb>;
type Row = Record<string, unknown>;

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

/** Eurth with two nations, Borealis's border, a stale Old Kingdom and a lake on another layer. */
function realm(): Db {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r1",
    slug: "eurth",
    name: "Eurth",
    ownerId: "founder_1",
    status: "active",
    settings: {},
    mapVersion: 0,
    officers: [],
  });
  db.user.rows.push({ id: "u_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } });
  db.country.rows.push(
    { id: "c_aur", name: "Aurelia", realmId: "r1", landArea: null, geometry: null },
    { id: "c_bor", name: "Borealis", realmId: "r1", landArea: 51_000, geometry: null }
  );
  const political = (id: string, featureId: string, countryId: string | null, x: number) => ({
    id,
    realmId: "r1",
    layerType: "political",
    featureId,
    displayName: featureId,
    countryId,
    geometry: square(x),
    properties: {},
    isActive: true,
  });
  db.mapLayer.rows.push(
    political("m1", "borealis-key", "c_bor", 10),
    political("m2", "Old Kingdom", null, 90),
    { ...political("m3", "lake-1", null, 100), layerType: "lakes" }
  );
  holder.db = db;
  return db;
}

const importAs = (db: Db, actor: typeof admin) =>
  createCallerFactory(geoEditorMapImportRouter)(
    createMockRouterContext({
      db,
      auth: { userId: actor.clerkUserId },
      user: { ...actor, country: null },
      rateLimitIdentifier: `${actor.clerkUserId}_${Math.random()}`,
    }) as never
  ).mapImport;

async function uploadAs(clerkId: string, bytes: Uint8Array, name: string) {
  clerkUser.id = clerkId;
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], name));
  return upload({
    headers: new Headers({ "content-length": String(bytes.byteLength + 500) }),
    formData: async () => form,
    nextUrl: new URL("https://ixstats.test/api/admin/map-import/upload?realm=r1"),
  } as unknown as NextRequest);
}

/** The region the engine found for a painted colour (ΔE under 12), as the admin picks it by eye. */
const regionOf = (regions: readonly ImportRegion[], rgb: Rgb) =>
  regions.find((r) => r.colour && deltaE2000(rgbToLab(hexToRgb(r.colour)), rgbToLab(rgb)) < 12)!;

/** The realm's map as a rollback must restore it: every feature, active or not, with its border and nation. */
const mapOf = (db: Db) =>
  JSON.stringify(
    (db.mapLayer.rows as Row[])
      .map(({ featureId, layerType, isActive, countryId, geometry }) => ({
        ...{ featureId, layerType, isActive, countryId, geometry },
      }))
      .sort((a, b) => String(a.featureId).localeCompare(String(b.featureId)))
  );

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "scenario-png-"));
  process.env.MAP_IMPORT_DIR = dir;
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterAll(() => {
  jest.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});
// Queueing a job kicks the in-process runner on a timer; no timer fires, so the test runs each job itself
beforeEach(() => jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] }));
afterEach(() => jest.useRealTimers());

describe("an admin imports a painted political map and rolls it back", () => {
  it("traces, maps two colours to one nation, replaces the stale borders and restores the realm exactly", async () => {
    const db = realm();
    const before = mapOf(db);

    // 1. Upload: the PNG is read as a PNG from its bytes, whatever its name; a stranger is refused at the route
    const png = await encode(paint({ antiAlias: true, borders: true }), "png");
    expect((await uploadAs(stranger.clerkUserId, png, "eurth.png")).status).toBe(403);
    const uploaded = await uploadAs(admin.clerkUserId, png, "eurth.geojson");
    expect(uploaded.status).toBe(200);
    const { uploadId, kind } = (await uploaded.json()) as { uploadId: string; kind: "png" };
    expect(kind).toBe("png");

    // The wizard's other procedures are the realm's map staff's too, and a georeference that can't be fitted is refused
    await expect(importAs(db, stranger).context({ realmId: "r1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      importAs(db, stranger).saveGeoreference({ realmId: "r1", georef: { projection: "mercator" } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      importAs(db, admin).previewGeoreference({
        width: 100,
        height: 100,
        georef: {
          controlPoints: [
            { x: 0, y: 0, lon: 0, lat: 0 },
            { x: 0, y: 10, lon: 0, lat: -1 },
            { x: 0, y: 20, lon: 0, lat: -2 },
          ],
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 2. The analysis traces the colours; the speck under 100 px is merged into its neighbour
    const start = { realmId: "r1", uploadId, kind, filename: "eurth.png" };
    const options = mapImportOptionsSchema.parse({ png: { minRegionPixels: 100 } });
    await expect(importAs(db, stranger).start({ ...start, options })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const { jobId: analysisId } = await importAs(db, admin).start({ ...start, options });
    await runMapImportJob(db, analysisId, { runEngine: runImportEngineInline });
    const analysis = await importAs(db, admin).job({ jobId: analysisId });
    expect(analysis.status).toBe("succeeded");
    const { regions, suggestedMapping } = analysis.result as AnalyseSummary;
    expect(regionOf(regions, PURPLE).pixels).toBe(0);

    // 3. The mapper starts with the empty speck left out; the admin leaves out the sea too, and names yellow and
    //    brown both Cyrene, a name the realm does not have yet
    const red = regionOf(regions, RED).key;
    const green = regionOf(regions, GREEN).key;
    const mapper = initialMapping(regions, suggestedMapping);
    expect([...mapper.ignored]).toEqual([regionOf(regions, PURPLE).key]);
    const plan = planRegionMapping(
      regions,
      {
        [red]: "Aurelia",
        [green]: "Borealis",
        [regionOf(regions, YELLOW).key]: "Cyrene",
        [regionOf(regions, BROWN).key]: "Cyrene",
      },
      new Set([...mapper.ignored, regionOf(regions, OCEAN).key])
    );
    expect(plan).toMatchObject({ mapped: 4, ignored: 2, nations: 3, merged: ["Cyrene"] });
    const apply = { mapping: plan.mapping, mode: "replace" as const };

    // 4. The dry run: Old Kingdom goes, Cyrene is a new name, a stated land area is kept; nothing is written
    const preview = await importAs(db, admin).preview({ jobId: analysisId, apply });
    expect(preview.removed).toEqual([
      { key: "Old Kingdom", name: "Old Kingdom", countryName: null },
    ]);
    expect(preview.newNames).toEqual([{ nation: "Cyrene", suggestions: [] }]);
    const byNation = Object.fromEntries(preview.features.map((f) => [f.nation, f]));
    expect(byNation.Borealis).toMatchObject({ key: "borealis-key", status: "changed" });
    expect(byNation.Borealis!.landArea).toMatchObject({ current: 51_000, action: "keep" });
    expect(byNation.Aurelia).toMatchObject({ countryId: "c_aur", status: "new" });
    expect(mapOf(db)).toBe(before);

    // 5. The apply: one border per nation (yellow and brown merged), the stale border retired, the lake untouched
    await expect(
      importAs(db, stranger).applyImport({ jobId: analysisId, apply })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { jobId: applyId } = await importAs(db, admin).applyImport({ jobId: analysisId, apply });
    await runMapImportJob(db, applyId, { runEngine: runImportEngineInline });
    expect(await importAs(db, admin).job({ jobId: applyId })).toMatchObject({
      status: "succeeded",
    });
    const active = (type: string) =>
      (db.mapLayer.rows as Row[]).filter((r) => r.layerType === type && r.isActive);
    expect(
      active("political")
        .map((r) => r.displayName ?? r.featureId)
        .sort()
    ).toEqual(["Aurelia", "Borealis", "Cyrene"]);
    expect(active("lakes")).toHaveLength(1);
    expect(db.country.rows.find((c: Row) => c.id === "c_bor").landArea).toBe(51_000);
    expect(db.country.rows.find((c: Row) => c.id === "c_aur").landArea).toBeGreaterThan(0);
    expect(db.realm.rows[0].mapVersion).toBe(1);

    // 6. The same map planned again changes nothing, though the stored copies were repaired
    const again = await importAs(db, admin).preview({ jobId: analysisId, apply });
    expect(again.features.map((f) => f.status)).toEqual(["unchanged", "unchanged", "unchanged"]);

    // 7. The rollback restores every feature exactly, moves the version again, and runs once
    const { imports } = await importAs(db, admin).context({ realmId: "r1" });
    expect(imports[0]).toMatchObject({ canRollBack: true });
    await expect(
      importAs(db, stranger).rollback({ importId: imports[0]!.id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await importAs(db, admin).rollback({ importId: imports[0]!.id });
    expect(mapOf(db)).toBe(before);
    expect(db.country.rows.find((c: Row) => c.id === "c_aur").landArea).toBeNull();
    expect(db.realm.rows[0].mapVersion).toBe(2);
    await expect(importAs(db, admin).rollback({ importId: imports[0]!.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("never reads a world bundle as a map, and stores no analysis for it", async () => {
    const db = realm();
    const world = gzipSync(JSON.stringify(makeBundle()));
    await expect(
      runImportEngineInline("world", world, mapImportOptionsSchema.parse({}), () => {})
    ).rejects.toThrow(/World tab/);
    const uploaded = await uploadAs(admin.clerkUserId, world, "world.json.gz");
    const { uploadId, kind } = (await uploaded.json()) as { uploadId: string; kind: string };
    expect(kind).toBe("world");
    // queued down the mapped import's path, it is never analysed: the wizard's apply refuses it as a world
    const { jobId } = await importAs(db, admin).start({
      realmId: "r1",
      uploadId,
      kind: "png",
      filename: "x.png",
    });
    await runMapImportJob(db, jobId, { runEngine: runImportEngineInline });
    const job = await importAs(db, admin).job({ jobId });
    expect(job.status).toBe("failed");
    expect(job.result).toBeNull();
  });
});
