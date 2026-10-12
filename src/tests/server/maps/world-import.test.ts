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
import { dedupeNames } from "~/server/modules/maps/world-import.slots";
import {
  CELLS,
  country,
  feature,
  jobFor,
  layer,
  relief,
  seedRealm,
  slot,
  square,
  stateOf,
  stored,
} from "./world-import-fixtures";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "world-import-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

describe("dedupeNames", () => {
  it("numbers a name the realm or the bundle already uses, ignoring case and spaces", () => {
    expect(dedupeNames(["Aurelia", "Borealis", "aurelia ", "Cyrene"], ["borealis"])).toEqual([
      "Aurelia",
      "Borealis (2)",
      "aurelia (2)",
      "Cyrene",
    ]);
    expect(dedupeNames(["Aurelia", "Aurelia (2)", "Aurelia"], [])).toEqual([
      "Aurelia",
      "Aurelia (2)",
      "Aurelia (3)",
    ]);
  });
});

describe("runWorldDryRun", () => {
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

  it("flags the warnings about work the world replaces, apart from the notes", async () => {
    const db = seedRealm();
    const diff = await runWorldDryRun(db, jobFor(await stored()));
    expect(diff.replaces).toEqual([
      "The realm's current map (5 features) will be replaced",
      "2 nations that are not generated slots, or that a player holds, keep their country but lose their border",
      "1 earlier nation has an old claim on file and is kept as reserved, with no land",
    ]);
    // each is also in the full list, which holds the notes too
    expect(diff.warnings).toEqual(expect.arrayContaining(diff.replaces));
    expect(diff.warnings).toContain("1 names were already taken in this realm and got a number");
    expect(diff.replaces).not.toContain(
      "1 names were already taken in this realm and got a number"
    );
  });

  it("flags hand edits and map imports made since the last generation as replaced work", async () => {
    const db = seedRealm();
    db.mapImport.rows.push(
      {
        id: "i_prev",
        realmId: "r1",
        jobId: "j_prev",
        layerTypes: ["political"],
        mode: "replace",
        summary: { source: "world" },
        createdAt: new Date("2026-01-01T12:00:00Z"),
        rolledBackAt: null,
      },
      {
        id: "i_later",
        realmId: "r1",
        jobId: "j_later",
        layerTypes: ["political"],
        mode: "replace",
        summary: { source: "png" },
        createdAt: new Date("2026-01-03T12:00:00Z"),
        rolledBackAt: null,
      }
    );
    layer(db, "political", "manual-key").updatedAt = new Date("2026-01-02T12:00:00Z");
    const diff = await runWorldDryRun(db, jobFor(await stored()));
    expect(diff.replaces).toEqual(
      expect.arrayContaining([
        "1 features were edited by hand since the last generation and will be replaced",
        "1 map imports were applied since the last generation and will be replaced",
      ])
    );
  });

  it("flags nothing for a first world in an empty realm, and not the realm map's kept borders", async () => {
    const empty = seedRealm();
    empty.mapLayer.rows.splice(0);
    empty.country.rows.splice(0);
    expect((await runWorldDryRun(empty, jobFor(await stored()))).replaces).toEqual([]);
    const kept = await runWorldDryRun(
      seedRealm(),
      jobFor(await stored({ source: "realm-map" }), { options: { fittedMapVersion: 0 } })
    );
    expect(kept.replaces).toEqual([]);
    expect(kept.warnings.length).toBeGreaterThan(0);
  });

  it("warns of hand edits made since the last generation, not of the generation's own touches", async () => {
    const db = seedRealm();
    db.mapImport.rows.push({
      id: "i_prev",
      realmId: "r1",
      jobId: "j_prev",
      layerTypes: ["political"],
      mode: "replace",
      summary: { source: "world" },
      createdAt: new Date("2026-01-01T12:00:00Z"),
      rolledBackAt: null,
    });
    // slot_old was touched five minutes after the generation (its adjacency rebuild), manual-key a day later
    layer(db, "political", "slot_old").updatedAt = new Date("2026-01-01T12:05:00Z");
    layer(db, "political", "manual-key").updatedAt = new Date("2026-01-02T12:00:00Z");
    const diff = await runWorldDryRun(db, jobFor(await stored()));
    expect(diff.warnings).toContain(
      "1 features were edited by hand since the last generation and will be replaced"
    );
  });

  it("keeps the realm's borders for a realm map bundle and counts the regions that become nations", async () => {
    const db = seedRealm();
    const diff = await runWorldDryRun(
      db,
      jobFor(await stored({ source: "realm-map" }), { options: { fittedMapVersion: 0 } })
    );
    expect(diff.layers.political).toEqual({ create: 0, change: 0, retire: 0 });
    expect(diff.slots).toMatchObject({ create: 0, retire: 0 });
    expect(diff.warnings).toContain(
      "The realm's borders are kept: 0 regions with no nation become claimable nations"
    );
  });
});

describe("guards", () => {
  const bundleId = () => stored();

  it("lets only the realm's map editors in", async () => {
    const db = seedRealm();
    const job = jobFor(await bundleId(), { requestedBy: "someone" });
    await expect(runWorldDryRun(db, job)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(applyWorld(db, job)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      await runWorldDryRun(db, jobFor(await bundleId(), { requestedBy: "admin_1" }))
    ).toBeTruthy();
  });

  it("never generates Ixnay, not even for a site admin", async () => {
    const db = seedRealm({ id: "default", slug: "ixnay", ownerId: "system" });
    const job = jobFor(await bundleId(), { requestedBy: "admin_1", realmId: "default" });
    await expect(runWorldDryRun(db, job)).rejects.toThrow(/Ixnay/);
    await expect(applyWorld(db, job)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses an archived realm", async () => {
    const db = seedRealm({ status: "archived" });
    await expect(applyWorld(db, jobFor(await bundleId()))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it.each(["pending", "approved"])("is locked while a claim is %s", async (status) => {
    const db = seedRealm();
    db.realmClaim.rows.push({ id: "q_live", realmId: "r1", countryId: "c_old1", status });
    const job = jobFor(await bundleId());
    const before = stateOf(db);
    await expect(runWorldDryRun(db, job)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(applyWorld(db, job)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(stateOf(db)).toBe(before);
  });

  it("is not locked by claims that were rejected or withdrawn", async () => {
    const db = seedRealm();
    db.realmClaim.rows.push({ id: "q_no", realmId: "r1", countryId: null, status: "rejected" });
    expect(await runWorldDryRun(db, jobFor(await bundleId()))).toBeTruthy();
  });
});

describe("applyWorld", () => {
  it("writes the layers, replaces the slots, links the borders and records the generation", async () => {
    const db = seedRealm();
    const runRelief = relief();
    const result = await applyWorld(db, jobFor(await stored()), undefined, { runRelief });

    expect(result).toMatchObject({
      slots: { created: 3, retired: 1, opened: 3 },
      relief: { status: "built", version: "abc12345", tiles: 12, error: null },
      rollbackAvailable: true,
    });
    expect(result.rejected).toEqual([]);
    // 3 borders, 1 background, 1 altitude zone, 1 climate, 1 river
    expect(result.written).toBe(7);

    // c_old1 is retired; the owned slot, the slot with a claim row and the hand-made country are as they were
    expect(country(db, "c_old1")).toBeUndefined();
    expect(country(db, "c_old2")).toMatchObject({ worldgen: true, name: "Old Two" });
    expect(country(db, "c_owned")).toMatchObject({ ownerUserId: "u_player", name: "Old Owned" });
    expect(country(db, "c_manual")).toMatchObject({ worldgen: false, name: "Nation 2" });
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id)).toEqual(["q_withdrawn"]);

    // The new slots: worldgen, claimable, the bundle's figures, a free slug, the measured area, a deduped name
    const created = db.country.rows.filter(
      (c: { id: string }) => !["c_old2", "c_owned", "c_manual"].includes(c.id)
    );
    expect(created.map((c: { name: string }) => c.name)).toEqual([
      "Nation 1",
      "Nation 2 (2)",
      "Nation 3",
    ]);
    for (const c of created) {
      expect(c).toMatchObject({
        worldgen: true,
        claimable: true,
        realmId: "r1",
        baselinePopulation: 1_000_000,
        baselineGdpPerCapita: 20_000,
        wikiSource: null,
      });
      expect(c.landArea).toBeGreaterThan(40_000);
      expect(c.landArea).toBeLessThan(60_000);
      expect(c.areaSqMi).toBeCloseTo(c.landArea * 0.386102, 3);
      expect(c.slug).toMatch(/^nation-/);
    }
    expect(created[1].slug).toBe("nation-2-2");

    // Each border is keyed by its slot, linked to its country, named after it; the old ones are retired
    created.forEach((c: { id: string; name: string }, i: number) => {
      expect(layer(db, "political", `slot_${i + 1}`)).toMatchObject({
        countryId: c.id,
        displayName: c.name,
        isActive: true,
      });
    });
    expect(layer(db, "political", "slot_old")).toMatchObject({ isActive: false });
    expect(layer(db, "political", "manual-key")).toMatchObject({
      isActive: false,
      countryId: "c_manual",
    });
    expect(layer(db, "rivers", "1")).toMatchObject({ isActive: true });
    expect(layer(db, "rivers", "r_old")).toMatchObject({ isActive: false });
    expect(layer(db, "lakes", "l_old")).toMatchObject({ isActive: false });

    // The realm records the generation and its map version moved (the writer's refresh, then the slots' step)
    expect(db.realm.rows[0]).toMatchObject({
      seed: 42,
      generationParams: {
        params: { developmentLevel: "industrial" },
        developmentLevel: "industrial",
        source: "preset",
        engineVersion: expect.any(String),
      },
    });
    expect(db.realm.rows[0].mapVersion).toBeGreaterThanOrEqual(2);

    // One import record, marked as a world, with a snapshot to roll back to
    expect(db.mapImport.rows).toHaveLength(1);
    expect(db.mapImport.rows[0]).toMatchObject({
      jobId: "j_world",
      mode: "replace",
      rollbackAvailable: true,
      summary: { source: "world", slotsCreated: 3, slotsRetired: 1 },
    });

    // The relief is built after, from the bundle's cells
    expect(runRelief).toHaveBeenCalledTimes(1);
    const [, realmId, source] = runRelief.mock.calls[0]!;
    expect(realmId).toBe("r1");
    expect(Array.from((source as { cells: Float32Array }).cells)).toEqual(CELLS);
  });

  it("keeps a slot the founder made scenery unclaimable", async () => {
    const db = seedRealm();
    const id = await stored({ slots: [slot(1), slot(2, { claimable: false })] });
    await applyWorld(db, jobFor(id), undefined, { runRelief: relief() });
    const claimable = db.country.rows
      .filter(
        (c: { worldgen: boolean; id: string }) =>
          c.worldgen && /^c/.test(c.id) && !c.id.startsWith("c_")
      )
      .map((c: { name: string; claimable: boolean }) => [c.name, c.claimable]);
    expect(Object.fromEntries(claimable)).toEqual({ "Nation 1": true, "Nation 2 (2)": false });
  });

  it("gives an empty slot a token population and a floor GDP per capita", async () => {
    const db = seedRealm();
    const id = await stored({ slots: [slot(1, { population: 0, gdpPerCapita: 0 })] });
    await applyWorld(db, jobFor(id), undefined, { runRelief: relief() });
    const made = db.country.rows.find((c: { name: string }) => c.name === "Nation 1");
    expect(made).toMatchObject({ baselinePopulation: 1_000, baselineGdpPerCapita: 15_000 });
  });

  it("keeps the world when the relief step fails, and says so", async () => {
    const db = seedRealm();
    const runRelief = jest.fn().mockRejectedValue(new Error("sharp ran out of memory"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await applyWorld(db, jobFor(await stored()), undefined, { runRelief });
    error.mockRestore();
    expect(result.relief).toEqual({
      status: "failed",
      version: null,
      tiles: 0,
      error: "sharp ran out of memory",
    });
    expect(layer(db, "political", "slot_1")).toMatchObject({ isActive: true });
    expect(db.realm.rows[0].seed).toBe(42);
  });

  it("creates 500 slots with their own names and slugs", async () => {
    const db = seedRealm();
    // Nation 2 is taken by the realm's hand-made country
    const slots = Array.from({ length: 500 }, (_, i) => slot(i + 1));
    const political = slots.map((s, i) =>
      feature(square((i % 90) * 4 - 180, Math.floor(i / 90) * 4), { slotKey: s.key }, i + 1)
    );
    const id = await stored({ slots, political });
    const started = Date.now();
    const result = await applyWorld(db, jobFor(id), undefined, { runRelief: relief() });
    expect(result.slots.created).toBe(500);
    const names = db.country.rows.map((c: { name: string }) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const slugs = db.country.rows.map((c: { slug: string }) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(Date.now() - started).toBeLessThan(20_000);
  });
});

describe("a claim racing the apply (Review Focus 1)", () => {
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

describe("retiring slots (Review Focus 2)", () => {
  it("retires only unowned, unclaimed generated countries and touches no other", async () => {
    const db = seedRealm();
    db.country.rows.push({
      id: "c_scenery",
      name: "Scenery",
      slug: "scenery",
      realmId: "r1",
      worldgen: true,
      claimable: false,
      ownerUserId: null,
    });
    const keep = JSON.stringify(["c_owned", "c_manual"].map((id) => country(db, id)));
    const held = { ...country(db, "c_old2") };
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(db.country.deleteMany).toHaveBeenCalledTimes(1);
    const deleted = db.country.deleteMany.mock.calls[0][0].where.id.in;
    expect(deleted.sort()).toEqual(["c_old1", "c_scenery"]);
    expect(JSON.stringify(["c_owned", "c_manual"].map((id) => country(db, id)))).toBe(keep);
    // the one with only a claim row stays whole, but for being closed to claims
    expect(country(db, "c_old2")).toEqual({ ...held, claimable: false });
  });

  it("never deletes a slot that has any claim row, whatever its status", async () => {
    const db = seedRealm();
    db.realmClaim.rows.push({
      id: "q_old",
      realmId: "r1",
      countryId: "c_old1",
      status: "rejected",
    });
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(country(db, "c_old1")).toBeDefined();
    expect(db.realmClaim.rows.map((q: { id: string }) => q.id).sort()).toEqual([
      "q_old",
      "q_withdrawn",
    ]);
  });

  it("closes the unowned slots it keeps: with no land left they can't be claimed, and says how many", async () => {
    const db = seedRealm();
    const job = jobFor(await stored());
    const diff = await runWorldDryRun(db, job);
    expect(diff.slots).toMatchObject({ keep: 1, reserved: 1 });
    await applyWorld(db, job, undefined, { runRelief: relief() });
    // c_old2's withdrawn claim keeps it, its border is retired by the new world: reserved, not open to claim
    expect(country(db, "c_old2")).toMatchObject({ worldgen: true, claimable: false });
    expect(layer(db, "political", "slot_old")).toMatchObject({ isActive: false });
    // a player's nation is as it was (and a slot made scenery stays so)
    expect(country(db, "c_owned")).toMatchObject({ claimable: true, ownerUserId: "u_player" });
    expect(country(db, "c_manual")).toMatchObject({ claimable: true });
  });

  it("leaves a kept slot that is already scenery as it is, and a realm map apply closes nothing", async () => {
    const db = seedRealm();
    country(db, "c_old2").claimable = false;
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(country(db, "c_old2")).toMatchObject({ claimable: false });
    const kept = seedRealm();
    await applyWorld(kept, jobFor(await stored({ source: "realm-map" })), undefined, {
      runRelief: relief(),
    });
    expect(country(kept, "c_old2")).toMatchObject({ claimable: true });
  });

  it("keeps a slot a restricting foreign key holds (a blurb response), and does not count it as retired", async () => {
    const db = seedRealm();
    db.blurbResponse.rows.push({ id: "b1", countryId: "c_old1" });
    const job = jobFor(await stored());
    const diff = await runWorldDryRun(db, job);
    expect(diff.slots).toMatchObject({ retire: 0, keep: 1, reserved: 2 });
    expect(diff.replaces).toContain(
      "2 earlier nations have old claims on file and are kept as reserved, with no land"
    );
    await applyWorld(db, job, undefined, { runRelief: relief() });
    expect(country(db, "c_old1")).toBeDefined();
    expect(db.country.deleteMany.mock.calls[0][0].where.id.in).toEqual([]);
  });

  it("leaves another realm's generated countries alone", async () => {
    const db = seedRealm();
    db.country.rows.push({ id: "c_else", name: "Elsewhere", realmId: "r2", worldgen: true });
    await applyWorld(db, jobFor(await stored()), undefined, { runRelief: relief() });
    expect(country(db, "c_else")).toBeDefined();
  });
});
