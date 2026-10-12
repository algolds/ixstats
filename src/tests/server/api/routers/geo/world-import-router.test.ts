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

import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorMapImportRouter } from "~/server/api/routers/geo/editor/map-import";
import { buildRealmRelief } from "~/server/modules/maps/realm-relief";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { admin, founder, stranger } from "~/tests/server/maps/map-import-fakes";
import { seedRealm } from "~/tests/server/maps/world-import-fixtures";

const UPLOAD = "a".repeat(64);

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
    expect(db.mapImportJob.rows).toHaveLength(0);
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
