/** @jest-environment node */
/**
 * A world import from a bundle: the check (dry run) counts what applying would create, change and retire and writes
 * nothing; the apply is refused for a map that moved since the check, compared again under the slot locks, and for a
 * world fitted to another version of the realm's map; a claim or a lost Map power landing between the guards and the
 * slot transaction aborts it, and its locks are taken in a claim's own order; retiring the old slots never deletes
 * one a player, a claim row or a blurb response holds; PostGIS refuses a border nothing is left of or a shape it
 * cannot project, and the repairs it can make are warned of; a long write keeps reporting; and through the job
 * runner, a world never applies over a claim or a moved map, keeps a relief that failed visible, and cannot be called
 * off mid-write. The layer choice, Ixnay and the router's gates are in world-import-layers.test.ts.
 *
 * Folds: src/tests/server/maps/world-import-check.test.ts, src/tests/server/maps/world-import-jobs.test.ts,
 * src/tests/server/maps/world-import-refusals.test.ts
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));
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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import {
  cancelMapImportJob,
  getMapImportJob,
  runMapImportJob,
  startMapImport,
  startWorldApply,
} from "~/server/modules/maps/map-import.jobs";
import {
  applyWorld,
  runWorldDryRun,
  type WorldApplySummary,
} from "~/server/modules/maps/world-import";
import { fakeDb, founder } from "./map-import-fakes";
import {
  country,
  jobFor,
  layer,
  makeBundle,
  relief,
  seedRealm,
  stateOf,
  storeBundle,
  stored,
} from "./world-import-fixtures";

const MOVED = "The map changed since the check. Check the world again.";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-import-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

const quietly = async <T>(run: () => Promise<T>) => {
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    return await run();
  } finally {
    error.mockRestore();
  }
};

describe("the check (runWorldDryRun)", () => {
  it("reports what applying would create, change and retire, and writes nothing", async () => {
    const db = seedRealm();
    const before = stateOf(db);
    const diff = await runWorldDryRun(db, jobFor(await stored()));

    expect(diff).toMatchObject({ source: "preset", seed: 42, developmentLevel: "industrial" });
    expect(diff.layers.political).toEqual({ create: 3, change: 0, retire: 3 });
    expect(diff.layers.rivers).toEqual({ create: 1, change: 0, retire: 1 });
    expect(diff.layers.lakes).toEqual({ create: 0, change: 0, retire: 1 });
    expect(diff.layers.background).toEqual({ create: 1, change: 0, retire: 0 });
    // c_old1 goes; c_old2 has a claim row (kept, reserved: no land), c_owned an owner (kept as it is)
    expect(diff.slots).toEqual({ create: 3, retire: 1, keep: 1, reserved: 1, renamed: 1 });
    expect(diff.warnings).toEqual(
      expect.arrayContaining([
        "The realm's current map (5 features) will be replaced",
        "1 earlier nation has an old claim on file and is kept as reserved, with no land",
        "2 nations that are not generated slots, or that a player holds, keep their country but lose their border",
        "1 names were already taken in this realm and got a number",
        "PostGIS is not available, so the geometry and the nations' populations were not checked",
      ])
    );
    expect(stateOf(db)).toBe(before);
  });

  it("keeps what the realm has for a realm map bundle: only the layers it has none of are generated, never its land", async () => {
    const db = seedRealm(); // borders, rivers and lakes, and no land layer
    const before = stateOf(db);
    const diff = await runWorldDryRun(
      db,
      jobFor(await stored({ source: "realm-map" }), { options: { fittedMapVersion: 0 } })
    );
    const none = { create: 0, change: 0, retire: 0 };
    expect(diff.kept).toEqual(["political", "rivers", "lakes"]);
    for (const kept of ["background", "political", "rivers", "lakes"] as const)
      expect(diff.layers[kept]).toEqual(none);
    expect(diff.layers.altitudes).toEqual({ create: 1, change: 0, retire: 0 });
    expect(diff.layers.climate).toEqual({ create: 1, change: 0, retire: 0 });
    expect(diff.slots).toMatchObject({ create: 0, retire: 0 });
    expect(diff.replaces).toEqual([]);
    expect(stateOf(db)).toBe(before);
  });

  it("refuses a world fitted to a map that is not the realm's now, whichever way it moved", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored({ source: "realm-map" });
    const fitted = (version: number) => jobFor(id, { options: { fittedMapVersion: version } });
    await expect(runWorldDryRun(db, fitted(6))).rejects.toMatchObject({
      code: "CONFLICT",
      message: MOVED,
    });
    await expect(runWorldDryRun(db, fitted(8))).rejects.toMatchObject({ message: MOVED });
  });
});

describe("the apply and the map version", () => {
  it("refuses a map that changed after the early compare: the version is read again once both locks are held, writing nothing", async () => {
    const db = seedRealm({ mapVersion: 7 });
    const id = await stored();
    const order: string[] = [];
    let bumped = false;
    const raw = db.$queryRaw;
    db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
      if (sql.join("?").includes("FOR UPDATE")) {
        order.push("lock");
        // An edit lands after the early compare, just as the apply takes its first lock
        if (!bumped) {
          bumped = true;
          db.realm.rows[0].mapVersion += 1;
        }
      }
      return raw(sql, ...args);
    });
    const read = db.realm.findUnique.getMockImplementation()!;
    db.realm.findUnique = jest.fn(async (args: { select?: { mapVersion?: boolean } }) => {
      if (args.select?.mapVersion) order.push("version");
      return read(args);
    });
    const before = stateOf(db);
    const runRelief = relief();
    await expect(applyWorld(db, jobFor(id), undefined, { runRelief })).rejects.toMatchObject({
      code: "CONFLICT",
      message: MOVED,
    });
    // an early read, then the two locks, then the read that decides
    expect(order.slice(0, 4)).toEqual(["version", "lock", "lock", "version"]);
    expect(stateOf(db)).toBe(before);
    expect(db.mapImport.rows).toHaveLength(0);
    expect(runRelief).not.toHaveBeenCalled();
  });
});

describe("a claim racing the apply", () => {
  it("aborts when a claim is filed between the guard and the transaction, with nothing written", async () => {
    const db = seedRealm();
    const runRelief = relief();
    const before = stateOf(db);
    const transaction = db.$transaction;
    // The claim lands after the guards passed, just before the slot transaction takes its locks
    db.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
      db.realmClaim.rows.push({ id: "q_race", realmId: "r1", countryId: null, status: "pending" });
      return transaction(fn);
    });

    await expect(
      applyWorld(db, jobFor(await stored()), undefined, { runRelief })
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("locked") });

    db.realmClaim.rows.pop();
    expect(stateOf(db)).toBe(before);
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("aborts when the person lost the Map power between the guard and the transaction", async () => {
    const db = seedRealm();
    const runRelief = relief();
    const before = stateOf(db);
    const transaction = db.$transaction;
    db.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
      db.realm.rows[0].ownerId = "someone_else";
      return transaction(fn);
    });
    await expect(
      applyWorld(db, jobFor(await stored()), undefined, { runRelief })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    db.realm.rows[0].ownerId = "founder_1";
    expect(stateOf(db)).toBe(before);
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("locks the generated countries, then the realm, then counts the claims again", async () => {
    const db = seedRealm();
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    const locks = db.$queryRaw.mock.calls
      .map(([sql]: [TemplateStringsArray]) => sql.join("?"))
      .filter((sql: string) => sql.includes("FOR UPDATE"));
    expect(locks).toHaveLength(2);
    // The order of a claim's own foreign-key checks (Country, then realm): any other order can deadlock with it
    expect(locks[0]).toContain('"Country"');
    expect(locks[0]).toContain('"worldgen" = true');
    expect(locks[1]).toContain('"realms"');
    const [countryLock, realmLock] = db.$queryRaw.mock.invocationCallOrder;
    // The second count (inside the transaction) comes after both locks
    const counts: number[] = db.realmClaim.count.mock.invocationCallOrder;
    expect(counts).toHaveLength(2);
    expect(counts[1]).toBeGreaterThan(realmLock!);
    expect(counts[0]).toBeLessThan(countryLock!);
  });
});

describe("retiring the old slots", () => {
  it("retires only the generated slots nobody holds: not a player's, one a claim row of any status or a blurb response holds, a hand-made one or another realm's", async () => {
    const db = seedRealm();
    const generated = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      name: id,
      slug: id,
      realmId: "r1",
      worldgen: true,
      claimable: true,
      ownerUserId: null,
      ...extra,
    });
    db.country.rows.push(
      generated("c_scenery", { claimable: false }),
      generated("c_rejected"),
      generated("c_blurb"),
      generated("c_else", { realmId: "r2" })
    );
    db.realmClaim.rows.push({
      id: "q_old",
      realmId: "r1",
      countryId: "c_rejected",
      status: "rejected",
    });
    db.blurbResponse.rows.push({ id: "b1", countryId: "c_blurb" });
    const untouched = () =>
      JSON.stringify(["c_owned", "c_manual", "c_else"].map((id) => country(db, id)));
    const kept = untouched();
    const held = ["c_old2", "c_rejected", "c_blurb"];
    const heldBefore = held.map((id) => ({ ...country(db, id) }));

    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(db.country.deleteMany).toHaveBeenCalledTimes(1);
    expect([...db.country.deleteMany.mock.calls[0][0].where.id.in].sort()).toEqual([
      "c_old1",
      "c_scenery",
    ]);
    expect(untouched()).toBe(kept);
    // the ones a claim row or a blurb response holds stay whole, but for being closed to claims (they have no land)
    expect(held.map((id) => country(db, id))).toEqual(
      heldBefore.map((row) => ({ ...row, claimable: false }))
    );
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_old",
      "q_withdrawn",
    ]);
  });
});

describe("the check with PostGIS", () => {
  type Item = { id: string; g: { type: string } };
  type Answer = { valid?: boolean; repairable?: boolean; fail?: boolean };
  beforeEach(() => jest.mocked(isPostGISAvailable).mockResolvedValue(true));
  afterEach(() => jest.mocked(isPostGISAvailable).mockResolvedValue(false));

  /** What the inspection SQL would answer; every polygon measures 49,000 km2. */
  const postgis = (db: ReturnType<typeof fakeDb>, answer: (item: Item) => Answer) => {
    db.$queryRawUnsafe.mockImplementation(async (sql: string, json: string) => {
      if (!sql.includes("ST_IsValid")) return [];
      const items = JSON.parse(json) as Item[];
      return items.map((item) => {
        const a = answer(item);
        if (a.fail) throw new Error("transform: latitude or longitude exceeded limits");
        return {
          id: item.id,
          valid: a.valid ?? true,
          repairable: a.repairable ?? true,
          area: item.g.type === "LineString" ? 0 : 49_000,
        };
      });
    });
  };

  it.each([
    [
      "a nation's border nothing is left of once its self-crossing is repaired",
      (item: Item): Answer => ({ valid: false, repairable: item.id !== "political:slot_2" }),
      /political slot_2: nothing is left of it once its self-crossing is repaired/,
      /slot_1|slot_3/,
    ],
    [
      "a feature PostGIS cannot project to Web Mercator",
      (item: Item): Answer => ({ fail: item.id === "climate:1" }),
      /climate 1: PostGIS cannot project or measure it \(transform: latitude or longitude exceeded limits\)/,
      // the other features of the same batch were retried one by one and did not fail
      /political|background|altitudes|rivers/,
    ],
  ])("refuses %s, naming only it and writing nothing", async (_case, answer, named, others) => {
    const db = seedRealm();
    postgis(db, answer);
    const before = stateOf(db);
    const error = await runWorldDryRun(db, jobFor(await stored())).catch((e: Error) => e);
    expect((error as Error).message).toMatch(named);
    expect((error as Error).message).not.toMatch(others);
    expect(stateOf(db)).toBe(before);
  });

  it.each([
    [
      "a self-crossing border the writer can repair",
      (item: Item): Answer => ({ valid: !item.id.startsWith("political:") }),
      "3 political outlines cross themselves and are repaired when written",
      { political: { create: 3 } },
    ],
    [
      "a contour nothing is left of, which is left out as the writer would",
      (item: Item): Answer => ({ repairable: item.id !== "altitudes:1" }),
      "1 altitudes shapes are too small or tangled to keep and are left out",
      { altitudes: { create: 0, change: 0, retire: 0 }, climate: { create: 1 } },
    ],
  ])("accepts %s, with a warning", async (_case, answer, warning, layers) => {
    const db = seedRealm();
    postgis(db, answer);
    const diff = await runWorldDryRun(db, jobFor(await stored()));
    expect(diff.warnings).toContain(warning);
    expect(diff.warnings).not.toContain(
      "PostGIS is not available, so the geometry and the nations' populations were not checked"
    );
    expect(diff.layers).toMatchObject(layers);
  });
});

describe("while the map is written (a long write must not look like a stopped job)", () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("reports progress again and again until the write is done, then stops", async () => {
    const db = seedRealm();
    const write = jest.fn();
    // The write is held at the moment the layers are recorded, as a slow one would be
    let release!: () => void;
    const holdWrite = new Promise<void>((resolve) => (release = resolve));
    const record = db.mapImport.create.getMockImplementation()!;
    db.mapImport.create.mockImplementationOnce(async (args: object) => {
      await holdWrite;
      return record(args);
    });
    const done = applyWorld(
      db,
      jobFor(await stored()),
      { write, isCancelled: () => false },
      { runRelief: relief(), heartbeatMs: 5 }
    );
    await sleep(60);
    expect(
      write.mock.calls.filter(([, said]) => said === "Writing the map").length
    ).toBeGreaterThan(3);
    release();
    await done;
    const settled = write.mock.calls.length;
    await sleep(30);
    expect(write.mock.calls.length).toBe(settled);
  });
});

describe("a world through the job runner", () => {
  const held = new Set<string>();
  (globalThis as { heldLeases?: Set<string> }).heldLeases = held;
  afterEach(() => held.clear());

  const runRelief = relief();
  beforeEach(() => {
    runRelief.mockReset();
    runRelief.mockResolvedValue({
      id: "relief",
      label: "Relief",
      kind: "overlay",
      version: "v1",
      maxZoom: 5,
      built: true,
      tiles: 7,
      skipped: 0,
    });
  });

  /** Queue the founder's check of a world and run it, then queue its apply; the apply job's id. */
  async function queuedApply(db: ReturnType<typeof seedRealm>) {
    const uploadId = await storeBundle(makeBundle());
    const checkId = await startMapImport(
      {
        realmId: "r1",
        source: { kind: "world", uploadId, filename: "world.json.gz" },
        requestedBy: "founder_1",
      },
      { db, kick: false }
    );
    await runMapImportJob(db, checkId, { world: { runRelief } });
    return startWorldApply(db, founder, checkId, { db, kick: false });
  }

  it.each([
    [
      "a claim filed meanwhile",
      (db: ReturnType<typeof seedRealm>) =>
        db.realmClaim.rows.push({ id: "q_new", realmId: "r1", countryId: null, status: "pending" }),
      /locked/,
    ],
    [
      "a map that moved after the apply was queued (here back, as a restored database would)",
      (db: ReturnType<typeof seedRealm>) => (db.realm.rows[0].mapVersion -= 1),
      MOVED,
    ],
  ])("fails an apply job over %s, changing nothing", async (_case, meanwhile, reason) => {
    const db = seedRealm({ mapVersion: 4 });
    const applyId = await queuedApply(db);
    meanwhile(db);
    const before = stateOf(db);
    await quietly(() => runMapImportJob(db, applyId, { world: { runRelief } }));
    const job = await getMapImportJob(db, founder, applyId);
    expect(job.status).toBe("failed");
    expect(job.error).toMatch(reason);
    expect(stateOf(db)).toBe(before);
    expect(runRelief).not.toHaveBeenCalled();
  });

  it("keeps a succeeded job whose relief step failed, and says which step", async () => {
    const db = seedRealm();
    runRelief.mockRejectedValue(new Error("out of memory"));
    const applyId = await quietly(() => queuedApply(db));
    await quietly(() => runMapImportJob(db, applyId, { world: { runRelief } }));
    const job = await getMapImportJob(db, founder, applyId);
    expect(job.status).toBe("succeeded");
    expect((job.result as WorldApplySummary).relief).toMatchObject({
      status: "failed",
      error: "out of memory",
    });
    expect(layer(db, "political", "slot_1")).toMatchObject({ isActive: true });
  });

  it("does not call off a world apply that is running: it is all or nothing", async () => {
    const db = seedRealm();
    db.mapImportJob.rows.push({
      id: "j_x",
      realmId: "r1",
      kind: "world",
      dryRun: false,
      status: "running",
    });
    await expect(cancelMapImportJob(db, founder, "j_x")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.mapImportJob.rows.find((j: { id: string }) => j.id === "j_x").status).toBe("running");
  });
});
