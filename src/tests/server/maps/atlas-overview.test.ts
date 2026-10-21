/** @jest-environment node */
/** Atlas realm overview: the figures, the flags, and that the queries do not grow with the realm count. */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));

import { atlasRealmId, realmOverview } from "~/server/modules/maps/atlas-overview";
import { atlasFakeDb } from "./atlas-fakes";

type Fake = ReturnType<typeof atlasFakeDb>;

const version = (id: string) => Buffer.from(id).toString("hex").padStart(8, "0");
const reliefEntry = { id: "relief", kind: "overlay", label: "Relief", order: 10, maxZoom: 5 };
const LAYERS = ["background", "altitudes", "climate", "political", "rivers", "lakes", "icecaps"];

function addRealm(db: Fake, id: string, extra: Record<string, unknown> = {}) {
  db.realm.rows.push({
    id,
    slug: `slug-${id}`,
    name: `Realm ${id}`,
    status: "active",
    visibility: "public",
    isSystem: false,
    mapVersion: 3,
    settings: { map: { rasterLayers: [{ ...reliefEntry, version: version(id) }] } },
    ...extra,
  });
}

function addLayers(db: Fake, realmId: string, types = LAYERS, linked = 2, unlinked = 1) {
  for (const layerType of types) {
    db.mapLayer.rows.push({ realmId, layerType, isActive: true, countryId: null });
  }
  db.mapLayer.rows.splice(
    0,
    db.mapLayer.rows.length,
    ...db.mapLayer.rows.filter((r: any) => !(r.realmId === realmId && r.layerType === "political"))
  );
  for (let i = 0; i < linked + unlinked; i++) {
    db.mapLayer.rows.push({
      realmId,
      layerType: "political",
      isActive: true,
      countryId: i < linked ? `c${i}` : null,
    });
  }
}

const exists = (dirs: string[]) => async (dir: string) => dirs.some((d) => dir.includes(d));

describe("realmOverview figures", () => {
  it("reports layers, linkage, nations, claims, last job and relief for a healthy realm", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a");
    addLayers(db, "a");
    db.country.rows.push(
      {
        realmId: "a",
        ownerUserId: "u1",
        claimable: true,
        worldgen: true,
        geometry: {},
        geomPostgis: true,
      },
      {
        realmId: "a",
        ownerUserId: null,
        claimable: true,
        worldgen: true,
        geometry: {},
        geomPostgis: true,
      },
      {
        realmId: "a",
        ownerUserId: null,
        claimable: false,
        worldgen: true,
        geometry: {},
        geomPostgis: true,
      },
      {
        realmId: "a",
        ownerUserId: null,
        claimable: false,
        worldgen: false,
        geometry: {},
        geomPostgis: true,
      }
    );
    db.realmClaim.rows.push(
      { realmId: "a", status: "pending" },
      { realmId: "a", status: "approved" }
    );
    db.mapImportJob.rows.push(
      {
        id: "j1",
        realmId: "a",
        kind: "png",
        status: "succeeded",
        dryRun: true,
        createdAt: new Date(1000),
        finishedAt: new Date(2000),
      },
      {
        id: "j2",
        realmId: "a",
        kind: "world",
        status: "queued",
        dryRun: false,
        createdAt: new Date(5000),
        finishedAt: null,
      }
    );

    const { realms, partial } = await realmOverview(
      db,
      {},
      { folderExists: exists([version("a")]) }
    );

    expect(partial).toBe(false);
    expect(realms).toEqual([
      expect.objectContaining({
        id: "a",
        name: "Realm a",
        status: "active",
        visibility: "public",
        mapVersion: 3,
        layers: { present: 7, total: 7, missing: [] },
        relief: "built",
        linkage: { linked: 2, total: 3 },
        nations: { total: 4, owned: 1, open: 1, reserved: 1 },
        pendingClaims: 1,
        lastJob: { id: "j2", kind: "world", status: "queued", dryRun: false, at: new Date(5000) },
        invalidGeometry: 0,
        flags: ["unlinked"],
      }),
    ]);
  });

  it("leaves system realms out (they have no map)", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a");
    addRealm(db, "nationstates", { isSystem: true });
    const { realms } = await realmOverview(db, {}, { folderExists: exists([]) });
    expect(realms.map((realm) => realm.id)).toEqual(["a"]);
  });

  it("uses finishedAt for a finished last job", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a");
    db.mapImportJob.rows.push({
      id: "j1",
      realmId: "a",
      kind: "png",
      status: "failed",
      dryRun: true,
      createdAt: new Date(1000),
      finishedAt: new Date(2000),
    });
    const { realms } = await realmOverview(db, {}, { folderExists: exists([]) });
    expect(realms[0]!.lastJob).toMatchObject({ status: "failed", at: new Date(2000) });
  });

  it("flags missing layers, missing relief, a failed last job and invalid geometry", async () => {
    const db = atlasFakeDb();
    addRealm(db, "b", { settings: null });
    addLayers(db, "b", ["background", "political"], 1, 0);
    db.country.rows.push({
      realmId: "b",
      ownerUserId: null,
      claimable: true,
      geometry: {},
      geomPostgis: false,
    });
    db.mapImportJob.rows.push({
      id: "j",
      realmId: "b",
      kind: "map-pipeline",
      status: "failed",
      dryRun: false,
      createdAt: new Date(1),
      finishedAt: new Date(2),
    });
    const { realms } = await realmOverview(db, {}, { folderExists: exists([]) });
    expect(realms[0]).toMatchObject({
      layers: {
        present: 2,
        total: 7,
        missing: ["altitudes", "climate", "rivers", "lakes", "icecaps"],
      },
      relief: "missing",
      invalidGeometry: 1,
      flags: ["missing-layers", "relief", "last-job-failed", "invalid-geometry"],
    });
  });

  it("calls the relief failed when the latest world apply's relief step failed and was not rolled back", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a");
    addRealm(db, "b");
    for (const realmId of ["a", "b"]) {
      db.mapImportJob.rows.push({
        id: `w${realmId}`,
        realmId,
        kind: "world",
        status: "succeeded",
        dryRun: false,
        createdAt: new Date(10),
        finishedAt: new Date(11),
        result: { relief: { status: "failed" } },
      });
    }
    db.mapImport.rows.push({ jobId: "wb", rolledBackAt: new Date(20) });
    const { realms } = await realmOverview(
      db,
      {},
      { folderExists: exists([version("a"), version("b")]) }
    );
    expect(realms.map((r) => [r.id, r.relief])).toEqual([
      ["a", "failed"],
      ["b", "built"],
    ]);
  });

  it("reports relief folders the budget cut off as unknown, without a relief flag, and says the check was partial", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a");
    const { realms, partial } = await realmOverview(
      db,
      {},
      { folderExists: () => new Promise<boolean>(() => undefined), budgetMs: 10 }
    );
    expect(partial).toBe(true);
    expect(realms[0]!.relief).toBe("unknown");
    expect(realms[0]!.flags).not.toContain("relief");
  });

  it("calls a realm with no relief entry missing even when the check ran out of time", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a", { settings: null });
    const { realms } = await realmOverview(db, {}, { folderExists: async () => true });
    expect(realms[0]!.relief).toBe("missing");
  });
});

describe("realmOverview batching", () => {
  async function callsFor(realms: number) {
    const db = atlasFakeDb();
    for (let i = 0; i < realms; i++) {
      addRealm(db, `r${i}`);
      addLayers(db, `r${i}`);
      db.country.rows.push({ realmId: `r${i}`, ownerUserId: null, claimable: true });
      db.mapImportJob.rows.push({
        id: `j${i}`,
        realmId: `r${i}`,
        kind: "world",
        status: "succeeded",
        dryRun: false,
        createdAt: new Date(1),
        result: { relief: { status: "failed" } },
      });
    }
    await realmOverview(db, {}, { folderExists: async () => true });
    return db.calls as string[];
  }

  it("makes the same queries for 2 realms and for 25", async () => {
    const small = await callsFor(2);
    const large = await callsFor(25);
    expect([...large].sort()).toEqual([...small].sort());
    expect(small.length).toBeLessThanOrEqual(8);
  });
});

describe("one realm", () => {
  it("is found by id or slug, with an id winning over a slug that spells the same", async () => {
    const db = atlasFakeDb();
    addRealm(db, "a");
    addRealm(db, "b", { slug: "a" });
    expect(await atlasRealmId(db, "a")).toBe("a");
    expect(await atlasRealmId(db, "slug-a")).toBe("a");
    expect(await atlasRealmId(db, "nope")).toBeNull();
    const { realms, layerCounts } = await realmOverview(
      db,
      { match: "a" },
      { folderExists: exists([]) }
    );
    expect(realms.map((r) => r.id)).toEqual(["a"]);
    expect(layerCounts).toEqual({});
  });

  it("is NOT_FOUND for an unknown realm", async () => {
    await expect(realmOverview(atlasFakeDb(), { match: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
