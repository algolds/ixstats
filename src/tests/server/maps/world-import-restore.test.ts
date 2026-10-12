/** @jest-environment node */
/**
 * A world import that goes wrong or is undone: the compensation after a failure, the rollback of an applied world,
 * the realm map source, and the relief rebuild.
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
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

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { decodeCells } from "~/lib/maps/import/world-bundle";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { parseRealmMapSettings, withRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { withRasterLayer } from "~/lib/maps/raster-tiles";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { mapImportLockName } from "~/server/modules/maps/map-import.realm";
import { applyWorld, rebuildRealmRelief, runWorldDryRun } from "~/server/modules/maps/world-import";
import { admin } from "./map-import-fakes";
import {
  CELLS,
  RELIEF_ENTRY,
  country,
  jobFor,
  layer,
  makeBundle,
  relief,
  seedRealm,
  square,
  stateOf,
  stored,
} from "./world-import-fixtures";

const held = new Set<string>();
(globalThis as { heldLeases?: Set<string> }).heldLeases = held;
afterEach(() => held.clear());

/** The seeded realm's four countries: the generated slots and the hand-made one. */
const SEEDED = ["c_old1", "c_old2", "c_owned", "c_manual"];
const isNew = (c: { id: string }) => !SEEDED.includes(c.id);

let dir: string;
let rasterDir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-restore-"));
  rasterDir = mkdtempSync(path.join(tmpdir(), "world-restore-rasters-"));
  process.env.MAP_IMPORT_DIR = dir;
  process.env.MAP_RASTER_DIR = rasterDir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(rasterDir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
  delete process.env.MAP_RASTER_DIR;
});

/** The tiles of a relief version, as the build leaves them on disk (just the version's folder here). */
const builtRelief = (version: string) =>
  mkdirSync(path.join(rasterDir, "r1", "relief", version), { recursive: true });

describe("a failure after the slots changed", () => {
  const original = () => {
    const db = seedRealm();
    return { db, before: stateOf(db) };
  };

  it("restores the previous slots and layers when the import cannot be recorded", async () => {
    const { db } = original();
    const runRelief = relief();
    db.mapImport.create.mockRejectedValueOnce(new Error("disk full"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(applyWorld(db, jobFor(await stored()), undefined, { runRelief })).rejects.toThrow(
      "disk full"
    );
    error.mockRestore();

    // The retired slot is back as it was; the new ones and their borders are gone
    expect(country(db, "c_old1")).toMatchObject({
      name: "Old One",
      slug: "old-one",
      worldgen: true,
      baselinePopulation: 500_000,
      baselineGdpPerCapita: 9_000,
    });
    expect(db.country.rows.map((c: { id: string }) => c.id).sort()).toEqual([
      "c_manual",
      "c_old1",
      "c_old2",
      "c_owned",
    ]);
    expect(layer(db, "political", "slot_1")).toBeUndefined();
    expect(layer(db, "rivers", "1")).toBeUndefined();
    expect(layer(db, "political", "slot_old")).toMatchObject({
      isActive: true,
      countryId: "c_old1",
    });
    expect(layer(db, "political", "manual-key")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: true });
    expect(db.realm.rows[0].seed).toBeNull();
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("restores them when the map writer rejects a nation's border", async () => {
    const { db } = original();
    const upsert = db.mapLayer.upsert.getMockImplementation()!;
    let failed = false;
    db.mapLayer.upsert.mockImplementation(async (args: { create: { layerType: string } }) => {
      // The first nation border fails (its whole batch is rejected); the restore after it writes as usual
      if (args.create.layerType === "political" && !failed) {
        failed = true;
        throw new Error("connection reset");
      }
      return upsert(args);
    });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(applyWorld(db, jobFor(await stored()))).rejects.toThrow(
      /rejected 3 nation borders \(connection reset\)/
    );
    error.mockRestore();
    expect(country(db, "c_old1")).toBeDefined();
    expect(db.country.rows).toHaveLength(4);
    expect(layer(db, "political", "slot_old")).toMatchObject({
      isActive: true,
      countryId: "c_old1",
    });
    expect(layer(db, "rivers", "1")).toBeUndefined();
    // the import it recorded is marked as rolled back, so the history does not offer it
    expect(db.mapImport.rows.every((r: { rolledBackAt: Date | null }) => r.rolledBackAt)).toBe(
      true
    );
  });

  it("opens the slots it had closed again when the apply fails, so the previous map is as it was", async () => {
    const { db } = original();
    db.mapImport.create.mockRejectedValueOnce(new Error("disk full"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(applyWorld(db, jobFor(await stored()))).rejects.toThrow("disk full");
    error.mockRestore();
    // c_old2 (a withdrawn claim holds it) was closed for the new world and is open again with its old border
    expect(country(db, "c_old2")).toMatchObject({ claimable: true });
    expect(db.country.rows.map((c: { id: string }) => c.id).sort()).toEqual(SEEDED.sort());
  });

  it("never deletes a new slot a player claimed in the meantime, or the claim", async () => {
    const { db } = original();
    // The map import cannot be recorded; while the apply is writing, a player files a claim for a new slot
    db.mapImport.create.mockImplementationOnce(async () => {
      const made = db.country.rows.find((c: { name: string }) => c.name === "Nation 3");
      db.realmClaim.rows.push({
        id: "q_new",
        realmId: "r1",
        countryId: made.id,
        status: "pending",
      });
      throw new Error("disk full");
    });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(applyWorld(db, jobFor(await stored()))).rejects.toThrow(
      /disk full\. 1 new nation was kept because a player has claimed it/
    );
    error.mockRestore();
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_new",
      "q_withdrawn",
    ]);
    expect(db.country.rows.map((c: { name: string }) => c.name).sort()).toEqual(
      ["Nation 3", "Nation 2", "Old One", "Old Owned", "Old Two"].sort()
    );
  });

  it("keeps every new slot unclaimable while the map is written, and opens them after", async () => {
    const { db } = original();
    const seen: boolean[][] = [];
    const record = db.mapImport.create.getMockImplementation()!;
    // The import is recorded once the layers are written: the last moment before the slots open
    db.mapImport.create.mockImplementationOnce(async (args: object) => {
      seen.push(db.country.rows.filter(isNew).map((c: { claimable: boolean }) => c.claimable));
      return record(args);
    });
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(seen).toEqual([[false, false, false]]);
    expect(db.country.rows.filter(isNew).map((c: { claimable: boolean }) => c.claimable)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("saves the realm's generation record before it opens the slots, so a failure there finds them closed", async () => {
    const { db } = original();
    const seen: boolean[][] = [];
    db.realm.update.mockImplementationOnce(async () => {
      seen.push(db.country.rows.filter(isNew).map((c: { claimable: boolean }) => c.claimable));
      throw new Error("connection reset");
    });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = await applyWorld(db, jobFor(await stored())).catch((e: Error) => e);
    error.mockRestore();
    expect(seen).toEqual([[false, false, false]]);
    // Nothing was open to claim, so nothing is kept and the message says only what failed
    expect((failure as Error).message).toBe("connection reset");
    expect(db.country.rows.filter(isNew)).toHaveLength(0);
    expect(country(db, "c_old1")).toBeDefined();
  });

  it("keeps a new slot a player claimed once it was open, and says so in the error", async () => {
    const { db } = original();
    let late = false;
    // The last step after the slots open fails; a claim has just landed on one of them
    jest.mocked(broadcastMapUpdate).mockImplementation((kind: string) => {
      const open = db.country.rows.filter(isNew).filter((c: { claimable: boolean }) => c.claimable);
      if (kind !== "bulk" || open.length === 0 || late) return;
      late = true;
      db.realmClaim.rows.push({
        id: "q_late",
        realmId: "r1",
        countryId: open[0].id,
        status: "pending",
      });
      throw new Error("socket closed");
    });
    const runRelief = relief();
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(applyWorld(db, jobFor(await stored()), undefined, { runRelief })).rejects.toThrow(
      /socket closed\. 1 new nation was kept because a player has claimed it/
    );
    error.mockRestore();
    jest.mocked(broadcastMapUpdate).mockReset();

    // Only the claimed nation stays, with its claim; the retired slot is back; the realm's record is as before
    const kept = db.country.rows.filter(isNew);
    expect(kept).toHaveLength(1);
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_late",
      "q_withdrawn",
    ]);
    expect(country(db, "c_old1")).toBeDefined();
    expect(db.realm.rows[0].seed).toBeNull();
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("names the step that failed: the map was restored, marking the import rolled back was not", async () => {
    const { db } = original();
    const upsert = db.mapLayer.upsert.getMockImplementation()!;
    let failed = false;
    db.mapLayer.upsert.mockImplementation(async (args: { create: { layerType: string } }) => {
      if (args.create.layerType === "political" && !failed) {
        failed = true;
        throw new Error("connection reset");
      }
      return upsert(args);
    });
    db.mapImport.updateMany.mockRejectedValueOnce(new Error("lock timeout"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = await applyWorld(db, jobFor(await stored())).catch((e: Error) => e);
    error.mockRestore();
    expect((failure as Error).message).toMatch(/rejected 3 nation borders \(connection reset\)/);
    expect((failure as Error).message).toMatch(
      /The previous map was restored, but marking the import as rolled back failed \(lock timeout\)/
    );
    expect((failure as Error).message).not.toMatch(/Restoring the previous map/);
    expect(country(db, "c_old1")).toBeDefined();
    expect(layer(db, "political", "slot_old")).toMatchObject({ isActive: true });
  });

  it("says so when the previous map cannot be restored either", async () => {
    const { db } = original();
    db.mapImport.create.mockRejectedValueOnce(new Error("disk full"));
    db.country.createMany.mockRejectedValueOnce(new Error("unique constraint"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(applyWorld(db, jobFor(await stored()))).rejects.toThrow(
      /disk full\. Restoring the previous map also failed \(unique constraint\)/
    );
    error.mockRestore();
  });
});

describe("rolling a world back", () => {
  it("removes the new slots and puts the retired ones back", async () => {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    expect(country(db, "c_old1")).toBeUndefined();

    const restored = await rollbackMapImport(db, admin, applied.mapImportId!);
    expect(restored.slots).toEqual({ restored: 1, removed: 3, kept: 0 });
    expect(country(db, "c_old1")).toMatchObject({
      name: "Old One",
      slug: "old-one",
      worldgen: true,
    });
    // the slot the world had closed (its old claim kept it) is open again, as its border is
    expect(country(db, "c_old2")).toMatchObject({ claimable: true });
    expect(db.country.rows).toHaveLength(4);
    expect(layer(db, "political", "slot_old")).toMatchObject({
      isActive: true,
      countryId: "c_old1",
    });
    expect(layer(db, "political", "slot_1")).toBeUndefined();
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: true });
  });

  it("restores the slots in one transaction: a failure leaves the applied world, not half a restore", async () => {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    const worldState = stateOf(db);
    db.country.createMany.mockRejectedValueOnce(new Error("slug taken"));
    await expect(rollbackMapImport(db, admin, applied.mapImportId!)).rejects.toThrow("slug taken");
    // The new slots were not removed without the old ones coming back, and the import can be rolled back again
    expect(stateOf(db)).toBe(worldState);
    await rollbackMapImport(db, admin, applied.mapImportId!);
    expect(country(db, "c_old1")).toBeDefined();
    expect(db.country.rows).toHaveLength(4);
  });

  it("does not run while another import of the realm holds its lease", async () => {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    const worldState = stateOf(db);
    held.add(mapImportLockName("r1"));
    await expect(rollbackMapImport(db, admin, applied.mapImportId!)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Another import"),
    });
    expect(stateOf(db)).toBe(worldState);
  });

  describe("the realm's generation record and relief layer", () => {
    const BEFORE = "a".repeat(8);
    const AFTER = "b".repeat(8);
    const base = {
      id: "geography",
      label: "Geography",
      kind: "base" as const,
      version: "c".repeat(8),
      maxZoom: 3,
    };
    const reliefBefore = {
      id: "relief",
      label: "Relief",
      kind: "overlay" as const,
      version: BEFORE,
      maxZoom: 5,
      order: 10,
    };

    /** A relief runner that records its layer in the realm's settings, as the real one does. */
    const recordingRelief = (db: ReturnType<typeof seedRealm>) =>
      jest.fn(async (_db: unknown, realmId: string) => {
        const realm = db.realm.rows.find((r: { id: string }) => r.id === realmId);
        const layers = parseRealmMapSettings(realm.settings).rasterLayers ?? [];
        realm.settings = withRealmMapSettings(realm.settings, {
          rasterLayers: withRasterLayer(layers, { ...RELIEF_ENTRY, version: AFTER, order: 10 }),
        });
        return { ...RELIEF_ENTRY, version: AFTER };
      });

    it("puts back the previous seed, parameters and relief version, and keeps the other settings", async () => {
      const previous = { source: "preset", developmentLevel: "modern", params: { seed: 7 } };
      const db = seedRealm({
        seed: 7,
        generationParams: previous,
        settings: {
          inactivityDays: 30,
          map: { radiusKm: 3185.5, rasterLayers: [base, reliefBefore] },
        },
      });
      builtRelief(BEFORE);
      const applied = await applyWorld(db, jobFor(await stored()), undefined, {
        runRelief: recordingRelief(db),
      });
      expect(db.realm.rows[0].seed).toBe(42);
      expect(parseRealmMapSettings(db.realm.rows[0].settings).rasterLayers?.[1]?.version).toBe(
        AFTER
      );

      await rollbackMapImport(db, admin, applied.mapImportId!);
      expect(db.realm.rows[0]).toMatchObject({ seed: 7, generationParams: previous });
      const settings = parseRealmMapSettings(db.realm.rows[0].settings);
      expect(settings.rasterLayers).toEqual([base, reliefBefore]);
      expect(settings.radiusKm).toBe(3185.5);
      expect(db.realm.rows[0].settings.inactivityDays).toBe(30);
    });

    it("removes the relief layer when there was none, and clears the generation record", async () => {
      const db = seedRealm({ settings: { map: { rasterLayers: [base] } } });
      const applied = await applyWorld(db, jobFor(await stored()), undefined, {
        runRelief: recordingRelief(db),
      });
      expect(parseRealmMapSettings(db.realm.rows[0].settings).rasterLayers).toHaveLength(2);

      await rollbackMapImport(db, admin, applied.mapImportId!);
      expect(db.realm.rows[0].seed).toBeNull();
      expect(db.realm.rows[0].generationParams).toBe(Prisma.DbNull);
      expect(parseRealmMapSettings(db.realm.rows[0].settings).rasterLayers).toEqual([base]);
    });

    it("drops the previous relief entry when its tiles were pruned, rather than serve 404s for them", async () => {
      // Two worlds on, the build had kept only the newest two relief versions: the one before is gone from disk
      const pruned = { ...reliefBefore, version: "d".repeat(8) };
      const db = seedRealm({ settings: { map: { rasterLayers: [base, pruned] } } });
      const applied = await applyWorld(db, jobFor(await stored()), undefined, {
        runRelief: recordingRelief(db),
      });
      await rollbackMapImport(db, admin, applied.mapImportId!);
      expect(parseRealmMapSettings(db.realm.rows[0].settings).rasterLayers).toEqual([base]);
    });

    it("drops the layers key when the relief was the only layer", async () => {
      const db = seedRealm();
      const applied = await applyWorld(db, jobFor(await stored()), undefined, {
        runRelief: recordingRelief(db),
      });
      await rollbackMapImport(db, admin, applied.mapImportId!);
      expect(parseRealmMapSettings(db.realm.rows[0].settings).rasterLayers).toBeUndefined();
    });
  });

  it("refuses once a player has claimed one of the new slots, changing nothing", async () => {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    const made = db.country.rows.find((c: { name: string }) => c.name === "Nation 3");
    db.realmClaim.rows.push({ id: "q_new", realmId: "r1", countryId: made.id, status: "approved" });
    const before = stateOf(db);
    await expect(rollbackMapImport(db, admin, applied.mapImportId!)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("have been claimed"),
    });
    expect(stateOf(db)).toBe(before);
  });
});

describe("a claim filed while a world is rolled back", () => {
  async function appliedWorld() {
    const db = seedRealm();
    const applied = await applyWorld(db, jobFor(await stored()), undefined, {
      runRelief: relief(),
    });
    return { db, applied, made: db.country.rows.filter(isNew) as Array<{ id: string }> };
  }

  /** What a player's claim checks first (loadClaimable): a slot that is not claimable is refused. */
  function tryClaim(db: Awaited<ReturnType<typeof appliedWorld>>["db"], countryId: string) {
    const row = country(db, countryId);
    if (!row || row.claimable === false) return false;
    db.realmClaim.rows.push({ id: "q_late", realmId: "r1", countryId, status: "pending" });
    return true;
  }

  it("locks the new slots, then the realm, closes the slots, and only then reads who holds them", async () => {
    const { db, applied, made } = await appliedWorld();
    const events: string[] = [];
    const queryRaw = db.$queryRaw;
    db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
      const text = sql.join("?");
      if (text.includes("FOR UPDATE")) {
        events.push(text.includes('"Country"') ? "lock slots" : "lock realm");
      }
      return queryRaw(sql, ...args);
    });
    const claims = db.realmClaim.findMany.getMockImplementation()!;
    db.realmClaim.findMany = jest.fn(async (args: object) => {
      events.push("read claims");
      return claims(args);
    });
    const close = db.country.updateMany.getMockImplementation()!;
    db.country.updateMany = jest.fn(async (args: { data: { claimable?: boolean } }) => {
      if (args.data.claimable === false) events.push("close slots");
      return close(args);
    });
    const remove = db.country.deleteMany.getMockImplementation()!;
    db.country.deleteMany = jest.fn(async (args: object) => {
      events.push("delete slots");
      return remove(args);
    });

    await rollbackMapImport(db, admin, applied.mapImportId!);
    // Country rows, then the realm: the order of the apply and of a claim's own foreign-key checks
    expect(events.slice(events.indexOf("lock slots"))).toEqual([
      "lock slots",
      "lock realm",
      "close slots",
      "read claims",
      "delete slots",
    ]);
    expect(made.every((c) => country(db, c.id) === undefined)).toBe(true);
  });

  it("keeps a slot whose claim landed before the lock, with the claim, and leaves it open to be decided", async () => {
    const { db, applied, made } = await appliedWorld();
    const queryRaw = db.$queryRaw;
    let filed = false;
    db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
      // The claim commits just as the restore asks for its lock: the lock waits for it, then the check sees it
      if (!filed && sql.join("?").includes("FOR UPDATE")) filed = tryClaim(db, made[2]!.id);
      return queryRaw(sql, ...args);
    });

    const restored = await rollbackMapImport(db, admin, applied.mapImportId!);
    expect(filed).toBe(true);
    expect(restored.slots).toEqual({ restored: 1, removed: 2, kept: 1 });
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_late",
      "q_withdrawn",
    ]);
    // It was opened before, and a pending claim on it must still be decidable
    expect(country(db, made[2]!.id)).toMatchObject({ claimable: true });
  });

  it("refuses a claim that comes after the slots are closed, and removes the slots", async () => {
    const { db, applied, made } = await appliedWorld();
    const close = db.country.updateMany.getMockImplementation()!;
    const outcomes: boolean[] = [];
    db.country.updateMany = jest.fn(async (args: { data: { claimable?: boolean } }) => {
      const result = await close(args);
      if (args.data.claimable === false) outcomes.push(tryClaim(db, made[2]!.id));
      return result;
    });

    const restored = await rollbackMapImport(db, admin, applied.mapImportId!);
    expect(outcomes).toEqual([false]);
    expect(restored.slots).toEqual({ restored: 1, removed: 3, kept: 0 });
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id)).toEqual(["q_withdrawn"]);
  });
});

describe("the realm map source", () => {
  it("keeps the borders and makes a claimable nation of each region that has none", async () => {
    const db = seedRealm();
    const runRelief = relief();
    const politicalBefore = JSON.stringify(
      db.mapLayer.rows.filter((r: { layerType: string }) => r.layerType === "political")
    );
    // two regions without a nation, drawn by hand
    db.mapLayer.rows.push(
      {
        id: "m_free1",
        realmId: "r1",
        layerType: "political",
        featureId: "Aurelia",
        displayName: "Aurelia",
        geometry: square(40),
        centroid: [41, 1],
        boundingBox: [40, 0, 42, 2],
        areaSqKm: 40_000,
        isActive: true,
        countryId: null,
        properties: {},
        updatedAt: new Date(),
      },
      {
        id: "m_free2",
        realmId: "r1",
        layerType: "political",
        featureId: "Nation 2",
        displayName: null,
        geometry: square(50),
        centroid: null,
        boundingBox: null,
        areaSqKm: 30_000,
        isActive: true,
        countryId: null,
        properties: {},
        updatedAt: new Date(),
      }
    );
    const id = await stored({ source: "realm-map" });
    const diff = await runWorldDryRun(db, jobFor(id, { options: { fittedMapVersion: 0 } }));
    expect(diff.slots).toMatchObject({ create: 2, retire: 0 });
    expect(diff.layers.political).toEqual({ create: 0, change: 0, retire: 0 });

    const result = await applyWorld(db, jobFor(id), undefined, { runRelief });
    expect(result.slots).toEqual({ created: 2, retired: 0, opened: 2 });
    // all the existing generated countries stay (c_old1 included: the borders are kept, so are their slots)
    expect(db.country.rows).toHaveLength(6);
    expect(country(db, "c_old1")).toBeDefined();
    const aurelia = db.country.rows.find((c: { name: string }) => c.name === "Aurelia");
    const second = db.country.rows.find((c: { name: string }) => c.name === "Nation 2 (2)");
    expect(aurelia).toMatchObject({
      worldgen: true,
      claimable: true,
      landArea: 40_000,
      geometry: square(40),
    });
    expect(second).toBeDefined();
    expect(layer(db, "political", "Aurelia")).toMatchObject({
      countryId: aurelia.id,
      isActive: true,
    });
    expect(layer(db, "political", "Nation 2")).toMatchObject({ countryId: second.id });
    // the other political features are exactly as they were, and the physical layers were written
    expect(
      JSON.stringify(
        db.mapLayer.rows.filter(
          (r: { layerType: string; featureId: string }) =>
            r.layerType === "political" && !["Aurelia", "Nation 2"].includes(r.featureId)
        )
      )
    ).toBe(politicalBefore);
    expect(layer(db, "rivers", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: false });
    expect(db.realm.rows[0]).toMatchObject({ seed: 42, generationParams: { source: "realm-map" } });
    expect(runRelief).toHaveBeenCalledTimes(1);

    // and a rollback unlinks and removes them again
    const restored = await rollbackMapImport(db, admin, result.mapImportId!);
    expect(restored.slots).toMatchObject({ restored: 0, removed: 2 });
    expect(db.country.rows).toHaveLength(4);
    expect(layer(db, "political", "Aurelia")).toMatchObject({ countryId: null });
  });
});

describe("rebuildRealmRelief", () => {
  it("builds from the cells of the realm's latest world import", async () => {
    const db = seedRealm();
    const uploadId = await stored();
    await applyWorld(db, jobFor(uploadId), undefined, { runRelief: relief() });
    db.mapImportJob.rows.push({ id: "j_world", uploadId });
    const runRelief = relief();
    const out = await rebuildRealmRelief(db, "r1", { runRelief });
    expect(out).toEqual({ source: "cells", version: "abc12345", built: true, tiles: 12 });
    const [, , source] = runRelief.mock.calls[0]!;
    const cells = decodeCells(makeBundle().cells);
    expect(cells.ok && Array.from(cells.cells)).toEqual(CELLS);
    expect(Array.from((source as { cells: Float32Array }).cells)).toEqual(CELLS);
  });

  it("builds from the altitude bands when the map did not come from a world", async () => {
    const db = seedRealm();
    const runRelief = relief();
    const out = await rebuildRealmRelief(db, "r1", { runRelief });
    expect(out.source).toBe("bands");
    expect(runRelief.mock.calls[0]![2]).toEqual({ bands: true });
  });

  it("builds from the bands when a later import replaced the world's altitudes", async () => {
    const db = seedRealm();
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    db.mapImportJob.rows.push({ id: "j_world", uploadId: await stored() });
    db.mapImport.rows.push({
      id: "i_png",
      realmId: "r1",
      jobId: "j_png",
      layerTypes: ["altitudes"],
      mode: "replace",
      summary: { source: "pipeline" },
      createdAt: new Date(Date.now() + 60_000),
      rolledBackAt: null,
    });
    const runRelief = relief();
    expect((await rebuildRealmRelief(db, "r1", { runRelief })).source).toBe("bands");
  });

  it("builds from the bands when the world's bundle is no longer stored", async () => {
    const db = seedRealm();
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    // no stored job: the bundle cannot be found
    const runRelief = relief();
    expect((await rebuildRealmRelief(db, "r1", { runRelief })).source).toBe("bands");
  });
});
