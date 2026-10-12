/** @jest-environment node */
/** atlas.realms, atlas.jobs and atlas.health: site admins only, and the happy path of each. */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/maps/realm-map-pipeline.config", () => ({
  startMapPipelineRun: jest.fn(),
  cancelMapPipelineRun: jest.fn(),
}));
jest.mock("~/server/modules/maps/map-import.history", () => ({
  rollbackMapImport: jest.fn(async () => ({ restored: 0 })),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { atlasRouter } from "~/server/api/routers/atlas";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { atlasFakeDb } from "~/tests/server/maps/atlas-fakes";
import { admin, founder } from "~/tests/server/maps/map-import-fakes";

function caller(user: typeof admin, db = atlasFakeDb()) {
  return createCallerFactory(atlasRouter)(
    createMockRouterContext({
      db,
      auth: { userId: user.clerkUserId },
      user: { ...user, country: null },
    }) as never
  );
}

function seeded() {
  const db = atlasFakeDb();
  db.realm.rows.push({
    id: "a",
    slug: "alpha",
    name: "Alpha",
    ownerId: "o",
    status: "active",
    visibility: "public",
    mapVersion: 5,
    settings: null,
  });
  db.mapImportJob.rows.push({
    id: "job00000001",
    realmId: "a",
    kind: "png",
    status: "failed",
    dryRun: true,
    uploadId: null,
    createdAt: new Date(1000),
    options: {},
    result: null,
  });
  return db;
}

describe("Atlas server procedures", () => {
  const calls: Array<[string, (api: ReturnType<typeof caller>) => Promise<unknown>]> = [
    ["realms.overview", (api) => api.realms.overview()],
    ["realms.get", (api) => api.realms.get({ realm: "alpha" })],
    ["realms.refresh", (api) => api.realms.refresh({ realm: "alpha" })],
    ["jobs.list", (api) => api.jobs.list({})],
    ["jobs.get", (api) => api.jobs.get({ jobId: "job00000001" })],
    ["jobs.retry", (api) => api.jobs.retry({ jobId: "job00000001" })],
    ["jobs.cancel", (api) => api.jobs.cancel({ jobId: "job00000001" })],
    ["jobs.rollback", (api) => api.jobs.rollback({ importId: "imp1" })],
    ["health.summary", (api) => api.health.summary()],
  ];

  it.each(calls)("%s refuses everyone but a site admin", async (_name, call) => {
    await expect(call(caller(founder, seeded()))).rejects.toMatchObject({
      cause: { code: "FORBIDDEN" },
    });
  });

  it("overview lists the realms for an admin", async () => {
    const { realms } = await caller(admin, seeded()).realms.overview();
    expect(realms.map((r) => r.slug)).toEqual(["alpha"]);
  });

  it("get answers the realm with its recent jobs", async () => {
    const result = await caller(admin, seeded()).realms.get({ realm: "alpha" });
    expect(result.realm.id).toBe("a");
    expect(result.recentJobs.map((j) => j.id)).toEqual(["job00000001"]);
    expect(result.latestImport).toBeNull();
  });

  it("get and refresh say NOT_FOUND for an unknown realm", async () => {
    const api = caller(admin, seeded());
    await expect(api.realms.get({ realm: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.realms.refresh({ realm: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refresh bumps the map version and answers the new one", async () => {
    const db = seeded();
    const { mapVersion } = await caller(admin, db).realms.refresh({ realm: "alpha" });
    expect(mapVersion).toBe(6);
    expect(db.realm.rows[0].mapVersion).toBe(6);
  });

  it("list pages and filters; retry maps a service refusal to a tRPC error", async () => {
    const api = caller(admin, seeded());
    const page = await api.jobs.list({ status: "failed", limit: 5 });
    expect(page.jobs).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    await expect(api.jobs.retry({ jobId: "job00000001" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/upload it again/i),
    });
    await expect(api.jobs.get({ jobId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rollback passes through, and health answers for an admin", async () => {
    const api = caller(admin, seeded());
    await expect(api.jobs.rollback({ importId: "imp1" })).resolves.toEqual({ restored: 0 });
    const health = await api.health.summary();
    expect(health.jobs.running).toBe(0);
    expect(Object.keys(health.cron)).toEqual(["map-tiles", "geo-profiles", "map-import"]);
  });
});
