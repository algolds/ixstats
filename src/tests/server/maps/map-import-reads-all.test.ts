/** @jest-environment node */
/**
 * The map import's reads past the guarded client's 1000-row cap: a realm with more rows than that (Ixnay has 4068
 * altitude bands) is read whole, so a check, a snapshot, a roll back or a world import never works from part of a
 * layer or part of the realm's nations, and pruning never removes a bundle a realm still needs because its import was
 * past the 1000 newest. `fakeDb` answers at most 1000 rows to a findMany with no `take`, as src/server/db.ts does.
 *
 * Folds: src/tests/server/maps/world-import-reads-all.test.ts, src/tests/server/maps/map-import-prune.test.ts
 */
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/geo-validation", () => ({
  isPostGISAvailable: jest.fn().mockResolvedValue(false),
}));

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { Polygon } from "geojson";
import { mapImportApplySchema, type EngineResult } from "~/lib/maps/import/options";
import { writeRealmMapFeatures } from "~/lib/maps/realm-map-writer";
import {
  captureMapSnapshot,
  heldSlots,
  restoreMapSnapshot,
  type MapImportSnapshot,
} from "~/lib/maps/realm-map-snapshot";
import { planMapImport } from "~/server/modules/maps/map-import.apply";
import { pruneWorldUploads } from "~/server/modules/maps/map-import.prune";
import { findImportRealm, realmNations } from "~/server/modules/maps/map-import.realm";
import { saveMapUpload } from "~/server/modules/maps/map-import.storage";
import { applyWorld, runWorldDryRun } from "~/server/modules/maps/world-import";
import { retirableSlots, unlinkedFeatures } from "~/server/modules/maps/world-import.slots";
import { fakeDb } from "./map-import-fakes";
import { jobFor, mapRow, relief, seedRealm, stored } from "./world-import-fixtures";

const N = 1001;
const many = <T>(make: (i: number) => T) => Array.from({ length: N }, (_, i) => make(i));
const ids = many((i) => `c${i}`);

describe("reads past the 1000-row cap", () => {
  it("captureMapSnapshot: every row of a layer and every country it links", async () => {
    const db = fakeDb();
    db.mapLayer.rows.push(...many((i) => mapRow("political", `p${i}`, { countryId: `c${i}` })));
    db.country.rows.push(...many((i) => ({ id: `c${i}`, realmId: "r1" })));
    const snapshot = await captureMapSnapshot(db, "r1", [
      { layerType: "political", keys: many((i) => `p${i}`), wholeLayer: true, countryIds: [] },
    ]);
    expect(snapshot.rows).toHaveLength(N);
    expect(snapshot.countries).toHaveLength(N);
  });

  it("unlinkedFeatures: every political feature with no country", async () => {
    const db = fakeDb();
    db.mapLayer.rows.push(...many((i) => mapRow("political", `p${i}`)));
    expect(await unlinkedFeatures(db, "r1")).toHaveLength(N);
  });

  it("realmNations: every country and every roster nation page of the realm", async () => {
    const db = fakeDb();
    db.country.rows.push(...many((i) => ({ id: `c${i}`, name: `Nation ${i}`, realmId: "r1" })));
    db.realmPage.rows.push(
      ...many((i) => ({ id: `p${i}`, realmId: "r1", kind: "nation", title: `Page ${i}` }))
    );
    const nations = await realmNations(db, "r1");
    expect(nations.countries).toHaveLength(N);
    // the candidates a name is checked against: every country and every page
    expect(nations.candidates).toHaveLength(2 * N);
  });

  it("retirableSlots: every generated slot nobody holds, and none a claim row or blurb response past the 1000th holds", async () => {
    const db = fakeDb();
    const slot = (id: string) => ({ id, realmId: "r1", worldgen: true, ownerUserId: null });
    // 1001 held by a claim row, 1001 by a blurb response, 1001 free
    db.country.rows.push(
      ...many((i) => slot(`claimed${i}`)),
      ...many((i) => slot(`blurbed${i}`)),
      ...many((i) => slot(`free${i}`))
    );
    db.realmClaim.rows.push(...many((i) => ({ id: `q${i}`, countryId: `claimed${i}` })));
    db.blurbResponse.rows.push(...many((i) => ({ id: `b${i}`, countryId: `blurbed${i}` })));
    const retirable = (await retirableSlots(db, "r1")).map((row) => row.id);
    expect(retirable.sort()).toEqual(many((i) => `free${i}`).sort());
  });

  it("heldSlots: every owner and every claim", async () => {
    const owned = fakeDb();
    owned.country.rows.push(...ids.map((id) => ({ id, realmId: "r1", ownerUserId: "u1" })));
    expect((await heldSlots(owned, ids)).size).toBe(N);
    const claimed = fakeDb();
    claimed.realmClaim.rows.push(...ids.map((id, i) => ({ id: `q${i}`, countryId: id })));
    expect((await heldSlots(claimed, ids)).size).toBe(N);
  });

  it("a restore keeps and reopens every held slot the import created, and puts back no retired slot still there", async () => {
    const db = fakeDb();
    const retired = many((i) => `old${i}`);
    db.country.rows.push(
      ...ids.map((id) => ({ id, realmId: "r1", ownerUserId: "u1", claimable: true })),
      ...retired.map((id) => ({ id, realmId: "r1" }))
    );
    const snapshot: MapImportSnapshot = {
      version: 1,
      realmId: "r1",
      rows: [],
      created: [],
      countries: [],
      slots: { created: ids, retired: retired.map((id) => ({ id })) as never, reserved: [] },
    };
    const result = await restoreMapSnapshot(db, snapshot);
    expect(result.slots).toMatchObject({ removed: 0, kept: N, restored: 0 });
    expect(db.country.rows.filter((c: { claimable: boolean }) => c.claimable)).toHaveLength(N);
    expect(db.country.rows).toHaveLength(2 * N);
  });

  it("realm-map-writer: links 1001 features to 1001 countries of the realm", async () => {
    const db = fakeDb();
    db.country.rows.push(...ids.map((id) => ({ id, realmId: "r1" })));
    const polygon: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    const features = ids.map((id) => ({ key: `f${id}`, geometry: polygon, countryId: id }));
    const written = await writeRealmMapFeatures(db, "r1", features, { syncCountryGeometry: false });
    expect(written.rejected.filter((r) => /not in this realm/.test(r.reason))).toEqual([]);
  });

  it("planMapImport: compares every border the realm has, and lists every one a replace retires", async () => {
    const square = (x: number, y: number, size = 0.4): Polygon => ({
      type: "Polygon",
      coordinates: [
        [
          [x, y],
          [x + size, y],
          [x + size, y + size],
          [x, y + size],
          [x, y],
        ],
      ],
    });
    const place = (i: number) => square(-170 + (i % 340), -80 + Math.floor(i / 340) * 2);
    const engine: EngineResult = {
      kind: "geojson",
      space: "lonlat",
      width: 360,
      height: 180,
      regions: many((i) => ({ key: `k${i}`, name: `Nation ${i}` })),
      features: {
        type: "FeatureCollection",
        features: many((i) => ({
          type: "Feature" as const,
          properties: { key: `k${i}` },
          geometry: place(i),
        })),
      },
      report: { log: [], warnings: [], timingsMs: {} },
    };
    const db = fakeDb();
    db.realm.rows.push({ id: "r1", slug: "eurth", name: "Eurth", ownerId: "f", settings: {} });
    db.mapLayer.rows.push(
      ...many((i) => mapRow("political", `Nation ${i}`, { displayName: `Nation ${i}` })),
      ...many((i) => mapRow("political", `Old ${i}`))
    );
    const apply = mapImportApplySchema.parse({
      mode: "replace",
      mapping: Object.fromEntries(many((i) => [`k${i}`, `Nation ${i}`])),
    });
    const plan = await planMapImport(db, await findImportRealm(db, "r1"), engine, apply, {});
    expect(plan.diff.features).toHaveLength(N);
    expect(plan.diff.features.filter((f) => f.status === "new")).toEqual([]);
    expect(plan.diff.removed).toHaveLength(N);
  });
});

describe("a world import in a realm with more than 1000 nations", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "world-import-"));
    process.env.MAP_IMPORT_DIR = dir;
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.MAP_IMPORT_DIR;
  });

  it("the check counts every kept slot and taken name; the apply closes each kept slot and numbers the name", async () => {
    const HELD = 1001;
    // The seeded realm plus 1001 generated slots nobody owns but a claim row holds, the last named like a new nation
    const db = seedRealm();
    for (let i = 0; i < HELD; i++) {
      db.country.rows.push({
        id: `held${i}`,
        name: i === HELD - 1 ? "Nation 3" : `Held ${i}`,
        slug: `held-${i}`,
        realmId: "r1",
        worldgen: true,
        claimable: true,
        ownerUserId: null,
      });
      db.realmClaim.rows.push({
        id: `q_held${i}`,
        realmId: "r1",
        countryId: `held${i}`,
        status: "withdrawn",
      });
    }
    const upload = await stored();
    const diff = await runWorldDryRun(db, jobFor(upload));
    // c_old2 (a withdrawn claim) and the 1001 held slots; Nation 2 (c_manual) and Nation 3 (the last held slot)
    expect(diff.slots).toMatchObject({ retire: 1, reserved: HELD + 1, renamed: 2 });

    await applyWorld(db, jobFor(upload), undefined, { runRelief: relief() });
    const open = db.country.rows.filter(
      (c: { id: string; claimable: boolean }) => c.id.startsWith("held") && c.claimable
    );
    expect(open).toEqual([]);
    const names = db.country.rows.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Nation 3", "Nation 3 (2)"]));
  });
});

/**
 * Pruning the stored world bundles: each "Use this world" check stores a 2 to 8 MB gzip in the map import folder.
 * Bundles older than 14 days go, except the one each realm's latest applied world import (and its relief rebuild)
 * reads; nothing outside the folder is ever touched.
 */
describe("pruneWorldUploads", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
  let root: string;
  let outside: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "map-prune-"));
    outside = mkdtempSync(path.join(tmpdir(), "map-prune-outside-"));
    process.env.MAP_IMPORT_DIR = root;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
    delete process.env.MAP_IMPORT_DIR;
  });

  const uploadFile = (id: string) => path.join(root, "uploads", id);
  /** A stored gzip (a world bundle, as far as the folder can tell) `days` old; its upload id. */
  async function bundle(label: string, days: number) {
    const id = await saveMapUpload(gzipSync(label));
    const at = new Date(NOW - days * DAY);
    utimesSync(uploadFile(id), at, at);
    return id;
  }
  /** The import a realm's applied world left, and the job whose upload it read. */
  function appliedWorld(
    db: ReturnType<typeof fakeDb>,
    realmId: string,
    uploadId: string,
    day: number,
    layerTypes = ["political", "altitudes"]
  ) {
    const jobId = `j_${uploadId.slice(0, 6)}`;
    db.mapImportJob.rows.push({ id: jobId, realmId, uploadId });
    db.mapImport.rows.push({
      id: `i_${jobId}`,
      realmId,
      jobId,
      layerTypes,
      summary: { source: "world" },
      rolledBackAt: null,
      createdAt: new Date(NOW - day * DAY),
    });
  }

  it("removes old bundles no realm needs, keeps each realm's latest world and the relief's, past the 1000 newest imports too", async () => {
    const db = fakeDb();
    const old = await bundle("an old world nobody applied", 15);
    const fresh = await bundle("a fresh world", 13);
    // r1 applied two worlds: only the later one is still needed
    const first = await bundle("first world", 40);
    const second = await bundle("second world", 30);
    appliedWorld(db, "r1", first, 40);
    appliedWorld(db, "r1", second, 30);
    // r2's later world kept the realm's elevation: the relief rebuild still reads the earlier one
    const shaded = await bundle("world with elevation", 40);
    const fitted = await bundle("world fitted to the map", 30);
    appliedWorld(db, "r2", shaded, 40);
    appliedWorld(db, "r2", fitted, 30, ["climate"]);
    // every import above is older than the 1001 a busy realm made since
    for (let i = 0; i < N; i++) {
      db.mapImport.rows.push({
        id: `busy_${i}`,
        realmId: "busy",
        jobId: null,
        layerTypes: ["political"],
        summary: { source: "pipeline" },
        rolledBackAt: null,
        createdAt: new Date(NOW - DAY + i),
      });
    }
    const removed = await pruneWorldUploads(db, NOW);
    expect([...removed].sort()).toEqual([first, old].sort());
    for (const kept of [fresh, second, shaded, fitted])
      expect(existsSync(uploadFile(kept))).toBe(true);
    expect(existsSync(uploadFile(old))).toBe(false);
  });

  it.each([
    [
      "a link in the folder to a file outside it",
      () => {
        const target = path.join(outside, "precious.gz");
        writeFileSync(target, gzipSync("not an upload"));
        utimesSync(target, new Date(NOW - 100 * DAY), new Date(NOW - 100 * DAY));
        mkdirSync(path.join(root, "uploads"), { recursive: true });
        symlinkSync(target, uploadFile("a".repeat(64)));
        return target;
      },
    ],
    [
      "an uploads folder that is a link to another folder",
      () => {
        const elsewhere = path.join(outside, "uploads");
        mkdirSync(elsewhere);
        const file = path.join(elsewhere, "b".repeat(64));
        writeFileSync(file, gzipSync("a bundle in another folder"));
        utimesSync(file, new Date(NOW - 100 * DAY), new Date(NOW - 100 * DAY));
        symlinkSync(elsewhere, path.join(root, "uploads"));
        return file;
      },
    ],
  ])("never follows %s", async (_case, plant) => {
    const outsideFile = plant();
    expect(await pruneWorldUploads(fakeDb(), NOW)).toEqual([]);
    expect(existsSync(outsideFile)).toBe(true);
  });
});
