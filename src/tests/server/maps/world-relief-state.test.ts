/** @jest-environment node */
/**
 * Whether the relief step of a realm's latest world import failed and has not been rebuilt: what the World tab reads
 * to offer "Rebuild relief" after a reload, and what a successful rebuild clears.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { rebuildRealmRelief } from "~/server/modules/maps/world-import";
import { worldReliefFailed } from "~/server/modules/maps/world-import.relief-state";
import { relief, seedRealm } from "./world-import-fixtures";

let rasterDir: string;
beforeAll(() => {
  rasterDir = mkdtempSync(path.join(tmpdir(), "world-relief-state-"));
  process.env.MAP_RASTER_DIR = rasterDir;
});
afterAll(() => {
  rmSync(rasterDir, { recursive: true, force: true });
  delete process.env.MAP_RASTER_DIR;
});

/** A realm whose settings record a relief layer of this version. */
const recordsRelief = (version: string) =>
  seedRealm({
    settings: {
      map: {
        rasterLayers: [
          { id: "relief", label: "Relief", kind: "overlay", version, maxZoom: 5, order: 10 },
        ],
      },
    },
  });

const FAILED = { status: "failed", version: null, tiles: 0, error: "sharp ran out of memory" };
const BUILT = { status: "built", version: "abc12345", tiles: 12, error: null };

/** A finished apply job of the realm and the import it recorded. */
function addApply(
  db: ReturnType<typeof seedRealm>,
  id: string,
  outcome: object,
  over: Partial<{
    dryRun: boolean;
    status: string;
    kind: string;
    realmId: string;
    createdAt: Date;
  }> = {}
) {
  db.mapImportJob.rows.push({
    id,
    realmId: "r1",
    kind: "world",
    dryRun: false,
    status: "succeeded",
    result: { phase: "world-apply", written: 4, relief: outcome },
    createdAt: new Date("2026-02-01T00:00:00Z"),
    ...over,
  });
  db.mapImport.rows.push({
    id: `i_${id}`,
    realmId: "r1",
    jobId: id,
    layerTypes: ["altitudes"],
    rolledBackAt: null,
  });
}

describe("worldReliefFailed", () => {
  it("is false for a realm that never had a world import", async () => {
    await expect(worldReliefFailed(seedRealm(), "r1")).resolves.toBe(false);
  });

  it("is true when the relief step of the latest world import failed", async () => {
    const db = seedRealm();
    addApply(db, "j_apply", FAILED);
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(true);
  });

  it("is false when the relief was built", async () => {
    const db = seedRealm();
    addApply(db, "j_apply", BUILT);
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(false);
  });

  it("reads the latest world import only: a later one that built its relief clears an earlier failure", async () => {
    const db = seedRealm();
    addApply(db, "j_old", FAILED);
    addApply(db, "j_new", BUILT, { createdAt: new Date("2026-03-01T00:00:00Z") });
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(false);
  });

  it("ignores dry runs, jobs that did not finish, other kinds and other realms", async () => {
    const db = seedRealm();
    addApply(db, "j_dry", FAILED, { dryRun: true });
    addApply(db, "j_failed", FAILED, { status: "failed" });
    addApply(db, "j_png", FAILED, { kind: "png" });
    addApply(db, "j_other", FAILED, { realmId: "r2" });
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(false);
  });

  it("is false once the import was rolled back: the previous relief is back", async () => {
    const db = seedRealm();
    addApply(db, "j_apply", FAILED);
    db.mapImport.rows[0]!.rolledBackAt = new Date();
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(false);
  });
});

describe("worldReliefFailed, for a relief whose tiles are gone", () => {
  it("is true when the settings record a relief version that is not on disk (pruned, or never shared)", async () => {
    const db = recordsRelief("a".repeat(8));
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(true);
  });

  it("is false when the recorded version is on disk, and when the realm records no relief", async () => {
    mkdirSync(path.join(rasterDir, "r1", "relief", "b".repeat(8)), { recursive: true });
    await expect(worldReliefFailed(recordsRelief("b".repeat(8)), "r1")).resolves.toBe(false);
    await expect(worldReliefFailed(seedRealm(), "r1")).resolves.toBe(false);
  });

  it("is true with a world whose relief step built, once its tiles are gone", async () => {
    const db = recordsRelief("c".repeat(8));
    addApply(db, "j_apply", BUILT);
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(true);
  });
});

describe("a relief rebuild", () => {
  it("clears a failed relief step once the relief is built", async () => {
    const db = seedRealm();
    addApply(db, "j_apply", FAILED);
    await rebuildRealmRelief(db, "r1", { runRelief: relief() });
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(false);
    expect(
      db.mapImportJob.rows.find((job: { id: string }) => job.id === "j_apply")!.result
    ).toEqual({
      phase: "world-apply",
      written: 4,
      relief: { status: "built", version: "abc12345", tiles: 12, error: null },
    });
  });

  it("leaves a world import that failed to rebuild its relief marked failed", async () => {
    const db = seedRealm();
    addApply(db, "j_apply", FAILED);
    const runRelief = jest.fn().mockRejectedValue(new Error("no heights"));
    await expect(rebuildRealmRelief(db, "r1", { runRelief })).rejects.toThrow("no heights");
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(true);
  });

  it("still answers when the bookkeeping fails: the relief is built", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const db = seedRealm();
    addApply(db, "j_apply", FAILED);
    db.mapImportJob.update.mockRejectedValueOnce(new Error("connection lost"));
    await expect(rebuildRealmRelief(db, "r1", { runRelief: relief() })).resolves.toMatchObject({
      built: true,
    });
    await expect(worldReliefFailed(db, "r1")).resolves.toBe(true);
  });

  it("leaves other jobs alone when the latest import's relief was built", async () => {
    const db = seedRealm();
    addApply(db, "j_apply", BUILT);
    await rebuildRealmRelief(db, "r1", { runRelief: relief() });
    expect(db.mapImportJob.update).not.toHaveBeenCalled();
  });
});
