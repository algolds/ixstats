/** @jest-environment node */
/**
 * A claim filed while a world is rolled back: the restore locks and closes the world's new slots before it asks who
 * holds them, so a claim is either seen (and its slot kept) or refused, never deleted with its slot.
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
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { rollbackMapImport } from "~/server/modules/maps/map-import.history";
import { applyWorld } from "~/server/modules/maps/world-import";
import { admin } from "./map-import-fakes";
import { country, jobFor, relief, seedRealm, stored } from "./world-import-fixtures";

const SEEDED = ["c_old1", "c_old2", "c_owned", "c_manual"];
const isNew = (c: { id: string }) => !SEEDED.includes(c.id);

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-rollback-race-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
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
