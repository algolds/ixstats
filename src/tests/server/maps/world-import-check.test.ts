/** @jest-environment node */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyWorld, runWorldDryRun } from "~/server/modules/maps/world-import";
import { jobFor, relief, seedRealm, stateOf, stored } from "./world-import-fixtures";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-import-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

describe("the map a check was made against", () => {
  const MOVED = "The map changed since the check. Check the world again.";

  it("records the realm's map version in the dry run", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const diff = await runWorldDryRun(db, jobFor(await stored()));
    expect(diff.mapVersion).toBe(7);
  });

  it("reads the version from the realm's row, not from a copy another process may have changed", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored();
    await runWorldDryRun(db, jobFor(id));
    db.realm.rows[0].mapVersion = 9;
    expect((await runWorldDryRun(db, jobFor(id))).mapVersion).toBe(9);
  });

  it("applies the check of the map as it still is", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const result = await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(result.slots.created).toBe(3);
  });

  it("refuses to apply a check of a map that has changed since, writing nothing", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored();
    db.realm.rows[0].mapVersion = 8; // an edit after the check
    const before = stateOf(db);
    const runRelief = relief();
    await expect(applyWorld(db, jobFor(id), undefined, { runRelief })).rejects.toMatchObject({
      code: "CONFLICT",
      message: MOVED,
    });
    expect(stateOf(db)).toBe(before);
    expect(runRelief).not.toHaveBeenCalled();
    expect(db.mapImport.rows).toHaveLength(0);
  });

  it("refuses a map that moved the other way too (a restored database), whatever the direction", async () => {
    const db = seedRealm({ mapVersion: 7 });
    db.realm.rows[0].mapVersion = 3;
    await expect(applyWorld(db, jobFor(await stored()))).rejects.toMatchObject({ message: MOVED });
  });

  it("refuses a check that recorded no version, and an apply that has no check", async () => {
    const db = seedRealm({ mapVersion: 7 });
    db.mapImportJob.rows[0].result = { phase: "world-dry-run" };
    const id = await stored();
    await expect(applyWorld(db, jobFor(id))).rejects.toMatchObject({
      code: "CONFLICT",
      message: MOVED,
    });
    await expect(applyWorld(db, jobFor(id, { parentJobId: null }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(applyWorld(db, jobFor(id, { parentJobId: "gone" }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("the map version under the slot locks", () => {
  /** Raise the realm's map version when the apply takes its first lock: an edit landing after the early compare. */
  function bumpAtFirstLock(db: ReturnType<typeof seedRealm>) {
    const raw = db.$queryRaw;
    let bumped = false;
    db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
      if (!bumped && sql.join("?").includes("FOR UPDATE")) {
        bumped = true;
        db.realm.rows[0].mapVersion += 1;
      }
      return raw(sql, ...args);
    });
    return () => bumped;
  }

  it("refuses a map that changed between the early compare and the lock, writing nothing", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored();
    const bumped = bumpAtFirstLock(db);
    const before = stateOf(db);
    const runRelief = relief();
    await expect(applyWorld(db, jobFor(id), undefined, { runRelief })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The map changed since the check. Check the world again.",
    });
    expect(bumped()).toBe(true);
    expect(stateOf(db)).toBe(before);
    expect(db.mapImport.rows).toHaveLength(0);
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("compares after the locks are taken: the version is read once the realm row is held", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored();
    const order: string[] = [];
    const raw = db.$queryRaw;
    db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
      if (sql.join("?").includes("FOR UPDATE")) order.push("lock");
      return raw(sql, ...args);
    });
    const read = db.realm.findUnique.getMockImplementation()!;
    db.realm.findUnique = jest.fn(async (args: { select?: { mapVersion?: boolean } }) => {
      if (args.select?.mapVersion) order.push("version");
      return read(args);
    });
    await applyWorld(db, jobFor(id), undefined, { runRelief: relief() });
    // an early read, then the two locks, then the read that decides
    expect(order.slice(0, 4)).toEqual(["version", "lock", "lock", "version"]);
  });

  it("still applies when the map is the version the check read at every compare", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const result = await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(result.slots.created).toBe(3);
  });
});

describe("the map version a world was fitted to", () => {
  const MOVED = "The map changed since the check. Check the world again.";
  const fitted = (version: number | undefined) =>
    version === undefined ? {} : { options: { fittedMapVersion: version } };

  it("is recorded in the dry run, and the check passes when it is the realm's current version", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored({ source: "realm-map" });
    const diff = await runWorldDryRun(db, jobFor(id, fitted(7)));
    expect(diff).toMatchObject({ source: "realm-map", mapVersion: 7, fittedMapVersion: 7 });
  });

  it("refuses a world fitted to a map that is not the realm's now, with the map-changed reason", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored({ source: "realm-map" });
    await expect(runWorldDryRun(db, jobFor(id, fitted(6)))).rejects.toMatchObject({
      code: "CONFLICT",
      message: MOVED,
    });
    await expect(runWorldDryRun(db, jobFor(id, fitted(8)))).rejects.toMatchObject({
      message: MOVED,
    });
  });

  it("needs a world fitted to the realm's map to say which version it was fitted to", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored({ source: "realm-map" });
    await expect(runWorldDryRun(db, jobFor(id))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("fitted"),
    });
    await expect(runWorldDryRun(db, jobFor(id, { options: {} }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      runWorldDryRun(db, jobFor(id, { options: { fittedMapVersion: "7" } }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("only records it for a preset world, which does not depend on the map: no refusal, null when absent", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored();
    expect((await runWorldDryRun(db, jobFor(id, fitted(3)))).fittedMapVersion).toBe(3);
    expect((await runWorldDryRun(db, jobFor(id))).fittedMapVersion).toBeNull();
  });
});
