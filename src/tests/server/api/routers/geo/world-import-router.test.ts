/** @jest-environment node */
/**
 * geoEditor.mapImport's world procedures: who may start a world, queue its apply and rebuild its relief.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
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
import { mapImportOptionsSchema } from "~/lib/maps/import/options";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorMapImportRouter } from "~/server/api/routers/geo/editor/map-import";
import { buildRealmRelief } from "~/server/modules/maps/realm-relief";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, founder, stranger } from "~/tests/server/maps/map-import-fakes";
import {
  CHECK_ID,
  makeBundle,
  seedRealm,
  storeBundle,
} from "~/tests/server/maps/world-import-fixtures";

const UPLOAD = "a".repeat(64);

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-router-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});
// Queueing a job kicks the in-process runner on a timer: no timer fires, so no job runs after the test
beforeEach(() => jest.useFakeTimers());
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

describe("geoEditor.mapImport.start for a world", () => {
  const input = (realmId = "r1") => ({
    realmId,
    uploadId: UPLOAD,
    kind: "world" as const,
    filename: "world.json.gz",
  });

  it("keeps the map version the draft was fitted to with the world check, and takes only a whole number", async () => {
    const { api, db } = caller(founder, { mapVersion: 3 });
    // the kicked runner is not wanted here: only the stored job is looked at
    const uploadId = await storeBundle(makeBundle());
    const { jobId } = await api.start({ ...input(), uploadId, fittedMapVersion: 3 });
    expect(
      db.mapImportJob.rows.find((job: { id: string }) => job.id === jobId).options
    ).toMatchObject({
      fittedMapVersion: 3,
    });
    await expect(api.start({ ...input(), uploadId, fittedMapVersion: -1 })).rejects.toThrow();
    await expect(api.start({ ...input(), uploadId, fittedMapVersion: 1.5 })).rejects.toThrow();
  });

  it("keeps other players out", async () => {
    await expect(caller(stranger).api.start(input())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never generates Ixnay, even for a site admin", async () => {
    const { api } = caller(admin, { id: "default", slug: "ixnay" });
    await expect(api.start(input("default"))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Ixnay"),
    });
  });

  it("refuses an archived realm and one locked by a claim", async () => {
    await expect(caller(founder, { status: "archived" }).api.start(input())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const { api, db } = caller(founder);
    db.realmClaim.rows.push({ id: "q", realmId: "r1", countryId: null, status: "pending" });
    await expect(api.start(input())).rejects.toMatchObject({ code: "CONFLICT" });
    // only the finished check the realm was seeded with: no job was queued
    expect(db.mapImportJob.rows.map((job: { id: string }) => job.id)).toEqual([CHECK_ID]);
  });
});

describe("geoEditor.mapImport.start with a layer choice", () => {
  const input = (realmId = "r1") => ({
    realmId,
    uploadId: "",
    kind: "world" as const,
    filename: "world.json.gz",
    options: { layers: ["rivers" as const, "altitudes" as const] },
    fittedMapVersion: 0,
  });
  const upload = () => storeBundle(makeBundle({ source: "realm-map" }));
  const jobOptions = (db: ReturnType<typeof seedRealm>, jobId: string) =>
    db.mapImportJob.rows.find((job: { id: string }) => job.id === jobId).options;

  it("stores the choice in the check's options, and it parses back typed (the retry)", async () => {
    const { api, db } = caller(admin);
    const { jobId } = await api.start({ ...input(), uploadId: await upload() });
    const stored = jobOptions(db, jobId);
    expect(stored).toMatchObject({ layers: ["rivers", "altitudes"], fittedMapVersion: 0 });
    expect(mapImportOptionsSchema.parse(stored).layers).toEqual(["rivers", "altitudes"]);
  });

  it("lets a site admin choose layers on Ixnay, under a pending claim", async () => {
    const { api, db } = caller(admin, { id: "default", slug: "ixnay" });
    db.realmClaim.rows.push({ id: "q", realmId: "default", countryId: null, status: "pending" });
    await expect(api.start({ ...input("default"), uploadId: await upload() })).resolves.toEqual({
      jobId: expect.any(String),
    });
  });

  it("refuses a founder's layer choice, a layer choice on a file that is not a world, and bad layers", async () => {
    const uploadId = await upload();
    await expect(caller(founder).api.start({ ...input(), uploadId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller(admin).api.start({ ...input(), uploadId, kind: "png" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(admin).api.start({
        ...input(),
        uploadId,
        options: { layers: ["political"] } as never,
      })
    ).rejects.toThrow();
    await expect(
      caller(admin).api.start({ ...input(), uploadId, options: { layers: [] } })
    ).rejects.toThrow();
  });

  it("still refuses Ixnay for a founder's or an admin's world with no layer choice", async () => {
    const { api } = caller(admin, { id: "default", slug: "ixnay" });
    await expect(
      api.start({ ...input("default"), options: undefined, uploadId: await upload() })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("queues the apply with the choice and nothing else of the check's options", async () => {
    const { api, db } = caller(admin, { id: "default", slug: "ixnay" });
    db.realmClaim.rows.push({ id: "q", realmId: "default", countryId: null, status: "pending" });
    db.mapImportJob.rows[0].realmId = "default";
    db.mapImportJob.rows[0].options = { layers: ["lakes"], fittedMapVersion: 0, png: {} };
    const { jobId } = await api.applyWorld({ jobId: CHECK_ID });
    expect(jobOptions(db, jobId)).toEqual({ layers: ["lakes"] });
  });

  it("refuses a founder the apply of an admin's layer choice, and Ixnay's apply without one", async () => {
    const { api, db } = caller(founder);
    db.mapImportJob.rows[0].options = { layers: ["lakes"] };
    await expect(api.applyWorld({ jobId: CHECK_ID })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const ixnay = caller(admin, { id: "default", slug: "ixnay" });
    ixnay.db.mapImportJob.rows[0].realmId = "default";
    await expect(ixnay.api.applyWorld({ jobId: CHECK_ID })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("geoEditor.mapImport.applyWorld", () => {
  it("needs a world check that finished, and the person to be allowed", async () => {
    const { api, db } = caller(founder);
    await expect(api.applyWorld({ jobId: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    db.mapImportJob.rows.push(
      { id: "j_png", realmId: "r1", kind: "png", dryRun: true, status: "succeeded" },
      { id: "j_wait", realmId: "r1", kind: "world", dryRun: true, status: "running" }
    );
    await expect(api.applyWorld({ jobId: "j_png" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(api.applyWorld({ jobId: "j_wait" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("queues the apply of a check of the map as it is, and refuses one of a map that moved since", async () => {
    const { api, db } = caller(founder, { mapVersion: 3 });
    await expect(api.applyWorld({ jobId: CHECK_ID })).resolves.toEqual({
      jobId: expect.any(String),
    });
    db.realm.rows[0].mapVersion = 4;
    await expect(api.applyWorld({ jobId: CHECK_ID })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The map changed since the check. Check the world again.",
    });
  });

  it("keeps other players out of a world that exists", async () => {
    const { api, db } = caller(stranger);
    db.mapImportJob.rows.push({
      id: "j_ok",
      realmId: "r1",
      kind: "world",
      dryRun: true,
      status: "succeeded",
    });
    await expect(api.applyWorld({ jobId: "j_ok" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("geoEditor.mapImport.rebuildRelief", () => {
  beforeEach(() => jest.mocked(buildRealmRelief).mockClear());

  it("builds the relief for a realm's map editors and reports where the heights came from", async () => {
    const { api } = caller(founder);
    expect(await api.rebuildRelief({ realmId: "r1" })).toEqual({
      source: "bands",
      version: "v9",
      built: true,
      tiles: 4,
    });
    expect(buildRealmRelief).toHaveBeenCalledWith(expect.anything(), "r1", { bands: true });
  });

  it("keeps other players out, and refuses Ixnay", async () => {
    await expect(caller(stranger).api.rebuildRelief({ realmId: "r1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller(admin, { id: "default", slug: "ixnay" }).api.rebuildRelief({ realmId: "default" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(buildRealmRelief).not.toHaveBeenCalled();
  });
});
